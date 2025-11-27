import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import Header, { ModalType } from './components/Header';
import ReservationStatus from './components/ReservationStatus';
import ConsultationStatus from './components/ConsultationStatus';
import WaitingList from './components/WaitingList';
import TreatmentRoomStatus from './components/TreatmentRoomStatus';
import PaymentStatus from './components/PaymentStatus';
import Modal from './components/Modal';
import { Patient, PatientStatus, Reservation, Payment, PaymentMethod, TreatmentDetailItem, User } from './types';
import NewPatientForm from './components/NewPatientForm';
import { NewReservationData } from './components/NewReservationForm';
import ReservationModal from './components/ReservationModal';
import PatientSearch from './components/PatientSearch';
import PaymentModal from './components/PaymentModal';
import DailyPaymentSummary from './components/DailyPaymentSummary';
import Settings from './components/Settings';

// Custom Hooks
import { usePatients } from './hooks/usePatients';
import { useReservations } from './hooks/useReservations';
import { usePayments } from './hooks/usePayments';
import { useTreatmentRooms } from './hooks/useTreatmentRooms';
import { useActingQueues } from './hooks/useActingQueues';
import { useStaff } from './hooks/useStaff';
import { useTreatmentItems } from './hooks/useTreatmentItems';
import { useConsultationRooms } from './hooks/useConsultationRooms';

import type { PortalUser } from '@shared/types';
import { useTreatmentRecord } from '@shared/hooks/useTreatmentRecord';

// Types
type PaymentItem = { id: number; method: PaymentMethod; amount: string; };

interface BulkAddFailure {
  name: string;
  chartNumber?: string;
  reason: string;
}

interface ManageAppProps {
  user: PortalUser;
}

// Map PortalUser role to Affiliation
const roleToAffiliation = (role: string): '의료진' | '데스크' | '치료실' | '탕전실' => {
  switch (role) {
    case 'medical_staff': return '의료진';
    case 'desk': return '데스크';
    case 'treatment': return '치료실';
    case 'decoction': return '탕전실';
    default: return '데스크';
  }
};

