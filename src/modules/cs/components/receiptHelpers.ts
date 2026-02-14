import type { ReceiptHistoryItem } from '../../manage/lib/api';
import type {
  TreatmentPackage,
  HerbalPackage,
  HerbalPickup,
  NokryongPackage,
  Membership,
  HerbalDispensing,
  GiftDispensing,
  DocumentIssue,
  MedicineUsage,
  YakchimUsageRecord,
  ReceiptMemo,
  ReceiptStatus,
  MemoSummaryItem,
} from '../types';
import type { Reservation } from '../../reservation/types';
import { searchLocalPatients, type LocalPatient } from '../lib/patientSync';

const MSSQL_API_BASE = import.meta.env.VITE_MSSQL_API_URL || 'http://192.168.0.173:3100';

// 환자 검색 결과 타입
export interface PatientSearchResult {
  id: number;
  chart_no: string;
  name: string;
  birth: string | null;
  sex: 'M' | 'F';
  phone: string | null;
  last_visit: string | null;
}

// 현장예약율 타입
export interface OnsiteReservationStats {
  total_chim_patients: number;  // 총 침환자
  reserved_count: number;       // 예약 환자
  reservation_rate: number;     // 사전예약율
  onsite_count: number;         // 현장예약
  onsite_rate: number;          // 현장예약율
}

// 비급여 항목 타입 (uncoveredItems용)
export interface UncoveredItem {
  id: number;           // Detail_PK
  name: string;
  amount: number;
}

// 확장된 수납 아이템 (MSSQL + PostgreSQL 데이터)
export interface ExpandedReceiptItem extends ReceiptHistoryItem {
  // PostgreSQL 데이터
  treatmentPackages: TreatmentPackage[];
  herbalPackages: HerbalPackage[];
  herbalPickups: HerbalPickup[];
  nokryongPackages: NokryongPackage[];
  pointBalance: number;
  todayPointUsed: number;
  todayPointEarned: number;
  activeMembership: Membership | null;
  memberships: Membership[];  // 멤버십 배열 (activeMembership과 별개로 사용)
  herbalDispensings: HerbalDispensing[];
  giftDispensings: GiftDispensing[];
  documentIssues: DocumentIssue[];
  medicineUsages: MedicineUsage[];
  yakchimUsageRecords: YakchimUsageRecord[];
  receiptMemos: ReceiptMemo[];
  receiptStatus?: ReceiptStatus;     // 수납 상태 (완료/예약)
  uncoveredItems?: UncoveredItem[];  // 비급여 항목 배열 (메모 연결용)
  // 다음 예약 정보
  nextReservation: Reservation | null;
  // UI 상태
  isExpanded: boolean;
  isLoading: boolean;
  memoItems: MemoSummaryItem[];  // 클릭 가능한 메모 태그 배열
  // 기록 완료 여부
  isCompleted: boolean;
  // 빠른 메모 버튼 상태
  hasYakchimMemo: boolean;
  hasHerbalMemo: boolean;
  hasMedicineMemo: boolean;
  hasGongjindanMemo: boolean;
  hasGyeongokgoMemo: boolean;
  hasDietMemo: boolean;
  // 빠른 메모 요약 (버튼에 표시)
  yakchimMemoSummary?: string;
  herbalMemoSummary?: string;
  medicineMemoSummary?: string;
  gongjindanMemoSummary?: string;
  gyeongokgoMemoSummary?: string;
  dietMemoSummary?: string;
}

// 진료 항목 분류
export interface TreatmentSummary {
  consultType: string | null;  // 초진/재진
  coveredItems: string[];      // 급여 항목들
  yakchim: { name: string; amount: number }[];  // 약침
  sangbiyak: number;           // 상비약 금액
}

// 환자 검색 API
export const searchPatients = async (query: string): Promise<PatientSearchResult[]> => {
  // MSSQL과 로컬 환자를 동시에 검색
  const [mssqlResults, localResults] = await Promise.all([
    // MSSQL 검색
    (async () => {
      try {
        const res = await fetch(`${MSSQL_API_BASE}/api/patients/search?q=${encodeURIComponent(query)}&limit=10`);
        if (!res.ok) return [];
        const data = await res.json();
        if (data.error) return [];
        return data as PatientSearchResult[];
      } catch {
        return [];
      }
    })(),
    // 로컬 환자 검색
    (async () => {
      try {
        const locals = await searchLocalPatients(query, 10);
        // LocalPatient를 PatientSearchResult 형식으로 변환
        return locals.map((p: LocalPatient): PatientSearchResult => ({
          id: p.id,
          chart_no: p.chart_number || '',
          name: p.name,
          birth: p.birth_date,
          sex: p.gender === '남' ? 'M' : p.gender === '여' ? 'F' : 'M',
          phone: p.phone,
          last_visit: p.last_visit_date,
        }));
      } catch {
        return [];
      }
    })(),
  ]);

  // 결과 병합 (로컬 환자를 먼저 표시)
  const combined = [...localResults, ...mssqlResults];

  // 중복 제거 (chart_no 기준)
  const seen = new Set<string>();
  return combined.filter(p => {
    if (seen.has(p.chart_no)) return false;
    seen.add(p.chart_no);
    return true;
  });
};

