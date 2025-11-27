/**
 * 환자관리 관련 타입 정의
 */

// 관리 유형
export type PatientCareType =
  | 'happy_call_delivery'    // 배송 후 해피콜
  | 'happy_call_medication'  // 복약 중 해피콜
  | 'treatment_followup'     // 치료 후 follow-up
  | 'treatment_closure'      // 치료 종결 확인
  | 'periodic_message'       // 정기 관리 메시지
  | 'reservation_reminder'   // 예약 리마인더
  | 'custom';                // 수동 등록

// 관리 항목 상태
export type PatientCareStatus = 'pending' | 'scheduled' | 'completed' | 'skipped';

// 트리거 유형
export type TriggerType = 'auto' | 'manual';

// 환자 치료 상태
export type TreatmentStatusType = 'active' | 'paused' | 'completed' | 'lost';

// 종결 유형
export type ClosureType = 'natural' | 'planned' | 'patient_request' | 'lost_contact';

// 환자 관리 항목
export interface PatientCareItem {
  id: number;
  patient_id: number;
  treatment_record_id?: number;

  // 관리 유형
  care_type: PatientCareType;

  // 내용
  title: string;
  description?: string;

  // 상태
  status: PatientCareStatus;

  // 일정
  scheduled_date?: string;
  completed_date?: string;
  completed_by?: string;

  // 결과
  result?: string;

  // 트리거 정보
  trigger_type: TriggerType;
  trigger_source?: string;

  // 타임스탬프
  created_at: string;
  updated_at: string;

  // 조인된 데이터
  patient_name?: string;
  patient_chart_number?: string;
  patient_phone?: string;
  treatment_status?: TreatmentStatusType;
  total_visits?: number;
  last_visit_date?: string;
}

// 환자 치료 상태
export interface PatientTreatmentStatus {
  id: number;
  patient_id: number;

  // 치료 상태
  status: TreatmentStatusType;

  // 기간
  start_date?: string;
  end_date?: string;

  // 통계
  total_visits: number;
  last_visit_date?: string;
  next_scheduled_date?: string;

  // 종결 정보
  closure_reason?: string;
  closure_type?: ClosureType;

  // 메모
  notes?: string;

  // 타임스탬프
  created_at: string;
  updated_at: string;
}

// 환자관리 규칙
export interface PatientCareRule {
  id: number;
  name: string;
  description?: string;
  trigger_event: string;
  care_type: PatientCareType;
  title_template: string;
  description_template?: string;
  days_offset: number;
  is_active: boolean;
  created_at: string;
}

// 관리 항목 생성 입력
export interface CreatePatientCareItemInput {
  patient_id: number;
  treatment_record_id?: number;
  care_type: PatientCareType;
  title: string;
  description?: string;
  scheduled_date?: string;
  trigger_type?: TriggerType;
  trigger_source?: string;
}

// 관리 유형 한글명
export const CARE_TYPE_LABELS: Record<PatientCareType, string> = {
  happy_call_delivery: '배송 해피콜',
  happy_call_medication: '복약 해피콜',
  treatment_followup: '치료 후 상담',
  treatment_closure: '종결 상담',
  periodic_message: '정기 관리',
  reservation_reminder: '예약 리마인더',
  custom: '기타',
};

// 치료 상태 한글명
export const TREATMENT_STATUS_LABELS: Record<TreatmentStatusType, string> = {
  active: '치료중',
  paused: '휴식중',
  completed: '종결',
  lost: '연락두절',
};

// 종결 유형 한글명
export const CLOSURE_TYPE_LABELS: Record<ClosureType, string> = {
  natural: '자연 종결',
  planned: '계획 종결',
  patient_request: '환자 요청',
  lost_contact: '연락두절',
};
