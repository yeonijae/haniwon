import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import type { PortalUser } from '@shared/types';
import { Patient, DefaultTreatment, TreatmentRoom } from './types';
import { useTreatmentRooms } from './hooks/useTreatmentRooms';
import { useTreatmentItems } from './hooks/useTreatmentItems';
import TreatmentView from './components/TreatmentView';
import TreatmentItemsManagement from './components/TreatmentItemsManagement';
import * as api from './lib/api';
import { useTreatmentRecord } from '@shared/hooks/useTreatmentRecord';

interface TreatmentAppProps {
  user: PortalUser;
}

function TreatmentApp({ user }: TreatmentAppProps) {
  const navigate = useNavigate();
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // State hooks
  const {
    treatmentRooms,
    handleUpdateTreatmentRooms,
    saveTreatmentRoomToDB,
  } = useTreatmentRooms(user);

  const {
    treatmentItems,
    addTreatmentItem,
    updateTreatmentItem,
    deleteTreatmentItem,
    reorderTreatmentItems,
  } = useTreatmentItems(user);

  // Treatment Record (진료내역 타임라인)
  const treatmentRecordHook = useTreatmentRecord();

  // Waiting list state
  const [waitingList, setWaitingList] = useState<Patient[]>([]);
  const [allPatients, setAllPatients] = useState<Patient[]>([]);
  const lastLocalUpdateRef = useRef<number>(0);
  const IGNORE_SUBSCRIPTION_MS = 4000; // DB 저장 완료까지 충분한 시간

  // Load waiting list function (reusable)
  const loadWaitingList = useCallback(async () => {
    try {
      const queueItems = await api.fetchWaitingQueue('treatment');
      const patientsWithDetails = await Promise.all(
        queueItems.map(async (item) => {
          const patient = await api.fetchPatientById(item.patient_id);
          if (patient) {
            const defaultTreatments = await api.fetchPatientDefaultTreatments(item.patient_id);
            return {
              ...patient,
              details: item.details,
              time: item.created_at ? new Date(item.created_at + 'Z').toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }) : '',
              defaultTreatments,
              doctor: item.doctor,
            };
          }
          return null;
        })
      );
      setWaitingList(patientsWithDetails.filter((p): p is NonNullable<typeof p> => p !== null) as Patient[]);
    } catch (error) {
      console.error('대기 목록 로드 오류:', error);
    }
  }, []);

  // Load waiting list on mount
  useEffect(() => {
    if (user) {
      loadWaitingList();
    }
  }, [user, loadWaitingList]);

  // Polling for waiting_queue changes (5초마다)
  useEffect(() => {
    if (!user) return;

    const POLLING_INTERVAL = 5000;

    const reloadWaitingList = async () => {
      // 자기 자신이 일으킨 변경은 무시 (로컬 업데이트 후 일정 시간 이내)
      const timeSinceLastUpdate = Date.now() - lastLocalUpdateRef.current;
      if (timeSinceLastUpdate < IGNORE_SUBSCRIPTION_MS) {
        return;
      }
      await loadWaitingList();
    };

    const intervalId = setInterval(reloadWaitingList, POLLING_INTERVAL);

    return () => {
      clearInterval(intervalId);
    };
  }, [user, loadWaitingList]);

  // Navigation
  const handleNavigateBack = useCallback(() => {
    window.close();
  }, []);

  const handleOpenSettings = useCallback(() => {
    setShowSettingsModal(true);
  }, []);

  const handleCloseSettings = useCallback(() => {
    setShowSettingsModal(false);
  }, []);

  // Waiting list handlers
  const handleRemoveFromWaitingList = useCallback(async (patientId: number) => {
    // 낙관적 업데이트: UI를 먼저 업데이트하고 API 호출은 백그라운드에서
    lastLocalUpdateRef.current = Date.now();
    setWaitingList(prev => prev.filter(p => p.id !== patientId));

    // 백그라운드에서 API 호출 (실패해도 UI는 이미 업데이트됨)
    api.removeFromWaitingQueue(patientId, 'treatment')
      .then(() => {
        lastLocalUpdateRef.current = Date.now();
      })
      .catch(error => {
        console.error('대기 목록 제거 오류:', error);
        // 실패 시 다음 폴링에서 복구됨
      });
  }, []);

  const handleAddToWaitingList = useCallback(async (patient: Patient) => {
    try {
      lastLocalUpdateRef.current = Date.now();
      await api.addToWaitingQueue({
        patient_id: patient.id,
        queue_type: 'treatment',
        details: patient.details || '',
        position: waitingList.length,
        doctor: patient.doctor,
      });
      // DB에서 최신 기본치료 정보 및 환자 설정 가져오기
      const [defaultTreatments, patientData] = await Promise.all([
        api.fetchPatientDefaultTreatments(patient.id),
        api.fetchPatientById(patient.id),
      ]);
      const patientWithDefaults = {
        ...patient,
        defaultTreatments,
        treatmentClothing: patientData?.treatmentClothing,
        treatmentNotes: patientData?.treatmentNotes,
      };
      setWaitingList(prev => [...prev, patientWithDefaults]);
      lastLocalUpdateRef.current = Date.now(); // DB 작업 완료 후 갱신
    } catch (error) {
      console.error('대기 목록 추가 오류:', error);
    }
  }, [waitingList.length]);

  const handleMovePatientToPayment = useCallback(async (patientId: number) => {
    try {
      // 진료내역: 치료 종료 + 수납 대기 시작
      await treatmentRecordHook.endTreatment(patientId);
      await treatmentRecordHook.startWaitingPayment(patientId);

      await api.createPayment(patientId);
      console.log(`✅ 환자 ${patientId} 수납 대기 추가 완료`);
    } catch (error) {
      console.error('❌ 수납 대기 추가 오류:', error);
      alert('수납 대기 추가 중 오류가 발생했습니다.');
    }
  }, [treatmentRecordHook]);

  const handleUpdatePatientDefaultTreatments = useCallback(async (patientId: number, treatments: DefaultTreatment[], settings?: { clothing?: string; notes?: string }) => {
    try {
      await api.savePatientDefaultTreatments(patientId, treatments);
      // 환자복/주의사항 설정도 저장
      if (settings) {
        await api.savePatientTreatmentSettings(patientId, settings);
      }
      // Update local state
      setWaitingList(prev => prev.map(p =>
        p.id === patientId ? { ...p, defaultTreatments: treatments, treatmentClothing: settings?.clothing, treatmentNotes: settings?.notes } : p
      ));
      setAllPatients(prev => prev.map(p =>
        p.id === patientId ? { ...p, defaultTreatments: treatments, treatmentClothing: settings?.clothing, treatmentNotes: settings?.notes } : p
      ));
    } catch (error) {
      console.error('기본 치료 저장 오류:', error);
    }
  }, []);

  // 치료 시작 이벤트 핸들러
  const handleTreatmentStart = useCallback(async (patientId: number, roomName: string) => {
    await treatmentRecordHook.startTreatment(patientId, { location: roomName });
  }, [treatmentRecordHook]);

  return (
    <div className="h-screen bg-gray-50 overflow-hidden">
      <TreatmentView
        treatmentRooms={treatmentRooms}
        waitingList={waitingList}
        onNavigateBack={handleNavigateBack}
        onNavigateToSettings={handleOpenSettings}
        onUpdateRooms={handleUpdateTreatmentRooms}
        onSaveRoomToDB={saveTreatmentRoomToDB}
        onUpdateWaitingList={setWaitingList}
        onRemoveFromWaitingList={handleRemoveFromWaitingList}
        onAddToWaitingList={handleAddToWaitingList}
        onMovePatientToPayment={handleMovePatientToPayment}
        allPatients={allPatients}
        onUpdatePatientDefaultTreatments={handleUpdatePatientDefaultTreatments}
        treatmentItems={treatmentItems}
        onTreatmentStart={handleTreatmentStart}
      />

      {/* 설정 모달 */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
            <TreatmentItemsManagement
              treatmentItems={treatmentItems}
              addTreatmentItem={addTreatmentItem}
              updateTreatmentItem={updateTreatmentItem}
              deleteTreatmentItem={deleteTreatmentItem}
              reorderTreatmentItems={reorderTreatmentItems}
              onNavigateBack={handleCloseSettings}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default TreatmentApp;