// 현장예약율 조회
export const fetchOnsiteReservationRate = async (date: string): Promise<OnsiteReservationStats | null> => {
  try {
    const res = await fetch(`${MSSQL_API_BASE}/api/stats/all?period=daily&date=${date}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.error || !data.total_stats?.reservations) return null;
    return data.total_stats.reservations;
  } catch {
    return null;
  }
};

// 금액 포맷
export const formatMoney = (amount?: number | null): string => {
  if (amount === undefined || amount === null || amount === 0) return '-';
  return Math.floor(amount).toLocaleString();
};

// 시간 포맷 (HH:MM)
export const formatTime = (receiptTime?: string | null): string => {
  if (!receiptTime) return '-';
  // "2024-12-24 10:30:00" 또는 "2024-12-24T10:30:00" 형식에서 HH:MM 추출
  const match = receiptTime.match(/(\d{2}):(\d{2})/);
  return match ? `${match[1]}:${match[2]}` : '-';
};

// 날짜 포맷 (MM/DD(요일))
export const formatDateWithDay = (dateStr: string): string => {
  const d = new Date(dateStr);
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  return `${d.getMonth() + 1}/${d.getDate()}(${dayNames[d.getDay()]})`;
};

// 수납 방식 아이콘
export const getPaymentMethodIcons = (receipt: ReceiptHistoryItem) => {
  const methods: { icon: string; color: string; label: string }[] = [];
  if (receipt.card > 0) methods.push({ icon: 'fa-credit-card', color: 'text-gray-400', label: '카드' });
  if (receipt.cash > 0) methods.push({ icon: 'fa-money-bill', color: 'text-green-600', label: '현금' });
  if (receipt.transfer > 0) methods.push({ icon: 'fa-building-columns', color: 'text-blue-600', label: '이체' });
  return methods;
};

// 담당의 축약 (김원장 -> 김, 이승호 -> 이)
export const getDoctorShortName = (receipt: ReceiptHistoryItem): string => {
  // treatments에서 첫 번째 의사 이름 가져오기
  const doctorName = receipt.treatments?.[0]?.doctor;
  if (!doctorName || doctorName === 'DOCTOR') return '-';
  // "원장" 제거 후 첫 글자 반환
  const cleaned = doctorName.replace(/원장$/g, '');
  return cleaned.charAt(0) || '-';
};

// 종별 간소화 (건보(직장), 건보(지역) -> 건보, 산정특례 -> 산특)
export const formatInsuranceType = (type: string): string => {
  if (type.startsWith('건보')) return '건보';
  if (type === '산정특례') return '산특';
  return type;
};

// 종별 색상 클래스
export const getInsuranceTypeClass = (type: string): string => {
  if (type.startsWith('건보')) return 'type-gunbo';
  if (type.startsWith('자보') || type.includes('자보')) return 'type-jabo';
  return '';
};

// 진료명 간소화 매핑
export const TREATMENT_NAME_MAP: Record<string, string> = {
  '진찰료(초진)': '초진',
  '진찰료(재진)': '재진',
  '경혈이체': '이체',
  '투자침술': '투자',
  '척추침술': '척추',
  '복강침술': '복강',
  '관절침술': '관절',
  '침전기자극술': '전침',
  '기기구술': '기기구',
  '유관법': '유관',
  '자락관법': '습부',
  '자락관법이체': '습부이체',
  '경피적외선조사': '적외선',
};

// 진료 항목 요약
export const summarizeTreatments = (treatments: { name: string; amount: number; is_covered: boolean }[]): TreatmentSummary => {
  const result: TreatmentSummary = {
    consultType: null,
    coveredItems: [],
    yakchim: [],
    sangbiyak: 0,
  };

  for (const t of treatments) {
    const name = t.name;

    // 진찰료 (초진/재진)
    if (name.includes('진찰료')) {
      if (name.includes('초진')) result.consultType = '초진';
      else if (name.includes('재진')) result.consultType = '재진';
      continue;
    }

    // 약침 (비급여)
    if (name.includes('약침')) {
      const yakchimName = name.replace('약침', '').trim() || name;
      result.yakchim.push({ name: yakchimName, amount: t.amount });
      continue;
    }

    // 상비약
    if (name.includes('상비약') || name.includes('상비')) {
      result.sangbiyak += t.amount;
      continue;
    }

    // 급여 항목 간소화
    if (t.is_covered) {
      const shortName = TREATMENT_NAME_MAP[name];
      if (shortName && !result.coveredItems.includes(shortName)) {
        result.coveredItems.push(shortName);
      }
    }
  }

  return result;
};
