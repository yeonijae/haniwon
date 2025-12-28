import React, { useState, useEffect, useCallback } from 'react';
import { useEscapeKey } from '@shared/hooks/useEscapeKey';
import {
  fetchPatientReceiptHistory,
  type PatientReceiptHistoryResponse,
  type ReceiptHistoryItem,
} from '../../manage/lib/api';
import { getPatientMemoData } from '../lib/api';
import type {
  TreatmentPackage,
  HerbalPackage,
  Membership,
  HerbalDispensing,
  GiftDispensing,
  ReceiptMemo,
  ReservationStatus,
  RESERVATION_STATUS_LABELS,
} from '../types';

interface PatientReceiptHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientId: number;
  patientName: string;
  chartNo: string;
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
};

// 진료 항목 요약
interface TreatmentSummary {
  consultType: string | null;
  coveredItems: string[];
  yakchim: { name: string; amount: number }[];
  sangbiyak: number;
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

    if (name.includes('진찰료')) {
      if (name.includes('초진')) result.consultType = '초진';
      else if (name.includes('재진')) result.consultType = '재진';
      continue;
    }

    if (name.includes('약침')) {
      const yakchimName = name.replace('약침', '').trim() || name;
      result.yakchim.push({ name: yakchimName, amount: t.amount });
      continue;
    }

    if (name.includes('상비약') || name.includes('상비')) {
      result.sangbiyak += t.amount;
      continue;
    }

    if (t.is_covered) {
      const shortName = TREATMENT_NAME_MAP[name];
      if (shortName && !result.coveredItems.includes(shortName)) {
        result.coveredItems.push(shortName);
      }
    }
  }

  return result;
};

// 금액 포맷
const formatMoney = (amount?: number | null): string => {
  if (amount === undefined || amount === null || amount === 0) return '-';
  return Math.floor(amount).toLocaleString();
};

// 날짜 포맷 (MM/DD(요일))
const formatDateShort = (dateStr: string): string => {
  const d = new Date(dateStr);
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  return `${d.getMonth() + 1}/${d.getDate()}(${dayNames[d.getDay()]})`;
};

// 확장된 수납 데이터 (SQLite 메모 포함)
interface ExpandedHistoryItem extends ReceiptHistoryItem {
  // SQLite 데이터
  treatmentPackages: TreatmentPackage[];
  herbalPackages: HerbalPackage[];
  pointBalance: number;
  todayPointUsed: number;
  todayPointEarned: number;
  activeMembership: Membership | null;
  herbalDispensings: HerbalDispensing[];
  giftDispensings: GiftDispensing[];
  receiptMemo: ReceiptMemo | null;
  // UI 상태
  isExpanded: boolean;
  isLoading: boolean;
}

