import React, { useState, useEffect, useCallback } from 'react';
import { useEscapeKey } from '@shared/hooks/useEscapeKey';
import { useDraggableModal } from '../hooks/useDraggableModal';
import {
  fetchPatientReceiptHistory,
  type PatientReceiptHistoryResponse,
  type ReceiptHistoryItem,
} from '../../manage/lib/api';
import { getPatientMemoData, fetchPatientPreviousMemos } from '../lib/api';
import type {
  TreatmentPackage,
  HerbalPackage,
  Membership,
  HerbalDispensing,
  GiftDispensing,
  MedicineUsage,
  YakchimUsageRecord,
  ReceiptMemo,
} from '../types';

interface PatientReceiptHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientId: number;
  patientName: string;
  chartNo: string;
  onNavigateToDate?: (date: string, patientId: number) => void;
}

// 기간 필터 옵션
type PeriodFilter = '1month' | '3months' | '6months' | '1year' | 'all';

const PERIOD_LABELS: Record<PeriodFilter, string> = {
  '1month': '1개월',
  '3months': '3개월',
  '6months': '6개월',
  '1year': '1년',
  'all': '전체',
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
  '기타침/자석침': '자석침',
  '수양명경경락검사': '경락검사',
  '추나요법(복잡)': '추나복잡',
  '추나요법(단순)': '추나단순',
  '간접구': '간접구',
  '열전기침': '열전기',
  '부항': '부항',
  '전기부항요법': '전기부항',
  '한방물리요법': '물리',
  '한방온열요법': '온열',
  '경피경혈': '경피경혈',
  '흉복강침술': '흉복강',
};

// 진료명 간소화 함수
const shortenTreatmentName = (name: string): string => {
  if (TREATMENT_NAME_MAP[name]) return TREATMENT_NAME_MAP[name];
  if (name.length <= 6) return name;
  return name.substring(0, 4);
};

// 금액 포맷
const formatMoney = (amount?: number | null): string => {
  if (amount === undefined || amount === null || amount === 0) return '-';
  return Math.floor(amount).toLocaleString();
};

// 날짜 포맷 (YY/MM/DD)
const formatDateShort = (dateStr: string): string => {
  if (!dateStr) return '-';
  // "2026-01-12" 또는 "2026-01-12T10:30:00" 형식 처리
  const datePart = dateStr.split(/[\sT]/)[0]; // 공백 또는 T로 분리
  const parts = datePart.split('-');
  if (parts.length >= 3 && parts[0] && parts[1] && parts[2]) {
    const year = parts[0].slice(-2); // 마지막 2자리
    const month = parts[1].padStart(2, '0');
    const day = parts[2].substring(0, 2).padStart(2, '0'); // 혹시 뒤에 다른 문자가 있으면 제거
    return `${year}/${month}/${day}`;
  }
  return '-';
};

// 확장된 수납 데이터
interface ExpandedHistoryItem extends ReceiptHistoryItem {
  treatmentPackages: TreatmentPackage[];
  herbalPackages: HerbalPackage[];
  pointBalance: number;
  todayPointUsed: number;
  todayPointEarned: number;
  activeMembership: Membership | null;
  herbalDispensings: HerbalDispensing[];
  giftDispensings: GiftDispensing[];
  medicineUsages: MedicineUsage[];
  yakchimUsageRecords: YakchimUsageRecord[];
  receiptMemo: ReceiptMemo | null;
  memoLoaded: boolean;
}

