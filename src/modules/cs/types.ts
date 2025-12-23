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

// ============================================
// 수납관리 관련 타입
// ============================================

// 예약 상태 타입
export type ReservationStatus = 'none' | 'pending_call' | 'pending_kakao' | 'pending_naver' | 'pending_anytime' | 'confirmed';

// 예약 상태 라벨 (축약형)
export const RESERVATION_STATUS_LABELS: Record<ReservationStatus, string> = {
  none: '',
  pending_call: '전화',
  pending_kakao: '카톡',
  pending_naver: '네이버',
  pending_anytime: '편한',
  confirmed: '', // 날짜가 표시됨
};

// 시술패키지 타입
export interface TreatmentPackage {
  id?: number;
  patient_id: number;
  chart_number: string;
  patient_name: string;
  package_name: string;      // 통마, 약침, 향기요법, 스파인엠티 등
  total_count: number;       // 총 횟수
  used_count: number;        // 사용 횟수
  remaining_count: number;   // 잔여 횟수
  includes?: string;         // 포함 항목 (경근1, 비추 등)
  start_date: string;        // 시작일
  expire_date?: string;      // 만료일
  memo?: string;
  status: 'active' | 'completed' | 'expired';
  created_at?: string;
  updated_at?: string;
}

// 한약패키지 (선결) 타입
export interface HerbalPackage {
  id?: number;
  patient_id: number;
  chart_number: string;
  patient_name: string;
  package_type: '1month' | '2month' | '3month' | '6month';  // 선결 기간
  total_count: number;       // 총 회차
  used_count: number;        // 사용 회차
  remaining_count: number;   // 잔여 회차
  start_date: string;
  next_delivery_date?: string;  // 다음 배송일
  memo?: string;
  status: 'active' | 'completed';
  created_at?: string;
  updated_at?: string;
}

// 적립포인트 타입
export interface PointTransaction {
  id?: number;
  patient_id: number;
  chart_number: string;
  patient_name: string;
  transaction_type: 'earn' | 'use';  // 적립/사용
  amount: number;           // 금액 (양수)
  balance_after: number;    // 거래 후 잔액
  description?: string;     // 설명 (적립 사유, 사용 내역)
  receipt_id?: number;      // 연관 수납 ID (MSSQL)
  transaction_date: string;
  created_at?: string;
}

// 환자별 포인트 잔액
export interface PatientPointBalance {
  patient_id: number;
  chart_number: string;
  patient_name: string;
  balance: number;
  last_transaction_date?: string;
}

// 멤버십 타입
export interface Membership {
  id?: number;
  patient_id: number;
  chart_number: string;
  patient_name: string;
  membership_type: string;   // 경근멤버십 등
  remaining_count: number;   // 잔여 횟수
  start_date: string;
  expire_date: string;       // 만료일
  memo?: string;
  status: 'active' | 'expired';
  created_at?: string;
  updated_at?: string;
}

// 한약 출납 타입
export interface HerbalDispensing {
  id?: number;
  patient_id: number;
  chart_number: string;
  patient_name: string;
  herbal_name: string;       // 약명 (시함마농, 궁귀교애탕 등)
  quantity: number;          // 수량 (봉)
  dispensing_type: 'sale' | 'gift' | 'package';  // 판매/증정/패키지
  delivery_method: 'pickup' | 'local' | 'express';  // 내원/시내/시외
  receipt_id?: number;       // 연관 수납 ID
  memo?: string;
  dispensing_date: string;
  created_at?: string;
}

// 증정품 출납 타입
export interface GiftDispensing {
  id?: number;
  patient_id: number;
  chart_number: string;
  patient_name: string;
  item_name: string;         // 품목명 (핫팩, 비염고, 육미지황 등)
  quantity: number;          // 수량
  reason?: string;           // 사유 (네이버 리뷰 증정 등)
  receipt_id?: number;
  dispensing_date: string;
  created_at?: string;
}

