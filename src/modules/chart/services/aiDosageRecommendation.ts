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

  // 템플릿 목록을 간략화하여 프롬프트에 포함
  const templateList = templates.map((t, idx) => ({
    index: idx,
    id: t.id,
    category: t.category,
    diseaseName: t.disease_name,
    conditionDetail: t.condition_detail,
    keywords: t.keywords,
    descriptionPreview: t.description?.substring(0, 100) + '...'
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
    const selectedTemplate = templates[parsed.recommendedIndex];

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

  const templateList = templates.map((t, idx) => ({
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
      .filter((item: any) => templates[item.recommendedIndex])
      .map((item: any) => {
        const template = templates[item.recommendedIndex];
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