// 메모 요약 생성
const generateMemoSummary = (receipt: ExpandedHistoryItem): string => {
  const parts: string[] = [];

  // 패키지
  for (const pkg of receipt.treatmentPackages) {
    parts.push(`${pkg.package_name}(${pkg.remaining_count}/${pkg.total_count})`);
  }
  for (const pkg of receipt.herbalPackages) {
    parts.push(`선결(${pkg.remaining_count}/${pkg.total_count})`);
  }

  // 약침 사용
  for (const y of receipt.yakchimUsageRecords) {
    if (y.remaining_count !== undefined && y.total_count !== undefined) {
      parts.push(`약침(${y.remaining_count}/${y.total_count})`);
    }
  }

  // 상비약
  const totalMedicine = receipt.medicineUsages.reduce((sum, m) => sum + (m.amount || 0), 0);
  if (totalMedicine > 0) {
    parts.push(`상비약${totalMedicine.toLocaleString()}`);
  }

  // 포인트
  if (receipt.todayPointUsed > 0) {
    parts.push(`포인트-${receipt.todayPointUsed.toLocaleString()}`);
  }
  if (receipt.todayPointEarned > 0) {
    parts.push(`적립+${receipt.todayPointEarned.toLocaleString()}`);
  }

  // 일반 메모
  const memo = receipt.receiptMemo?.memo || receipt.memo;
  if (memo && memo.trim() && memo !== '/' && memo !== 'x' && memo !== 'X') {
    // 메모가 너무 길면 자르기
    const trimmed = memo.length > 20 ? memo.slice(0, 20) + '...' : memo;
    parts.push(trimmed);
  }

  return parts.join(' / ') || '-';
};

// 진료 항목 분류
interface TreatmentSummary {
  consultType: string | null;
  coveredItems: string[];
  chunaItems: string[];  // 추나 항목 별도 분류
  uncoveredItems: { name: string; amount: number }[];
}

const summarizeTreatments = (treatments: { name: string; amount: number; is_covered: boolean }[]): TreatmentSummary => {
  const result: TreatmentSummary = {
    consultType: null,
    coveredItems: [],
    chunaItems: [],
    uncoveredItems: [],
  };

  for (const t of treatments) {
    const name = t.name;

    if (name.includes('진찰료')) {
      if (name.includes('초진')) result.consultType = '초진';
      else if (name.includes('재진')) result.consultType = '재진';
      continue;
    }

    // 추나 항목 별도 분류
    if (name.includes('추나')) {
      const shortName = shortenTreatmentName(name);
      if (shortName && !result.chunaItems.includes(shortName)) {
        result.chunaItems.push(shortName);
      }
      continue;
    }

    if (t.is_covered) {
      const shortName = shortenTreatmentName(name);
      if (shortName && !result.coveredItems.includes(shortName)) {
        result.coveredItems.push(shortName);
      }
    } else {
      result.uncoveredItems.push({ name, amount: t.amount });
    }
  }

  return result;
};