// 서류발급 타입
export interface DocumentIssue {
  id?: number;
  patient_id: number;
  chart_number: string;
  patient_name: string;
  document_type: string;     // 진단서, 진료확인서, 초진차트 등
  quantity: number;          // 매수
  receipt_id?: number;
  issue_date: string;
  created_at?: string;
}

// 수납 메모 (기존 확장)
export interface ReceiptMemo {
  id?: number;
  patient_id: number;
  chart_number: string;
  patient_name: string;
  mssql_receipt_id?: number;
  receipt_date: string;
  memo?: string;             // 특이사항 메모
  reservation_status: ReservationStatus;
  reservation_date?: string; // 예약 확정 시 날짜
  created_at?: string;
  updated_at?: string;
}

// 수납 목록 아이템 (MSSQL + SQLite 병합)
export interface ReceiptListItem {
  // MSSQL 데이터
  id: number;                // MSSQL Receipt ID
  receipt_time: string;      // 접수 시간
  patient_id: number;
  patient_name: string;
  chart_number: string;
  age?: number;
  doctor: string;            // 담당의
  insurance_type: string;    // 종별 (재진, 초진, 65재, 자재 등)
  insurance_amount: number;  // 급여
  general_amount: number;    // 비급여
  payment_method?: string;   // 지불방법
  treatment_summary?: string; // 치료 요약 (복추, 약침 등)

  // SQLite 메모 요약
  memo_summary?: string;     // 메모 요약 (통마[12-1=11], 포인트-16000 등)

  // 예약 상태
  reservation_status: ReservationStatus;
  reservation_date?: string;

  // 확장 여부
  isExpanded?: boolean;
}

// 메모 요약 생성 헬퍼
export function generateMemoSummary(data: {
  treatmentPackages?: TreatmentPackage[];
  herbalPackages?: HerbalPackage[];
  pointUsed?: number;
  pointEarned?: number;
  membership?: Membership;
  herbalDispensings?: HerbalDispensing[];
  giftDispensings?: GiftDispensing[];
  documentIssues?: DocumentIssue[];
}): string {
  const parts: string[] = [];

  // 시술패키지
  data.treatmentPackages?.forEach(pkg => {
    if (pkg.status === 'active') {
      const includesText = pkg.includes ? `(${pkg.includes})` : '';
      parts.push(`${pkg.package_name}[${pkg.total_count}-${pkg.used_count}=${pkg.remaining_count}]${includesText}`);
    } else if (pkg.status === 'completed') {
      parts.push(`${pkg.package_name}[완료]`);
    }
  });

  // 한약패키지 (선결)
  data.herbalPackages?.forEach(pkg => {
    if (pkg.status === 'active') {
      parts.push(`선결(${pkg.total_count}-${pkg.used_count})`);
    }
  });

  // 포인트
  if (data.pointUsed && data.pointUsed > 0) {
    parts.push(`포인트-${data.pointUsed.toLocaleString()}`);
  }
  if (data.pointEarned && data.pointEarned > 0) {
    parts.push(`포인트+${data.pointEarned.toLocaleString()}`);
  }

  // 멤버십
  if (data.membership && data.membership.status === 'active') {
    const expireDate = data.membership.expire_date.slice(2, 7).replace('-', '/');
    parts.push(`${data.membership.membership_type} ${data.membership.remaining_count}회 (${expireDate})`);
  }

  // 한약 출납
  data.herbalDispensings?.forEach(disp => {
    const typeLabel = disp.dispensing_type === 'gift' ? '증정>' : '한약>';
    parts.push(`${typeLabel}${disp.herbal_name}(${disp.quantity})`);
  });

  // 증정품 출납
  data.giftDispensings?.forEach(disp => {
    const reasonText = disp.reason ? ` ${disp.reason}` : '';
    parts.push(`증정>${disp.item_name}(${disp.quantity})${reasonText}`);
  });

  // 서류발급
  data.documentIssues?.forEach(doc => {
    parts.push(`서류>${doc.document_type}${doc.quantity > 1 ? ` ${doc.quantity}매` : ''}`);
  });

  return parts.join(', ');
}
