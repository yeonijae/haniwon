/**
 * 검사결과 관리 타입 정의
 */

// 검사 유형 코드
export type ExamType =
  | 'thermography'  // 적외선 체열검사
  | 'inbody'        // 인바디 체성분검사
  | 'body_shape'    // 체형 검사
  | 'balance'       // 평형 검사
  | 'tongue'        // 설진 검사
  | 'pulse'         // 맥진 검사
  | 'eeg'           // 뇌파 검사
  | 'ans'           // 자율신경 검사
  | 'skin';         // 피부사진

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
  { code: 'thermography', name: '적외선 체열', icon: 'fa-temperature-high', color: 'red' },
  { code: 'inbody', name: '인바디', icon: 'fa-weight-scale', color: 'blue', hasValues: true },
  { code: 'body_shape', name: '체형검사', icon: 'fa-person', color: 'green' },
  { code: 'balance', name: '평형검사', icon: 'fa-scale-balanced', color: 'purple', hasValues: true },
  { code: 'tongue', name: '설진', icon: 'fa-mouth-open', color: 'pink' },
  { code: 'pulse', name: '맥진', icon: 'fa-heart-pulse', color: 'rose', hasValues: true },
  { code: 'eeg', name: '뇌파', icon: 'fa-brain', color: 'indigo' },
  { code: 'ans', name: '자율신경', icon: 'fa-heart', color: 'orange', hasValues: true },
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
