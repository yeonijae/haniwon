import { getModel } from '../lib/geminiClient';
import type { DosageInstruction } from '../types';

export interface PatientContext {
  name?: string;
  age?: number;
  gender?: 'male' | 'female';
  chiefComplaint: string; // 주소증
}

export interface AIRecommendation {
  recommendedId: number;
  diseaseName: string;
  category: string;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
  modificationSuggestion?: string;
}

export interface AIGeneratedDescription {
  title: string;
  description: string;
  basedOn: string[]; // 참고한 템플릿들
}

// 증상-카테고리 매핑 (로컬 필터링용)
const SYMPTOM_CATEGORY_MAP: Record<string, string[]> = {
  '소아&청소년': ['ADHD', 'TIC', '틱', '성장', '야뇨', '비염', '아토피', '식욕', '소아'],
  '부인과&산과': ['생리', '월경', '임신', '출산', '갱년기', '폐경', '자궁', '난소', '유방', '냉대하', '불임'],
  '피부': ['아토피', '습진', '두드러기', '가려움', '건선', '여드름', '피부염', '탈모'],
  '소화기': ['소화', '위장', '복통', '변비', '설사', '역류', '위염', '장염', '복부', '식욕'],
  '호흡기,안이비': ['기침', '천식', '비염', '축농', '감기', '호흡', '코막힘', '인후', '편도', '이명'],
  '신경정신': ['불면', '우울', '불안', '스트레스', '두통', '어지러움', '공황', '신경'],
  '순환': ['혈압', '어혈', '부종', '수족냉증', '저림', '순환', '혈액'],
  '비뇨기': ['소변', '방광', '전립선', '요로', '배뇨'],
  '다이어트': ['비만', '다이어트', '체중', '복부비만'],
  '보약,피로,면역': ['피로', '면역', '보약', '기력', '체력', '허약', '보양'],
  '교통사고,상해': ['교통사고', '사고', '타박', '염좌', '골절'],
  '호르몬,대사': ['당뇨', '갑상선', '호르몬', '대사']
};

// 로컬 필터링: 환자 정보 기반으로 관련 템플릿 추출 (최대 15개)
function preFilterTemplates(
  patient: PatientContext,
  templates: DosageInstruction[],
  maxCount: number = 15
): DosageInstruction[] {
  const chiefComplaint = patient.chiefComplaint.toLowerCase();
  const keywords = chiefComplaint.split(/[\s,、]+/).filter(k => k.length >= 2);

  // 점수 계산
  const scored = templates.map(template => {
    let score = 0;

    const searchText = `${template.disease_name || ''} ${template.condition_detail || ''} ${template.category || ''} ${template.subcategory || ''}`.toLowerCase();
    const keywordsText = Array.isArray(template.keywords)
      ? template.keywords.join(' ').toLowerCase()
      : '';
    const fullSearchText = searchText + ' ' + keywordsText;

    // 1. 나이 기반 카테고리 매칭
    if (patient.age !== undefined) {
      if (patient.age <= 12 && template.category === '소아&청소년') {
        score += 30;
      } else if (patient.age > 12 && patient.age < 20 && template.subcategory === '청소년') {
        score += 25;
      } else if (patient.age <= 12 && template.category !== '소아&청소년') {
        score -= 10; // 소아인데 소아 카테고리가 아니면 감점
      }
    }

    // 2. 성별 기반 카테고리 매칭
    if (patient.gender === 'female') {
      const femaleKeywords = ['생리', '월경', '임신', '출산', '갱년기', '자궁', '난소'];
      if (femaleKeywords.some(k => chiefComplaint.includes(k))) {
        if (template.category === '부인과&산과') {
          score += 30;
        }
      }
    }

    // 3. 주소증 키워드 매칭
    for (const keyword of keywords) {
      if (fullSearchText.includes(keyword)) {
        score += 20;
      }
      // 부분 매칭
      if (template.disease_name?.toLowerCase().includes(keyword)) {
        score += 15;
      }
    }

    // 4. 카테고리-증상 매핑 매칭
    for (const [category, symptoms] of Object.entries(SYMPTOM_CATEGORY_MAP)) {
      if (symptoms.some(s => chiefComplaint.includes(s))) {
        if (template.category === category) {
          score += 25;
        }
      }
    }

    return { template, score };
  });

  // 점수순 정렬 후 상위 N개 반환
  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxCount)
    .map(s => s.template);
}

