import React, { useState, useEffect, useCallback } from 'react';
import type { PortalUser } from '@shared/types';
import {
  ensureReceiptTables,
  fetchMssqlReceipts,
  getPatientMemoData,
  upsertReceiptMemo,
  createTreatmentPackage,
  useTreatmentPackage,
  createHerbalPackage,
  useHerbalPackage,
  earnPoints,
  usePoints,
  getPointBalance,
  createMembership,
  useMembership,
  createHerbalDispensing,
  createGiftDispensing,
  createDocumentIssue,
  type MssqlReceiptItem,
} from '../lib/api';
import {
  type TreatmentPackage,
  type HerbalPackage,
  type Membership,
  type HerbalDispensing,
  type GiftDispensing,
  type DocumentIssue,
  type ReceiptMemo,
  type ReservationStatus,
  RESERVATION_STATUS_LABELS,
  generateMemoSummary,
} from '../types';
import { ReservationStep1Modal, type ReservationDraft, type InitialPatient } from '../../reservation/components/ReservationStep1Modal';
import { fetchDoctors } from '../../reservation/lib/api';
import type { Doctor } from '../../reservation/types';

interface ReceiptViewProps {
  user: PortalUser;
}

// 확장된 수납 아이템 (MSSQL + SQLite 데이터)
interface ExpandedReceiptItem extends MssqlReceiptItem {
  // SQLite 데이터
  treatmentPackages: TreatmentPackage[];
  herbalPackages: HerbalPackage[];
  pointBalance: number;
  todayPointUsed: number;
  todayPointEarned: number;
  membership: Membership | null;
  herbalDispensings: HerbalDispensing[];
  giftDispensings: GiftDispensing[];
  documentIssues: DocumentIssue[];
  memo: ReceiptMemo | null;
  // UI 상태
  isExpanded: boolean;
  isLoading: boolean;
  memoSummary: string;
}

