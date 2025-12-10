import React, { useState, useEffect } from 'react';
import { useReservations } from './hooks/useReservations';
import { CalendarHeader } from './components/CalendarHeader';
import { DayView } from './components/DayView';
import { MonthView } from './components/MonthView';
import { ReservationDetailModal } from './components/ReservationDetailModal';
import { NewReservationModal, InitialPatient } from './components/NewReservationModal';
import { ReservationStep1Modal, ReservationDraft } from './components/ReservationStep1Modal';
import { ReservationConfirmModal } from './components/ReservationConfirmModal';
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
  const [initialPatient, setInitialPatient] = useState<InitialPatient | null>(null);
  const [initialDetails, setInitialDetails] = useState<string>('');

  // 2단계 예약 플로우 상태
  const [showStep1Modal, setShowStep1Modal] = useState(false);
  const [reservationDraft, setReservationDraft] = useState<ReservationDraft | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [selectedTimeForConfirm, setSelectedTimeForConfirm] = useState<string>('');

  // URL 파라미터에서 환자 정보 읽기 (2단계 플로우로 시작)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const patientId = params.get('patientId');
    const chartNo = params.get('chartNo');
    const patientName = params.get('patientName');
    const phone = params.get('phone');
    const details = params.get('details');

    if (patientId && chartNo && patientName) {
      setInitialPatient({
        id: parseInt(patientId, 10),
        chartNo,
        name: patientName,
        phone: phone || undefined,
      });
      if (details) {
        setInitialDetails(details);
      }
      // 2단계 예약 플로우로 시작 (Step1 모달)
      setShowStep1Modal(true);

      // URL에서 파라미터 제거 (히스토리 유지)
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
    }
  }, []);

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

  // 2단계 예약 플로우 핸들러
  const handleStep1Next = (draft: ReservationDraft) => {
    setReservationDraft(draft);
    setShowStep1Modal(false);
    // 자동으로 일별 뷰로 전환
    setViewType('day');
  };

  const handleStep1Close = () => {
    setShowStep1Modal(false);
    setReservationDraft(null);
    setInitialPatient(null);
    setInitialDetails('');
  };

  const handleSelectTimeSlot = (time: string) => {
    setSelectedTimeForConfirm(time);
    setShowConfirmModal(true);
  };

  const handleConfirmBack = () => {
    setShowConfirmModal(false);
    setSelectedTimeForConfirm('');
    // 캘린더 뷰로 돌아감 (reservationDraft는 유지)
  };

  const handleConfirmClose = () => {
    setShowConfirmModal(false);
    setSelectedTimeForConfirm('');
    setReservationDraft(null);
    setInitialPatient(null);
    setInitialDetails('');
  };

  const handleReservationConfirm = async (data: CreateReservationRequest) => {
    await createReservation(data);
    loadReservations();
    setReservationDraft(null);
    setInitialPatient(null);
    setInitialDetails('');
  };

  // 예약 모드 취소 버튼 핸들러
  const handleCancelReservationMode = () => {
    setReservationDraft(null);
    setInitialPatient(null);
    setInitialDetails('');
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

      {/* 예약 모드 배너 */}
      {reservationDraft && (
        <div className="bg-green-600 text-white px-6 py-3 flex items-center justify-between shadow-md">
          <div className="flex items-center gap-4">
            <i className="fa-solid fa-calendar-check text-xl"></i>
            <div>
              <p className="font-bold">
                예약 시간 선택 중: {reservationDraft.patient.name}
              </p>
              <p className="text-sm text-green-100">
                {reservationDraft.doctor} | {reservationDraft.selectedItems.join(', ')} ({reservationDraft.requiredSlots}칸)
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setShowStep1Modal(true);
              }}
              className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg transition-colors text-sm"
            >
              <i className="fa-solid fa-edit mr-1"></i>
              내용 수정
            </button>
            <button
              onClick={handleCancelReservationMode}
              className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg transition-colors text-sm"
            >
              <i className="fa-solid fa-times mr-1"></i>
              취소
            </button>
          </div>
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
              reservationDraft={reservationDraft}
              onSelectTimeSlot={handleSelectTimeSlot}
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

      {/* 새 예약 모달 (기존 - 빠른 예약용) */}
      <NewReservationModal
        isOpen={showNewReservationModal}
        onClose={() => {
          setShowNewReservationModal(false);
          setNewReservationDefaults({});
          setInitialPatient(null);
          setInitialDetails('');
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
        initialPatient={initialPatient}
        initialDetails={initialDetails}
      />

      {/* 2단계 예약 플로우: Step1 모달 */}
      <ReservationStep1Modal
        isOpen={showStep1Modal}
        onClose={handleStep1Close}
        onNext={handleStep1Next}
        doctors={doctors}
        initialPatient={initialPatient}
        initialDetails={initialDetails}
      />

      {/* 2단계 예약 플로우: 확인 모달 */}
      <ReservationConfirmModal
        isOpen={showConfirmModal}
        onClose={handleConfirmClose}
        onConfirm={handleReservationConfirm}
        onBack={handleConfirmBack}
        draft={reservationDraft}
        selectedDate={selectedDate}
        selectedTime={selectedTimeForConfirm}
      />
    </div>
  );
};

export default ReservationApp;
