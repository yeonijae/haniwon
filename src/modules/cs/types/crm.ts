// CRM 관련 타입 정의

// 직원 역할 타입
export type StaffRole = 'doctor' | 'desk' | 'treatment';

// 직원 역할 라벨
export const STAFF_ROLE_LABELS: Record<StaffRole, string> = {
  doctor: '의사',
  desk: '데스크',
  treatment: '치료실',
};

// 메모 노트 타입
export type PatientNoteType = 'memo' | 'complaint' | 'inquiry';

// 메모 노트 타입 라벨
export const NOTE_TYPE_LABELS: Record<PatientNoteType, string> = {
  memo: '메모',
  complaint: '컴플레인',
  inquiry: '문의',
};

// 메모 노트 타입 아이콘
export const NOTE_TYPE_ICONS: Record<PatientNoteType, string> = {
  memo: '📝',
  complaint: '⚠️',
  inquiry: '❓',
};

// 메모 노트 타입 색상
export const NOTE_TYPE_COLORS: Record<PatientNoteType, string> = {
  memo: '#3b82f6',      // blue
  complaint: '#ef4444', // red
  inquiry: '#f59e0b',   // amber
};

// 채널 타입 (기존 InquiryChannel과 동일하지만 CRM 전용으로 재정의)
export type NoteChannel = 'phone' | 'kakao' | 'visit' | 'naver';

// 채널 라벨
export const NOTE_CHANNEL_LABELS: Record<NoteChannel, string> = {
  phone: '전화',
  kakao: '카톡',
  visit: '방문',
  naver: '네이버',
};

// 채널 아이콘
export const NOTE_CHANNEL_ICONS: Record<NoteChannel, string> = {
  phone: '📞',
  kakao: '💬',
  visit: '🚶',
  naver: '🟢',
};

// 메모 상태 타입
export type NoteStatus = 'active' | 'resolved' | 'archived';

// 메모 상태 라벨
export const NOTE_STATUS_LABELS: Record<NoteStatus, string> = {
  active: '활성',
  resolved: '해결됨',
  archived: '보관',
};

// 환자 메모 노트 인터페이스
export interface PatientNote {
  id: number;
  patient_id: number;
  chart_number: string;
  patient_name?: string;

  note_type: PatientNoteType;
  channel?: NoteChannel;

  content: string;
  response?: string;
  status: NoteStatus;

  mssql_receipt_id?: number;
  mssql_detail_id?: number;
  related_date?: string;

  staff_name: string;
  staff_role: StaffRole;

  created_at: string;
  updated_at: string;
}

// 메모 노트 생성 요청
export interface CreatePatientNoteRequest {
  patient_id: number;
  chart_number: string;
  patient_name?: string;

  note_type: PatientNoteType;
  channel?: NoteChannel;

  content: string;
  response?: string;

  mssql_receipt_id?: number;
  mssql_detail_id?: number;
  related_date?: string;

  staff_name: string;
  staff_role: StaffRole;
}

// 메모 노트 수정 요청
export interface UpdatePatientNoteRequest {
  note_type?: PatientNoteType;
  channel?: NoteChannel;
  content?: string;
  response?: string;
  status?: NoteStatus;
  staff_name?: string;
  staff_role?: StaffRole;
}

// CRM 탭 타입
export type CRMTabType = 'overview' | 'notes' | 'history' | 'happycall';

// CRM 탭 라벨
export const CRM_TAB_LABELS: Record<CRMTabType, string> = {
  overview: '종합현황',
  notes: '메모/문의',
  history: '수납이력',
  happycall: '해피콜',
};

// 패키지 현황 요약 타입
export interface PackageStatusSummary {
  // 통마
  tongma: {
    id?: number;
    active: boolean;
    totalCount: number;
    usedCount: number;
    remainingCount: number;
    startDate?: string;
    expireDate?: string;
    packageName?: string;
    createdAt?: string;
  } | null;

  // 한약 선결
  herbal: {
    id?: number;
    active: boolean;
    herbalName?: string;
    totalCount: number;
    usedCount: number;
    remainingCount: number;
    createdAt?: string;
  } | null;

