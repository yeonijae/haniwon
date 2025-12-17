/**
 * 한약 복약관리 타입 정의
 */

// 한약 종류
export type HerbalType = 'tang' | 'hwan' | 'go';

export const HERBAL_TYPE_LABELS: Record<HerbalType, string> = {
  tang: '탕약',
  hwan: '공진단',
  go: '경옥고'
};

// 수령 방법
export type DeliveryMethod = 'pickup' | 'delivery';

export const DELIVERY_METHOD_LABELS: Record<DeliveryMethod, string> = {
  pickup: '내원수령',
  delivery: '택배발송'
};

// 콜 타입
export type CallType = 'chojin' | 'bokyak' | 'naewon';

export const CALL_TYPE_LABELS: Record<CallType, string> = {
  chojin: '초진콜',
  bokyak: '복약콜',
  naewon: '내원콜'
};

// 복약관리 상태
export type HerbalStatus = 'active' | 'paused' | 'completed';

// 콜 상태
export type CallStatus = 'pending' | 'completed' | 'skipped' | 'rescheduled';

// 가상과제 타입
export type TaskType = 'herbal_setup' | 'call_chojin' | 'call_bokyak' | 'call_naewon' | 'event_benefit' | 'followup';

// 가상과제
export interface HerbalTask {
  task_type: TaskType;
  task_title: string;
  task_description: string;
  priority: 'high' | 'normal' | 'low';
  patient: {
    customer_pk?: number;
    chart_number: string;
    name: string;
    phone?: string;
  };
  data: Record<string, any>;
}

// 복약관리 설정 폼 데이터
export interface HerbalSetupFormData {
  receipt_pk: number;
  customer_pk: number;
  patient_chart_number: string;
  patient_name: string;
  patient_phone?: string;
  okc_tx_date: string;
  okc_tx_money: number;

  herbal_type: HerbalType;
  herbal_name: string;
  sequence_code?: string;
  total_count: number;
  dose_per_day: number;
  delivery_method: DeliveryMethod;
  delivery_date: string;
  event_id?: number;
  memo?: string;
}

// 복약관리 레코드
export interface HerbalPurchase {
  id: number;
  receipt_pk?: number;
  customer_pk?: number;
  okc_tx_date?: string;
  okc_tx_money?: number;

  patient_id?: number;
  patient_chart_number: string;
  patient_name: string;
  patient_phone?: string;

  herbal_type: HerbalType;
  herbal_name?: string;
  sequence_code?: string;

  total_count: number;
  remaining_count: number;
  dose_per_day: number;

  delivery_method?: DeliveryMethod;
  delivery_date?: string;
  start_date?: string;
  expected_end_date?: string;
  actual_end_date?: string;

  event_id?: number;
  event_benefit_sent: boolean;

  status: HerbalStatus;
  memo?: string;

  created_at: string;
  updated_at: string;
}

// 콜 레코드
export interface HerbalCall {
  id: number;
  purchase_id: number;
  patient_id?: number;

  call_type: CallType;
  scheduled_date: string;
  status: CallStatus;

  completed_at?: string;
  completed_by?: string;
  contact_method?: 'phone' | 'kakao' | 'sms';
  result?: string;

  rescheduled_from?: number;
  reschedule_reason?: string;

  created_at: string;
  updated_at: string;
}

// 이벤트 레코드
export interface HerbalEvent {
  id: number;
  name: string;
  herbal_types?: string;
  start_date: string;
  end_date: string;
  benefit_message?: string;
  status: 'active' | 'ended' | 'benefit_sent';
  created_at: string;
  updated_at: string;
}

// API 응답
export interface HerbalTasksResponse {
  herbal_setup: HerbalTask[];
  calls: HerbalTask[];
  event_benefits: HerbalTask[];
  followup: HerbalTask[];
  summary: {
    total: number;
    setup_count: number;
    calls_count: number;
    benefits_count: number;
    followup_count: number;
  };
}