function ReceiptView({ user }: ReceiptViewProps) {
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [receipts, setReceipts] = useState<ExpandedReceiptItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 예약 모달 상태
  const [showReservationModal, setShowReservationModal] = useState(false);
  const [selectedPatientForReservation, setSelectedPatientForReservation] = useState<InitialPatient | null>(null);
  const [doctors, setDoctors] = useState<Doctor[]>([]);

  // 테이블 초기화
  useEffect(() => {
    ensureReceiptTables();
    loadDoctors();
  }, []);

  // 의사 목록 로드
  const loadDoctors = async () => {
    try {
      const docs = await fetchDoctors();
      setDoctors(docs);
    } catch (err) {
      console.error('의사 목록 로드 실패:', err);
    }
  };

  // MSSQL 수납 내역 로드
  const loadReceipts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const mssqlReceipts = await fetchMssqlReceipts(selectedDate);

      // 각 수납 항목에 기본 UI 상태 추가
      const expandedReceipts: ExpandedReceiptItem[] = mssqlReceipts.map(r => ({
        ...r,
        treatmentPackages: [],
        herbalPackages: [],
        pointBalance: 0,
        todayPointUsed: 0,
        todayPointEarned: 0,
        membership: null,
        herbalDispensings: [],
        giftDispensings: [],
        documentIssues: [],
        memo: null,
        isExpanded: false,
        isLoading: false,
        memoSummary: '',
      }));

      setReceipts(expandedReceipts);

      // 각 환자의 메모 요약만 먼저 로드
      await loadAllMemoSummaries(expandedReceipts);
    } catch (err) {
      console.error('수납 내역 로드 실패:', err);
      setError('수납 내역을 불러오는데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedDate]);

  // 모든 환자의 메모 요약 로드
  const loadAllMemoSummaries = async (items: ExpandedReceiptItem[]) => {
    const updates = await Promise.all(
      items.map(async (item) => {
        try {
          const data = await getPatientMemoData(item.patient_id, selectedDate);
          const summary = generateMemoSummary({
            treatmentPackages: data.treatmentPackages,
            herbalPackages: data.herbalPackages,
            pointUsed: data.todayPointUsed,
            pointEarned: data.todayPointEarned,
            membership: data.membership || undefined,
            herbalDispensings: data.herbalDispensings,
            giftDispensings: data.giftDispensings,
            documentIssues: data.documentIssues,
          });
          return {
            patient_id: item.patient_id,
            memoSummary: summary,
            reservationStatus: data.memo?.reservation_status || 'none',
            reservationDate: data.memo?.reservation_date,
          };
        } catch (err) {
          return { patient_id: item.patient_id, memoSummary: '', reservationStatus: 'none' as ReservationStatus };
        }
      })
    );

    setReceipts(prev => prev.map(item => {
      const update = updates.find(u => u.patient_id === item.patient_id);
      if (update) {
        return {
          ...item,
          memoSummary: update.memoSummary,
          memo: {
            ...(item.memo || {}),
            reservation_status: update.reservationStatus as ReservationStatus,
            reservation_date: update.reservationDate,
          } as ReceiptMemo,
        };
      }
      return item;
    }));
  };

  // 날짜 변경 시 데이터 로드
  useEffect(() => {
    loadReceipts();
  }, [loadReceipts]);

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
            membership: data.membership,
            herbalDispensings: data.herbalDispensings,
            giftDispensings: data.giftDispensings,
            documentIssues: data.documentIssues,
            memo: data.memo,
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
        chart_number: receipt.chart_number,
        patient_name: receipt.patient_name,
        mssql_receipt_id: receipt.id,
        receipt_date: selectedDate,
        reservation_status: status,
        reservation_date: reservationDate,
      });

      setReceipts(prev => prev.map(r =>
        r.id === receipt.id ? {
          ...r,
          memo: {
            ...(r.memo || {} as ReceiptMemo),
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
      chartNo: receipt.chart_number,
      name: receipt.patient_name,
    });
    setShowReservationModal(true);
  };

  // 예약 1단계 완료 (2단계로 이동 - 실제로는 캘린더 페이지로)
  const handleReservationNext = (draft: ReservationDraft) => {
    setShowReservationModal(false);
    // TODO: 2단계 - 캘린더에서 시간 선택
    // 현재는 예약 페이지로 이동하거나 모달로 처리
    alert(`예약 정보:\n환자: ${draft.patient.name}\n담당의: ${draft.doctor}\n진료: ${draft.selectedItems.join(', ')}\n슬롯: ${draft.requiredSlots}칸\n\n시간 선택을 위해 예약관리 페이지를 사용해주세요.`);
  };

  // 금액 포맷
  const formatAmount = (amount: number) => {
    if (amount === 0) return '-';
    return amount.toLocaleString();
  };

  // 예약 상태 표시 렌더링
  const renderReservationStatus = (receipt: ExpandedReceiptItem) => {
    const status = receipt.memo?.reservation_status || 'none';
    const date = receipt.memo?.reservation_date;

    if (status === 'none') {
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
    }

    if (status === 'confirmed' && date) {
      const formattedDate = new Date(date).toLocaleDateString('ko-KR', {
        month: 'numeric',
        day: 'numeric'
      });
      return (
        <span className="reservation-status confirmed">{formattedDate}</span>
      );
    }

    return (
      <span className={`reservation-status ${status}`}>
        {RESERVATION_STATUS_LABELS[status]}
      </span>
    );
  };

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
        <button onClick={loadReceipts} className="refresh-btn">
          <i className="fa-solid fa-rotate-right"></i> 새로고침
        </button>
        <span className="receipt-count">
          총 {receipts.length}건
        </span>
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
        <div className="receipt-accordion-table">
          {/* 테이블 헤더 */}
          <div className="receipt-header-row">
            <div className="col-num">#</div>
            <div className="col-time">시간</div>
            <div className="col-patient">환자</div>
            <div className="col-doctor">담당</div>
            <div className="col-type">종별</div>
            <div className="col-insurance">급여</div>
            <div className="col-general">비급여</div>
            <div className="col-memo">메모</div>
            <div className="col-reservation">예약</div>
          </div>

          {/* 테이블 바디 */}
          {receipts.map((receipt, index) => (
            <React.Fragment key={receipt.id}>
              {/* 메인 행 (클릭 시 확장) */}
              <div
                className={`receipt-row ${receipt.isExpanded ? 'expanded' : ''}`}
                onClick={() => toggleExpand(receipt.id)}
              >
                <div className="col-num">{index + 1}</div>
                <div className="col-time">{receipt.receipt_time}</div>
                <div className="col-patient">
                  <span className="patient-name">{receipt.patient_name}</span>
                  <span className="patient-info">
                    ({receipt.chart_number}{receipt.age ? `/${receipt.age}` : ''})
                  </span>
                </div>
                <div className="col-doctor">{receipt.doctor}</div>
                <div className="col-type">{receipt.insurance_type}</div>
                <div className="col-insurance">{formatAmount(receipt.insurance_amount)}</div>
                <div className="col-general">{formatAmount(receipt.general_amount)}</div>
                <div className="col-memo">
                  <span className="memo-summary">{receipt.memoSummary || '-'}</span>
                </div>
                <div className="col-reservation" onClick={(e) => e.stopPropagation()}>
                  {renderReservationStatus(receipt)}
                </div>
              </div>

              {/* 확장된 상세 패널 */}
              {receipt.isExpanded && (
                <div className="receipt-detail-panel">
                  {receipt.isLoading ? (
                    <div className="detail-loading">
                      <i className="fa-solid fa-spinner fa-spin"></i> 로딩 중...
                    </div>
                  ) : (
                    <ReceiptDetailPanel
                      receipt={receipt}
                      selectedDate={selectedDate}
                      onDataChange={() => {
                        // 데이터 변경 후 해당 행 새로고침
                        toggleExpand(receipt.id);
                        setTimeout(() => toggleExpand(receipt.id), 100);
                      }}
                      onReservationStatusChange={handleReservationStatusChange}
                    />
                  )}
                </div>
              )}
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
    </div>
  );
}

// 상세 패널 컴포넌트
interface ReceiptDetailPanelProps {
  receipt: ExpandedReceiptItem;
  selectedDate: string;
  onDataChange: () => void;
  onReservationStatusChange: (receipt: ExpandedReceiptItem, status: ReservationStatus, date?: string) => void;
}

function ReceiptDetailPanel({ receipt, selectedDate, onDataChange, onReservationStatusChange }: ReceiptDetailPanelProps) {
  const [activeTab, setActiveTab] = useState<'packages' | 'point' | 'dispensing' | 'memo'>('packages');
  const [memoText, setMemoText] = useState(receipt.memo?.memo || '');
  const [pointBalance, setPointBalance] = useState(receipt.pointBalance);

  // 포인트 사용
  const handleUsePoints = async (amount: number) => {
    if (amount <= 0) return;
    try {
      await usePoints({
        patient_id: receipt.patient_id,
        chart_number: receipt.chart_number,
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
        chart_number: receipt.chart_number,
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
        chart_number: receipt.chart_number,
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

  return (
    <div className="detail-content">
      {/* 탭 네비게이션 */}
      <div className="detail-tabs">
        <button
          className={activeTab === 'packages' ? 'active' : ''}
          onClick={() => setActiveTab('packages')}
        >
          패키지/멤버십
        </button>
        <button
          className={activeTab === 'point' ? 'active' : ''}
          onClick={() => setActiveTab('point')}
        >
          포인트
        </button>
        <button
          className={activeTab === 'dispensing' ? 'active' : ''}
          onClick={() => setActiveTab('dispensing')}
        >
          출납/서류
        </button>
        <button
          className={activeTab === 'memo' ? 'active' : ''}
          onClick={() => setActiveTab('memo')}
        >
          메모/예약
        </button>
      </div>

      {/* 패키지/멤버십 탭 */}
      {activeTab === 'packages' && (
        <div className="tab-content packages-tab">
          {/* 시술 패키지 */}
          <div className="section">
            <h4>시술 패키지</h4>
            {receipt.treatmentPackages.length === 0 ? (
              <p className="empty-text">등록된 패키지가 없습니다.</p>
            ) : (
              <div className="package-list">
                {receipt.treatmentPackages.map(pkg => (
                  <div key={pkg.id} className="package-item">
                    <span className="pkg-name">{pkg.package_name}</span>
                    <span className="pkg-count">
                      [{pkg.total_count}-{pkg.used_count}={pkg.remaining_count}]
                    </span>
                    {pkg.includes && <span className="pkg-includes">({pkg.includes})</span>}
                    {pkg.status === 'active' && (
                      <button
                        className="use-btn"
                        onClick={() => handleUseTreatmentPackage(pkg.id!)}
                      >
                        사용
                      </button>
                    )}
                    {pkg.status === 'completed' && (
                      <span className="pkg-completed">완료</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 한약 패키지 (선결) */}
          <div className="section">
            <h4>한약 패키지 (선결)</h4>
            {receipt.herbalPackages.length === 0 ? (
              <p className="empty-text">등록된 선결이 없습니다.</p>
            ) : (
              <div className="package-list">
                {receipt.herbalPackages.map(pkg => (
                  <div key={pkg.id} className="package-item">
                    <span className="pkg-name">선결 {pkg.package_type}</span>
                    <span className="pkg-count">
                      [{pkg.total_count}-{pkg.used_count}={pkg.remaining_count}]
                    </span>
                    {pkg.next_delivery_date && (
                      <span className="pkg-delivery">
                        다음배송: {new Date(pkg.next_delivery_date).toLocaleDateString('ko-KR')}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 멤버십 */}
          <div className="section">
            <h4>멤버십</h4>
            {!receipt.membership ? (
              <p className="empty-text">등록된 멤버십이 없습니다.</p>
            ) : (
              <div className="membership-info">
                <span className="membership-type">{receipt.membership.membership_type}</span>
                <span className="membership-count">{receipt.membership.remaining_count}회 남음</span>
                <span className="membership-expire">
                  만료: {new Date(receipt.membership.expire_date).toLocaleDateString('ko-KR')}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 포인트 탭 */}
      {activeTab === 'point' && (
        <div className="tab-content point-tab">
          <div className="point-balance">
            <span className="label">현재 잔액</span>
            <span className="amount">{pointBalance.toLocaleString()}P</span>
          </div>

          <div className="point-today">
            {receipt.todayPointUsed > 0 && (
              <span className="used">오늘 사용: -{receipt.todayPointUsed.toLocaleString()}P</span>
            )}
            {receipt.todayPointEarned > 0 && (
              <span className="earned">오늘 적립: +{receipt.todayPointEarned.toLocaleString()}P</span>
            )}
          </div>

          <div className="point-actions">
            <div className="point-input-group">
              <input
                type="number"
                id="point-use-amount"
                placeholder="사용 금액"
                min="0"
                step="1000"
              />
              <button
                onClick={() => {
                  const input = document.getElementById('point-use-amount') as HTMLInputElement;
                  handleUsePoints(Number(input.value));
                  input.value = '';
                }}
              >
                사용
              </button>
            </div>
            <div className="point-input-group">
              <input
                type="number"
                id="point-earn-amount"
                placeholder="적립 금액"
                min="0"
                step="1000"
              />
              <button
                onClick={() => {
                  const input = document.getElementById('point-earn-amount') as HTMLInputElement;
                  handleEarnPoints(Number(input.value));
                  input.value = '';
                }}
              >
                적립
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 출납/서류 탭 */}
      {activeTab === 'dispensing' && (
        <div className="tab-content dispensing-tab">
          {/* 한약 출납 */}
          <div className="section">
            <h4>한약 출납</h4>
            {receipt.herbalDispensings.length === 0 ? (
              <p className="empty-text">오늘 한약 출납 내역이 없습니다.</p>
            ) : (
              <ul className="dispensing-list">
                {receipt.herbalDispensings.map(d => (
                  <li key={d.id}>
                    {d.dispensing_type === 'gift' ? '[증정]' : '[판매]'}
                    {d.herbal_name} ({d.quantity}봉)
                    - {d.delivery_method === 'pickup' ? '내원' : d.delivery_method === 'local' ? '시내' : '시외'}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* 증정품 출납 */}
          <div className="section">
            <h4>증정품 출납</h4>
            {receipt.giftDispensings.length === 0 ? (
              <p className="empty-text">오늘 증정품 출납 내역이 없습니다.</p>
            ) : (
              <ul className="dispensing-list">
                {receipt.giftDispensings.map(d => (
                  <li key={d.id}>
                    {d.item_name} ({d.quantity})
                    {d.reason && ` - ${d.reason}`}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* 서류발급 */}
          <div className="section">
            <h4>서류발급</h4>
            {receipt.documentIssues.length === 0 ? (
              <p className="empty-text">오늘 서류발급 내역이 없습니다.</p>
            ) : (
              <ul className="dispensing-list">
                {receipt.documentIssues.map(d => (
                  <li key={d.id}>
                    {d.document_type} {d.quantity > 1 ? `(${d.quantity}매)` : ''}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* 메모/예약 탭 */}
      {activeTab === 'memo' && (
        <div className="tab-content memo-tab">
          {/* 예약 상태 */}
          <div className="section">
            <h4>예약 상태</h4>
            <div className="reservation-status-buttons">
              {(['none', 'pending_call', 'pending_kakao', 'pending_naver', 'pending_anytime'] as ReservationStatus[]).map(status => (
                <button
                  key={status}
                  className={receipt.memo?.reservation_status === status ? 'active' : ''}
                  onClick={() => onReservationStatusChange(receipt, status)}
                >
                  {status === 'none' ? '없음' : RESERVATION_STATUS_LABELS[status]}
                </button>
              ))}
              <div className="confirmed-date-input">
                <input
                  type="date"
                  id={`reservation-date-${receipt.id}`}
                  defaultValue={receipt.memo?.reservation_date || ''}
                />
                <button
                  onClick={() => {
                    const input = document.getElementById(`reservation-date-${receipt.id}`) as HTMLInputElement;
                    if (input.value) {
                      onReservationStatusChange(receipt, 'confirmed', input.value);
                    }
                  }}
                >
                  확정
                </button>
              </div>
            </div>
          </div>

          {/* 메모 */}
          <div className="section">
            <h4>특이사항 메모</h4>
            <textarea
              value={memoText}
              onChange={(e) => setMemoText(e.target.value)}
              placeholder="환자 관련 메모를 입력하세요..."
              rows={4}
            />
            <button className="save-memo-btn" onClick={handleSaveMemo}>
              메모 저장
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default ReceiptView;
