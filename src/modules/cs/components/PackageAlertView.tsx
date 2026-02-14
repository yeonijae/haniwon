/**
 * 패키지 관리 알림 뷰
 * 프리셋 필터 기반으로 관리가 필요한 패키지를 리스트업
 */
import { useState, useEffect, useCallback } from 'react';
import { getPackageAlerts } from '../lib/api';
import type { PackageAlertType, PackageAlertItem } from '../lib/api';
import type { LocalPatient } from '../lib/patientSync';
import { getLocalPatientByChartNo } from '../lib/patientSync';
import type { PortalUser } from '@shared/types';
import PatientDashboard from './PatientDashboard';

// 알림 유형별 설정
const ALERT_TYPE_CONFIG: Record<PackageAlertType, { label: string; icon: string; color: string }> = {
  'expire-soon': { label: '만료임박', icon: 'fa-clock', color: '#ef4444' },
  'unused-1month': { label: '미사용 1개월', icon: 'fa-calendar-xmark', color: '#f97316' },
  'herbal-3month': { label: '한약 3개월', icon: 'fa-leaf', color: '#3b82f6' },
  'membership-expire': { label: '멤버십 만료', icon: 'fa-id-card', color: '#8b5cf6' },
  'low-remaining': { label: '잔여 부족', icon: 'fa-battery-quarter', color: '#eab308' },
};

// 패키지 유형별 라벨
const PACKAGE_TYPE_LABEL: Record<string, string> = {
  treatment: '통마/약침',
  herbal: '한약',
  nokryong: '녹용',
  membership: '멤버십',
};

interface PackageAlertViewProps {
  user: PortalUser;
}

export default function PackageAlertView({ user }: PackageAlertViewProps) {
  const [alerts, setAlerts] = useState<PackageAlertItem[]>([]);
  const [counts, setCounts] = useState<Record<PackageAlertType, number>>({
    'expire-soon': 0,
    'unused-1month': 0,
    'herbal-3month': 0,
    'membership-expire': 0,
    'low-remaining': 0,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [filterType, setFilterType] = useState<PackageAlertType | 'all'>('all');

  // 환자 대시보드 모달
  const [dashboardPatient, setDashboardPatient] = useState<LocalPatient | null>(null);
  const [showDashboard, setShowDashboard] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getPackageAlerts();
      setAlerts(data.alerts);
      setCounts(data.counts);
    } catch (err) {
      console.error('패키지 알림 조회 오류:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 필터된 목록
  const filteredAlerts = filterType === 'all'
    ? alerts
    : alerts.filter(a => a.alertType === filterType);

  // 환자명 클릭 → 대시보드
  const handlePatientClick = async (chartNumber: string) => {
    try {
      const localPatient = await getLocalPatientByChartNo(chartNumber);
      if (localPatient) {
        setDashboardPatient(localPatient);
        setShowDashboard(true);
      } else {
        alert('환자 정보를 찾을 수 없습니다.');
      }
    } catch (err) {
      console.error('환자 조회 오류:', err);
    }
  };

  return (
    <div className="package-alert">
      {/* 필터 칩 */}
      <div className="package-alert-stats">
        <button
          className={`daily-stat-chip ${filterType === 'all' ? 'active' : ''}`}
          onClick={() => setFilterType('all')}
        >
          전체 <span className="stat-count">{alerts.length}</span>
        </button>
        {(Object.entries(ALERT_TYPE_CONFIG) as [PackageAlertType, typeof ALERT_TYPE_CONFIG[PackageAlertType]][]).map(([type, config]) => {
          const count = counts[type] || 0;
          return (
            <button
              key={type}
              className={`daily-stat-chip ${filterType === type ? 'active' : ''}`}
              style={{ '--chip-color': config.color } as React.CSSProperties}
              onClick={() => setFilterType(filterType === type ? 'all' : type)}
            >
              <i className={`fa-solid ${config.icon}`}></i>
              {config.label} <span className="stat-count">{count}</span>
            </button>
          );
        })}
        <button className="daily-uncovered-refresh" onClick={loadData} disabled={isLoading} style={{ marginLeft: 'auto' }}>
          <i className={`fa-solid fa-rotate-right ${isLoading ? 'fa-spin' : ''}`}></i>
        </button>
      </div>

      {/* 테이블 */}
      <div className="package-alert-table-wrap">
        {isLoading ? (
          <div className="daily-uncovered-loading">
            <i className="fa-solid fa-spinner fa-spin"></i> 로딩 중...
          </div>
        ) : filteredAlerts.length === 0 ? (
          <div className="daily-uncovered-empty">
            <i className="fa-solid fa-box-open"></i>
            <p>해당 조건의 패키지가 없습니다.</p>
          </div>
        ) : (
          <table className="daily-uncovered-table">
            <thead>
              <tr>
                <th className="col-patient">환자</th>
                <th className="col-type">패키지 유형</th>
                <th className="col-item">패키지명</th>
                <th className="col-detail">상세</th>
                <th className="col-alert-type">알림 유형</th>
              </tr>
            </thead>
            <tbody>
              {filteredAlerts.map((alert, idx) => {
                const alertConfig = ALERT_TYPE_CONFIG[alert.alertType];
                return (
                  <tr key={`${alert.alertType}-${alert.packageType}-${alert.id}-${idx}`}>
                    <td className="col-patient">
                      <span
                        className="patient-name clickable"
                        onClick={() => handlePatientClick(alert.chartNumber)}
                      >
                        {alert.patientName}
                      </span>
                      <span className="chart-number">{alert.chartNumber}</span>
                    </td>
                    <td className="col-type">
                      {PACKAGE_TYPE_LABEL[alert.packageType] || alert.packageType}
                    </td>
                    <td className="col-item">{alert.packageName}</td>
                    <td className="col-detail">{alert.detail}</td>
                    <td className="col-alert-type">
                      <span
                        className="type-badge"
                        style={{ backgroundColor: alertConfig.color }}
                      >
                        <i className={`fa-solid ${alertConfig.icon}`}></i> {alertConfig.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* 환자 대시보드 모달 */}
      {dashboardPatient && (
        <PatientDashboard
          isOpen={showDashboard}
          patient={dashboardPatient}
          user={user}
          onClose={() => {
            setShowDashboard(false);
            setDashboardPatient(null);
          }}
        />
      )}
    </div>
  );
}
