import React, { useState, useEffect, useCallback } from 'react';
import type { PortalUser } from '@shared/types';
import {
  ensureReceiptTables,
  getPatientMemoData,
  getPatientsMemoDataBatch,
  upsertReceiptMemo,
  useTreatmentPackage,
  earnPoints,
  usePoints,
  toggleReceiptCompleted,
  getCompletedReceiptIds,
} from '../lib/api';
import {
  type TreatmentPackage,
  type HerbalPackage,
  type Membership,
  type HerbalDispensing,
  type GiftDispensing,
  type DocumentIssue,
  type MedicineUsage,
  type ReceiptMemo,
  type ReservationStatus,
  type ReceiptRecordFilter,
  RESERVATION_STATUS_LABELS,
  generateMemoSummary,
} from '../types';
import { ReservationStep1Modal, type ReservationDraft, type InitialPatient } from '../../reservation/components/ReservationStep1Modal';
import { QuickReservationModal } from './QuickReservationModal';
import { PatientReceiptHistoryModal } from './PatientReceiptHistoryModal';
import { PackageAddModal } from './PackageAddModal';
import { MembershipAddModal } from './MembershipAddModal';
import { DispensingAddModal } from './DispensingAddModal';
import { fetchDoctors, fetchReservationsByDateRange } from '../../reservation/lib/api';
import type { Doctor, Reservation } from '../../reservation/types';
// manage 모듈의 API 사용
import { fetchReceiptHistory, type ReceiptHistoryItem } from '../../manage/lib/api';
import { ReceiptMemoModal } from './ReceiptMemoModal';
import { ReceiptDetailModal } from './ReceiptDetailModal';
import YakchimModal from './YakchimModal';
import HerbalModal from './HerbalModal';
import { MedicineModal } from './MedicineModal';

const MSSQL_API_BASE = import.meta.env.VITE_MSSQL_API_URL || 'http://192.168.0.173:3100';

// 환자 검색 결과 타입
interface PatientSearchResult {
  id: number;
  chart_no: string;
  name: string;
  birth: string | null;
  sex: 'M' | 'F';
  phone: string | null;
  last_visit: string | null;
}

// 환자 검색 API
const searchPatients = async (query: string): Promise<PatientSearchResult[]> => {
  try {
    const res = await fetch(`${MSSQL_API_BASE}/api/patients/search?q=${encodeURIComponent(query)}&limit=10`);
    if (!res.ok) return [];
    const data = await res.json();
    if (data.error) return [];
    return data;
  } catch {
    return [];
  }
};

// 현장예약율 타입
interface OnsiteReservationStats {
  total_chim_patients: number;  // 총 침환자
  reserved_count: number;       // 예약 환자
  reservation_rate: number;     // 사전예약율
  onsite_count: number;         // 현장예약
  onsite_rate: number;          // 현장예약율
}

