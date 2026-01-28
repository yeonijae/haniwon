import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useDocumentTitle } from '@shared/hooks/useDocumentTitle';
import { useNavigate } from 'react-router-dom';
import type { PortalUser } from '@shared/types';
import { Patient, DefaultTreatment, TreatmentRoom } from './types';
import { useTreatmentRooms } from './hooks/useTreatmentRooms';
import { useTreatmentItems } from './hooks/useTreatmentItems';
import TreatmentView from './components/TreatmentView';
import TreatmentItemsManagement from './components/TreatmentItemsManagement';
import * as api from './lib/api';
import { useTreatmentRecord } from '@shared/hooks/useTreatmentRecord';
import { useSSE, SSEMessage } from '@shared/hooks/useSSE';

interface TreatmentAppProps {
  user: PortalUser;
}

function TreatmentApp({ user }: TreatmentAppProps) {
  useDocumentTitle('치료관리');
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
  const IGNORE_SUBSCRIPTION_MS = 500; // 로컬 업데이트 후 SSE 무시 시간
  const FALLBACK_POLLING_INTERVAL = 5000; // SSE 실패 시 폴백 폴링 간격

  // Load waiting list function (reusable)
  // daily_treatment_records에서 status='waiting' 환자 조회
  const loadWaitingList = useCallback(async () => {
    try {
      console.log('[loadWaitingList] 대기목록 로드 시작...');
      const records = await api.fetchTodayTreatments('waiting');
      console.log('[loadWaitingList] 서버에서 받은 레코드:', records.length, '개');
      const patientsWithDetails = await Promise.all(
        records.map(async (record) => {
          // PostgreSQL patients 테이블에서 조회 시도
          const patient = await api.fetchPatientById(record.patient_id);

          // 시간 계산: mssql_intotime 또는 reception_time 우선
          const timeSource = record.mssql_intotime || record.reception_time || record.created_at;
          const time = timeSource
            ? new Date(timeSource).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })
            : '';

          if (patient) {
            // PostgreSQL에 환자 정보가 있으면 사용
            const defaultTreatments = await api.fetchPatientDefaultTreatments(record.patient_id);
            return {
              ...patient,
              details: '',
              time,
              defaultTreatments,
              doctor: record.doctor_name,
              treatmentRecordId: record.id,
            };
          } else if (record.patient_name) {
            // MSSQL 동기화 데이터 사용 (PostgreSQL에 환자 없는 경우)
            const sex = record.patient_sex;
            return {
              id: record.patient_id,
              name: record.patient_name,
              chartNumber: record.chart_number,
              time,
              status: 'waiting' as const,
              details: '',
              gender: sex === 'M' ? 'male' : sex === 'F' ? 'female' : undefined,
              doctor: record.doctor_name,
              defaultTreatments: [],
              treatmentRecordId: record.id,
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

  // SSE 메시지 핸들러 (waiting_queue 변경 감지)
  const handleSSEMessage = useCallback((message: SSEMessage) => {
    console.log('[SSE] 메시지 수신:', message);
    if (message.table === 'daily_treatment_records' || message.table === 'waiting_queue') {
      // 자기 자신이 일으킨 변경은 무시
      const timeSinceLastUpdate = Date.now() - lastLocalUpdateRef.current;
      if (timeSinceLastUpdate < IGNORE_SUBSCRIPTION_MS) {
        console.log('[SSE] 로컬 업데이트 직후라 무시함 (', timeSinceLastUpdate, 'ms ago)');
        return;
      }
      console.log('[SSE] 대기목록 변경 감지, loadWaitingList() 호출:', message);
      loadWaitingList();
    }
  }, [loadWaitingList]);

  const handleSSEConnect = useCallback(() => {
    console.log('[SSE] 대기목록 실시간 연결됨');
  }, []);

  const handleSSEDisconnect = useCallback(() => {
    console.log('[SSE] 대기목록 연결 끊김');
  }, []);

  // SSE 실시간 구독
  const { isConnected: sseConnected } = useSSE({
    enabled: !!user,
    onMessage: handleSSEMessage,
    onConnect: handleSSEConnect,
    onDisconnect: handleSSEDisconnect,
  });

  // SSE 연결 실패 시 폴백 폴링
  useEffect(() => {
    if (!user || sseConnected) return;

    console.log('[Polling] SSE 연결 안됨, 대기목록 폴백 폴링 시작');
    const intervalId = setInterval(() => {
      const timeSinceLastUpdate = Date.now() - lastLocalUpdateRef.current;
      if (timeSinceLastUpdate >= IGNORE_SUBSCRIPTION_MS) {
        loadWaitingList();
      }
    }, FALLBACK_POLLING_INTERVAL);

    return () => {
      clearInterval(intervalId);
    };
  }, [user, sseConnected, loadWaitingList]);

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
