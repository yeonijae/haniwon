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
  herbal_name: string;        // 약명 (시함마농, 궁귀교애탕 등)
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
  quantity: number;          // 등록 개수 (내원 시 무료 이용 개수)
  start_date: string;
  expire_date: string;       // 만료일
  memo?: string;
  status: 'active' | 'expired';
  created_at?: string;
  updated_at?: string;
}

// 약침 사용 기록 타입
export interface YakchimUsageRecord {
  id: number;
  patient_id: number;
  source_type: 'membership' | 'package';  // 멤버십 or 패키지
  source_id: number;
  source_name: string;                     // 경근멤버십, 통마 등
  usage_date: string;
  item_name: string;                       // 사용된 항목명 (녹용약침 등)
  remaining_after: number;                 // 사용 후 잔여 (패키지만 의미 있음)
  receipt_id?: number;
  memo?: string;
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
  chart_number: string;
  patient_name: string;
  package_name: string;          // "녹용 2개월권"
  total_months: number;          // 총 개월수
  remaining_months: number;      // 잔여 개월수
  price?: number;                // 구매 금액
  start_date: string;            // 시작일
  expire_date?: string;          // 만료일
  memo?: string;
  status: 'active' | 'completed' | 'expired';
  created_at?: string;
  updated_at?: string;
}

// 한약 수령 기록 (회차별)
export interface HerbalPickup {
  id?: number;
  package_id: number;            // 연결된 HerbalPackage ID
  patient_id: number;
  chart_number: string;
  patient_name: string;
  round_id?: number;             // 연결된 HerbalPackageRound ID
  receipt_id?: number;           // 연결된 수납 ID
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
  inventory_id?: number;     // 재고 관리 ID
  purpose?: string;          // 목적 (상비약, 치료약, 감기약, 증정, 보완)
  memo?: string;             // 비고
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
  is_completed?: boolean;    // 기록 완료 여부
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
  | 'herbal-package'        // 한약패키지 (선결)
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
  pointUsed?: number;
  pointEarned?: number;
  membership?: Membership;
  herbalDispensings?: HerbalDispensing[];
  giftDispensings?: GiftDispensing[];
  documentIssues?: DocumentIssue[];
  medicineUsages?: MedicineUsage[];
  yakchimUsageRecords?: YakchimUsageRecord[];
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
      items.push({
        type: 'yakchim-package',
        label: `${pkg.name}[${pkg.before}-${pkg.used}=${pkg.after}]`,
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
    if (pkg.status === 'active') {
      const includesText = pkg.includes ? `(${pkg.includes})` : '';
      items.push({
        type: 'treatment-package',
        label: `${pkg.package_name}[${pkg.total_count}-${pkg.used_count}=${pkg.remaining_count}]${includesText}`,
        data: pkg,
      });
    } else if (pkg.status === 'completed') {
      items.push({
        type: 'treatment-package',
        label: `${pkg.package_name}[완료]`,
        data: pkg,
      });
    }
  });

  // 한약패키지 (선결)
  data.herbalPackages?.forEach(pkg => {
    if (pkg.status === 'active') {
      items.push({
        type: 'herbal-package',
        label: `선결(${pkg.total_count}-${pkg.used_count})`,
        data: pkg,
      });
    }
  });

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
    items.push({
      type: 'medicine',
      label: `${med.medicine_name}(${med.quantity})`,
      data: med,
    });
  });

  return items;
}
