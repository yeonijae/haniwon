/**
 * 환자 선결제/패키지 현황 + 한약 기록 섹션 (대시보드용)
 */
import React from 'react';
import type { PackageStatusSummary } from '../../types/crm';
import type { HerbalDraft, DecoctionOrder, JourneyStatus, MedicineUsage } from '../../types';
import { DRAFT_DELIVERY_LABELS, DRAFT_STATUS_LABELS, DECOCTION_ORDER_STATUS_LABELS, DECOCTION_ORDER_STATUS_COLORS, JOURNEY_STEPS } from '../../types';
import { updateHerbalDraftJourney } from '../../lib/api';

/* 한약 여정 바 */
function HerbalJourneyBar({ journey, draftId, onUpdate }: { journey: JourneyStatus; draftId: number; onUpdate?: () => void }) {
  const getStepStatus = (key: string): 'done' | 'active' | 'pending' | string => {
    switch (key) {
      case 'prescription': return journey.prescription ? 'done' : 'pending';
      case 'compounding': return journey.compounding ? 'done' : 'pending';
      case 'decoction': return journey.decoction ? 'done' : 'pending';
      case 'shipping':
        if (journey.shipping === 'delivered') return 'done';
        if (journey.shipping === 'shipping') return 'active';
        return 'pending';
      case 'medication': {
        if (!journey.medication_start) return 'pending';
        if (journey.medication_paused) return 'paused';
        const start = new Date(journey.medication_start + 'T00:00:00');
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const elapsed = Math.floor((today.getTime() - start.getTime()) / 86400000);
        const remaining = (journey.medication_days || 0) - elapsed;
        if (remaining <= 0) return 'done';
        return 'active';
      }
      default: return 'pending';
    }
  };

  const getMedicationLabel = (): string => {
    if (!journey.medication_start) return '복약';
    if (journey.medication_paused) return '정지';
    const start = new Date(journey.medication_start + 'T00:00:00');
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const elapsed = Math.floor((today.getTime() - start.getTime()) / 86400000);
    const remaining = (journey.medication_days || 0) - elapsed;
    if (remaining <= 0) return '완료';
    return `D-${remaining}`;
  };

  const getShippingLabel = (): string => {
    if (journey.shipping === 'delivered') return '완료';
    if (journey.shipping === 'shipping') return '배송중';
    return '배송';
  };

  const handleClick = async (key: string) => {
    const updated = { ...journey };
    switch (key) {
      case 'prescription': updated.prescription = !updated.prescription; break;
      case 'compounding': updated.compounding = !updated.compounding; break;
      case 'decoction': updated.decoction = !updated.decoction; break;
      case 'shipping':
        if (!updated.shipping) updated.shipping = 'shipping';
        else if (updated.shipping === 'shipping') updated.shipping = 'delivered';
        else updated.shipping = undefined;
        break;
      case 'medication':
        if (!updated.medication_start) {
          const today = new Date();
          updated.medication_start = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
          updated.medication_days = updated.medication_days || 10;
        } else if (updated.medication_paused) {
          // 정지 해제: 시작일을 정지한 만큼 뒤로 이동
          const pausedAt = new Date(updated.medication_paused_at + 'T00:00:00');
          const today = new Date(); today.setHours(0,0,0,0);
          const pausedDays = Math.floor((today.getTime() - pausedAt.getTime()) / 86400000);
          const start = new Date(updated.medication_start + 'T00:00:00');
          start.setDate(start.getDate() + pausedDays);
          updated.medication_start = `${start.getFullYear()}-${String(start.getMonth()+1).padStart(2,'0')}-${String(start.getDate()).padStart(2,'0')}`;
          updated.medication_paused = undefined;
          updated.medication_paused_at = undefined;
        } else {
          // 정지
          const today = new Date();
          updated.medication_paused = true;
          updated.medication_paused_at = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
        }
        break;
    }
    try {
      await updateHerbalDraftJourney(draftId, updated);
      if (onUpdate) onUpdate();
    } catch (e) { console.error('여정 업데이트 실패', e); }
  };

  return (
    <div className="herbal-journey-bar">
      {JOURNEY_STEPS.map((step, i) => {
        const status = getStepStatus(step.key);
        const label = step.key === 'medication' ? getMedicationLabel()
                    : step.key === 'shipping' ? getShippingLabel()
                    : step.label;
        return (
          <React.Fragment key={step.key}>
            {i > 0 && <span className="herbal-journey-connector" />}
            <button
              className={`herbal-journey-step ${status}`}
              onClick={() => handleClick(step.key)}
              title={`${step.label} 클릭하여 상태 변경`}
            >
              {label}
            </button>
          </React.Fragment>
        );
      })}
    </div>
  );
}

