import React, { useState } from 'react';
import { useReservations } from './hooks/useReservations';
import { CalendarHeader } from './components/CalendarHeader';
import { DayView } from './components/DayView';
import { MonthView } from './components/MonthView';
import { ReservationDetailModal } from './components/ReservationDetailModal';
import { NewReservationModal } from './components/NewReservationModal';
import type { Reservation, CreateReservationRequest } from './types';

interface ReservationAppProps {
  user?: any;
}

const ReservationApp: React.FC<ReservationAppProps> = ({ user }) => {
  const {
    selectedDate,
    viewType,
    reservations,
    doctors,
    selectedDoctor,
    isLoading,
    error,
    setViewType,
    setSelectedDoctor,
    goToDate,
    goToPrevious,
    goToNext,
    goToToday,
    loadReservations,
    cancelReservation,
    markAsVisited,
    createReservation,
  } = useReservations();

  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [showNewReservationModal, setShowNewReservationModal] = useState(false);
  const [newReservationDefaults, setNewReservationDefaults] = useState<{
    time?: string;
    doctor?: string;
  }>({});

  // 예약 클릭 핸들러
  const handleReservationClick = (reservation: Reservation) => {
    setSelectedReservation(reservation);
  };

  // 빈 시간 슬롯 클릭 핸들러
  const handleTimeSlotClick = (time: string, doctor?: string) => {
    setNewReservationDefaults({ time, doctor });
    setShowNewReservationModal(true);
  };

  // 예약 취소 핸들러
  const handleCancelReservation = async () => {
    if (!selectedReservation) return;
    if (!window.confirm('예약을 취소하시겠습니까?')) return;

    try {
      await cancelReservation(selectedReservation.id);
      setSelectedReservation(null);
    } catch (err: any) {
      alert(err.message);
    }
  };

  // 내원 확인 핸들러
  const handleMarkVisited = async () => {
    if (!selectedReservation) return;

    try {
      await markAsVisited(selectedReservation.id);
      setSelectedReservation(null);
    } catch (err: any) {
      alert(err.message);
    }
  };

  // 날짜 클릭 핸들러 (월별 뷰에서)
  const handleDateClick = (date: string) => {
    goToDate(date);
    setViewType('day');
  };

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      {/* 헤더 */}
      <header className="bg-clinic-primary text-white px-6 py-4 shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <a href="/" className="text-white/80 hover:text-white transition-colors">
              <i className="fa-solid fa-home text-xl"></i>
            </a>
            <h1 className="text-xl font-bold">예약 관리</h1>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={loadReservations}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              title="새로고침"
            >
              <i className="fa-solid fa-rotate"></i>
            </button>
            <button
              onClick={() => setShowNewReservationModal(true)}
              className="px-4 py-2 bg-white text-clinic-primary font-semibold rounded-lg hover:bg-gray-100 transition-colors"
            >
              <i className="fa-solid fa-plus mr-2"></i>
              새 예약
            </button>
          </div>
        </div>
      </header>

      {/* 캘린더 헤더 */}
      <CalendarHeader
        selectedDate={selectedDate}
        viewType={viewType}
        doctors={doctors}
        selectedDoctor={selectedDoctor}
        onViewTypeChange={setViewType}
        onDoctorChange={setSelectedDoctor}
        onPrevious={goToPrevious}
        onNext={goToNext}
        onToday={goToToday}
        onDateChange={goToDate}
      />

      {/* 로딩/에러 상태 */}
      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <i className="fa-solid fa-spinner fa-spin text-2xl text-gray-400"></i>
        </div>
      )}

      {error && (
        <div className="mx-6 my-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          <i className="fa-solid fa-circle-exclamation mr-2"></i>
          {error}
        </div>
      )}

      {/* 캘린더 뷰 */}
      {!isLoading && !error && (
        <>
          {viewType === 'day' && (
            <DayView
              date={selectedDate}
              reservations={reservations}
              doctors={doctors}
              onReservationClick={handleReservationClick}
              onTimeSlotClick={handleTimeSlotClick}
            />
          )}

          {viewType === 'week' && (
            <div className="flex-1 flex items-center justify-center bg-gray-50">
              <div className="text-center text-gray-500">
                <i className="fa-solid fa-calendar-week text-4xl mb-4"></i>
                <p>주간 뷰는 준비 중입니다</p>
              </div>
            </div>
          )}

          {viewType === 'month' && (
            <MonthView
              selectedDate={selectedDate}
              reservations={reservations}
              onDateClick={handleDateClick}
            />
          )}
        </>
      )}

      {/* 예약 상세 모달 */}
      {selectedReservation && (
        <ReservationDetailModal
          reservation={selectedReservation}
          onClose={() => setSelectedReservation(null)}
          onEdit={() => {
            // TODO: 수정 모달 열기
            alert('수정 기능은 준비 중입니다.');
          }}
          onCancel={handleCancelReservation}
          onMarkVisited={handleMarkVisited}
        />
      )}

      {/* 새 예약 모달 */}
      <NewReservationModal
        isOpen={showNewReservationModal}
        onClose={() => {
          setShowNewReservationModal(false);
          setNewReservationDefaults({});
        }}
        onSave={async (data: CreateReservationRequest) => {
          await createReservation(data);
          loadReservations();
        }}
        doctors={doctors}
        reservations={reservations}
        selectedDate={selectedDate}
        defaultTime={newReservationDefaults.time}
        defaultDoctor={newReservationDefaults.doctor}
      />
    </div>
  );
};

export default ReservationApp;