  // 녹용 선결
  nokryong: {
    id?: number;
    active: boolean;
    packageName?: string;
    totalMonths: number;
    remainingMonths: number;
    createdAt?: string;
  } | null;

  // 멤버십
  membership: {
    id?: number;
    active: boolean;
    membershipType: string;
    quantity: number;
    startDate?: string;
    expireDate: string;
    createdAt?: string;
  } | null;
}

// 환자 CRM 데이터 인터페이스
export interface PatientCRMData {
  // 환자 기본 정보
  patientId: number;
  chartNumber: string;
  patientName: string;
  gender?: 'male' | 'female';
  age?: number;

  // 패키지 현황
  packageStatus: PackageStatusSummary;

  // 메모 목록
  notes: PatientNote[];

  // 수납 이력 (요약)
  receiptCount: number;
  lastReceiptDate?: string;

  // 해피콜 이력
  happyCallCount: number;
  lastHappyCallDate?: string;
}

// 타임라인 필터 옵션
export interface NoteFilterOptions {
  noteType?: PatientNoteType;
  channel?: NoteChannel;
  status?: NoteStatus;
  startDate?: string;
  endDate?: string;
}

// 비급여 액션 타입
export type NonCoveredActionType = 'package_deduct' | 'package_register' | 'memo_only';

// 비급여 액션 라벨
export const NON_COVERED_ACTION_LABELS: Record<NonCoveredActionType, string> = {
  package_deduct: '패키지에서 차감',
  package_register: '새 패키지 등록',
  memo_only: '메모만 남기기',
};

// 비급여 모달 데이터
export interface NonCoveredModalData {
  itemName: string;
  amount: number;
  patientId: number;
  chartNumber: string;
  patientName: string;
  mssqlReceiptId?: number;
  mssqlDetailId?: number;
}

// 해피콜 기록 (patient-care 모듈에서 가져옴)
export interface HappyCallRecord {
  id: number;
  patient_id: number;
  chart_number: string;
  patient_name: string;
  call_date: string;
  call_type: string;       // 'post_visit' | 'follow_up' | 'reminder'
  call_result: string;     // 'completed' | 'no_answer' | 'callback'
  notes?: string;
  staff_name: string;
  created_at: string;
}

// ============================================
// 응대 기록 (patient_contact_logs) - Phase 1
// ============================================

export type ContactDirection = 'inbound' | 'outbound';

export type ContactChannel = 'phone' | 'kakao' | 'sms' | 'visit' | 'naver';

// 인바운드 유형
export type InboundContactType = 'inquiry' | 'reservation' | 'complaint' | 'other';

// 아웃바운드 유형
export type OutboundContactType =
  | 'delivery_call'   // 배송콜
  | 'visit_call'      // 내원콜
  | 'after_call'      // 애프터콜
  | 'marketing'       // 마케팅
  | 'follow_up';      // 후속 연락

export type ContactType = InboundContactType | OutboundContactType;

export interface ContactLog {
  id: number;
  patient_id: number;
  direction: ContactDirection;
  channel: ContactChannel;
  contact_type: ContactType;
  content: string | null;
  result: string | null;
  related_type: string | null;  // 'herbal_package' | 'reservation' | 'treatment_package'
  related_id: number | null;
  created_by: string | null;
  created_at: string;
}

export interface CreateContactLogRequest {
  patient_id: number;
  direction: ContactDirection;
  channel: ContactChannel;
  contact_type: ContactType;
  content?: string;
  result?: string;
  related_type?: string;
  related_id?: number;
  created_by?: string;
}

// ============================================
// 아웃바운드 콜 큐 (outbound_call_queue) - Phase 1
// ============================================

export type CallType =
  | 'delivery_call'      // 배송콜 (수령 3일차)
  | 'visit_call'         // 내원콜 (수령 12일차)
  | 'after_call'         // 애프터콜
  | 'unconsumed'         // 미복용
  | 'vip_care'           // VIP관리
  | 'churn_risk_1'       // 이탈위험(1회)
  | 'churn_risk_3'       // 재방문유도
  | 'repayment_consult'  // 재결제 상담 (선결제 소진)
  | 'remind_3month'      // 리마인드콜 (복약완료 3개월 후)
  | 'expiry_warning';    // 유효기간 임박