const ManageApp: React.FC<ManageAppProps> = ({ user }) => {
  // Convert PortalUser to internal User type
  const currentUser: User = useMemo(() => ({
    id: user.username,
    name: user.name,
    password: '',
    affiliation: roleToAffiliation(user.role),
  }), [user]);

  // Patients
  const patients = usePatients(currentUser);

  // Reservations
  const reservationHook = useReservations(currentUser, patients.allPatients);

  // Payments
  const paymentsHook = usePayments(currentUser);

  // Treatment Rooms
  const treatmentRoomsHook = useTreatmentRooms(currentUser);

  // Acting Queues
  const actingQueuesHook = useActingQueues();

  // Staff
  const staffHook = useStaff(currentUser);
  const treatmentItemsHook = useTreatmentItems(currentUser);

  // Consultation Rooms
  const consultationRoomsHook = useConsultationRooms({ medicalStaff: staffHook.medicalStaff });

  // Treatment Record (진료내역 타임라인)
  const treatmentRecord = useTreatmentRecord();

  // Modal State
  const [modalType, setModalType] = useState<ModalType | null>(null);
  const [modalTitle, setModalTitle] = useState<string>('');
  const [isModalWide, setIsModalWide] = useState<boolean>(false);
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [bulkAddResult, setBulkAddResult] = useState<{ new: number; updated: number; failures: BulkAddFailure[] } | null>(null);
  const [patientIdToDelete, setPatientIdToDelete] = useState<number | null>(null);
  const [patientForNewReservation, setPatientForNewReservation] = useState<Patient | null>(null);

  // Memoized patient to delete info
  const patientToDeleteInfo = useMemo(() => {
    if (!patientIdToDelete) return null;
    return patients.allPatients.find(p => p.id === patientIdToDelete);
  }, [patientIdToDelete, patients.allPatients]);

  // Modal Handlers
  const openModal = (type: ModalType, title: string, wide?: boolean) => {
    setModalType(type);
    setModalTitle(title);
    setIsModalWide(wide || false);
  };

  const closeModal = () => {
    setModalType(null);
    setModalTitle('');
    setIsModalWide(false);
    setEditingReservation(null);
    setSelectedPayment(null);
    setPatientForNewReservation(null);
  };

  const handleEditReservation = (reservationToEdit: Reservation) => {
    setEditingReservation(reservationToEdit);
    openModal('reservation', '예약 수정', false);
  };

  // Reservation Handlers
  const addNewReservation = async (data: NewReservationData) => {
    const result = await reservationHook.addNewReservation(data, actingQueuesHook.addActingFromReservation);

    if (result && result.reservationId && result.slots.length > 0) {
      const reservationDate = result.slots[0]?.date;
      const reservationTime = result.slots[0]?.time;

      if (reservationDate && reservationTime) {
        paymentsHook.updatePaymentReservationInfo(result.reservationId, reservationDate, reservationTime, data.patient.id);
      }
    }
  };

  const updateReservation = async (reservationId: string, data: NewReservationData) => {
    const result = await reservationHook.updateReservation(reservationId, data);

    const reservationDate = result.slots[0]?.date;
    const reservationTime = result.slots[0]?.time;

    if (reservationDate && reservationTime) {
      paymentsHook.updatePaymentReservationInfo(reservationId, reservationDate, reservationTime, data.patient.id);
    } else {
      paymentsHook.removePaymentReservationInfo(reservationId);
    }
  };

  const cancelReservation = async (reservationId: string) => {
    await reservationHook.cancelReservation(reservationId);
    paymentsHook.removePaymentReservationInfo(reservationId);
  };

  const deleteReservation = async (reservationId: string) => {
    await reservationHook.deleteReservation(reservationId);
    paymentsHook.removePaymentReservationInfo(reservationId);
  };

  const handlePatientArrival = async (reservation: Reservation, destination: 'consultation' | 'treatment') => {
    const patient = patients.allPatients.find(p => p.id === reservation.patientId);

    // 진료내역: 체크인 + 대기 시작
    await treatmentRecord.checkIn(reservation.patientId, {
      doctorName: reservation.doctor,
      visitType: 'follow_up',
      reservationId: reservation.id,
    });

    if (destination === 'consultation') {
      await treatmentRecord.startWaitingConsultation(reservation.patientId);
    } else {
      await treatmentRecord.startWaitingTreatment(reservation.patientId);
    }

    reservationHook.handlePatientArrival(
      reservation,
      destination,
      patients.addPatientToConsultation,
      patients.addPatientToTreatment,
      actingQueuesHook.addActingFromReservation,
      patient
    );
  };

  // Patient Handlers
  const addNewPatient = async (formData: any) => {
    await patients.addNewPatient(formData, actingQueuesHook.addActingForNewPatient);
    closeModal();
  };

  const updatePatientInfo = async (updatedPatientData: Patient) => {
    const result = await patients.updatePatientInfo(updatedPatientData);
    if (result) {
      reservationHook.updateReservationPatientInfo(updatedPatientData.id, result.name, result.chartNumber);
    }
  };

  const deletePatient = async (patientId: number) => {
    await patients.deletePatient(patientId);
    paymentsHook.setPaymentsWaiting(prev => prev.filter(p => p.patientId !== patientId));
    reservationHook.deleteReservationsByPatient(patientId);
  };

  const handleRequestDeletePatient = useCallback((patientId: number) => {
    setPatientIdToDelete(patientId);
  }, []);

  const handleConfirmDelete = () => {
    if (patientIdToDelete) {
      deletePatient(patientIdToDelete);
    }
    setPatientIdToDelete(null);
  };

  const handleCancelDelete = () => {
    setPatientIdToDelete(null);
  };

  const addBulkPatients = useCallback(async (
    newPatientsData: any[],
    onProgress?: (current: number, total: number, message: string) => void
  ) => {
    const result = await patients.addBulkPatients(newPatientsData, onProgress);
    setBulkAddResult(result);
  }, [patients.addBulkPatients]);

  const movePatient = (patientToMove: Patient) => {
    patients.movePatient(patientToMove);
  };

  const handlePatientDrop = (
    draggedPatientId: number,
    sourceListType: 'consultation' | 'treatment',
    destinationListType: 'consultation' | 'treatment',
    targetPatientId: number | null
  ) => {
    patients.handlePatientDrop(draggedPatientId, sourceListType, destinationListType, targetPatientId);
  };

  // Payment Handlers
  const handleOpenPaymentModal = (payment: Payment) => {
    setSelectedPayment(payment);
    openModal('payment', `${payment.patientName}님 수납 처리`);
  };

  const handleOpenReservationForPatient = (payment: Payment) => {
    if (payment.reservationId) {
      const allReservations: Reservation[] = Object.values(reservationHook.reservations)
        .flatMap(docSlots => Object.values(docSlots))
        .flatMap(timeSlots => Object.values(timeSlots))
        .flat();

      const reservationToEdit = allReservations.find(r => r.id === payment.reservationId);
      if (reservationToEdit) {
        handleEditReservation(reservationToEdit);
      } else {
        alert('해당 예약을 찾을 수 없습니다. 삭제되었거나 변경되었을 수 있습니다.');
      }
    } else {
      const patient = patients.allPatients.find(p => p.id === payment.patientId);
      if (patient) {
        setPatientForNewReservation(patient);
        openModal('reservation', `${patient.name}님 예약`, true);
      } else {
        alert('환자 정보를 찾을 수 없습니다.');
      }
    }
  };

  const handleCompletePayment = async (
    originalPayment: Payment,
    details: {
      totalAmount: number;
      items: PaymentItem[];
      remainingAmount: number;
      treatmentItems: TreatmentDetailItem[];
    }
  ) => {
    // 진료내역: 수납 완료 + 체크아웃
    await treatmentRecord.completePayment(originalPayment.patientId, originalPayment.id);
    await treatmentRecord.checkOut(originalPayment.patientId);

    await paymentsHook.handleCompletePayment(originalPayment, details);
    closeModal();
  };

  // Consultation Room Handlers
  const handleFinishConsultation = async (patientId: number, destination: 'treatment' | 'payment') => {
    const patient = patients.allPatients.find(p => p.id === patientId);
    if (!patient) {
      alert("환자 정보를 찾을 수 없습니다.");
      return;
    }

    // 진료내역: 진료 종료
    await treatmentRecord.endConsultation(patientId);

    consultationRoomsHook.handleFinishConsultation(patientId, () => {}, () => {});
    patients.removeFromConsultationList(patientId);

    if (destination === 'treatment') {
      // 진료내역: 치료 대기 시작
      await treatmentRecord.startWaitingTreatment(patientId);
      patients.addToTreatmentList(patient, '진료완료');
    } else {
      // 진료내역: 수납 대기 시작
      await treatmentRecord.startWaitingPayment(patientId);
      await paymentsHook.createPayment(patient, '진료비');
    }
  };

  const handleAssignPatientToConsultationRoom = async (patientId: number, roomId: number, sourceListType: 'consultation' | 'treatment') => {
    const sourceList = sourceListType === 'consultation' ? patients.consultationWaitingList : patients.treatmentWaitingList;
    const patientToAssign = sourceList.find(p => p.id === patientId);

    if (!patientToAssign) {
      alert('대기 목록에서 환자를 찾을 수 없습니다.');
      return;
    }

    const canAssign = consultationRoomsHook.handleAssignPatientToRoom(patientId, roomId);
    if (!canAssign) return;

    if (sourceListType === 'consultation') {
      patients.removeFromConsultationList(patientId);
    } else {
      patients.removeFromTreatmentList(patientId);
    }

    const room = consultationRoomsHook.consultationRooms.find(r => r.id === roomId);

    // 진료내역: 진료 시작
    await treatmentRecord.startConsultation(patientId, {
      location: room?.roomName,
      staffName: room?.doctorName,
    });

    consultationRoomsHook.assignPatientToRoom(
      roomId,
      patientToAssign.id,
      patientToAssign.name,
      sourceListType === 'treatment' ? '치료실->재진료' : patientToAssign.details
    );

    alert(`${patientToAssign.name}님을 ${room?.roomName}에 배정했습니다.`);
  };

  const handleMovePatientToPayment = async (patientId: number, sourceList: 'consultation' | 'treatment' | 'treatment_room') => {
    let patientToMove: Patient | undefined;

    if (sourceList === 'consultation') {
      patientToMove = patients.consultationWaitingList.find(p => p.id === patientId);
      if (patientToMove) patients.removeFromConsultationList(patientId);
    } else if (sourceList === 'treatment') {
      patientToMove = patients.treatmentWaitingList.find(p => p.id === patientId);
      if (patientToMove) patients.removeFromTreatmentList(patientId);
    } else {
      // treatment_room에서 올 때: 캐시에서 먼저 찾고, 없으면 치료실 정보에서 가져옴
      patientToMove = patients.allPatients.find(p => p.id === patientId);

      if (!patientToMove) {
        // 치료실에서 환자 정보 찾기
        const room = treatmentRoomsHook.treatmentRooms.find(r => r.patientId === patientId);
        if (room && room.patientName) {
          patientToMove = {
            id: patientId,
            name: room.patientName,
            chartNumber: room.patientChartNumber || '',
            status: PatientStatus.COMPLETED,
            time: '',
          };
        }
      }
    }

    if (!patientToMove) {
      alert("환자 정보를 찾을 수 없습니다.");
      return;
    }

    await paymentsHook.createPayment(patientToMove, '치료비');
  };

  const handleMovePatientFromPaymentToWaiting = (paymentId: number, destination: 'consultation' | 'treatment') => {
    const paymentToMove = paymentsHook.movePatientFromPaymentToWaiting(paymentId);
    if (!paymentToMove) {
      alert("수납 대기 목록에서 해당 항목을 찾을 수 없습니다.");
      return;
    }

    const patientInfo = patients.allPatients.find(p => p.id === paymentToMove.patientId);
    if (!patientInfo) {
      alert("환자 정보를 찾을 수 없습니다.");
      return;
    }

    if (destination === 'consultation') {
      patients.addToConsultationList(patientInfo, '수납->진료');
      alert(`${patientInfo.name}님을 진료 대기 목록으로 이동했습니다.`);
    } else {
      patients.addToTreatmentList(patientInfo, '수납->치료');
    }
  };

  // Render Modal Content
  const renderModalContent = () => {
    switch (modalType) {
      case 'reservation':
        return <ReservationModal
          reservations={reservationHook.reservations}
          addNewReservation={addNewReservation}
          updateReservation={updateReservation}
          cancelReservation={cancelReservation}
          deleteReservation={deleteReservation}
          closeModal={closeModal}
          allPatients={patients.activePatients}
          setModalWide={setIsModalWide}
          setModalTitle={setModalTitle}
          initialReservationForEdit={editingReservation}
          initialPatientForNew={patientForNewReservation}
        />;
      case 'newPatient':
        return <NewPatientForm addNewPatient={addNewPatient} onClose={closeModal} />;
      case 'patientSearch':
        return <PatientSearch
          addPatientToConsultation={patients.addPatientToConsultation}
          addPatientToTreatment={patients.addPatientToTreatment}
          updatePatientInfo={updatePatientInfo}
          deletePatient={handleRequestDeletePatient}
        />;
      case 'payment':
        return <PaymentModal
          payment={selectedPayment}
          onClose={closeModal}
          onComplete={handleCompletePayment}
          uncoveredCategories={staffHook.uncoveredCategories}
        />;
      case 'dailyPayments':
        return <DailyPaymentSummary completedPayments={paymentsHook.completedPayments} />;
      case 'stats':
        return <p>통계 정보가 여기에 표시됩니다.</p>;
      case 'settings':
        return <Settings
          addBulkPatients={addBulkPatients}
          allPatients={patients.activePatients}
          deletePatient={handleRequestDeletePatient}
          deletedPatients={patients.deletedPatients}
          restorePatient={patients.restorePatient}
          medicalStaff={staffHook.medicalStaff}
          updateMedicalStaff={staffHook.updateMedicalStaff}
          addMedicalStaff={staffHook.addMedicalStaff}
          deleteMedicalStaff={staffHook.deleteMedicalStaff}
          staff={staffHook.staff}
          updateStaff={staffHook.updateStaff}
          addStaff={staffHook.addStaff}
          deleteStaff={staffHook.deleteStaff}
          uncoveredCategories={staffHook.uncoveredCategories}
          updateUncoveredCategories={staffHook.updateUncoveredCategories}
          treatmentItems={treatmentItemsHook.treatmentItems}
          addTreatmentItem={treatmentItemsHook.addTreatmentItem}
          updateTreatmentItem={treatmentItemsHook.updateTreatmentItem}
          deleteTreatmentItem={treatmentItemsHook.deleteTreatmentItem}
          reorderTreatmentItems={treatmentItemsHook.reorderTreatmentItems}
        />;
      default:
        return null;
    }
  };

  // Prevent browser back navigation on Backspace key
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Backspace' || event.keyCode === 8) {
        const target = event.target as HTMLElement;
        const isEditable =
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable;

        if (!isEditable) {
          event.preventDefault();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // 환자 데이터 로딩 중
  if (patients.isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-clinic-background">
        <div className="text-center">
          <div className="flex items-center justify-center mb-6">
            <i className="fas fa-clinic-medical text-6xl text-clinic-primary"></i>
          </div>
          <h1 className="text-2xl font-bold text-clinic-primary mb-2">연이재한의원</h1>
          <h2 className="text-lg text-clinic-text-secondary mb-6">운영관리 시스템</h2>
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-clinic-primary mx-auto mb-4"></div>
          <p className="text-clinic-text-secondary">{patients.loadingMessage || '데이터를 불러오는 중...'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen text-clinic-text-primary overflow-hidden">
      <Header
        onOpenModal={openModal}
        currentUser={currentUser}
      />

      <Routes>
        <Route path="/" element={
          <main className="flex-grow p-4 lg:p-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4 lg:gap-6 min-h-0">
            {/* 1. 예약현황 */}
            <div className="xl:col-span-1 flex flex-col min-h-0">
              <ReservationStatus
                reservations={reservationHook.reservations}
                onEditReservation={handleEditReservation}
                onPatientArrival={handlePatientArrival}
              />
            </div>

            {/* 2. 진료실현황, 진료대기 */}
            <div className="xl:col-span-1 flex flex-col gap-4 lg:gap-6">
              <ConsultationStatus
                rooms={consultationRoomsHook.consultationRooms}
                onFinishConsultation={handleFinishConsultation}
                onAssignPatient={handleAssignPatientToConsultationRoom}
              />
              <WaitingList
                title="진료 대기"
                icon="fa-solid fa-user-doctor"
                list={patients.consultationWaitingList}
                listType="consultation"
                onPatientClick={movePatient}
                onPatientDrop={handlePatientDrop}
                onMoveToPayment={(id) => handleMovePatientToPayment(id, 'consultation')}
              />
            </div>

            {/* 3. 치료대기 */}
            <div className="xl:col-span-1 flex flex-col min-h-0">
              <WaitingList
                title="치료 대기"
                icon="fa-solid fa-bed-pulse"
                list={patients.treatmentWaitingList}
                listType="treatment"
                onPatientClick={movePatient}
                onPatientDrop={handlePatientDrop}
                onMoveToPayment={(id) => handleMovePatientToPayment(id, 'treatment')}
              />
            </div>

            {/* 4. 치료실 현황 */}
            <div className="xl:col-span-1 flex flex-col min-h-0">
              <TreatmentRoomStatus treatmentRooms={treatmentRoomsHook.treatmentRooms} />
            </div>

            {/* 5. 수납및예약 */}
            <div className="xl:col-span-1 flex flex-col min-h-0">
              <PaymentStatus
                payments={paymentsHook.paymentsWaiting}
                onPaymentClick={handleOpenPaymentModal}
                onReservationClick={handleOpenReservationForPatient}
                onMoveToWaiting={handleMovePatientFromPaymentToWaiting}
                onDelete={paymentsHook.deletePaymentFromWaiting}
              />
            </div>
          </main>
        } />
      </Routes>

      <Modal isOpen={modalType !== null} onClose={closeModal} title={modalTitle} wide={isModalWide}>
        {renderModalContent()}
      </Modal>

      {/* Patient Delete Confirmation Modal */}
      <Modal
        isOpen={patientIdToDelete !== null}
        onClose={handleCancelDelete}
        title="환자 정보 삭제 확인"
      >
        {patientToDeleteInfo && (
          <div className="text-center p-4">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
              <i className="fa-solid fa-triangle-exclamation text-2xl text-red-600"></i>
            </div>
            <h3 className="text-lg leading-6 font-semibold text-gray-900">
              정말로 삭제하시겠습니까?
            </h3>
            <div className="mt-2">
              <p className="text-sm text-gray-600">
                <span className="font-bold">{patientToDeleteInfo.name}</span>
                ({patientToDeleteInfo.chartNumber || '차트번호 없음'}) 님의 정보와 관련된 모든 예약 및 대기 내역이 삭제 처리됩니다.
              </p>
              <p className="text-sm font-bold text-gray-700 mt-2">
                삭제된 정보는 '환경 설정'에서 복구할 수 있습니다.
              </p>
            </div>
            <div className="flex justify-center space-x-4 mt-6">
              <button
                type="button"
                onClick={handleCancelDelete}
                className="px-8 py-2 bg-gray-200 text-gray-800 font-semibold rounded-md hover:bg-gray-300 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-8 py-2 bg-red-600 text-white font-semibold rounded-md hover:bg-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                삭제
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Bulk Add Result Modal */}
      <Modal
        isOpen={bulkAddResult !== null}
        onClose={() => setBulkAddResult(null)}
        title="환자 일괄등록 결과"
      >
        {bulkAddResult && (
          <div className="space-y-4">
            <div className="flex justify-around text-center p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="text-sm text-gray-500">신규 등록</p>
                <p className="text-3xl font-bold text-green-600">{bulkAddResult.new}건</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">정보 업데이트</p>
                <p className="text-3xl font-bold text-blue-600">{bulkAddResult.updated}건</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">등록 실패</p>
                <p className="text-3xl font-bold text-red-600">{bulkAddResult.failures.length}건</p>
              </div>
            </div>

            {bulkAddResult.failures.length > 0 && (
              <div className="pt-4 border-t">
                <h4 className="font-semibold text-lg mb-2">실패 내역</h4>
                <div className="max-h-60 overflow-y-auto bg-white rounded-md border">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-100 sticky top-0">
                      <tr>
                        <th className="px-4 py-2">이름</th>
                        <th className="px-4 py-2">차트번호</th>
                        <th className="px-4 py-2">실패 사유</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bulkAddResult.failures.map((fail, index) => (
                        <tr key={index} className="bg-white border-b last:border-b-0">
                          <td className="px-4 py-2 font-medium">{fail.name}</td>
                          <td className="px-4 py-2">{fail.chartNumber}</td>
                          <td className="px-4 py-2 text-red-700">{fail.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex justify-end pt-4 mt-4">
              <button
                onClick={() => setBulkAddResult(null)}
                className="px-6 py-2 bg-clinic-primary text-white font-semibold rounded-md hover:bg-clinic-secondary"
              >
                확인
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ManageApp;
