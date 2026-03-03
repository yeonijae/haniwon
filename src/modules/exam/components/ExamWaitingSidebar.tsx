import { useEffect, useState, useCallback } from 'react';
import { query } from '@shared/lib/postgres';

const MSSQL_API_URL = import.meta.env.VITE_MSSQL_API_URL || 'http://192.168.0.173:3100';

interface QueuePatient {
  id: number;
  patient_id: number;
  chart_no: string;
  patient_name: string;
  age: number;
  sex: 'M' | 'F' | null;
  waiting_since: string | null;
}

interface LocalPatientRow {
  id: number;
  mssql_id: number | null;
  chart_number: string | null;
}

interface WaitingPatient extends QueuePatient {
  localPatientId: number | null;
}

interface ExamWaitingSidebarProps {
  onSelectPatient: (patientId: number, patientName: string) => void;
  selectedPatientId: number | null;
}

const normalizeChart = (chartNo?: string | null) => (chartNo || '').replace(/^0+/, '');

function ExamWaitingSidebar({ onSelectPatient, selectedPatientId }: ExamWaitingSidebarProps) {
  const [patients, setPatients] = useState<WaitingPatient[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  const fetchWaitingPatients = useCallback(async () => {
    try {
      const res = await fetch(`${MSSQL_API_URL}/api/queue/status`);
      if (!res.ok) {
        setIsConnected(false);
        return;
      }

      const data = await res.json();
      const waiting: QueuePatient[] = Array.isArray(data?.waiting) ? data.waiting : [];
      setIsConnected(true);

      if (waiting.length === 0) {
        setPatients([]);
        return;
      }

      const mssqlIds = waiting
        .map((p) => Number(p.patient_id))
        .filter((v) => Number.isFinite(v) && v > 0);

      const chartNos = waiting
        .map((p) => normalizeChart(p.chart_no))
        .filter((v) => !!v)
        .map((v) => `'${v.replace(/'/g, "''")}'`);

      const whereParts: string[] = [];
      if (mssqlIds.length > 0) whereParts.push(`mssql_id IN (${[...new Set(mssqlIds)].join(',')})`);
      if (chartNos.length > 0) whereParts.push(`regexp_replace(COALESCE(chart_number, ''), '^0+', '') IN (${[...new Set(chartNos)].join(',')})`);

      const localRows = whereParts.length > 0
        ? await query<LocalPatientRow>(`
            SELECT id, mssql_id, chart_number
            FROM patients
            WHERE ${whereParts.join(' OR ')}
          `)
        : [];

      const byMssql = new Map<number, number>();
      const byChart = new Map<string, number>();

      localRows.forEach((row) => {
        if (row.mssql_id) byMssql.set(row.mssql_id, row.id);
        const key = normalizeChart(row.chart_number);
        if (key) byChart.set(key, row.id);
      });

      const merged: WaitingPatient[] = waiting.map((p) => ({
        ...p,
        localPatientId: byMssql.get(p.patient_id) || byChart.get(normalizeChart(p.chart_no)) || null,
      }));

      setPatients(merged);
    } catch (error) {
      console.error('검사결과 상담대기 로드 실패:', error);
      setIsConnected(false);
    }
  }, []);

  useEffect(() => {
    fetchWaitingPatients();
    const interval = setInterval(fetchWaitingPatients, 5000);
    return () => clearInterval(interval);
  }, [fetchWaitingPatients]);

  const getWaitingMinutes = (waitingSince: string | null) => {
    if (!waitingSince) return 0;
    const start = new Date(waitingSince);
    return Math.floor((Date.now() - start.getTime()) / 60000);
  };

  return (
    <aside className="exam-waiting-sidebar">
      <div className="exam-waiting-header">
        <span className="exam-waiting-title">상담대기</span>
        <span className="exam-waiting-count">{patients.length}</span>
        <span className={`exam-waiting-connection ${isConnected ? 'connected' : ''}`}>
          {isConnected ? '●' : '○'}
        </span>
      </div>

      <ul className="exam-waiting-list">
        {patients.length === 0 ? (
          <li className="exam-waiting-empty">대기 환자 없음</li>
        ) : (
          patients.map((patient) => {
            const waitMinutes = getWaitingMinutes(patient.waiting_since);
            const isLongWait = waitMinutes >= 30;
            const isVeryLongWait = waitMinutes >= 60;
            const isSelected = selectedPatientId === patient.localPatientId;
            const clickable = !!patient.localPatientId;

            return (
              <li
                key={`${patient.id}-${patient.patient_id}`}
                className={`exam-waiting-item ${isSelected ? 'selected' : ''} ${isVeryLongWait ? 'very-long' : isLongWait ? 'long' : ''} ${!clickable ? 'disabled' : ''}`}
                onClick={() => {
                  if (patient.localPatientId) {
                    onSelectPatient(patient.localPatientId, patient.patient_name);
                  }
                }}
                title={clickable ? undefined : '로컬 환자 매핑 정보가 없어 선택할 수 없습니다'}
              >
                <div className="exam-waiting-row">
                  <span className="exam-waiting-name">{patient.patient_name}</span>
                  <span className="exam-waiting-info">
                    {patient.sex === 'M' ? '남' : patient.sex === 'F' ? '여' : ''}/{patient.age || '?'}
                  </span>
                  {waitMinutes > 0 && (
                    <span className={`exam-waiting-time ${isVeryLongWait ? 'very-long' : isLongWait ? 'long' : ''}`}>
                      {waitMinutes}분
                    </span>
                  )}
                </div>
                {!clickable && <div className="exam-waiting-sub">매핑 필요</div>}
              </li>
            );
          })
        )}
      </ul>
    </aside>
  );
}

export default ExamWaitingSidebar;
