import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import type { PortalUser } from '@shared/types';
import { supabase } from '@shared/lib/supabase';
import { Patient, DefaultTreatment, TreatmentRoom, Acting, ActingQueueState } from './types';
import { useTreatmentRooms } from './hooks/useTreatmentRooms';
import { useTreatmentItems } from './hooks/useTreatmentItems';
import { useActingQueues } from './hooks/useActingQueues';
import TreatmentView from './components/TreatmentView';
import ActingManagementView from './components/ActingManagementView';
import * as api from './lib/api';
import { useTreatmentRecord } from '@shared/hooks/useTreatmentRecord';

interface TreatmentAppProps {
  user: PortalUser;
}

type ViewType = 'treatment' | 'acting';

function TreatmentApp({ user }: TreatmentAppProps) {
  const navigate = useNavigate();
  const [currentView, setCurrentView] = useState<ViewType>('treatment');

  // State hooks
  const {
    treatmentRooms,
    handleUpdateTreatmentRooms,
    saveTreatmentRoomToDB,
  } = useTreatmentRooms(user);

  const { treatmentItems } = useTreatmentItems(user);

  const {
    actingQueues,
    setActingQueues,
    handleCompleteActing,
    addActing,
    deleteActing,
    updateActing,
  } = useActingQueues();

  // Treatment Record (진료내역 타임라인)
  const treatmentRecordHook = useTreatmentRecord();

  // Waiting list state
  const [waitingList, setWaitingList] = useState<Patient[]>([]);
  const [allPatients, setAllPatients] = useState<Patient[]>([]);
  const lastLocalUpdateRef = useRef<number>(0);
  const IGNORE_SUBSCRIPTION_MS = 2000;

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

  // Real-time subscription for waiting_queue changes
  useEffect(() => {
    if (!user) return;

    const reloadWaitingList = async () => {
      // 자기 자신이 일으킨 변경은 무시 (로컬 업데이트 후 일정 시간 이내)
      const timeSinceLastUpdate = Date.now() - lastLocalUpdateRef.current;
      if (timeSinceLastUpdate < IGNORE_SUBSCRIPTION_MS) {
        return;
      }
      await loadWaitingList();
    };

    const waitingQueueSubscription = supabase
      .channel('treatment-waiting-queue-changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'waiting_queue' },
        reloadWaitingList
      )
      .subscribe();

    return () => {
      supabase.removeChannel(waitingQueueSubscription);
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

  // Waiting list handlers
  const handleRemoveFromWaitingList = useCallback(async (patientId: number) => {
    try {
      lastLocalUpdateRef.current = Date.now();
      await api.removeFromWaitingQueue(patientId, 'treatment');
      setWaitingList(prev => prev.filter(p => p.id !== patientId));
    } catch (error) {
      console.error('대기 목록 제거 오류:', error);
    }
  }, []);

  const handleAddToWaitingList = useCallback(async (patient: Patient) => {
    try {
      lastLocalUpdateRef.current = Date.now();
      await api.addToWaitingQueue({
        patient_id: patient.id,
        queue_type: 'treatment',
        details: patient.details || '',
        position: waitingList.length,
      });
      setWaitingList(prev => [...prev, patient]);
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

  // Acting handlers
  const handleCompleteActingWithRooms = useCallback((doctorId: string, actingId: string) => {
    handleCompleteActing(doctorId, actingId, treatmentRooms, handleUpdateTreatmentRooms);
  }, [handleCompleteActing, treatmentRooms, handleUpdateTreatmentRooms]);

  const handleEditActing = useCallback((doctorId: string, acting: Acting) => {
    const patientName = prompt('환자 이름:', acting.patientName) || acting.patientName;
    const duration = parseInt(prompt('소요 시간(분):', String(acting.duration)) || String(acting.duration), 10);
    const memo = prompt('메모:', acting.memo || '') || '';

    updateActing(doctorId, acting.id, { patientName, duration, memo });
  }, [updateActing]);

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
      <div className="h-[calc(100vh-60px)]">
        {currentView === 'treatment' ? (
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
        ) : (
          <ActingManagementView
            actingQueues={actingQueues}
            onQueueUpdate={setActingQueues}
            onNavigateBack={handleNavigateToTreatment}
            treatmentRooms={treatmentRooms}
            allPatients={allPatients}
            onCompleteActing={handleCompleteActingWithRooms}
            onAddActing={addActing}
            onDeleteActing={deleteActing}
            onEditActing={handleEditActing}
          />
        )}
      </div>
    </div>
  );
}

export default TreatmentApp;