// 로컬 필터링 결과가 없을 때 폴백: 카테고리 기반 필터링
function fallbackFilter(
  patient: PatientContext,
  templates: DosageInstruction[],
  maxCount: number = 10
): DosageInstruction[] {
  let category = '일반';

  if (patient.age !== undefined && patient.age <= 12) {
    category = '소아&청소년';
  } else if (patient.gender === 'female') {
    const femaleKeywords = ['생리', '월경', '임신', '출산', '갱년기'];
    if (femaleKeywords.some(k => patient.chiefComplaint.includes(k))) {
      category = '부인과&산과';
    }
  }

  const filtered = templates.filter(t => t.category === category);
  return filtered.length > 0 ? filtered.slice(0, maxCount) : templates.slice(0, maxCount);
}

const SYSTEM_PROMPT = `당신은 한의원의 복용법 설명 전문가입니다.

[역할]
환자의 정보(나이, 성별)와 주소증을 바탕으로 가장 적절한 질환설명 템플릿을 추천합니다.

[출력 형식 - 반드시 JSON으로 응답]
{
  "recommendedIndex": 0,
  "confidence": "high|medium|low",
  "reason": "추천 이유 (1-2문장)",
  "modificationSuggestion": "환자 맞춤 수정 제안 (선택사항)"
}

[선택 기준]
1. 주소증과 질환명/키워드의 연관성
2. 환자 나이에 따른 카테고리 (만 12세 이하는 소아&청소년 우선)
3. 성별 특성 (여성 특유 증상은 부인과&산과 확인)
4. 복합 증상 시 주요 증상 기준

[주의]
- recommendedIndex는 제공된 템플릿 목록의 인덱스(0부터 시작)
- 적합한 템플릿이 없으면 가장 유사한 것을 선택하고 confidence를 "low"로 설정
- 반드시 유효한 JSON만 출력`;

export async function getAIRecommendation(
  patient: PatientContext,
  templates: DosageInstruction[]
): Promise<AIRecommendation | null> {
  const model = getModel();
  if (!model) {
    console.error('Gemini 모델을 사용할 수 없습니다.');
    return null;
  }

  // 로컬 필터링으로 후보군 축소 (304개 → 최대 15개)
  let filteredTemplates = preFilterTemplates(patient, templates, 15);
  if (filteredTemplates.length === 0) {
    filteredTemplates = fallbackFilter(patient, templates, 10);
  }
  console.log(`AI 추천: ${templates.length}개 → ${filteredTemplates.length}개로 필터링됨`);

  // 템플릿 목록을 간략화하여 프롬프트에 포함
  const templateList = filteredTemplates.map((t, idx) => ({
    index: idx,
    id: t.id,
    category: t.category,
    diseaseName: t.disease_name,
    conditionDetail: t.condition_detail,
    keywords: t.keywords
  }));

  const patientInfo = `
환자 정보:
- 나이: ${patient.age ? `${patient.age}세` : '미상'}
- 성별: ${patient.gender === 'male' ? '남성' : patient.gender === 'female' ? '여성' : '미상'}
- 주소증: ${patient.chiefComplaint}
`;

  const prompt = `${patientInfo}

다음 템플릿 목록에서 가장 적합한 것을 선택하세요:

${JSON.stringify(templateList, null, 2)}

JSON 형식으로만 응답하세요.`;

  try {
    const result = await model.generateContent([
      { text: SYSTEM_PROMPT },
      { text: prompt }
    ]);

    const response = result.response.text();

    // JSON 추출 (마크다운 코드블록 제거)
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('JSON 파싱 실패:', response);
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const selectedTemplate = filteredTemplates[parsed.recommendedIndex];

    if (!selectedTemplate) {
      console.error('잘못된 템플릿 인덱스:', parsed.recommendedIndex);
      return null;
    }

    return {
      recommendedId: selectedTemplate.id,
      diseaseName: selectedTemplate.disease_name,
      category: selectedTemplate.category,
      confidence: parsed.confidence || 'medium',
      reason: parsed.reason || '주소증과 연관된 템플릿입니다.',
      modificationSuggestion: parsed.modificationSuggestion
    };
  } catch (error) {
    console.error('AI 추천 오류:', error);
    return null;
  }
}

