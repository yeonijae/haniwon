/**
 * 환자 선결제/패키지 현황 + 한약 기록 섹션 (대시보드용)
 */
import React from 'react';
import type { PackageStatusSummary } from '../../types/crm';
import type { HerbalDraft } from '../../types';
import { DRAFT_DELIVERY_LABELS, DRAFT_STATUS_LABELS } from '../../types';

interface PatientPackageSectionProps {
  packages: PackageStatusSummary | null;
  herbalDrafts: HerbalDraft[];
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
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
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
  isLoading,
  onEditDraft,
  onDeleteDraft,
}) => {
  if (isLoading) {
    return <div className="section-loading">로딩 중...</div>;
  }

  const hasPackage = packages && (packages.tongma || packages.herbal || packages.nokryong || packages.membership);
  const hasDrafts = herbalDrafts.length > 0;

  if (!hasPackage && !hasDrafts) {
    return <div className="section-empty">패키지/한약 기록이 없습니다.</div>;
  }

  return (
    <div className="dashboard-section-content">
      {/* 패키지 현황 */}
      {hasPackage && packages && (
        <div className="package-grid">
          {/* 통마 */}
          {packages.tongma && (
            <div className="package-card">
              <div className="package-label">통증마일리지</div>
              <div className="package-detail">
                <span className="package-count">
                  잔여 <strong>{packages.tongma.remainingCount}</strong>/{packages.tongma.totalCount}회
                </span>
                {packages.tongma.expireDate && (
                  <span className="package-expire">~{packages.tongma.expireDate}</span>
                )}
              </div>
              <div className="package-progress">
                <div
                  className="package-progress-bar"
                  style={{
                    width: `${(packages.tongma.remainingCount / packages.tongma.totalCount) * 100}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* 한약 */}
          {packages.herbal && (
            <div className="package-card">
              <div className="package-label">한약 선결 {packages.herbal.herbalName && `(${packages.herbal.herbalName})`}</div>
              <div className="package-detail">
                <span className="package-count">
                  잔여 <strong>{packages.herbal.remainingCount}</strong>/{packages.herbal.totalCount}회
                </span>
              </div>
              <div className="package-progress">
                <div
                  className="package-progress-bar herbal"
                  style={{
                    width: `${(packages.herbal.remainingCount / packages.herbal.totalCount) * 100}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* 녹용 */}
          {packages.nokryong && (
            <div className="package-card">
              <div className="package-label">녹용 선결 {packages.nokryong.packageName && `(${packages.nokryong.packageName})`}</div>
              <div className="package-detail">
                <span className="package-count">
                  잔여 <strong>{packages.nokryong.remainingMonths}</strong>/{packages.nokryong.totalMonths}개월
                </span>
              </div>
              <div className="package-progress">
                <div
                  className="package-progress-bar nokryong"
                  style={{
                    width: `${(packages.nokryong.remainingMonths / packages.nokryong.totalMonths) * 100}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* 멤버십 */}
          {packages.membership && (
            <div className="package-card">
              <div className="package-label">멤버십 ({packages.membership.membershipType})</div>
              <div className="package-detail">
                <span className="package-count">
                  잔여 <strong>{packages.membership.quantity}</strong>회
                </span>
                <span className="package-expire">~{packages.membership.expireDate}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 한약 기록 이력 */}
      {hasDrafts && (
        <>
          {hasPackage && <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: '10px 0' }} />}
          <div className="herbal-draft-history">
            <div className="herbal-draft-history-title">한약 기록</div>
            <div className="herbal-draft-history-list">
              {herbalDrafts.map(draft => {
                const medicines = parseMedicineItems(draft.medicine_items);
                const branchLabel = BRANCH_LABELS[draft.consultation_type || ''] || draft.consultation_type || '';
                const statusLabel = DRAFT_STATUS_LABELS[draft.status] || draft.status;
                const deliveryLabel = draft.delivery_method
                  ? DRAFT_DELIVERY_LABELS[draft.delivery_method as keyof typeof DRAFT_DELIVERY_LABELS] || draft.delivery_method
                  : '';

                return (
                  <div key={draft.id} className="herbal-draft-history-item">
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
                    <div className="herbal-draft-history-row">
                      <span className="herbal-draft-history-branch">{branchLabel}</span>
                      {draft.sub_type && (
                        <span className="herbal-draft-history-subtype">{draft.sub_type}</span>
                      )}
                      <span className={`herbal-draft-history-status ${draft.status}`}>
                        {statusLabel}
                      </span>
                      <span className="herbal-draft-history-date">
                        {formatDate(draft.created_at)}
                      </span>
                    </div>
                    <div className="herbal-draft-history-details">
                      {medicines && (
                        <span className="herbal-draft-history-medicines">
                          <i className="fa-solid fa-pills" style={{ marginRight: 4, fontSize: 10 }} />
                          {medicines}
                        </span>
                      )}
                      {draft.decoction_date && (
                        <span className="herbal-draft-history-decoction">
                          탕전: {formatDate(draft.decoction_date)}
                        </span>
                      )}
                      {deliveryLabel && (
                        <span className="herbal-draft-history-delivery">
                          발송: {deliveryLabel}
                        </span>
                      )}
                      {draft.memo && (
                        <span className="herbal-draft-history-memo">{draft.memo}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

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
    font-size: 12px;
  }
  .herbal-draft-item-actions {
    position: absolute;
    top: 4px;
    right: 4px;
    display: flex;
    gap: 2px;
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
    gap: 6px;
    flex-wrap: wrap;
  }
  .herbal-draft-history-branch {
    font-weight: 700;
    color: #1d4ed8;
    font-size: 12px;
  }
  .herbal-draft-history-subtype {
    padding: 1px 6px;
    background: #ecfdf5;
    border: 1px solid #86efac;
    border-radius: 10px;
    font-size: 11px;
    color: #166534;
    font-weight: 600;
  }
  .herbal-draft-history-status {
    padding: 1px 6px;
    border-radius: 10px;
    font-size: 11px;
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
    margin-left: auto;
    color: #9ca3af;
    font-size: 11px;
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
