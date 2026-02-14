import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { PortalUser } from '@shared/types';
import { getCurrentDate } from '@shared/lib/postgres';
import {
  ensureReceiptTables,
  getPatientMemoData,
  getPatientsMemoDataBatch,
  getReceiptMemosByReceiptId,
  addReceiptMemo,
  updateReceiptMemoById,
  deleteReceiptMemoById,
  useTreatmentPackage,
  earnPoints,
  usePoints,
  toggleReceiptCompleted,
  getCompletedReceiptIds,
  updateReservationStatus,
  upsertReceiptStatus,
  fetchReceiptDetails,
  fetchPatientPreviousMemos,
  getHerbalPackageById,
  getHerbalPickupById,
  getHerbalPickupByReceiptId,
  getNokryongPackageById,
  getNokryongPackages,
  getActiveNokryongPackages,
  getActiveHerbalPackages,
  updateHerbalPickup,
  deleteHerbalPickup,
  createHerbalPickup,
  getAllActivePackages,
  getPackageDiseaseTags,
  getPackageUsagesByDate,
  updateHerbalPackage,
  updateNokryongPackage,
  updateTreatmentPackage,
  deleteHerbalPackage,
  deleteNokryongPackage,
  deleteTreatmentPackage,
  updateMembership,
  deleteMembership,
  getHerbalPurposes,
  getHerbalDiseaseTags,
  getNokryongTypes,
  getMembershipTypes,
  setPackageDiseaseTags,
  findOrCreateDiseaseTag,
  getPackageHistory,
  getHerbalPackageHistory,
  getNokryongPackageHistory,
  getMembershipHistory,
  getMemoTypes,
  type ReceiptDetailItem,
  type PreviousMemoItem,
  type PackageHistoryItem,
  type MemoType,
} from '../lib/api';
import {
  type TreatmentPackage,
  type HerbalPackage,
  type HerbalPickup,
  type Membership,
  type HerbalDispensing,
  type GiftDispensing,
  type DocumentIssue,
  type NokryongPackage,
  type MedicineUsage,
  type YakchimUsageRecord,
  type ReceiptMemo,
  type ReservationStatus,
  type ReceiptRecordFilter,
  type MemoSummaryItem,
  type PackageUsage,
  type DeliveryMethod,
  RESERVATION_STATUS_LABELS,
  HERBAL_PACKAGE_ROUNDS,
  generateMemoSummaryItems,
} from '../types';
import { MemoTagList } from './MemoTag';
import { ReservationStep1Modal, type ReservationDraft, type InitialPatient } from '../../reservation/components/ReservationStep1Modal';
import { QuickReservationModal } from './QuickReservationModal';
import { PackageAddModal } from './PackageAddModal';
import { MembershipAddModal } from './MembershipAddModal';
import { DispensingAddModal } from './DispensingAddModal';
import { fetchDoctors, fetchReservationsByDateRange } from '../../reservation/lib/api';
import type { Doctor, Reservation } from '../../reservation/types';
// manage 모듈의 API 사용
import { fetchReceiptHistory, fetchPatientReceiptHistory, type ReceiptHistoryItem } from '../../manage/lib/api';
import YakchimModal from './YakchimModal';
import { MedicineModal } from './MedicineModal';
import MemoInputPanel from './MemoInputPanel';
import RegisterModal from './RegisterModal';
import UncoveredItemModal from './uncovered-modal/UncoveredItemModal';
import type { UncoveredItemType } from './uncovered-modal/UncoveredItemModal';
import PackageManageModal from './PackageManageModal';
import PackageQuickAddModal from './PackageQuickAddModal';
import { PackageTimeline } from './PackageTimeline';
import InlineReceiptHistory from './InlineReceiptHistory';
import PatientDashboard from './PatientDashboard';
import { getLocalPatientByMssqlId, syncPatientById } from '../lib/patientSync';
import type { LocalPatient } from '../lib/patientSync';
import type { TimelineEvent } from '../types';
// 분리된 컴포넌트 및 헬퍼 import
import {
  InlineMemoEdit,
  InlineHerbalPackageEdit,
  InlineTreatmentPackageEdit,
  InlineNokryongPackageEdit,
  InlineMembershipEdit,
  InlineHerbalPickupEdit,
  InlineHerbalDeductPanel,
  InlineYakchimEdit,
} from './InlineEditComponents';
import {
  type OnsiteReservationStats,
  type ExpandedReceiptItem,
  type TreatmentSummary,
  fetchOnsiteReservationRate,
  formatMoney,
  formatTime,
  formatDateWithDay,
  getPaymentMethodIcons,
  getDoctorShortName,
  formatInsuranceType,
  getInsuranceTypeClass,
  TREATMENT_NAME_MAP,
  summarizeTreatments,
} from './receiptHelpers';

const MSSQL_API_BASE = import.meta.env.VITE_MSSQL_API_URL || 'http://192.168.0.173:3100';

