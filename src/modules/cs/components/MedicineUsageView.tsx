import { useState, useEffect, useCallback } from 'react';
import { query, getCurrentDate } from '@shared/lib/postgres';
import { MEDICINE_CATEGORIES } from '../lib/api';
import type { MedicineCategory } from '../lib/api';

interface MedicineUsageRow {
  id: number;
  patient_id: number;
  chart_number: string;
  patient_name: string;
  inventory_id: number | null;
  medicine_name: string;
  quantity: number;
  usage_date: string;
  purpose: string | null;
  created_at: string;
  category: string | null;
}

interface GroupedUsages {
  date: string;
  items: MedicineUsageRow[];
}

type FilterCategory = MedicineCategory | 'all';

function MedicineUsageView() {
  const [usages, setUsages] = useState<MedicineUsageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<FilterCategory>('all');

  const loadUsages = useCallback(async () => {
    setLoading(true);
    try {
      let sql = `
        SELECT u.*, i.category
        FROM cs_medicine_usage u
        LEFT JOIN cs_medicine_inventory i ON u.inventory_id = i.id
        WHERE 1=1
      `;
      if (searchTerm) {
        sql += ` AND (u.patient_name LIKE '%${searchTerm}%' OR u.medicine_name LIKE '%${searchTerm}%')`;
      }
      if (filterCategory !== 'all') {
        sql += ` AND i.category = '${filterCategory}'`;
      }
      sql += ` ORDER BY u.usage_date DESC, u.created_at DESC LIMIT 200`;

      const data = await query<MedicineUsageRow>(sql);
      setUsages(data);
    } catch (error) {
      console.error('상비약 사용 조회 오류:', error);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, filterCategory]);

  useEffect(() => {
    loadUsages();
  }, [loadUsages]);

  const extractDate = (dateStr?: string): string => {
    if (!dateStr) return '알수없음';
    const m = dateStr.match(/(\d{4}-\d{2}-\d{2})/);
    if (m) return m[1];
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    return '알수없음';
  };

  const groupedUsages: GroupedUsages[] = usages.reduce((acc: GroupedUsages[], item) => {
    const dateKey = extractDate(item.usage_date);
    const existing = acc.find(g => g.date === dateKey);
    if (existing) {
      existing.items.push(item);
    } else {
      acc.push({ date: dateKey, items: [item] });
    }
    return acc;
  }, []);

  const formatDate = (dateStr: string) => {
    if (dateStr === '알수없음') return dateStr;
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

  const getCategoryColor = (cat?: string | null): string => {
    switch (cat) {
      case '상비약': return '#10b981';
      case '공진단': return '#8b5cf6';
      case '증정품': return '#f59e0b';
      case '치료약': return '#3b82f6';
      case '감기약': return '#ef4444';
      default: return '#64748b';
    }
  };

  return (
    <div className="medicine-usage-view">
      {/* 헤더 */}
      <div className="noncovered-header">
        <div className="noncovered-header-left">
          <h2>💊 상비약</h2>
          <span className="noncovered-count">총 {usages.length}건</span>
          <div className="header-badges">
            {MEDICINE_CATEGORIES.map(cat => {
              const cnt = usages.filter(u => u.category === cat).length;
              return cnt > 0 ? (
                <span key={cat} className="header-badge" style={{ '--badge-color': getCategoryColor(cat) } as React.CSSProperties}>{cat} {cnt}</span>
              ) : null;
            })}
          </div>
        </div>
        <div className="noncovered-header-right">
          <input
            type="text"
            className="noncovered-search"
            placeholder="환자명/약품명 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <select
            className="noncovered-filter"
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value as FilterCategory)}
          >
            <option value="all">전체 카테고리</option>
            {MEDICINE_CATEGORIES.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <button className="noncovered-refresh-btn" onClick={loadUsages} disabled={loading}>
            <i className={`fas fa-sync-alt ${loading ? 'fa-spin' : ''}`}></i>
          </button>
        </div>
      </div>

      {/* 그리드 */}
      <div className="herbal-grid-container">
        {loading ? (
          <div className="timeline-loading">
            <i className="fas fa-spinner fa-spin"></i> 로딩 중...
          </div>
        ) : groupedUsages.length === 0 ? (
          <div className="timeline-empty">
            <i className="fas fa-pills"></i>
            <p>상비약 사용 기록이 없습니다</p>
          </div>
        ) : (
          groupedUsages.map((group) => (
            <div key={group.date} className="hc-date-section">
              <div className="hc-date-divider">
                <span className="hc-date-label">{formatDate(group.date)}</span>
                <span className="hc-date-full">{group.date}</span>
                <span className="hc-date-count">{group.items.length}건</span>
                <div className="hc-date-line" />
              </div>
              <div className="herbal-card-grid">
                {group.items.map((item) => (
                  <div key={item.id} className="hc-card">
                    <div
                      className="hc-card-accent"
                      style={{ backgroundColor: getCategoryColor(item.category) }}
                    />
                    <div className="hc-card-body">
                      <div className="hc-card-top">
                        <div className="hc-card-patient">
                          <span className="hc-patient-name">{item.patient_name}</span>
                          <span className="hc-patient-chart">{item.chart_number}</span>
                        </div>
                        {item.category && (
                          <span className="herbal-status-badge" style={{ backgroundColor: getCategoryColor(item.category) }}>
                            {item.category}
                          </span>
                        )}
                      </div>
                      <div className="hc-card-branch" style={{ color: getCategoryColor(item.category) }}>
                        {item.medicine_name}
                      </div>
                      <div className="hc-card-tags">
                        <span className="hc-tag">수량: {item.quantity}</span>
                        {item.purpose && <span className="hc-tag">{item.purpose}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      <style>{`
        .medicine-usage-view .header-badges {
          display: flex;
          gap: 4px;
          flex-wrap: wrap;
          align-items: center;
        }

        .medicine-usage-view .header-badge {
          font-size: 11px;
          padding: 2px 8px;
          border-radius: 10px;
          background: color-mix(in srgb, var(--badge-color) 15%, transparent);
          color: var(--badge-color);
          font-weight: 600;
          white-space: nowrap;
        }

        .medicine-usage-view {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .medicine-usage-view .herbal-grid-container {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .medicine-usage-view .herbal-summary-cards {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .medicine-usage-view .herbal-summary-card {
          background: var(--bg-secondary, #f8f9fa);
          border: 1px solid var(--border-color, #e2e8f0);
          border-radius: 8px;
          padding: 10px 16px;
          text-align: center;
          min-width: 70px;
        }

        .medicine-usage-view .herbal-summary-value {
          font-size: 20px;
          font-weight: 700;
        }

        .medicine-usage-view .herbal-summary-label {
          font-size: 11px;
          color: var(--text-muted, #94a3b8);
          margin-top: 2px;
        }

        .medicine-usage-view .hc-date-section {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .medicine-usage-view .hc-date-divider {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .medicine-usage-view .hc-date-label {
          font-size: 14px;
          font-weight: 700;
          color: var(--text-primary, #1e293b);
          white-space: nowrap;
        }

        .medicine-usage-view .hc-date-full {
          font-size: 12px;
          color: var(--text-muted, #94a3b8);
          white-space: nowrap;
        }

        .medicine-usage-view .hc-date-count {
          font-size: 12px;
          color: var(--text-muted, #94a3b8);
          white-space: nowrap;
        }

        .medicine-usage-view .hc-date-line {
          flex: 1;
          height: 1px;
          background: var(--border-color, #e2e8f0);
        }

        .medicine-usage-view .herbal-card-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 12px;
        }

        .medicine-usage-view .hc-card {
          background: var(--bg-primary, #fff);
          border: 1px solid var(--border-color, #e2e8f0);
          border-radius: 10px;
          overflow: hidden;
          transition: all 0.15s;
          display: flex;
          flex-direction: column;
        }

        .medicine-usage-view .hc-card:hover {
          border-color: var(--accent-color, #3b82f6);
          box-shadow: 0 2px 8px rgba(0,0,0,0.07);
          transform: translateY(-1px);
        }

        .medicine-usage-view .hc-card-accent {
          height: 4px;
          width: 100%;
          flex-shrink: 0;
        }

        .medicine-usage-view .hc-card-body {
          padding: 14px 16px 12px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          flex: 1;
        }

        .medicine-usage-view .hc-card-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }

        .medicine-usage-view .hc-card-patient {
          display: flex;
          flex-direction: column;
        }

        .medicine-usage-view .hc-patient-name {
          font-weight: 700;
          font-size: 15px;
          line-height: 1.2;
        }

        .medicine-usage-view .hc-patient-chart {
          font-size: 12px;
          color: var(--text-muted, #94a3b8);
        }

        .medicine-usage-view .herbal-status-badge {
          font-size: 11px;
          padding: 2px 8px;
          border-radius: 10px;
          color: #fff;
          font-weight: 600;
          white-space: nowrap;
          flex-shrink: 0;
        }

        .medicine-usage-view .hc-card-branch {
          font-size: 13px;
          font-weight: 700;
        }

        .medicine-usage-view .hc-card-tags {
          display: flex;
          gap: 4px;
          flex-wrap: wrap;
        }

        .medicine-usage-view .hc-tag {
          font-size: 11px;
          padding: 2px 8px;
          background: var(--bg-secondary, #f1f5f9);
          border-radius: 4px;
          color: var(--text-secondary, #64748b);
          white-space: nowrap;
        }
      `}</style>
    </div>
  );
}

export default MedicineUsageView;
