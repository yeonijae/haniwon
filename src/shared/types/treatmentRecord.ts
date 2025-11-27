/**
 * 진료내역 관련 타입 정의
 */

// 진료 유형
export type VisitType = 'initial' | 'follow_up' | 'medication' | 'treatment_only';

// 서비스 유형 (할일 생성 트리거)
export type ServiceType =
  | 'consultation'       // 일반 진료
  | 'initial_consult'    // 초진
  | 'medication_consult' // 약상담
  | 'acupuncture'        // 침
  | 'chuna'              // 추나
  | 'cupping'            // 부항
  | 'moxa'               // 뜸
  | 'herbal_medicine'    // 한약 처방
  | 'ultrasound';        // 초음파

// 진료내역 상태
export type TreatmentRecordStatus = 'in_progress' | 'completed' | 'canceled';

// 타임라인 이벤트 유형
export type TimelineEventType =
  | 'check_in'              // 내원 (접수)
  | 'waiting_consultation'  // 진료 대기
  | 'consultation_start'    // 진료 시작
  | 'consultation_end'      // 진료 종료
  | 'waiting_treatment'     // 치료 대기
  | 'treatment_start'       // 치료 시작
  | 'treatment_end'         // 치료 종료
  | 'waiting_payment'       // 수납 대기
  | 'payment_complete'      // 수납 완료
  | 'check_out';            // 퇴원

// 치료 항목
export interface TreatmentItemRecord {
  name: string;
  duration: number;  // 분
}

// 타임라인 이벤트
export interface TimelineEvent {
  id: number;
  treatment_record_id: number;
  event_type: TimelineEventType;
  timestamp: string;  // ISO string
  location?: string;  // 진료실, 치료실 등
  staff_name?: string;
  memo?: string;
  created_at: string;
}

// 진료내역
export interface TreatmentRecord {
  id: number;
  patient_id: number;
  treatment_date: string;  // YYYY-MM-DD

  // 진료 정보
  doctor_name?: string;
  treatment_room?: string;

  // 진료 유형
  visit_type: VisitType;
  services: ServiceType[];

  // 치료 항목
  treatment_items: TreatmentItemRecord[];

  // 연결
  reservation_id?: string;
  payment_id?: number;

  // 상태
  status: TreatmentRecordStatus;
  memo?: string;

  // 타임스탬프
  created_at: string;
  updated_at: string;

  // 조인된 데이터 (선택)
  timeline_events?: TimelineEvent[];
  patient_name?: string;
  chart_number?: string;
}

// 진료 통계 (뷰에서 조회)
export interface TreatmentStatistics {
  id: number;
  patient_id: number;
  patient_name: string;
  chart_number?: string;
  treatment_date: string;
  doctor_name?: string;
  visit_type: VisitType;
  status: TreatmentRecordStatus;
  check_in_time?: string;
  check_out_time?: string;
  total_duration_minutes?: number;
}

// 대기시간 분석
export interface WaitingTimeAnalysis {
  treatment_record_id: number;
  consultation_wait_minutes: number;  // 진료 대기
  treatment_wait_minutes: number;     // 치료 대기
  payment_wait_minutes: number;       // 수납 대기
  total_wait_minutes: number;         // 총 대기시간
  total_service_minutes: number;      // 총 서비스시간
  total_duration_minutes: number;     // 총 체류시간
}

// 진료내역 생성 입력
export interface CreateTreatmentRecordInput {
  patient_id: number;
  treatment_date?: string;
  doctor_name?: string;
  visit_type?: VisitType;
  services?: ServiceType[];
  reservation_id?: string;
  memo?: string;
}

// 타임라인 이벤트 생성 입력
export interface CreateTimelineEventInput {
  treatment_record_id: number;
  event_type: TimelineEventType;
  timestamp?: string;
  location?: string;
  staff_name?: string;
  memo?: string;
}

// ============================================
// 라벨 상수
// ============================================

// 진료 유형 한글명
export const VISIT_TYPE_LABELS: Record<VisitType, string> = {
  initial: '초진',
  follow_up: '재진',
  medication: '약상담',
  treatment_only: '치료만',
};

// 서비스 유형 한글명
export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  consultation: '진료',
  initial_consult: '초진',
  medication_consult: '약상담',
  acupuncture: '침',
  chuna: '추나',
  cupping: '부항',
  moxa: '뜸',
  herbal_medicine: '한약',
  ultrasound: '초음파',
};

// 진료내역 상태 한글명
export const RECORD_STATUS_LABELS: Record<TreatmentRecordStatus, string> = {
  in_progress: '진행중',
  completed: '완료',
  canceled: '취소',
};

// 타임라인 이벤트 한글명
export const EVENT_TYPE_LABELS: Record<TimelineEventType, string> = {
  check_in: '내원',
  waiting_consultation: '진료 대기',
  consultation_start: '진료 시작',
  consultation_end: '진료 종료',
  waiting_treatment: '치료 대기',
  treatment_start: '치료 시작',
  treatment_end: '치료 종료',
  waiting_payment: '수납 대기',
  payment_complete: '수납 완료',
  check_out: '퇴원',
};
