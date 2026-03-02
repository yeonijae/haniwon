// CS 관리 타입 정의

// 탕전 슬롯 (일별 탕전 용량 관리)
export interface DecoctionSlot {
  id?: number;
  slot_date: string;           // 탕전 날짜 (YYYY-MM-DD)
  total_capacity: number;      // 총 용량 (기본 100)
  reserved_capacity: number;   // 예약된 용량
  is_available: boolean;       // 예약 가능 여부
  memo?: string;
  created_at?: string;
  updated_at?: string;
}

export type InquiryChannel = 'phone' | 'kakao' | 'visit' | 'naver';
export type InquiryType = 'new_patient' | 'reservation' | 'general' | 'other';
export type InquiryStatus = 'pending' | 'in_progress' | 'completed' | 'converted';

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
  patient_id?: number | null;
  completed_at?: string | null;
  handler_name?: string | null;
  // 환자 매칭 시 JOIN으로 가져오는 필드
  matched_patient_name?: string | null;
  matched_chart_number?: string | null;
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
  handler_name?: string;
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
  patient_id?: number | null;
  handler_name?: string | null;
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
  in_progress: '응대중',
  completed: '완료',
  converted: '예약전환',
};

// 상태 색상
export const STATUS_COLORS: Record<InquiryStatus, string> = {
  pending: '#f59e0b',
  in_progress: '#667eea',
  completed: '#10b981',
  converted: '#3b82f6',
};

// CS 담당자 타입 (api.ts에서 export)
export type { CsHandler } from './lib/api';

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
  mssql_detail_id?: number;  // MSSQL Detail_PK (비급여 항목 연결)
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
  herbal_name: string;        // 약명 (시함마농, 궁귀교애탕 등)
  purpose?: string;           // 처방 목적/질환명
  package_type: '0.5month' | '1month' | '2month' | '3month' | '6month';  // 선결 기간
  total_count: number;       // 총 회차
  used_count: number;        // 사용 회차
  remaining_count: number;   // 잔여 회차
  start_date: string;
  next_delivery_date?: string;  // 다음 배송일
  memo?: string;
  mssql_detail_id?: number;  // MSSQL Detail_PK (비급여 항목 연결)
  status: 'active' | 'completed';
  created_at?: string;
  updated_at?: string;

  // 담당원장 관련
  doctor_id?: number;
  doctor_name?: string;

  // 탕전 관련
  decoction_slot_id?: number;
  decoction_date?: string;       // 탕전 예정일
  decoction_status?: DecoctionStatus;
  decoction_started_at?: string;
  decoction_completed_at?: string;

  // 처방 관련
  prescription_id?: number;
  prescription_status?: PrescriptionStatus;
  prescription_due_date?: string;  // 처방 입력 기한 (탕전일 = decoction_date)
  prescription_requested_at?: string;
  prescription_request_count?: number;

  // 복용법
  dosage_instruction?: string;
  dosage_status?: DosageStatus;

  // 배송 관련
  delivery_method?: DeliveryMethod;
  delivery_date?: string;
  delivery_status?: PackageDeliveryStatus;
  tracking_number?: string;
  delivery_completed_at?: string;
  pickup_notified_at?: string;
  shipping_notified_at?: string;
}

// 탕전 상태
export type DecoctionStatus = 'pending' | 'ready' | 'in_progress' | 'completed';
export const DECOCTION_STATUS_LABELS: Record<DecoctionStatus, string> = {
  pending: '대기',
  ready: '준비완료',
  in_progress: '탕전중',
  completed: '완료',
};

// 처방 상태
export type PrescriptionStatus = 'pending' | 'completed';
export const PRESCRIPTION_STATUS_LABELS: Record<PrescriptionStatus, string> = {
  pending: '미입력',
  completed: '완료',
};

// 복용법 상태
export type DosageStatus = 'pending' | 'completed';
export const DOSAGE_STATUS_LABELS: Record<DosageStatus, string> = {
  pending: '미입력',
  completed: '완료',
};

// 패키지 배송 상태
export type PackageDeliveryStatus = 'pending' | 'ready' | 'shipped' | 'delivered';
export const PACKAGE_DELIVERY_STATUS_LABELS: Record<PackageDeliveryStatus, string> = {
  pending: '대기',
  ready: '준비완료',
  shipped: '배송중',
  delivered: '배송완료',
};

// 한약패키지 회차별 관리 타입
export type DeliveryMethod = 'pickup' | 'local' | 'express';
export type RoundStatus = 'pending' | 'preparing' | 'delivered' | 'completed';

export interface HerbalPackageRound {
  id?: number;
  package_id: number;        // 연결된 HerbalPackage ID
  round_number: number;      // 회차 번호 (1, 2, 3...)
  delivery_method: DeliveryMethod;  // 배송방법: 내원/시내/시외
  scheduled_date?: string;   // 예정일
  delivered_date?: string;   // 배송완료일
  status: RoundStatus;       // 상태: 대기/준비중/배송완료/복용완료
  memo?: string;             // 회차별 메모
  created_at?: string;
  updated_at?: string;
}

// 배송방법 라벨
export const DELIVERY_METHOD_LABELS: Record<DeliveryMethod, string> = {
  pickup: '내원',
  local: '시내',
  express: '시외',
};

