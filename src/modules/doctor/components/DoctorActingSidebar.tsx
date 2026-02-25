/**
 * DoctorActingSidebar - 액팅 대기열 (컨텐츠 왼쪽)
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchDoctorQueue } from '@modules/acting/api';
import { useSSE } from '@shared/hooks/useSSE';
import type { ActingQueueItem } from '@modules/acting/types';

interface Props {
  doctorId: number;
  onPatientClick?: (patientId: string, chartNumber: string) => void;
}

export default function DoctorActingSidebar({ doctorId, onPatientClick }: Props) {
  const navigate = useNavigate();
  const [queue, setQueue] = useState<ActingQueueItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await fetchDoctorQueue(doctorId);
      setQueue(data);
    } catch (e) {
      console.error('액팅 대기열 로드 오류:', e);
    } finally {
      setLoading(false);
    }
  }, [doctorId]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 3000);
    return () => clearInterval(interval);
  }, [load]);

  useSSE({
    enabled: true,
    onMessage: (msg) => {
      if (msg.table === 'daily_acting_records' || msg.table === 'doctor_status') load();
    },
  });

  const waiting = queue.filter(i => i.status === 'waiting');
  const acting = queue.find(i => i.status === 'acting');

  const handleClick = (item: ActingQueueItem) => {
    if (onPatientClick) {
      onPatientClick(String(item.patientId), item.chartNo);
    } else {
      navigate(`/doctor/patients?chart=${item.chartNo}`);
    }
  };

  return (
    <aside className="doctor-sidebar doctor-sidebar-left">
      <div className="doctor-sidebar-section">
        <div className="doctor-sidebar-section-header">
          <span className="doctor-sidebar-section-title">📋 액팅 대기열</span>
          <span className="doctor-sidebar-section-count">
            {waiting.length + (acting ? 1 : 0)}
          </span>
        </div>
        <ul className="doctor-sidebar-list">
          {loading && <li className="doctor-sidebar-empty">로딩 중...</li>}
          {!loading && acting && (
            <li className="doctor-sidebar-card" onClick={() => handleClick(acting)}>
              <div className="doctor-sidebar-card-row">
                <span className="doctor-sidebar-card-name">{acting.patientName}</span>
                <span className="doctor-sidebar-card-chart">{acting.chartNo}</span>
                <span className="doctor-sidebar-card-badge acting">진행중</span>
              </div>
              <div className="doctor-sidebar-card-sub">
                <span>{acting.actingType}</span>
              </div>
            </li>
          )}
          {!loading && waiting.length === 0 && !acting && (
            <li className="doctor-sidebar-empty">대기 환자 없음</li>
          )}
          {!loading && waiting.map((item, idx) => (
            <li key={item.id} className="doctor-sidebar-card" onClick={() => handleClick(item)}>
              <div className="doctor-sidebar-card-row">
                <span className="doctor-sidebar-card-name">{item.patientName}</span>
                <span className="doctor-sidebar-card-chart">{item.chartNo}</span>
                <span className="doctor-sidebar-card-badge waiting">{idx + 1}번</span>
              </div>
              <div className="doctor-sidebar-card-sub">
                <span>{item.actingType}</span>
                {item.memo && <span>· {item.memo}</span>}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