interface ReceiptViewProps {
  user: PortalUser;
  onReservationDraftReady?: (draft: ReservationDraft) => void;
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

function ReceiptView({ user, onReservationDraftReady }: ReceiptViewProps) {
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return getCurrentDate();
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
  const [initialDetailsForReservation, setInitialDetailsForReservation] = useState<string>('');
  const [defaultDoctorForReservation, setDefaultDoctorForReservation] = useState<string>('');
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


  // 환자 대시보드 모달 상태
  const [showDashboardModal, setShowDashboardModal] = useState(false);
  const [dashboardPatient, setDashboardPatient] = useState<LocalPatient | null>(null);

  // 날짜 이동 후 선택할 환자 ID (수납이력에서 클릭 시)
  const pendingPatientSelectRef = useRef<number | null>(null);


  // 약침 모달 상태
  const [showYakchimModal, setShowYakchimModal] = useState(false);
  const [yakchimModalReceipt, setYakchimModalReceipt] = useState<ExpandedReceiptItem | null>(null);
  const [yakchimPendingItems, setYakchimPendingItems] = useState<{ name: string; amount: number }[]>([]);

  // 상비약 모달 상태
  const [medicineModalReceipt, setMedicineModalReceipt] = useState<ExpandedReceiptItem | null>(null);
  const [medicineEditData, setMedicineEditData] = useState<MedicineUsage | null>(null);
  const [medicineInitialSearch, setMedicineInitialSearch] = useState<string>('');

  // 선택된 수납 항목 (오른쪽 패널에 표시)
  const [selectedReceipt, setSelectedReceipt] = useState<ExpandedReceiptItem | null>(null);
  const [selectedPatientHistory, setSelectedPatientHistory] = useState<ExpandedReceiptItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [previousMemos, setPreviousMemos] = useState<PreviousMemoItem[]>([]);

  // 사이드패널 메모 입력 모드
  const [memoInputMode, setMemoInputMode] = useState<{
    patientId?: number;        // 환자 ID (메모 클릭 수정시 사용)
    patientName?: string;      // 환자명 (메모 클릭 수정시 사용)
    chartNumber?: string;      // 차트번호 (메모 클릭 수정시 사용)
    itemName: string;
    itemType: 'yakchim' | 'medicine' | 'herbal' | 'other' | 'package-register' | 'package-edit' | 'membership-register' | 'membership-edit';
    amount?: number;
    detailId?: number;         // MSSQL Detail_PK (비급여 항목 연결)
    editData?: MedicineUsage;  // 상비약 수정 모드용
    yakchimEditData?: YakchimUsageRecord;  // 약침 수정 모드용
    packageEditData?: TreatmentPackage;    // 패키지 수정 모드용
    membershipEditData?: Membership;       // 멤버십 수정 모드용
    herbalMode?: 'deduct-herbal' | 'deduct-nokryong' | 'register';  // 한약 패널 모드
    herbalPickupEditData?: HerbalPickup & { memoId?: number };  // 한약 차감 수정 모드용
  } | null>(null);

  // 타임라인 영역에 표시할 인라인 패널 상태 (한약/약침/커스텀메모)
  const [showInlinePanel, setShowInlinePanel] = useState<{
    type: 'herbal' | 'yakchim' | 'customMemo';
    detailId?: number;
    itemName?: string;
    amount?: number;
    memoDate?: string;  // 커스텀 메모 추가 시 날짜
  } | null>(null);

  // 비급여 항목 통합 모달 상태
  const [uncoveredModal, setUncoveredModal] = useState<{
    itemName: string;
    itemType: UncoveredItemType;
    amount: number;
    detailId?: number;
    isEditMode?: boolean;
  } | null>(null);

  // 커스텀 메모 입력 상태
  const [customMemoText, setCustomMemoText] = useState('');
  const [memoTypes, setMemoTypesState] = useState<MemoType[]>([]);
  const [selectedMemoTypeId, setSelectedMemoTypeId] = useState<number | null>(null);

  // 메모 종류 목록 로드
  useEffect(() => {
    getMemoTypes().then(types => {
      setMemoTypesState(types);
      if (types.length > 0) {
        setSelectedMemoTypeId(types[0].id);
      }
    }).catch(err => console.error('메모 종류 로드 실패:', err));
  }, []);

  // 타임라인 새로고침 트리거
  const [timelineRefreshTrigger, setTimelineRefreshTrigger] = useState(0);

  // 등록 모달 상태 (레거시 - 개별 등록용)
  const [registerModal, setRegisterModal] = useState<{
    type: 'package' | 'membership' | 'herbal';
    editHerbalPackage?: HerbalPackage;  // 수정 모드: 기존 한약 패키지 데이터
    editNokryongPackage?: NokryongPackage;  // 수정 모드: 기존 녹용 패키지 데이터
    editMemoId?: number;                 // 수정 모드: 연결된 메모 ID
    defaultTab?: 'herbal' | 'nokryong'; // 한약 모달 기본 탭
  } | null>(null);

  // 패키지 통합 관리 모달
  const [showPackageModal, setShowPackageModal] = useState(false);

  // 빠른 패키지 등록 모달
  const [quickAddType, setQuickAddType] = useState<'herbal' | 'nokryong' | 'treatment' | 'membership' | null>(null);

  // 환자 보유 패키지 상태
  const [activePackages, setActivePackages] = useState<{
    herbal: (HerbalPackage & { diseaseTags?: string[] })[];
    nokryong: NokryongPackage[];
    treatment: TreatmentPackage[];
    membership: Membership[];
  }>({ herbal: [], nokryong: [], treatment: [], membership: [] });

  // 오늘 패키지 사용기록 (추가 내역 표시용)
  const [todayUsages, setTodayUsages] = useState<PackageUsage[]>([]);

  // 패키지 관리 모달 상태
  const [pkgManageModal, setPkgManageModal] = useState<{
    type: 'herbal' | 'nokryong' | 'treatment' | 'membership';
    packages: Array<{
      id: number;
      name: string;
      total: number;
      remaining: number;
      newRemaining: number;
      deleted?: boolean;
      // 멤버십용 날짜 필드
      startDate?: string;
      expireDate?: string;
      newStartDate?: string;
      newExpireDate?: string;
    }>;
  } | null>(null);

  // 패키지 히스토리 상태 (pkgManageModal 하단에 표시)
  const [pkgHistory, setPkgHistory] = useState<{
    history: PackageHistoryItem[];
    loading: boolean;
  }>({ history: [], loading: false });

  // 패키지 관리 모달 열릴 때 히스토리 로드 (모든 타입)
  useEffect(() => {
    if (pkgManageModal && pkgManageModal.packages.length > 0) {
      const loadAllHistory = async () => {
        setPkgHistory({ history: [], loading: true });
        try {
          // 타입에 따라 적절한 히스토리 API 호출
          let allHistories: PackageHistoryItem[][] = [];
          if (pkgManageModal.type === 'treatment') {
            allHistories = await Promise.all(
              pkgManageModal.packages.map(pkg => getPackageHistory(pkg.id))
            );
          } else if (pkgManageModal.type === 'herbal') {
            allHistories = await Promise.all(
              pkgManageModal.packages.map(pkg => getHerbalPackageHistory(pkg.id))
            );
          } else if (pkgManageModal.type === 'nokryong') {
            allHistories = await Promise.all(
              pkgManageModal.packages.map(pkg => getNokryongPackageHistory(pkg.id))
            );
          } else if (pkgManageModal.type === 'membership') {
            allHistories = await Promise.all(
              pkgManageModal.packages.map(pkg => getMembershipHistory(pkg.id))
            );
          }
          // 모든 히스토리를 합치고 날짜순 정렬
          const mergedHistory = allHistories.flat().sort((a, b) => b.date.localeCompare(a.date));
          setPkgHistory({ history: mergedHistory, loading: false });
        } catch (err) {
          console.error('히스토리 로드 실패:', err);
          setPkgHistory({ history: [], loading: false });
        }
      };
      loadAllHistory();
    } else {
      setPkgHistory({ history: [], loading: false });
    }
  }, [pkgManageModal?.type, pkgManageModal?.packages.length]);

  // 메모 인라인 편집 상태
  const [editingMemo, setEditingMemo] = useState<{ id: number; text: string } | null>(null);

  // 인라인 메모 추가 상태
  const [isAddingMemo, setIsAddingMemo] = useState(false);
  const [newMemoText, setNewMemoText] = useState('');

  // 진료상세내역 (오른쪽 패널 왼쪽 단)
  const [detailItems, setDetailItems] = useState<ReceiptDetailItem[]>([]);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  // 리사이즈 핸들 상태
  const [listPanelWidth, setListPanelWidth] = useState<number | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const listPanelRef = useRef<HTMLDivElement>(null);

  // 리사이즈 핸들 드래그
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const containerRect = containerRef.current.getBoundingClientRect();
      const newWidth = e.clientX - containerRect.left;
      const minWidth = 430;  // columns(356) + gaps(24) + padding(32) + scrollbar(17)
      const maxWidth = containerRect.width * 0.5;
      setListPanelWidth(Math.max(minWidth, Math.min(maxWidth, newWidth)));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

  // 수납 행 클릭 시 환자 선택 및 이력 로드
  const handleReceiptRowClick = async (receipt: ExpandedReceiptItem) => {
    // 이미 선택된 항목 클릭 시 선택 해제
    if (selectedReceipt?.id === receipt.id) {
      setSelectedReceipt(null);
      setSelectedPatientHistory([]);
      setPreviousMemos([]);
      setDetailItems([]);
      setMemoInputMode(null);
      setActivePackages({ herbal: [], nokryong: [], treatment: [], membership: [] });
      return;
    }

    setSelectedReceipt(receipt);
    setMemoInputMode(null); // 다른 환자 선택 시 메모 입력 패널 닫기
    setShowInlinePanel(null); // 다른 환자 선택 시 인라인 패널 닫기
    setIsLoadingHistory(true);
    setIsLoadingDetails(true);
    setDetailItems([]);

    // 병렬로 수납이력과 진료상세내역 로드
    const loadHistory = async () => {
      try {
        const response = await fetchPatientReceiptHistory({
          patientId: receipt.patient_id,
          limit: 10,
        });
        const historyReceipts = response.receipts || [];

        // 날짜별로 그룹화하여 중복 조회 방지
        const uniqueDates = [...new Set(historyReceipts.map(r => r.receipt_date))];

        // 각 날짜별 메모 데이터 조회 (패키지, 사용내역 등)
        const dateDataMap = new Map<string, any>();
        await Promise.all(
          uniqueDates.map(async (date) => {
            const data = await getPatientMemoData(receipt.patient_id, date).catch(() => null);
            if (data) dateDataMap.set(date, data);
          })
        );

        // 각 수납별 개별 메모 조회 (mssql_receipt_id 기준) - 여러 개 가능
        const receiptMemoPromises = historyReceipts.map(r =>
          getReceiptMemosByReceiptId(r.id).catch(() => [])
        );
        const receiptMemosArray = await Promise.all(receiptMemoPromises);

        const expandedHistory: ExpandedReceiptItem[] = historyReceipts.map((r, idx) => {
          const data = dateDataMap.get(r.receipt_date);
          const individualMemos = receiptMemosArray[idx] || []; // 수납별 메모 배열

          if (data) {
            const memoItems = generateMemoSummaryItems({
              treatmentPackages: data.treatmentPackages,
              herbalPackages: data.herbalPackages,
              nokryongPackages: data.nokryongPackages,
              packageUsages: data.packageUsages,
              herbalPickups: data.herbalPickups,
              pointUsed: data.todayPointUsed,
              pointEarned: data.todayPointEarned,
              membership: data.membership || undefined,
              herbalDispensings: data.herbalDispensings,
              giftDispensings: data.giftDispensings,
              documentIssues: data.documentIssues,
              medicineUsages: data.medicineUsages,
              yakchimUsageRecords: data.yakchimUsageRecords,
              date: r.receipt_date,  // 등록일 확인용
            });

            return {
              ...r,
              treatmentPackages: data.treatmentPackages || [],
              herbalPackages: data.herbalPackages || [],
              herbalPickups: data.herbalPickups || [],
              nokryongPackages: data.nokryongPackages || [],
              pointBalance: data.pointBalance || 0,
              todayPointUsed: data.todayPointUsed || 0,
              todayPointEarned: data.todayPointEarned || 0,
              activeMembership: data.membership || null,
              herbalDispensings: data.herbalDispensings || [],
              giftDispensings: data.giftDispensings || [],
              documentIssues: data.documentIssues || [],
              medicineUsages: data.medicineUsages || [],
              yakchimUsageRecords: data.yakchimUsageRecords || [],
              memberships: data.membership ? [data.membership] : [],
              receiptMemos: individualMemos, // 수납별 메모 배열
              nextReservation: null,
              isExpanded: false,
              isLoading: false,
              memoItems,
              isCompleted: false,
              hasYakchimMemo: (data.treatmentPackages?.filter((p: any) => p.package_name?.includes('약침')) || []).length > 0,
              hasHerbalMemo: (data.herbalPackages?.length || 0) > 0 || (data.herbalDispensings?.length || 0) > 0,
              hasMedicineMemo: (data.medicineUsages?.length || 0) > 0,
              hasGongjindanMemo: false,
              hasGyeongokgoMemo: false,
              hasDietMemo: false,
            };
          }

          return {
            ...r,
            treatmentPackages: [],
            herbalPackages: [],
            herbalPickups: [],
            nokryongPackages: [],
            pointBalance: 0,
            todayPointUsed: 0,
            todayPointEarned: 0,
            activeMembership: null,
            herbalDispensings: [],
            giftDispensings: [],
            documentIssues: [],
            medicineUsages: [],
            yakchimUsageRecords: [],
            memberships: [],
            receiptMemos: individualMemos, // 수납별 메모 배열
            nextReservation: null,
            isExpanded: false,
            isLoading: false,
            memoItems: [],
            isCompleted: false,
            hasYakchimMemo: false,
            hasHerbalMemo: false,
            hasMedicineMemo: false,
            hasGongjindanMemo: false,
            hasGyeongokgoMemo: false,
            hasDietMemo: false,
          };
        });

        setSelectedPatientHistory(expandedHistory);

        // 이전 메모 로드 (일반메모 + 비급여메모 통합)
        const prevMemos = await fetchPatientPreviousMemos(
          receipt.patient_id,
          selectedDate,  // 오늘 날짜 제외
          20
        ).catch(() => []);
        setPreviousMemos(prevMemos);

        // selectedReceipt도 확장된 데이터로 업데이트 (medicineUsages 등 포함)
        // receipt.receipt_date가 없을 수 있음 (날짜별 조회 시) -> selectedDate 사용
        const targetDate = receipt.receipt_date || selectedDate;
        const updatedReceipt = expandedHistory.find(
          h => h.id === receipt.id && h.receipt_date === targetDate
        );
        if (updatedReceipt) {
          setSelectedReceipt(updatedReceipt);
        }
      } catch (err) {
        console.error('수납이력 로드 실패:', err);
        setSelectedPatientHistory([]);
        setPreviousMemos([]);
      } finally {
        setIsLoadingHistory(false);
      }
    };

    const loadDetails = async () => {
      try {
        const details = await fetchReceiptDetails(receipt.patient_id, receipt.receipt_date);
        setDetailItems(details);
      } catch (err) {
        console.error('진료상세내역 로드 실패:', err);
        setDetailItems([]);
      } finally {
        setIsLoadingDetails(false);
      }
    };

    // 병렬 실행
    await Promise.all([loadHistory(), loadDetails()]);

    // 환자의 활성 패키지 및 오늘 사용기록 로드
    try {
      const [packages, usages] = await Promise.all([
        getAllActivePackages(receipt.patient_id),
        getPackageUsagesByDate(receipt.patient_id, selectedDate),
      ]);
      // 한약 패키지에 질환 태그 추가
      const herbalWithTags = await Promise.all(
        packages.herbal.map(async (pkg) => {
          const tags = await getPackageDiseaseTags(pkg.id!).catch(() => []);
          return { ...pkg, diseaseTags: tags.map(t => t.name) };
        })
      );
      setActivePackages({
        ...packages,
        herbal: herbalWithTags,
      });
      setTodayUsages(usages);
    } catch (err) {
      console.error('활성 패키지 로드 실패:', err);
      setActivePackages({ herbal: [], nokryong: [], treatment: [], membership: [] });
      setTodayUsages([]);
    }
  };

  // 선택된 환자의 메모 데이터만 새로고침 (로딩 상태 없이)
  const refreshSelectedPatientHistory = async () => {
    if (!selectedReceipt) return;

    try {
      const response = await fetchPatientReceiptHistory({
        patientId: selectedReceipt.patient_id,
        limit: 10,
      });
      const historyReceipts = response.receipts || [];

      const uniqueDates = [...new Set(historyReceipts.map(r => r.receipt_date))];
      const dateDataMap = new Map<string, any>();
      await Promise.all(
        uniqueDates.map(async (date) => {
          const data = await getPatientMemoData(selectedReceipt.patient_id, date).catch(() => null);
          if (data) dateDataMap.set(date, data);
        })
      );

      const receiptMemoPromises = historyReceipts.map(r =>
        getReceiptMemosByReceiptId(r.id).catch(() => [])
      );
      const receiptMemosArray = await Promise.all(receiptMemoPromises);

      const expandedHistory: ExpandedReceiptItem[] = historyReceipts.map((r, idx) => {
        const data = dateDataMap.get(r.receipt_date);
        const individualMemos = receiptMemosArray[idx] || [];

        if (data) {
          const memoItems = generateMemoSummaryItems({
            treatmentPackages: data.treatmentPackages,
            herbalPackages: data.herbalPackages,
            nokryongPackages: data.nokryongPackages,
            packageUsages: data.packageUsages,
            herbalPickups: data.herbalPickups,
            pointUsed: data.todayPointUsed,
            pointEarned: data.todayPointEarned,
            membership: data.membership || undefined,
            herbalDispensings: data.herbalDispensings,
            giftDispensings: data.giftDispensings,
            documentIssues: data.documentIssues,
            medicineUsages: data.medicineUsages,
            yakchimUsageRecords: data.yakchimUsageRecords,
            date: r.receipt_date,  // 등록일 확인용
          });

          return {
            ...r,
            treatmentPackages: data.treatmentPackages || [],
            herbalPackages: data.herbalPackages || [],
            herbalPickups: data.herbalPickups || [],
            nokryongPackages: data.nokryongPackages || [],
            pointBalance: data.pointBalance || 0,
            todayPointUsed: data.todayPointUsed || 0,
            todayPointEarned: data.todayPointEarned || 0,
            activeMembership: data.membership || null,
            herbalDispensings: data.herbalDispensings || [],
            giftDispensings: data.giftDispensings || [],
            documentIssues: data.documentIssues || [],
            medicineUsages: data.medicineUsages || [],
            yakchimUsageRecords: data.yakchimUsageRecords || [],
            memberships: data.membership ? [data.membership] : [],
            receiptMemos: individualMemos,
            nextReservation: null,
            isExpanded: false,
            isLoading: false,
            memoItems,
            isCompleted: false,
            hasYakchimMemo: (data.treatmentPackages?.filter((p: any) => p.package_name?.includes('약침')) || []).length > 0,
            hasHerbalMemo: (data.herbalPackages?.length || 0) > 0 || (data.herbalDispensings?.length || 0) > 0,
            hasMedicineMemo: (data.medicineUsages?.length || 0) > 0,
            hasGongjindanMemo: false,
            hasGyeongokgoMemo: false,
            hasDietMemo: false,
          };
        }

        return {
          ...r,
          treatmentPackages: [],
          herbalPackages: [],
          herbalPickups: [],
          nokryongPackages: [],
          pointBalance: 0,
          todayPointUsed: 0,
          todayPointEarned: 0,
          activeMembership: null,
          herbalDispensings: [],
          giftDispensings: [],
          documentIssues: [],
          medicineUsages: [],
          yakchimUsageRecords: [],
          memberships: [],
          receiptMemos: individualMemos,
          nextReservation: null,
          isExpanded: false,
          isLoading: false,
          memoItems: [],
          isCompleted: false,
          hasYakchimMemo: false,
          hasHerbalMemo: false,
          hasMedicineMemo: false,
          hasGongjindanMemo: false,
          hasGyeongokgoMemo: false,
          hasDietMemo: false,
        };
      });

      setSelectedPatientHistory(expandedHistory);

      // selectedReceipt도 갱신 (hasMemoForDetail이 최신 데이터 참조하도록)
      // receipt_date가 없을 수 있음 (날짜별 조회 시) -> selectedDate 사용
      if (selectedReceipt) {
        const targetDate = selectedReceipt.receipt_date || selectedDate;
        const updatedReceipt = expandedHistory.find(
          h => h.id === selectedReceipt.id && h.receipt_date === targetDate
        );
        if (updatedReceipt) {
          setSelectedReceipt(updatedReceipt);
        }
      }

      // 활성 패키지 및 오늘 사용기록 새로고침
      const [packages, usages] = await Promise.all([
        getAllActivePackages(selectedReceipt.patient_id),
        getPackageUsagesByDate(selectedReceipt.patient_id, selectedDate),
      ]);
      const herbalWithTags = await Promise.all(
        packages.herbal.map(async (pkg) => {
          const tags = await getPackageDiseaseTags(pkg.id!).catch(() => []);
          return { ...pkg, diseaseTags: tags.map(t => t.name) };
        })
      );
      setActivePackages({
        ...packages,
        herbal: herbalWithTags,
      });
      setTodayUsages(usages);

      // 타임라인 새로고침 트리거
      setTimelineRefreshTrigger(prev => prev + 1);
    } catch (err) {
      console.error('메모 데이터 새로고침 실패:', err);
    }
  };

  // 환자 클릭 시 대시보드 모달 열기
  const handlePatientClick = async (receipt: ExpandedReceiptItem, e: React.MouseEvent) => {
    e.stopPropagation();
    let localPatient = await getLocalPatientByMssqlId(receipt.patient_id);
    if (!localPatient) {
      localPatient = await syncPatientById(receipt.patient_id);
    }
    if (localPatient) {
      setDashboardPatient(localPatient);
      setShowDashboardModal(true);
    }
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

    // 리로딩 시작 시 사이드패널 초기화
    setSelectedReceipt(null);
    setSelectedPatientHistory([]);
    setDetailItems([]);
    setMemoInputMode(null);
    setEditingMemo(null);
    setIsAddingMemo(false);
    setNewMemoText('');
    setActivePackages({ herbal: [], nokryong: [], treatment: [], membership: [] });

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
        herbalPickups: [],
        nokryongPackages: [],
        pointBalance: 0,
        todayPointUsed: 0,
        todayPointEarned: 0,
        activeMembership: null,
        memberships: [],
        herbalDispensings: [],
        giftDispensings: [],
        documentIssues: [],
        medicineUsages: [],
        yakchimUsageRecords: [],
        receiptMemos: [],
        nextReservation: null,
        isExpanded: false,
        isLoading: false,
        memoItems: [],
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
    const today = getCurrentDate();
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
    const today = getCurrentDate();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 60);
    const endDate = `${futureDate.getFullYear()}-${String(futureDate.getMonth() + 1).padStart(2, '0')}-${String(futureDate.getDate()).padStart(2, '0')}`;

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
        const memoItems = generateMemoSummaryItems({
          treatmentPackages: data.treatmentPackages,
          herbalPackages: data.herbalPackages,
          nokryongPackages: data.nokryongPackages,
          packageUsages: data.packageUsages,
          herbalPickups: data.herbalPickups,
          pointUsed: data.todayPointUsed,
          pointEarned: data.todayPointEarned,
          membership: data.membership || undefined,
          herbalDispensings: data.herbalDispensings,
          giftDispensings: data.giftDispensings,
          documentIssues: data.documentIssues,
          medicineUsages: data.medicineUsages,
          yakchimUsageRecords: data.yakchimUsageRecords,
          date: selectedDate,  // 등록일 확인용
        });

        // 해당 환자의 다음 예약 찾기
        const patientReservations = reservationsByPatient.get(item.patient_id) || [];
        const nextReservation = getNextReservation(patientReservations);

        // 빠른 메모 버튼 상태 체크 및 요약 생성
        const yakchimPackages = data.treatmentPackages?.filter((p: any) =>
          p.package_name?.includes('약침')
        ) || [];
        const hasYakchimMemo = yakchimPackages.length > 0;
        const yakchimMemoSummary = hasYakchimMemo
          ? yakchimPackages.map((p: any) => p.package_name?.replace('약침', '').trim() || '약침').join(',')
          : undefined;

        const herbalItems = [
          ...(data.herbalPackages || []).map((p: any) => p.package_name),
          ...(data.herbalDispensings || []).map((d: any) => d.name),
        ].filter(Boolean);
        const hasHerbalMemo = herbalItems.length > 0;
        const herbalMemoSummary = hasHerbalMemo ? herbalItems.slice(0, 2).join(',') : undefined;

        const hasMedicineMemo = (data.medicineUsages?.length > 0);
        const medicineMemoSummary = hasMedicineMemo
          ? data.medicineUsages.map((m: any) => m.medicine_name || m.name).slice(0, 2).join(',')
          : undefined;

        const gongjindanItems = [
          ...(data.herbalPackages || []).filter((p: any) => p.package_name?.includes('공진단')).map((p: any) => p.package_name),
          ...(data.herbalDispensings || []).filter((d: any) => d.name?.includes('공진단')).map((d: any) => d.name),
        ];
        const hasGongjindanMemo = gongjindanItems.length > 0;
        const gongjindanMemoSummary = hasGongjindanMemo ? gongjindanItems[0] : undefined;

        const gyeongokgoItems = [
          ...(data.herbalPackages || []).filter((p: any) => p.package_name?.includes('경옥고')).map((p: any) => p.package_name),
          ...(data.herbalDispensings || []).filter((d: any) => d.name?.includes('경옥고')).map((d: any) => d.name),
        ];
        const hasGyeongokgoMemo = gyeongokgoItems.length > 0;
        const gyeongokgoMemoSummary = hasGyeongokgoMemo ? gyeongokgoItems[0] : undefined;

        const dietItems = [
          ...(data.herbalPackages || []).filter((p: any) => p.package_name?.includes('린') || p.package_name?.includes('체감탕')).map((p: any) => p.package_name),
          ...(data.herbalDispensings || []).filter((d: any) => d.name?.includes('린') || d.name?.includes('체감탕')).map((d: any) => d.name),
        ];
        const hasDietMemo = dietItems.length > 0;
        const dietMemoSummary = hasDietMemo ? dietItems[0] : undefined;

        return {
          patient_id: item.patient_id,
          memoItems,
          memo: data.memo,  // 전체 메모 객체 저장
          reservationStatus: 'none' as ReservationStatus,
          reservationDate: undefined,
          nextReservation,
          hasYakchimMemo,
          hasHerbalMemo,
          hasMedicineMemo,
          hasGongjindanMemo,
          hasGyeongokgoMemo,
          hasDietMemo,
          yakchimMemoSummary,
          herbalMemoSummary,
          medicineMemoSummary,
          gongjindanMemoSummary,
          gyeongokgoMemoSummary,
          dietMemoSummary,
        };
      } else {
        // 메모 데이터 없음
        const patientReservations = reservationsByPatient.get(item.patient_id) || [];
        const nextReservation = getNextReservation(patientReservations);

        return {
          patient_id: item.patient_id,
          memoItems: [] as MemoSummaryItem[],
          memo: null,
          reservationStatus: 'none' as ReservationStatus,
          nextReservation,
          hasYakchimMemo: false,
          hasHerbalMemo: false,
          hasMedicineMemo: false,
          hasGongjindanMemo: false,
          hasGyeongokgoMemo: false,
          hasDietMemo: false,
          yakchimMemoSummary: undefined,
          herbalMemoSummary: undefined,
          medicineMemoSummary: undefined,
          gongjindanMemoSummary: undefined,
          gyeongokgoMemoSummary: undefined,
          dietMemoSummary: undefined,
        };
      }
    });

    setReceipts(prev => prev.map(item => {
      const update = updates.find(u => u.patient_id === item.patient_id);
      if (update) {
        return {
          ...item,
          memoItems: update.memoItems,
          nextReservation: update.nextReservation,
          receiptMemos: update.memo ? [update.memo] : (item.receiptMemos || []),
          hasYakchimMemo: update.hasYakchimMemo,
          hasHerbalMemo: update.hasHerbalMemo,
          hasMedicineMemo: update.hasMedicineMemo,
          hasGongjindanMemo: update.hasGongjindanMemo,
          hasGyeongokgoMemo: update.hasGyeongokgoMemo,
          hasDietMemo: update.hasDietMemo,
          yakchimMemoSummary: update.yakchimMemoSummary,
          herbalMemoSummary: update.herbalMemoSummary,
          medicineMemoSummary: update.medicineMemoSummary,
          gongjindanMemoSummary: update.gongjindanMemoSummary,
          gyeongokgoMemoSummary: update.gyeongokgoMemoSummary,
          dietMemoSummary: update.dietMemoSummary,
        };
      }
      return item;
    }));
  };

  // 날짜 변경 시 데이터 로드
  useEffect(() => {
    loadReceipts();
  }, [loadReceipts]);

  // 수납이력에서 날짜 클릭 시 해당 환자 자동 선택
  useEffect(() => {
    if (!isLoading && receipts.length > 0 && pendingPatientSelectRef.current !== null) {
      const patientId = pendingPatientSelectRef.current;
      const targetReceipt = receipts.find(r => r.patient_id === patientId);
      if (targetReceipt) {
        handleReceiptRowClick(targetReceipt);
      }
      pendingPatientSelectRef.current = null;
    }
  }, [isLoading, receipts]);

  // 메모 태그 클릭 핸들러 (타입별 인라인 패널 열기)
  const handleMemoTagClick = (item: MemoSummaryItem, receipt: ExpandedReceiptItem) => {
    switch (item.type) {
      case 'yakchim-membership':
      case 'yakchim-package':
      case 'yakchim-onetime':
        // 약침 인라인 패널 열기 (수정 모드)
        // item.data가 배열인 경우 (멤버십) 첫 번째 레코드 사용
        const yakchimRecord = Array.isArray(item.data) ? item.data[0] : item.data;
        if (yakchimRecord) {
          setMemoInputMode({
            itemName: '약침 수정',
            itemType: 'yakchim',
            yakchimEditData: yakchimRecord as YakchimUsageRecord,
          });
        }
        break;
      case 'treatment-package':
        // 시술패키지 → 인라인 패널 열기 (수정/삭제)
        setMemoInputMode({
          itemName: '패키지 수정',
          itemType: 'package-edit',
          packageEditData: item.data as TreatmentPackage,
        });
        break;
      case 'herbal-package':
      case 'herbal-dispensing':
        // 한약 → 선결제 차감 모드로 열기
        setMemoInputMode({
          itemName: item.label,
          itemType: 'herbal',
          herbalMode: 'deduct-herbal',
        });
        break;
      case 'point-used':
      case 'point-earned':
        // 포인트 → 현재는 특별 처리 없음
        break;
      case 'membership':
        // 멤버십 인라인 패널 열기 (수정 모드)
        if (item.data) {
          setMemoInputMode({
            itemName: '멤버십 수정',
            itemType: 'membership-edit',
            membershipEditData: item.data as Membership,
          });
        }
        break;
      case 'gift-dispensing':
      case 'document':
        // 증정품/서류 → 현재는 특별 처리 없음
        break;
      case 'medicine':
        // 상비약 인라인 패널 열기 (수정 모드)
        setMemoInputMode({
          itemName: '상비약 수정',
          itemType: 'medicine',
          editData: item.data as MedicineUsage,
        });
        break;
      default:
        // 기타 타입은 현재 특별 처리 없음
        break;
    }
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

  // 메모 입력 제외 항목 (미입력 뱃지도 표시 안함)
  const isExcludedFromMemo = (itemName: string) => itemName.includes('부항술혈명');

  // 클릭 시 모달 열지 않는 항목 (미입력 뱃지는 표시)
  const isClickDisabled = (itemName: string) =>
    itemName.includes('부항술혈명');

  // 비급여 항목 클릭 시 통합 모달 열기
  const handleUncoveredItemClick = (itemName: string, amount: number, detailId?: number) => {
    // 클릭 비활성화 항목
    if (isClickDisabled(itemName)) {
      return;
    }

    // 이미 처리된 항목이면 수정 모드로 모달 열기
    const isEdit = !!(detailId && hasMemoForDetail(detailId));

    // 약침포인트 → 패키지(통증마일리지) 등록
    if (itemName.includes('약침포인트')) {
      setUncoveredModal({ itemName: '통증마일리지', itemType: 'package', amount, detailId, isEditMode: isEdit });
      return;
    }

    // 멤버십 → 멤버십 등록
    if (itemName.includes('멤버십')) {
      setUncoveredModal({ itemName, itemType: 'membership', amount, detailId, isEditMode: isEdit });
      return;
    }

    // 약침/요법 → 약침 모달
    if (itemName.includes('약침') || itemName.includes('요법')) {
      setUncoveredModal({ itemName, itemType: 'yakchim', amount, detailId, isEditMode: isEdit });
      return;
    }

    // 한약 → 한약 차감 모달
    if (itemName.includes('한약')) {
      setUncoveredModal({ itemName, itemType: 'herbal', amount, detailId, isEditMode: isEdit });
      return;
    }

    // 녹용 → 녹용 차감 모달 (활성화!)
    if (itemName.includes('녹용')) {
      setUncoveredModal({ itemName, itemType: 'nokryong', amount, detailId, isEditMode: isEdit });
      return;
    }

    // 공진단/경옥고/상비약/감기약/치료약/보완처방/증정 → 상비약 모달
    if (itemName.includes('공진단') ||
        itemName.includes('경옥고') ||
        itemName.includes('상비약') ||
        itemName.includes('감기약') ||
        itemName.includes('치료약') ||
        itemName.includes('보완처방') ||
        itemName.includes('증정')) {
      setUncoveredModal({ itemName, itemType: 'medicine', amount, detailId, isEditMode: isEdit });
      return;
    }

    // 기본값: 일반 메모 모달
    setUncoveredModal({ itemName, itemType: 'other', amount, detailId, isEditMode: isEdit });
  };

  // 메모 입력 모드 닫기
  const handleCloseMemoInput = () => {
    setMemoInputMode(null);
  };

  // 비급여 항목에 대한 메모 존재 여부 확인
  const hasMemoForDetail = (detailId: number): boolean => {
    if (!selectedReceipt) return false;
    return (
      selectedReceipt.yakchimUsageRecords?.some(r => r.mssql_detail_id === detailId) ||
      selectedReceipt.medicineUsages?.some(m => m.mssql_detail_id === detailId) ||
      selectedReceipt.herbalDispensings?.some(h => h.mssql_detail_id === detailId) ||
      selectedReceipt.treatmentPackages?.some(p => p.mssql_detail_id === detailId) ||
      selectedReceipt.memberships?.some(m => m.mssql_detail_id === detailId) ||
      selectedReceipt.receiptMemos?.some(m => m.mssql_detail_id === detailId) ||
      selectedReceipt.herbalPickups?.some(p => p.mssql_detail_id === detailId) ||
      selectedReceipt.nokryongPackages?.some(p => p.mssql_detail_id === detailId) ||
      false
    );
  };

  // 메모 인라인 편집 시작
  const handleStartEditMemo = async (memo: ReceiptMemo) => {
    if (!memo.id) return;

    // "선결제" 포함 메모면 패키지 수정 모달 열기 (환자의 활성 한약 패키지에서 매칭)
    if (memo.memo?.includes('선결제') && selectedReceipt) {
      const packages = await getActiveHerbalPackages(selectedReceipt.patient_id);
      const pkg = packages.find(p => memo.memo?.includes(p.herbal_name)) || packages[0] || null;
      if (pkg) {
        setRegisterModal({
          type: 'herbal',
          editHerbalPackage: pkg,
          editMemoId: memo.id,
        });
        return;
      }
    }

    // "선결(" 포함 메모면 차감 수정 패널 열기
    if (memo.memo?.includes('선결(') && selectedReceipt) {
      // receipt_id로 pickup 검색
      let pickup: HerbalPickup | null = null;
      if (memo.mssql_receipt_id) {
        pickup = await getHerbalPickupByReceiptId(memo.mssql_receipt_id);
      }

      if (pickup) {
        // 해당 비급여 항목 찾기 (한약 관련)
        const herbalItem = selectedReceipt.uncoveredItems?.find(item =>
          item.name.includes('한약')
        );
        setMemoInputMode({
          patientId: selectedReceipt.patient_id,
          patientName: selectedReceipt.patient_name,
          chartNumber: selectedReceipt.chart_no,
          itemName: herbalItem?.name || '한약',
          itemType: 'herbal',
          detailId: herbalItem?.id,
          herbalMode: 'deduct-herbal',
          herbalPickupEditData: { ...pickup, memoId: memo.id },
        });
        return;
      }
    }

    // "녹용" 포함 메모면 녹용 수정 모달 열기
    if (memo.memo?.includes('녹용') && selectedReceipt) {
      let pkg: NokryongPackage | null = null;

      // 환자의 녹용 패키지 중 메모 텍스트와 매칭되는 것 찾기
      const packages = await getNokryongPackages(selectedReceipt.patient_id);
      pkg = packages.find(p => memo.memo?.includes(p.package_name)) || packages[0] || null;

      if (pkg) {
        setRegisterModal({
          type: 'herbal',
          editNokryongPackage: pkg,
          editMemoId: memo.id,
          defaultTab: 'nokryong',
        });
        return;
      }
    }

    // 일반 메모는 인라인 편집
    setEditingMemo({ id: memo.id, text: memo.memo || '' });
  };

  // 메모 인라인 편집 저장
  const handleSaveEditMemo = async () => {
    if (!editingMemo) return;
    try {
      if (editingMemo.text.trim()) {
        await updateReceiptMemoById(editingMemo.id, editingMemo.text);
      } else {
        // 빈 메모는 삭제
        await deleteReceiptMemoById(editingMemo.id);
      }
      setEditingMemo(null);
      await refreshSelectedPatientHistory();
    } catch (err) {
      console.error('메모 저장 실패:', err);
      alert('메모 저장에 실패했습니다.');
    }
  };

  // 메모 인라인 편집 취소
  const handleCancelEditMemo = () => {
    setEditingMemo(null);
  };

  // 타임라인 이벤트 클릭 핸들러 (인라인 패널용 - 현재는 사용 안함)
  const handleTimelineEventClick = async (event: TimelineEvent) => {
    // renderTimelineEditPanel에서 처리하므로 여기서는 아무것도 하지 않음
  };

  // 타임라인 인라인 편집 패널 렌더링
  const renderTimelineEditPanel = (event: TimelineEvent, onClose: () => void, onReload: () => void) => {
    if (!selectedReceipt) return null;

    const handleOpenHerbalModal = () => {
      const pkg = event.originalData as HerbalPackage;
      if (pkg) {
        setRegisterModal({
          type: 'herbal',
          editHerbalPackage: pkg,
        });
        onClose();
      }
    };

    const handleOpenNokryongModal = () => {
      const pkg = event.originalData as NokryongPackage;
      if (pkg) {
        setRegisterModal({
          type: 'herbal',
          editNokryongPackage: pkg,
          defaultTab: 'nokryong',
        });
        onClose();
      }
    };

    const handleSaveMemo = async (memoId: number, newText: string) => {
      try {
        if (newText.trim()) {
          await updateReceiptMemoById(memoId, newText);
        } else {
          await deleteReceiptMemoById(memoId);
        }
        await refreshSelectedPatientHistory();
        onReload();
        onClose();
      } catch (err) {
        console.error('메모 저장 실패:', err);
        alert('메모 저장에 실패했습니다.');
      }
    };

    const handleDeleteMemo = async (memoId: number) => {
      if (!confirm('이 메모를 삭제하시겠습니까?')) return;
      try {
        await deleteReceiptMemoById(memoId);
        await refreshSelectedPatientHistory();
        onReload();
        onClose();
      } catch (err) {
        console.error('메모 삭제 실패:', err);
      }
    };

    switch (event.type) {
      case 'herbal_package_add': {
        const pkg = event.originalData as HerbalPackage;
        if (!pkg) return null;
        return (
          <InlineHerbalPackageEdit
            pkg={pkg}
            onSuccess={() => {
              refreshSelectedPatientHistory();
              onReload();
            }}
            onClose={onClose}
          />
        );
      }

      case 'nokryong_package_add': {
        const pkg = event.originalData as NokryongPackage;
        if (!pkg) return null;
        return (
          <InlineNokryongPackageEdit
            pkg={pkg}
            onSuccess={() => {
              refreshSelectedPatientHistory();
              onReload();
            }}
            onClose={onClose}
          />
        );
      }

      case 'custom_memo': {
        const memo = event.originalData as ReceiptMemo;
        return (
          <InlineMemoEdit
            memo={memo}
            onSave={handleSaveMemo}
            onDelete={handleDeleteMemo}
            onClose={onClose}
          />
        );
      }

      case 'herbal_pickup': {
        const pickup = event.originalData as HerbalPickup;
        if (!pickup) return null;
        return (
          <InlineHerbalPickupEdit
            pickup={pickup}
            onSuccess={() => {
              refreshSelectedPatientHistory();
              onReload();
            }}
            onClose={onClose}
          />
        );
      }

      case 'treatment_package_add': {
        const pkg = event.originalData as TreatmentPackage;
        if (!pkg) return null;
        return (
          <InlineTreatmentPackageEdit
            pkg={pkg}
            onSuccess={() => {
              refreshSelectedPatientHistory();
              onReload();
            }}
            onClose={onClose}
          />
        );
      }

      case 'membership_add': {
        const mem = event.originalData as Membership;
        if (!mem) return null;
        return (
          <InlineMembershipEdit
            membership={mem}
            onSuccess={() => {
              refreshSelectedPatientHistory();
              onReload();
            }}
            onClose={onClose}
          />
        );
      }

      case 'yakchim-membership':
      case 'yakchim-package':
      case 'yakchim-onetime': {
        const record = event.originalData as YakchimUsageRecord;
        if (!record) return null;
        // 연결된 비급여 항목 찾기
        const uncoveredItems = selectedReceipt.treatment_summary?.uncovered || [];
        let linkedDetail = record.mssql_detail_id
          ? uncoveredItems.find(item => item.id === record.mssql_detail_id)
          : undefined;
        // mssql_detail_id가 없는 경우 약침 종류 이름으로 매칭 시도
        if (!linkedDetail && record.yakchim_types && record.yakchim_types.length > 0) {
          const yakchimName = record.yakchim_types[0]; // 첫 번째 약침 종류 이름
          linkedDetail = uncoveredItems.find(item =>
            item.name.includes(yakchimName) || yakchimName.includes(item.name.replace('약침', '').trim())
          );
        }
        return (
          <InlineYakchimEdit
            record={record}
            linkedDetailName={linkedDetail?.name}
            linkedDetailAmount={linkedDetail?.amount}
            onSuccess={() => {
              refreshSelectedPatientHistory();
              onReload();
            }}
            onClose={onClose}
          />
        );
      }

      case 'treatment_usage':
      case 'membership_usage':
      case 'nokryong_usage':
      default:
        return (
          <div className="timeline-edit-inline">
            <div className="timeline-edit-info">
              <p className="edit-info-message">이 항목은 현재 인라인 수정을 지원하지 않습니다.</p>
            </div>
            <div className="timeline-edit-actions">
              <button className="btn-close-inline" onClick={onClose}>
                닫기
              </button>
            </div>
          </div>
        );
    }
  };

  // 인라인 메모 추가 저장
  const handleSaveNewMemo = async () => {
    if (!newMemoText.trim() || !selectedReceipt) {
      setIsAddingMemo(false);
      setNewMemoText('');
      return;
    }
    try {
      await addReceiptMemo({
        patient_id: selectedReceipt.patient_id,
        chart_number: selectedReceipt.chart_no,
        patient_name: selectedReceipt.patient_name,
        mssql_receipt_id: selectedReceipt.id,
        receipt_date: selectedDate,
        memo: newMemoText.trim(),
      });
      setIsAddingMemo(false);
      setNewMemoText('');
      await refreshSelectedPatientHistory();
    } catch (err) {
      console.error('메모 추가 실패:', err);
      alert('메모 추가에 실패했습니다.');
    }
  };

  // 인라인 메모 추가 취소
  const handleCancelNewMemo = () => {
    setIsAddingMemo(false);
    setNewMemoText('');
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
            receiptMemos: data.memo ? [data.memo] : [],
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
      await updateReservationStatus(
        receipt.patient_id,
        selectedDate,
        status,
        reservationDate,
        receipt.id
      );

      setReceipts(prev => prev.map(r =>
        r.id === receipt.id ? {
          ...r,
          receiptStatus: {
            ...r.receiptStatus,
            receipt_id: receipt.id,
            patient_id: receipt.patient_id,
            receipt_date: selectedDate,
            is_completed: r.receiptStatus?.is_completed ?? false,
            reservation_status: status,
            reservation_date: reservationDate,
          },
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

    // 진료항목 파싱
    const treatments = receipt.treatments || [];
    const coveredTreatments = treatments.filter(t => t.is_covered);
    const items: string[] = [];

    // 추나 (급여/비급여 모두 확인)
    const hasChoona = treatments.some(t => t.name.includes('추나'));
    if (hasChoona) items.push('추나');

    // 침 (추나 외 급여항목이 있으면)
    const hasOtherCovered = coveredTreatments.some(t =>
      !t.name.includes('추나') && !t.name.includes('진찰료')
    );
    if (hasOtherCovered) items.push('침');

    // 한약 패키지(선결제) 잔여분 있으면 → 약재진(내원) 기본 추가
    const activeHerbalPackages = receipt.herbalPackages?.filter(pkg =>
      (pkg.total_count || 0) - (pkg.used_count || 0) > 0
    ) || [];
    if (activeHerbalPackages.length > 0) {
      items.push('약재진(내원)');
    }

    // 비급여만 있고 추나도 없으면 빈 상태 유지

    setInitialDetailsForReservation(items.join(', '));

    // 담당의 설정 (첫 번째 진료 항목의 담당의)
    const doctorName = receipt.treatments?.[0]?.doctor || '';
    setDefaultDoctorForReservation(doctorName);

    setShowReservationModal(true);
  };

  // 예약 1단계 완료 → CS예약 탭으로 전환 (2단계: 캘린더에서 시간 선택)
  const handleReservationNext = (draft: ReservationDraft) => {
    setShowReservationModal(false);
    // onReservationDraftReady가 있으면 CS예약 탭으로 전환
    if (onReservationDraftReady) {
      onReservationDraftReady(draft);
    } else {
      // fallback: 기존 방식 (QuickReservationModal)
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
    }
  };

  // 빠른 예약 열기
  const handleQuickReservation = (receipt: ExpandedReceiptItem) => {
    // 오늘 담당 의사 추출 (첫 번째 진료 항목에서)
    const doctorName = receipt.treatments?.[0]?.doctor || undefined;

    // 진료항목 분석하여 예약 모달 기본 선택 결정
    const selectedItems: string[] = [];
    const treatments = receipt.treatments || [];

    // 추나 항목 확인 (급여/비급여 모두)
    const hasChuna = treatments.some(t => t.name.includes('추나'));
    if (hasChuna) {
      selectedItems.push('추나');
    }

    // 추나 외 급여항목 확인 → 침 선택
    const hasOtherCovered = treatments.some(t =>
      t.is_covered && !t.name.includes('추나') && !t.name.includes('진찰료')
    );
    if (hasOtherCovered) {
      selectedItems.push('침');
    }

    setQuickReservationPatient({
      patientId: receipt.patient_id,
      patientName: receipt.patient_name,
      chartNo: receipt.chart_no,
      defaultDoctor: doctorName,
      selectedItems,
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

    // 2. 다음 예약이 없으면 예약 버튼 표시 (클릭 시 예약 모달 열기)
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          handleReservationClick(receipt);
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

    // 완료로 전환 시: 미처리 비급여 항목 경고
    if (newStatus && receipt.treatments) {
      const uncoveredItems = receipt.treatments.filter(t => !t.is_covered);
      const unprocessed = uncoveredItems.filter(
        item => !isExcludedFromMemo(item.name) && !hasMemoForDetail(item.id)
      );
      if (unprocessed.length > 0) {
        const names = unprocessed.map(item => item.name).join(', ');
        if (!confirm(`${names} 항목이 완료되지 않았습니다.\n이대로 완료처리 하시겠습니까?`)) {
          return;
        }
      }
    }

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
      // 사이드패널의 selectedReceipt도 업데이트
      if (selectedReceipt?.id === receipt.id) {
        setSelectedReceipt(prev => prev ? { ...prev, isCompleted: newStatus } : null);
      }
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
    const dateStr = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`;
    setSelectedDate(dateStr);
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
          onClick={() => setSelectedDate(getCurrentDate())}
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

        <button onClick={loadReceipts} className="refresh-btn">
          <i className="fa-solid fa-rotate-right"></i> 새로고침
        </button>
      </div>

      {/* 2단 레이아웃 */}
      <div className="receipt-two-column-layout" ref={containerRef}>
        {/* 왼쪽: 수납 목록 */}
        <div
          ref={listPanelRef}
          className={`receipt-list-panel ${selectedReceipt ? 'has-selection' : ''}`}
          style={listPanelWidth ? { width: listPanelWidth, flex: 'none' } : undefined}
        >
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
              <div className="col-total">총수납</div>
              <div className="col-self">본부금</div>
              <div className="col-general">비급여</div>
            </div>
            <div className="header-row-2">
              <div className="col-chart-info"></div>
              <div className="col-type"></div>
              <div className="col-uncovered"></div>
            </div>
          </div>

          {/* 테이블 바디 */}
          {filteredReceipts.map((receipt, index) => (
            <React.Fragment key={receipt.id}>
              {/* 2행 구조 수납 항목 */}
              <div
                className={`receipt-item-2row ${receipt.isCompleted ? 'completed' : ''} ${selectedReceipt?.id === receipt.id ? 'selected' : ''}`}
                onClick={() => handleReceiptRowClick(receipt)}
              >
                {/* 1행: 기본 정보 + 수납내역 + 비급여내역 + 임의메모 + 예약 */}
                <div className="receipt-row-1">
                  <div className="col-num">{index + 1}</div>
                  <div className="col-time">{formatTime(receipt.receipt_time)}</div>
                  <div className="col-patient">
                    <span className="patient-name">{receipt.patient_name}</span>
                  </div>
                  <div className="col-doctor">{getDoctorShortName(receipt)}</div>
                  <div className="col-total">
                    <span className="payment-icons">
                      {getPaymentMethodIcons(receipt).map((m, i) => (
                        <span key={i} className={m.color} title={m.label}>
                          <i className={`fa-solid ${m.icon}`}></i>
                        </span>
                      ))}
                    </span>
                    <span>{formatMoney(receipt.total_amount)}</span>
                  </div>
                  <div className={`col-self ${receipt.insurance_self >= 20000 ? 'high' : ''}`}>
                    {formatMoney(receipt.insurance_self)}
                  </div>
                  <div className="col-general">
                    {formatMoney(receipt.general_amount)}
                  </div>
                </div>

                {/* 2행: 차트/나이 + 종별 + 비급여내역 + 빠른메모+메모요약 + 완료 */}
                <div className="receipt-row-2">
                  <div className="col-chart-info">
                    {receipt.chart_no.replace(/^0+/, '')} / {receipt.age || '-'}세
                  </div>
                  <div className="col-type">
                    <span className={`type-badge ${getInsuranceTypeClass(receipt.insurance_type)}`}>
                      {formatInsuranceType(receipt.insurance_type)}
                    </span>
                  </div>
                  <div className="col-uncovered">
                    {(() => {
                      const uncovered = receipt.treatment_summary?.uncovered || [];
                      const isJabo = formatInsuranceType(receipt.insurance_type) === '자보';
                      const filteredItems = isJabo
                        ? uncovered.filter(u => u.name.includes('첩약'))
                        : uncovered;

                      // 추나 정보
                      const choonaTreatment = receipt.treatments?.find(t =>
                        t.is_covered && t.name?.includes('추나')
                      );
                      const choonaLabel = choonaTreatment
                        ? (choonaTreatment.name?.includes('단순') ? '단추' :
                           choonaTreatment.name?.includes('복잡') ? '복추' : null)
                        : null;

                      const hasUncovered = filteredItems.length > 0;
                      const hasChoona = choonaLabel !== null;

                      if (!hasUncovered && !hasChoona) return null;

                      return (
                        <span className="uncovered-items">
                          {hasChoona && <span className="choona-type">{choonaLabel}</span>}
                          {hasChoona && hasUncovered && <span className="uncovered-divider">/</span>}
                          {hasUncovered && filteredItems.map(u => u.name).join(',')}
                        </span>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </React.Fragment>
          ))}
          </div>
        )}
        </div>

        {/* 리사이즈 핸들 */}
        <div
          className={`resize-handle ${isResizing ? 'dragging' : ''}`}
          onMouseDown={handleResizeStart}
        />

        {/* 오른쪽: 환자 상세 패널 (항상 표시) */}
        <div className="receipt-detail-side-panel">
          {selectedReceipt ? (
            <>
              {/* 환자 정보 헤더 (한 줄) */}
              <div className="side-panel-header">
                <div className="patient-info">
                  <span
                    className="patient-name clickable"
                    onClick={async () => {
                      let localPatient = await getLocalPatientByMssqlId(selectedReceipt.patient_id);
                      if (!localPatient) {
                        localPatient = await syncPatientById(selectedReceipt.patient_id);
                      }
                      if (localPatient) {
                        setDashboardPatient(localPatient);
                        setShowDashboardModal(true);
                      }
                    }}
                    title="환자 통합 대시보드"
                  >{selectedReceipt.patient_name}</span>
                  <span className="chart-no">({selectedReceipt.chart_no.replace(/^0+/, '')})</span>
                </div>
                <div className="header-status">
                  <div className="status-badge reservation">
                    {renderReservationStatus(selectedReceipt)}
                  </div>
                  <button
                    className={`status-badge complete ${selectedReceipt.isCompleted ? 'completed' : ''}`}
                    onClick={() => handleToggleCompleted(selectedReceipt)}
                  >
                    <i className={`fa-solid ${selectedReceipt.isCompleted ? 'fa-check-circle' : 'fa-circle'}`}></i>
                    {selectedReceipt.isCompleted ? '완료' : '미완료'}
                  </button>
                </div>
                {/* 보유패키지 배지 */}
                <div className="header-packages">
                  {(() => {
                    const activeHerbals = activePackages.herbal.filter(pkg =>
                      (pkg.total_count || 0) - (pkg.used_count || 0) > 0
                    );
                    const activeNokryongs = activePackages.nokryong.filter(pkg =>
                      (pkg.remaining_months || 0) > 0
                    );
                    const activeTreatments = activePackages.treatment.filter(pkg =>
                      (pkg.total_count || 0) - (pkg.used_count || 0) > 0
                    );
                    const today = new Date();
                    const activeMemberships = activePackages.membership.filter(m =>
                      m.expire_date && new Date(m.expire_date) >= today
                    );

                    return (
                      <>
                        {activeHerbals.length > 0 && (
                          <span
                            className="header-pkg-badge herbal"
                            onClick={() => {
                              setPkgManageModal({
                                type: 'herbal',
                                packages: activeHerbals.map(pkg => ({
                                  id: pkg.id!,
                                  name: (pkg.diseaseTags?.join(', ')) || pkg.herbal_name || '한약',
                                  total: pkg.total_count || 0,
                                  remaining: (pkg.total_count || 0) - (pkg.used_count || 0),
                                  newRemaining: (pkg.total_count || 0) - (pkg.used_count || 0),
                                })),
                              });
                            }}
                            title="한약 패키지 관리"
                          >
                            한약{activeHerbals.reduce((sum, pkg) => sum + (pkg.total_count || 0) - (pkg.used_count || 0), 0)}회
                          </span>
                        )}
                        {activeNokryongs.length > 0 && (
                          <span
                            className="header-pkg-badge nokryong"
                            onClick={() => {
                              setPkgManageModal({
                                type: 'nokryong',
                                packages: activeNokryongs.map(pkg => ({
                                  id: pkg.id!,
                                  name: pkg.package_name || '녹용',
                                  total: pkg.total_months || 0,
                                  remaining: pkg.remaining_months || 0,
                                  newRemaining: pkg.remaining_months || 0,
                                })),
                              });
                            }}
                            title="녹용 패키지 관리"
                          >
                            녹용{activeNokryongs.reduce((sum, pkg) => sum + (pkg.remaining_months || 0), 0)}회
                          </span>
                        )}
                        {activeTreatments.length > 0 && (
                          <span
                            className="header-pkg-badge treatment"
                            onClick={() => {
                              setPkgManageModal({
                                type: 'treatment',
                                packages: activeTreatments.map(pkg => ({
                                  id: pkg.id!,
                                  name: pkg.package_name || '통마',
                                  total: pkg.total_count || 0,
                                  remaining: (pkg.total_count || 0) - (pkg.used_count || 0),
                                  newRemaining: (pkg.total_count || 0) - (pkg.used_count || 0),
                                })),
                              });
                            }}
                            title="통마 패키지 관리"
                          >
                            통마{activeTreatments.reduce((sum, pkg) => sum + (pkg.total_count || 0) - (pkg.used_count || 0), 0)}회
                          </span>
                        )}
                        {activeMemberships.length > 0 && (() => {
                          const latest = activeMemberships.reduce((a, b) =>
                            new Date(a.expire_date) > new Date(b.expire_date) ? a : b
                          );
                          const daysLeft = Math.ceil((new Date(latest.expire_date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                          return (
                            <span
                              className="header-pkg-badge membership"
                              onClick={() => {
                                setPkgManageModal({
                                  type: 'membership',
                                  packages: activeMemberships.map(m => {
                                    const startDateStr = (m.start_date || m.created_at || new Date().toISOString()).split('T')[0];
                                    const expireDateStr = m.expire_date.split('T')[0];
                                    return {
                                      id: m.id!,
                                      name: m.membership_type || '멤버십',
                                      total: Math.ceil((new Date(m.expire_date).getTime() - new Date(startDateStr).getTime()) / (1000 * 60 * 60 * 24)),
                                      remaining: Math.ceil((new Date(m.expire_date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)),
                                      newRemaining: Math.ceil((new Date(m.expire_date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)),
                                      startDate: startDateStr,
                                      expireDate: expireDateStr,
                                      newStartDate: startDateStr,
                                      newExpireDate: expireDateStr,
                                    };
                                  }),
                                });
                              }}
                              title="멤버십 관리"
                            >
                              멤버십{daysLeft}일
                            </span>
                          );
                        })()}
                      </>
                    );
                  })()}
                </div>
                {/* 패키지 추가 버튼 */}
                <div className="header-pkg-add-btns">
                  <button className="pkg-add-btn herbal" onClick={() => setQuickAddType('herbal')} title="한약 추가">약</button>
                  <button className="pkg-add-btn nokryong" onClick={() => setQuickAddType('nokryong')} title="녹용 사용">녹</button>
                  <button className="pkg-add-btn treatment" onClick={() => setQuickAddType('treatment')} title="통마 추가">통</button>
                  <button className="pkg-add-btn membership" onClick={() => setQuickAddType('membership')} title="멤버십 추가">멤</button>
                </div>
                <button
                  className="side-panel-close"
                  onClick={() => {
                    setSelectedReceipt(null);
                    setSelectedPatientHistory([]);
                  }}
                >
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>

              {/* 2단 레이아웃 내용 영역 */}
              <div className="side-panel-body side-panel-two-column">
                {/* 왼쪽 단: 진료상세내역 + 수납금액 */}
                <div className="detail-column">
                  {selectedReceipt.treatments.length === 0 ? (
                    <div className="detail-empty">
                      <i className="fa-solid fa-file-circle-question"></i>
                      <p>진료내역이 없습니다.</p>
                    </div>
                  ) : (
                    <div className="receipt-detail-content">
                      {/* 급여 항목 (2단) */}
                      {selectedReceipt.treatments.filter(t => t.is_covered).length > 0 && (
                        <div className="receipt-detail-section">
                          <h4 className="section-title insurance">
                            <i className="fa-solid fa-shield-halved"></i> 급여 항목
                          </h4>
                          <div className="insurance-items-grid">
                            {selectedReceipt.treatments.filter(t => t.is_covered).map((item, idx) => (
                              <div key={idx} className="insurance-item">
                                <span className="item-name">{item.name}</span>
                                <span className="item-amount">{(item.amount || 0).toLocaleString()}</span>
                              </div>
                            ))}
                          </div>
                          <div className="insurance-total">
                            <span>본인부담금</span>
                            <span className="amount">{formatMoney(selectedReceipt.insurance_self)}원</span>
                          </div>
                        </div>
                      )}
                      {/* 비급여 항목 */}
                      {selectedReceipt.treatments.filter(t => !t.is_covered).length > 0 && (
                        <div className="receipt-detail-section">
                          <h4 className="section-title general">
                            <i className="fa-solid fa-receipt"></i> 비급여 항목
                          </h4>
                          <table className="receipt-detail-table">
                            <tbody>
                              {selectedReceipt.treatments.filter(t => !t.is_covered).map((item, idx) => (
                                <tr
                                  key={idx}
                                  className={`${isClickDisabled(item.name) ? '' : 'clickable-row'} ${uncoveredModal?.itemName === item.name ? 'active' : ''}`}
                                  onClick={() => handleUncoveredItemClick(item.name, item.amount || 0, item.id)}
                                  title={isClickDisabled(item.name) ? undefined : hasMemoForDetail(item.id) ? '클릭하여 수정/삭제' : '클릭하여 메모 추가'}
                                >
                                  <td className="col-name">
                                    {item.name}
                                    {!isExcludedFromMemo(item.name) && (
                                      hasMemoForDetail(item.id) ? (
                                        <span className="memo-badge filled">✓</span>
                                      ) : (
                                        <span className="memo-badge empty">미입력</span>
                                      )
                                    )}
                                  </td>
                                  <td className="col-amount">{(item.amount || 0).toLocaleString()}원</td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr className="total-row general">
                                <td>비급여 합계</td>
                                <td className="col-amount">{formatMoney(selectedReceipt.general_amount)}원</td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      )}
                      {/* 총합계 */}
                      <div className="receipt-detail-grand-total">
                        <span className="label">총 수납액</span>
                        <span className="amount">{formatMoney(selectedReceipt.total_amount)}원</span>
                      </div>
                    </div>
                  )}

                  {/* 인라인 입력 패널 (커스텀 메모 추가) */}
                  {showInlinePanel && showInlinePanel.type === 'customMemo' && (
                      <div className="custom-memo-add-panel">
                        <div className="custom-memo-add-header">
                          <span className="custom-memo-add-title">
                            <i className="fa-solid fa-comment-dots"></i>
                            {showInlinePanel.memoDate} 메모 추가
                          </span>
                          <button
                            className="custom-memo-close-btn"
                            onClick={() => setShowInlinePanel(null)}
                          >
                            <i className="fa-solid fa-xmark"></i>
                          </button>
                        </div>
                        <div className="custom-memo-add-body">
                          <select
                            className="custom-memo-type-select"
                            value={selectedMemoTypeId || ''}
                            onChange={(e) => setSelectedMemoTypeId(Number(e.target.value))}
                          >
                            {memoTypes.map(mt => (
                              <option key={mt.id} value={mt.id} style={{ color: mt.color }}>
                                {mt.name}
                              </option>
                            ))}
                          </select>
                          <input
                            type="text"
                            className="custom-memo-input"
                            placeholder="메모 내용을 입력하세요"
                            value={customMemoText}
                            onChange={(e) => setCustomMemoText(e.target.value)}
                            onKeyDown={async (e) => {
                              if (e.key === 'Enter' && customMemoText.trim()) {
                                const selectedType = memoTypes.find(t => t.id === selectedMemoTypeId);
                                try {
                                  await addReceiptMemo({
                                    patient_id: selectedReceipt.patient_id,
                                    receipt_id: selectedReceipt.id,
                                    receipt_date: showInlinePanel.memoDate || selectedDate,
                                    memo: customMemoText.trim(),
                                    item_name: selectedType?.name || '일반',
                                    item_type: 'custom',
                                    created_by: user?.name || '직원',
                                    memo_type_id: selectedMemoTypeId || undefined,
                                  });
                                  setShowInlinePanel(null);
                                  setCustomMemoText('');
                                  setTimelineRefreshTrigger(prev => prev + 1);
                                  await refreshSelectedPatientHistory();
                                } catch (err) {
                                  console.error('메모 추가 실패:', err);
                                  alert('메모 추가에 실패했습니다.');
                                }
                              } else if (e.key === 'Escape') {
                                setShowInlinePanel(null);
                              }
                            }}
                            autoFocus
                          />
                          <button
                            className="custom-memo-submit-btn"
                            disabled={!customMemoText.trim()}
                            onClick={async () => {
                              if (!customMemoText.trim()) return;
                              const selectedType = memoTypes.find(t => t.id === selectedMemoTypeId);
                              try {
                                await addReceiptMemo({
                                  patient_id: selectedReceipt.patient_id,
                                  receipt_id: selectedReceipt.id,
                                  receipt_date: showInlinePanel.memoDate || selectedDate,
                                  memo: customMemoText.trim(),
                                  item_name: selectedType?.name || '일반',
                                  item_type: 'custom',
                                  created_by: user?.name || '직원',
                                  memo_type_id: selectedMemoTypeId || undefined,
                                });
                                setShowInlinePanel(null);
                                setCustomMemoText('');
                                setTimelineRefreshTrigger(prev => prev + 1);
                                await refreshSelectedPatientHistory();
                              } catch (err) {
                                console.error('메모 추가 실패:', err);
                                alert('메모 추가에 실패했습니다.');
                              }
                            }}
                          >
                            추가
                          </button>
                        </div>
                      </div>
                  )}

                  {/* 타임라인 기록 수정용 MemoInputPanel (메모태그 클릭 시) */}
                  {memoInputMode && (
                    <div className="memo-input-section">
                      <MemoInputPanel
                        key={memoInputMode.yakchimEditData?.id || memoInputMode.editData?.id || memoInputMode.membershipEditData?.id || memoInputMode.herbalPickupEditData?.id || `new-${memoInputMode.itemName}`}
                        patientId={memoInputMode.patientId || selectedReceipt.patient_id}
                        patientName={memoInputMode.patientName || selectedReceipt.patient_name}
                        chartNumber={memoInputMode.chartNumber || selectedReceipt.chart_no}
                        receiptId={selectedReceipt.id}
                        receiptDate={selectedDate}
                        itemName={memoInputMode.itemName}
                        itemType={memoInputMode.itemType}
                        amount={memoInputMode.amount}
                        detailId={memoInputMode.detailId}
                        editData={memoInputMode.editData}
                        yakchimEditData={memoInputMode.yakchimEditData}
                        packageEditData={memoInputMode.packageEditData}
                        membershipEditData={memoInputMode.membershipEditData}
                        herbalMode={memoInputMode.herbalMode}
                        herbalPickupEditData={memoInputMode.herbalPickupEditData}
                        onClose={handleCloseMemoInput}
                        onSuccess={async () => {
                          handleCloseMemoInput();
                          await refreshSelectedPatientHistory();
                        }}
                      />
                    </div>
                  )}
                </div>

                {/* 오른쪽 단: 수납이력 */}
                <div className="info-column">
                  <InlineReceiptHistory
                    patientId={selectedReceipt.patient_id}
                    patientName={selectedReceipt.patient_name}
                    chartNo={selectedReceipt.chart_no}
                    currentDate={selectedDate}
                    onNavigateToDate={(date) => setSelectedDate(date)}
                  />
                </div>
              </div>
            </>
          ) : (
            /* 환자 미선택 시 안내 메시지 */
            <div className="side-panel-empty">
              <i className="fa-solid fa-user-check"></i>
              <p>왼쪽 목록에서 환자를 선택하세요</p>
              <span>선택한 환자의 수납 내역과 메모를 확인할 수 있습니다</span>
            </div>
          )}
        </div>
      </div>



      {/* 예약 모달 */}
      <ReservationStep1Modal
        isOpen={showReservationModal}
        onClose={() => setShowReservationModal(false)}
        onNext={handleReservationNext}
        doctors={doctors}
        initialPatient={selectedPatientForReservation}
        initialDetails={initialDetailsForReservation}
        defaultDoctor={defaultDoctorForReservation}
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

      {/* 환자 대시보드 모달 */}
      {dashboardPatient && (
        <PatientDashboard
          isOpen={showDashboardModal}
          patient={dashboardPatient}
          user={user}
          onClose={() => {
            setShowDashboardModal(false);
            setDashboardPatient(null);
          }}
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

      {/* 상비약 모달 */}
      {medicineModalReceipt && (
        <MedicineModal
          isOpen={true}
          onClose={() => {
            setMedicineModalReceipt(null);
            setMedicineEditData(null);
            setMedicineInitialSearch('');
          }}
          patientId={medicineModalReceipt.patient_id}
          chartNumber={medicineModalReceipt.chart_no}
          patientName={medicineModalReceipt.patient_name}
          usageDate={selectedDate}
          receiptId={medicineModalReceipt.id}
          editData={medicineEditData || undefined}
          initialSearchKeyword={medicineInitialSearch}
          onSuccess={() => {
            loadReceipts();
          }}
        />
      )}

      {/* 비급여 항목 통합 모달 */}
      {uncoveredModal && selectedReceipt && (
        <UncoveredItemModal
          isOpen={true}
          itemName={uncoveredModal.itemName}
          itemType={uncoveredModal.itemType}
          amount={uncoveredModal.amount}
          detailId={uncoveredModal.detailId}
          isEditMode={uncoveredModal.isEditMode}
          patientId={selectedReceipt.patient_id}
          patientName={selectedReceipt.patient_name}
          chartNumber={selectedReceipt.chart_no}
          receiptId={selectedReceipt.id}
          receiptDate={selectedDate}
          onSuccess={async () => {
            setUncoveredModal(null);
            setTimelineRefreshTrigger(prev => prev + 1);
            await refreshSelectedPatientHistory();
          }}
          onClose={() => setUncoveredModal(null)}
        />
      )}

      {/* 등록 모달 (레거시) */}
      {registerModal && selectedReceipt && (
        <RegisterModal
          type={registerModal.type}
          patientId={selectedReceipt.patient_id}
          patientName={selectedReceipt.patient_name}
          chartNumber={selectedReceipt.chart_no}
          receiptId={selectedReceipt.id}
          receiptDate={selectedReceipt.receipt_date || selectedDate}
          uncoveredItems={(selectedReceipt.treatment_summary?.uncovered || []).map(u => ({
            detailId: u.id,
            itemName: u.name,
            amount: u.amount || 0,
          }))}
          editHerbalPackage={registerModal.editHerbalPackage}
          editNokryongPackage={registerModal.editNokryongPackage}
          editMemoId={registerModal.editMemoId}
          defaultTab={registerModal.defaultTab}
          onClose={() => setRegisterModal(null)}
          onSuccess={async () => {
            setRegisterModal(null);
            await refreshSelectedPatientHistory();
          }}
        />
      )}

      {/* 패키지 통합 관리 모달 */}
      {showPackageModal && selectedReceipt && (
        <PackageManageModal
          patientId={selectedReceipt.patient_id}
          patientName={selectedReceipt.patient_name}
          chartNumber={selectedReceipt.chart_no}
          receiptId={selectedReceipt.id}
          receiptDate={selectedReceipt.receipt_date || selectedDate}
          uncoveredItems={(selectedReceipt.treatment_summary?.uncovered || []).map(u => ({
            detailId: u.id,
            itemName: u.name,
            amount: u.amount || 0,
          }))}
          onClose={() => setShowPackageModal(false)}
          onSuccess={async () => {
            // 모달은 열린 상태 유지, 데이터만 새로고침
            await refreshSelectedPatientHistory();
          }}
        />
      )}

      {/* 빠른 패키지 등록 모달 */}
      {quickAddType && selectedReceipt && (
        <PackageQuickAddModal
          packageType={quickAddType}
          patientId={selectedReceipt.patient_id}
          patientName={selectedReceipt.patient_name}
          chartNumber={selectedReceipt.chart_no}
          receiptId={selectedReceipt.id}
          receiptDate={selectedReceipt.receipt_date || selectedDate}
          uncoveredItems={(selectedReceipt.treatment_summary?.uncovered || []).map(u => ({
            detailId: u.id,
            itemName: u.name,
            amount: u.amount || 0,
          }))}
          onClose={() => setQuickAddType(null)}
          onSuccess={async () => {
            await refreshSelectedPatientHistory();
          }}
        />
      )}

      {/* 패키지 관리 모달 */}
      {pkgManageModal && (
        <div className="pkg-manage-modal-overlay" onClick={() => { setPkgManageModal(null); setPkgHistory({ history: [], loading: false }); }}>
          <div className="pkg-manage-modal" onClick={(e) => e.stopPropagation()}>
            <div className={`pkg-manage-header ${pkgManageModal.type}`}>
              <h4>
                {pkgManageModal.type === 'herbal' && '한약 패키지 관리'}
                {pkgManageModal.type === 'nokryong' && '녹용 패키지 관리'}
                {pkgManageModal.type === 'treatment' && '통마 패키지 관리'}
                {pkgManageModal.type === 'membership' && '멤버십 관리'}
              </h4>
              <button className="btn-close" onClick={() => { setPkgManageModal(null); setPkgHistory({ history: [], loading: false }); }}>
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <div className="pkg-manage-body">
              {pkgManageModal.packages.length === 0 ? (
                <div className="pkg-manage-empty">등록된 패키지가 없습니다.</div>
              ) : (
                pkgManageModal.packages.map((pkg, idx) => {
                  const unit = pkgManageModal.type === 'membership' ? '일' : '회';
                  return (
                  <div key={pkg.id} className={`pkg-manage-item ${pkg.deleted ? 'deleted' : ''}`}>
                    <div className="pkg-manage-item-header">
                      <div className="pkg-manage-item-info">
                        <span className="pkg-manage-item-name">{pkg.name}</span>
                        {pkgManageModal.type !== 'membership' && (
                          <span className="pkg-manage-item-total">총 {pkg.total}{unit}</span>
                        )}
                      </div>
                      <button
                        className={`btn-delete ${pkg.deleted ? 'restore' : ''}`}
                        onClick={() => {
                          const newPackages = [...pkgManageModal.packages];
                          newPackages[idx] = { ...pkg, deleted: !pkg.deleted };
                          setPkgManageModal({ ...pkgManageModal, packages: newPackages });
                        }}
                        title={pkg.deleted ? '삭제 취소' : '패키지 삭제'}
                      >
                        <i className={`fa-solid ${pkg.deleted ? 'fa-rotate-left' : 'fa-trash'}`}></i>
                      </button>
                    </div>
                    {!pkg.deleted && (
                      <>
                        {/* 패키지: +/- 버튼으로 잔여 횟수 조정 */}
                        {pkgManageModal.type !== 'membership' && (
                          <>
                            <div className="pkg-manage-item-controls">
                              <span className="pkg-manage-item-label">잔여</span>
                              <button
                                className="btn-adjust"
                                onClick={() => {
                                  const newPackages = [...pkgManageModal.packages];
                                  newPackages[idx] = { ...pkg, newRemaining: Math.max(0, pkg.newRemaining - 1) };
                                  setPkgManageModal({ ...pkgManageModal, packages: newPackages });
                                }}
                              >
                                -
                              </button>
                              <input
                                type="number"
                                value={pkg.newRemaining}
                                onChange={(e) => {
                                  const val = Math.max(0, parseInt(e.target.value) || 0);
                                  const newPackages = [...pkgManageModal.packages];
                                  newPackages[idx] = { ...pkg, newRemaining: val };
                                  setPkgManageModal({ ...pkgManageModal, packages: newPackages });
                                }}
                                min={0}
                              />
                              <button
                                className="btn-adjust"
                                onClick={() => {
                                  const newPackages = [...pkgManageModal.packages];
                                  newPackages[idx] = { ...pkg, newRemaining: pkg.newRemaining + 1 };
                                  setPkgManageModal({ ...pkgManageModal, packages: newPackages });
                                }}
                              >
                                +
                              </button>
                              <span className="pkg-manage-item-unit">/ {pkg.total}{unit}</span>
                            </div>
                            {pkg.newRemaining !== pkg.remaining && (
                              <div className="pkg-manage-item-change">
                                {pkg.remaining}{unit} → {pkg.newRemaining}{unit}
                                <span className={pkg.newRemaining > pkg.remaining ? 'increase' : 'decrease'}>
                                  ({pkg.newRemaining > pkg.remaining ? '+' : ''}{pkg.newRemaining - pkg.remaining})
                                </span>
                              </div>
                            )}
                          </>
                        )}
                        {/* 멤버십: 시작일/종료일 날짜 입력 */}
                        {pkgManageModal.type === 'membership' && (
                          <>
                            <div className="pkg-manage-date-row">
                              <label>시작일</label>
                              <input
                                type="date"
                                value={pkg.newStartDate || ''}
                                onChange={(e) => {
                                  const newPackages = [...pkgManageModal.packages];
                                  newPackages[idx] = { ...pkg, newStartDate: e.target.value };
                                  setPkgManageModal({ ...pkgManageModal, packages: newPackages });
                                }}
                              />
                            </div>
                            <div className="pkg-manage-date-row">
                              <label>종료일</label>
                              <input
                                type="date"
                                value={pkg.newExpireDate || ''}
                                onChange={(e) => {
                                  const newPackages = [...pkgManageModal.packages];
                                  newPackages[idx] = { ...pkg, newExpireDate: e.target.value };
                                  setPkgManageModal({ ...pkgManageModal, packages: newPackages });
                                }}
                              />
                            </div>
                            {(pkg.newStartDate !== pkg.startDate || pkg.newExpireDate !== pkg.expireDate) && (
                              <div className="pkg-manage-item-change">
                                {pkg.startDate} ~ {pkg.expireDate} → {pkg.newStartDate} ~ {pkg.newExpireDate}
                              </div>
                            )}
                          </>
                        )}
                      </>
                    )}
                    {pkg.deleted && (
                      <div className="pkg-manage-item-deleted-msg">
                        {pkgManageModal.type === 'membership' ? '이 멤버십이 삭제됩니다' : '이 패키지가 삭제됩니다'}
                      </div>
                    )}
                  </div>
                  );
                })
              )}
            </div>
            {/* 하단 히스토리 섹션 */}
            <div className="pkg-manage-history-section">
                <div className="pkg-history-section-header">
                  <i className="fa-solid fa-clock-rotate-left"></i>
                  <span>등록 및 사용 히스토리</span>
                </div>
                {pkgHistory.loading ? (
                  <div className="pkg-history-loading">로딩 중...</div>
                ) : pkgHistory.history.length === 0 ? (
                  <div className="pkg-history-empty">사용 기록이 없습니다.</div>
                ) : (
                  <div className="pkg-history-list">
                    {pkgHistory.history.map(item => (
                      <div key={item.id} className={`pkg-history-item ${item.type}`}>
                        <span className="pkg-history-date">{item.date}</span>
                        <span className={`pkg-history-badge ${item.type}`}>
                          {item.type === 'add' ? '등록' : '사용'}
                        </span>
                        <span className="pkg-history-label">{item.label}</span>
                        {item.type === 'usage' && item.deductionPoints !== undefined && (
                          <span className="pkg-history-deduction">-{item.deductionPoints}p</span>
                        )}
                        {item.type === 'usage' && item.remainingAfter !== undefined && (
                          <span className="pkg-history-remaining">잔여 {item.remainingAfter}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            <div className="pkg-manage-footer">
              <button className="btn-cancel" onClick={() => setPkgManageModal(null)}>
                취소
              </button>
              <button
                className="btn-save"
                disabled={!pkgManageModal.packages.some(p =>
                  p.deleted ||
                  p.newRemaining !== p.remaining ||
                  p.newStartDate !== p.startDate ||
                  p.newExpireDate !== p.expireDate
                )}
                onClick={async () => {
                  try {
                    // 삭제할 패키지 처리
                    const deletedPackages = pkgManageModal.packages.filter(p => p.deleted);
                    for (const pkg of deletedPackages) {
                      if (pkgManageModal.type === 'herbal') {
                        await deleteHerbalPackage(pkg.id);
                      } else if (pkgManageModal.type === 'nokryong') {
                        await deleteNokryongPackage(pkg.id);
                      } else if (pkgManageModal.type === 'treatment') {
                        await deleteTreatmentPackage(pkg.id);
                      } else if (pkgManageModal.type === 'membership') {
                        await deleteMembership(pkg.id);
                      }
                    }
                    // 변경된 패키지 처리 (삭제되지 않은 것만)
                    if (pkgManageModal.type === 'membership') {
                      // 멤버십: 날짜가 변경된 것만 처리
                      const changedMemberships = pkgManageModal.packages.filter(p =>
                        !p.deleted && (p.newStartDate !== p.startDate || p.newExpireDate !== p.expireDate)
                      );
                      for (const pkg of changedMemberships) {
                        await updateMembership(pkg.id, {
                          start_date: pkg.newStartDate,
                          expire_date: pkg.newExpireDate,
                        });
                      }
                    } else {
                      // 패키지: 잔여 횟수가 변경된 것만 처리
                      const changedPackages = pkgManageModal.packages.filter(p => !p.deleted && p.newRemaining !== p.remaining);
                      for (const pkg of changedPackages) {
                        // 잔여가 total보다 크면 total도 증가
                        const newTotal = Math.max(pkg.total, pkg.newRemaining);
                        const usedCount = newTotal - pkg.newRemaining;
                        if (pkgManageModal.type === 'herbal') {
                          await updateHerbalPackage(pkg.id, {
                            total_count: newTotal,
                            remaining_count: pkg.newRemaining,
                            used_count: usedCount,
                          });
                        } else if (pkgManageModal.type === 'nokryong') {
                          await updateNokryongPackage(pkg.id, {
                            total_months: newTotal,
                            remaining_months: pkg.newRemaining,
                          });
                        } else if (pkgManageModal.type === 'treatment') {
                          await updateTreatmentPackage(pkg.id, {
                            total_count: newTotal,
                            remaining_count: pkg.newRemaining,
                            used_count: usedCount,
                          });
                        }
                      }
                    }
                    setPkgManageModal(null);
                    await refreshSelectedPatientHistory();
                  } catch (err) {
                    console.error('패키지 수정 실패:', err);
                    alert('패키지 수정에 실패했습니다.');
                  }
                }}
              >
                저장
              </button>
            </div>
          </div>
        </div>
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
  const [memoText, setMemoText] = useState(receipt.receiptMemos[0]?.memo || '');
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
      await addReceiptMemo({
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
                className={`res-btn ${(receipt.receiptStatus?.reservation_status || 'none') === status ? 'active' : ''}`}
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
