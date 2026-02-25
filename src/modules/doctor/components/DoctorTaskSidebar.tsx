/**
 * DoctorTaskSidebar - 처방·복용법 대기 (컨텐츠 오른쪽)
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPendingPrescriptionsByDoctor } from '@modules/cs/lib/decoctionApi';
import { getDosagePendingByDoctor } from '../lib/dashboardApi';
import type { HerbalPackage } from '@modules/cs/types';

type PendingItem = HerbalPackage & {
  days_until_decoction: number;
  source_type?: string;
  pending_type?: 'prescription' | 'dosage';
};

interface Props {
  doctorId: number;
  doctorName: string;
  onPatientClick?: (patientId: string, chartNumber: string) => void;
}

export default function DoctorTaskSidebar({ doctorId, doctorName, onPatientClick }: Props) {
  const navigate = useNavigate();
  const [items, setItems] = useState<PendingItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [rxData, dosageData] = await Promise.all([
        getPendingPrescriptionsByDoctor(doctorId, doctorName),
        getDosagePendingByDoctor(doctorId),
      ]);
      const rx = (rxData as PendingItem[]).map(p => ({ ...p, pending_type: 'prescription' as const }));
      const dos = (dosageData as PendingItem[]).map(p => ({ ...p, pending_type: 'dosage' as const }));
      setItems([...rx, ...dos].sort((a, b) => (a.days_until_decoction ?? 999) - (b.days_until_decoction ?? 999)));
    } catch (e) {
      console.error('업무대기 로드 오류:', e);
    } finally {
      setLoading(false);
    }
  }, [doctorId, doctorName]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [load]);

  const handleClick = (item: PendingItem) => {
    if (onPatientClick) {
      onPatientClick(String(item.patient_id), item.chart_number);
    } else {
      navigate(`/doctor/patients/${item.patient_id}?chartNo=${item.chart_number}`);
    }
  };

  const getUrgencyBadge = (days: number) => {
    if (days <= 0) return { cls: 'd-day', label: 'D-Day' };
    if (days === 1) return { cls: 'd-1', label: 'D-1' };
    if (days === 2) return { cls: 'd-2', label: 'D-2' };
    return { cls: '', label: `D-${days}` };
  };

  const hasUrgent = items.some(p => p.days_until_decoction <= 1);

  return (
    <aside className="doctor-sidebar doctor-sidebar-right">
      <div className="doctor-sidebar-section">
        <div className="doctor-sidebar-section-header">
          <span className="doctor-sidebar-section-title">💊 업무 대기</span>
          <span className={`doctor-sidebar-section-count ${hasUrgent ? 'urgent' : ''}`}>
            {items.length}
          </span>
        </div>
        <ul className="doctor-sidebar-list">
          {loading && <li className="doctor-sidebar-empty">로딩 중...</li>}
          {!loading && items.length === 0 && (
            <li className="doctor-sidebar-empty">대기 항목 없음</li>
          )}
          {!loading && items.map(item => {
            const badge = getUrgencyBadge(item.days_until_decoction);
            return (
              <li
                key={`${item.pending_type}-${item.id}`}
                className={`doctor-sidebar-card ${item.days_until_decoction <= 1 ? 'urgent' : ''}`}
                onClick={() => handleClick(item)}
              >
                <div className="doctor-sidebar-card-row">
                  <span className="doctor-sidebar-card-name">{item.patient_name}</span>
                  <span className={`doctor-sidebar-card-badge ${badge.cls}`}>{badge.label}</span>
                </div>
                <div className="doctor-sidebar-card-sub">
                  <span className={`doctor-task-type ${item.pending_type}`}>
                    {item.pending_type === 'prescription' ? '처방전' : '복용법'}
                  </span>
                  {item.source_type === 'draft' && (
                    <span className="doctor-task-draft">탕약기록</span>
                  )}
                  <span>{item.herbal_name || item.chart_number}</span>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
}
