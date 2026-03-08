import { useState, useEffect, useMemo, Fragment } from 'react';
import { format, subDays } from 'date-fns';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { diarizeTranscript, updateDiarizedTranscript } from '../../pad/services/transcriptionService';

const API_URL = import.meta.env.VITE_POSTGRES_API_URL || 'http://192.168.0.173:5200';

interface MedicalTranscript {
  id: number;
  acting_id: number;
  patient_id: number;
  recording_date?: string | null;
  patient_name: string | null;
  chart_number: string | null;
  doctor_id: number;
  doctor_name: string;
  acting_type: string;
  audio_path: string | null;
  transcript: string;
  diarized_transcript: string | null;
  duration_sec: number;
  soap_subjective: string | null;
  soap_objective: string | null;
  soap_assessment: string | null;
  soap_plan: string | null;
  soap_status: 'pending' | 'processing' | 'completed' | 'failed';
  processing_status: 'uploading' | 'transcribing' | 'processing' | 'completed' | 'failed' | null;
  processing_message: string | null;
  coaching_text?: string | null;
  coaching_model?: string | null;
  coaching_input_tokens?: number | null;
  coaching_output_tokens?: number | null;
  coaching_total_tokens?: number | null;
  coaching_elapsed_ms?: number | null;
  coaching_estimated_cost_usd?: number | null;
  coaching_estimated_cost_krw?: number | null;
  chart_text?: string | null;
  created_at: string;
  updated_at: string;
}

interface PatientInfo {
  chart_no: string;
  patient_name: string;
}

interface CoachingMeta {
  model?: string;
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  elapsed_ms?: number;
  estimated_cost_usd?: number;
  estimated_cost_krw?: number;
}

type AsyncJobStatus = 'pending' | 'running' | 'completed' | 'failed';

interface AsyncJobTracker {
  transcriptId: number;
  jobId: string;
  status: AsyncJobStatus;
  message?: string;
  startedAt?: string;
  finishedAt?: string;
}

const COACHING_JOBS_STORAGE_KEY = 'medical_transcripts_coaching_jobs';
const SOAP_JOBS_STORAGE_KEY = 'medical_transcripts_soap_jobs';

type ViewMode = 'day' | '3weeks' | '3months' | 'all';
type PipelineCategory = 'saving' | 'transcribing' | 'done' | 'failed';
type DetailTab = 'raw' | 'diarized' | 'soap' | 'coaching';

const CONSULTATION_COACHING_PROMPT_V2 = `당신은 한의사 상담 코칭 전문가이며, 특히 연이재한의원의 복부중심 진료 상담을 분석하고 코칭하는 전문가입니다.

입력은 2가지입니다.
1) 연이재 차트
2) 화자분리된 상담 녹취

당신의 목표는 이 상담이 환자가 한약 복용을 결심하도록 충분히 설득력 있게 이루어졌는지 평가하고, 부족한 부분을 실전 코칭 형태로 제안하는 것입니다.

당신은 단순 요약가가 아니라, 상담의 전환율을 높이는 코치처럼 분석해야 합니다.

[핵심 평가 목표]
이 상담이 다음을 얼마나 잘 수행했는지 평가하십시오.
1. 환자가 자신의 상태를 이해하도록 만들었는가
2. 왜 한약 치료가 필요한지 납득하게 했는가
3. 침·약침·생활관리만이 아니라 한약 복용의 필요성까지 연결했는가
4. 최종적으로 환자가 결심할 수 있는 구조와 멘트가 있었는가

[차트 해석 규칙]
연이재 차트는 다음 구조를 가질 수 있습니다.
- 제목행
- [주소증]
- [문진]
- [복진]
- [설진]
- [맥진]
- [혈색]
- [티칭]
- [처방]

1. 제목행 해석
제목행에서 다음 정보를 추출하십시오.
- 상담 주제
- 한약 관련 태그
- 환자명
- 환자번호
- 진료일
- 진료자

2. [주소증] 해석
[주소증]은 환자가 병원에 온 가장 직접적인 이유와 핵심 증상을 담고 있습니다.
다음을 정리하십시오.
- 이번 내원의 핵심 목적
- 가장 불편한 1차 증상
- 동반 증상
- 발병 계기
- 기능 저하
- 환자가 직접 표현한 고충

또한 의사가 주소증을 실제 상담에서 얼마나 정확히 다시 짚어주었는지 평가하십시오.

3. [문진] 해석
[문진]은 단순 기록이 아니라 설명의 재료입니다.
다음을 평가하십시오.
- 수면, 피로, 식사, 소화, 대소변, 한열, 땀, 월경, 생활패턴 등의 정보가 실제 상담 설명에 활용되었는가
- 단순히 기록만 하고 설명에는 쓰지 못했는가
- 문진 내용을 한약 필요성과 연결했는가

4. [복진] 해석
[복진]은 연이재 상담의 핵심 근거입니다.
다음을 평가하십시오.
- 복진 소견을 환자가 이해할 수 있는 말로 설명했는가
- 복부 상태와 증상을 연결했는가
- 복진 결과를 치료 방향과 연결했는가
- 환자가 “아 그래서 그렇구나”라고 느낄 만한 인사이트를 주었는가

주의:
복진 용어를 그대로 반복하는지, 아니면 환자 언어로 번역했는지를 구분해서 평가하십시오.

5. [설진], [맥진], [혈색] 해석
이 정보는 보조 근거입니다.
다음을 평가하십시오.
- 실제 상담에서 언급되었는가
- 언급되지 않았더라도 설명의 논리적 근거로 활용 가능한가
- 복진 중심 설명을 보완하는 역할을 했는가

6. [티칭] 해석 규칙
연이재 차트에서는 [티칭]이 비어 있는 경우가 많습니다.
이는 설명이 없었다는 뜻이 아니라, 실제 설명을 구두로만 하고 기록하지 않았을 가능성이 큽니다.

따라서 반드시 다음 원칙을 따르십시오.
- [티칭]이 비어 있어도 녹취를 근거로 실제 티칭 내용을 복원하십시오.
- 의사가 환자에게 설명한 내용을 녹취에서 찾아 실질적인 티칭 내용으로 재구성하십시오.
- 차트에 [티칭]이 없다는 이유만으로 설명이 없었다고 단정하지 마십시오.
- 반대로 녹취에도 설명이 부족하면, 그때는 실제 티칭 부족으로 평가하십시오.

녹취에서 복원할 내용:
- 현재 상태 설명
- 왜 이런 증상이 생겼는지
- 복부 상태와 증상 연결 설명
- 한약 복용 이유
- 치료 기간 및 기대 변화
- 생활관리 조언

7. [처방] 해석
[처방]은 실제 클로징 결과를 보여주는 중요한 자료입니다.
다음을 구분해서 평가하십시오.
- 한약이 실제 처방되었는가
- 처방이 상담 흐름상 자연스럽게 연결되었는가
- 처방은 나갔지만 상담 설득은 약했는가
- 환자가 충분히 납득한 뒤 처방받았는가, 아니면 수동적으로 진행되었는가

중요:
[처방]이 존재한다는 사실과 상담이 설득력 있었다는 것은 동일하지 않습니다.
반드시 녹취를 통해
- 환자의 납득
- 환자의 질문
- 환자의 결심 신호
를 따로 평가하십시오.

[녹취 분석 규칙]
녹취에서는 다음을 반드시 분석하십시오.
- 질문의 질
- 공감 표현
- 상태 재정리
- 복진/문진 기반 설명
- 한약 필요성 설명
- 환자 저항 처리
- 클로징
- 결심 신호
- 말의 길이와 밀도
- 설명 후 확인 질문 여부

[상담 구조 평가 항목]

1. 환자 이해
평가 기준:
- 환자의 핵심 불편을 정확히 짚었는가
- 증상을 기능 저하와 연결해 이해했는가
- 환자의 말을 정리해서 다시 돌려주었는가

2. 공감 형성
평가 기준:
- 환자의 부담과 불편을 언어로 받아주었는가
- 환자가 “이해받고 있다”는 느낌을 받을 수 있었는가
- 상황을 정상화하거나 불안을 완화했는가

3. 진단 인사이트
평가 기준:
- 현재 상태를 환자가 납득하도록 설명했는가
- 복진 소견과 증상을 연결했는가
- 왜 이런 문제가 생겼는지 설명했는가

4. 치료 필요성 설명
평가 기준:
- 단순 경과관찰이 아니라 치료 필요성을 만들었는가
- 왜 한약이 필요한지 설명했는가
- 한약의 역할과 치료 목표를 연결했는가

5. 옵션 제시
평가 기준:
- 치료 선택지가 구조화되었는가
- 단순 권유가 아니라 선택의 틀을 주었는가
- 한약 복용에 대한 문턱을 낮췄는가

6. 저항 대응
평가 기준:
- 비용, 기간, 복용 부담, 효과에 대한 우려를 다뤘는가
- 환자가 드러내지 않은 망설임까지 줄여주었는가

7. 클로징
평가 기준:
- 명확하게 한약을 권유했는가
- 환자가 결정할 수 있는 문장을 제시했는가
- 처방으로 이어지는 마지막 다리가 있었는가

[상담 밸런스 분석]
반드시 다음을 평가하십시오.
- 의사 발화량 vs 환자 발화량
- 의사 설명이 길어지는 구간
- 환자 말을 충분히 들었는지
- 듣기만 하고 방향 제시는 약하지 않았는지
- 중요한 설명 뒤에 환자 반응 확인이 있었는지

다음 유형 중 하나 이상으로 판정하십시오.
- 설명 과다형
- 청취 과다형
- 균형형
- 정보는 많지만 전환이 약한 형
- 공감은 좋으나 클로징이 약한 형

[한약 전환 설득력 평가]
다음을 별도로 강하게 평가하십시오.
- 환자가 왜 지금 한약을 복용해야 하는지 납득했는가
- 한약의 역할이 구체적이었는가
- 단순 보약이 아니라 치료의 일부로 설명되었는가
- 복용 기간, 기대 변화, 복용 이유가 연결되었는가
- 환자가 수동적으로 따라간 것이 아니라 이해 후 결심했는가

다음 중 하나로 판정하십시오.
- 매우 설득력 있음
- 대체로 설득력 있음
- 설명은 있었으나 결심 유도가 약함
- 처방은 했지만 설득 구조는 약함
- 한약 필요성 전달 실패

[결심 신호 분석]
녹취에서 다음을 찾으십시오.
- 수용 신호: “네”, “그럼 그렇게 할게요”, “먹어볼게요”
- 정보 신호: “얼마나 먹어요?”, “어떻게 먹어요?”
- 망설임 신호: “꼭 먹어야 하나요?”, “생각해볼게요”
- 저항 신호: 가격, 기간, 번거로움, 효과 의심
- 숨은 저항 신호: 반응이 짧아짐, 질문이 없어짐, 주제를 돌림

[상담 점수화]
총점 100점으로 평가하십시오.
- 환자 이해 15
- 공감 형성 10
- 진단 인사이트 20
- 치료 필요성 설명 15
- 옵션 제시 10
- 저항 대응 10
- 클로징 10
- 말의 균형 5
- 설명 명확성 5

반드시
- 항목별 점수
- 총점
- 한 줄 총평
을 제시하십시오.

[문제 유형 진단]
다음 유형 중 해당되는 것을 판정하십시오. 복수 선택 가능합니다.
- 설명 과다형
- 청취 과다형
- 복진 번역 부족형
- 치료 필요성 약형
- 한약 프레이밍 약형
- 저항 처리 부족형
- 클로징 부재형
- 처방은 있으나 납득 형성 부족형

[개선 코칭]
개선 코칭은 반드시 실전형으로 작성하십시오.
각 개선점마다 다음 형식으로 작성하십시오.
- 개선 포인트
- 왜 중요한가
- 이렇게 바꾸면 좋다
- 예시 멘트 2~5개

[상담 리라이트]
상담 전체를 다 고치지 말고, 전환율에 가장 중요한 구간만 고치십시오.
우선순위:
1. 진단 설명 구간
2. 한약 필요성 연결 구간
3. 클로징 구간

리라이트 원칙:
- 연이재 스타일
- 과장 금지
- 지나친 장문 금지
- 따뜻하지만 분명한 어조
- 환자가 결심하기 쉽게

[출력 형식]
반드시 아래 순서로 출력하십시오.
각 섹션 제목은 반드시 마크다운 H2 형식으로 작성하십시오.
예: ## 1. 상담 요약
번호는 1부터 11까지 순서대로 정확히 표기하십시오.

## 1. 상담 요약

## 2. 차트-녹취 일치도 분석
- 차트 내용 중 상담에 잘 반영된 부분
- 차트에는 있으나 설명에 못 쓴 부분
- [티칭] 복원 내용

## 3. 상담 구조 평가
- 환자 이해
- 공감 형성
- 진단 인사이트
- 치료 필요성 설명
- 옵션 제시
- 저항 대응
- 클로징
각 항목은 우수/보통/부족으로 평가하고 근거를 쓰십시오.

## 4. 상담 밸런스 분석

## 5. 한약 전환 설득력 평가

## 6. 결심 신호 분석

## 7. 상담 점수
- 항목별 점수
- 총점
- 총평

## 8. 문제 유형 진단

## 9. 개선 코칭

## 10. 추천 클로징 멘트
실제 진료실에서 바로 쓸 수 있는 문장 3개 이상 제시하십시오.

## 11. 핵심 리라이트
- 진단 설명 리라이트
- 한약 필요성 연결 리라이트
- 클로징 리라이트

[중요 원칙]
- [처방]이 있다고 무조건 상담 성공으로 보지 마십시오.
- [티칭]이 비어 있어도 녹취에서 반드시 설명을 복원하십시오.
- 차트에 있는 좋은 단서를 실제 상담이 못 살렸다면 중요한 개선점으로 지적하십시오.
- 비판은 날카롭게 하되 목적은 비난이 아니라 전환율 향상입니다.
- 추상적 조언보다 실제 문장 코칭을 더 많이 제시하십시오.

[입력 데이터]
[연이재 차트]
{{chartText}}

[화자분리된 상담 녹취]
{{transcriptText}}`;

