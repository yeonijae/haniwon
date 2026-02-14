import { useState, useEffect, useCallback } from 'react';
import { getPackageAlerts } from '../lib/api';
import type { PackageAlertItem } from '../lib/api';

type PackageFilter = 'all' | 'treatment' | 'membership' | 'low-remaining' | 'expire-soon';

const FILTER_CONFIG: Record<PackageFilter, { label: string; icon: string; color: string }> = {
  'all': { label: '전체', icon: 'fa-th-large', color: '#64748b' },
  'treatment': { label: '통마', icon: 'fa-syringe', color: '#3b82f6' },
  'membership': { label: '멤버십', icon: 'fa-id-card', color: '#8b5cf6' },
  'low-remaining': { label: '잔여알림', icon: 'fa-battery-quarter', color: '#eab308' },
  'expire-soon': { label: '만료알림', icon: 'fa-clock', color: '#ef4444' },
};

const PACKAGE_TYPE_LABEL: Record<string, string> = {
  treatment: '통마/약침',
  membership: '멤버십',
};

function PackageManagementView() {
  const [alerts, setAlerts] = useState<PackageAlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<PackageFilter>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getPackageAlerts();
      setAlerts(data.alerts);
    } catch (error) {
      console.error('패키지 알림 조회 오류:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 한약/녹용 제외 + 날짜 필터
  const baseAlerts = alerts.filter(a => {
    if (a.packageType === 'herbal' || a.packageType === 'nokryong') return false;
    if (dateFrom) {
      const d = (a.createdAt || '').slice(0, 10);
      if (d < dateFrom) return false;
    }
    if (dateTo) {
      const d = (a.createdAt || '').slice(0, 10);
      if (d > dateTo) return false;
    }
    return true;
  });

  const filteredAlerts = baseAlerts.filter(a => {
    if (filter === 'all') return true;
    if (filter === 'treatment') return a.packageType === 'treatment';
    if (filter === 'membership') return a.packageType === 'membership';
    if (filter === 'low-remaining') return a.alertType === 'low-remaining';
    if (filter === 'expire-soon') return a.alertType === 'expire-soon' || a.alertType === 'membership-expire';
    return true;
  });

  const getAlertColor = (alertType: string): string => {
    switch (alertType) {
      case 'expire-soon': case 'membership-expire': return '#ef4444';
      case 'unused-1month': return '#f97316';
      case 'low-remaining': return '#eab308';
      default: return '#64748b';
    }
  };

  const getAlertLabel = (alertType: string): string => {
    switch (alertType) {
      case 'expire-soon': return '만료임박';
      case 'membership-expire': return '멤버십만료';
      case 'unused-1month': return '미사용';
      case 'low-remaining': return '잔여부족';
      default: return alertType;
    }
  };

  const typeCounts = {
    treatment: filteredAlerts.filter(a => a.packageType === 'treatment').length,
    membership: filteredAlerts.filter(a => a.packageType === 'membership').length,
  };

  return (
    <div className="package-mgmt-view">
      {/* 헤더 */}
      <div className="noncovered-header">
        <div className="noncovered-header-left">
          <h2>📦 패키지</h2>
          <span className="noncovered-count">총 {filteredAlerts.length}건</span>
          <div className="header-badges">
            {(Object.entries(FILTER_CONFIG) as [PackageFilter, typeof FILTER_CONFIG[PackageFilter]][]).map(([key, cfg]) => {
              const cnt = key === 'all' ? baseAlerts.length
                : key === 'treatment' ? typeCounts.treatment
                : key === 'membership' ? typeCounts.membership
                : key === 'low-remaining' ? baseAlerts.filter(a => a.alertType === 'low-remaining').length
                : baseAlerts.filter(a => a.alertType === 'expire-soon' || a.alertType === 'membership-expire').length;
              return (
                <span
                  key={key}
                  className={`header-badge clickable ${filter === key ? 'active' : ''}`}
                  style={{ '--badge-color': cfg.color } as React.CSSProperties}
                  onClick={() => setFilter(key)}
                >
                  {cfg.label}{key !== 'all' ? ` ${cnt}` : ''}
                </span>
              );
            })}
          </div>
        </div>
        <div className="noncovered-header-right">
          <div className="date-range-filter">
            <input type="date" className="date-input" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            <span className="date-separator">~</span>
            <input type="date" className="date-input" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            {(dateFrom || dateTo) && (
              <button className="date-clear-btn" onClick={() => { setDateFrom(''); setDateTo(''); }}>✕</button>
            )}
          </div>
          <button className="noncovered-refresh-btn" onClick={loadData} disabled={loading}>
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
        ) : filteredAlerts.length === 0 ? (
          <div className="timeline-empty">
            <i className="fas fa-box-open"></i>
            <p>해당 조건의 패키지가 없습니다</p>
          </div>
        ) : (
          <div className="herbal-card-grid">
            {filteredAlerts.map((alert, idx) => (
              <div key={`${alert.alertType}-${alert.id}-${idx}`} className="hc-card">
                <div
                  className="hc-card-accent"
                  style={{ backgroundColor: getAlertColor(alert.alertType) }}
                />
                <div className="hc-card-body">
                  <div className="hc-card-top">
                    <div className="hc-card-patient">
                      <span className="hc-patient-name">{alert.patientName}</span>
                      <span className="hc-patient-chart">{alert.chartNumber}</span>
                    </div>
                    <span className="herbal-status-badge" style={{ backgroundColor: getAlertColor(alert.alertType) }}>
                      {getAlertLabel(alert.alertType)}
                    </span>
                  </div>
                  <div className="hc-card-branch">
                    {PACKAGE_TYPE_LABEL[alert.packageType] || alert.packageType}
                  </div>
                  <div className="hc-card-tags">
                    <span className="hc-tag">{alert.packageName}</span>
                    {alert.remainingCount !== undefined && (
                      <span className="hc-tag">잔여: {alert.remainingCount}회</span>
                    )}
                    {alert.expireDate && (
                      <span className="hc-tag">만료: {alert.expireDate}</span>
                    )}
                  </div>
                  {alert.detail && (
                    <div className="hc-card-memo">{alert.detail}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        .package-mgmt-view {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .package-mgmt-view .date-range-filter {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .package-mgmt-view .date-input {
          padding: 4px 6px;
          border: 1px solid var(--border-color, #e2e8f0);
          border-radius: 6px;
          font-size: 12px;
          background: var(--bg-primary, #fff);
          color: var(--text-primary, #1e293b);
        }

        .package-mgmt-view .date-separator {
          font-size: 12px;
          color: var(--text-muted, #94a3b8);
        }

        .package-mgmt-view .date-clear-btn {
          background: none;
          border: none;
          cursor: pointer;
          font-size: 12px;
          color: var(--text-muted, #94a3b8);
          padding: 2px 4px;
        }

        .package-mgmt-view .date-clear-btn:hover {
          color: #ef4444;
        }

        .package-mgmt-view .herbal-grid-container {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .header-badges {
          display: flex;
          gap: 4px;
          flex-wrap: wrap;
          align-items: center;
        }

        .header-badge {
          font-size: 11px;
          padding: 2px 8px;
          border-radius: 10px;
          background: color-mix(in srgb, var(--badge-color) 15%, transparent);
          color: var(--badge-color);
          font-weight: 600;
          white-space: nowrap;
        }

        .header-badge.clickable {
          cursor: pointer;
          transition: all 0.15s;
        }

        .header-badge.clickable:hover {
          background: color-mix(in srgb, var(--badge-color) 25%, transparent);
        }

        .header-badge.clickable.active {
          background: var(--badge-color);
          color: #fff;
        }

        .package-mgmt-view .herbal-card-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 12px;
        }

        .package-mgmt-view .hc-card {
          background: var(--bg-primary, #fff);
          border: 1px solid var(--border-color, #e2e8f0);
          border-radius: 10px;
          overflow: hidden;
          transition: all 0.15s;
          display: flex;
          flex-direction: column;
        }

        .package-mgmt-view .hc-card:hover {
          border-color: var(--accent-color, #3b82f6);
          box-shadow: 0 2px 8px rgba(0,0,0,0.07);
          transform: translateY(-1px);
        }

        .package-mgmt-view .hc-card-accent {
          height: 4px;
          width: 100%;
          flex-shrink: 0;
        }

        .package-mgmt-view .hc-card-body {
          padding: 14px 16px 12px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          flex: 1;
        }

        .package-mgmt-view .hc-card-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }

        .package-mgmt-view .hc-card-patient {
          display: flex;
          flex-direction: column;
        }

        .package-mgmt-view .hc-patient-name {
          font-weight: 700;
          font-size: 15px;
          line-height: 1.2;
        }

        .package-mgmt-view .hc-patient-chart {
          font-size: 12px;
          color: var(--text-muted, #94a3b8);
        }

        .package-mgmt-view .herbal-status-badge {
          font-size: 11px;
          padding: 2px 8px;
          border-radius: 10px;
          color: #fff;
          font-weight: 600;
          white-space: nowrap;
          flex-shrink: 0;
        }

        .package-mgmt-view .hc-card-branch {
          font-size: 13px;
          font-weight: 700;
          color: var(--text-primary, #1e293b);
        }

        .package-mgmt-view .hc-card-tags {
          display: flex;
          gap: 4px;
          flex-wrap: wrap;
        }

        .package-mgmt-view .hc-tag {
          font-size: 11px;
          padding: 2px 8px;
          background: var(--bg-secondary, #f1f5f9);
          border-radius: 4px;
          color: var(--text-secondary, #64748b);
          white-space: nowrap;
        }

        .package-mgmt-view .hc-card-memo {
          font-size: 12px;
          color: var(--text-muted, #94a3b8);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
      `}</style>
    </div>
  );
}

export default PackageManagementView;
