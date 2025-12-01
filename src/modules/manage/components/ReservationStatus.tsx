
import React from 'react';
import Quadrant from './Quadrant';
import PatientCard from './PatientCard';
import { ReservationsState, Reservation } from '../types';

interface ReservationStatusProps {
  reservations: ReservationsState;
  onEditReservation: (reservation: Reservation) => void;
  onPatientArrival: (reservation: Reservation, destination: 'consultation' | 'treatment') => void;
}

const ReservationStatus: React.FC<ReservationStatusProps> = ({ reservations, onEditReservation, onPatientArrival }) => {
  const today = new Date();
  const year = String(today.getFullYear()).slice(2); // 25
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][today.getDay()];
  const todayKey = `${today.getFullYear()}-${month}-${day}`;
  const formattedDate = `${year}/${month}/${day}(${dayOfWeek})`;

  const todaysReservations: Reservation[] = [];

  const reservationsForToday = reservations[todayKey];
  if (reservationsForToday) {
    // Flatten reservations from all doctors and time slots
    Object.values(reservationsForToday).forEach(doctorSlots => {
      Object.values(doctorSlots).forEach(reservationsInSlot => {
        reservationsInSlot.forEach(res => {
          // Show only the first part of a reservation and only if not canceled
          if (!res.isContinuation && res.status !== 'canceled') {
            todaysReservations.push(res);
          }
        });
      });
    });
  }

  // Sort by time
  todaysReservations.sort((a, b) => a.time.localeCompare(b.time));

  const title = (
    <>
      <span>예약 현황</span>
      <span className="text-base font-medium text-clinic-text-secondary">{formattedDate}</span>
    </>
  );

  return (
    <Quadrant icon="fa-solid fa-calendar-days" title={title} className="flex-1 min-h-0">
      <div className="space-y-2 p-2 h-full">
        {todaysReservations.length > 0 ? (
          todaysReservations.map((reservation) => (
            <PatientCard 
              key={reservation.partId} 
              reservation={reservation} 
              onEdit={onEditReservation} 
              onPatientArrival={onPatientArrival}
            />
          ))
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center text-clinic-text-secondary">
            <i className="fa-regular fa-calendar-check text-4xl mb-3"></i>
            <p className="font-semibold">오늘 예약이 없습니다.</p>
            <p className="text-sm">새로운 예약을 추가해보세요.</p>
          </div>
        )}
      </div>
    </Quadrant>
  );
};

export default ReservationStatus;
