import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import type { PortalUser } from '@shared/types';
import { Patient, DefaultTreatment, TreatmentRoom } from './types';
import { useTreatmentRooms } from './hooks/useTreatmentRooms';
import { useTreatmentItems } from './hooks/useTreatmentItems';
import TreatmentView from './components/TreatmentView';
import ActingManagementView from './components/ActingManagementView';
import TreatmentItemsManagement from './components/TreatmentItemsManagement';
import * as api from './lib/api';
import { useTreatmentRecord } from '@shared/hooks/useTreatmentRecord';

interface TreatmentAppProps {
  user: PortalUser;
}

type ViewType = 'treatment' | 'acting' | 'settings';

function TreatmentApp({ user }: TreatmentAppProps) {
  const navigate = useNavigate();
  const [currentView, setCurrentView] = useState<ViewType>('treatment');

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
              time: item.created_at ? new Date(item.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }) : '',
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

  const handleNavigateToActing = useCallback(() => {
    setCurrentView('acting');
  }, []);

  const handleNavigateToTreatment = useCallback(() => {
    setCurrentView('treatment');
  }, []);

  const handleNavigateToSettings = useCallback(() => {
    setCurrentView('settings');
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
      setWaitingList(prev => [...prev, patient]);
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

  const handleUpdatePatientDefaultTreatments = useCallback(async (patientId: number, treatments: DefaultTreatment[]) => {
    try {
      await api.savePatientDefaultTreatments(patientId, treatments);
      // Update local state
      setWaitingList(prev => prev.map(p =>
        p.id === patientId ? { ...p, defaultTreatments: treatments } : p
      ));
      setAllPatients(prev => prev.map(p =>
        p.id === patientId ? { ...p, defaultTreatments: treatments } : p
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
    <div className="min-h-screen bg-gray-50">
      {/* Header with view toggle */}
      <div className="bg-white border-b px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-clinic-text-primary">치료관리</h1>
          <div className="flex gap-2">
            <button
              onClick={handleNavigateToTreatment}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                currentView === 'treatment'
                  ? 'bg-clinic-primary text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              치료실
            </button>
            <button
              onClick={handleNavigateToActing}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                currentView === 'acting'
                  ? 'bg-clinic-primary text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              액팅관리
            </button>
            <button
              onClick={handleNavigateToSettings}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                currentView === 'settings'
                  ? 'bg-clinic-primary text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              설정
            </button>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">{user.name}님</span>
          <button
            onClick={handleNavigateBack}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            닫기
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="h-[calc(100vh-60px)] overflow-y-auto">
        {currentView === 'treatment' && (
          <TreatmentView
            treatmentRooms={treatmentRooms}
            waitingList={waitingList}
            onNavigateBack={handleNavigateBack}
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
        )}
        {currentView === 'acting' && (
          <ActingManagementView
            treatmentRooms={treatmentRooms}
            allPatients={allPatients}
          />
        )}
        {currentView === 'settings' && (
          <TreatmentItemsManagement
            treatmentItems={treatmentItems}
            addTreatmentItem={addTreatmentItem}
            updateTreatmentItem={updateTreatmentItem}
            deleteTreatmentItem={deleteTreatmentItem}
            reorderTreatmentItems={reorderTreatmentItems}
          />
        )}
      </div>
    </div>
  );
}

export default TreatmentApp;
