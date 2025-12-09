
import React from 'react';
import Quadrant from './Quadrant';
import MssqlReservationCard from './MssqlReservationCard';
import { useMssqlReservations, MssqlReservation } from '../hooks/useMssqlReservations';

interface ReservationStatusProps {
  onPatientArrival?: (reservation: MssqlReservation, destination: 'consultation' | 'treatment') => void;
}

const ReservationStatus: React.FC<ReservationStatusProps> = ({ onPatientArrival }) => {
  const { reservations, summary, isConnected, error, formatTime } = useMssqlReservations();

  const today = new Date();
  const year = String(today.getFullYear()).slice(2); // 25
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][today.getDay()];
  const formattedDate = `${year}/${month}/${day}(${dayOfWeek})`;

  const title = (
    <>
      <span>예약 현황</span>
      <span className="text-base font-medium text-clinic-text-secondary ml-2">{formattedDate}</span>
      {!isConnected && (
        <span className="ml-2 text-xs text-red-500">
          <i className="fa-solid fa-circle-exclamation mr-1"></i>
          연결 끊김
        </span>
      )}
      {isConnected && summary.total > 0 && (
        <span className="ml-2 text-xs text-gray-500">
          ({summary.visited}/{summary.total})
        </span>
      )}
    </>
  );

  return (
    <Quadrant icon="fa-solid fa-calendar-days" title={title} className="flex-1 min-h-0">
      <div className="space-y-2 p-2 h-full overflow-y-auto">
        {error && (
          <div className="text-center text-red-500 text-sm py-4">
            <i className="fa-solid fa-triangle-exclamation mr-2"></i>
            {error}
          </div>
        )}
        {!error && reservations.length > 0 ? (
          reservations.map((reservation) => (
            <MssqlReservationCard
              key={reservation.id}
              reservation={reservation}
              formatTime={formatTime}
              onPatientArrival={onPatientArrival}
            />
          ))
        ) : !error ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-clinic-text-secondary">
            <i className="fa-regular fa-calendar-check text-4xl mb-3"></i>
            <p className="font-semibold">오늘 예약이 없습니다.</p>
            <p className="text-sm">MSSQL에서 예약 데이터를 불러옵니다.</p>
          </div>
        ) : null}
      </div>
    </Quadrant>
  );
};

export default ReservationStatus;