export function PatientReceiptHistoryModal({
  isOpen,
  onClose,
  patientId,
  patientName,
  chartNo,
}: PatientReceiptHistoryModalProps) {
  const [period, setPeriod] = useState<PeriodFilter>('all');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<PatientReceiptHistoryResponse | null>(null);
  const [receipts, setReceipts] = useState<ExpandedHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 기간에 따른 시작일 계산
  const getStartDate = useCallback((periodFilter: PeriodFilter): string | undefined => {
    if (periodFilter === 'all') return undefined;

    const today = new Date();
    switch (periodFilter) {
      case '1month':
        today.setMonth(today.getMonth() - 1);
        break;
      case '3months':
        today.setMonth(today.getMonth() - 3);
        break;
      case '6months':
        today.setMonth(today.getMonth() - 6);
        break;
      case '1year':
        today.setFullYear(today.getFullYear() - 1);
        break;
    }
    return today.toISOString().split('T')[0];
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
        receiptMemo: null,
        isExpanded: false,
        isLoading: false,
      }));

      setReceipts(expandedReceipts);
    } catch (err) {
      console.error('수납이력 조회 오류:', err);
      setError('수납이력을 불러오는데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [isOpen, patientId, page, period, getStartDate]);

  // 모달 열릴 때 데이터 로드
  useEffect(() => {
    if (isOpen) {
      setPage(1);
      loadData();
    }
  }, [isOpen]);

  // 페이지/기간 변경 시 데이터 로드
  useEffect(() => {
    loadData();
  }, [loadData]);

  // ESC 키로 모달 닫기
  useEscapeKey(onClose, isOpen);

  // 기간 변경 시 페이지 리셋
  const handlePeriodChange = (newPeriod: PeriodFilter) => {
    setPeriod(newPeriod);
    setPage(1);
  };

  // 행 확장/축소 토글
  const toggleExpand = async (receiptId: number, receiptDate: string) => {
    const receipt = receipts.find(r => r.id === receiptId);
    if (!receipt) return;

    if (receipt.isExpanded) {
      // 축소
      setReceipts(prev => prev.map(r =>
        r.id === receiptId ? { ...r, isExpanded: false } : r
      ));
    } else {
      // 확장 - SQLite 데이터 로드
      setReceipts(prev => prev.map(r =>
        r.id === receiptId ? { ...r, isExpanded: true, isLoading: true } : r
      ));

      try {
        const memoData = await getPatientMemoData(patientId, receiptDate);
        setReceipts(prev => prev.map(r =>
          r.id === receiptId ? {
            ...r,
            treatmentPackages: memoData.treatmentPackages,
            herbalPackages: memoData.herbalPackages,
            pointBalance: memoData.pointBalance,
            todayPointUsed: memoData.todayPointUsed,
            todayPointEarned: memoData.todayPointEarned,
            activeMembership: memoData.membership,
            herbalDispensings: memoData.herbalDispensings,
            giftDispensings: memoData.giftDispensings,
            receiptMemo: memoData.memo,
            isLoading: false,
          } : r
        ));
      } catch (err) {
        console.error('메모 데이터 로드 실패:', err);
        setReceipts(prev => prev.map(r =>
          r.id === receiptId ? { ...r, isLoading: false } : r
        ));
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="patient-history-modal-overlay" onClick={onClose}>
      <div className="patient-history-modal" onClick={(e) => e.stopPropagation()}>
        {/* 헤더 */}
        <div className="history-modal-header">
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
            <div className="history-table">
              {/* 테이블 헤더 */}
              <div className="history-header-row">
                <div className="col-date">날짜</div>
                <div className="col-items">진료항목</div>
                <div className="col-self">본인부담</div>
                <div className="col-general">비급여</div>
                <div className="col-method">방식</div>
                <div className="col-memo">메모</div>
              </div>

              {/* 테이블 바디 */}
              {receipts.map((receipt) => (
                <React.Fragment key={receipt.id}>
                  {/* 메인 행 */}
                  <div
                    className={`history-row ${receipt.isExpanded ? 'expanded' : ''}`}
                    onClick={() => receipt.receipt_date && toggleExpand(receipt.id, receipt.receipt_date)}
                  >
                    <div className="col-date">
                      {receipt.receipt_date ? formatDateShort(receipt.receipt_date) : '-'}
                    </div>
                    <div className="col-items">
                      {(() => {
                        const summary = summarizeTreatments(receipt.treatments || []);
                        const items = [
                          summary.consultType,
                          ...summary.coveredItems
                        ].filter(Boolean);
                        return items.join(' ') || '-';
                      })()}
                    </div>
                    <div className="col-self">{formatMoney(receipt.insurance_self)}</div>
                    <div className="col-general">{formatMoney(receipt.general_amount)}</div>
                    <div className="col-method">
                      {receipt.card > 0 && <i className="fa-solid fa-credit-card text-purple-600" title="카드"></i>}
                      {receipt.cash > 0 && <i className="fa-solid fa-money-bill text-orange-600" title="현금"></i>}
                      {receipt.transfer > 0 && <i className="fa-solid fa-building-columns text-teal-600" title="이체"></i>}
                    </div>
                    <div className="col-memo">
                      <span className="memo-text">{receipt.memo || '-'}</span>
                    </div>
                  </div>

                  {/* 확장된 상세 패널 */}
                  {receipt.isExpanded && (
                    <div className="history-detail-panel">
                      {receipt.isLoading ? (
                        <div className="detail-loading">
                          <i className="fa-solid fa-spinner fa-spin"></i> 로딩 중...
                        </div>
                      ) : (
                        <HistoryDetailPanel receipt={receipt} />
                      )}
                    </div>
                  )}
                </React.Fragment>
              ))}
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
    </div>
  );
}

// 상세 패널 컴포넌트
function HistoryDetailPanel({ receipt }: { receipt: ExpandedHistoryItem }) {
  const treatmentSummary = summarizeTreatments(receipt.treatments || []);
  const hasPackages = receipt.treatmentPackages.length > 0 || receipt.herbalPackages.length > 0;
  const hasMembership = !!receipt.activeMembership;

  return (
    <div className="history-detail-2col">
      {/* 왼쪽: 진료상세 */}
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
            {receipt.card > 0 && (
              <span className="method card">
                <i className="fa-solid fa-credit-card"></i> {receipt.card.toLocaleString()}
              </span>
            )}
            {receipt.cash > 0 && (
              <span className="method cash">
                <i className="fa-solid fa-money-bill"></i> {receipt.cash.toLocaleString()}
              </span>
            )}
            {receipt.transfer > 0 && (
              <span className="method transfer">
                <i className="fa-solid fa-building-columns"></i> {receipt.transfer.toLocaleString()}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 오른쪽: 수납메모 3x2 그리드 */}
      <div className="detail-grid-3x2">
        {/* 패키지 */}
        <div className="grid-card">
          <div className="grid-card-header">
            <span className="grid-icon">📦</span>
            <span className="grid-title">패키지</span>
          </div>
          <div className="grid-card-body">
            {hasPackages ? (
              <div className="grid-tags">
                {receipt.treatmentPackages.map(pkg => (
                  <div key={pkg.id} className="grid-tag pkg">
                    <span className="tag-name">{pkg.package_name}</span>
                    <span className="tag-count">{pkg.remaining_count}/{pkg.total_count}</span>
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
          </div>
          <div className="grid-card-body">
            {hasMembership ? (
              <div className="grid-tags">
                <div className="grid-tag membership">
                  <span className="tag-name">{receipt.activeMembership!.membership_type}</span>
                  <span className="tag-count">{receipt.activeMembership!.remaining_count}회</span>
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
          </div>
          <div className="grid-card-body">
            <div className="grid-point-info">
              {receipt.todayPointUsed > 0 && (
                <span className="point-used">-{receipt.todayPointUsed.toLocaleString()}</span>
              )}
              {receipt.todayPointEarned > 0 && (
                <span className="point-earned">+{receipt.todayPointEarned.toLocaleString()}</span>
              )}
              {receipt.todayPointUsed === 0 && receipt.todayPointEarned === 0 && (
                <span className="grid-empty">-</span>
              )}
            </div>
          </div>
        </div>

        {/* 출납 */}
        <div className="grid-card">
          <div className="grid-card-header">
            <span className="grid-icon">📋</span>
            <span className="grid-title">출납</span>
          </div>
          <div className="grid-card-body">
            {(receipt.herbalDispensings.length > 0 || receipt.giftDispensings.length > 0) ? (
              <div className="grid-tags">
                {receipt.herbalDispensings.map(d => (
                  <div key={d.id} className="grid-tag dispensing">
                    <span className="tag-name">{d.herbal_name}</span>
                    <span className="tag-qty">{d.quantity}</span>
                  </div>
                ))}
                {receipt.giftDispensings.map(d => (
                  <div key={d.id} className="grid-tag gift">
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
          </div>
          <div className="grid-card-body">
            {receipt.receiptMemo?.reservation_status && receipt.receiptMemo.reservation_status !== 'none' ? (
              <span className={`reservation-status ${receipt.receiptMemo.reservation_status}`}>
                {receipt.receiptMemo.reservation_status === 'confirmed'
                  ? receipt.receiptMemo.reservation_date || '예약완료'
                  : receipt.receiptMemo.reservation_status}
              </span>
            ) : (
              <span className="grid-empty">-</span>
            )}
          </div>
        </div>

        {/* 메모 */}
        <div className="grid-card">
          <div className="grid-card-header">
            <span className="grid-icon">📝</span>
            <span className="grid-title">메모</span>
          </div>
          <div className="grid-card-body">
            <span className="memo-text">
              {receipt.receiptMemo?.memo || receipt.memo || '-'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PatientReceiptHistoryModal;
