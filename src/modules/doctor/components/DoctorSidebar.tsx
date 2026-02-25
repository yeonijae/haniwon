/**
 * DoctorSidebar - 원장실 좌측 사이드바
 * 액팅 대기열 + 처방&복용법 대기 표시
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchDoctorQueue } from '@modules/acting/api';
import { getPendingPrescriptionsByDoctor } from '@modules/cs/lib/decoctionApi';
import { getDosagePendingByDoctor } from '../lib/dashboardApi';
import { useSSE } from '@shared/hooks/useSSE';
import type { ActingQueueItem } from '@modules/acting/types';
import type { HerbalPackage } from '@modules/cs/types';

type PendingPackage = HerbalPackage & {
  days_until_decoction: number;
};

interface DoctorSidebarProps {
  doctorId: number;
  doctorName: string;
}

function DoctorSidebar({ doctorId, doctorName }: DoctorSidebarProps) {
  const navigate = useNavigate();
  const [actingQueue, setActingQueue] = useState<ActingQueueItem[]>([]);
  const [prescriptionPending, setPrescriptionPending] = useState<PendingPackage[]>([]);
  const [dosagePending, setDosagePending] = useState<PendingPackage[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [queueData, rxData, dosageData] = await Promise.all([
        fetchDoctorQueue(doctorId),
        getPendingPrescriptionsByDoctor(doctorId, doctorName),
        getDosagePendingByDoctor(doctorId),
      ]);
      setActingQueue(queueData);
      setPrescriptionPending(rxData as PendingPackage[]);
      setDosagePending(dosageData as PendingPackage[]);
    } catch (error) {
      console.error('사이드바 데이터 로드 오류:', error);
    } finally {
      setLoading(false);
    }
  }, [doctorId, doctorName]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30 * 1000);
    return () => clearInterval(interval);
  }, [loadData]);

  useSSE({
    enabled: true,
    onMessage: (message) => {
      if (
        message.table === 'daily_acting_records' ||
        message.table === 'doctor_status' ||
        message.table === 'herbal_packages'
      ) {
        loadData();
      }
    },
  });

  const waitingItems = actingQueue.filter(item => item.status === 'waiting');
  const actingItem = actingQueue.find(item => item.status === 'acting');
  const allPending = [...prescriptionPending, ...dosagePending];
  const hasUrgentPending = allPending.some(p => p.days_until_decoction <= 1);

  const handlePatientClick = (chartNo: string) => {
    // Navigate to patient detail by chart number
    navigate(`/doctor/patients?chart=${chartNo}`);
  };

  const getUrgencyBadgeClass = (daysUntil: number) => {
    if (daysUntil <= 0) return 'd-day';
    if (daysUntil === 1) return 'd-1';
    if (daysUntil === 2) return 'd-2';
    return '';
  };

  const getUrgencyLabel = (daysUntil: number) => {
    if (daysUntil <= 0) return 'D-Day';
    return `D-${daysUntil}`;
  };

  if (loading) {
    return (
      <aside className="doctor-sidebar">
        <div className="doctor-sidebar-section">
          <div className="doctor-sidebar-section-header">
            <span className="doctor-sidebar-section-title">📋 액팅 대기열</span>
          </div>
          <div className="doctor-sidebar-empty">로딩 중...</div>
        </div>
      </aside>
    );
  }

  return (
    <aside className="doctor-sidebar">
      {/* 액팅 대기열 */}
      <div className="doctor-sidebar-section">
        <div className="doctor-sidebar-section-header">
          <span className="doctor-sidebar-section-title">📋 액팅 대기열</span>
          <span className="doctor-sidebar-section-count">
            {waitingItems.length + (actingItem ? 1 : 0)}
          </span>
        </div>
        <ul className="doctor-sidebar-list">
          {/* 현재 진행 중 */}
          {actingItem && (
            <li
              className="doctor-sidebar-card"
              onClick={() => handlePatientClick(actingItem.chartNo)}
            >
              <div className="doctor-sidebar-card-row">
                <span className="doctor-sidebar-card-name">{actingItem.patientName}</span>
                <span className="doctor-sidebar-card-chart">{actingItem.chartNo}</span>
                <span className="doctor-sidebar-card-badge acting">진행중</span>
              </div>
              <div className="doctor-sidebar-card-sub">
                <span>{actingItem.actingType}</span>
              </div>
            </li>
          )}
          {/* 대기 목록 */}
          {waitingItems.length === 0 && !actingItem ? (
            <li className="doctor-sidebar-empty">대기 환자 없음</li>
          ) : (
            waitingItems.map((item, idx) => (
              <li
                key={item.id}
                className="doctor-sidebar-card"
                onClick={() => handlePatientClick(item.chartNo)}
              >
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
            ))
          )}
        </ul>
      </div>

      {/* 처방 & 복용법 대기 */}
      <div className="doctor-sidebar-section">
        <div className="doctor-sidebar-section-header">
          <span className="doctor-sidebar-section-title">💊 처방·복용법 대기</span>
          <span className={`doctor-sidebar-section-count ${hasUrgentPending ? 'urgent' : ''}`}>
            {allPending.length}
          </span>
        </div>
        <ul className="doctor-sidebar-list">
          {allPending.length === 0 ? (
            <li className="doctor-sidebar-empty">대기 항목 없음</li>
          ) : (
            allPending.map(pkg => {
              const badgeClass = getUrgencyBadgeClass(pkg.days_until_decoction);
              return (
                <li
                  key={`${pkg.id}-${pkg.herbal_name}`}
                  className={`doctor-sidebar-card ${pkg.days_until_decoction <= 1 ? 'urgent' : ''}`}
                  onClick={() => handlePatientClick(pkg.chart_number)}
                >
                  <div className="doctor-sidebar-card-row">
                    <span className="doctor-sidebar-card-name">{pkg.patient_name}</span>
                    <span className="doctor-sidebar-card-chart">{pkg.chart_number}</span>
                    <span className={`doctor-sidebar-card-badge ${badgeClass}`}>
                      {getUrgencyLabel(pkg.days_until_decoction)}
                    </span>
                  </div>
                  <div className="doctor-sidebar-card-sub">
                    <span>{pkg.herbal_name}</span>
                    <span>· {pkg.decoction_date}</span>
                  </div>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </aside>
  );
}

export default DoctorSidebar;