// 여러 추천을 받는 함수 (상위 3개)
export async function getMultipleRecommendations(
  patient: PatientContext,
  templates: DosageInstruction[],
  count: number = 3
): Promise<AIRecommendation[]> {
  const model = getModel();
  if (!model) {
    console.error('Gemini 모델을 사용할 수 없습니다.');
    return [];
  }

  // 로컬 필터링으로 후보군 축소
  let filteredTemplates = preFilterTemplates(patient, templates, 15);
  if (filteredTemplates.length === 0) {
    filteredTemplates = fallbackFilter(patient, templates, 10);
  }
  console.log(`AI 다중 추천: ${templates.length}개 → ${filteredTemplates.length}개로 필터링됨`);

  const templateList = filteredTemplates.map((t, idx) => ({
    index: idx,
    id: t.id,
    category: t.category,
    diseaseName: t.disease_name,
    conditionDetail: t.condition_detail,
    keywords: t.keywords
  }));

  const patientInfo = `
환자 정보:
- 나이: ${patient.age ? `${patient.age}세` : '미상'}
- 성별: ${patient.gender === 'male' ? '남성' : patient.gender === 'female' ? '여성' : '미상'}
- 주소증: ${patient.chiefComplaint}
`;

  const multiPrompt = `${patientInfo}

다음 템플릿 목록에서 가장 적합한 ${count}개를 순서대로 선택하세요:

${JSON.stringify(templateList, null, 2)}

[출력 형식 - 반드시 JSON 배열로 응답]
[
  {
    "recommendedIndex": 0,
    "confidence": "high|medium|low",
    "reason": "추천 이유"
  },
  ...
]`;

  try {
    const result = await model.generateContent([
      { text: SYSTEM_PROMPT },
      { text: multiPrompt }
    ]);

    const response = result.response.text();
    const jsonMatch = response.match(/\[[\s\S]*\]/);

    if (!jsonMatch) {
      console.error('JSON 배열 파싱 실패:', response);
      return [];
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return parsed
      .filter((item: any) => filteredTemplates[item.recommendedIndex])
      .map((item: any) => {
        const template = filteredTemplates[item.recommendedIndex];
        return {
          recommendedId: template.id,
          diseaseName: template.disease_name,
          category: template.category,
          confidence: item.confidence || 'medium',
          reason: item.reason || ''
        };
      });
  } catch (error) {
    console.error('AI 다중 추천 오류:', error);
    return [];
  }
}

// AI가 직접 작성한 설명 생성
export async function generateCustomDescription(
  patient: PatientContext,
  templates: DosageInstruction[]
): Promise<AIGeneratedDescription | null> {
  const model = getModel();
  if (!model) {
    console.error('Gemini 모델을 사용할 수 없습니다.');
    return null;
  }

  // 관련 템플릿 찾기 (주소증 키워드 기반)
  const keywords = patient.chiefComplaint.toLowerCase().split(/[\s,]+/);
  const relevantTemplates = templates
    .filter(t => {
      const searchText = `${t.disease_name} ${t.condition_detail || ''} ${t.keywords?.join(' ') || ''} ${t.description || ''}`.toLowerCase();
      return keywords.some(k => k.length >= 2 && searchText.includes(k));
    })
    .slice(0, 5);

  // 참고할 템플릿이 없으면 전체에서 샘플링
  const sampleTemplates = relevantTemplates.length > 0
    ? relevantTemplates
    : templates.slice(0, 5);

  const templateExamples = sampleTemplates.map(t => ({
    diseaseName: t.disease_name,
    conditionDetail: t.condition_detail,
    description: t.description
  }));

  const patientName = patient.name ? `${patient.name}님` : '환자분';

  const generatePrompt = `당신은 한의원의 복용법 설명 전문가입니다.

환자 정보:
- 이름: ${patient.name || '미상'}
- 나이: ${patient.age ? `${patient.age}세` : '미상'}
- 성별: ${patient.gender === 'male' ? '남성' : patient.gender === 'female' ? '여성' : '미상'}
- 주소증: ${patient.chiefComplaint}

다음은 참고할 기존 템플릿 예시입니다:
${JSON.stringify(templateExamples, null, 2)}

위 템플릿들의 문체와 형식을 참고하여, 환자의 주소증에 맞는 새로운 질환 설명을 작성해주세요.

[작성 규칙]
1. 한의학적 관점에서 설명
2. ○ 기호로 단락 구분
3. 환자가 이해하기 쉬운 표현 사용
4. 3-5개 단락으로 구성
5. 질환의 원인, 증상, 치료 방향 포함
6. "환자분" 대신 "${patientName}"이라는 호칭 사용
7. 친근하고 따뜻한 말투로 작성 (예: "~입니다", "~해주세요", "~하시면 좋아요")
8. 단호하거나 딱딱한 표현 대신 부드럽고 격려하는 표현 사용

[출력 형식 - JSON]
{
  "title": "질환명 또는 증상명",
  "description": "○ 첫번째 단락...\\n○ 두번째 단락...",
  "basedOn": ["참고한 템플릿1", "참고한 템플릿2"]
}

JSON만 출력하세요.`;

  try {
    const result = await model.generateContent(generatePrompt);
    const response = result.response.text();

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('JSON 파싱 실패:', response);
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      title: parsed.title || '맞춤 설명',
      description: parsed.description || '',
      basedOn: parsed.basedOn || sampleTemplates.map(t => t.disease_name)
    };
  } catch (error) {
    console.error('AI 설명 생성 오류:', error);
    return null;
  }
}