interface MedicalTranscriptsProps {
  selectedDoctorName?: string;
}

const MedicalTranscripts: React.FC<MedicalTranscriptsProps> = ({ selectedDoctorName }) => {
  // 상태 관리
  const [viewMode, setViewMode] = useState<ViewMode>('all');
  const [baseDate, setBaseDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [transcripts, setTranscripts] = useState<MedicalTranscript[]>([]);
  const [patientMap, setPatientMap] = useState<Map<number, PatientInfo>>(new Map());
  const [chartNumberPatientMap, setChartNumberPatientMap] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(false);
  const [selectedTranscript, setSelectedTranscript] = useState<MedicalTranscript | null>(null);

  // 필터 상태
  const [searchQuery, setSearchQuery] = useState('');
  const [pipelineFilter, setPipelineFilter] = useState<PipelineCategory | null>(null);

  // 작업 상태
  const [isReprocessing, setIsReprocessing] = useState(false);
  const [isDiarizing, setIsDiarizing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [detailTab, setDetailTab] = useState<DetailTab>('raw');
  const [isGeneratingCoaching, setIsGeneratingCoaching] = useState(false);
  const [coachingError, setCoachingError] = useState<string | null>(null);
  const [coachingTextMemory, setCoachingTextMemory] = useState<Record<number, string>>({});
  const [coachingMetaMemory, setCoachingMetaMemory] = useState<Record<number, CoachingMeta>>({});
  const [coachingJobs, setCoachingJobs] = useState<Record<number, AsyncJobTracker>>({});
  const [soapJobs, setSoapJobs] = useState<Record<number, AsyncJobTracker>>({});

  // 필터링된 녹취록
  const filteredTranscripts = useMemo(() => {
    return transcripts.filter((t) => {
      // 파이프라인 상태 필터
      if (pipelineFilter && getPipelineCategory(t) !== pipelineFilter) return false;

      // 검색어 필터
      if (searchQuery) {
        const patient = patientMap.get(t.patient_id);
        const chartFallbackName = t.chart_number ? chartNumberPatientMap.get(t.chart_number) : undefined;
        const searchLower = searchQuery.toLowerCase();
        const matchesSearch =
          t.transcript?.toLowerCase().includes(searchLower) ||
          t.patient_name?.toLowerCase().includes(searchLower) ||
          patient?.patient_name?.toLowerCase().includes(searchLower) ||
          chartFallbackName?.toLowerCase().includes(searchLower) ||
          t.doctor_name?.toLowerCase().includes(searchLower) ||
          t.chart_number?.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }

      return true;
    });
  }, [transcripts, searchQuery, pipelineFilter, patientMap, chartNumberPatientMap]);

  // 파이프라인 카테고리 분류 (function 선언문으로 호이스팅 보장)
  function getPipelineCategory(t: MedicalTranscript): PipelineCategory {
    // 실패: 어느 단계든 failed 이거나, 처리 완료인데 transcript가 없는 경우
    if (t.processing_status === 'failed' || t.soap_status === 'failed' ||
        (!t.transcript && t.processing_status === 'completed')) {
      return 'failed';
    }
    // 저장중: 업로드 단계
    if (t.processing_status === 'uploading') {
      return 'saving';
    }
    // 완료: processing과 soap 모두 완료
    if ((!t.processing_status || t.processing_status === 'completed') && t.soap_status === 'completed') {
      return 'done';
    }
    // 변환중: 나머지 진행 중인 상태
    return 'transcribing';
  }

  // 파이프라인 상태 배지 카운트 (전체 조회 결과 기준)
  const pipelineStats = useMemo(() => {
    const counts = { saving: 0, transcribing: 0, done: 0, failed: 0 };
    transcripts.forEach(t => { counts[getPipelineCategory(t)]++; });
    return counts;
  }, [transcripts]);

  // 녹취록 조회
  const fetchTranscripts = async () => {
    setLoading(true);
    try {
      let sql = '';
      const tsExpr = `COALESCE(recording_date, NULLIF(created_at,'')::timestamp)`;
      const localDateExpr = `date(${tsExpr})`;
      const conditions: string[] = [];

      // 의사 필터
      if (selectedDoctorName) {
        conditions.push(`doctor_name = '${selectedDoctorName.replace(/'/g, "''")}'`);
      }

      if (viewMode === 'day') {
        conditions.push(`${localDateExpr} = '${baseDate}'`);
      } else if (viewMode === '3weeks') {
        const rangeStart = format(subDays(new Date(baseDate), 20), 'yyyy-MM-dd');
        conditions.push(`${localDateExpr} >= '${rangeStart}' AND ${localDateExpr} <= '${baseDate}'`);
      } else if (viewMode === '3months') {
        // 3개월 = 90일 윈도우 (baseDate 포함 90일: baseDate-89 ~ baseDate)
        const rangeStart = format(subDays(new Date(baseDate), 89), 'yyyy-MM-dd');
        conditions.push(`${localDateExpr} >= '${rangeStart}' AND ${localDateExpr} <= '${baseDate}'`);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      sql = `
        SELECT * FROM medical_transcripts
        ${whereClause}
        ORDER BY ${tsExpr} DESC
      `;

      const response = await fetch(`${API_URL}/api/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql }),
      });

      const data = await response.json();
      if (!data.rows || data.rows.length === 0) {
        setTranscripts([]);
        return;
      }

      // PostgreSQL API는 rows를 객체 배열로 반환
      let items: MedicalTranscript[];
      if (data.columns && Array.isArray(data.rows[0])) {
        // 구버전 형식: columns + rows(배열)
        items = data.rows.map((row: any[]) => {
          const obj: any = {};
          data.columns.forEach((col: string, idx: number) => {
            obj[col] = row[idx];
          });
          return obj as MedicalTranscript;
        });
      } else {
        // PostgreSQL 형식: rows(객체 배열)
        items = data.rows as MedicalTranscript[];
      }

      setTranscripts(items);

      // 환자 정보 조회
      const patientIds = [...new Set(items.map((t) => t.patient_id))];
      if (patientIds.length > 0) {
        await fetchPatientInfo(patientIds);
      }

      // chart_number 기반 fallback 이름 조회 (PG 공통키)
      const chartNumbers = [...new Set(items.map((t) => t.chart_number).filter(Boolean) as string[])];
      if (chartNumbers.length > 0) {
        await fetchPatientInfoByChartNumbers(chartNumbers);
      }
    } catch (error) {
      console.error('녹취록 조회 실패:', error);
      setTranscripts([]);
    } finally {
      setLoading(false);
    }
  };

  // 환자 정보 조회 (MSSQL: patient_id 기준)
  const fetchPatientInfo = async (patientIds: number[]) => {
    try {
      const mssqlApiUrl = import.meta.env.VITE_MSSQL_API_URL || 'http://192.168.0.173:3100';
      const response = await fetch(`${mssqlApiUrl}/api/patients/by-ids`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: patientIds }),
      });

      const data = await response.json();
      if (data.patients) {
        const map = new Map<number, PatientInfo>();
        data.patients.forEach((p: any) => {
          // mssql API 응답: { id, chart_no, name, ... }
          map.set(p.id, { chart_no: p.chart_no, patient_name: p.name });
        });
        setPatientMap(map);
      }
    } catch (error) {
      console.error('환자 정보 조회 실패:', error);
    }
  };

  // 환자 정보 조회 (PostgreSQL: chart_number 공통키 기준)
  const fetchPatientInfoByChartNumbers = async (chartNumbers: string[]) => {
    try {
      const normalized = [...new Set(chartNumbers.map((c) => String(c).trim()).filter(Boolean))];
      if (normalized.length === 0) return;

      const inList = normalized.map((c) => `'${c.replace(/'/g, "''")}'`).join(',');
      const response = await fetch(`${API_URL}/api/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sql: `SELECT chart_number, name FROM patients WHERE chart_number IN (${inList})`,
        }),
      });

      const data = await response.json();
      if (!data?.rows) return;

      const rows = Array.isArray(data.rows[0]) && data.columns
        ? data.rows.map((row: any[]) => {
            const obj: any = {};
            data.columns.forEach((col: string, idx: number) => {
              obj[col] = row[idx];
            });
            return obj;
          })
        : data.rows;

      const map = new Map<string, string>();
      rows.forEach((r: any) => {
        if (r.chart_number && r.name) map.set(String(r.chart_number), String(r.name));
      });
      setChartNumberPatientMap(map);
    } catch (error) {
      console.error('차트번호 기반 환자 정보 조회 실패:', error);
    }
  };

  const persistJobMap = (key: string, jobs: Record<number, AsyncJobTracker>) => {
    try {
      localStorage.setItem(key, JSON.stringify(jobs));
    } catch (error) {
      console.warn('job map localStorage 저장 실패:', error);
    }
  };

  const loadJobMap = (key: string): Record<number, AsyncJobTracker> => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  };

  // 화자 분리 실행
  const handleDiarize = async () => {
    if (!selectedTranscript) return;

    setIsDiarizing(true);
    try {
      // Gemini API를 통한 화자 분리
      const result = await diarizeTranscript(
        selectedTranscript.transcript,
        selectedTranscript.acting_type
      );

      if (result.success && result.formatted) {
        // DB 업데이트
        await updateDiarizedTranscript(selectedTranscript.id, result.formatted);
        alert('화자 분리가 완료되었습니다.');
        fetchTranscripts();
      } else {
        throw new Error(result.error || 'Empty response');
      }
    } catch (error) {
      console.error('화자 분리 실패:', error);
      alert('화자 분리에 실패했습니다.');
    } finally {
      setIsDiarizing(false);
    }
  };

  // SOAP 재처리
  const handleReprocessSoap = async () => {
    if (!selectedTranscript) return;

    setIsReprocessing(true);
    try {
      const soapResponse = await fetch(`${API_URL}/api/gpt/soap/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: selectedTranscript.transcript,
          acting_type: selectedTranscript.acting_type,
          transcript_id: selectedTranscript.id,
        }),
      });

      const soapData = await soapResponse.json();
      if (!soapData?.success || !soapData?.job_id) {
        throw new Error(soapData?.error || 'SOAP 작업 시작 실패');
      }

      setSoapJobs((prev) => ({
        ...prev,
        [selectedTranscript.id]: {
          transcriptId: selectedTranscript.id,
          jobId: soapData.job_id,
          status: soapData.status || 'pending',
          message: soapData.message || 'SOAP 작업 대기 중',
          startedAt: soapData.started_at,
        },
      }));

      setTranscripts((prev) => prev.map((t) => (
        t.id === selectedTranscript.id
          ? { ...t, soap_status: 'processing', processing_message: soapData.message || 'SOAP 작업 대기 중' }
          : t
      )));
      setSelectedTranscript((prev) => (
        prev ? { ...prev, soap_status: 'processing', processing_message: soapData.message || 'SOAP 작업 대기 중' } : prev
      ));
    } catch (error) {
      console.error('SOAP 재처리 실패:', error);
      alert('SOAP 재처리에 실패했습니다.');
    } finally {
      setIsReprocessing(false);
    }
  };

  const getTranscriptSourceText = (t: MedicalTranscript) => {
    const diarized = t.diarized_transcript?.trim();
    const raw = t.transcript?.trim();
    return diarized || raw || '';
  };

  const getChartTextForCoaching = (t: MedicalTranscript) => {
    const chartText = t.chart_text?.trim();
    if (chartText) return chartText;

    const soapBlocks = [
      t.soap_subjective ? `[S]\n${t.soap_subjective}` : '',
      t.soap_objective ? `[O]\n${t.soap_objective}` : '',
      t.soap_assessment ? `[A]\n${t.soap_assessment}` : '',
      t.soap_plan ? `[P]\n${t.soap_plan}` : '',
    ].filter(Boolean);

    return soapBlocks.join('\n\n');
  };

  const persistCoachingText = async (transcriptId: number, text: string, meta?: CoachingMeta) => {
    const escaped = text.replace(/'/g, "''");
    const modelSql = meta?.model ? `'${String(meta.model).replace(/'/g, "''")}'` : 'NULL';
    const inputSql = Number.isFinite(meta?.input_tokens) ? String(meta?.input_tokens) : 'NULL';
    const outputSql = Number.isFinite(meta?.output_tokens) ? String(meta?.output_tokens) : 'NULL';
    const totalSql = Number.isFinite(meta?.total_tokens) ? String(meta?.total_tokens) : 'NULL';
    const elapsedSql = Number.isFinite(meta?.elapsed_ms) ? String(meta?.elapsed_ms) : 'NULL';
    const costUsdSql = Number.isFinite(meta?.estimated_cost_usd) ? String(meta?.estimated_cost_usd) : 'NULL';
    const costKrwSql = Number.isFinite(meta?.estimated_cost_krw) ? String(meta?.estimated_cost_krw) : 'NULL';

    try {
      const response = await fetch(`${API_URL}/api/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sql: `UPDATE medical_transcripts
                SET coaching_text = '${escaped}',
                    coaching_model = ${modelSql},
                    coaching_input_tokens = ${inputSql},
                    coaching_output_tokens = ${outputSql},
                    coaching_total_tokens = ${totalSql},
                    coaching_elapsed_ms = ${elapsedSql},
                    coaching_estimated_cost_usd = ${costUsdSql},
                    coaching_estimated_cost_krw = ${costKrwSql},
                    updated_at = NOW()
                WHERE id = ${transcriptId}`,
        }),
      });
      const data = await response.json();
      if (data?.error) throw new Error(String(data.error));
      return true;
    } catch (error) {
      console.warn('coaching_text/meta 영속 저장 실패, 메모리 fallback 사용:', error);
      return false;
    }
  };

  const handleGenerateCoaching = async () => {
    if (!selectedTranscript) return;

    const transcriptText = getTranscriptSourceText(selectedTranscript);
    if (!transcriptText) {
      setCoachingError('코칭을 생성하려면 녹취 텍스트가 필요합니다. 먼저 녹취/화자분리를 완료해 주세요.');
      return;
    }

    setIsGeneratingCoaching(true);
    setCoachingError(null);

    const chartText = getChartTextForCoaching(selectedTranscript);
    const prompt = CONSULTATION_COACHING_PROMPT_V2
      .replace('{{chartText}}', chartText || '(차트 텍스트 없음)')
      .replace('{{transcriptText}}', transcriptText);

    try {
      const response = await fetch(`${API_URL}/api/gpt/chart-analysis/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chart_notes: chartText,
          transcript: transcriptText,
          prompt,
          prompt_version: 'v2',
          response_mode: 'coaching_only',
          model: 'gpt-5.4',
          transcript_id: selectedTranscript.id,
        }),
      });
      const data = await response.json();

      if (!data?.success || !data?.job_id) {
        throw new Error(data?.error || '코칭 작업 시작 실패');
      }

      setCoachingJobs((prev) => ({
        ...prev,
        [selectedTranscript.id]: {
          transcriptId: selectedTranscript.id,
          jobId: data.job_id,
          status: data.status || 'pending',
          message: data.message || '코칭 작업 대기 중',
          startedAt: data.started_at,
        },
      }));
      setDetailTab('coaching');
    } catch (error: any) {
      console.error('상담코칭 생성 실패:', error);
      setCoachingError(error?.message || '상담코칭 생성 중 오류가 발생했습니다.');
    } finally {
      setIsGeneratingCoaching(false);
    }
  };

  // 녹취록 삭제
  const handleDelete = async () => {
    if (!selectedTranscript) return;

    setIsDeleting(true);
    try {
      await fetch(`${API_URL}/api/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sql: `DELETE FROM medical_transcripts WHERE id = ${selectedTranscript.id}`,
        }),
      });

      alert('녹취록이 삭제되었습니다.');
      setSelectedTranscript(null);
      setShowDeleteConfirm(false);
      fetchTranscripts();
    } catch (error) {
      console.error('녹취록 삭제 실패:', error);
      alert('녹취록 삭제에 실패했습니다.');
    } finally {
      setIsDeleting(false);
    }
  };

  // 내보내기 (텍스트)
  const handleExport = () => {
    if (!selectedTranscript) return;

    const patient = patientMap.get(selectedTranscript.patient_id);
    const displayPatientName = getDisplayPatientName(selectedTranscript);
    let content = `녹취록 내보내기\n`;
    content += `================\n\n`;
    content += `환자: ${displayPatientName}\n`;
    content += `의료진: ${selectedTranscript.doctor_name}\n`;
    content += `진료유형: ${selectedTranscript.acting_type}\n`;
    content += `녹음시간: ${formatDuration(selectedTranscript.duration_sec)}\n`;
    content += `일시: ${formatDate(getDisplayDateTime(selectedTranscript), 'yyyy-MM-dd HH:mm')}\n\n`;
    content += `[녹취 내용]\n${selectedTranscript.transcript}\n\n`;

    if (selectedTranscript.soap_status === 'completed') {
      content += `[SOAP 기록]\n`;
      content += `S (주관적 증상): ${selectedTranscript.soap_subjective || '-'}\n\n`;
      content += `O (객관적 소견): ${selectedTranscript.soap_objective || '-'}\n\n`;
      content += `A (평가): ${selectedTranscript.soap_assessment || '-'}\n\n`;
      content += `P (계획): ${selectedTranscript.soap_plan || '-'}\n`;
    }

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `녹취록_${displayPatientName}_${formatDate(getDisplayDateTime(selectedTranscript), 'yyyyMMdd_HHmm')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    setCoachingJobs(loadJobMap(COACHING_JOBS_STORAGE_KEY));
    setSoapJobs(loadJobMap(SOAP_JOBS_STORAGE_KEY));
  }, []);

  useEffect(() => {
    persistJobMap(COACHING_JOBS_STORAGE_KEY, coachingJobs);
  }, [coachingJobs]);

  useEffect(() => {
    persistJobMap(SOAP_JOBS_STORAGE_KEY, soapJobs);
  }, [soapJobs]);

  useEffect(() => {
    fetchTranscripts();
  }, [viewMode, baseDate, selectedDoctorName]);

  useEffect(() => {
    const hasProcessingTranscript = transcripts.some((t) =>
      t.processing_status && t.processing_status !== 'completed' && t.processing_status !== 'failed'
    );
    const hasAsyncJobs = Object.keys(coachingJobs).length > 0 || Object.keys(soapJobs).length > 0;
    if (!hasProcessingTranscript && !hasAsyncJobs) return;

    const timer = window.setInterval(() => {
      fetchTranscripts();
    }, 3000);

    return () => window.clearInterval(timer);
  }, [transcripts, coachingJobs, soapJobs]);

  useEffect(() => {
    if (Object.keys(coachingJobs).length === 0 && Object.keys(soapJobs).length === 0) return;

    const timer = window.setInterval(async () => {
      for (const [transcriptIdStr, job] of Object.entries(coachingJobs)) {
        if (!job?.jobId) continue;
        if (job.status === 'completed' || job.status === 'failed') continue;

        try {
          const resp = await fetch(`${API_URL}/api/gpt/chart-analysis/status/${job.jobId}`);
          const data = await resp.json();
          if (!data?.success) continue;

          const transcriptId = Number(transcriptIdStr);
          const status = (data.status || 'pending') as AsyncJobStatus;

          setCoachingJobs((prev) => {
            const current = prev[transcriptId];
            if (!current) return prev;
            const next = {
              ...prev,
              [transcriptId]: {
                ...current,
                status,
                message: data.message,
                finishedAt: data.finished_at,
              },
            };
            if (status === 'completed' || status === 'failed') {
              delete next[transcriptId];
            }
            return next;
          });

          if (status === 'completed' && data.coaching_text) {
            const generatedCoaching = String(data.coaching_text);
            const meta: CoachingMeta = {
              model: data?.usage?.model,
              input_tokens: data?.usage?.input_tokens,
              output_tokens: data?.usage?.output_tokens,
              total_tokens: data?.usage?.total_tokens,
              elapsed_ms: data?.usage?.elapsed_ms,
              estimated_cost_usd: data?.usage?.estimated_cost_usd,
              estimated_cost_krw: data?.usage?.estimated_cost_krw,
            };

            setCoachingMetaMemory((prev) => ({
              ...prev,
              [transcriptId]: meta,
            }));

            const persisted = await persistCoachingText(transcriptId, generatedCoaching, meta);
            if (!persisted) {
              setCoachingTextMemory((prev) => ({ ...prev, [transcriptId]: generatedCoaching }));
            }

            setTranscripts((prev) => prev.map((t) => (t.id === transcriptId ? {
              ...t,
              coaching_text: generatedCoaching,
              coaching_model: meta.model ?? t.coaching_model,
              coaching_input_tokens: meta.input_tokens ?? t.coaching_input_tokens,
              coaching_output_tokens: meta.output_tokens ?? t.coaching_output_tokens,
              coaching_total_tokens: meta.total_tokens ?? t.coaching_total_tokens,
              coaching_elapsed_ms: meta.elapsed_ms ?? t.coaching_elapsed_ms,
              coaching_estimated_cost_usd: meta.estimated_cost_usd ?? t.coaching_estimated_cost_usd,
              coaching_estimated_cost_krw: meta.estimated_cost_krw ?? t.coaching_estimated_cost_krw,
            } : t)));
            setSelectedTranscript((prev) => (prev && prev.id === transcriptId ? {
              ...prev,
              coaching_text: generatedCoaching,
              coaching_model: meta.model ?? prev.coaching_model,
              coaching_input_tokens: meta.input_tokens ?? prev.coaching_input_tokens,
              coaching_output_tokens: meta.output_tokens ?? prev.coaching_output_tokens,
              coaching_total_tokens: meta.total_tokens ?? prev.coaching_total_tokens,
              coaching_elapsed_ms: meta.elapsed_ms ?? prev.coaching_elapsed_ms,
              coaching_estimated_cost_usd: meta.estimated_cost_usd ?? prev.coaching_estimated_cost_usd,
              coaching_estimated_cost_krw: meta.estimated_cost_krw ?? prev.coaching_estimated_cost_krw,
            } : prev));
          }

          if (status === 'failed') {
            setCoachingError(data?.error || data?.message || '상담코칭 생성 중 오류가 발생했습니다.');
          }
        } catch (error) {
          console.error('코칭 job polling 실패:', error);
        }
      }

      for (const [transcriptIdStr, job] of Object.entries(soapJobs)) {
        if (!job?.jobId) continue;
        if (job.status === 'completed' || job.status === 'failed') continue;

        try {
          const resp = await fetch(`${API_URL}/api/gpt/soap/status/${job.jobId}`);
          const data = await resp.json();
          if (!data?.success) continue;

          const transcriptId = Number(transcriptIdStr);
          const status = (data.status || 'pending') as AsyncJobStatus;

          setSoapJobs((prev) => {
            const current = prev[transcriptId];
            if (!current) return prev;
            const next = {
              ...prev,
              [transcriptId]: {
                ...current,
                status,
                message: data.message,
                finishedAt: data.finished_at,
              },
            };
            if (status === 'completed' || status === 'failed') {
              delete next[transcriptId];
            }
            return next;
          });

          if (status === 'completed') {
            setTranscripts((prev) => prev.map((t) => (
              t.id === transcriptId
                ? {
                    ...t,
                    soap_subjective: data.subjective ?? t.soap_subjective,
                    soap_objective: data.objective ?? t.soap_objective,
                    soap_assessment: data.assessment ?? t.soap_assessment,
                    soap_plan: data.plan ?? t.soap_plan,
                    soap_status: 'completed',
                    processing_message: data.message || 'SOAP 생성 완료',
                  }
                : t
            )));
            setSelectedTranscript((prev) => (
              prev && prev.id === transcriptId
                ? {
                    ...prev,
                    soap_subjective: data.subjective ?? prev.soap_subjective,
                    soap_objective: data.objective ?? prev.soap_objective,
                    soap_assessment: data.assessment ?? prev.soap_assessment,
                    soap_plan: data.plan ?? prev.soap_plan,
                    soap_status: 'completed',
                    processing_message: data.message || 'SOAP 생성 완료',
                  }
                : prev
            ));
          }

          if (status === 'failed') {
            setTranscripts((prev) => prev.map((t) => (t.id === transcriptId ? { ...t, soap_status: 'failed', processing_message: data.message } : t)));
            setSelectedTranscript((prev) => (prev && prev.id === transcriptId ? { ...prev, soap_status: 'failed', processing_message: data.message } : prev));
          }
        } catch (error) {
          console.error('SOAP job polling 실패:', error);
        }
      }
    }, 2500);

    return () => window.clearInterval(timer);
  }, [coachingJobs, soapJobs]);

  // 파이프라인 단계 표시기
  const getPipelineSteps = (t: MedicalTranscript): { label: string; status: 'done' | 'in-progress' | 'not-started' | 'failed' }[] => {
    const dones = [
      !!t.audio_path,
      !!t.transcript && t.transcript.trim() !== '',
      !!t.diarized_transcript && t.diarized_transcript.trim() !== '',
      t.soap_status === 'completed',
    ];
    const labels = [`녹음 ${formatDuration(t.duration_sec)}`, '녹취', '화자', 'SOAP'];
    const hasFailed = t.processing_status === 'failed' || t.soap_status === 'failed';
    const firstPendingIdx = dones.findIndex(d => !d);

    return labels.map((label, i) => ({
      label,
      status: dones[i]
        ? 'done'
        : hasFailed
          ? 'failed'
          : i === firstPendingIdx
            ? 'in-progress'
            : 'not-started',
    }));
  };

  // SOAP 상태 배지
  const getSoapStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full">완료</span>
        );
      case 'processing':
        return (
          <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full animate-pulse">
            처리중
          </span>
        );
      case 'failed':
        return (
          <span className="px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded-full">실패</span>
        );
      default:
        return (
          <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-700 rounded-full">대기</span>
        );
    }
  };

  // 처리 상태 배지 (서버 사이드 처리)
  const getProcessingStatusBadge = (transcript: MedicalTranscript) => {
    const status = transcript.processing_status;
    if (!status || status === 'completed') return null;

    const statusConfig: Record<string, { bg: string; text: string; icon: string; label: string }> = {
      uploading: { bg: 'bg-gray-100', text: 'text-gray-700', icon: 'fa-cloud-upload-alt', label: '업로드' },
      transcribing: { bg: 'bg-yellow-100', text: 'text-yellow-700', icon: 'fa-microphone', label: '녹취변환' },
      processing: { bg: 'bg-blue-100', text: 'text-blue-700', icon: 'fa-cog fa-spin', label: 'SOAP변환' },
      failed: { bg: 'bg-red-100', text: 'text-red-700', icon: 'fa-exclamation-circle', label: '실패' },
    };

    const config = statusConfig[status] || statusConfig.uploading;

    return (
      <div className={`flex items-center gap-1 px-2 py-0.5 text-xs ${config.bg} ${config.text} rounded-full`}>
        <i className={`fas ${config.icon}`}></i>
        <span>{config.label}</span>
      </div>
    );
  };

  // 서버 사이드 재처리 요청
  const handleServerRetry = async (transcriptId: number) => {
    setIsReprocessing(true);
    try {
      const response = await fetch(`${API_URL}/api/transcribe/retry/${transcriptId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();

      if (data.success) {
        alert('재처리가 시작되었습니다. 잠시 후 새로고침하세요.');
        fetchTranscripts();
      } else {
        throw new Error(data.error || '재처리 실패');
      }
    } catch (error: any) {
      console.error('재처리 실패:', error);
      alert(`재처리 실패: ${error.message}`);
    } finally {
      setIsReprocessing(false);
    }
  };

  // 실제 진료/녹음 시각 우선, 없으면 생성 시각 fallback
  const getDisplayDateTime = (t: MedicalTranscript) => t.recording_date || t.created_at;

  // 환자명 fallback: row.patient_name → patient_id 조회 → chart_number 공통키 조회
  const getDisplayPatientName = (t: MedicalTranscript) => {
    const byPatientId = patientMap.get(t.patient_id)?.patient_name;
    const byChartNumber = t.chart_number ? chartNumberPatientMap.get(t.chart_number) : undefined;
    return t.patient_name || byPatientId || byChartNumber || `환자 #${t.patient_id}`;
  };

  // 백엔드 datetime 문자열을 파싱하여 로컬 시각 부분을 반환
  // - ISO with TZ (Z, +00:00 등): Date 객체로 변환하여 로컬(KST) 시각 추출
  // - naive datetime (TZ 없음): 벽시계 시각 그대로 사용 (추가 변환 없음)
  const parseClinicDateParts = (dateStr: string) => {
    if (!dateStr) return null;

    const iso = dateStr.match(/(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
    if (iso) {
      // 타임존 정보가 포함된 경우 (Z, +HH:MM, -HH:MM, +HHMM)
      const hasTZ = /[Zz]|[+-]\d{2}:?\d{2}\s*$/.test(dateStr.trim());
      if (hasTZ) {
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) {
          return {
            year: d.getFullYear(),
            month: d.getMonth() + 1,
            day: d.getDate(),
            hour: d.getHours(),
            minute: d.getMinutes(),
            second: d.getSeconds(),
          };
        }
      }
      // naive datetime (TZ 없음) — 로컬 벽시계 시각 그대로 사용
      return {
        year: Number(iso[1]),
        month: Number(iso[2]),
        day: Number(iso[3]),
        hour: Number(iso[4]),
        minute: Number(iso[5]),
        second: Number(iso[6] || 0),
      };
    }

    // RFC 형식 (GMT 포함) — Date로 파싱하여 로컬 시각 추출
    const rfc = dateStr.match(/\w{3},\s\d{2}\s\w{3}\s\d{4}\s\d{2}:\d{2}:\d{2}\sGMT/i);
    if (rfc) {
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) {
        return {
          year: d.getFullYear(),
          month: d.getMonth() + 1,
          day: d.getDate(),
          hour: d.getHours(),
          minute: d.getMinutes(),
          second: d.getSeconds(),
        };
      }
    }

    return null;
  };

  // 시간 포맷
  const formatTime = (dateStr: string) => {
    const p = parseClinicDateParts(dateStr);
    if (p) return `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`;

    try {
      if (!dateStr) return '--:--';
      return format(new Date(dateStr), 'HH:mm');
    } catch {
      return '--:--';
    }
  };

  // 날짜 포맷 (안전)
  const formatDate = (dateStr: string, formatStr: string = 'MM/dd') => {
    const p = parseClinicDateParts(dateStr);
    if (p) {
      const MM = String(p.month).padStart(2, '0');
      const dd = String(p.day).padStart(2, '0');
      const HH = String(p.hour).padStart(2, '0');
      const mm = String(p.minute).padStart(2, '0');
      if (formatStr === 'MM/dd') return `${MM}/${dd}`;
      if (formatStr === 'yyyy-MM-dd HH:mm') return `${p.year}-${MM}-${dd} ${HH}:${mm}`;
      if (formatStr === 'yyyyMMdd_HHmm') return `${p.year}${MM}${dd}_${HH}${mm}`;
      return `${MM}/${dd}`;
    }

    try {
      if (!dateStr) return '--/--';
      return format(new Date(dateStr), formatStr);
    } catch {
      return '--/--';
    }
  };

  // 녹음 시간 포맷
  const formatDuration = (seconds: number) => {
    if (!seconds) return '0:00';
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // 진료일자 포맷: 년. 월. 일. (요일)
  const formatDateWithWeekday = (dateStr: string) => {
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const p = parseClinicDateParts(dateStr);
    if (p) {
      const d = new Date(p.year, p.month - 1, p.day);
      return `${p.year}. ${String(p.month).padStart(2, '0')}. ${String(p.day).padStart(2, '0')}. (${days[d.getDay()]})`;
    }
    try {
      const d = new Date(dateStr);
      return `${d.getFullYear()}. ${String(d.getMonth() + 1).padStart(2, '0')}. ${String(d.getDate()).padStart(2, '0')}. (${days[d.getDay()]})`;
    } catch {
      return '--';
    }
  };

  // 담당의 축약: '원장' 접미사 제거 후 성 1글자
  const getDoctorShortName = (name: string) => {
    if (!name) return '-';
    const stripped = name.replace(/원장$/, '');
    return stripped.charAt(0) || name.charAt(0);
  };

  // 콤팩트 날짜: YY.MM.DD.(요일)
  const formatCompactDate = (dateStr: string) => {
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const p = parseClinicDateParts(dateStr);
    if (p) {
      const yy = String(p.year).slice(-2);
      const mm = String(p.month).padStart(2, '0');
      const dd = String(p.day).padStart(2, '0');
      const d = new Date(p.year, p.month - 1, p.day);
      return `${yy}.${mm}.${dd}.(${days[d.getDay()]})`;
    }
    try {
      const d = new Date(dateStr);
      const yy = String(d.getFullYear()).slice(-2);
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yy}.${mm}.${dd}.(${days[d.getDay()]})`;
    } catch {
      return '--';
    }
  };

  const formatBaseDateDisplay = (dateStr: string) => {
    try {
      const d = new Date(`${dateStr}T00:00:00`);
      const days = ['일', '월', '화', '수', '목', '금', '토'];
      return `${d.getFullYear()}. ${String(d.getMonth() + 1).padStart(2, '0')}. ${String(d.getDate()).padStart(2, '0')}. (${days[d.getDay()]})`;
    } catch {
      return dateStr;
    }
  };

  const selectedCoachingJob = selectedTranscript ? coachingJobs[selectedTranscript.id] : undefined;
  const selectedSoapJob = selectedTranscript ? soapJobs[selectedTranscript.id] : undefined;
  const isCoachingRunning = Boolean(selectedCoachingJob);
  const selectedCoachingMeta = selectedTranscript
    ? (coachingMetaMemory[selectedTranscript.id] || {
        model: selectedTranscript.coaching_model ?? undefined,
        input_tokens: selectedTranscript.coaching_input_tokens ?? undefined,
        output_tokens: selectedTranscript.coaching_output_tokens ?? undefined,
        total_tokens: selectedTranscript.coaching_total_tokens ?? undefined,
        elapsed_ms: selectedTranscript.coaching_elapsed_ms ?? undefined,
        estimated_cost_usd: selectedTranscript.coaching_estimated_cost_usd ?? undefined,
        estimated_cost_krw: selectedTranscript.coaching_estimated_cost_krw ?? undefined,
      })
    : undefined;
  const hasSelectedCoachingMeta = Boolean(selectedCoachingMeta && (
    selectedCoachingMeta.model ||
    Number.isFinite(selectedCoachingMeta.input_tokens) ||
    Number.isFinite(selectedCoachingMeta.output_tokens) ||
    Number.isFinite(selectedCoachingMeta.total_tokens) ||
    Number.isFinite(selectedCoachingMeta.elapsed_ms) ||
    Number.isFinite(selectedCoachingMeta.estimated_cost_krw)
  ));

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-200 px-6 py-3">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setBaseDate(format(subDays(new Date(baseDate), 1), 'yyyy-MM-dd'))}
            className="occ-date-btn"
          >
            ◀
          </button>
          <div className="occ-date-wrap" style={{ width: 'auto' }}>
            <input
              type="date"
              value={baseDate}
              onChange={(e) => setBaseDate(e.target.value)}
              className="occ-date-hidden"
              id="transcript-base-date-picker"
            />
            <button
              className="occ-date-display"
              onClick={() => {
                const el = document.getElementById('transcript-base-date-picker') as HTMLInputElement;
                el?.showPicker?.();
              }}
            >
              {formatBaseDateDisplay(baseDate)}
            </button>
          </div>
          <button
            onClick={() => setBaseDate(format(subDays(new Date(baseDate), -1), 'yyyy-MM-dd'))}
            className="occ-date-btn"
          >
            ▶
          </button>
          {baseDate !== format(new Date(), 'yyyy-MM-dd') && (
            <button
              onClick={() => setBaseDate(format(new Date(), 'yyyy-MM-dd'))}
              className="occ-today-btn"
            >
              오늘
            </button>
          )}

          <div className="occ-filter-group occ-filter-patient">
            {([['day', '일별'], ['3weeks', '3주'], ['3months', '3개월'], ['all', '전체']] as [ViewMode, string][]).map(([mode, label]) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`occ-filter-btn ${viewMode === mode ? 'active' : ''}`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="occ-filter-group occ-filter-patient">
            {([
              ['saving', '저장중', pipelineStats.saving],
              ['transcribing', '변환중', pipelineStats.transcribing],
              ['done', '완료', pipelineStats.done],
              ['failed', '실패', pipelineStats.failed],
            ] as [PipelineCategory, string, number][]).map(([key, label, count]) => (
              <button
                key={key}
                onClick={() => setPipelineFilter(pipelineFilter === key ? null : key)}
                className={`occ-filter-btn ${pipelineFilter === key ? 'active' : ''}`}
              >
                {label} <span className="font-bold ml-0.5">{count}</span>
              </button>
            ))}
          </div>

          <div className="relative ml-auto" style={{ width: '220px' }}>
            <i className="fas fa-search absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs"></i>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="환자명/차트번호/내용 검색"
              className="w-full pl-7 pr-2 py-2 border border-gray-300 rounded-md text-xs focus:ring-1 focus:ring-clinic-primary focus:border-clinic-primary"
            />
          </div>

          <button
            onClick={fetchTranscripts}
            disabled={loading}
            className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <i className={`fas fa-sync-alt ${loading ? 'animate-spin' : ''}`}></i>
          </button>
        </div>
      </div>

      {/* 컨텐츠 영역 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 목록 */}
        <div className="w-[420px] border-r border-gray-200 bg-white overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <i className="fas fa-spinner fa-spin text-gray-400 text-xl"></i>
            </div>
          ) : filteredTranscripts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-gray-400">
              <i className="fas fa-microphone-slash text-3xl mb-2"></i>
              <p>녹취 기록이 없습니다</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredTranscripts.map((t) => {
                const patient = patientMap.get(t.patient_id);
                return (
                  <div
                    key={t.id}
                    onClick={() => {
                      setSelectedTranscript(t);
                      setCoachingError(null);
                    }}
                    className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                      selectedTranscript?.id === t.id
                        ? 'bg-clinic-primary/5 border-l-4 border-clinic-primary'
                        : ''
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <span className="font-medium text-gray-800">
                          {getDisplayPatientName(t)}
                        </span>
                        {(t.chart_number || patient?.chart_no) && (
                          <span className="ml-2 text-xs text-gray-400">#{t.chart_number || patient?.chart_no}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        {getProcessingStatusBadge(t)}
                        {(!t.processing_status || t.processing_status === 'completed') && getSoapStatusBadge(t.soap_status)}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-500 mb-2">
                      <span>
                        <i className="fas fa-calendar-alt mr-1"></i>
                        {formatDate(getDisplayDateTime(t))}
                      </span>
                      <span>
                        <i className="fas fa-clock mr-1"></i>
                        {formatTime(getDisplayDateTime(t))}
                      </span>
                      <span>
                        <i className="fas fa-stopwatch mr-1"></i>
                        {formatDuration(t.duration_sec)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 bg-gray-100 rounded text-xs text-gray-600">
                        {t.acting_type}
                      </span>
                      <span className="text-xs text-gray-400">{t.doctor_name}</span>
                      {t.audio_path && (
                        <span className="text-xs text-blue-500">
                          <i className="fas fa-volume-up"></i>
                        </span>
                      )}
                    </div>
                    {/* 녹취 미리보기 */}
                    {!t.transcript && t.audio_path ? (
                      <p className="mt-2 text-xs text-amber-600">
                        <i className="fas fa-exclamation-triangle mr-1"></i>녹취 실패 — 재시도 가능
                      </p>
                    ) : (
                      <p className="mt-2 text-xs text-gray-400 line-clamp-2">
                        {t.transcript?.substring(0, 100)}...
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 상세 보기 */}
        <div className="flex-1 overflow-y-auto p-6">
          {selectedTranscript ? (
            <div className="max-w-4xl mx-auto space-y-4">
              {/* 상단: 메타 + 파이프라인 + 액션 단일 행 */}
              <div className="flex items-center gap-2 flex-wrap text-[17px] py-0.5">
                <span className="text-gray-800 whitespace-nowrap">
                  <span className="font-semibold text-[19px]">{getDisplayPatientName(selectedTranscript)}</span>
                  ({selectedTranscript.chart_number || patientMap.get(selectedTranscript.patient_id)?.chart_no || '-'})
                  <span className="ml-2">{formatCompactDate(getDisplayDateTime(selectedTranscript))}</span>
                  {' '}{formatTime(getDisplayDateTime(selectedTranscript))}
                  {' - '}{getDoctorShortName(selectedTranscript.doctor_name)}
                </span>
                <div className="flex items-center gap-1">
                  {getPipelineSteps(selectedTranscript).map((step, idx, arr) => (
                    <Fragment key={idx}>
                      <span className={`inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full ${
                        step.status === 'done' ? 'bg-green-100 text-green-700' :
                        step.status === 'in-progress' ? 'bg-blue-100 text-blue-700 animate-pulse' :
                        step.status === 'failed' ? 'bg-red-100 text-red-700' :
                        'bg-gray-100 text-gray-400'
                      }`}>
                        {step.status === 'done' && <i className="fas fa-check text-[10px] mr-1"></i>}
                        {step.status === 'failed' && <i className="fas fa-times text-[10px] mr-1"></i>}
                        {step.label}
                      </span>
                      {idx < arr.length - 1 && (
                        <i className="fas fa-chevron-right text-[8px] text-gray-300"></i>
                      )}
                    </Fragment>
                  ))}
                </div>
                <div className="flex items-center gap-1 ml-auto">
                  {(selectedTranscript.soap_status === 'failed' ||
                    selectedTranscript.soap_status === 'pending') && (
                    <button
                      onClick={handleReprocessSoap}
                      disabled={isReprocessing || Boolean(selectedSoapJob)}
                      className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
                      title={(isReprocessing || Boolean(selectedSoapJob)) ? '처리중...' : 'SOAP 재처리'}
                    >
                      <i className={`fas fa-redo text-sm ${(isReprocessing || Boolean(selectedSoapJob)) ? 'animate-spin' : ''}`}></i>
                    </button>
                  )}
                  <button
                    onClick={handleExport}
                    className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                    title="내보내기"
                  >
                    <i className="fas fa-download text-sm"></i>
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors"
                    title="삭제"
                  >
                    <i className="fas fa-trash text-sm"></i>
                  </button>
                </div>
              </div>

              {/* 녹음 듣기 */}
              {selectedTranscript.audio_path && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 px-6 py-3">
                  <audio
                    controls
                    src={`${API_URL}/api/files/${selectedTranscript.audio_path}`}
                    className="w-full h-10"
                  />
                </div>
              )}

              {/* 탭 바 */}
              <div className="flex items-center border-b border-gray-200">
                {([
                  ['raw', '녹취원본'],
                  ['diarized', '화자분리'],
                  ['soap', 'SOAP'],
                  ['coaching', '상담코칭'],
                ] as [DetailTab, string][]).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setDetailTab(key)}
                    className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                      detailTab === key
                        ? 'border-clinic-primary text-clinic-primary'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* 탭 컨텐츠 */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                {/* 녹취원본 탭 */}
                {detailTab === 'raw' && (
                  <>
                    <div className="px-6 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-end">
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(selectedTranscript.transcript || '');
                          alert('녹취 내용이 클립보드에 복사되었습니다.');
                        }}
                        className="text-sm text-gray-500 hover:text-gray-700"
                      >
                        <i className="fas fa-copy mr-1"></i>
                        복사
                      </button>
                    </div>
                    <div className="p-6">
                      <p className="text-gray-700 whitespace-pre-wrap leading-relaxed text-sm">
                        {selectedTranscript.transcript || '녹취 내용이 없습니다.'}
                      </p>
                      {!selectedTranscript.transcript && selectedTranscript.audio_path && (
                        <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-center">
                          <p className="text-sm text-amber-700 mb-2">
                            <i className="fas fa-exclamation-triangle mr-1"></i>
                            음성 파일은 있지만 텍스트 변환에 실패했습니다
                          </p>
                          <button
                            onClick={() => handleServerRetry(selectedTranscript.id)}
                            disabled={isReprocessing}
                            className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50 text-sm"
                          >
                            <i className={`fas fa-redo mr-1 ${isReprocessing ? 'animate-spin' : ''}`}></i>
                            {isReprocessing ? '변환 중...' : '녹취 재시도'}
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* 화자분리 탭 */}
                {detailTab === 'diarized' && (
                  <>
                    <div className="px-6 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {!selectedTranscript.diarized_transcript && (
                          <button
                            onClick={handleDiarize}
                            disabled={isDiarizing}
                            className="text-sm text-blue-500 hover:text-blue-700 disabled:opacity-50"
                          >
                            <i className={`fas fa-users mr-1 ${isDiarizing ? 'animate-pulse' : ''}`}></i>
                            {isDiarizing ? '분리중...' : '화자분리 실행'}
                          </button>
                        )}
                      </div>
                      {selectedTranscript.diarized_transcript && (
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(selectedTranscript.diarized_transcript || '');
                            alert('화자분리 내용이 클립보드에 복사되었습니다.');
                          }}
                          className="text-sm text-gray-500 hover:text-gray-700"
                        >
                          <i className="fas fa-copy mr-1"></i>
                          복사
                        </button>
                      )}
                    </div>
                    <div className="p-6">
                      {selectedTranscript.diarized_transcript ? (
                        <div className="space-y-3">
                          {selectedTranscript.diarized_transcript.split('\n').map((line, idx) => {
                            const trimmed = line.trim();
                            if (!trimmed) return null;
                            const isDoctor = trimmed.startsWith('[의사]');
                            const isPatient = trimmed.startsWith('[환자]');
                            const text = trimmed.replace(/^\[(의사|환자)\]\s*/, '');
                            if (isDoctor) {
                              return (
                                <div key={idx} className="flex gap-3">
                                  <div className="flex-shrink-0 w-16 text-right">
                                    <span className="inline-block px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">
                                      의사
                                    </span>
                                  </div>
                                  <p className="flex-1 text-gray-700 text-sm leading-relaxed">{text}</p>
                                </div>
                              );
                            } else if (isPatient) {
                              return (
                                <div key={idx} className="flex gap-3">
                                  <div className="flex-shrink-0 w-16 text-right">
                                    <span className="inline-block px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full font-medium">
                                      환자
                                    </span>
                                  </div>
                                  <p className="flex-1 text-gray-700 text-sm leading-relaxed">{text}</p>
                                </div>
                              );
                            }
                            return (
                              <p key={idx} className="text-gray-500 text-sm pl-[76px]">{trimmed}</p>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-gray-400">
                          <i className="fas fa-users text-3xl mb-2 block"></i>
                          <p>화자분리 결과가 없습니다</p>
                          <p className="text-xs mt-1">위 버튼을 눌러 화자분리를 실행하세요</p>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* SOAP 탭 */}
                {detailTab === 'soap' && (
                  <>
                    {selectedTranscript.soap_status === 'completed' ? (
                      <>
                        <div className="px-6 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-end">
                          <button
                            onClick={() => {
                              const soap = `S: ${selectedTranscript.soap_subjective || '-'}\n\nO: ${selectedTranscript.soap_objective || '-'}\n\nA: ${selectedTranscript.soap_assessment || '-'}\n\nP: ${selectedTranscript.soap_plan || '-'}`;
                              navigator.clipboard.writeText(soap);
                              alert('SOAP 내용이 클립보드에 복사되었습니다.');
                            }}
                            className="text-sm text-gray-500 hover:text-gray-700"
                          >
                            <i className="fas fa-copy mr-1"></i>
                            복사
                          </button>
                        </div>
                        <div className="divide-y divide-gray-100">
                          <div className="p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="w-7 h-7 flex items-center justify-center bg-blue-100 text-blue-700 rounded-lg font-bold text-sm">S</span>
                              <span className="font-medium text-gray-700">Subjective (주관적 증상)</span>
                            </div>
                            <p className="text-gray-600 pl-9 whitespace-pre-wrap text-sm">
                              {selectedTranscript.soap_subjective || '-'}
                            </p>
                          </div>
                          <div className="p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="w-7 h-7 flex items-center justify-center bg-green-100 text-green-700 rounded-lg font-bold text-sm">O</span>
                              <span className="font-medium text-gray-700">Objective (객관적 소견)</span>
                            </div>
                            <p className="text-gray-600 pl-9 whitespace-pre-wrap text-sm">
                              {selectedTranscript.soap_objective || '-'}
                            </p>
                          </div>
                          <div className="p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="w-7 h-7 flex items-center justify-center bg-yellow-100 text-yellow-700 rounded-lg font-bold text-sm">A</span>
                              <span className="font-medium text-gray-700">Assessment (평가)</span>
                            </div>
                            <p className="text-gray-600 pl-9 whitespace-pre-wrap text-sm">
                              {selectedTranscript.soap_assessment || '-'}
                            </p>
                          </div>
                          <div className="p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="w-7 h-7 flex items-center justify-center bg-purple-100 text-purple-700 rounded-lg font-bold text-sm">P</span>
                              <span className="font-medium text-gray-700">Plan (계획)</span>
                            </div>
                            <p className="text-gray-600 pl-9 whitespace-pre-wrap text-sm">
                              {selectedTranscript.soap_plan || '-'}
                            </p>
                          </div>
                        </div>
                      </>
                    ) : (selectedTranscript.soap_status === 'processing' || Boolean(selectedSoapJob)) ? (
                      <div className="p-6 text-center">
                        <i className="fas fa-spinner fa-spin text-blue-500 text-2xl mb-2 block"></i>
                        <p className="text-blue-700">SOAP 변환 중입니다...</p>
                        {(selectedSoapJob?.message || selectedTranscript.processing_message) && (
                          <p className="text-xs mt-1 text-blue-500">{selectedSoapJob?.message || selectedTranscript.processing_message}</p>
                        )}
                      </div>
                    ) : selectedTranscript.soap_status === 'failed' ? (
                      <div className="p-6 text-center">
                        <i className="fas fa-exclamation-circle text-red-500 text-2xl mb-2 block"></i>
                        <p className="text-red-700 mb-3">SOAP 변환에 실패했습니다</p>
                        <button
                          onClick={() => handleServerRetry(selectedTranscript.id)}
                          disabled={isReprocessing}
                          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                        >
                          <i className={`fas fa-redo mr-1 ${isReprocessing ? 'animate-spin' : ''}`}></i>
                          {isReprocessing ? '처리중...' : '서버 재처리'}
                        </button>
                      </div>
                    ) : (
                      <div className="p-6 text-center">
                        <i className="fas fa-clock text-gray-400 text-2xl mb-2 block"></i>
                        <p className="text-gray-600 mb-3">SOAP 변환 대기 중</p>
                        <button
                          onClick={handleReprocessSoap}
                          disabled={isReprocessing || Boolean(selectedSoapJob)}
                          className="px-4 py-2 bg-clinic-primary text-white rounded-lg hover:bg-clinic-primary/90 transition-colors disabled:opacity-50"
                        >
                          <i className={`fas fa-play mr-1 ${(isReprocessing || Boolean(selectedSoapJob)) ? 'animate-spin' : ''}`}></i>
                          {(isReprocessing || Boolean(selectedSoapJob)) ? '처리중...' : 'SOAP 생성'}
                        </button>
                      </div>
                    )}
                  </>
                )}

                {/* 상담코칭 탭 */}
                {detailTab === 'coaching' && (
                  <>
                    <div className="px-6 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                      <div className="text-xs text-gray-500">
                        화자분리 텍스트가 있으면 우선 사용하고, 없으면 녹취원본을 사용합니다.
                      </div>
                      <div className="flex items-center gap-3">
                        {(selectedTranscript.coaching_text || coachingTextMemory[selectedTranscript.id]) && (
                          <button
                            onClick={() => {
                              const text = selectedTranscript.coaching_text || coachingTextMemory[selectedTranscript.id] || '';
                              navigator.clipboard.writeText(text);
                              alert('상담코칭 내용이 클립보드에 복사되었습니다.');
                            }}
                            className="text-sm text-gray-500 hover:text-gray-700"
                          >
                            <i className="fas fa-copy mr-1"></i>
                            복사
                          </button>
                        )}
                        <button
                          onClick={handleGenerateCoaching}
                          disabled={isGeneratingCoaching || isCoachingRunning || !getTranscriptSourceText(selectedTranscript)}
                          className="px-3 py-1.5 text-sm bg-clinic-primary text-white rounded-lg hover:bg-clinic-primary/90 transition-colors disabled:opacity-50"
                        >
                          <i className={`fas ${(isGeneratingCoaching || isCoachingRunning) ? 'fa-spinner fa-spin' : 'fa-lightbulb'} mr-1`}></i>
                          {(isGeneratingCoaching || isCoachingRunning)
                            ? '코칭 생성 중...'
                            : (selectedTranscript.coaching_text || coachingTextMemory[selectedTranscript.id])
                              ? '다시 생성'
                              : '코칭 생성'}
                        </button>
                      </div>
                    </div>

                    <div className="p-6">
                      {hasSelectedCoachingMeta && selectedCoachingMeta && (
                        <div className="mb-3 text-xs text-gray-500">
                          {(() => {
                            const meta = selectedCoachingMeta;
                            const seconds = typeof meta.elapsed_ms === 'number' ? (meta.elapsed_ms / 1000).toFixed(1) : null;
                            return [
                              meta.model ? `모델: ${meta.model}` : null,
                              typeof meta.input_tokens === 'number' ? `입력: ${meta.input_tokens.toLocaleString()} tok` : null,
                              typeof meta.output_tokens === 'number' ? `출력: ${meta.output_tokens.toLocaleString()} tok` : null,
                              typeof meta.total_tokens === 'number' ? `합계: ${meta.total_tokens.toLocaleString()} tok` : null,
                              typeof meta.estimated_cost_krw === 'number' ? `예상비용: ${Math.round(meta.estimated_cost_krw).toLocaleString()}원` : null,
                              seconds ? `소요: ${seconds}s` : null,
                            ].filter(Boolean).join(' · ');
                          })()}
                        </div>
                      )}
                      {!getTranscriptSourceText(selectedTranscript) ? (
                        <div className="text-center py-8 text-amber-600 bg-amber-50 border border-amber-200 rounded-lg">
                          <i className="fas fa-exclamation-triangle text-2xl mb-2 block"></i>
                          <p className="font-medium">녹취 텍스트가 없어 코칭을 생성할 수 없습니다.</p>
                          <p className="text-xs mt-1">녹취 또는 화자분리 텍스트가 준비된 뒤 다시 시도해 주세요.</p>
                        </div>
                      ) : coachingError ? (
                        <div className="text-center py-8 text-red-700 bg-red-50 border border-red-200 rounded-lg">
                          <i className="fas fa-exclamation-circle text-2xl mb-2 block"></i>
                          <p className="font-medium mb-1">상담코칭 생성에 실패했습니다.</p>
                          <p className="text-sm">{coachingError}</p>
                        </div>
                      ) : isCoachingRunning ? (
                        <div className="text-center py-10 text-blue-700">
                          <i className="fas fa-spinner fa-spin text-2xl mb-2 block"></i>
                          <p>상담코칭을 생성하고 있습니다...</p>
                          {selectedCoachingJob?.message && <p className="text-xs mt-1 text-blue-500">{selectedCoachingJob.message}</p>}
                        </div>
                      ) : (selectedTranscript.coaching_text || coachingTextMemory[selectedTranscript.id]) ? (
                        <div className="bg-white border border-gray-200 rounded-lg p-4">
                          <div className="text-sm text-gray-800 leading-relaxed">
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              components={{
                                h1: ({ children }) => <h1 className="text-xl font-bold mt-3 mb-2 text-gray-900">{children}</h1>,
                                h2: ({ children }) => <h2 className="text-xl font-bold mt-5 mb-3 text-gray-900 border-b border-gray-200 pb-1">{children}</h2>,
                                h3: ({ children }) => <h3 className="text-base font-semibold mt-2 mb-1 text-gray-900">{children}</h3>,
                                p: ({ children }) => <p className="mb-2 whitespace-pre-wrap">{children}</p>,
                                ul: ({ children }) => <ul className="list-disc pl-5 mb-2 space-y-1">{children}</ul>,
                                ol: ({ children }) => <ol className="list-decimal pl-5 mb-2 space-y-1">{children}</ol>,
                                li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                                blockquote: ({ children }) => <blockquote className="border-l-4 border-gray-300 pl-3 italic my-2">{children}</blockquote>,
                                code: ({ children }) => <code className="bg-gray-100 px-1 py-0.5 rounded">{children}</code>,
                                hr: () => <hr className="my-3 border-gray-200" />,
                                table: ({ children }) => <table className="w-full border-collapse my-2">{children}</table>,
                                th: ({ children }) => <th className="border border-gray-200 px-2 py-1 text-left bg-gray-100">{children}</th>,
                                td: ({ children }) => <td className="border border-gray-200 px-2 py-1 align-top">{children}</td>,
                              }}
                            >
                              {selectedTranscript.coaching_text || coachingTextMemory[selectedTranscript.id] || ''}
                            </ReactMarkdown>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-8 text-gray-500">
                          <i className="fas fa-lightbulb text-3xl mb-2 block text-purple-400"></i>
                          <p className="mb-1">아직 생성된 상담코칭이 없습니다.</p>
                          <p className="text-xs">상단의 "코칭 생성" 버튼을 눌러 시작하세요.</p>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* 서버 사이드 처리 상태 */}
              {selectedTranscript.processing_status && selectedTranscript.processing_status !== 'completed' && (
                <div className={`rounded-xl p-6 ${
                  selectedTranscript.processing_status === 'failed'
                    ? 'bg-red-50 border border-red-200'
                    : 'bg-blue-50 border border-blue-200'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {selectedTranscript.processing_status === 'failed' ? (
                        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                          <i className="fas fa-exclamation-circle text-red-500 text-xl"></i>
                        </div>
                      ) : (
                        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                          <i className="fas fa-cog fa-spin text-blue-500 text-xl"></i>
                        </div>
                      )}
                      <div>
                        <p className={`font-medium ${
                          selectedTranscript.processing_status === 'failed' ? 'text-red-700' : 'text-blue-700'
                        }`}>
                          {selectedTranscript.processing_status === 'uploading' && '업로드 완료, 처리 대기 중...'}
                          {selectedTranscript.processing_status === 'transcribing' && 'Whisper 음성 변환 중...'}
                          {selectedTranscript.processing_status === 'processing' && 'SOAP 및 화자 분리 중...'}
                          {selectedTranscript.processing_status === 'failed' && '처리 실패'}
                        </p>
                        {selectedTranscript.processing_message && (
                          <p className={`text-sm ${
                            selectedTranscript.processing_status === 'failed' ? 'text-red-600' : 'text-blue-600'
                          }`}>
                            {selectedTranscript.processing_message}
                          </p>
                        )}
                      </div>
                    </div>
                    {selectedTranscript.processing_status === 'failed' && (
                      <button
                        onClick={() => handleServerRetry(selectedTranscript.id)}
                        disabled={isReprocessing}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                      >
                        <i className={`fas fa-redo mr-1 ${isReprocessing ? 'animate-spin' : ''}`}></i>
                        {isReprocessing ? '처리중...' : '재처리'}
                      </button>
                    )}
                  </div>
                  {selectedTranscript.processing_status !== 'failed' && (
                    <div className="mt-4">
                      <div className="flex items-center gap-2 text-xs text-blue-600">
                        <div className={`w-2 h-2 rounded-full ${
                          selectedTranscript.processing_status === 'uploading' ? 'bg-blue-500' : 'bg-blue-300'
                        }`}></div>
                        <span>업로드</span>
                        <div className="flex-1 h-0.5 bg-blue-200"></div>
                        <div className={`w-2 h-2 rounded-full ${
                          selectedTranscript.processing_status === 'transcribing' ? 'bg-blue-500 animate-pulse' :
                          selectedTranscript.processing_status === 'processing' ? 'bg-blue-300' : 'bg-gray-200'
                        }`}></div>
                        <span>음성변환</span>
                        <div className="flex-1 h-0.5 bg-blue-200"></div>
                        <div className={`w-2 h-2 rounded-full ${
                          selectedTranscript.processing_status === 'processing' ? 'bg-blue-500 animate-pulse' : 'bg-gray-200'
                        }`}></div>
                        <span>SOAP</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-400">
              <div className="text-center">
                <i className="fas fa-hand-pointer text-4xl mb-3"></i>
                <p>왼쪽에서 녹취 기록을 선택하세요</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 삭제 확인 모달 */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <i className="fas fa-exclamation-triangle text-red-500 text-2xl"></i>
              </div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">녹취록 삭제</h3>
              <p className="text-gray-600">
                이 녹취록을 정말 삭제하시겠습니까?
                <br />
                <span className="text-red-500 text-sm">이 작업은 되돌릴 수 없습니다.</span>
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <i className="fas fa-spinner fa-spin mr-1"></i>
                    삭제중...
                  </>
                ) : (
                  '삭제'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MedicalTranscripts;
