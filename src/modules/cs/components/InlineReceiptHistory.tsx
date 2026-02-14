/**
 * 인라인 수납이력 컴포넌트
 * 수납 상세뷰 오른쪽 단에 표시되는 환자 수납이력 + 비급여 메모
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  MedicineUsage,
  YakchimUsageRecord,
  ReceiptMemo,
} from '../types';

interface InlineReceiptHistoryProps {
  patientId: number;
  patientName?: string;
  chartNo?: string;
  currentDate?: string; // 현재 선택된 날짜 하이라이트
  onNavigateToDate?: (date: string) => void;
}

// 확장된 수납 데이터 (메모 포함)
interface ExpandedReceipt extends ReceiptHistoryItem {
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

// 기간 필터
type PeriodFilter = '1month' | '3months' | '6months' | '1year' | 'all';

const PERIOD_LABELS: Record<PeriodFilter, string> = {
  '1month': '1개월',
  '3months': '3개월',
  '6months': '6개월',
  '1year': '1년',
  'all': '전체',
};

// 진료명 간소화 매핑
const TREATMENT_SHORT: Record<string, string> = {
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

const shortenName = (name: string): string => {
  if (TREATMENT_SHORT[name]) return TREATMENT_SHORT[name];
  if (name.length <= 6) return name;
  return name.substring(0, 4);
};

const formatMoney = (amount?: number | null): string => {
  if (amount === undefined || amount === null || amount === 0) return '-';
  return Math.floor(amount).toLocaleString();
};

const formatDateShort = (dateStr: string): string => {
  if (!dateStr) return '-';
  const datePart = dateStr.split(/[\sT]/)[0];
  const parts = datePart.split('-');
  if (parts.length >= 3 && parts[0] && parts[1] && parts[2]) {
    const month = parts[1].padStart(2, '0');
    const day = parts[2].substring(0, 2).padStart(2, '0');
    return `${month}/${day}`;
  }
  return '-';
};

// 메모 요약 생성
const generateMemoSummary = (receipt: ExpandedReceipt): string => {
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
    const trimmed = memo.length > 20 ? memo.slice(0, 20) + '...' : memo;
    parts.push(trimmed);
  }

  return parts.join(' / ') || '';
};

const InlineReceiptHistory: React.FC<InlineReceiptHistoryProps> = ({
  patientId,
  patientName,
  chartNo,
  currentDate,
  onNavigateToDate,
}) => {
  const [period, setPeriod] = useState<PeriodFilter>('3months');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<PatientReceiptHistoryResponse | null>(null);
  const [receipts, setReceipts] = useState<ExpandedReceipt[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailReceipt, setDetailReceipt] = useState<ExpandedReceipt | null>(null);

  // 모달 드래그 상태
  const [modalPos, setModalPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // ESC 키로 모달 닫기
  useEffect(() => {
    if (!detailReceipt) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDetailReceipt(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [detailReceipt]);

  // 모달 열릴 때 위치 초기화
  useEffect(() => {
    if (detailReceipt) setModalPos({ x: 0, y: 0 });
  }, [detailReceipt]);

  // 드래그 핸들러
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    // 닫기 버튼 클릭 시 드래그 시작 안 함
    if ((e.target as HTMLElement).closest('.close-btn')) return;
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: modalPos.x, origY: modalPos.y };

    const handleMouseMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = ev.clientX - dragRef.current.startX;
      const dy = ev.clientY - dragRef.current.startY;
      setModalPos({ x: dragRef.current.origX + dx, y: dragRef.current.origY + dy });
    };
    const handleMouseUp = () => {
      dragRef.current = null;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [modalPos]);

  const getStartDate = useCallback((pf: PeriodFilter): string | undefined => {
    if (pf === 'all') return undefined;
    const today = new Date();
    switch (pf) {
      case '1month': today.setMonth(today.getMonth() - 1); break;
      case '3months': today.setMonth(today.getMonth() - 3); break;
      case '6months': today.setMonth(today.getMonth() - 6); break;
      case '1year': today.setFullYear(today.getFullYear() - 1); break;
    }
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  }, []);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const startDate = getStartDate(period);
      const response = await fetchPatientReceiptHistory({
        patientId,
        page,
        limit: 50,
        startDate,
      });
      setData(response);

      // 확장 데이터로 변환
      const expandedReceipts: ExpandedReceipt[] = response.receipts.map(r => ({
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

      // 각 날짜별 메모 데이터 병렬 로드
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
  }, [patientId, page, period, getStartDate]);

  useEffect(() => {
    setPage(1);
  }, [patientId, period]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handlePeriodChange = (newPeriod: PeriodFilter) => {
    setPeriod(newPeriod);
    setPage(1);
  };

  return (
    <div className="inline-receipt-history">
      {/* 헤더: 기간 필터 + 통계 */}
      <div className="irh-toolbar">
        <div className="irh-period-filters">
          {(Object.keys(PERIOD_LABELS) as PeriodFilter[]).map(p => (
            <button
              key={p}
              className={`irh-period-btn ${period === p ? 'active' : ''}`}
              onClick={() => handlePeriodChange(p)}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
        {data && (
          <div className="irh-summary">
            <strong>{data.summary.total_count}</strong>회 · <strong>{formatMoney(data.summary.total_amount)}</strong>원
          </div>
        )}
      </div>

      {/* 본문 */}
      <div className="irh-body">
        {isLoading && (
          <div className="irh-loading">
            <i className="fa-solid fa-spinner fa-spin"></i> 불러오는 중...
          </div>
        )}

        {error && (
          <div className="irh-error">
            <i className="fa-solid fa-circle-exclamation"></i> {error}
          </div>
        )}

        {!isLoading && !error && receipts.length === 0 && (
          <div className="irh-empty">수납이력이 없습니다.</div>
        )}

        {!isLoading && !error && receipts.length > 0 && (
          <div className="irh-list">
            {receipts.map((receipt) => {
              const isCurrentDate = currentDate && receipt.receipt_date === currentDate;
              const treatments = receipt.treatments || [];
              const uncovered = treatments.filter(t => !t.is_covered);
              const memoSummary = generateMemoSummary(receipt);

              // 초진/재진 구분
              const consultType = treatments.find(t => t.name.includes('진찰료'));
              const consultLabel = consultType
                ? consultType.name.includes('초진') ? '초진' : '재진'
                : null;

              // 부항 관련
              const buhang = treatments.filter(t =>
                t.name.includes('부항') || t.name.includes('유관') || t.name.includes('자락관')
              );

              // 추나 관련
              const chuna = treatments.filter(t => t.name.includes('추나'));

              return (
                <div
                  key={receipt.id}
                  className={`irh-item ${isCurrentDate ? 'current' : ''} ${onNavigateToDate ? 'clickable' : ''}`}
                  onClick={() => setDetailReceipt(receipt)}
                  title="클릭하여 상세 수납내역 보기"
                >
                  {/* 첫줄: 날짜 + 금액 + 결제방식 */}
                  <div className="irh-item-main">
                    <span className="irh-date">{receipt.receipt_date ? formatDateShort(receipt.receipt_date) : '-'}</span>
                    <span className="irh-amount">{formatMoney(receipt.total_amount)}</span>
                    <span className="irh-methods">
                      {receipt.card > 0 && <i className="fa-solid fa-credit-card" title="카드"></i>}
                      {receipt.cash > 0 && <i className="fa-solid fa-money-bill" title="현금"></i>}
                      {receipt.transfer > 0 && <i className="fa-solid fa-building-columns" title="이체"></i>}
                    </span>
                    {receipt.insurance_self > 0 && (
                      <span className="irh-self">본인 {formatMoney(receipt.insurance_self)}</span>
                    )}
                    {receipt.general_amount > 0 && (
                      <span className="irh-general">비급여 {formatMoney(receipt.general_amount)}</span>
                    )}
                  </div>
                  {/* 둘째줄: 초진/재진 + 부항 + 추나 + 비급여 항목 */}
                  <div className="irh-item-badges">
                    {consultLabel && (
                      <span className={`irh-badge ${consultLabel === '초진' ? 'consult-first' : 'consult-return'}`}>{consultLabel}</span>
                    )}
                    {buhang.map((t, idx) => (
                      <span key={`b-${idx}`} className="irh-badge buhang">{shortenName(t.name)}</span>
                    ))}
                    {chuna.map((t, idx) => (
                      <span key={`c-${idx}`} className="irh-badge chuna">{shortenName(t.name)}</span>
                    ))}
                    {uncovered.map((t, idx) => (
                      <span key={`u-${idx}`} className="irh-badge uncovered">
                        {t.name.length > 8 ? t.name.slice(0, 8) : t.name}
                      </span>
                    ))}
                  </div>
                  {/* 셋째줄: 비급여 메모 요약 */}
                  {memoSummary && (
                    <div className="irh-item-memo" title={memoSummary}>
                      <i className="fa-solid fa-note-sticky"></i>
                      {memoSummary}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 페이징 */}
      {data && data.pagination.total_pages > 1 && (
        <div className="irh-footer">
          <button
            className="irh-page-btn"
            disabled={page <= 1}
            onClick={() => setPage(p => p - 1)}
          >
            <i className="fa-solid fa-chevron-left"></i>
          </button>
          <span className="irh-page-info">{page}/{data.pagination.total_pages}</span>
          <button
            className="irh-page-btn"
            disabled={!data.pagination.has_more}
            onClick={() => setPage(p => p + 1)}
          >
            <i className="fa-solid fa-chevron-right"></i>
          </button>
        </div>
      )}

      {/* 상세 수납내역 모달 */}
      {detailReceipt && (
        <div className="receipt-detail-modal-overlay" onClick={() => setDetailReceipt(null)}>
          <div
            className="receipt-detail-modal"
            ref={modalRef}
            style={{ transform: `translate(${modalPos.x}px, ${modalPos.y}px)` }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="detail-modal-header" onMouseDown={handleDragStart}>
              <h4>
                <i className="fa-solid fa-file-invoice"></i>
                {patientName && <span>{patientName}</span>}
                {chartNo && <span style={{ color: '#6b7280', fontWeight: 400 }}>({chartNo.replace(/^0+/, '')})</span>}
                {detailReceipt.receipt_date ? formatDateShort(detailReceipt.receipt_date) : ''} 진료상세
                {(() => {
                  const doctors = [...new Set((detailReceipt.treatments || []).map(t => t.doctor).filter(Boolean))];
                  return doctors.length > 0 ? (
                    <span style={{ color: '#6b7280', fontWeight: 400, fontSize: '12px' }}>({doctors.join(', ')})</span>
                  ) : null;
                })()}
              </h4>
              <button className="close-btn" onClick={() => setDetailReceipt(null)}>
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <div className="detail-modal-body">
              {/* 메모 */}
              {(() => {
                const memoText = detailReceipt.receiptMemo?.memo || detailReceipt.memo;
                return memoText && memoText.trim() && memoText !== '/' && memoText !== 'x' && memoText !== 'X' ? (
                  <div className="irh-modal-memo">
                    <i className="fa-solid fa-note-sticky"></i>
                    {memoText}
                  </div>
                ) : null;
              })()}

              {/* 급여 항목 */}
              <div className="detail-section">
                <h5 className="section-title insurance">
                  <i className="fa-solid fa-shield-halved"></i> 급여 항목
                </h5>
                {(() => {
                  const coveredItems = detailReceipt.treatments?.filter(t => t.is_covered) || [];
                  return coveredItems.length > 0 ? (
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
                        <span className="amount">{formatMoney(detailReceipt.insurance_self)}원</span>
                      </div>
                    </>
                  ) : (
                    <div className="detail-empty">급여 항목 없음</div>
                  );
                })()}
              </div>

              {/* 비급여 항목 */}
              <div className="detail-section">
                <h5 className="section-title general">
                  <i className="fa-solid fa-receipt"></i> 비급여 항목
                </h5>
                {(() => {
                  const uncoveredItems = detailReceipt.treatments?.filter(t => !t.is_covered) || [];
                  return uncoveredItems.length > 0 ? (
                    <>
                      <div className="detail-items-list">
                        {uncoveredItems.map((item, idx) => (
                          <div key={idx} className="detail-item-row">
                            <span className="item-name">
                              {item.name}
                              {(item.amount === undefined || item.amount === null || item.amount === 0) && (
                                <span className="no-input-tag">미입력</span>
                              )}
                            </span>
                            <span className="item-amount">{(item.amount || 0).toLocaleString()}원</span>
                          </div>
                        ))}
                      </div>
                      <div className="detail-subtotal general">
                        <span>비급여 합계</span>
                        <span className="amount">{formatMoney(detailReceipt.general_amount)}원</span>
                      </div>
                    </>
                  ) : (
                    <div className="detail-empty">비급여 항목 없음</div>
                  );
                })()}
              </div>

              {/* 총 수납액 */}
              <div className="detail-grand-total">
                <span>총 수납액</span>
                <span className="amount">{formatMoney(detailReceipt.total_amount)}원</span>
              </div>

              {/* 이 날짜로 이동 버튼 */}
              {onNavigateToDate && detailReceipt.receipt_date && (
                <div className="irh-modal-nav">
                  <button
                    className="irh-modal-nav-btn"
                    onClick={() => {
                      onNavigateToDate(detailReceipt.receipt_date!);
                      setDetailReceipt(null);
                    }}
                  >
                    <i className="fa-solid fa-arrow-right"></i> 이 날짜로 이동
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InlineReceiptHistory;
