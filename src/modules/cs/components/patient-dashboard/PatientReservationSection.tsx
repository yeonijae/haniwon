/**
 * 환자 예약 현황 섹션 (대시보드용)
 */
import React from 'react';
import type { Reservation } from '../../../reservation/types';

interface PatientReservationSectionProps {
  reservations: Reservation[];
  isLoading: boolean;
}

const PatientReservationSection: React.FC<PatientReservationSectionProps> = ({
  reservations,
  isLoading,
}) => {
  if (isLoading) {
    return <div className="section-loading">로딩 중...</div>;
  }

  // 향후 예약 먼저, 지난 예약 뒤에 (최근 10건까지)
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = reservations.filter(r => r.date > today && !r.canceled);
  const past = reservations.filter(r => r.date <= today || r.canceled).slice(0, 10);
  const sorted = [...upcoming, ...past];

  return (
    <div className="dashboard-section-content">
      {reservations.length === 0 ? (
        <div className="section-empty">예약 이력이 없습니다.</div>
      ) : (
        <table className="dashboard-table">
            <thead>
              <tr>
                <th>날짜</th>
                <th>시간</th>
                <th>원장</th>
                <th>항목</th>
                <th>상태</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => {
                const isUpcoming = r.date > today && !r.canceled;
                const isNoShow = !isUpcoming && !r.canceled && !r.visited;
                return (
                  <tr
                    key={r.id}
                    className={isUpcoming ? 'upcoming' : r.canceled ? 'canceled' : isNoShow ? 'noshow' : ''}
                  >
                    <td>{r.date}</td>
                    <td>{r.time}</td>
                    <td>{r.doctor}</td>
                    <td>{r.item}</td>
                    <td>
                      {isUpcoming ? '' : r.canceled ? '취소' : r.visited ? '방문' : <span className="status-noshow">노쇼</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
      )}
    </div>
  );
};

export default PatientReservationSection;