// 회차 상태 라벨
export const ROUND_STATUS_LABELS: Record<RoundStatus, string> = {
  pending: '대기',
  preparing: '준비중',
  delivered: '배송완료',
  completed: '복용완료',
};

// 회차 상태 색상
export const ROUND_STATUS_COLORS: Record<RoundStatus, string> = {
  pending: '#9ca3af',
  preparing: '#f59e0b',
  delivered: '#3b82f6',
  completed: '#10b981',
};

// 패키지 타입 라벨
export const PACKAGE_TYPE_LABELS: Record<string, string> = {
  '1month': '1개월',
  '2month': '2개월',
  '3month': '3개월',
  '6month': '6개월',
};

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

// 멤버십 타입 (기간 기반 무제한 사용)
export interface Membership {
  id?: number;
  patient_id: number;
  chart_number: string;
  patient_name: string;
  membership_type: string;   // 경근멤버십 등
  quantity: number;          // 등록 개수 (내원 시 무료 이용 개수, 하루 사용 제한)
  period_months?: number;    // 기간 (개월)
  start_date: string;
  end_date?: string;         // 종료일
  expire_date: string;       // 만료일
  memo?: string;
  mssql_detail_id?: number;  // MSSQL Detail_PK (비급여 항목 연결)
  status: 'active' | 'expired';
  created_at?: string;
  updated_at?: string;
}