interface PatientPackageSectionProps {
  packages: PackageStatusSummary | null;
  herbalDrafts: HerbalDraft[];
  decoctionOrders?: DecoctionOrder[];
  medicineUsages?: MedicineUsage[];
  isLoading: boolean;
  onEditDraft?: (draft: HerbalDraft) => void;
  onDeleteDraft?: (draft: HerbalDraft) => void;
  onEditMedicine?: (usage: MedicineUsage) => void;
  onDeleteMedicine?: (usage: MedicineUsage) => void;
}

// 분기 타입 → 표시 라벨
const BRANCH_LABELS: Record<string, string> = {
  '약초진': '약초진',
  '약재진_N차': '약재진(N차)',
  '약재진_재결제': '약재진(재결제)',
  '기타상담': '기타상담',
};

// 날짜 포맷
function formatDate(dateStr?: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return `${String(d.getFullYear()).slice(2)}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}

// medicine_items JSON → 표시 텍스트
function parseMedicineItems(json?: string): string {
  if (!json) return '';
  try {
    const items = JSON.parse(json) as Array<{ name: string; qty: number }>;
    return items.map(i => `${i.name}${i.qty > 1 ? ` x${i.qty}` : ''}`).join(', ');
  } catch {
    return '';
  }
}

const PatientPackageSection: React.FC<PatientPackageSectionProps> = ({
  packages,
  herbalDrafts,
  decoctionOrders = [],
  medicineUsages = [],
  isLoading,
  onEditDraft,
  onDeleteDraft,
  onEditMedicine,
  onDeleteMedicine,
}) => {
  if (isLoading) {
    return <div className="section-loading">로딩 중...</div>;
  }

  // 모든 항목을 통합 리스트로 만들기
  type UnifiedItem = { type: 'pkg'; kind: string; date: string; node: React.ReactNode }
    | { type: 'draft'; date: string; draft: HerbalDraft }
    | { type: 'decoction'; date: string; order: DecoctionOrder }
    | { type: 'medicine'; date: string; usage: MedicineUsage };

  const allItems: UnifiedItem[] = [];

  // 패키지 → 통합 리스트에 추가
  if (packages?.tongma) {
    allItems.push({
      type: 'pkg', kind: 'tongma', date: packages.tongma.startDate || '9999',
      node: (
        <div className="herbal-draft-history-row">
          <span className="pkg-badge tongma">통마</span>
          <span className="herbal-draft-history-date">{formatDate(packages.tongma.startDate)}</span>
          <span className="pkg-info">통마{packages.tongma.totalCount}회 결제</span>
        </div>
      ),
    });
  }
  if (packages?.membership) {
    allItems.push({
      type: 'pkg', kind: 'membership', date: packages.membership.startDate || '9999',
      node: (
        <div className="herbal-draft-history-row">
          <span className="pkg-badge membership">멤버</span>
          <span className="herbal-draft-history-date">{formatDate(packages.membership.startDate)}</span>
          <span className="pkg-info">{packages.membership.membershipType} ~{formatDate(packages.membership.expireDate)}</span>
        </div>
      ),
    });
  }
  if (packages?.herbal) {
    allItems.push({
      type: 'pkg', kind: 'herbal', date: '9999',
      node: (
        <div className="herbal-draft-history-row">
          <span className="pkg-badge herbal">선결</span>
          <span className="pkg-info">{packages.herbal.herbalName || '한약'} {packages.herbal.remainingCount}/{packages.herbal.totalCount}회</span>
        </div>
      ),
    });
  }
  if (packages?.nokryong) {
    allItems.push({
      type: 'pkg', kind: 'nokryong', date: '9999',
      node: (
        <div className="herbal-draft-history-row">
          <span className="pkg-badge nokryong">녹용</span>
          <span className="pkg-info">{packages.nokryong.packageName || '녹용'} {packages.nokryong.remainingMonths}/{packages.nokryong.totalMonths}개월</span>
        </div>
      ),
    });
  }

  // 한약 기록
  herbalDrafts.forEach(draft => {
    allItems.push({ type: 'draft', date: draft.receipt_date || draft.created_at || '', draft });
  });

  // 상비약
  medicineUsages.forEach(usage => {
    allItems.push({ type: 'medicine', date: usage.usage_date || '', usage });
  });

  // 탕전
  decoctionOrders.forEach(order => {
    allItems.push({ type: 'decoction', date: order.scheduled_date || '', order });
  });

  // 날짜 내림차순 정렬
  allItems.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  if (allItems.length === 0) {
    return <div className="section-empty">패키지/한약 기록이 없습니다.</div>;
  }

  return (
    <div className="dashboard-section-content">
      <div className="herbal-draft-history">
        <div className="herbal-draft-history-list">
          {allItems.map((item, idx) => {
            if (item.type === 'pkg') {
              return (
                <div key={`pkg-${item.kind}`} className="herbal-draft-history-item">
                  {item.node}
                </div>
              );
            }

            if (item.type === 'draft') {
              const draft = item.draft;
              const branchLabel = BRANCH_LABELS[draft.consultation_type || ''] || draft.consultation_type || '';
              const statusLabel = DRAFT_STATUS_LABELS[draft.status] || draft.status;
              const deliveryLabel = draft.delivery_method
                ? DRAFT_DELIVERY_LABELS[draft.delivery_method as keyof typeof DRAFT_DELIVERY_LABELS] || draft.delivery_method
                : '';

              return (
                <div key={`draft-${draft.id}`} className="herbal-draft-history-item">
                  <div className="herbal-draft-history-row">
                    <span className={`herbal-draft-category-badge ${draft.herbal_name === '자보약' ? 'jaboyak' : 'herbal'}`}>
                      {draft.herbal_name === '자보약' ? '자보' : '탕약'}
                    </span>
                    <span className="herbal-draft-history-date">
                      {formatDate(draft.receipt_date || draft.created_at)}
                    </span>
                    {branchLabel && <span className="herbal-draft-history-branch">{branchLabel}</span>}
                    {draft.sub_type && (
                      <span className="herbal-draft-history-subtype">{draft.sub_type}</span>
                    )}
                    {!draft.decoction_date && (
                      <span className={`herbal-draft-history-status ${draft.status}`}>
                        {statusLabel}
                      </span>
                    )}
                    {draft.decoction_date && (
                      <span className="herbal-draft-history-decoction">{(() => {
                        const [datePart, timePart] = draft.decoction_date.split(' ');
                        const [, m, d] = datePart.split('-');
                        const dt = new Date(datePart + 'T00:00:00');
                        const dn = ['일','월','화','수','목','금','토'][dt.getDay()];
                        return `${Number(m)}/${Number(d)}(${dn})${timePart ? ' ' + timePart : ''}`;
                      })()}</span>
                    )}
                    {deliveryLabel && (
                      <span className="herbal-draft-history-delivery">{deliveryLabel}</span>
                    )}
                    {(onEditDraft || onDeleteDraft) && (
                      <div className="herbal-draft-item-actions">
                        {onEditDraft && (
                          <button className="herbal-draft-action-btn" onClick={() => onEditDraft(draft)} title="수정">
                            <i className="fa-solid fa-pen" />
                          </button>
                        )}
                        {onDeleteDraft && (
                          <button className="herbal-draft-action-btn delete" onClick={() => onDeleteDraft(draft)} title="삭제">
                            <i className="fa-solid fa-trash" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  {/* 한약 여정 파이프라인 */}
                  <HerbalJourneyBar journey={draft.journey_status || {}} draftId={draft.id!} onUpdate={onEditDraft ? () => onEditDraft(draft) : undefined} />
                </div>
              );
            }

            if (item.type === 'medicine') {
              const usage = (item as any).usage as MedicineUsage;
              return (
                <div key={`med-${usage.id}`} className="herbal-draft-history-item">
                  <div className="herbal-draft-history-row">
                    <span className="herbal-draft-category-badge medicine">상비</span>
                    <span className="herbal-draft-history-date">{formatDate(usage.usage_date)}</span>
                    <span className="herbal-draft-history-branch">{usage.medicine_name}</span>
                    <span style={{ fontSize: 13, color: '#64748b' }}>×{usage.quantity}</span>
                    {usage.purpose && <span style={{ fontSize: 11, color: '#9ca3af' }}>{usage.purpose}</span>}
                    {(onEditMedicine || onDeleteMedicine) && (
                      <div className="herbal-draft-item-actions">
                        {onEditMedicine && (
                          <button className="herbal-draft-action-btn" onClick={() => onEditMedicine(usage)} title="수정">
                            <i className="fa-solid fa-pen" />
                          </button>
                        )}
                        {onDeleteMedicine && (
                          <button className="herbal-draft-action-btn delete" onClick={() => onDeleteMedicine(usage)} title="삭제 (재고 반환)">
                            <i className="fa-solid fa-trash" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            }

            // decoction
            const order = (item as any).order as DecoctionOrder;
            return (
              <div key={`dec-${order.id}`} className="herbal-draft-history-item">
                <div className="herbal-draft-history-row">
                  <span className="herbal-draft-category-badge" style={{ background: DECOCTION_ORDER_STATUS_COLORS[order.status] + '22', color: DECOCTION_ORDER_STATUS_COLORS[order.status] }}>탕전</span>
                  <span className="herbal-draft-history-date">{formatDate(order.scheduled_date)}</span>
                  <span style={{ fontSize: 11, color: '#64748b' }}>{order.scheduled_slot}</span>
                  {order.recipe_name && <span className="herbal-draft-history-branch">{order.recipe_name}</span>}
                  <span className="herbal-draft-history-status" style={{ background: DECOCTION_ORDER_STATUS_COLORS[order.status] + '22', color: DECOCTION_ORDER_STATUS_COLORS[order.status] }}>
                    {DECOCTION_ORDER_STATUS_LABELS[order.status]}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <style>{DRAFT_HISTORY_STYLES}</style>
    </div>
  );
};

export default PatientPackageSection;

const DRAFT_HISTORY_STYLES = `
  .herbal-draft-history-title {
    font-size: 12px;
    font-weight: 700;
    color: #6b7280;
    margin-bottom: 6px;
    letter-spacing: 0.3px;
  }
  .herbal-draft-history-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .herbal-draft-history-item {
    position: relative;
    padding: 8px 10px;
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    font-size: 14px;
    text-align: left;
  }
  .herbal-draft-item-actions {
    display: flex;
    gap: 2px;
    margin-left: auto;
    opacity: 0;
    transition: opacity 0.15s;
  }
  .herbal-draft-history-item:hover .herbal-draft-item-actions {
    opacity: 1;
  }
  .herbal-draft-action-btn {
    width: 22px;
    height: 22px;
    border: none;
    background: transparent;
    color: #9ca3af;
    cursor: pointer;
    border-radius: 4px;
    font-size: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .herbal-draft-action-btn:hover {
    background: #e5e7eb;
    color: #374151;
  }
  .herbal-draft-action-btn.delete:hover {
    background: #fef2f2;
    color: #dc2626;
  }
  .herbal-draft-history-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .herbal-draft-history-branch {
    font-weight: 700;
    color: #1d4ed8;
    font-size: 14px;
  }
  .herbal-draft-history-subtype {
    padding: 1px 6px;
    background: #ecfdf5;
    border: 1px solid #86efac;
    border-radius: 10px;
    font-size: 13px;
    color: #166534;
    font-weight: 600;
  }
  .herbal-draft-history-status {
    padding: 1px 6px;
    border-radius: 10px;
    font-size: 13px;
    font-weight: 600;
  }
  .herbal-draft-history-status.draft {
    background: #f3f4f6;
    color: #6b7280;
  }
  .herbal-draft-history-status.scheduled {
    background: #dbeafe;
    color: #1e40af;
  }
  .herbal-draft-history-date {
    color: #6b7280;
    font-size: 13px;
    font-weight: 500;
  }
  .herbal-draft-category-badge {
    padding: 1px 6px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 700;
    flex-shrink: 0;
  }
  .herbal-draft-category-badge.herbal {
    background: #d1fae5;
    color: #059669;
  }
  .herbal-draft-category-badge.otc {
    background: #fef3c7;
    color: #92400e;
  }
  .herbal-draft-category-badge.jaboyak {
    background: #fef3c7;
    color: #d97706;
  }
  .herbal-draft-category-badge.medicine {
    background: #e0e7ff;
    color: #4f46e5;
  }
  .herbal-draft-category-badge.package {
    background: #ede9fe;
    color: #6d28d9;
  }
  .herbal-draft-history-details {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 4px;
    color: #6b7280;
    font-size: 11px;
  }
  .herbal-draft-history-details:empty {
    display: none;
  }
  .herbal-draft-history-medicines {
    color: #059669;
    font-weight: 600;
  }
  .herbal-draft-history-decoction {
    color: #0369a1;
  }
  .herbal-draft-history-delivery {
    color: #7c3aed;
  }
  .herbal-draft-history-memo {
    color: #6b7280;
    font-style: italic;
  }

  /* 한약 여정 바 */
  .herbal-journey-bar {
    display: flex;
    align-items: center;
    gap: 0;
    padding: 4px 0 2px 28px;
  }
  .herbal-journey-connector {
    width: 12px;
    height: 1px;
    background: #d1d5db;
    flex-shrink: 0;
  }
  .herbal-journey-step {
    font-size: 11px;
    padding: 2px 8px;
    border-radius: 10px;
    border: 1px solid #e5e7eb;
    background: #f9fafb;
    color: #9ca3af;
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.15s;
    line-height: 1.3;
  }
  .herbal-journey-step:hover { border-color: #93c5fd; }
  .herbal-journey-step.done {
    background: #dcfce7;
    color: #16a34a;
    border-color: #86efac;
  }
  .herbal-journey-step.active {
    background: #dbeafe;
    color: #2563eb;
    border-color: #93c5fd;
    font-weight: 600;
  }
  .herbal-journey-step.paused {
    background: #fef3c7;
    color: #d97706;
    border-color: #fbbf24;
  }
`;
