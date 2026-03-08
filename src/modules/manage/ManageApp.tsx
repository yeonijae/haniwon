import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import Header, { ModalType } from './components/Header';
import ReservationStatus from './components/ReservationStatus';
import WaitingList from './components/WaitingList';
import MssqlWaitingList from './components/MssqlWaitingList';
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
import ConsultationInfoModal from './components/ConsultationInfoModal';
import PatientTreatmentInfoModal from './components/PatientTreatmentInfoModal';
import TreatmentStatsView from './components/TreatmentStatsView';
import { useFontScale } from '@shared/hooks/useFontScale';
import { useDocumentTitle } from '@shared/hooks/useDocumentTitle';

// Custom Hooks
import { usePatients } from './hooks/usePatients';
import { useReservations } from './hooks/useReservations';
import { usePayments } from './hooks/usePayments';
import { useTreatmentRooms } from './hooks/useTreatmentRooms';
import { useActingQueues } from './hooks/useActingQueues';
import { useStaff } from './hooks/useStaff';
import { useConsultationRooms } from './hooks/useConsultationRooms';
import { useConsultationItems } from './hooks/useConsultationItems';
import { useMssqlQueue } from './hooks/useMssqlQueue';

import { initTreatmentTables } from './lib/treatmentApi';

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
  // 폰트 스케일
  const { scale, scalePercent, increaseScale, decreaseScale, resetScale, canIncrease, canDecrease } = useFontScale('manage');
  useDocumentTitle('접수/수납');

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

  // Consultation Rooms
  const consultationRoomsHook = useConsultationRooms({ medicalStaff: staffHook.medicalStaff });

  // Consultation Items (진료항목)
  const consultationItemsHook = useConsultationItems(currentUser);

  // Treatment Record (진료내역 타임라인)
  const treatmentRecord = useTreatmentRecord();

  // MSSQL Queue (차트 프로그램 대기/치료 현황)
  const mssqlQueue = useMssqlQueue();

  // 치료 정보 관리 테이블 초기화 (앱 시작 시 한 번만)
  useEffect(() => {
    initTreatmentTables().catch(err => {
      console.error('치료 정보 테이블 초기화 실패:', err);
    });
  }, []);

  // 치료실에 있는 환자들의 정보를 캐시에 로드
  useEffect(() => {
    const loadTreatmentRoomPatients = async () => {
      const patientIds = treatmentRoomsHook.treatmentRooms
        .filter(room => room.patientId)
        .map(room => room.patientId!);

      for (const patientId of patientIds) {
        // 캐시에 없으면 로드
        if (!patients.allPatients.find(p => p.id === patientId)) {
          await patients.getPatientById(patientId);
        }
      }
    };

    loadTreatmentRoomPatients();
  }, [treatmentRoomsHook.treatmentRooms, patients.getPatientById, patients.allPatients]);

  // Modal State
  const [modalType, setModalType] = useState<ModalType | null>(null);
  const [modalTitle, setModalTitle] = useState<string>('');
  const [isModalWide, setIsModalWide] = useState<boolean>(false);
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [bulkAddResult, setBulkAddResult] = useState<{ new: number; updated: number; failures: BulkAddFailure[] } | null>(null);
  const [patientIdToDelete, setPatientIdToDelete] = useState<number | null>(null);
  const [patientForNewReservation, setPatientForNewReservation] = useState<Patient | null>(null);
  const [patientForConsultationInfo, setPatientForConsultationInfo] = useState<Patient | null>(null);
  const [patientForTreatmentInfo, setPatientForTreatmentInfo] = useState<Patient | null>(null);
  const [selectedPaymentForDetail, setSelectedPaymentForDetail] = useState<Payment | null>(null);
  const [detailMemoPackageInfo, setDetailMemoPackageInfo] = useState('');
  const [detailMemoText, setDetailMemoText] = useState('');
  const [isDetailMemoSaving, setIsDetailMemoSaving] = useState(false);

  // Memoized patient to delete info
  const patientToDeleteInfo = useMemo(() => {
    if (!patientIdToDelete) return null;
    return patients.allPatients.find(p => p.id === patientIdToDelete);
  }, [patientIdToDelete, patients.allPatients]);

  // Modal Handlers
  const [isModalFullHeight, setIsModalFullHeight] = useState<boolean>(false);
  const [isModalFullScreen, setIsModalFullScreen] = useState<boolean>(false);
  const [modalHeaderExtra, setModalHeaderExtra] = useState<React.ReactNode>(null);

  const openModal = (type: ModalType, title: string, wide?: boolean, fullHeight?: boolean) => {
    setModalType(type);
    setModalTitle(title);
    setIsModalWide(wide || false);
    setIsModalFullHeight(fullHeight || false);
    // 수납현황, 통계는 fullScreen으로 열기
    setIsModalFullScreen(type === 'dailyPayments' || type === 'stats');
  };

  const closeModal = () => {
    setModalType(null);
    setModalTitle('');
    setIsModalWide(false);
    setIsModalFullHeight(false);
    setIsModalFullScreen(false);
    setModalHeaderExtra(null);
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
    return result;
  }, [patients.addBulkPatients]);

  const movePatient = (patientToMove: Patient) => {
    patients.movePatient(patientToMove);
  };

  const handlePatientDrop = (
    draggedPatientId: number,
    sourceListType: 'consultation' | 'treatment' | 'consultation_room',
    destinationListType: 'consultation' | 'treatment',
    targetPatientId: number | null
  ) => {
    console.log('🔄 handlePatientDrop 호출:', { draggedPatientId, sourceListType, destinationListType, targetPatientId });

    // 진료실에서 드래그한 경우
    if (sourceListType === 'consultation_room') {
      console.log('📍 진료실에서 드래그 감지');
      const room = consultationRoomsHook.consultationRooms.find(r => r.patientId === draggedPatientId);
      console.log('📍 찾은 진료실:', room);

      if (room) {
        // 진료실에서 환자 정보 가져오기 (allPatients 캐시에서 먼저 찾기)
        let patientInfo = patients.allPatients.find(p => p.id === draggedPatientId);
        console.log('📍 캐시에서 찾은 환자:', patientInfo);

        if (!patientInfo) {
          // 캐시에 없는 경우 진료실 정보로 생성
          console.warn(`환자 ID ${draggedPatientId}가 캐시에 없습니다. 진료실 정보로 대체합니다.`);
          patientInfo = {
            id: draggedPatientId,
            name: room.patientName || '알 수 없음',
            chartNumber: '',
            status: PatientStatus.WAITING_TREATMENT,
            time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }),
            details: room.patientDetails || '',
          };
        }

        // 진료실 비우기
        console.log('📍 진료실 비우기:', room.id);
        consultationRoomsHook.clearConsultationRoom(room.id);

        // 대상 목록에 추가
        if (destinationListType === 'treatment') {
          console.log('📍 치료대기 목록에 추가');
          patients.addToTreatmentList(patientInfo, room.patientDetails || '진료완료');
        } else {
          console.log('📍 진료대기 목록에 추가');
          patients.addToConsultationList(patientInfo, room.patientDetails || '재진료대기');
        }
      } else {
        console.error('❌ 진료실을 찾을 수 없음. patientId:', draggedPatientId);
        console.log('📍 현재 진료실 목록:', consultationRoomsHook.consultationRooms);
      }
      return;
    }

    // 기존 대기목록 간 이동
    console.log('📍 대기목록 간 이동 호출');
    patients.handlePatientDrop(draggedPatientId, sourceListType, destinationListType, targetPatientId);
  };

  // Payment Handlers
  const handleOpenPaymentModal = (payment: Payment) => {
    setSelectedPayment(payment);
    openModal('payment', `${payment.patientName}님 수납 처리`, true, true);
  };

  // 환자 정보 클릭 핸들러 (시술/치료비/수납 상세 보기)
  const handlePatientInfoClick = (payment: Payment) => {
    setSelectedPaymentForDetail(payment);
    setDetailMemoPackageInfo(payment.packageInfo || '');
    setDetailMemoText(payment.paymentMemo || '');
  };

  // 상세 모달에서 메모 저장
  const handleDetailMemoSave = async () => {
    if (!selectedPaymentForDetail) return;

    setIsDetailMemoSaving(true);
    try {
      const totalAmount = (selectedPaymentForDetail.insuranceSelf || 0) + (selectedPaymentForDetail.generalAmount || 0);
      await import('./lib/api').then(api => api.upsertPaymentMemo({
        patient_id: selectedPaymentForDetail.patientId,
        chart_number: selectedPaymentForDetail.patientChartNumber,
        patient_name: selectedPaymentForDetail.patientName,
        mssql_receipt_id: selectedPaymentForDetail.mssqlReceiptId,
        total_amount: totalAmount,
        insurance_self: selectedPaymentForDetail.insuranceSelf,
        general_amount: selectedPaymentForDetail.generalAmount,
        unpaid_amount: selectedPaymentForDetail.unpaidAmount,
        package_info: detailMemoPackageInfo,
        memo: detailMemoText,
      }));

      // 로컬 상태 업데이트
      paymentsHook.handleMemoSave(selectedPaymentForDetail.patientId, detailMemoPackageInfo, detailMemoText);

      // 선택된 payment 업데이트
      setSelectedPaymentForDetail(prev => prev ? {
        ...prev,
        packageInfo: detailMemoPackageInfo,
        paymentMemo: detailMemoText,
      } : null);

      alert('메모가 저장되었습니다.');
    } catch (error) {
      console.error('메모 저장 오류:', error);
      alert('메모 저장에 실패했습니다.');
    } finally {
      setIsDetailMemoSaving(false);
    }
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
      // 예약관리 시스템을 새 창으로 열고 환자 정보 + 진료내역 전달
      const patient = patients.allPatients.find(p => p.id === payment.patientId);
      const params = new URLSearchParams({
        patientId: payment.patientId.toString(),
        chartNo: payment.patientChartNumber || '',
        patientName: payment.patientName,
        phone: patient?.phone || '',
        details: payment.details || '',
      });
      window.open(`/reservation?${params.toString()}`, '_blank');
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

  const handleAssignPatientToConsultationRoom = async (
    patientId: number,
    roomId: number,
    sourceListType: 'consultation' | 'treatment' | 'consultation_room',
    sourceRoomId?: number
  ) => {
    let patientToAssign: Patient | undefined;
    let patientDetails = '';

    if (sourceListType === 'consultation_room') {
      // 다른 진료실에서 이동하는 경우
      const sourceRoom = consultationRoomsHook.consultationRooms.find(r => r.id === sourceRoomId);
      if (!sourceRoom || sourceRoom.patientId !== patientId) {
        console.error('원본 진료실을 찾을 수 없습니다.');
        return;
      }

      // 환자 정보 가져오기
      patientToAssign = patients.allPatients.find(p => p.id === patientId);
      if (!patientToAssign) {
        patientToAssign = {
          id: patientId,
          name: sourceRoom.patientName || '알 수 없음',
          chartNumber: '',
          status: PatientStatus.IN_CONSULTATION,
          time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }),
        };
      }
      patientDetails = sourceRoom.patientDetails || '진료실 이동';

      // 원본 진료실 비우기
      consultationRoomsHook.clearConsultationRoom(sourceRoomId!);
    } else {
      // 대기 목록에서 이동하는 경우
      const sourceList = sourceListType === 'consultation' ? patients.consultationWaitingList : patients.treatmentWaitingList;
      patientToAssign = sourceList.find(p => p.id === patientId);

      if (!patientToAssign) {
        alert('대기 목록에서 환자를 찾을 수 없습니다.');
        return;
      }

      patientDetails = sourceListType === 'treatment' ? '치료실->재진료' : (patientToAssign.details || '');

      // 대기 목록에서 제거
      if (sourceListType === 'consultation') {
        patients.removeFromConsultationList(patientId);
      } else {
        patients.removeFromTreatmentList(patientId);
      }
    }

    const canAssign = consultationRoomsHook.handleAssignPatientToRoom(patientId, roomId);
    if (!canAssign) return;

    const room = consultationRoomsHook.consultationRooms.find(r => r.id === roomId);

    // 진료내역: 진료 시작 (진료실 간 이동이 아닌 경우에만)
    if (sourceListType !== 'consultation_room') {
      await treatmentRecord.startConsultation(patientId, {
        location: room?.roomName,
        staffName: room?.doctorName,
      });
    }

    consultationRoomsHook.assignPatientToRoom(
      roomId,
      patientToAssign.id,
      patientToAssign.name,
      patientDetails
    );
  };

  // 접수 취소 (진료대기, 치료대기, 진료실에서 환자를 완전히 제거)
  const handleCancelRegistration = async (patientId: number) => {
    const confirmCancel = window.confirm('정말로 접수를 취소하시겠습니까?');
    if (!confirmCancel) return;

    // 진료 대기 목록에서 제거
    const inConsultation = patients.consultationWaitingList.find(p => p.id === patientId);
    if (inConsultation) {
      patients.removeFromConsultationList(patientId);
      alert(`${inConsultation.name}님의 접수가 취소되었습니다.`);
      return;
    }

    // 치료 대기 목록에서 제거
    const inTreatment = patients.treatmentWaitingList.find(p => p.id === patientId);
    if (inTreatment) {
      patients.removeFromTreatmentList(patientId);
      alert(`${inTreatment.name}님의 접수가 취소되었습니다.`);
      return;
    }

    // 진료실에서 제거
    const room = consultationRoomsHook.consultationRooms.find(r => r.patientId === patientId);
    if (room) {
      consultationRoomsHook.clearConsultationRoom(room.id);
      alert(`${room.patientName}님의 접수가 취소되었습니다.`);
      return;
    }

    alert('환자를 찾을 수 없습니다.');
  };

  // 접수정보 수정 (WaitingList 컴포넌트용)
  const handleEditConsultationInfo = (patient: Patient) => {
    setPatientForConsultationInfo(patient);
    openModal('consultationInfo', `${patient.name}님 접수 정보`, false);
  };

  // 치료정보 수정 (WaitingList 컴포넌트용)
  const handleEditTreatmentInfo = (patient: Patient) => {
    setPatientForTreatmentInfo(patient);
  };

  // 환자 카드 클릭 (WaitingList 컴포넌트용)
  const handlePatientCardClick = (patient: Patient) => {
    // 환자 카드 클릭 시 접수정보 수정 모달 오픈
    handleEditConsultationInfo(patient);
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

  // 치료대기에서 수납으로 이동 (WaitingList 컴포넌트용 래퍼)
  const handleMoveToPayment = (patientId: number, sourceList: 'consultation' | 'treatment') => {
    handleMovePatientToPayment(patientId, sourceList);
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
  const renderModalContent = (): React.ReactNode => {
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
      case 'payment':
        return <PaymentModal
          payment={selectedPayment}
          onClose={closeModal}
          onComplete={handleCompletePayment}
          uncoveredCategories={staffHook.uncoveredCategories}
          completedPayments={paymentsHook.completedPayments}
        />;
      case 'dailyPayments':
        return <DailyPaymentSummary onDatePickerRender={setModalHeaderExtra} />;
      case 'consultationInfo':
        return patientForConsultationInfo ? (
          <ConsultationInfoModal
            patient={patientForConsultationInfo}
            onSave={(patientId, details, memo) => {
              patients.updatePatientDetails(patientId, details, memo);
            }}
            onClose={closeModal}
          />
        ) : null;
      case 'patientSearch':
        return <PatientSearch
          allPatients={patients.activePatients}
          onSelectPatient={(patient) => {
            // 환자 선택 시 수납 히스토리 표시할 수 있도록 준비
            closeModal();
          }}
        />;
      case 'billingReview':
        return (
          <div className="p-8 text-center text-clinic-text-secondary">
            <i className="fa-solid fa-file-invoice-dollar text-4xl mb-4 block text-clinic-primary"></i>
            <p className="text-lg font-semibold mb-2">청구 검토</p>
            <p>청구 검토 기능이 준비 중입니다.</p>
          </div>
        );
      case 'chartingReview':
        return (
          <div className="p-8 text-center text-clinic-text-secondary">
            <i className="fa-solid fa-notes-medical text-4xl mb-4 block text-clinic-primary"></i>
            <p className="text-lg font-semibold mb-2">차팅 검토</p>
            <p>차팅 검토 기능이 준비 중입니다.</p>
          </div>
        );
      case 'stats':
        return <TreatmentStatsView />;
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
          consultationItems={consultationItemsHook.consultationItems}
          addConsultationItem={consultationItemsHook.addConsultationItem}
          updateConsultationItem={consultationItemsHook.updateConsultationItem}
          deleteConsultationItem={consultationItemsHook.deleteConsultationItem}
          reorderConsultationItems={consultationItemsHook.reorderConsultationItems}
          addSubItem={consultationItemsHook.addSubItem}
          updateSubItem={consultationItemsHook.updateSubItem}
          deleteSubItem={consultationItemsHook.deleteSubItem}
          reorderSubItems={consultationItemsHook.reorderSubItems}
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
        scalePercent={scalePercent}
        onIncreaseScale={increaseScale}
        onDecreaseScale={decreaseScale}
        onResetScale={resetScale}
        canIncrease={canIncrease}
        canDecrease={canDecrease}
      />

      <Routes>
        <Route path="/" element={
          <main className="flex-grow p-4 lg:p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 lg:gap-6 min-h-0" style={{ zoom: scale }}>
            {/* MSSQL 연결 상태 표시 */}
            {!mssqlQueue.isConnected && (
              <div className="col-span-full bg-yellow-50 border border-yellow-200 rounded-lg p-2 text-center text-sm text-yellow-700">
                <i className="fa-solid fa-plug-circle-xmark mr-2"></i>
                차트 프로그램 연결 대기 중...
              </div>
            )}

            {/* 1. 예약현황 */}
            <div className="flex flex-col min-h-0">
              <ReservationStatus />
            </div>

            {/* 2. 진료대기 */}
            <div className="flex flex-col min-h-0">
              <MssqlWaitingList
                title="진료 대기"
                icon="fa-solid fa-user-doctor"
                list={mssqlQueue.waiting}
                listType="waiting"
                formatWaitingTime={mssqlQueue.formatWaitingTime}
                getWaitingMinutes={mssqlQueue.getWaitingMinutes}
              />
            </div>

            {/* 3. 치료대기 */}
            <div className="flex flex-col min-h-0">
              <WaitingList
                title="치료 대기"
                icon="fa-solid fa-bed-pulse"
                list={patients.treatmentWaitingList}
                listType="treatment"
                onPatientClick={handlePatientCardClick}
                onPatientDrop={patients.handlePatientDrop}
                onMoveToPayment={handleMoveToPayment}
                onCancelRegistration={handleCancelRegistration}
                onEditConsultationInfo={handleEditConsultationInfo}
                onEditTreatmentInfo={handleEditTreatmentInfo}
              />
            </div>

            {/* 4. 치료실 현황 */}
            <div className="flex flex-col min-h-0">
              <TreatmentRoomStatus treatmentRooms={treatmentRoomsHook.treatmentRooms} allPatients={patients.allPatients} />
            </div>

            {/* 5. 수납및예약 */}
            <div className="flex flex-col min-h-0">
              <PaymentStatus
                payments={paymentsHook.paymentsWaiting}
                onPatientClick={handlePatientInfoClick}
                onReservationClick={handleOpenReservationForPatient}
                onMoveToWaiting={handleMovePatientFromPaymentToWaiting}
                onDelete={paymentsHook.deletePaymentFromWaiting}
                onMemoSave={paymentsHook.handleMemoSave}
              />
            </div>
          </main>
        } />
      </Routes>

      <Modal
        isOpen={modalType !== null}
        onClose={closeModal}
        title={modalTitle}
        wide={isModalWide}
        fullHeight={isModalFullHeight}
        fullScreen={isModalFullScreen}
        maxWidth={modalType === 'consultationInfo' ? '800px' : undefined}
        headerExtra={modalHeaderExtra}
      >
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

      {/* Payment Detail Modal (환자 정보 클릭 시 시술/치료비/수납 정보) */}
      <Modal
        isOpen={selectedPaymentForDetail !== null}
        onClose={() => setSelectedPaymentForDetail(null)}
        title={selectedPaymentForDetail ? `${selectedPaymentForDetail.patientName}님 오늘의 진료 정보` : ''}
        maxWidth="500px"
      >
        {selectedPaymentForDetail && (
          <div className="space-y-4 p-2">
            {/* 환자 기본 정보 + 수납 상태 */}
            <div className={`rounded-lg p-4 ${selectedPaymentForDetail.isPaid ? 'bg-green-50 border border-green-200' : 'bg-orange-50 border border-orange-200'}`}>
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-full text-white flex items-center justify-center text-lg font-bold ${selectedPaymentForDetail.isPaid ? 'bg-green-500' : 'bg-orange-500'}`}>
                  {selectedPaymentForDetail.isPaid ? (
                    <i className="fa-solid fa-check"></i>
                  ) : (
                    selectedPaymentForDetail.patientName.charAt(0)
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-lg">{selectedPaymentForDetail.patientName}</h3>
                    <span className="text-sm text-gray-500">({selectedPaymentForDetail.patientChartNumber || '-'})</span>
                    {selectedPaymentForDetail.insuranceType && (
                      <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                        selectedPaymentForDetail.insuranceType === '건보' ? 'bg-blue-100 text-blue-800' :
                        selectedPaymentForDetail.insuranceType === '자보' ? 'bg-purple-100 text-purple-800' :
                        selectedPaymentForDetail.insuranceType === '일반' ? 'bg-gray-100 text-gray-800' :
                        selectedPaymentForDetail.insuranceType === '임산부' ? 'bg-pink-100 text-pink-800' :
                        selectedPaymentForDetail.insuranceType === '산정특례' ? 'bg-red-100 text-red-800' :
                        selectedPaymentForDetail.insuranceType.includes('의료급여') ? 'bg-green-100 text-green-800' :
                        selectedPaymentForDetail.insuranceType === '차상위' ? 'bg-teal-100 text-teal-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {selectedPaymentForDetail.insuranceType}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                      selectedPaymentForDetail.isPaid
                        ? 'bg-green-200 text-green-800'
                        : 'bg-orange-200 text-orange-800'
                    }`}>
                      {selectedPaymentForDetail.isPaid ? '수납완료' : '수납대기'}
                    </span>
                    {selectedPaymentForDetail.unpaidAmount !== undefined && selectedPaymentForDetail.unpaidAmount > 0 && (
                      <span className="px-2 py-0.5 rounded text-xs font-semibold bg-red-200 text-red-800">
                        미수 {selectedPaymentForDetail.unpaidAmount.toLocaleString()}원
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* 시술 내역 */}
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-blue-50 px-4 py-2 border-b">
                <h4 className="font-semibold text-blue-800">
                  <i className="fa-solid fa-hand-holding-medical mr-2"></i>
                  오늘의 시술 내역
                </h4>
              </div>
              <div className="p-4">
                {selectedPaymentForDetail.details ? (
                  <div className="flex flex-wrap gap-2">
                    {selectedPaymentForDetail.details.split(', ').map((item, idx) => (
                      <span key={idx} className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                        {item}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-400 text-sm">시술 내역 없음</p>
                )}
              </div>
            </div>

            {/* 치료비 내역 */}
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-green-50 px-4 py-2 border-b">
                <h4 className="font-semibold text-green-800">
                  <i className="fa-solid fa-receipt mr-2"></i>
                  치료비 내역
                </h4>
              </div>
              <div className="p-4 space-y-2">
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-gray-600">급여 본인부담금</span>
                  <span className="font-semibold text-blue-600">
                    {(selectedPaymentForDetail.insuranceSelf || 0).toLocaleString()}원
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-gray-600">비급여</span>
                  <span className="font-semibold text-green-600">
                    {(selectedPaymentForDetail.generalAmount || 0).toLocaleString()}원
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 bg-gray-50 -mx-4 px-4">
                  <span className="font-bold">총 진료비</span>
                  <span className="font-bold text-lg">
                    {((selectedPaymentForDetail.insuranceSelf || 0) + (selectedPaymentForDetail.generalAmount || 0)).toLocaleString()}원
                  </span>
                </div>
              </div>
            </div>

            {/* 메모 입력/수정 */}
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-amber-50 px-4 py-2 border-b">
                <h4 className="font-semibold text-amber-800">
                  <i className="fa-solid fa-sticky-note mr-2"></i>
                  수납 메모
                </h4>
              </div>
              <div className="p-4 space-y-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">패키지 정보</label>
                  <input
                    type="text"
                    value={detailMemoPackageInfo}
                    onChange={(e) => setDetailMemoPackageInfo(e.target.value)}
                    placeholder="예: 다이어트 패키지 3회차"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-clinic-primary focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">오늘 메모</label>
                  <textarea
                    value={detailMemoText}
                    onChange={(e) => setDetailMemoText(e.target.value)}
                    placeholder="예: 카드 결제 불가로 현금 수납, 다음 예약 시 확인 필요"
                    rows={3}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-clinic-primary focus:border-transparent resize-none"
                  />
                </div>
              </div>
            </div>

            {/* 버튼 영역 */}
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setSelectedPaymentForDetail(null)}
                className="px-4 py-2 text-gray-600 font-medium rounded-md hover:bg-gray-100"
              >
                닫기
              </button>
              <button
                onClick={handleDetailMemoSave}
                disabled={isDetailMemoSaving}
                className="px-4 py-2 bg-clinic-primary text-white font-semibold rounded-md hover:bg-clinic-secondary disabled:opacity-50"
              >
                {isDetailMemoSaving ? '저장 중...' : '메모 저장'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Patient Treatment Info Modal (환자 치료 정보 편집) */}
      {patientForTreatmentInfo && (
        <PatientTreatmentInfoModal
          patient={patientForTreatmentInfo}
          onClose={() => setPatientForTreatmentInfo(null)}
          onSaved={() => {
            // 치료 정보 저장 후 필요한 처리
            console.log('치료 정보 저장됨');
          }}
        />
      )}
    </div>
  );
};

export default ManageApp;
