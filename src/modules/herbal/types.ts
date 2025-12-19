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
export type TaskType = 'herbal_setup' | 'first_visit' | 'call_chojin' | 'call_bokyak' | 'call_naewon' | 'event_benefit' | 'followup';

// 결제 상세 내역 (비급여 항목)
export interface PaymentDetail {
  px_name: string;      // 처방명 (예: "한약-1)성인", "녹용추가0.5")
  tx_money: number;     // 금액
  is_deer_antler: boolean;  // 녹용 여부
}

// 초진 메시지 템플릿 타입
export type FirstVisitTemplateType = 'general' | 'pain' | 'accident' | 'herbal';

export const FIRST_VISIT_TEMPLATES: Record<FirstVisitTemplateType, { name: string; icon: string; color: string; content: string }> = {
  general: {
    name: '일반',
    icon: 'fa-user-check',
    color: 'bg-gray-500',
    content: `안녕하세요, {patient_name}님.\n연이재한의원입니다.\n\n오늘 내원해주셔서 감사합니다.\n궁금하신 점이나 불편한 점이 있으시면 언제든 연락 주세요.\n\n연이재한의원 드림`
  },
  pain: {
    name: '일반통증',
    icon: 'fa-hand-dots',
    color: 'bg-blue-500',
    content: `안녕하세요, {patient_name}님.\n연이재한의원입니다.\n\n오늘 내원해주셔서 감사합니다.\n치료 후 통증 부위가 일시적으로 뻐근하거나 피로감이 느껴질 수 있습니다.\n이는 정상적인 반응이니 걱정하지 않으셔도 됩니다.\n\n치료 효과를 높이기 위해 충분한 수분 섭취와 휴식을 권장드립니다.\n궁금하신 점이나 불편한 점이 있으시면 언제든 연락 주세요.\n\n연이재한의원 드림`
  },
  accident: {
    name: '교통사고',
    icon: 'fa-car-burst',
    color: 'bg-red-500',
    content: `안녕하세요, {patient_name}님.\n연이재한의원입니다.\n\n오늘 내원해주셔서 감사합니다.\n교통사고 후 통증은 시간이 지나면서 나타나거나 심해질 수 있으니,\n조금이라도 불편하시면 바로 말씀해 주세요.\n\n자동차보험으로 본인부담금 없이 치료받으실 수 있습니다.\n치료 기간 동안 무리한 활동은 피해주시고, 충분히 쉬어주세요.\n\n연이재한의원 드림`
  },
  herbal: {
    name: '한약상담',
    icon: 'fa-prescription-bottle-medical',
    color: 'bg-green-500',
    content: `안녕하세요, {patient_name}님.\n연이재한의원입니다.\n\n오늘 상담 감사드립니다.\n한약은 체질과 증상에 맞게 처방되어 효과가 점진적으로 나타납니다.\n\n복용 중 불편하신 점이나 궁금하신 사항이 있으시면\n언제든지 편하게 연락 주세요.\n\n연이재한의원 드림`
  }
};

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

// 초진 메시지 레코드
export interface FirstVisitMessage {
  id: number;
  customer_pk: number;
  chart_number?: string;
  patient_name: string;
  patient_phone?: string;
  treatment_date: string;
  doctor_name?: string;
  template_type?: FirstVisitTemplateType;
  message_sent: boolean;
  sent_at?: string;
  sent_by?: string;
  notes?: string;
  created_at?: string;
}

// API 응답
export interface HerbalTasksResponse {
  first_visits: HerbalTask[];
  herbal_setup: HerbalTask[];
  active_purchases: HerbalPurchase[];
  calls: HerbalTask[];
  event_benefits: HerbalTask[];
  followup: HerbalTask[];
  summary: {
    total: number;
    first_visit_count: number;
    setup_count: number;
    active_count: number;
    calls_count: number;
    benefits_count: number;
    followup_count: number;
  };
}
