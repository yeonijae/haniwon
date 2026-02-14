import { useState, useEffect, useCallback } from 'react';
import { getPackageAlerts } from '../lib/api';
import type { PackageAlertItem } from '../lib/api';

const PACKAGE_TYPE_LABEL: Record<string, string> = {
  treatment: '통마/약침',
  membership: '멤버십',
};

interface PackageManagementViewProps {
  searchTerm: string;
  dateFrom: string;
  dateTo: string;
  packageFilter: string;
  refreshKey: number;
}

function PackageManagementView({ searchTerm, dateFrom, dateTo, packageFilter, refreshKey }: PackageManagementViewProps) {
  const [alerts, setAlerts] = useState<PackageAlertItem[]>([]);
  const [loading, setLoading] = useState(true);

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
  }, [refreshKey]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 한약/녹용 제외 + 날짜 필터 + 검색
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
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      if (!a.patientName?.toLowerCase().includes(s) && !a.chartNumber?.toLowerCase().includes(s)) return false;
    }
    return true;
  });

  const filteredAlerts = baseAlerts.filter(a => {
    if (packageFilter === 'all') return true;
    if (packageFilter === 'treatment') return a.packageType === 'treatment';
    if (packageFilter === 'membership') return a.packageType === 'membership';
    if (packageFilter === 'low-remaining') return a.alertType === 'low-remaining';
    if (packageFilter === 'expire-soon') return a.alertType === 'expire-soon' || a.alertType === 'membership-expire';
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

  return (
    <div className="package-mgmt-view">
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

        .package-mgmt-view .herbal-grid-container {
          display: flex;
          flex-direction: column;
          gap: 20px;
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