// 약침 사용 기록 타입
export interface YakchimUsageRecord {
  id: number;
  patient_id: number;
  source_type: 'membership' | 'package' | 'one-time';  // 멤버십, 패키지, 일회성
  source_id: number;
  source_name: string;                     // 경근멤버십, 통마 등
  usage_date: string;
  item_name: string;                       // 사용된 항목명 (녹용약침 등)
  remaining_after: number;                 // 사용 후 잔여 (패키지만 의미 있음)
  remaining_count?: number;                // 잔여 횟수 (패키지 잔여 표시용)
  total_count?: number;                    // 총 횟수 (패키지 총 횟수 표시용)
  receipt_id?: number;
  mssql_detail_id?: number;                // MSSQL Detail_PK (비급여 항목 연결)
  memo?: string;
  quantity?: number;                       // 사용 갯수
  deduction_points?: number;               // 실제 차감 포인트 (약침 종류별 차감 포인트 합계)
  created_at: string;
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
  mssql_detail_id?: number;  // MSSQL Detail_PK (비급여 항목 연결)
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

// ============================================
// 약침 관리 타입
// ============================================

// 약침 종류
export type YakchimType = 'gyeonggeun' | 'nokryong' | 'taeban' | 'hwata' | 'line';

// 약침 결제 유형
export type YakchimPaymentType = 'onetime' | 'tongma' | 'membership' | 'service';

// 약침 종류 라벨
export const YAKCHIM_TYPE_LABELS: Record<YakchimType, string> = {
  gyeonggeun: '경근',
  nokryong: '녹용',
  taeban: '태반',
  hwata: '화타',
  line: '라인',
};

// 약침 결제 유형 라벨
export const YAKCHIM_PAYMENT_TYPE_LABELS: Record<YakchimPaymentType, string> = {
  onetime: '일회',
  tongma: '통마',
  membership: '멤버십',
  service: '서비스',
};

// 약침 항목명 프리셋 (item_name 선택용)
export const YAKCHIM_ITEM_PRESETS = [
  '경근약침',
  '녹용약침',
  '봉독약침',
  '태반약침',
  '화타약침',
  '비추약침',
  '약침',
] as const;

// 사용방식 라벨
export const SOURCE_TYPE_LABELS: Record<string, string> = {
  'membership': '멤버십',
  'package': '패키지',
  'one-time': '일회성',
};

// 약침 사용 기록 (한 행)
export interface YakchimUsage {
  id?: number;
  patient_id: number;
  chart_number: string;
  patient_name: string;
  receipt_id?: number;           // 연결된 수납 ID (MSSQL)
  usage_date: string;            // 사용일 (YYYY-MM-DD)
  yakchim_type: YakchimType;     // 약침 종류
  amount_cc: number;             // 사용량 (cc)
  payment_type: YakchimPaymentType;  // 결제 유형
  package_id?: number;           // 통마 패키지 ID
  membership_id?: number;        // 멤버십 ID
  service_reason?: string;       // 서비스 사유
  memo?: string;
  created_at?: string;
  updated_at?: string;
}

// 약침 패키지 (통마)
export interface YakchimPackage {
  id?: number;
  patient_id: number;
  chart_number: string;
  patient_name: string;
  yakchim_type: YakchimType;     // 약침 종류
  package_name: string;          // "경근 10회권"
  total_count: number;           // 총 횟수
  used_count: number;            // 사용 횟수
  remaining_count: number;       // 잔여 횟수
  price?: number;                // 구매 금액
  start_date: string;            // 시작일
  expire_date?: string;          // 만료일
  memo?: string;
  status: 'active' | 'completed' | 'expired';
  created_at?: string;
  updated_at?: string;
}

// 약침 패키지 이력
export interface YakchimPackageHistory {
  id?: number;
  package_id: number;
  action: 'purchase' | 'use' | 'adjust';  // 구매/사용/조정
  count_change: number;          // 변동 횟수 (+10, -1 등)
  remaining_after: number;       // 변동 후 잔여
  usage_id?: number;             // 연결된 사용 기록 ID
  memo?: string;
  action_date: string;
  created_at?: string;
}

// 약침 멤버십
export interface YakchimMembership {
  id?: number;
  patient_id: number;
  chart_number: string;
  patient_name: string;
  membership_name: string;       // "약침 무제한 월정액"
  yakchim_types?: YakchimType[]; // 포함된 약침 종류 (null이면 전체)
  start_date: string;
  end_date: string;
  price?: number;                // 월 금액
  memo?: string;
  status: 'active' | 'expired' | 'cancelled';
  created_at?: string;
  updated_at?: string;
}

// ============================================
// 한약 선결제 패키지 관리 타입 (확장)
// ============================================

// 녹용 추가 패키지
export interface NokryongPackage {
  id?: number;
  patient_id: number;
  chart_number?: string;
  patient_name?: string;
  package_name: string;          // "녹용(원대) 30회분"
  nokryong_type?: string;        // 녹용 종류 (베이직, 원대, 프리미엄 등)
  total_doses?: number;          // 총 회분수 (doses)
  used_doses?: number;           // 사용 회분수 (doses)
  total_months: number;          // 총 회분수 (필드명 유지, 의미는 회분)
  remaining_months: number;      // 잔여 회분수
  price?: number;                // 구매 금액
  start_date: string;            // 시작일
  expire_date?: string;          // 만료일
  memo?: string;
  mssql_detail_id?: number;      // MSSQL Detail_PK (비급여 항목 연결)
  status: 'active' | 'completed' | 'expired';
  created_at?: string;
  updated_at?: string;
}

// 한약 수령 기록 (회차별)
export interface HerbalPickup {
  id?: number;
  package_id: number;            // 연결된 HerbalPackage ID
  patient_id: number;
  chart_number?: string;
  patient_name?: string;
  round_id?: number;             // 연결된 HerbalPackageRound ID
  receipt_id?: number;           // 연결된 수납 ID
  mssql_detail_id?: number;      // 연결된 비급여항목 ID
  pickup_date: string;           // 수령일
  round_number: number;          // 회차 번호
  delivery_method: DeliveryMethod;  // 배송방법
  with_nokryong: boolean;        // 녹용 추가 여부
  nokryong_package_id?: number;  // 사용된 녹용 패키지 ID
  memo?: string;
  created_at?: string;
  updated_at?: string;
}

// 한약 패키지 타입별 회차 매핑
export const HERBAL_PACKAGE_ROUNDS: Record<string, number> = {
  '0.5month': 1, // 0.5개월 = 1회 (15일분)
  '1month': 2,   // 1개월 = 2회 (15일분 x 2)
  '2month': 4,   // 2개월 = 4회
  '3month': 6,   // 3개월 = 6회
  '6month': 12,  // 6개월 = 12회
};

// 상비약 사용내역 타입
export interface MedicineUsage {
  id?: number;
  patient_id: number;
  chart_number: string;
  patient_name?: string;
  receipt_id?: number;       // 연결된 수납 ID
  usage_date: string;        // 사용일 (YYYY-MM-DD)
  medicine_name: string;     // 약 이름 (소화제, 진통제, 파스 등)
  quantity: number;          // 수량
  amount?: number;           // 금액
  inventory_id?: number;     // 재고 관리 ID
  purpose?: string;          // 목적 (상비약, 치료약, 감기약, 증정, 보완)
  memo?: string;             // 비고
  mssql_detail_id?: number;  // MSSQL Detail_PK (비급여 항목 연결)
  created_at?: string;
  updated_at?: string;
}

// 상비약 종류 (자주 사용하는 항목)
export const MEDICINE_PRESETS = [
  '소화제',
  '진통제',
  '파스',
  '반창고',
  '소독약',
  '연고',
  '기타',
] as const;

// 수납 메모 (순수 메모 전용)
export interface ReceiptMemo {
  id?: number;
  patient_id: number;
  chart_number: string;
  patient_name: string;
  mssql_receipt_id?: number;
  mssql_detail_id?: number;  // 연결된 비급여 항목 Detail_PK
  receipt_date: string;
  memo?: string;             // 특이사항 메모
  item_name?: string;        // 메모 항목명
  item_type?: string;        // 메모 유형
  created_by?: string;       // 작성자
  memo_type_id?: number;     // 메모 유형 ID
  created_at?: string;
  updated_at?: string;
}

// 수납 상태 (완료/예약 상태 전용)
export interface ReceiptStatus {
  id?: number;
  receipt_id: number;        // mssql_receipt_id
  patient_id: number;
  receipt_date: string;
  is_completed: boolean;
  reservation_status: ReservationStatus;
  reservation_date?: string;
  created_at?: string;
  updated_at?: string;
}

// 수납 기록 필터 타입
export type ReceiptRecordFilter = 'all' | 'completed' | 'incomplete';

// 수납 목록 아이템 (MSSQL + PostgreSQL 병합)
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

