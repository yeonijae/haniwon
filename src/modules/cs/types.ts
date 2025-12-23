// CS 관리 타입 정의

export type InquiryChannel = 'phone' | 'kakao' | 'visit' | 'naver';
export type InquiryType = 'new_patient' | 'reservation' | 'general' | 'other';
export type InquiryStatus = 'pending' | 'completed' | 'converted';

export interface Inquiry {
  id: number;
  channel: InquiryChannel;
  patient_name?: string;
  contact?: string;
  inquiry_type: InquiryType;
  content: string;
  response?: string;
  status: InquiryStatus;
  staff_name?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateInquiryRequest {
  channel: InquiryChannel;
  patient_name?: string;
  contact?: string;
  inquiry_type: InquiryType;
  content: string;
  response?: string;
  staff_name?: string;
}

export interface UpdateInquiryRequest {
  channel?: InquiryChannel;
  patient_name?: string;
  contact?: string;
  inquiry_type?: InquiryType;
  content?: string;
  response?: string;
  status?: InquiryStatus;
  staff_name?: string;
}

// 채널 라벨
export const CHANNEL_LABELS: Record<InquiryChannel, string> = {
  phone: '전화',
  kakao: '카톡',
  visit: '방문',
  naver: '네이버',
};

// 채널 아이콘
export const CHANNEL_ICONS: Record<InquiryChannel, string> = {
  phone: '📞',
  kakao: '💬',
  visit: '🚶',
  naver: '🟢',
};

// 문의 유형 라벨
export const INQUIRY_TYPE_LABELS: Record<InquiryType, string> = {
  new_patient: '초진 문의',
  reservation: '예약 문의',
  general: '일반 문의',
  other: '기타',
};

// 상태 라벨
export const STATUS_LABELS: Record<InquiryStatus, string> = {
  pending: '대기',
  completed: '완료',
  converted: '예약전환',
};

// 상태 색상
export const STATUS_COLORS: Record<InquiryStatus, string> = {
  pending: '#f59e0b',
  completed: '#10b981',
  converted: '#3b82f6',
};
