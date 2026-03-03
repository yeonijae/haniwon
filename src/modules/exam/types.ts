/**
 * 검사결과 관리 타입 정의
 */

// 검사 유형 코드
export type ExamType =
  | 'biochemistry'       // 생화학검사
  | 'cbc'                // 혈구검사
  | 'hormone'            // 호르몬검사
  | 'inbody770'          // 체성분검사 (인바디 770)
  | 'iris8000'           // 체열검사 (IRIS-8000)
  | 'ibalance'           // 체형검사 (아이밸런스)
  | 'omnifit'            // 뇌파+자율신경검사 (옴니핏)
  | 'tongue'             // 설진검사
  | 'pulse_dayo'         // 맥진검사 (대요맥진기)
  | 'balance'            // 평형검사
  | 'skin';              // 피부사진

// 검사 유형 정보
export interface ExamTypeInfo {
  code: ExamType;
  name: string;
  icon: string;
  color: string;
  hasValues?: boolean;  // 수치 데이터 포함 여부
  multiplePerDay?: boolean;  // 하루 여러 건 가능 여부
}

// 검사 유형 목록
export const EXAM_TYPES: ExamTypeInfo[] = [
  { code: 'biochemistry', name: '생화학검사', icon: 'fa-flask', color: 'blue', hasValues: true },
  { code: 'cbc', name: '혈구검사', icon: 'fa-droplet', color: 'red', hasValues: true },
  { code: 'hormone', name: '호르몬검사', icon: 'fa-vial-circle-check', color: 'purple', hasValues: true },
  { code: 'inbody770', name: '체성분검사 (인바디 770)', icon: 'fa-weight-scale', color: 'indigo', hasValues: true },
  { code: 'iris8000', name: '체열검사 (IRIS-8000)', icon: 'fa-temperature-high', color: 'orange' },
  { code: 'ibalance', name: '체형검사 (아이밸런스)', icon: 'fa-person', color: 'green' },
  { code: 'omnifit', name: '뇌파+자율신경검사 (옴니핏)', icon: 'fa-brain', color: 'teal', hasValues: true },
  { code: 'tongue', name: '설진검사', icon: 'fa-mouth-open', color: 'pink' },
  { code: 'pulse_dayo', name: '맥진검사 (대요맥진기)', icon: 'fa-heart-pulse', color: 'rose', hasValues: true },
  { code: 'balance', name: '평형검사', icon: 'fa-scale-balanced', color: 'gray', hasValues: true },
  { code: 'skin', name: '피부사진', icon: 'fa-camera', color: 'teal', multiplePerDay: true },
];

// 검사 유형 코드로 정보 조회
export function getExamTypeInfo(code: ExamType): ExamTypeInfo | undefined {
  return EXAM_TYPES.find(t => t.code === code);
}

// 검사 유형별 색상 스타일 (Tailwind 동적 클래스 대신 사용)
export function getExamTypeStyles(code: ExamType): { bg: string; text: string; badge: string } {
  const colorMap: Record<string, { bg: string; text: string; badge: string }> = {
    red: { bg: 'bg-red-50', text: 'text-red-700', badge: 'bg-red-100 text-red-700' },
    blue: { bg: 'bg-blue-50', text: 'text-blue-700', badge: 'bg-blue-100 text-blue-700' },
    green: { bg: 'bg-green-50', text: 'text-green-700', badge: 'bg-green-100 text-green-700' },
    purple: { bg: 'bg-purple-50', text: 'text-purple-700', badge: 'bg-purple-100 text-purple-700' },
    pink: { bg: 'bg-pink-50', text: 'text-pink-700', badge: 'bg-pink-100 text-pink-700' },
    rose: { bg: 'bg-rose-50', text: 'text-rose-700', badge: 'bg-rose-100 text-rose-700' },
    indigo: { bg: 'bg-indigo-50', text: 'text-indigo-700', badge: 'bg-indigo-100 text-indigo-700' },
    orange: { bg: 'bg-orange-50', text: 'text-orange-700', badge: 'bg-orange-100 text-orange-700' },
    teal: { bg: 'bg-teal-50', text: 'text-teal-700', badge: 'bg-teal-100 text-teal-700' },
    gray: { bg: 'bg-gray-50', text: 'text-gray-700', badge: 'bg-gray-100 text-gray-700' },
  };

  const typeInfo = getExamTypeInfo(code);
  const color = typeInfo?.color || 'gray';
  return colorMap[color] || colorMap.gray;
}

// 검사결과
export interface ExamResult {
  id: number;
  patient_id: number;
  exam_date: string;  // YYYY-MM-DD
  exam_type: ExamType;
  exam_name?: string;
  findings?: string;
  memo?: string;
  doctor_name?: string;
  created_at: string;
  updated_at: string;
  // 조인 데이터
  attachments?: ExamAttachment[];
  values?: ExamValue[];
}

// 검사 첨부파일
export interface ExamAttachment {
  id: number;
  exam_result_id: number;
  file_name: string;
  file_path: string;
  file_size?: number;
  mime_type?: string;
  thumbnail_path?: string;
  caption?: string;
  sort_order: number;
  uploaded_at: string;
}

// 검사 수치 데이터
export interface ExamValue {
  id: number;
  exam_result_id: number;
  item_name: string;
  item_value?: number;
  unit?: string;
  reference_min?: number;
  reference_max?: number;
}

// 검사결과 생성 요청
export interface CreateExamRequest {
  patient_id: number;
  exam_date: string;
  exam_type: ExamType;
  exam_name?: string;
  findings?: string;
  memo?: string;
  doctor_name?: string;
}

// 검사결과 수정 요청
export interface UpdateExamRequest {
  exam_name?: string;
  findings?: string;
  memo?: string;
  doctor_name?: string;
}

// 파일 업로드 결과
export interface UploadResult {
  success: boolean;
  file_path: string;
  file_url: string;
  thumbnail_path?: string;
  thumbnail_url?: string;
  original_name: string;
  file_size: number;
  mime_type: string;
}

// 환자 정보 (MSSQL에서 조회)
export interface Patient {
  id: number;
  chart_number?: string;
  name: string;
  birth_date?: string;
  gender?: 'M' | 'F';
  phone?: string;
}

// 날짜별 검사 그룹
export interface ExamDateGroup {
  date: string;
  exams: ExamResult[];
}
