import { useState, useEffect, useCallback } from 'react';
import type { PortalUser } from '@shared/types';
import { query, getCurrentDate } from '@shared/lib/postgres';
import type { HerbalDraft, DraftBranchType, DraftStatus, DraftDeliveryMethod } from '../types';
import { DRAFT_BRANCH_TYPES, DRAFT_STATUS_LABELS, DRAFT_DELIVERY_LABELS } from '../types';

interface HerbalConsultationViewProps {
  user: PortalUser;
}

type FilterBranch = DraftBranchType | 'all';
type FilterStatus = DraftStatus | 'all';
type SortField = 'created_at' | 'decoction_date' | 'patient_name';

interface GroupedDrafts {
  date: string;
  drafts: HerbalDraft[];
}

function HerbalConsultationView({ user }: HerbalConsultationViewProps) {
  const [drafts, setDrafts] = useState<HerbalDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterBranch, setFilterBranch] = useState<FilterBranch>('all');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [sortField, setSortField] = useState<SortField>('created_at');
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

      sql += ` ORDER BY ${sortField} DESC NULLS LAST LIMIT 200`;

      const data = await query<HerbalDraft>(sql);
      setDrafts(data);
    } catch (error) {
      console.error('약상담 기록 조회 오류:', error);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, filterBranch, filterStatus, sortField]);

  useEffect(() => {
    loadDrafts();
  }, [loadDrafts]);

  // 날짜 문자열에서 YYYY-MM-DD 추출
  const extractDate = (dateStr?: string): string => {
    if (!dateStr) return '알수없음';
    // YYYY-MM-DD 패턴이면 그대로
    const isoMatch = dateStr.match(/(\d{4}-\d{2}-\d{2})/);
    if (isoMatch) return isoMatch[1];
    // 그 외 Date로 파싱 시도
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    return '알수없음';
  };

  // 날짜별 그룹핑
  const groupedDrafts: GroupedDrafts[] = drafts.reduce((acc: GroupedDrafts[], draft) => {
    const dateKey = sortField === 'decoction_date'
      ? (draft.decoction_date ? extractDate(draft.decoction_date) : '미정')
      : extractDate(draft.created_at);
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
    // dateStr is already YYYY-MM-DD from extractDate
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
      {/* 헤더 */}
      <div className="noncovered-header">
        <div className="noncovered-header-left">
          <h2>💊 약상담</h2>
          <span className="noncovered-count">총 {drafts.length}건</span>
        </div>
        <div className="noncovered-header-right">
          <input
            type="text"
            className="noncovered-search"
            placeholder="환자명/차트번호 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <select
            className="noncovered-filter"
            value={filterBranch}
            onChange={(e) => setFilterBranch(e.target.value as FilterBranch)}
          >
            <option value="all">전체 분기</option>
            {DRAFT_BRANCH_TYPES.map(b => (
              <option key={b.value} value={b.value}>{b.label}</option>
            ))}
          </select>
          <select
            className="noncovered-filter"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
          >
            <option value="all">전체 상태</option>
            <option value="draft">초안</option>
            <option value="scheduled">탕전배정</option>
          </select>
          <select
            className="noncovered-filter"
            value={sortField}
            onChange={(e) => setSortField(e.target.value as SortField)}
          >
            <option value="created_at">작성일순</option>
            <option value="decoction_date">탕전일순</option>
            <option value="patient_name">환자명순</option>
          </select>
          <button className="noncovered-refresh-btn" onClick={loadDrafts} disabled={loading}>
            <i className={`fas fa-sync-alt ${loading ? 'fa-spin' : ''}`}></i>
          </button>
        </div>
      </div>

      {/* 요약 카드 */}
      <div className="herbal-summary-cards">
        <div className="herbal-summary-card">
          <div className="herbal-summary-value">{drafts.filter(d => d.status === 'draft').length}</div>
          <div className="herbal-summary-label">초안</div>
        </div>
        <div className="herbal-summary-card">
          <div className="herbal-summary-value">{drafts.filter(d => d.status === 'scheduled').length}</div>
          <div className="herbal-summary-label">탕전배정</div>
        </div>
        {DRAFT_BRANCH_TYPES.map(b => (
          <div key={b.value} className="herbal-summary-card">
            <div className="herbal-summary-value" style={{ color: getBranchColor(b.value) }}>
              {drafts.filter(d => d.consultation_type === b.value).length}
            </div>
            <div className="herbal-summary-label">{b.label}</div>
          </div>
        ))}
      </div>

      {/* 리스트 */}
      <div className="herbal-list-container">
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
            <div key={group.date} className="timeline-date-group">
              <div className="timeline-date-header">
                <span className="timeline-date">{formatDate(group.date)}</span>
                <span className="timeline-date-full">{group.date}</span>
                <span className="herbal-group-count">{group.drafts.length}건</span>
              </div>
              <div className="herbal-draft-list">
                {group.drafts.map((draft) => {
                  const medicines = parseMedicines(draft.medicine_items);
                  const isExpanded = expandedId === draft.id;

                  return (
                    <div
                      key={draft.id}
                      className={`herbal-draft-card ${isExpanded ? 'expanded' : ''}`}
                      onClick={() => setExpandedId(isExpanded ? null : (draft.id ?? null))}
                    >
                      <div className="herbal-draft-card-header">
                        <div className="herbal-draft-card-left">
                          <span
                            className="herbal-branch-dot"
                            style={{ backgroundColor: getBranchColor(draft.consultation_type) }}
                          />
                          <span className="herbal-draft-patient">
                            {draft.patient_name}
                            <span className="herbal-draft-chart">({draft.chart_number})</span>
                          </span>
                          <span
                            className="herbal-branch-badge"
                            style={{ color: getBranchColor(draft.consultation_type) }}
                          >
                            {getBranchLabel(draft.consultation_type)}
                          </span>
                        </div>
                        <div className="herbal-draft-card-right">
                          {draft.payment_type && (
                            <span className="herbal-draft-tag">{draft.payment_type}</span>
                          )}
                          {draft.delivery_method && (
                            <span className="herbal-draft-tag">
                              {DRAFT_DELIVERY_LABELS[draft.delivery_method as DraftDeliveryMethod] || draft.delivery_method}
                            </span>
                          )}
                          {getStatusBadge(draft.status)}
                          <i className={`fas fa-chevron-${isExpanded ? 'up' : 'down'} herbal-expand-icon`}></i>
                        </div>
                      </div>

                      {/* 기본 정보 (항상 표시) */}
                      <div className="herbal-draft-card-summary">
                        {draft.decoction_date && (
                          <span className="herbal-draft-info">
                            <i className="fas fa-fire"></i> 탕전: {draft.decoction_date}
                          </span>
                        )}
                        {draft.nokryong_grade && (
                          <span className="herbal-draft-info">
                            🦌 녹용: {draft.nokryong_grade}{draft.nokryong_count && draft.nokryong_count > 1 ? ` ×${draft.nokryong_count}` : ''}
                          </span>
                        )}
                        {draft.sub_type && (
                          <span className="herbal-draft-info">{draft.sub_type}</span>
                        )}
                        {draft.created_by && (
                          <span className="herbal-draft-info herbal-draft-author">
                            <i className="fas fa-user"></i> {draft.created_by}
                          </span>
                        )}
                      </div>

                      {/* 확장 상세 */}
                      {isExpanded && (
                        <div className="herbal-draft-card-detail" onClick={e => e.stopPropagation()}>
                          <div className="herbal-detail-grid">
                            {draft.treatment_months && (
                              <div className="herbal-detail-item">
                                <span className="herbal-detail-label">치료기간</span>
                                <span className="herbal-detail-value">{draft.treatment_months}</span>
                              </div>
                            )}
                            {draft.visit_pattern && (
                              <div className="herbal-detail-item">
                                <span className="herbal-detail-label">내원패턴</span>
                                <span className="herbal-detail-value">{draft.visit_pattern}</span>
                              </div>
                            )}
                            {draft.nokryong_type && (
                              <div className="herbal-detail-item">
                                <span className="herbal-detail-label">녹용권유</span>
                                <span className="herbal-detail-value">{draft.nokryong_type}</span>
                              </div>
                            )}
                            {draft.consultation_method && (
                              <div className="herbal-detail-item">
                                <span className="herbal-detail-label">상담방법</span>
                                <span className="herbal-detail-value">{draft.consultation_method}</span>
                              </div>
                            )}
                          </div>
                          {medicines.length > 0 && (
                            <div className="herbal-detail-medicines">
                              <span className="herbal-detail-label">약재</span>
                              <div className="herbal-medicine-chips">
                                {medicines.map((m, i) => (
                                  <span key={i} className="herbal-medicine-chip">
                                    {m.name} ×{m.quantity}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          {draft.memo && (
                            <div className="herbal-detail-memo">
                              <span className="herbal-detail-label">메모</span>
                              <p>{draft.memo}</p>
                            </div>
                          )}
                        </div>
                      )}
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

        .herbal-summary-cards {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .herbal-summary-card {
          background: var(--bg-secondary, #f8f9fa);
          border: 1px solid var(--border-color, #e2e8f0);
          border-radius: 8px;
          padding: 10px 16px;
          text-align: center;
          min-width: 70px;
        }

        .herbal-summary-value {
          font-size: 20px;
          font-weight: 700;
        }

        .herbal-summary-label {
          font-size: 11px;
          color: var(--text-muted, #94a3b8);
          margin-top: 2px;
        }

        .herbal-group-count {
          font-size: 12px;
          color: var(--text-muted, #94a3b8);
          margin-left: 8px;
        }

        .herbal-draft-list {
          display: flex;
          flex-direction: column;
          gap: 6px;
          padding-left: 20px;
        }

        .herbal-draft-card {
          background: var(--bg-primary, #fff);
          border: 1px solid var(--border-color, #e2e8f0);
          border-radius: 8px;
          padding: 10px 14px;
          cursor: pointer;
          transition: all 0.15s;
        }

        .herbal-draft-card:hover {
          border-color: var(--accent-color, #3b82f6);
          box-shadow: 0 1px 4px rgba(0,0,0,0.06);
        }

        .herbal-draft-card.expanded {
          border-color: var(--accent-color, #3b82f6);
        }

        .herbal-draft-card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
        }

        .herbal-draft-card-left {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
        }

        .herbal-branch-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .herbal-draft-patient {
          font-weight: 600;
          font-size: 14px;
          white-space: nowrap;
        }

        .herbal-draft-chart {
          font-weight: 400;
          color: var(--text-muted, #94a3b8);
          font-size: 12px;
          margin-left: 4px;
        }

        .herbal-branch-badge {
          font-size: 12px;
          font-weight: 600;
          white-space: nowrap;
        }

        .herbal-draft-card-right {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-shrink: 0;
        }

        .herbal-draft-tag {
          font-size: 11px;
          padding: 2px 6px;
          background: var(--bg-secondary, #f1f5f9);
          border-radius: 4px;
          color: var(--text-secondary, #64748b);
          white-space: nowrap;
        }

        .herbal-status-badge {
          font-size: 11px;
          padding: 2px 8px;
          border-radius: 10px;
          color: #fff;
          font-weight: 600;
          white-space: nowrap;
        }

        .herbal-expand-icon {
          font-size: 10px;
          color: var(--text-muted, #94a3b8);
        }

        .herbal-draft-card-summary {
          display: flex;
          gap: 12px;
          margin-top: 6px;
          flex-wrap: wrap;
        }

        .herbal-draft-info {
          font-size: 12px;
          color: var(--text-secondary, #64748b);
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .herbal-draft-info i {
          font-size: 11px;
        }

        .herbal-draft-author {
          margin-left: auto;
        }

        .herbal-draft-card-detail {
          margin-top: 10px;
          padding-top: 10px;
          border-top: 1px solid var(--border-color, #e2e8f0);
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .herbal-detail-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
          gap: 8px;
        }

        .herbal-detail-item {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .herbal-detail-label {
          font-size: 11px;
          color: var(--text-muted, #94a3b8);
          font-weight: 600;
        }

        .herbal-detail-value {
          font-size: 13px;
        }

        .herbal-detail-medicines {
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

        .herbal-detail-memo {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .herbal-detail-memo p {
          font-size: 13px;
          margin: 0;
          white-space: pre-wrap;
          color: var(--text-secondary, #64748b);
        }
      `}</style>
    </div>
  );
}

export default HerbalConsultationView;