// 현장예약율 조회
const fetchOnsiteReservationRate = async (date: string): Promise<OnsiteReservationStats | null> => {
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

interface ReceiptViewProps {
  user: PortalUser;
}

// 현재 근무 중인 의사인지 확인
const isActiveDoctor = (doc: Doctor): boolean => {
  // 기타(DOCTOR) 제외
  if (doc.isOther || doc.name === 'DOCTOR') return false;

  // 퇴사자 제외
  if (doc.resigned) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 입사일이 오늘 이후면 제외
  if (doc.workStartDate) {
    const startDate = new Date(doc.workStartDate);
    if (startDate > today) return false;
  }

  // 퇴사일이 오늘 이전이면 제외
  if (doc.workEndDate) {
    const endDate = new Date(doc.workEndDate);
    if (endDate < today) return false;
  }

  return true;
};

// 확장된 수납 아이템 (MSSQL + SQLite 데이터)
interface ExpandedReceiptItem extends ReceiptHistoryItem {
  // SQLite 데이터
  treatmentPackages: TreatmentPackage[];
  herbalPackages: HerbalPackage[];
  pointBalance: number;
  todayPointUsed: number;
  todayPointEarned: number;
  activeMembership: Membership | null;
  herbalDispensings: HerbalDispensing[];
  giftDispensings: GiftDispensing[];
  documentIssues: DocumentIssue[];
  medicineUsages: MedicineUsage[];
  receiptMemo: ReceiptMemo | null;
  // 다음 예약 정보
  nextReservation: Reservation | null;
  // UI 상태
  isExpanded: boolean;
  isLoading: boolean;
  memoSummary: string;
  // 기록 완료 여부
  isCompleted: boolean;
  // 빠른 메모 버튼 상태
  hasYakchimMemo: boolean;
  hasHerbalMemo: boolean;
  hasMedicineMemo: boolean;
  hasGongjindanMemo: boolean;
  hasGyeongokgoMemo: boolean;
  hasDietMemo: boolean;
}

// 금액 포맷
const formatMoney = (amount?: number | null): string => {
  if (amount === undefined || amount === null || amount === 0) return '-';
  return Math.floor(amount).toLocaleString();
};

// 시간 포맷 (HH:MM)
const formatTime = (receiptTime?: string | null): string => {
  if (!receiptTime) return '-';
  // "2024-12-24 10:30:00" 또는 "2024-12-24T10:30:00" 형식에서 HH:MM 추출
  const match = receiptTime.match(/(\d{2}):(\d{2})/);
  return match ? `${match[1]}:${match[2]}` : '-';
};

// 수납 방식 아이콘
const getPaymentMethodIcons = (receipt: ReceiptHistoryItem) => {
  const methods: { icon: string; color: string; label: string }[] = [];
  if (receipt.card > 0) methods.push({ icon: 'fa-credit-card', color: 'text-gray-400', label: '카드' });
  if (receipt.cash > 0) methods.push({ icon: 'fa-money-bill', color: 'text-green-600', label: '현금' });
  if (receipt.transfer > 0) methods.push({ icon: 'fa-building-columns', color: 'text-blue-600', label: '이체' });
  return methods;
};

// 담당의 축약 (김원장 -> 김, 이승호 -> 이)
const getDoctorShortName = (receipt: ReceiptHistoryItem): string => {
  // treatments에서 첫 번째 의사 이름 가져오기
  const doctorName = receipt.treatments?.[0]?.doctor;
  if (!doctorName || doctorName === 'DOCTOR') return '-';
  // "원장" 제거 후 첫 글자 반환
  const cleaned = doctorName.replace(/원장$/g, '');
  return cleaned.charAt(0) || '-';
};

// 종별 간소화 (건보(직장), 건보(지역) -> 건보, 산정특례 -> 산특)
const formatInsuranceType = (type: string): string => {
  if (type.startsWith('건보')) return '건보';
  if (type === '산정특례') return '산특';
  return type;
};

// 종별 색상 클래스
const getInsuranceTypeClass = (type: string): string => {
  if (type.startsWith('건보')) return 'type-gunbo';
  if (type.startsWith('자보') || type.includes('자보')) return 'type-jabo';
  return '';
};

// 진료명 간소화 매핑
const TREATMENT_NAME_MAP: Record<string, string> = {
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

// 진료 항목 분류
interface TreatmentSummary {
  consultType: string | null;  // 초진/재진
  coveredItems: string[];      // 급여 항목들
  yakchim: { name: string; amount: number }[];  // 약침
  sangbiyak: number;           // 상비약 금액
}

const summarizeTreatments = (treatments: { name: string; amount: number; is_covered: boolean }[]): TreatmentSummary => {
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

function ReceiptView({ user }: ReceiptViewProps) {
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [receipts, setReceipts] = useState<ExpandedReceiptItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recordFilter, setRecordFilter] = useState<ReceiptRecordFilter>('incomplete');
  const [completedIds, setCompletedIds] = useState<Set<number>>(new Set());
  const [onsiteStats, setOnsiteStats] = useState<OnsiteReservationStats | null>(null);

  // 예약 모달 상태
  const [showReservationModal, setShowReservationModal] = useState(false);
  const [selectedPatientForReservation, setSelectedPatientForReservation] = useState<InitialPatient | null>(null);
  const [doctors, setDoctors] = useState<Doctor[]>([]);

  // 빠른 예약 모달 상태
  const [showQuickReservationModal, setShowQuickReservationModal] = useState(false);
  const [quickReservationPatient, setQuickReservationPatient] = useState<{
    patientId: number;
    patientName: string;
    chartNo: string;
    defaultDoctor?: string;
    // 1단계에서 선택한 정보
    selectedItems?: string[];
    requiredSlots?: number;
    memo?: string;
  } | null>(null);

  // 환자 수납이력 모달 상태
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyPatient, setHistoryPatient] = useState<{
    patientId: number;
    patientName: string;
    chartNo: string;
  } | null>(null);

  // 환자 검색 상태
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<PatientSearchResult[]>([]);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  // 수납 메모 모달 상태
  const [showMemoModal, setShowMemoModal] = useState(false);
  const [memoModalReceipt, setMemoModalReceipt] = useState<ExpandedReceiptItem | null>(null);

  // 약침 모달 상태
  const [showYakchimModal, setShowYakchimModal] = useState(false);
  const [yakchimModalReceipt, setYakchimModalReceipt] = useState<ExpandedReceiptItem | null>(null);
  const [yakchimPendingItems, setYakchimPendingItems] = useState<{ name: string; amount: number }[]>([]);

  // 한약 모달 상태
  const [showHerbalModal, setShowHerbalModal] = useState(false);
  const [herbalModalReceipt, setHerbalModalReceipt] = useState<ExpandedReceiptItem | null>(null);

  // 진료상세 모달 상태
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailModalReceipt, setDetailModalReceipt] = useState<ExpandedReceiptItem | null>(null);

  // 상비약 모달 상태
  const [medicineModalReceipt, setMedicineModalReceipt] = useState<ExpandedReceiptItem | null>(null);

  // 디바운스 검색
  useEffect(() => {
    if (searchTerm.length < 2) {
      setSearchResults([]);
      setShowSearchDropdown(false);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(async () => {
      const results = await searchPatients(searchTerm);
      setSearchResults(results);
      setShowSearchDropdown(true);
      setIsSearching(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // 검색 결과 클릭 → 수납이력 모달 열기
  const handleSearchResultClick = (patient: PatientSearchResult) => {
    setHistoryPatient({
      patientId: patient.id,
      patientName: patient.name,
      chartNo: patient.chart_no,
    });
    setShowHistoryModal(true);
    setShowSearchDropdown(false);
    setSearchTerm('');
  };

  // 검색 드롭다운 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.receipt-search-container')) {
        setShowSearchDropdown(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // 환자 클릭 시 이력 모달 열기
  const handlePatientClick = (receipt: ExpandedReceiptItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setHistoryPatient({
      patientId: receipt.patient_id,
      patientName: receipt.patient_name,
      chartNo: receipt.chart_no,
    });
    setShowHistoryModal(true);
  };

  // 테이블 초기화
  useEffect(() => {
    ensureReceiptTables();
    loadDoctors();
  }, []);

  // 의사 목록 로드 (현재 근무 중인 원장만)
  const loadDoctors = async () => {
    try {
      const allDocs = await fetchDoctors();
      const activeDocs = allDocs.filter(isActiveDoctor);
      setDoctors(activeDocs);
    } catch (err) {
      console.error('의사 목록 로드 실패:', err);
    }
  };

  // MSSQL 수납 내역 로드 (manage 모듈 API 사용)
  const loadReceipts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // 완료된 수납 ID 목록 조회 + 현장예약율 조회 병렬 처리
      const [completedReceiptIds, onsiteData] = await Promise.all([
        getCompletedReceiptIds(selectedDate),
        fetchOnsiteReservationRate(selectedDate)
      ]);
      setCompletedIds(completedReceiptIds);
      setOnsiteStats(onsiteData);

      const response = await fetchReceiptHistory(selectedDate);
      const mssqlReceipts = response.receipts || [];

      // 각 수납 항목에 기본 UI 상태 추가
      const expandedReceipts: ExpandedReceiptItem[] = mssqlReceipts.map(r => ({
        ...r,
        treatmentPackages: [],
        herbalPackages: [],
        pointBalance: 0,
        todayPointUsed: 0,
        todayPointEarned: 0,
        activeMembership: null,
        herbalDispensings: [],
        giftDispensings: [],
        documentIssues: [],
        medicineUsages: [],
        receiptMemo: null,
        nextReservation: null,
        isExpanded: false,
        isLoading: false,
        memoSummary: '',
        isCompleted: completedReceiptIds.has(r.id),
        hasYakchimMemo: false,
        hasHerbalMemo: false,
        hasMedicineMemo: false,
        hasGongjindanMemo: false,
        hasGyeongokgoMemo: false,
        hasDietMemo: false,
      }));

      setReceipts(expandedReceipts);

      // 각 환자의 메모 요약 + 다음 예약 로드
      await loadAllPatientData(expandedReceipts);
    } catch (err) {
      console.error('수납 내역 로드 실패:', err);
      setError('수납 내역을 불러오는데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedDate]);

  // 다음 예약 찾기 헬퍼 (오늘 이후만, 오늘은 이미 내원했으므로 제외)
  const getNextReservation = (reservations: Reservation[]): Reservation | null => {
    const today = new Date().toISOString().split('T')[0];
    const futureReservations = reservations
      .filter(r => !r.canceled && r.date > today)
      .sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return a.time.localeCompare(b.time);
      });
    return futureReservations[0] || null;
  };

  // 모든 환자의 메모 요약 + 다음 예약 로드
  const loadAllPatientData = async (items: ExpandedReceiptItem[]) => {
    // 1. 오늘부터 60일 후까지의 모든 예약을 한 번에 조회
    const today = new Date().toISOString().split('T')[0];
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 60);
    const endDate = futureDate.toISOString().split('T')[0];

    let allReservations: Reservation[] = [];
    try {
      allReservations = await fetchReservationsByDateRange(today, endDate);
    } catch (err) {
      console.error('예약 조회 실패:', err);
    }

    // 2. 환자별로 예약 그룹화
    const reservationsByPatient = new Map<number, Reservation[]>();
    allReservations.forEach(r => {
      if (!r.canceled) {
        const patientId = r.patientId;
        if (!reservationsByPatient.has(patientId)) {
          reservationsByPatient.set(patientId, []);
        }
        reservationsByPatient.get(patientId)!.push(r);
      }
    });

    // 3. 배치 쿼리로 모든 환자의 메모 데이터 한 번에 조회 (최적화)
    const patientIds = items.map(item => item.patient_id);
    let memoDataMap = new Map<number, any>();

    try {
      memoDataMap = await getPatientsMemoDataBatch(patientIds, selectedDate);
    } catch (err) {
      console.error('배치 메모 데이터 조회 실패:', err);
    }

    // 4. 각 환자의 메모 요약 + 다음 예약 매핑
    const updates = items.map((item) => {
      const data = memoDataMap.get(item.patient_id);

      if (data) {
        const summary = generateMemoSummary({
          treatmentPackages: data.treatmentPackages,
          herbalPackages: data.herbalPackages,
          pointUsed: data.todayPointUsed,
          pointEarned: data.todayPointEarned,
          membership: data.membership || undefined,
          herbalDispensings: data.herbalDispensings,
          giftDispensings: data.giftDispensings,
          documentIssues: data.documentIssues,
          medicineUsages: data.medicineUsages,
          yakchimUsageRecords: data.yakchimUsageRecords,
        });

        // 해당 환자의 다음 예약 찾기
        const patientReservations = reservationsByPatient.get(item.patient_id) || [];
        const nextReservation = getNextReservation(patientReservations);

        // 빠른 메모 버튼 상태 체크
        const hasYakchimMemo = data.treatmentPackages?.some((p: any) =>
          p.package_name?.includes('약침')
        ) || false;
        const hasHerbalMemo = (data.herbalPackages?.length > 0) ||
          (data.herbalDispensings?.length > 0);
        const hasMedicineMemo = (data.medicineUsages?.length > 0);
        const hasGongjindanMemo = data.herbalPackages?.some((p: any) =>
          p.package_name?.includes('공진단')
        ) || data.herbalDispensings?.some((d: any) =>
          d.name?.includes('공진단')
        ) || false;
        const hasGyeongokgoMemo = data.herbalPackages?.some((p: any) =>
          p.package_name?.includes('경옥고')
        ) || data.herbalDispensings?.some((d: any) =>
          d.name?.includes('경옥고')
        ) || false;
        const hasDietMemo = data.herbalPackages?.some((p: any) =>
          p.package_name?.includes('린') || p.package_name?.includes('체감탕')
        ) || data.herbalDispensings?.some((d: any) =>
          d.name?.includes('린') || d.name?.includes('체감탕')
        ) || false;

        return {
          patient_id: item.patient_id,
          memoSummary: summary,
          reservationStatus: data.memo?.reservation_status || 'none',
          reservationDate: data.memo?.reservation_date,
          nextReservation,
          hasYakchimMemo,
          hasHerbalMemo,
          hasMedicineMemo,
          hasGongjindanMemo,
          hasGyeongokgoMemo,
          hasDietMemo,
        };
      } else {
        // 메모 데이터 없음
        const patientReservations = reservationsByPatient.get(item.patient_id) || [];
        const nextReservation = getNextReservation(patientReservations);

        return {
          patient_id: item.patient_id,
          memoSummary: '',
          reservationStatus: 'none' as ReservationStatus,
          nextReservation,
          hasYakchimMemo: false,
          hasHerbalMemo: false,
          hasMedicineMemo: false,
          hasGongjindanMemo: false,
          hasGyeongokgoMemo: false,
          hasDietMemo: false,
        };
      }
    });

    setReceipts(prev => prev.map(item => {
      const update = updates.find(u => u.patient_id === item.patient_id);
      if (update) {
        return {
          ...item,
          memoSummary: update.memoSummary,
          nextReservation: update.nextReservation,
          receiptMemo: {
            ...(item.receiptMemo || {}),
            reservation_status: update.reservationStatus as ReservationStatus,
            reservation_date: update.reservationDate,
          } as ReceiptMemo,
          hasYakchimMemo: update.hasYakchimMemo,
          hasHerbalMemo: update.hasHerbalMemo,
          hasMedicineMemo: update.hasMedicineMemo,
          hasGongjindanMemo: update.hasGongjindanMemo,
          hasGyeongokgoMemo: update.hasGyeongokgoMemo,
          hasDietMemo: update.hasDietMemo,
        };
      }
      return item;
    }));
  };

  // 날짜 변경 시 데이터 로드
  useEffect(() => {
    loadReceipts();
  }, [loadReceipts]);

  // 수납 메모 모달 열기
  const handleOpenMemoModal = (receipt: ExpandedReceiptItem) => {
    setMemoModalReceipt(receipt);
    setShowMemoModal(true);
  };

  // 수납 메모 모달 닫기
  const handleCloseMemoModal = () => {
    setShowMemoModal(false);
    setMemoModalReceipt(null);
  };

  // 약침 모달 열기
  const handleOpenYakchimModal = (receipt: ExpandedReceiptItem) => {
    // 처리 필요 항목 추출 (0원 약침, 약침포인트, 멤버십)
    const uncoveredItems = receipt.treatment_summary?.uncovered || [];
    const pendingItems = uncoveredItems.filter(u =>
      (u.name.includes('약침') && u.amount === 0) ||
      u.name.includes('약침포인트') ||
      u.name.includes('멤버십')
    );

    setYakchimModalReceipt(receipt);
    setYakchimPendingItems(pendingItems);
    setShowYakchimModal(true);
  };

  // 약침 모달 닫기
  const handleCloseYakchimModal = () => {
    setShowYakchimModal(false);
    setYakchimModalReceipt(null);
    setYakchimPendingItems([]);
  };

  // 한약 모달 열기
  const handleOpenHerbalModal = (receipt: ExpandedReceiptItem) => {
    setHerbalModalReceipt(receipt);
    setShowHerbalModal(true);
  };

  // 한약 모달 닫기
  const handleCloseHerbalModal = () => {
    setShowHerbalModal(false);
    setHerbalModalReceipt(null);
  };

  // 진료상세 모달 열기 (본인부담금 클릭 시)
  const handleOpenDetailModal = (receipt: ExpandedReceiptItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setDetailModalReceipt(receipt);
    setShowDetailModal(true);
  };

  // 진료상세 모달 닫기
  const handleCloseDetailModal = () => {
    setShowDetailModal(false);
    setDetailModalReceipt(null);
  };

  // 행 확장/축소 토글
  const toggleExpand = async (receiptId: number) => {
    const receipt = receipts.find(r => r.id === receiptId);
    if (!receipt) return;

    if (receipt.isExpanded) {
      // 축소
      setReceipts(prev => prev.map(r =>
        r.id === receiptId ? { ...r, isExpanded: false } : r
      ));
    } else {
      // 확장 - 상세 데이터 로드
      setReceipts(prev => prev.map(r =>
        r.id === receiptId ? { ...r, isExpanded: true, isLoading: true } : r
      ));

      try {
        const data = await getPatientMemoData(receipt.patient_id, selectedDate);
        setReceipts(prev => prev.map(r =>
          r.id === receiptId ? {
            ...r,
            treatmentPackages: data.treatmentPackages,
            herbalPackages: data.herbalPackages,
            pointBalance: data.pointBalance,
            todayPointUsed: data.todayPointUsed,
            todayPointEarned: data.todayPointEarned,
            activeMembership: data.membership,
            herbalDispensings: data.herbalDispensings,
            giftDispensings: data.giftDispensings,
            documentIssues: data.documentIssues,
            medicineUsages: data.medicineUsages,
            receiptMemo: data.memo,
            isLoading: false,
          } : r
        ));
      } catch (err) {
        console.error('상세 데이터 로드 실패:', err);
        setReceipts(prev => prev.map(r =>
          r.id === receiptId ? { ...r, isLoading: false } : r
        ));
      }
    }
  };

  // 예약 상태 변경
  const handleReservationStatusChange = async (
    receipt: ExpandedReceiptItem,
    status: ReservationStatus,
    reservationDate?: string
  ) => {
    try {
      await upsertReceiptMemo({
        patient_id: receipt.patient_id,
        chart_number: receipt.chart_no,
        patient_name: receipt.patient_name,
        mssql_receipt_id: receipt.id,
        receipt_date: selectedDate,
        reservation_status: status,
        reservation_date: reservationDate,
      });

      setReceipts(prev => prev.map(r =>
        r.id === receipt.id ? {
          ...r,
          receiptMemo: {
            ...(r.receiptMemo || {} as ReceiptMemo),
            reservation_status: status,
            reservation_date: reservationDate,
          } as ReceiptMemo,
        } : r
      ));
    } catch (err) {
      console.error('예약 상태 변경 실패:', err);
      alert('예약 상태 변경에 실패했습니다.');
    }
  };

  // 예약 버튼 클릭
  const handleReservationClick = (receipt: ExpandedReceiptItem) => {
    setSelectedPatientForReservation({
      id: receipt.patient_id,
      chartNo: receipt.chart_no,
      name: receipt.patient_name,
    });
    setShowReservationModal(true);
  };

  // 예약 1단계 완료 → 2단계(캘린더) 모달 열기
  const handleReservationNext = (draft: ReservationDraft) => {
    setShowReservationModal(false);
    // 1단계에서 선택한 정보를 가지고 캘린더 모달 열기
    setQuickReservationPatient({
      patientId: draft.patient.id,
      patientName: draft.patient.name,
      chartNo: draft.patient.chartNo,
      defaultDoctor: draft.doctor,
      selectedItems: draft.selectedItems,
      requiredSlots: draft.requiredSlots,
      memo: draft.memo,
    });
    setShowQuickReservationModal(true);
  };

  // 빠른 예약 열기
  const handleQuickReservation = (receipt: ExpandedReceiptItem) => {
    // 오늘 담당 의사 추출 (첫 번째 진료 항목에서)
    const doctorName = receipt.treatments?.[0]?.doctor || undefined;
    setQuickReservationPatient({
      patientId: receipt.patient_id,
      patientName: receipt.patient_name,
      chartNo: receipt.chart_no,
      defaultDoctor: doctorName,
    });
    setShowQuickReservationModal(true);
  };

  // 빠른 예약 성공
  const handleQuickReservationSuccess = () => {
    // 예약 생성 후 목록 새로고침
    loadReceipts();
  };

  // 예약 상태 표시 렌더링
  const renderReservationStatus = (receipt: ExpandedReceiptItem) => {
    // 1. 다음 예약이 있으면 표시
    if (receipt.nextReservation) {
      const r = receipt.nextReservation;
      const d = new Date(r.date);
      const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
      const formattedDate = `${d.getMonth() + 1}/${d.getDate()}(${dayNames[d.getDay()]})`;
      return (
        <span className="reservation-status confirmed" title={`${r.date} ${r.time} ${r.doctor}`}>
          {formattedDate}
        </span>
      );
    }

    // 2. 다음 예약이 없으면 예약 버튼 표시 (클릭 시 행 펼침)
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          toggleExpand(receipt.id);
        }}
        className="reservation-btn empty"
      >
        예약
      </button>
    );
  };

  // 기록 완료 토글
  const handleToggleCompleted = async (receipt: ExpandedReceiptItem) => {
    const newStatus = !receipt.isCompleted;
    try {
      await toggleReceiptCompleted(
        receipt.patient_id,
        selectedDate,
        newStatus,
        receipt.chart_no,
        receipt.patient_name,
        receipt.id
      );
      // 상태 업데이트
      setReceipts(prev => prev.map(r =>
        r.id === receipt.id ? { ...r, isCompleted: newStatus } : r
      ));
      if (newStatus) {
        setCompletedIds(prev => new Set([...prev, receipt.id]));
      } else {
        setCompletedIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(receipt.id);
          return newSet;
        });
      }
    } catch (err) {
      console.error('기록 완료 토글 실패:', err);
    }
  };

  // 필터링된 수납 목록
  const filteredReceipts = receipts.filter(receipt => {
    if (recordFilter === 'all') return true;
    if (recordFilter === 'completed') return receipt.isCompleted;
    if (recordFilter === 'incomplete') return !receipt.isCompleted;
    return true;
  });

  // 필터 카운트
  const completedCount = receipts.filter(r => r.isCompleted).length;
  const incompleteCount = receipts.filter(r => !r.isCompleted).length;

  // 날짜 이동 버튼
  const changeDate = (days: number) => {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() + days);
    setSelectedDate(current.toISOString().split('T')[0]);
  };

  return (
    <div className="receipt-view">
      {/* 날짜 선택 바 */}
      <div className="receipt-date-bar">
        <button onClick={() => changeDate(-1)} className="date-nav-btn">
          <i className="fa-solid fa-chevron-left"></i>
        </button>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="date-input"
        />
        <button onClick={() => changeDate(1)} className="date-nav-btn">
          <i className="fa-solid fa-chevron-right"></i>
        </button>
        <button
          onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
          className="today-btn"
        >
          오늘
        </button>

        {/* 기록 상태 필터 */}
        <div className="record-filter-group">
          <button
            className={`record-filter-btn ${recordFilter === 'all' ? 'active' : ''}`}
            onClick={() => setRecordFilter('all')}
          >
            전체 <span className="filter-count">{receipts.length}</span>
          </button>
          <button
            className={`record-filter-btn incomplete ${recordFilter === 'incomplete' ? 'active' : ''}`}
            onClick={() => setRecordFilter('incomplete')}
          >
            미기록 <span className="filter-count">{incompleteCount}</span>
          </button>
          <button
            className={`record-filter-btn completed ${recordFilter === 'completed' ? 'active' : ''}`}
            onClick={() => setRecordFilter('completed')}
          >
            완료 <span className="filter-count">{completedCount}</span>
          </button>
        </div>

        {/* 현장예약율 */}
        {onsiteStats && (
          <div className="onsite-rate-display">
            <div className="onsite-rate-item">
              <span className="onsite-label">현장예약율</span>
              <span className="onsite-value">{onsiteStats.onsite_rate}%</span>
              <span className="onsite-detail">({onsiteStats.onsite_count}/{onsiteStats.total_chim_patients})</span>
            </div>
            <div className="onsite-rate-divider"></div>
            <div className="onsite-rate-item">
              <span className="onsite-label">사전예약율</span>
              <span className="onsite-value reserved">{onsiteStats.reservation_rate}%</span>
            </div>
          </div>
        )}

        {/* 환자 검색 */}
        <div className="receipt-search-container">
          <div className="receipt-search-input-wrapper">
            <i className="fa-solid fa-magnifying-glass"></i>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="환자검색"
              className="receipt-search-input"
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setSearchTerm('');
                  setShowSearchDropdown(false);
                }
              }}
            />
            {isSearching && <i className="fa-solid fa-spinner fa-spin search-loading"></i>}
            {searchTerm && !isSearching && (
              <button
                className="search-clear-btn"
                onClick={() => {
                  setSearchTerm('');
                  setShowSearchDropdown(false);
                }}
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            )}
          </div>
          {showSearchDropdown && searchResults.length > 0 && (
            <div className="receipt-search-dropdown">
              {searchResults.map((patient) => (
                <div
                  key={patient.id}
                  className="receipt-search-result-item"
                  onClick={() => handleSearchResultClick(patient)}
                >
                  <div className="search-result-main">
                    <span className="search-result-name">{patient.name}</span>
                    <span className="search-result-chart">({patient.chart_no.replace(/^0+/, '')})</span>
                  </div>
                  <div className="search-result-meta">
                    {patient.birth && <span>{patient.birth.slice(2, 10).replace(/-/g, '.')}</span>}
                    <span>{patient.sex === 'M' ? '남' : '여'}</span>
                    {patient.last_visit && <span>최근 {patient.last_visit.slice(5).replace('-', '/')}</span>}
                  </div>
                </div>
              ))}
              <div className="search-result-footer">
                {searchResults.length}건 검색됨
              </div>
            </div>
          )}
          {showSearchDropdown && searchTerm.length >= 2 && searchResults.length === 0 && !isSearching && (
            <div className="receipt-search-dropdown">
              <div className="search-no-results">
                <i className="fa-solid fa-user-slash"></i>
                <span>검색 결과 없음</span>
              </div>
            </div>
          )}
        </div>

        <button onClick={loadReceipts} className="refresh-btn">
          <i className="fa-solid fa-rotate-right"></i> 새로고침
        </button>
      </div>

      {/* 에러 메시지 */}
      {error && (
        <div className="receipt-error">
          <i className="fa-solid fa-circle-exclamation"></i> {error}
        </div>
      )}

      {/* 로딩 */}
      {isLoading && (
        <div className="receipt-loading">
          <i className="fa-solid fa-spinner fa-spin"></i> 불러오는 중...
        </div>
      )}

      {/* 수납 목록 (아코디언 테이블) */}
      {!isLoading && receipts.length === 0 && (
        <div className="receipt-empty">
          <i className="fa-solid fa-receipt"></i>
          <p>해당 날짜의 수납 내역이 없습니다.</p>
        </div>
      )}

      {!isLoading && receipts.length > 0 && (
        <div className="receipt-accordion-table receipt-2row-layout">
          {/* 테이블 헤더 (2행) */}
          <div className="receipt-header-2row">
            <div className="header-row-1">
              <div className="col-num">#</div>
              <div className="col-time">시간</div>
              <div className="col-patient">환자</div>
              <div className="col-doctor">담당</div>
              <div className="col-type">종별</div>
              <div className="col-receipt-detail">수납내역</div>
              <div className="col-uncovered"></div>
              <div className="col-reservation">예약</div>
            </div>
            <div className="header-row-2">
              <div className="col-quick-memo"></div>
              <div className="col-memo"></div>
              <div className="col-complete"></div>
            </div>
          </div>

          {/* 테이블 바디 */}
          {filteredReceipts.map((receipt, index) => (
            <React.Fragment key={receipt.id}>
              {/* 2행 구조 수납 항목 */}
              <div className={`receipt-item-2row ${receipt.isCompleted ? 'completed' : ''}`}>
                {/* 1행: 기본 정보 + 수납내역 + 비급여내역 + 예약 */}
                <div className="receipt-row-1">
                  <div className="col-num">{index + 1}</div>
                  <div className="col-time">{formatTime(receipt.receipt_time)}</div>
                  <div
                    className="col-patient clickable"
                    onClick={(e) => handlePatientClick(receipt, e)}
                    title="수납이력 보기"
                  >
                    <span className="patient-name">{receipt.patient_name}</span>
                    <span className="patient-info">
                      ({receipt.chart_no.replace(/^0+/, '')}/{receipt.age || '-'}세)
                    </span>
                  </div>
                  <div className="col-doctor">{getDoctorShortName(receipt)}</div>
                  <div className="col-type">
                    <span className={`type-badge ${getInsuranceTypeClass(receipt.insurance_type)}`}>{formatInsuranceType(receipt.insurance_type)}</span>
                  </div>
                  <div className="col-receipt-detail">
                    <span className="payment-methods-inline">
                      {getPaymentMethodIcons(receipt).map((m, i) => (
                        <span key={i} className={m.color} title={m.label}>
                          <i className={`fa-solid ${m.icon}`}></i>
                        </span>
                      ))}
                    </span>
                    <span
                      className="amount-group clickable"
                      onClick={(e) => handleOpenDetailModal(receipt, e)}
                      title="클릭하여 진료상세내역 보기"
                    >
                      <span className="amount-item total">{formatMoney(receipt.total_amount)}</span>
                      <span className="amount-divider">/</span>
                      <span className={`amount-item self ${receipt.insurance_self >= 20000 ? 'high' : ''}`}>
                        {formatMoney(receipt.insurance_self)}
                      </span>
                      {receipt.insurance_self > 20000 && (() => {
                        const choonaTreatment = receipt.treatments?.find(t =>
                          t.is_covered && t.name?.includes('추나')
                        );
                        if (choonaTreatment) {
                          const label = choonaTreatment.name?.includes('단순') ? '단추' :
                                        choonaTreatment.name?.includes('복잡') ? '복추' : null;
                          if (label) {
                            return <span className="choona-type">({label})</span>;
                          }
                        }
                        return null;
                      })()}
                      <span className="amount-divider">/</span>
                      <span className="amount-item general">{formatMoney(receipt.general_amount)}</span>
                    </span>
                  </div>
                  <div className="col-uncovered">
                    {receipt.treatment_summary?.uncovered && receipt.treatment_summary.uncovered.length > 0 && (
                      <span className="uncovered-items">
                        {receipt.treatment_summary.uncovered.map(u => u.name).join(',')}
                      </span>
                    )}
                  </div>
                  <div className="col-reservation" onClick={(e) => e.stopPropagation()}>
                    {renderReservationStatus(receipt)}
                  </div>
                </div>

                {/* 2행: 빠른메모버튼 + 수납메모 + 완료 */}
                <div className="receipt-row-2">
                  <div className="col-quick-memo">
                    {/* 비급여 키워드별 빠른 메모 버튼 */}
                    {(() => {
                      const uncoveredItems = receipt.treatment_summary?.uncovered || [];
                      const uncoveredNames = uncoveredItems.map(u => u.name).join(' ');

                      // 약침 뱃지: 0원 약침(패키지/멤버십 사용), 약침포인트(패키지결제), 멤버십(멤버십결제)
                      const hasYakchim = uncoveredItems.some(u =>
                        (u.name.includes('약침') && u.amount === 0) ||
                        u.name.includes('약침포인트') ||
                        u.name.includes('멤버십')
                      );
                      const hasHerbal = uncoveredNames.includes('한약');
                      const hasMedicine = uncoveredNames.includes('상비약') ||
                                         uncoveredNames.includes('감기약') ||
                                         uncoveredNames.includes('치료약') ||
                                         uncoveredNames.includes('보완처방') ||
                                         uncoveredNames.includes('상용환') ||
                                         uncoveredNames.includes('자운고');
                      const hasGongjindan = uncoveredNames.includes('공진단');
                      const hasGyeongokgo = uncoveredNames.includes('경옥고');
                      const hasDiet = uncoveredNames.includes('린') || uncoveredNames.includes('체감탕');

                      if (!hasYakchim && !hasHerbal && !hasMedicine && !hasGongjindan && !hasGyeongokgo && !hasDiet) return null;

                      return (
                        <span className="quick-memo-btns">
                          {hasYakchim && (
                            <button
                              className={`quick-memo-btn yakchim ${receipt.hasYakchimMemo ? 'completed' : ''}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenYakchimModal(receipt);
                              }}
                              title={receipt.hasYakchimMemo ? '약침 메모 있음' : '약침 관리'}
                            >
                              약침
                            </button>
                          )}
                          {hasHerbal && (
                            <button
                              className={`quick-memo-btn herbal ${receipt.hasHerbalMemo ? 'completed' : ''}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenHerbalModal(receipt);
                              }}
                              title={receipt.hasHerbalMemo ? '한약 메모 있음' : '한약 관리'}
                            >
                              한약
                            </button>
                          )}
                          {hasGongjindan && (
                            <button
                              className={`quick-memo-btn gongjindan ${receipt.hasGongjindanMemo ? 'completed' : ''}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenMemoModal(receipt);
                              }}
                              title={receipt.hasGongjindanMemo ? '공진단 메모 있음' : '공진단 메모 추가'}
                            >
                              공진단
                            </button>
                          )}
                          {hasGyeongokgo && (
                            <button
                              className={`quick-memo-btn gyeongokgo ${receipt.hasGyeongokgoMemo ? 'completed' : ''}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenMemoModal(receipt);
                              }}
                              title={receipt.hasGyeongokgoMemo ? '경옥고 메모 있음' : '경옥고 메모 추가'}
                            >
                              경옥고
                            </button>
                          )}
                          {hasMedicine && (
                            <button
                              className={`quick-memo-btn medicine ${receipt.hasMedicineMemo ? 'completed' : ''}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setMedicineModalReceipt(receipt);
                              }}
                              title={receipt.hasMedicineMemo ? '상비약 처방됨' : '상비약 처방'}
                            >
                              상비약
                            </button>
                          )}
                          {hasDiet && (
                            <button
                              className={`quick-memo-btn diet ${receipt.hasDietMemo ? 'completed' : ''}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenMemoModal(receipt);
                              }}
                              title={receipt.hasDietMemo ? '다이어트 메모 있음' : '다이어트 메모 추가'}
                            >
                              다이어트
                            </button>
                          )}
                        </span>
                      );
                    })()}
                  </div>
                  <div
                    className="col-memo"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenMemoModal(receipt);
                    }}
                    title="클릭하여 메모 관리"
                  >
                    <div className="memo-summary-display">
                      {receipt.memoSummary ? (
                        <span className="memo-text">{receipt.memoSummary}</span>
                      ) : (
                        <span className="memo-click-hint">
                          <i className="fa-solid fa-plus"></i> 클릭하여 메모 추가
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="col-complete" onClick={(e) => e.stopPropagation()}>
                    <button
                      className={`complete-btn ${receipt.isCompleted ? 'completed' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleCompleted(receipt);
                      }}
                      title={receipt.isCompleted ? '완료 해제' : '기록 완료'}
                    >
                      <i className="fa-solid fa-check"></i>
                    </button>
                  </div>
                </div>
              </div>
            </React.Fragment>
          ))}
        </div>
      )}

      {/* 예약 모달 */}
      <ReservationStep1Modal
        isOpen={showReservationModal}
        onClose={() => setShowReservationModal(false)}
        onNext={handleReservationNext}
        doctors={doctors}
        initialPatient={selectedPatientForReservation}
      />

      {/* 빠른 예약 모달 (2단계: 캘린더에서 시간 선택) */}
      {quickReservationPatient && (
        <QuickReservationModal
          isOpen={showQuickReservationModal}
          onClose={() => {
            setShowQuickReservationModal(false);
            setQuickReservationPatient(null);
          }}
          onSuccess={handleQuickReservationSuccess}
          patientId={quickReservationPatient.patientId}
          patientName={quickReservationPatient.patientName}
          chartNo={quickReservationPatient.chartNo}
          defaultDoctor={quickReservationPatient.defaultDoctor}
          selectedItems={quickReservationPatient.selectedItems}
          requiredSlots={quickReservationPatient.requiredSlots}
          memo={quickReservationPatient.memo}
        />
      )}

      {/* 환자 수납이력 모달 */}
      {historyPatient && (
        <PatientReceiptHistoryModal
          isOpen={showHistoryModal}
          onClose={() => {
            setShowHistoryModal(false);
            setHistoryPatient(null);
          }}
          patientId={historyPatient.patientId}
          patientName={historyPatient.patientName}
          chartNo={historyPatient.chartNo}
        />
      )}

      {/* 수납 메모 모달 */}
      {memoModalReceipt && (
        <ReceiptMemoModal
          isOpen={showMemoModal}
          onClose={handleCloseMemoModal}
          patientId={memoModalReceipt.patient_id}
          patientName={memoModalReceipt.patient_name}
          chartNo={memoModalReceipt.chart_no}
          receiptId={memoModalReceipt.id}
          receiptDate={selectedDate}
          onDataChange={loadReceipts}
        />
      )}

      {/* 약침 관리 모달 */}
      {yakchimModalReceipt && (
        <YakchimModal
          isOpen={showYakchimModal}
          onClose={handleCloseYakchimModal}
          patientId={yakchimModalReceipt.patient_id}
          patientName={yakchimModalReceipt.patient_name}
          chartNumber={yakchimModalReceipt.chart_no}
          receiptId={yakchimModalReceipt.id}
          receiptDate={selectedDate}
          pendingItems={yakchimPendingItems}
          onSave={() => {
            console.log('약침 차감 완료');
            loadReceipts();
          }}
        />
      )}

      {/* 한약 관리 모달 */}
      {herbalModalReceipt && (
        <HerbalModal
          isOpen={showHerbalModal}
          onClose={handleCloseHerbalModal}
          patientId={herbalModalReceipt.patient_id}
          patientName={herbalModalReceipt.patient_name}
          chartNumber={herbalModalReceipt.chart_no}
          receiptId={herbalModalReceipt.id}
          receiptDate={selectedDate}
          onSave={(data) => {
            console.log('한약 저장:', data);
            // TODO: 데이터 새로고침
            loadReceipts();
          }}
        />
      )}

      {/* 진료상세내역 모달 */}
      {detailModalReceipt && (
        <ReceiptDetailModal
          isOpen={showDetailModal}
          onClose={handleCloseDetailModal}
          patientId={detailModalReceipt.patient_id}
          patientName={detailModalReceipt.patient_name}
          chartNo={detailModalReceipt.chart_no}
          receiptDate={selectedDate}
          insuranceSelf={detailModalReceipt.insurance_self}
          generalAmount={detailModalReceipt.general_amount}
        />
      )}

      {/* 상비약 모달 */}
      {medicineModalReceipt && (
        <MedicineModal
          isOpen={true}
          onClose={() => setMedicineModalReceipt(null)}
          patientId={medicineModalReceipt.patient_id}
          chartNumber={medicineModalReceipt.chart_no}
          patientName={medicineModalReceipt.patient_name}
          usageDate={selectedDate}
          receiptId={medicineModalReceipt.id}
          onSuccess={() => {
            loadReceipts();
          }}
        />
      )}
    </div>
  );
}

// 상세 패널 컴포넌트
interface ReceiptDetailPanelProps {
  receipt: ExpandedReceiptItem;
  selectedDate: string;
  onDataChange: () => void;
  onReservationStatusChange: (receipt: ExpandedReceiptItem, status: ReservationStatus, date?: string) => void;
  onQuickReservation: (receipt: ExpandedReceiptItem) => void;
}

function ReceiptDetailPanel({ receipt, selectedDate, onDataChange, onReservationStatusChange, onQuickReservation }: ReceiptDetailPanelProps) {
  const [memoText, setMemoText] = useState(receipt.receiptMemo?.memo || '');
  const [pointBalance, setPointBalance] = useState(receipt.pointBalance);

  // 모달 상태
  const [showPackageModal, setShowPackageModal] = useState(false);
  const [showMembershipModal, setShowMembershipModal] = useState(false);
  const [showDispensingModal, setShowDispensingModal] = useState(false);

  // 수정 모드 데이터
  const [editPackageData, setEditPackageData] = useState<TreatmentPackage | undefined>(undefined);
  const [editMembershipData, setEditMembershipData] = useState<Membership | undefined>(undefined);
  const [editHerbalData, setEditHerbalData] = useState<HerbalDispensing | undefined>(undefined);
  const [editGiftData, setEditGiftData] = useState<GiftDispensing | undefined>(undefined);

  // 패키지 수정 모달 열기
  const openPackageEdit = (pkg: TreatmentPackage) => {
    setEditPackageData(pkg);
    setShowPackageModal(true);
  };

  // 멤버십 수정 모달 열기
  const openMembershipEdit = (membership: Membership) => {
    setEditMembershipData(membership);
    setShowMembershipModal(true);
  };

  // 한약 출납 수정 모달 열기
  const openHerbalEdit = (herbal: HerbalDispensing) => {
    setEditHerbalData(herbal);
    setEditGiftData(undefined);
    setShowDispensingModal(true);
  };

  // 증정품 출납 수정 모달 열기
  const openGiftEdit = (gift: GiftDispensing) => {
    setEditGiftData(gift);
    setEditHerbalData(undefined);
    setShowDispensingModal(true);
  };

  // 모달 닫을 때 수정 데이터 초기화
  const handlePackageModalClose = () => {
    setShowPackageModal(false);
    setEditPackageData(undefined);
  };

  const handleMembershipModalClose = () => {
    setShowMembershipModal(false);
    setEditMembershipData(undefined);
  };

  const handleDispensingModalClose = () => {
    setShowDispensingModal(false);
    setEditHerbalData(undefined);
    setEditGiftData(undefined);
  };

  // 포인트 사용
  const handleUsePoints = async (amount: number) => {
    if (amount <= 0) return;
    try {
      await usePoints({
        patient_id: receipt.patient_id,
        chart_number: receipt.chart_no,
        patient_name: receipt.patient_name,
        amount,
        receipt_id: receipt.id,
        description: `${selectedDate} 수납 사용`,
      });
      setPointBalance(prev => prev - amount);
      onDataChange();
    } catch (err: any) {
      alert(err.message || '포인트 사용 실패');
    }
  };

  // 포인트 적립
  const handleEarnPoints = async (amount: number) => {
    if (amount <= 0) return;
    try {
      await earnPoints({
        patient_id: receipt.patient_id,
        chart_number: receipt.chart_no,
        patient_name: receipt.patient_name,
        amount,
        receipt_id: receipt.id,
        description: `${selectedDate} 수납 적립`,
      });
      setPointBalance(prev => prev + amount);
      onDataChange();
    } catch (err) {
      alert('포인트 적립 실패');
    }
  };

  // 메모 저장
  const handleSaveMemo = async () => {
    try {
      await upsertReceiptMemo({
        patient_id: receipt.patient_id,
        chart_number: receipt.chart_no,
        patient_name: receipt.patient_name,
        mssql_receipt_id: receipt.id,
        receipt_date: selectedDate,
        memo: memoText,
      });
      alert('메모가 저장되었습니다.');
    } catch (err) {
      alert('메모 저장 실패');
    }
  };

  // 시술 패키지 사용
  const handleUseTreatmentPackage = async (pkgId: number) => {
    try {
      await useTreatmentPackage(pkgId);
      onDataChange();
    } catch (err) {
      alert('패키지 사용 실패');
    }
  };

  // 데이터 유무 체크
  const hasPackages = receipt.treatmentPackages.length > 0 || receipt.herbalPackages.length > 0;
  const hasMembership = !!receipt.activeMembership;
  const hasDispensing = receipt.herbalDispensings.length > 0 || receipt.giftDispensings.length > 0 || receipt.documentIssues.length > 0;

  // 진료상세 요약
  const treatmentSummary = summarizeTreatments(receipt.treatments || []);

  return (
    <div className="receipt-detail-2col">
      {/* 왼쪽: 진료상세 (진료항목 + 수납금액) */}
      <div className="treatment-detail-col">
        {/* 진료항목 */}
        <div className="treatment-items">
          <div className="treatment-badges">
            {treatmentSummary.consultType && (
              <span className="treatment-badge consult">{treatmentSummary.consultType}</span>
            )}
            {treatmentSummary.coveredItems.map((item, idx) => (
              <span key={idx} className="treatment-badge covered">{item}</span>
            ))}
          </div>
          <div className="treatment-extras">
            {treatmentSummary.yakchim.length > 0 && (
              <span className="treatment-extra yakchim">
                <i className="fa-solid fa-syringe"></i>
                {treatmentSummary.yakchim.map((y, idx) => (
                  <span key={idx}>
                    {y.name} {y.amount.toLocaleString()}원
                    {idx < treatmentSummary.yakchim.length - 1 && ', '}
                  </span>
                ))}
              </span>
            )}
            {treatmentSummary.sangbiyak > 0 && (
              <span className="treatment-extra sangbiyak">
                <i className="fa-solid fa-pills"></i>
                상비약 {treatmentSummary.sangbiyak.toLocaleString()}원
              </span>
            )}
          </div>
        </div>

        {/* 수납금액 */}
        <div className="receipt-amount-section">
          <div className="amount-row">
            <span className="amount-label">본인부담</span>
            <span className="amount-value insurance">{formatMoney(receipt.insurance_self)}</span>
          </div>
          <div className="amount-row">
            <span className="amount-label">비급여</span>
            <span className="amount-value general">{formatMoney(receipt.general_amount)}</span>
          </div>
          <div className="amount-row total">
            <span className="amount-label">총 수납</span>
            <span className="amount-value">{formatMoney(receipt.total_amount)}</span>
          </div>
          <div className="payment-method-row">
            {receipt.card > 0 && <span className="method card"><i className="fa-solid fa-credit-card"></i> {receipt.card.toLocaleString()}</span>}
            {receipt.cash > 0 && <span className="method cash"><i className="fa-solid fa-money-bill"></i> {receipt.cash.toLocaleString()}</span>}
            {receipt.transfer > 0 && <span className="method transfer"><i className="fa-solid fa-building-columns"></i> {receipt.transfer.toLocaleString()}</span>}
          </div>
        </div>
      </div>

      {/* 오른쪽: 수납메모 3x2 그리드 */}
      <div className="detail-grid-3x2">
      {/* Row 1: 패키지, 멤버십, 포인트 */}
      {/* 패키지 */}
      <div className="grid-card">
        <div className="grid-card-header">
          <span className="grid-icon">📦</span>
          <span className="grid-title">패키지</span>
          <button className="grid-add-btn" onClick={() => setShowPackageModal(true)}>+</button>
        </div>
        <div className="grid-card-body">
          {hasPackages ? (
            <div className="grid-tags">
              {receipt.treatmentPackages.map(pkg => (
                <div key={pkg.id} className="grid-tag pkg clickable" onClick={() => openPackageEdit(pkg)}>
                  <span className="tag-name">{pkg.package_name}</span>
                  <span className="tag-count">{pkg.remaining_count}/{pkg.total_count}</span>
                  {pkg.includes && <span className="tag-extra">({pkg.includes})</span>}
                  {pkg.status === 'active' && (
                    <button className="tag-use-btn" onClick={(e) => { e.stopPropagation(); handleUseTreatmentPackage(pkg.id!); }}>-1</button>
                  )}
                </div>
              ))}
              {receipt.herbalPackages.map(pkg => (
                <div key={pkg.id} className="grid-tag herbal">
                  <span className="tag-name">선결{pkg.package_type}</span>
                  <span className="tag-count">{pkg.remaining_count}/{pkg.total_count}</span>
                </div>
              ))}
            </div>
          ) : (
            <span className="grid-empty">-</span>
          )}
        </div>
      </div>

      {/* 멤버십 */}
      <div className="grid-card">
        <div className="grid-card-header">
          <span className="grid-icon">🎫</span>
          <span className="grid-title">멤버십</span>
          <button className="grid-add-btn" onClick={() => setShowMembershipModal(true)}>+</button>
        </div>
        <div className="grid-card-body">
          {hasMembership ? (
            <div className="grid-tags">
              <div className="grid-tag membership clickable" onClick={() => openMembershipEdit(receipt.activeMembership!)}>
                <span className="tag-name">{receipt.activeMembership!.membership_type}</span>
                <span className="tag-count">{receipt.activeMembership!.quantity}개</span>
                <span className="tag-expire">~{new Date(receipt.activeMembership!.expire_date).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })}</span>
              </div>
            </div>
          ) : (
            <span className="grid-empty">-</span>
          )}
        </div>
      </div>

      {/* 포인트 */}
      <div className="grid-card">
        <div className="grid-card-header">
          <span className="grid-icon">💰</span>
          <span className="grid-title">포인트</span>
          <span className="grid-point-balance">{pointBalance.toLocaleString()}P</span>
        </div>
        <div className="grid-card-body">
          <div className="grid-point-actions">
            <input type="number" id={`point-${receipt.id}`} placeholder="금액" min="0" step="1000" />
            <button className="point-btn use" onClick={() => {
              const input = document.getElementById(`point-${receipt.id}`) as HTMLInputElement;
              handleUsePoints(Number(input.value));
              input.value = '';
            }}>-</button>
            <button className="point-btn earn" onClick={() => {
              const input = document.getElementById(`point-${receipt.id}`) as HTMLInputElement;
              handleEarnPoints(Number(input.value));
              input.value = '';
            }}>+</button>
          </div>
        </div>
      </div>

      {/* Row 2: 출납, 예약, 메모 */}
      {/* 출납 */}
      <div className="grid-card">
        <div className="grid-card-header">
          <span className="grid-icon">📋</span>
          <span className="grid-title">출납</span>
          <button className="grid-add-btn" onClick={() => setShowDispensingModal(true)}>+</button>
        </div>
        <div className="grid-card-body">
          {(receipt.herbalDispensings.length > 0 || receipt.giftDispensings.length > 0) ? (
            <div className="grid-tags">
              {receipt.herbalDispensings.map(d => (
                <div key={d.id} className="grid-tag dispensing clickable" onClick={() => openHerbalEdit(d)}>
                  <span className="tag-type">{d.dispensing_type === 'gift' ? '증' : '약'}</span>
                  <span className="tag-name">{d.herbal_name}</span>
                  <span className="tag-qty">{d.quantity}</span>
                </div>
              ))}
              {receipt.giftDispensings.map(d => (
                <div key={d.id} className="grid-tag gift clickable" onClick={() => openGiftEdit(d)}>
                  <span className="tag-type">증</span>
                  <span className="tag-name">{d.item_name}</span>
                  <span className="tag-qty">{d.quantity}</span>
                </div>
              ))}
            </div>
          ) : (
            <span className="grid-empty">-</span>
          )}
        </div>
      </div>

      {/* 예약 */}
      <div className="grid-card">
        <div className="grid-card-header">
          <span className="grid-icon">📅</span>
          <span className="grid-title">예약</span>
          <button
            className="grid-quick-res-btn"
            onClick={() => onQuickReservation(receipt)}
          >
            지금 예약
          </button>
        </div>
        <div className="grid-card-body">
          <div className="grid-res-btns">
            {(['none', 'pending_call', 'pending_kakao', 'pending_naver'] as ReservationStatus[]).map(status => (
              <button
                key={status}
                className={`res-btn ${receipt.receiptMemo?.reservation_status === status ? 'active' : ''}`}
                onClick={() => onReservationStatusChange(receipt, status)}
              >
                {status === 'none' ? '없음' : RESERVATION_STATUS_LABELS[status]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 메모 */}
      <div className="grid-card">
        <div className="grid-card-header">
          <span className="grid-icon">📝</span>
          <span className="grid-title">메모</span>
        </div>
        <div className="grid-card-body">
          <div className="grid-memo">
            <input
              type="text"
              value={memoText}
              onChange={(e) => setMemoText(e.target.value)}
              placeholder="메모 입력..."
            />
            <button onClick={handleSaveMemo}>저장</button>
          </div>
        </div>
      </div>
      </div>

      {/* 모달들 */}
      <PackageAddModal
        isOpen={showPackageModal}
        onClose={handlePackageModalClose}
        onSuccess={onDataChange}
        patientId={receipt.patient_id}
        patientName={receipt.patient_name}
        chartNo={receipt.chart_no}
        editData={editPackageData}
      />

      <MembershipAddModal
        isOpen={showMembershipModal}
        onClose={handleMembershipModalClose}
        onSuccess={onDataChange}
        patientId={receipt.patient_id}
        patientName={receipt.patient_name}
        chartNo={receipt.chart_no}
        editData={editMembershipData}
      />

      <DispensingAddModal
        isOpen={showDispensingModal}
        onClose={handleDispensingModalClose}
        onSuccess={onDataChange}
        patientId={receipt.patient_id}
        patientName={receipt.patient_name}
        chartNo={receipt.chart_no}
        receiptId={receipt.id}
        selectedDate={selectedDate}
        editHerbalData={editHerbalData}
        editGiftData={editGiftData}
      />
    </div>
  );
}

export default ReceiptView;