export const CALL_TYPE_LABELS: Record<CallType, string> = {
  delivery_call: '배송콜',
  visit_call: '내원콜',
  after_call: '애프터콜',
  unconsumed: '미복용',
  vip_care: 'VIP관리',
  churn_risk_1: '이탈관리',
  churn_risk_3: '재방문유도',
  repayment_consult: '재결제상담',
  remind_3month: '리마인드',
  expiry_warning: '기간임박',
};

export type CallStatus =
  | 'pending'     // 대기
  | 'completed'   // 완료
  | 'postponed'   // 미룸
  | 'cancelled'   // 취소
  | 'no_answer';  // 부재중

export const CALL_STATUS_LABELS: Record<CallStatus, string> = {
  pending: '대기',
  completed: '완료',
  postponed: '미룸',
  cancelled: '취소',
  no_answer: '부재중',
};

export interface CallQueueItem {
  id: number;
  patient_id: number;
  call_type: CallType;
  related_type: string | null;
  related_id: number | null;
  due_date: string;
  priority: number;
  status: CallStatus;
  postponed_to: string | null;
  original_due_date: string | null;
  completed_at: string | null;
  contact_log_id: number | null;
  created_at: string;
  updated_at: string;
  // 조인된 환자 정보 (조회 시)
  patient?: {
    name: string;
    chart_number: string;
    phone: string | null;
    last_visit_date: string | null;
  };
  // 조인된 약 정보
  herbal_name?: string | null;
  reason?: string | null;
}

export interface CallNote {
  id: number;
  queue_id: number;
  content: string;
  created_by: string | null;
  created_at: string;
}

export interface CreateCallQueueRequest {
  patient_id: number;
  call_type: CallType;
  related_type?: string;
  related_id?: number;
  due_date: string;
  priority?: number;
}

export interface UpdateCallQueueRequest {
  status?: CallStatus;
  postponed_to?: string;
  contact_log_id?: number;
}

// ============================================
// 콜 조건 설정 (call_condition_settings) - Phase 1
// ============================================

export interface CallConditionSetting {
  id: number;
  call_type: CallType;
  label: string;
  description: string | null;
  condition_params: Record<string, any>;
  is_active: boolean;
  created_at: string;
}

// ============================================
// 콜 센터 통계
// ============================================

export interface CallCenterStats {
  total_pending: number;
  by_type: Record<CallType, number>;
  completed_today: number;
}

// ============================================
// 메시지 발송 (Phase 4)
// ============================================

export type MessageChannel = 'sms' | 'kakao';

export const MESSAGE_CHANNEL_LABELS: Record<MessageChannel, string> = {
  sms: 'SMS',
  kakao: '카카오',
};

export type MessageStatus = 'pending' | 'sent' | 'delivered' | 'failed';

export const MESSAGE_STATUS_LABELS: Record<MessageStatus, string> = {
  pending: '대기',
  sent: '발송',
  delivered: '전달완료',
  failed: '실패',
};

export interface MessageTemplate {
  id: number;
  name: string;
  channel: MessageChannel;
  category: string | null;
  content: string;
  variables: string[];  // ['name', 'date', 'time'] 등
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateMessageTemplateRequest {
  name: string;
  channel: MessageChannel;
  category?: string;
  content: string;
  variables?: string[];
}

export interface UpdateMessageTemplateRequest {
  name?: string;
  channel?: MessageChannel;
  category?: string;
  content?: string;
  variables?: string[];
  is_active?: boolean;
}

export interface MessageLog {
  id: number;
  patient_id: number | null;
  template_id: number | null;
  channel: MessageChannel;
  phone: string;
  content: string;
  variables_used: Record<string, string> | null;
  status: MessageStatus;
  error_message: string | null;
  external_id: string | null;
  sent_at: string | null;
  created_at: string;
  created_by: string | null;
  // 조인된 환자 정보
  patient?: {
    name: string;
    chart_number: string;
  };
}

export interface SendMessageRequest {
  patient_id?: number;
  template_id?: number;
  channel: MessageChannel;
  phone: string;
  content: string;
  variables?: Record<string, string>;
  created_by?: string;
}

export interface MessageStats {
  total_sent_today: number;
  by_channel: Record<MessageChannel, number>;
  failed_today: number;
}