  // PostgreSQL 메모 요약
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
  medicineUsages?: MedicineUsage[];
  yakchimUsageRecords?: YakchimUsageRecord[];
}): string {
  const parts: string[] = [];

  // 약침 사용 기록 (멤버십/패키지)
  // 멤버십: "경근멤1" 형식
  // 패키지: "통마[8-1=7]" 형식
  if (data.yakchimUsageRecords && data.yakchimUsageRecords.length > 0) {
    // 같은 source별로 그룹화하여 카운트
    const membershipUsage = new Map<string, number>(); // source_name -> count
    const packageUsage: Array<{ name: string; before: number; used: number; after: number }> = [];

    data.yakchimUsageRecords.forEach(record => {
      if (record.source_type === 'membership') {
        // 멤버십: 사용 횟수 카운트
        const shortName = record.source_name.replace('멤버십', '멤');
        membershipUsage.set(shortName, (membershipUsage.get(shortName) || 0) + 1);
      } else if (record.source_type === 'package') {
        // 패키지: [이전-1=현재] 형식
        const before = record.remaining_after + 1;
        packageUsage.push({
          name: record.source_name,
          before,
          used: 1,
          after: record.remaining_after,
        });
      }
    });

    // 멤버십 출력
    membershipUsage.forEach((count, name) => {
      parts.push(`${name}${count}`);
    });

    // 패키지 출력
    packageUsage.forEach(pkg => {
      parts.push(`${pkg.name}[${pkg.before}-${pkg.used}=${pkg.after}]`);
    });
  }

  // 시술패키지
  data.treatmentPackages?.forEach(pkg => {
    if (pkg.status === 'active') {
      const includesText = pkg.includes ? `(${pkg.includes})` : '';
      parts.push(`${pkg.package_name}[${pkg.total_count}-${pkg.used_count}=${pkg.remaining_count}]${includesText}`);
    } else if (pkg.status === 'completed') {
      parts.push(`${pkg.package_name}[완료]`);
    }
  });

  // 한약패키지 (선결) - 메모로 대체됨

  // 포인트
  if (data.pointUsed && data.pointUsed > 0) {
    parts.push(`포인트-${data.pointUsed.toLocaleString()}`);
  }
  if (data.pointEarned && data.pointEarned > 0) {
    parts.push(`포인트+${data.pointEarned.toLocaleString()}`);
  }

  // 멤버십 (등록 정보 - 사용 기록과 별개)
  if (data.membership && data.membership.status === 'active') {
    const expireDate = data.membership.expire_date.slice(2, 7).replace('-', '/');
    parts.push(`${data.membership.membership_type} ${data.membership.quantity}개 (${expireDate})`);
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

  // 상비약 사용
  data.medicineUsages?.forEach(med => {
    parts.push(`💊${med.medicine_name}(${med.quantity})`);
  });

  return parts.join(', ');
}

// ============================================
// 메모 요약 태그 (클릭 가능한 개별 항목)
// ============================================

export type MemoTagType =
  | 'yakchim-membership'    // 약침 멤버십 사용
  | 'yakchim-package'       // 약침 패키지 사용
  | 'yakchim-onetime'       // 약침 일회성 사용
  | 'treatment-package'     // 시술패키지
  | 'herbal-package'        // 한약패키지 (선결제)
  | 'nokryong-package'      // 녹용패키지 (선결제)
  | 'point-used'            // 포인트 사용
  | 'point-earned'          // 포인트 적립
  | 'membership'            // 멤버십 등록정보
  | 'herbal-dispensing'     // 한약 출납
  | 'gift-dispensing'       // 증정품 출납
  | 'document'              // 서류발급
  | 'medicine';             // 상비약

export interface MemoSummaryItem {
  type: MemoTagType;
  label: string;
  data: unknown;  // 타입별 원본 데이터
}

// 메모 요약 항목 배열 생성 (클릭 가능한 태그용)
export function generateMemoSummaryItems(data: {
  treatmentPackages?: TreatmentPackage[];
  herbalPackages?: HerbalPackage[];
  nokryongPackages?: NokryongPackage[];
  packageUsages?: PackageUsage[];
  herbalPickups?: HerbalPickup[];
  pointUsed?: number;
  pointEarned?: number;
  membership?: Membership;
  herbalDispensings?: HerbalDispensing[];
  giftDispensings?: GiftDispensing[];
  documentIssues?: DocumentIssue[];
  medicineUsages?: MedicineUsage[];
  yakchimUsageRecords?: YakchimUsageRecord[];
  date?: string;  // 오늘 날짜 (YYYY-MM-DD) - 등록일 확인용
}): MemoSummaryItem[] {
  const items: MemoSummaryItem[] = [];

  // 약침 사용 기록 (멤버십/패키지)
  if (data.yakchimUsageRecords && data.yakchimUsageRecords.length > 0) {
    // 멤버십 사용: 같은 source별로 그룹화
    const membershipUsage = new Map<string, { count: number; records: YakchimUsageRecord[] }>();
    const packageUsage: Array<{ name: string; before: number; used: number; after: number; record: YakchimUsageRecord }> = [];

    const onetimeUsage: YakchimUsageRecord[] = [];

    data.yakchimUsageRecords.forEach(record => {
      if (record.source_type === 'membership') {
        const shortName = record.source_name.replace('멤버십', '멤');
        const existing = membershipUsage.get(shortName);
        if (existing) {
          existing.count++;
          existing.records.push(record);
        } else {
          membershipUsage.set(shortName, { count: 1, records: [record] });
        }
      } else if (record.source_type === 'package') {
        const before = record.remaining_after + 1;
        packageUsage.push({
          name: record.source_name,
          before,
          used: 1,
          after: record.remaining_after,
          record,
        });
      } else if (record.source_type === 'one-time') {
        onetimeUsage.push(record);
      }
    });

    // 멤버십 사용 태그
    membershipUsage.forEach((usage, name) => {
      items.push({
        type: 'yakchim-membership',
        label: `${name}${usage.count}`,
        data: usage.records,
      });
    });

    // 패키지 사용 태그
    packageUsage.forEach(pkg => {
      // 통증마일리지는 "통마 사용" 형식으로 표시
      const label = pkg.name.includes('통증마일리지') || pkg.name.includes('통마')
        ? `통마 사용[${pkg.before}-${pkg.used}=${pkg.after}]`
        : `${pkg.name}[${pkg.before}-${pkg.used}=${pkg.after}]`;
      items.push({
        type: 'yakchim-package',
        label,
        data: pkg.record,
      });
    });

    // 일회성 사용 태그
    onetimeUsage.forEach(record => {
      items.push({
        type: 'yakchim-onetime',
        label: record.memo || `${record.item_name} 일회성`,
        data: record,
      });
    });
  }

  // 시술패키지
  data.treatmentPackages?.forEach(pkg => {
    // 통증마일리지는 "통마 추가" 형식으로 표시 (등록일에만)
    const isTongma = pkg.package_name.includes('통증마일리지') || pkg.package_name.includes('통마');
    // 등록일 확인: start_date가 오늘인 경우에만 "통마 추가" 표시
    const isRegisteredToday = data.date && pkg.start_date === data.date;

    if (pkg.status === 'active') {
      if (isTongma) {
        // 통증마일리지: 등록일에만 "통마 추가" 표시
        if (isRegisteredToday) {
          items.push({
            type: 'treatment-package',
            label: `통마 추가[0+${pkg.total_count}=${pkg.total_count}]`,
            data: pkg,
          });
        }
        // 등록일이 아니면 표시하지 않음 (사용 기록은 yakchim_usage_records에서 표시)
      } else {
        // 다른 패키지는 기존 방식
        const includesText = pkg.includes ? `(${pkg.includes})` : '';
        items.push({
          type: 'treatment-package',
          label: `${pkg.package_name}[${pkg.total_count}-${pkg.used_count}=${pkg.remaining_count}]${includesText}`,
          data: pkg,
        });
      }
    } else if (pkg.status === 'completed') {
      items.push({
        type: 'treatment-package',
        label: isTongma ? `통마[완료]` : `${pkg.package_name}[완료]`,
        data: pkg,
      });
    }
  });

  // 한약패키지 (선결제) - 등록일에만 표시
  data.herbalPackages?.forEach(pkg => {
    const isRegisteredToday = data.date && pkg.start_date === data.date;
    if (pkg.status === 'active' && isRegisteredToday) {
      items.push({
        type: 'herbal-package',
        label: `한약 선결제[0+${pkg.total_count}=${pkg.total_count}회]`,
        data: pkg,
      });
    }
  });

  // 녹용패키지 (선결제) - 등록일에만 표시
  data.nokryongPackages?.forEach(pkg => {
    const isRegisteredToday = data.date && pkg.start_date === data.date;
    if (pkg.status === 'active' && isRegisteredToday) {
      items.push({
        type: 'nokryong-package',
        label: `녹용 선결제[0+${pkg.total_months}=${pkg.total_months}회]`,
        data: pkg,
      });
    }
  });

  // 한약 패키지 차감 기록 (herbalPickups 사용)
  if (data.herbalPickups && data.herbalPickups.length > 0) {
    data.herbalPickups.forEach(pickup => {
      // 해당 패키지 찾기
      const pkg = data.herbalPackages?.find(p => p.id === pickup.package_id);
      if (pkg) {
        // 현재 사용횟수에서 이 pickup의 회차로 계산
        const before = pickup.round_number;
        const after = (pkg.total_count || 0) - pickup.round_number;
        items.push({
          type: 'herbal-package',
          label: `한약 선결(${before}-1=${after}회)`,
          data: pickup,
        });

        // 녹용 추가 차감 표시
        if (pickup.with_nokryong && pickup.nokryong_package_id) {
          const nokryongPkg = data.nokryongPackages?.find(p => p.id === pickup.nokryong_package_id);
          if (nokryongPkg) {
            const nokryongRemaining = nokryongPkg.remaining_months || 0;
            const nokryongBefore = nokryongRemaining + 1;
            items.push({
              type: 'nokryong-package',
              label: `녹용 선결(${nokryongBefore}-1=${nokryongRemaining}회)`,
              data: pickup,
            });
          }
        }
      }
    });
  }

  // 녹용 단독 차감 (packageUsages에서)
  if (data.packageUsages && data.packageUsages.length > 0) {
    const nokryongDeductions = data.packageUsages.filter(u => u.package_type === 'nokryong' && u.usage_type === 'deduct');
    nokryongDeductions.forEach(usage => {
      // 해당 패키지 찾기
      const pkg = data.nokryongPackages?.find(p => p.id === usage.package_id);
      if (pkg) {
        const currentRemaining = pkg.remaining_months || 0;
        const before = currentRemaining + Math.abs(usage.count);
        items.push({
          type: 'nokryong-package',
          label: `녹용 선결(${before}-${Math.abs(usage.count)}=${currentRemaining}회)`,
          data: usage,
        });
      }
    });
  }

  // 포인트 사용
  if (data.pointUsed && data.pointUsed > 0) {
    items.push({
      type: 'point-used',
      label: `포인트-${data.pointUsed.toLocaleString()}`,
      data: { amount: data.pointUsed },
    });
  }

  // 포인트 적립
  if (data.pointEarned && data.pointEarned > 0) {
    items.push({
      type: 'point-earned',
      label: `포인트+${data.pointEarned.toLocaleString()}`,
      data: { amount: data.pointEarned },
    });
  }

  // 멤버십 등록정보
  if (data.membership && data.membership.status === 'active') {
    const expireDate = data.membership.expire_date.slice(2, 7).replace('-', '/');
    items.push({
      type: 'membership',
      label: `${data.membership.membership_type} ${data.membership.quantity}개 (${expireDate})`,
      data: data.membership,
    });
  }

  // 한약 출납
  data.herbalDispensings?.forEach(disp => {
    const typeLabel = disp.dispensing_type === 'gift' ? '증정>' : '한약>';
    items.push({
      type: 'herbal-dispensing',
      label: `${typeLabel}${disp.herbal_name}(${disp.quantity})`,
      data: disp,
    });
  });

  // 증정품 출납
  data.giftDispensings?.forEach(disp => {
    const reasonText = disp.reason ? ` ${disp.reason}` : '';
    items.push({
      type: 'gift-dispensing',
      label: `증정>${disp.item_name}(${disp.quantity})${reasonText}`,
      data: disp,
    });
  });

  // 서류발급
  data.documentIssues?.forEach(doc => {
    items.push({
      type: 'document',
      label: `서류>${doc.document_type}${doc.quantity > 1 ? ` ${doc.quantity}매` : ''}`,
      data: doc,
    });
  });

  // 상비약 사용
  data.medicineUsages?.forEach(med => {
    const purposeText = med.purpose ? `-${med.purpose}` : '';
    items.push({
      type: 'medicine',
      label: `${med.medicine_name}(${med.quantity})${purposeText}`,
      data: med,
    });
  });

  return items;
}

// ============================================
// 패키지 사용기록 통합 타입
// ============================================

// 패키지 타입
export type PackageType = 'herbal' | 'nokryong' | 'treatment' | 'membership';

// 사용 타입
export type PackageUsageType = 'add' | 'deduct' | 'apply';

// 패키지 사용기록
export interface PackageUsage {
  id?: number;
  package_type: PackageType;        // 패키지 종류
  package_id: number;               // 해당 패키지 테이블의 ID
  patient_id: number;
  chart_number?: string;
  patient_name?: string;
  usage_date: string;               // 사용일 (YYYY-MM-DD)
  usage_type: PackageUsageType;     // 추가/차감/적용
  count: number;                    // 횟수 (추가: 양수, 차감: 음수)
  mssql_detail_id?: number;         // 연결된 비급여 항목
  mssql_receipt_id?: number;        // 연결된 수납
  memo?: string;
  created_at?: string;
}

// 패키지 카테고리별 라벨
export const PACKAGE_CATEGORY_LABELS: Record<PackageType, string> = {
  herbal: '한약',
  nokryong: '녹용',
  treatment: '통증마일리지',
  membership: '멤버십',
};

// 사용 타입별 라벨
export const USAGE_TYPE_LABELS: Record<PackageUsageType, string> = {
  add: '추가',
  deduct: '차감',
  apply: '적용',
};

// ============================================
// CS 타임라인 타입
// ============================================

// 타임라인 이벤트 유형
export type TimelineEventType =
  | 'herbal_package_add'      // 한약 선결제 등록
  | 'herbal_pickup'           // 한약 수령 (차감)
  | 'nokryong_package_add'    // 녹용 선결제 등록
  | 'nokryong_usage'          // 녹용 사용 (차감)
  | 'treatment_package_add'   // 통마 추가
  | 'treatment_usage'         // 통마 사용
  | 'membership_add'          // 멤버십 등록
  | 'membership_usage'        // 멤버십 사용
  | 'yakchim-membership'      // 약침 멤버십 사용
  | 'yakchim-package'         // 약침 패키지 사용
  | 'yakchim-onetime'         // 약침 일회성 사용
  | 'custom_memo';            // 커스텀 메모

// 타임라인 이벤트 타입별 아이콘
export const TIMELINE_EVENT_ICONS: Record<TimelineEventType, string> = {
  herbal_package_add: '💊',
  herbal_pickup: '💊',
  nokryong_package_add: '🦌',
  nokryong_usage: '🦌',
  treatment_package_add: '💉',
  treatment_usage: '💉',
  membership_add: '🎫',
  membership_usage: '🎫',
  'yakchim-membership': '💉',
  'yakchim-package': '💉',
  'yakchim-onetime': '💉',
  custom_memo: '💬',
};

// 타임라인 이벤트 타입별 라벨
export const TIMELINE_EVENT_LABELS: Record<TimelineEventType, string> = {
  herbal_package_add: '한약 선결제',
  herbal_pickup: '한약 수령',
  nokryong_package_add: '녹용 선결제',
  nokryong_usage: '녹용 사용',
  treatment_package_add: '통마 추가',
  treatment_usage: '통마 사용',
  membership_add: '멤버십 등록',
  membership_usage: '멤버십 사용',
  'yakchim-membership': '약침 멤버십',
  'yakchim-package': '약침 패키지',
  'yakchim-onetime': '약침 일회성',
  custom_memo: '메모',
};

// 타임라인 이벤트
export interface TimelineEvent {
  id: string;                 // 고유 ID (type_sourceId)
  type: TimelineEventType;
  date: string;               // YYYY-MM-DD
  timestamp: string;          // 정렬용 ISO timestamp
  icon: string;
  label: string;              // "한약 선결제 +4회"
  subLabel?: string;          // "잔여 3회" 등 추가 정보
  sourceTable: string;        // 원본 테이블명
  sourceId: number;           // 원본 레코드 ID
  isEditable: boolean;        // 오늘만 true
  isCompleted: boolean;       // 완료 상태
  originalData?: unknown;     // 원본 데이터
}

// 타임라인 수정 이력
export interface TimelineAuditLog {
  id: number;
  source_table: string;
  source_id: number;
  patient_id: number;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  modified_at: string;
  modified_by: string;
  modification_reason: string;
  created_at: string;
}

// 타임라인 조회 결과
export interface TimelineResult {
  events: TimelineEvent[];
  totalCount: number;
  hasMore: boolean;
}

// ============================================
// 설문(Survey) 관련 타입
// ============================================

export type SurveyQuestionType = 'text' | 'single_choice' | 'multiple_choice' | 'scale';

export interface SurveyQuestion {
  id: string;
  question_text: string;
  question_type: SurveyQuestionType;
  options?: string[];
  required: boolean;
  order: number;
}

export interface SurveyTemplate {
  id: number;
  name: string;
  description?: string;
  questions: SurveyQuestion[];
  display_mode: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SurveySession {
  id: number;
  patient_id?: number;
  patient_name?: string;
  chart_number?: string;
  age?: number;
  gender?: string;
  template_id: number;
  template_name?: string;
  doctor_name?: string;
  status: 'waiting' | 'in_progress' | 'completed';
  created_by?: string;
  created_at: string;
  completed_at?: string;
}

export interface SurveyAnswer {
  question_id: string;
  answer: string | string[];
}

export interface SurveyResponse {
  id: number;
  session_id: number;
  template_id: number;
  patient_id?: number;
  answers: SurveyAnswer[];
  submitted_at: string;
}

// ============================================
// 직원 역할 타입 (CRM 모듈 re-export)
// ============================================

export type { StaffRole, PatientNote, PatientNoteType, NoteChannel, NoteStatus } from './types/crm';
export { STAFF_ROLE_LABELS, NOTE_TYPE_LABELS, NOTE_TYPE_ICONS, NOTE_TYPE_COLORS, NOTE_CHANNEL_LABELS, NOTE_CHANNEL_ICONS, NOTE_STATUS_LABELS } from './types/crm';

// === 한약 기록 (Draft) + 탕전 일정 ===

export type DraftStatus = 'draft' | 'scheduled';
export type DraftDeliveryMethod = 'pickup' | 'express' | 'quick' | 'other';

// 4개 분기 (top-level branch)
export type DraftBranchType = '약초진' | '약재진_N차' | '약재진_재결제' | '기타상담';
export const DRAFT_BRANCH_TYPES: { value: DraftBranchType; label: string }[] = [
  { value: '약초진', label: '약초진' },
  { value: '약재진_N차', label: '약재진 (N차상담)' },
  { value: '약재진_재결제', label: '약재진 (재결제)' },
  { value: '기타상담', label: '기타상담' },
];

// 치료 기간 (약초진 - 다중 선택)
export type TreatmentMonth = '1개월' | '3개월' | '6개월' | '1년' | '1년이상';
export const TREATMENT_MONTHS: TreatmentMonth[] = ['1개월', '3개월', '6개월', '1년', '1년이상'];

// 상담 방법 (약재진/기타)
export type ConsultationMethod = '내원' | '전화' | '카톡';
export const CONSULTATION_METHODS: ConsultationMethod[] = ['내원', '전화', '카톡'];

// 녹용 권유 (약초진 - 담당의 권유 상태)
export type NokryongRecommendation = '녹용필수' | '녹용권유' | '녹용배제' | '언급없음';
export const NOKRYONG_RECOMMENDATIONS: NokryongRecommendation[] = ['녹용필수', '녹용권유', '녹용배제', '언급없음'];

// 결제 개월수
export type PaymentMonth = '15일분' | '1개월분' | '2개월분' | '3개월분' | '6개월분' | '결제실패';
export const PAYMENT_MONTHS: PaymentMonth[] = ['15일분', '1개월분', '2개월분', '3개월분', '6개월분', '결제실패'];

// 녹용 등급
export type NokryongGrade = '베이직' | '스탠다드' | '프리미엄' | '스페셜';
export const NOKRYONG_GRADES: NokryongGrade[] = ['베이직', '스탠다드', '프리미엄', '스페셜'];

// 기타상담 세부 유형
export type OtherSubType = '재처방' | '보완처방' | '상비약' | '마무리' | '중간점검' | '단순문의';
export const OTHER_SUB_TYPES: OtherSubType[] = ['재처방', '보완처방', '상비약', '마무리', '중간점검', '단순문의'];

// 내원 패턴
export type DraftVisitPattern = '15일' | '30일';
export const DRAFT_VISIT_PATTERNS: DraftVisitPattern[] = ['15일', '30일'];

// 발송 방법
export const DRAFT_DELIVERY_LABELS: Record<DraftDeliveryMethod, string> = {
  pickup: '내원수령',
  express: '택배',
  quick: '퀵',
  other: '기타',
};

export const DRAFT_STATUS_LABELS: Record<DraftStatus, string> = {
  draft: '초안',
  scheduled: '탕전배정',
};

// 폼 상태 인터페이스
export interface HerbalDraftFormData {
  branch: DraftBranchType | '';
  // 약초진 전용
  treatmentMonths: TreatmentMonth[];
  visitPattern: DraftVisitPattern | '';
  nokryongRecommendation: NokryongRecommendation | '';
  // 약재진/기타 전용
  consultationMethod: ConsultationMethod | '';
  subType: OtherSubType | '';
  // 결제 관련 (약초진 + 약재진_재결제)
  paymentMonth: PaymentMonth | '';
  nokryongGrade: NokryongGrade | '';
  nokryongCount: number;
  // 공통
  deliveryMethod: DraftDeliveryMethod | '';
  decoctionDate: string | undefined;
  shippingDate: string;
  medicationDays: number;
  memo: string;
  // 상비약/보완처방 전용
  medicines: Array<{ inventoryId: number; name: string; quantity: number; currentStock: number; unit: string }>;
}

export const INITIAL_DRAFT_FORM_DATA: HerbalDraftFormData = {
  branch: '',
  treatmentMonths: [],
  visitPattern: '',
  nokryongRecommendation: '',
  consultationMethod: '',
  subType: '',
  paymentMonth: '',
  nokryongGrade: '',
  nokryongCount: 1,
  deliveryMethod: '',
  decoctionDate: undefined,
  shippingDate: '',
  medicationDays: 15,
  memo: '',
  medicines: [],
};

// DB 레코드 인터페이스
export interface JourneyStatus {
  prescription?: boolean;        // 처방전 출력 완료
  compounding?: boolean;         // 조제 완료
  decoction?: boolean;           // 탕전 완료
  shipping?: 'pending' | 'shipping' | 'delivered'; // 배송 상태
  medication_start?: string;     // 복약 시작일 (YYYY-MM-DD)
  medication_days?: number;      // 총 복약 일수
  medication_paused?: boolean;   // 복약 정지
  medication_paused_at?: string; // 정지 시점
  // legacy
  dosage?: boolean;
  preparation?: boolean;
  received?: boolean;
}

export const JOURNEY_STEPS: { key: string; label: string }[] = [
  { key: 'prescription', label: '처방' },
  { key: 'compounding', label: '조제' },
  { key: 'decoction', label: '탕전' },
  { key: 'shipping', label: '배송' },
  { key: 'medication', label: '복약' },
];

export interface HerbalDraft {
  id?: number;
  patient_id: number;
  chart_number?: string;
  patient_name?: string;
  herbal_name?: string;
  // 분기 타입
  consultation_type?: string;
  // 약초진 전용
  treatment_months?: string;
  visit_pattern?: string;
  nokryong_type?: string;
  // 약재진/기타 전용
  consultation_method?: string;
  sub_type?: string;
  // 결제 관련
  payment_type?: string;
  nokryong_grade?: string;
  nokryong_count?: number;
  // 공통
  delivery_method?: string;
  decoction_date?: string;
  shipping_date?: string;
  memo?: string;
  medicine_items?: string;
  receipt_date?: string;
  doctor?: string;
  journey_status?: JourneyStatus;
  herbal_package_id?: number;
  nokryong_package_id?: number;
  status: DraftStatus;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

export interface StaffScheduleEntry {
  id?: number;
  schedule_date: string;
  staff_count: number;
  is_holiday: boolean;
  memo?: string;
  created_at?: string;
  updated_at?: string;
}

export interface DecoctionDayCapacity {
  date: string;
  staffCount: number;
  isHoliday: boolean;
  isWeekend: boolean;
  maxCapacity: number;
  usedCapacity: number;
  remainingCapacity: number;
}

// ============================================
// 탕전 주문 관리 타입
// ============================================

export type DecoctionOrderStatus = 'pending' | 'compounding' | 'decocting' | 'packaging' | 'done' | 'cancelled';

export const DECOCTION_ORDER_STATUS_LABELS: Record<DecoctionOrderStatus, string> = {
  pending: '대기',
  compounding: '조제중',
  decocting: '탕전중',
  packaging: '포장중',
  done: '완료',
  cancelled: '취소',
};

export const DECOCTION_ORDER_STATUS_COLORS: Record<DecoctionOrderStatus, string> = {
  pending: '#eab308',
  compounding: '#3b82f6',
  decocting: '#ec4899',
  packaging: '#8b5cf6',
  done: '#10b981',
  cancelled: '#9ca3af',
};

export interface DecoctionOrder {
  id?: string;
  herbal_draft_id?: string | null;
  patient_id: string;
  patient_name: string;
  status: DecoctionOrderStatus;
  scheduled_date: string;       // YYYY-MM-DD
  scheduled_slot: string;       // e.g. '09:00'
  recipe_name?: string;
  delivery_method?: string;
  assigned_to?: string;
  notes?: string;
  color?: string | null;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}