export function PatientReceiptHistoryModal({
  isOpen,
  onClose,
  patientId,
  patientName,
  chartNo,
  onNavigateToDate,
}: PatientReceiptHistoryModalProps) {
  const [period, setPeriod] = useState<PeriodFilter>('all');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<PatientReceiptHistoryResponse | null>(null);
  const [receipts, setReceipts] = useState<ExpandedHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 세부내역 모달 상태
  const [detailReceipt, setDetailReceipt] = useState<ExpandedHistoryItem | null>(null);

  const { modalRef, modalStyle, modalClassName, handleMouseDown } = useDraggableModal({ isOpen });

  const getStartDate = useCallback((periodFilter: PeriodFilter): string | undefined => {
    if (periodFilter === 'all') return undefined;
    const today = new Date();
    switch (periodFilter) {
      case '1month': today.setMonth(today.getMonth() - 1); break;
      case '3months': today.setMonth(today.getMonth() - 3); break;
      case '6months': today.setMonth(today.getMonth() - 6); break;
      case '1year': today.setFullYear(today.getFullYear() - 1); break;
    }
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  }, []);

  // 데이터 로드
  const loadData = useCallback(async () => {
    if (!isOpen) return;

    setIsLoading(true);
    setError(null);

    try {
      const startDate = getStartDate(period);
      const response = await fetchPatientReceiptHistory({
        patientId,
        page,
        limit: 30,
        startDate,
      });

      setData(response);

      // 확장 데이터로 변환
      const expandedReceipts: ExpandedHistoryItem[] = response.receipts.map(r => ({
        ...r,
        treatmentPackages: [],
        herbalPackages: [],
        pointBalance: 0,
        todayPointUsed: 0,
        todayPointEarned: 0,
        activeMembership: null,
        herbalDispensings: [],
        giftDispensings: [],
        medicineUsages: [],
        yakchimUsageRecords: [],
        receiptMemo: null,
        memoLoaded: false,
      }));

      // 각 날짜별 메모 데이터 로드 (병렬)
      const uniqueDates = [...new Set(response.receipts.map(r => r.receipt_date).filter(Boolean))];
      const dateDataMap = new Map<string, any>();

      await Promise.all(
        uniqueDates.map(async (date) => {
          if (!date) return;
          const memoData = await getPatientMemoData(patientId, date).catch(() => null);
          if (memoData) dateDataMap.set(date, memoData);
        })
      );

      // 메모 데이터 병합
      const mergedReceipts = expandedReceipts.map(r => {
        const memoData = dateDataMap.get(r.receipt_date || '');
        if (memoData) {
          return {
            ...r,
            treatmentPackages: memoData.treatmentPackages || [],
            herbalPackages: memoData.herbalPackages || [],
            pointBalance: memoData.pointBalance || 0,
            todayPointUsed: memoData.todayPointUsed || 0,
            todayPointEarned: memoData.todayPointEarned || 0,
            activeMembership: memoData.membership || null,
            herbalDispensings: memoData.herbalDispensings || [],
            giftDispensings: memoData.giftDispensings || [],
            medicineUsages: memoData.medicineUsages || [],
            yakchimUsageRecords: memoData.yakchimUsageRecords || [],
            receiptMemo: memoData.memo || null,
            memoLoaded: true,
          };
        }
        return r;
      });

      setReceipts(mergedReceipts);
    } catch (err) {
      console.error('수납이력 조회 오류:', err);
      setError('수납이력을 불러오는데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [isOpen, patientId, page, period, getStartDate]);

  useEffect(() => {
    if (isOpen) {
      setPage(1);
      loadData();
    }
  }, [isOpen]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEscapeKey(() => {
    if (detailReceipt) {
      setDetailReceipt(null);
    } else {
      onClose();
    }
  }, isOpen);

  const handlePeriodChange = (newPeriod: PeriodFilter) => {
    setPeriod(newPeriod);
    setPage(1);
  };

  // 진료항목 클릭 시 세부내역 모달
  const handleTreatmentClick = (receipt: ExpandedHistoryItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setDetailReceipt(receipt);
  };

  // 날짜/행 클릭 시 해당 날짜로 이동
  const handleNavigateClick = (receipt: ExpandedHistoryItem) => {
    if (onNavigateToDate && receipt.receipt_date) {
      onNavigateToDate(receipt.receipt_date, patientId);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="patient-history-modal-overlay" onClick={onClose}>
      <div
        ref={modalRef}
        className={`patient-history-modal patient-history-modal-v2 ${modalClassName}`}
        style={modalStyle}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="history-modal-header draggable" onMouseDown={handleMouseDown}>
          <h3>
            <span className="patient-name">{patientName}</span>
            <span className="chart-no">({chartNo.replace(/^0+/, '')})</span>
            <span className="title-suffix">수납이력</span>
          </h3>
          <button className="close-btn" onClick={onClose}>
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        {/* 필터 및 통계 */}
        <div className="history-modal-toolbar">
          <div className="period-filters">
            {(Object.keys(PERIOD_LABELS) as PeriodFilter[]).map(p => (
              <button
                key={p}
                className={`period-btn ${period === p ? 'active' : ''}`}
                onClick={() => handlePeriodChange(p)}
              >
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>
          <div className="history-summary">
            총 <strong>{data?.summary.total_count || 0}</strong>회 |{' '}
            <strong>{formatMoney(data?.summary.total_amount)}</strong>원
          </div>
        </div>

        {/* 테이블 */}
        <div className="history-modal-body">
          {isLoading && (
            <div className="history-loading">
              <i className="fa-solid fa-spinner fa-spin"></i> 불러오는 중...
            </div>
          )}

          {error && (
            <div className="history-error">
              <i className="fa-solid fa-circle-exclamation"></i> {error}
            </div>
          )}

          {!isLoading && !error && receipts.length === 0 && (
            <div className="history-empty">
              <i className="fa-solid fa-receipt"></i>
              <p>수납이력이 없습니다.</p>
            </div>
          )}

          {!isLoading && !error && receipts.length > 0 && (
            <div className="history-table-v2">
              {/* 테이블 헤더 */}
              <div className="history-header-row-v2">
                <div className="col-date">날짜</div>
                <div className="col-time">시간</div>
                <div className="col-insu">종별</div>
                <div className="col-method">결제</div>
                <div className="col-total">총금액</div>
                <div className="col-self">본인부담</div>
                <div className="col-general">비급여</div>
                <div className="col-memo">메모</div>
              </div>

              {/* 테이블 바디 */}
              {receipts.map((receipt) => {
                const summary = summarizeTreatments(receipt.treatments || []);
                const memoSummary = generateMemoSummary(receipt);

                return (
                  <div key={receipt.id} className="history-item-v2">
                    {/* 첫째줄: 날짜, 시간, 결제, 금액, 메모 */}
                    <div
                      className={`history-row-main ${onNavigateToDate ? 'clickable' : ''}`}
                      onClick={() => handleNavigateClick(receipt)}
                      title={onNavigateToDate ? '클릭하여 해당 날짜로 이동' : undefined}
                    >
                      <div className="col-date">
                        {receipt.receipt_date ? formatDateShort(receipt.receipt_date) : '-'}
                      </div>
                      <div className="col-time">
                        {receipt.receipt_time
                          ? receipt.receipt_time.split(' ')[1] || '-'
                          : '-'}
                      </div>
                      <div className="col-insu">
                        {receipt.insurance_type || '-'}
                      </div>
                      <div className="col-method">
                        {receipt.card > 0 && <i className="fa-solid fa-credit-card" title="카드"></i>}
                        {receipt.cash > 0 && <i className="fa-solid fa-money-bill" title="현금"></i>}
                        {receipt.transfer > 0 && <i className="fa-solid fa-building-columns" title="이체"></i>}
                      </div>
                      <div className="col-total">{formatMoney(receipt.total_amount)}</div>
                      <div className="col-self">{formatMoney(receipt.insurance_self)}</div>
                      <div className="col-general">{formatMoney(receipt.general_amount)}</div>
                      <div className="col-memo">
                        <span className="memo-text" title={memoSummary}>{memoSummary}</span>
                      </div>
                    </div>

                    {/* 둘째줄: 진료내역, 비급여항목 */}
                    <div
                      className="history-row-detail clickable"
                      onClick={(e) => handleTreatmentClick(receipt, e)}
                      title="클릭하여 세부내역 보기"
                    >
                      <div className="treatment-badges">
                        {summary.consultType && (
                          <span className={`badge ${summary.consultType === '초진' ? 'consult-first' : 'consult-return'}`}>{summary.consultType}</span>
                        )}
                        {summary.coveredItems.map((item, idx) => (
                          <span key={idx} className="badge covered">{item}</span>
                        ))}
                        {summary.chunaItems.map((item, idx) => (
                          <span key={`chuna-${idx}`} className="badge chuna">{item}</span>
                        ))}
                        {summary.coveredItems.length === 0 && summary.chunaItems.length === 0 && !summary.consultType && (
                          <span className="badge empty">-</span>
                        )}
                      </div>
                      <div className="uncovered-badges">
                        {summary.uncoveredItems.length > 0 ? (
                          summary.uncoveredItems.map((item, idx) => (
                            <span key={idx} className="badge uncovered">
                              {item.name.length > 8 ? item.name.slice(0, 8) : item.name} {item.amount.toLocaleString()}
                            </span>
                          ))
                        ) : (
                          <span className="badge empty">-</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 페이징 */}
        {data && data.pagination.total_pages > 1 && (
          <div className="history-modal-footer">
            <button
              className="page-btn"
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
            >
              <i className="fa-solid fa-chevron-left"></i> 이전
            </button>
            <span className="page-info">
              {page} / {data.pagination.total_pages}
            </span>
            <button
              className="page-btn"
              disabled={!data.pagination.has_more}
              onClick={() => setPage(p => p + 1)}
            >
              다음 <i className="fa-solid fa-chevron-right"></i>
            </button>
          </div>
        )}
      </div>

      {/* 세부내역 모달 */}
      {detailReceipt && (
        <ReceiptDetailModal
          receipt={detailReceipt}
          onClose={() => setDetailReceipt(null)}
        />
      )}
    </div>
  );
}

// 세부내역 모달 컴포넌트
function ReceiptDetailModal({
  receipt,
  onClose,
}: {
  receipt: ExpandedHistoryItem;
  onClose: () => void;
}) {
  const coveredItems = receipt.treatments?.filter(t => t.is_covered) || [];
  const uncoveredItems = receipt.treatments?.filter(t => !t.is_covered) || [];

  return (
    <div className="receipt-detail-modal-overlay" onClick={onClose}>
      <div className="receipt-detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="detail-modal-header">
          <h4>
            <i className="fa-solid fa-file-invoice"></i>
            {receipt.receipt_date ? formatDateShort(receipt.receipt_date) : ''} 진료상세
          </h4>
          <button className="close-btn" onClick={onClose}>
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div className="detail-modal-body">
          {/* 급여 항목 */}
          <div className="detail-section">
            <h5 className="section-title insurance">
              <i className="fa-solid fa-shield-halved"></i> 급여 항목
            </h5>
            {coveredItems.length > 0 ? (
              <>
                <div className="detail-items-grid">
                  {coveredItems.map((item, idx) => (
                    <div key={idx} className="detail-item">
                      <span className="item-name">{item.name}</span>
                      <span className="item-amount">{(item.amount || 0).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
                <div className="detail-subtotal insurance">
                  <span>본인부담금</span>
                  <span className="amount">{formatMoney(receipt.insurance_self)}원</span>
                </div>
              </>
            ) : (
              <div className="detail-empty">급여 항목 없음</div>
            )}
          </div>

          {/* 비급여 항목 */}
          <div className="detail-section">
            <h5 className="section-title general">
              <i className="fa-solid fa-receipt"></i> 비급여 항목
            </h5>
            {uncoveredItems.length > 0 ? (
              <>
                <div className="detail-items-list">
                  {uncoveredItems.map((item, idx) => (
                    <div key={idx} className="detail-item-row">
                      <span className="item-name">{item.name}</span>
                      <span className="item-amount">{(item.amount || 0).toLocaleString()}원</span>
                    </div>
                  ))}
                </div>
                <div className="detail-subtotal general">
                  <span>비급여 합계</span>
                  <span className="amount">{formatMoney(receipt.general_amount)}원</span>
                </div>
              </>
            ) : (
              <div className="detail-empty">비급여 항목 없음</div>
            )}
          </div>

          {/* 총합계 */}
          <div className="detail-grand-total">
            <span>총 수납액</span>
            <span className="amount">{formatMoney(receipt.total_amount)}원</span>
          </div>

          {/* 결제 방식 */}
          <div className="detail-payment-method">
            {receipt.card > 0 && (
              <span className="method card">
                <i className="fa-solid fa-credit-card"></i> 카드 {receipt.card.toLocaleString()}원
              </span>
            )}
            {receipt.cash > 0 && (
              <span className="method cash">
                <i className="fa-solid fa-money-bill"></i> 현금 {receipt.cash.toLocaleString()}원
              </span>
            )}
            {receipt.transfer > 0 && (
              <span className="method transfer">
                <i className="fa-solid fa-building-columns"></i> 이체 {receipt.transfer.toLocaleString()}원
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default PatientReceiptHistoryModal;
