import { useState, useEffect, useCallback } from 'react';
import type { CSMenuType } from '../CSApp';

const MSSQL_API_URL = 'http://192.168.0.173:3100';

// MSSQL 대기 환자 타입
export interface MssqlWaitingPatient {
  id: number;
  patient_id: number;
  chart_no: string;
  patient_name: string;
  age: number;
  sex: 'M' | 'F';
  waiting_since: string | null;
  doctor: string;
  status: string;
  progress: string;
}

interface CSSidebarProps {
  activeMenu: CSMenuType;
  onMenuChange: (menu: CSMenuType) => void;
  userName: string;
  onClose: () => void;
  onPatientClick?: (patient: MssqlWaitingPatient) => void;
}

interface MenuItem {
  id: CSMenuType;
  icon: string;
  label: string;
}

const MENU_ITEMS: MenuItem[] = [
  { id: 'reservation', icon: '📅', label: '예약' },
  { id: 'receipt', icon: '💰', label: '수납' },
  { id: 'prepaid', icon: '💊', label: '선결' },
  { id: 'inquiry', icon: '📝', label: '문의' },
  { id: 'search', icon: '🔍', label: '검색' },
];

function CSSidebar({ activeMenu, onMenuChange, userName, onClose, onPatientClick }: CSSidebarProps) {
  const [waitingPatients, setWaitingPatients] = useState<MssqlWaitingPatient[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  // MSSQL 대기실 환자 가져오기
  const fetchWaitingPatients = useCallback(async () => {
    try {
      const response = await fetch(`${MSSQL_API_URL}/api/queue/status`);
      if (response.ok) {
        const data = await response.json();
        setWaitingPatients(data.waiting || []);
        setIsConnected(true);
      }
    } catch {
      setIsConnected(false);
    }
  }, []);

  // 3초마다 폴링
  useEffect(() => {
    fetchWaitingPatients();
    const interval = setInterval(fetchWaitingPatients, 3000);
    return () => clearInterval(interval);
  }, [fetchWaitingPatients]);

  // 대기 시간 계산 (분)
  const getWaitingMinutes = (waitingSince: string | null): number => {
    if (!waitingSince) return 0;
    const start = new Date(waitingSince);
    const now = new Date();
    return Math.floor((now.getTime() - start.getTime()) / 60000);
  };

  return (
    <aside className="cs-sidebar">
      <div className="cs-sidebar-header">
        <span className="cs-sidebar-logo">🎧</span>
        <span className="cs-sidebar-title">CS관리</span>
      </div>

      {/* 메뉴 (1열 세로) */}
      <nav className="cs-sidebar-nav-vertical">
        {MENU_ITEMS.map((item) => (
          <button
            key={item.id}
            className={`cs-sidebar-item-vertical ${activeMenu === item.id ? 'active' : ''}`}
            onClick={() => onMenuChange(item.id)}
          >
            <span className="cs-menu-icon">{item.icon}</span>
            <span className="cs-menu-label">{item.label}</span>
          </button>
        ))}
      </nav>

      {/* 대기환자 목록 */}
      <div className="cs-waiting-section">
        <div className="cs-waiting-header">
          <span className="cs-waiting-title">
            진료대기
            <span className="cs-waiting-count">{waitingPatients.length}</span>
          </span>
          <span className={`cs-waiting-status ${isConnected ? 'connected' : ''}`}>
            {isConnected ? '●' : '○'}
          </span>
        </div>
        <ul className="cs-waiting-list">
          {waitingPatients.length === 0 ? (
            <li className="cs-waiting-empty">대기 환자 없음</li>
          ) : (
            waitingPatients.map((patient) => {
              const waitMinutes = getWaitingMinutes(patient.waiting_since);
              const isLongWait = waitMinutes >= 30;
              const isVeryLongWait = waitMinutes >= 60;

              return (
                <li
                  key={patient.id}
                  className={`cs-waiting-item ${isVeryLongWait ? 'very-long' : isLongWait ? 'long' : ''}`}
                  onClick={() => onPatientClick?.(patient)}
                >
                  <div className="cs-waiting-patient">
                    <span className="cs-waiting-name">{patient.patient_name}</span>
                    <span className="cs-waiting-info">
                      {patient.sex === 'M' ? '남' : '여'}/{patient.age || '?'}
                    </span>
                    <span className={`cs-waiting-time ${isVeryLongWait ? 'very-long' : isLongWait ? 'long' : ''}`}>
                      {waitMinutes > 0 ? `${waitMinutes}분` : ''}
                    </span>
                  </div>
                  <div className="cs-waiting-meta">
                    {patient.doctor && (
                      <span className="cs-waiting-doctor">{patient.doctor}</span>
                    )}
                    {patient.status && (
                      <span className="cs-waiting-status-text">{patient.status}</span>
                    )}
                  </div>
                </li>
              );
            })
          )}
        </ul>
      </div>

      <div className="cs-sidebar-footer">
        <div className="cs-sidebar-user">
          <span className="cs-sidebar-user-icon">👤</span>
          <span className="cs-sidebar-user-name">{userName}</span>
        </div>
        <button className="cs-sidebar-close" onClick={onClose}>
          닫기
        </button>
      </div>
    </aside>
  );
}

export default CSSidebar;
