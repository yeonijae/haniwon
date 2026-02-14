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

      {/* 그리드 */}
      <div className="herbal-grid-container">
        {loading ? (
          <div className="timeline-loading">
            <i className="fas fa-spinner fa-spin"></i> 로딩 중...
          </div>
        ) : drafts.length === 0 ? (
          <div className="timeline-empty">
            <i className="fas fa-mortar-pestle"></i>
            <p>약상담 기록이 없습니다</p>
          </div>
        ) : (
          <div className="herbal-card-grid">
            {drafts.map((draft) => {
              const medicines = parseMedicines(draft.medicine_items);
              const isExpanded = expandedId === draft.id;
              const dateLabel = formatDate(extractDate(draft.created_at));

              return (
                <div
                  key={draft.id}
                  className={`hc-card ${isExpanded ? 'expanded' : ''}`}
                  onClick={() => setExpandedId(isExpanded ? null : (draft.id ?? null))}
                >
                  {/* 상단: 분기 컬러바 */}
                  <div
                    className="hc-card-accent"
                    style={{ backgroundColor: getBranchColor(draft.consultation_type) }}
                  />

                  <div className="hc-card-body">
                    {/* 환자 + 상태 */}
                    <div className="hc-card-top">
                      <div className="hc-card-patient">
                        <span className="hc-patient-name">{draft.patient_name}</span>
                        <span className="hc-patient-chart">{draft.chart_number}</span>
                      </div>
                      {getStatusBadge(draft.status)}
                    </div>

                    {/* 분기 */}
                    <div className="hc-card-branch" style={{ color: getBranchColor(draft.consultation_type) }}>
                      {getBranchLabel(draft.consultation_type)}
                    </div>

                    {/* 태그들 */}
                    <div className="hc-card-tags">
                      {draft.payment_type && (
                        <span className="hc-tag">{draft.payment_type}</span>
                      )}
                      {draft.nokryong_grade && (
                        <span className="hc-tag">🦌 {draft.nokryong_grade}{draft.nokryong_count && draft.nokryong_count > 1 ? ` ×${draft.nokryong_count}` : ''}</span>
                      )}
                      {draft.delivery_method && (
                        <span className="hc-tag">{DRAFT_DELIVERY_LABELS[draft.delivery_method as DraftDeliveryMethod] || draft.delivery_method}</span>
                      )}
                      {draft.sub_type && (
                        <span className="hc-tag">{draft.sub_type}</span>
                      )}
                    </div>

                    {/* 탕전일 */}
                    {draft.decoction_date && (
                      <div className="hc-card-decoction">
                        <i className="fas fa-fire"></i> 탕전: {draft.decoction_date}
                      </div>
                    )}

                    {/* 메모 미리보기 */}
                    {draft.memo && (
                      <div className="hc-card-memo">{draft.memo}</div>
                    )}

                    {/* 하단: 날짜 + 담당 */}
                    <div className="hc-card-footer">
                      <span className="hc-card-date">{dateLabel}</span>
                      {draft.created_by && (
                        <span className="hc-card-author"><i className="fas fa-user"></i> {draft.created_by}</span>
                      )}
                    </div>

                    {/* 확장 상세 */}
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

        /* 그리드 레이아웃 */
        .herbal-card-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 12px;
        }

        /* 카드 */
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

        .hc-card-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: auto;
          padding-top: 8px;
          border-top: 1px solid var(--border-color, #f1f5f9);
        }

        .hc-card-date {
          font-size: 11px;
          color: var(--text-muted, #94a3b8);
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

        /* 확장 상세 */
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
