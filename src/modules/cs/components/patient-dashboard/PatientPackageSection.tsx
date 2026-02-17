/**
 * 환자 선결제/패키지 현황 + 한약 기록 섹션 (대시보드용)
 */
import React from 'react';
import type { PackageStatusSummary } from '../../types/crm';
import type { HerbalDraft, DecoctionOrder } from '../../types';
import { DRAFT_DELIVERY_LABELS, DRAFT_STATUS_LABELS, DECOCTION_ORDER_STATUS_LABELS, DECOCTION_ORDER_STATUS_COLORS } from '../../types';

interface PatientPackageSectionProps {
  packages: PackageStatusSummary | null;
  herbalDrafts: HerbalDraft[];
  decoctionOrders?: DecoctionOrder[];
  isLoading: boolean;
  onEditDraft?: (draft: HerbalDraft) => void;
  onDeleteDraft?: (draft: HerbalDraft) => void;
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
  isLoading,
  onEditDraft,
  onDeleteDraft,
}) => {
  if (isLoading) {
    return <div className="section-loading">로딩 중...</div>;
  }

  // 모든 항목을 통합 리스트로 만들기
  type UnifiedItem = { type: 'pkg'; kind: string; date: string; node: React.ReactNode }
    | { type: 'draft'; date: string; draft: HerbalDraft }
    | { type: 'decoction'; date: string; order: DecoctionOrder };

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
                    <span className="herbal-draft-category-badge herbal">한약</span>
                    <span className="herbal-draft-history-date">
                      {formatDate(draft.receipt_date || draft.created_at)}
                    </span>
                    <span className="herbal-draft-history-branch">{branchLabel}</span>
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
    background: #dcfce7;
    color: #16a34a;
  }
  .herbal-draft-category-badge.otc {
    background: #fef3c7;
    color: #92400e;
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
`;
