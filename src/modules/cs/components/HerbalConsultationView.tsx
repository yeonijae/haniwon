import React, { useState, useEffect, useCallback } from 'react';
import type { PortalUser } from '@shared/types';
import { query, getCurrentDate } from '@shared/lib/postgres';
import type { HerbalDraft, DraftBranchType, DraftStatus, DraftDeliveryMethod, JourneyStatus } from '../types';
import { DRAFT_BRANCH_TYPES, DRAFT_STATUS_LABELS, DRAFT_DELIVERY_LABELS, JOURNEY_STEPS } from '../types';
import { updateHerbalDraftJourney } from '../lib/api';

interface HerbalConsultationViewProps {
  user: PortalUser;
  searchTerm: string;
  dateFrom: string;
  dateTo: string;
  filterBranch: string;
  filterStatus: string;
  sortField: string;
  refreshKey: number;
}

interface GroupedDrafts {
  date: string;
  drafts: HerbalDraft[];
}

function HerbalConsultationView({ user, searchTerm, dateFrom, dateTo, filterBranch, filterStatus, sortField, refreshKey }: HerbalConsultationViewProps) {
  const [drafts, setDrafts] = useState<HerbalDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const loadDrafts = useCallback(async () => {
    setLoading(true);
    try {
      let sql = `SELECT * FROM cs_herbal_drafts WHERE 1=1`;

      if (searchTerm) {
        sql += ` AND (patient_name LIKE '%${searchTerm}%' OR chart_number LIKE '%${searchTerm}%')`;
      }
      if (filterBranch !== 'all') {
        sql += ` AND consultation_type = '${filterBranch}'`;
      }
      if (filterStatus !== 'all') {
        sql += ` AND status = '${filterStatus}'`;
      }
      if (dateFrom) {
        sql += ` AND receipt_date >= '${dateFrom}'`;
      }
      if (dateTo) {
        sql += ` AND receipt_date <= '${dateTo}'`;
      }

      const orderField = sortField === 'created_at' ? 'receipt_date' : sortField;
      sql += ` ORDER BY ${orderField} DESC NULLS LAST LIMIT 200`;

      const data = await query<HerbalDraft>(sql);
      setDrafts(data);
    } catch (error) {
      console.error('약상담 기록 조회 오류:', error);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, filterBranch, filterStatus, sortField, dateFrom, dateTo, refreshKey]);

  useEffect(() => {
    loadDrafts();
  }, [loadDrafts]);

  const extractDate = (dateStr?: string): string => {
    if (!dateStr) return '알수없음';
    const isoMatch = dateStr.match(/(\d{4}-\d{2}-\d{2})/);
    if (isoMatch) return isoMatch[1];
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    return '알수없음';
  };

  const parseJourney = (j: any): JourneyStatus => {
    if (!j) return {};
    if (typeof j === 'string') try { return JSON.parse(j); } catch { return {}; }
    return j;
  };

  const handleJourneyToggle = async (draftId: number, stepKey: keyof JourneyStatus, currentJourney: JourneyStatus) => {
    const newJourney = { ...currentJourney, [stepKey]: !currentJourney[stepKey] };
    setDrafts(prev => prev.map(d => d.id === draftId ? { ...d, journey_status: newJourney } : d));
    try {
      await updateHerbalDraftJourney(draftId, newJourney);
    } catch (err) {
      console.error('여정 업데이트 오류:', err);
      setDrafts(prev => prev.map(d => d.id === draftId ? { ...d, journey_status: currentJourney } : d));
    }
  };

  const groupedDrafts: GroupedDrafts[] = drafts.reduce((acc: GroupedDrafts[], draft) => {
    const dateKey = sortField === 'decoction_date'
      ? (draft.decoction_date ? extractDate(draft.decoction_date) : '미정')
      : (draft.receipt_date || extractDate(draft.created_at));
    const existing = acc.find(g => g.date === dateKey);
    if (existing) {
      existing.drafts.push(draft);
    } else {
      acc.push({ date: dateKey, drafts: [draft] });
    }
    return acc;
  }, []);

  const formatDate = (dateStr: string) => {
    if (dateStr === '미정' || dateStr === '알수없음') return dateStr;
    const today = getCurrentDate();
    if (dateStr === today) return '오늘';
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
    if (dateStr === yStr) return '어제';
    const parts = dateStr.split('-');
    const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
    return `${date.getMonth() + 1}/${date.getDate()} (${weekdays[date.getDay()]})`;
  };

  const getBranchColor = (branch?: string): string => {
    switch (branch) {
      case '약초진': return '#10b981';
      case '약재진_N차': return '#3b82f6';
      case '약재진_재결제': return '#f59e0b';
      case '기타상담': return '#8b5cf6';
      default: return '#64748b';
    }
  };

  const getBranchLabel = (branch?: string): string => {
    const found = DRAFT_BRANCH_TYPES.find(b => b.value === branch);
    return found?.label || branch || '-';
  };

  const getStatusBadge = (status: DraftStatus) => {
    const label = DRAFT_STATUS_LABELS[status] || status;
    const color = status === 'scheduled' ? '#10b981' : '#f59e0b';
    return <span className="herbal-status-badge" style={{ backgroundColor: color }}>{label}</span>;
  };

  const parseMedicines = (items?: string): { name: string; quantity: number }[] => {
    if (!items) return [];
    try { return JSON.parse(items); } catch { return []; }
  };

  return (
    <div className="herbal-consultation-view">
      {/* 그리드 */}
      <div className="herbal-grid-container">
        {loading ? (
          <div className="timeline-loading">
            <i className="fas fa-spinner fa-spin"></i> 로딩 중...
          </div>
        ) : groupedDrafts.length === 0 ? (
          <div className="timeline-empty">
            <i className="fas fa-mortar-pestle"></i>
            <p>약상담 기록이 없습니다</p>
          </div>
        ) : (
          groupedDrafts.map((group) => (
            <div key={group.date} className="hc-date-section">
              <div className="hc-date-divider">
                <span className="hc-date-label">{formatDate(group.date)}</span>
                <span className="hc-date-full">{group.date}</span>
                <span className="hc-date-count">{group.drafts.length}건</span>
                <div className="hc-date-line" />
              </div>
              <div className="herbal-card-grid">
                {group.drafts.map((draft) => {
                  const medicines = parseMedicines(draft.medicine_items);
                  const isExpanded = expandedId === draft.id;

                  return (
                    <div
                      key={draft.id}
                      className={`hc-card ${isExpanded ? 'expanded' : ''}`}
                      onClick={() => setExpandedId(isExpanded ? null : (draft.id ?? null))}
                    >
                      <div
                        className="hc-card-accent"
                        style={{ backgroundColor: getBranchColor(draft.consultation_type) }}
                      />
                      <div className="hc-card-body">
                        <div className="hc-card-top">
                          <div className="hc-card-patient">
                            <span className="hc-patient-name">{draft.patient_name}</span>
                            <span className="hc-patient-chart">{draft.chart_number}</span>
                          </div>
                          {getStatusBadge(draft.status)}
                        </div>
                        <div className="hc-card-branch" style={{ color: getBranchColor(draft.consultation_type) }}>
                          {getBranchLabel(draft.consultation_type)}
                        </div>
                        <div className="hc-card-tags">
                          {draft.payment_type && <span className="hc-tag">{draft.payment_type}</span>}
                          {draft.nokryong_grade && (
                            <span className="hc-tag">🦌 {draft.nokryong_grade}{draft.nokryong_count && draft.nokryong_count > 1 ? ` ×${draft.nokryong_count}` : ''}</span>
                          )}
                          {draft.delivery_method && (
                            <span className="hc-tag">{DRAFT_DELIVERY_LABELS[draft.delivery_method as DraftDeliveryMethod] || draft.delivery_method}</span>
                          )}
                          {draft.sub_type && <span className="hc-tag">{draft.sub_type}</span>}
                        </div>
                        {draft.decoction_date && (
                          <div className="hc-card-decoction">
                            <i className="fas fa-fire"></i> 탕전: {draft.decoction_date}
                          </div>
                        )}
                        {draft.memo && <div className="hc-card-memo">{draft.memo}</div>}
                        {/* 한약 여정 파이프라인 */}
                        <div className="hc-journey" onClick={e => e.stopPropagation()}>
                          {JOURNEY_STEPS.map((step, idx) => {
                            const journey = parseJourney(draft.journey_status);
                            const done = !!journey[step.key];
                            const isLast = idx === JOURNEY_STEPS.length - 1;
                            return (
                              <React.Fragment key={step.key}>
                                <button
                                  className={`hc-journey-step ${done ? 'done' : ''}`}
                                  onClick={() => handleJourneyToggle(draft.id!, step.key, journey)}
                                  title={`${step.label} ${done ? '(완료)' : '(미완료)'} - 클릭하여 토글`}
                                >
                                  <span className="hc-journey-dot">{done ? '●' : '○'}</span>
                                  <span className="hc-journey-label">{step.label}</span>
                                </button>
                                {!isLast && <span className={`hc-journey-line ${done ? 'done' : ''}`} />}
                              </React.Fragment>
                            );
                          })}
                        </div>
                        <div className="hc-card-footer">
                          {draft.doctor && (
                            <span className="hc-card-doctor"><i className="fas fa-user-md"></i> {draft.doctor}</span>
                          )}
                          {draft.created_by && (
                            <span className="hc-card-author"><i className="fas fa-user"></i> {draft.created_by}</span>
                          )}
                        </div>
                        {isExpanded && (
                          <div className="hc-card-detail" onClick={e => e.stopPropagation()}>
                            {draft.treatment_months && (
                              <div className="hc-detail-row"><span className="hc-detail-label">치료기간</span><span>{draft.treatment_months}</span></div>
                            )}
                            {draft.visit_pattern && (
                              <div className="hc-detail-row"><span className="hc-detail-label">내원패턴</span><span>{draft.visit_pattern}</span></div>
                            )}
                            {draft.nokryong_type && (
                              <div className="hc-detail-row"><span className="hc-detail-label">녹용권유</span><span>{draft.nokryong_type}</span></div>
                            )}
                            {draft.consultation_method && (
                              <div className="hc-detail-row"><span className="hc-detail-label">상담방법</span><span>{draft.consultation_method}</span></div>
                            )}
                            {medicines.length > 0 && (
                              <div className="hc-detail-medicines">
                                <span className="hc-detail-label">약재</span>
                                <div className="herbal-medicine-chips">
                                  {medicines.map((m, i) => (
                                    <span key={i} className="herbal-medicine-chip">{m.name} ×{m.quantity}</span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      <style>{`
        .herbal-consultation-view {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .herbal-grid-container {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .hc-date-section {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .hc-date-divider {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .hc-date-label {
          font-size: 14px;
          font-weight: 700;
          color: var(--text-primary, #1e293b);
          white-space: nowrap;
        }

        .hc-date-full {
          font-size: 12px;
          color: var(--text-muted, #94a3b8);
          white-space: nowrap;
        }

        .hc-date-count {
          font-size: 12px;
          color: var(--text-muted, #94a3b8);
          white-space: nowrap;
        }

        .hc-date-line {
          flex: 1;
          height: 1px;
          background: var(--border-color, #e2e8f0);
        }

        .herbal-card-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 12px;
        }

        .hc-card {
          background: var(--bg-primary, #fff);
          border: 1px solid var(--border-color, #e2e8f0);
          border-radius: 10px;
          overflow: hidden;
          cursor: pointer;
          transition: all 0.15s;
          display: flex;
          flex-direction: column;
        }

        .hc-card:hover {
          border-color: var(--accent-color, #3b82f6);
          box-shadow: 0 2px 8px rgba(0,0,0,0.07);
          transform: translateY(-1px);
        }

        .hc-card.expanded {
          border-color: var(--accent-color, #3b82f6);
          box-shadow: 0 2px 12px rgba(59,130,246,0.12);
        }

        .hc-card-accent {
          height: 4px;
          width: 100%;
          flex-shrink: 0;
        }

        .hc-card-body {
          padding: 14px 16px 12px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          flex: 1;
        }

        .hc-card-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }

        .hc-card-patient {
          display: flex;
          flex-direction: column;
        }

        .hc-patient-name {
          font-weight: 700;
          font-size: 15px;
          line-height: 1.2;
        }

        .hc-patient-chart {
          font-size: 12px;
          color: var(--text-muted, #94a3b8);
        }

        .herbal-status-badge {
          font-size: 11px;
          padding: 2px 8px;
          border-radius: 10px;
          color: #fff;
          font-weight: 600;
          white-space: nowrap;
          flex-shrink: 0;
        }

        .hc-card-branch {
          font-size: 13px;
          font-weight: 700;
        }

        .hc-card-tags {
          display: flex;
          gap: 4px;
          flex-wrap: wrap;
        }

        .hc-tag {
          font-size: 11px;
          padding: 2px 8px;
          background: var(--bg-secondary, #f1f5f9);
          border-radius: 4px;
          color: var(--text-secondary, #64748b);
          white-space: nowrap;
        }

        .hc-card-decoction {
          font-size: 12px;
          color: var(--text-secondary, #64748b);
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .hc-card-decoction i {
          color: #ef4444;
          font-size: 11px;
        }

        .hc-card-memo {
          font-size: 12px;
          color: var(--text-muted, #94a3b8);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        /* 여정 파이프라인 */
        .hc-journey {
          display: flex;
          align-items: center;
          gap: 0;
          padding: 8px 0 4px;
          border-top: 1px solid var(--border-color, #f1f5f9);
          margin-top: 6px;
        }

        .hc-journey-step {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
          background: none;
          border: none;
          cursor: pointer;
          padding: 2px 4px;
          transition: all 0.15s;
        }

        .hc-journey-step:hover {
          transform: scale(1.1);
        }

        .hc-journey-dot {
          font-size: 14px;
          color: var(--text-muted, #cbd5e1);
          line-height: 1;
        }

        .hc-journey-step.done .hc-journey-dot {
          color: #10b981;
        }

        .hc-journey-label {
          font-size: 9px;
          color: var(--text-muted, #94a3b8);
          white-space: nowrap;
        }

        .hc-journey-step.done .hc-journey-label {
          color: #10b981;
          font-weight: 600;
        }

        .hc-journey-line {
          flex: 1;
          height: 2px;
          min-width: 8px;
          background: var(--border-color, #e2e8f0);
          margin-bottom: 14px;
        }

        .hc-journey-line.done {
          background: #10b981;
        }

        .hc-card-doctor {
          font-size: 11px;
          color: #3b82f6;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .hc-card-doctor i {
          font-size: 10px;
        }

        .hc-card-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: auto;
          padding-top: 8px;
          border-top: 1px solid var(--border-color, #f1f5f9);
        }

        .hc-card-author {
          font-size: 11px;
          color: var(--text-muted, #94a3b8);
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .hc-card-author i {
          font-size: 10px;
        }

        .hc-card-detail {
          margin-top: 8px;
          padding-top: 8px;
          border-top: 1px solid var(--border-color, #e2e8f0);
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .hc-detail-row {
          display: flex;
          justify-content: space-between;
          font-size: 12px;
        }

        .hc-detail-label {
          font-size: 11px;
          color: var(--text-muted, #94a3b8);
          font-weight: 600;
        }

        .hc-detail-medicines {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .herbal-medicine-chips {
          display: flex;
          gap: 4px;
          flex-wrap: wrap;
        }

        .herbal-medicine-chip {
          font-size: 12px;
          padding: 2px 8px;
          background: var(--bg-secondary, #f1f5f9);
          border-radius: 4px;
        }
      `}</style>
    </div>
  );
}

export default HerbalConsultationView;
