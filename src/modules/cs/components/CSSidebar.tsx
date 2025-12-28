import { useState, useEffect, useCallback } from 'react';

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
  onPatientClick?: (patient: MssqlWaitingPatient) => void;
}

function CSSidebar({ onPatientClick }: CSSidebarProps) {
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
    <aside className="cs-waiting-panel">
      {/* 대기환자 목록 */}
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
    </aside>
  );
}

export default CSSidebar;
