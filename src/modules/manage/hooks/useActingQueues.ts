import { useState } from 'react';
import { ActingQueueState, Acting, ActingType, TreatmentRoom } from '../types';
import { DOCTORS } from '../constants';

const INITIAL_ACTING_QUEUES: ActingQueueState = {
  '김원장': [
    { id: 'act-temp-1', patientId: 9, patientName: '박서준', type: '침', duration: 15, source: 'manual' },
    { id: 'act-temp-2', patientId: 10, patientName: '한지민', type: '추나', duration: 20, source: 'manual' },
    { id: 'act-temp-3', patientId: 2, patientName: '이서연', type: '약상담', duration: 25, source: 'manual' },
    { id: 'act-temp-9', patientId: 1, patientName: '김민준', type: '침', duration: 15, source: 'manual' },
  ],
  '강원장': [
    { id: 'act-temp-4', patientId: 8, patientName: '송예나', type: '약상담', duration: 30, source: 'manual' },
    { id: 'act-temp-5', patientId: 6, patientName: '윤채원', type: '초진', duration: 30, source: 'manual' },
    { id: 'act-temp-10', patientId: 5, patientName: '정시우', type: '향기', duration: 5, source: 'manual' },
    { id: 'act-temp-11', patientId: 7, patientName: '강지호', type: '습부', duration: 10, source: 'manual' },
  ],
  '임원장': [
    { id: 'act-temp-6', patientId: 4, patientName: '최지우', type: '초음파', duration: 10, source: 'manual' },
    { id: 'act-temp-7', patientId: 3, patientName: '박하준', type: '침', duration: 15, source: 'manual' },
    { id: 'act-temp-8', patientId: 11, patientName: '조은서', type: '기타', duration: 5, source: 'manual' },
    { id: 'act-temp-12', patientId: 12, patientName: '임도윤', type: '대기', duration: 0, source: 'manual' },
  ],
  '전원장': [
    { id: 'act-temp-13', patientId: 13, patientName: '신유준', type: '침', duration: 15, source: 'manual' },
    { id: 'act-temp-14', patientId: 14, patientName: '김철수', type: '추나', duration: 20, source: 'manual' },
    { id: 'act-temp-15', patientId: 15, patientName: '박영희', type: '초음파', duration: 10, source: 'manual' },
  ],
};

export const useActingQueues = () => {
  const [actingQueues, setActingQueues] = useState<ActingQueueState>(INITIAL_ACTING_QUEUES);

  const handleCompleteActing = (
    doctorId: string,
    actingId: string,
    treatmentRooms: TreatmentRoom[],
    onUpdateTreatmentRooms: (rooms: TreatmentRoom[]) => void
  ) => {
    const actingQueue = actingQueues[doctorId];
    const acting = actingQueue.find(a => a.id === actingId);

    if (!acting) return;

    if (!window.confirm(`${acting.patientName}님의 '${acting.type}' 액팅을 완료하고 대기열에서 제거하시겠습니까?`)) {
      return;
    }

    if (acting.type === '침') {
      const patientRoom = treatmentRooms.find(r => r.patientId === acting.patientId);
      if (!patientRoom) {
        alert("해당 환자가 배정된 치료실을 찾을 수 없습니다. 치료실에 먼저 배정해주세요.");
        return;
      }

      const treatmentToStart = patientRoom.sessionTreatments.find(
        t => t.name === '침' && t.status !== 'running' && t.status !== 'completed'
      );
      if (!treatmentToStart) {
        alert("해당 환자의 '침' 치료 항목을 찾을 수 없거나 이미 진행중/완료 상태입니다.");
        return;
      }

      // 치료 시작
      const updatedRooms = treatmentRooms.map(room => {
        if (room.id === patientRoom.id) {
          const newTreatments = room.sessionTreatments.map(tx => {
            if (tx.id === treatmentToStart.id) {
              return { ...tx, status: 'running' as const, startTime: new Date().toISOString(), elapsedSeconds: 0 };
            }
            return tx;
          });
          return { ...room, sessionTreatments: newTreatments };
        }
        return room;
      });
      onUpdateTreatmentRooms(updatedRooms);
    }

    // 액팅 큐에서 제거
    setActingQueues(prevQueues => ({
      ...prevQueues,
      [doctorId]: prevQueues[doctorId].filter(a => a.id !== actingId)
    }));
  };

  const addActing = (doctorId: string, type: '대기' | '초진' | '상담') => {
    let patientName: string;
    let duration: number;
    let actingType: ActingType;

    switch (type) {
      case '초진':
        patientName = '';
        duration = 30;
        actingType = '초진';
        break;
      case '상담':
        patientName = '';
        duration = 25;
        actingType = '약상담';
        break;
      case '대기':
        patientName = '';
        duration = 0;
        actingType = '대기';
        break;
      default:
        return;
    }

    const newActing: Acting = {
      id: `act-manual-${Date.now()}`,
      patientId: -1,
      patientName: patientName,
      type: actingType,
      duration: duration,
      source: 'manual',
    };

    setActingQueues(prevQueues => {
      const newQueues = { ...prevQueues };
      const currentQueue = newQueues[doctorId] || [];
      newQueues[doctorId] = [newActing, ...currentQueue];
      return newQueues;
    });
  };

  const deleteActing = (doctorId: string, actingId: string) => {
    setActingQueues(prev => ({
      ...prev,
      [doctorId]: prev[doctorId].filter(a => a.id !== actingId)
    }));
  };

  const updateActing = (doctorId: string, actingId: string, updatedData: { patientName: string; duration: number; memo: string; }) => {
    setActingQueues(prev => ({
      ...prev,
      [doctorId]: prev[doctorId].map(a =>
        a.id === actingId ? { ...a, ...updatedData } : a
      )
    }));
  };

  const addActingFromReservation = (doctor: string, newActings: Acting[]) => {
    if (DOCTORS.includes(doctor) && newActings.length > 0) {
      setActingQueues(prev => ({
        ...prev,
        [doctor]: [...(prev[doctor] || []), ...newActings]
      }));
    }
  };

  const addActingForNewPatient = (doctor: string, newActing: Acting) => {
    if (doctor && DOCTORS.includes(doctor)) {
      setActingQueues(prev => ({
        ...prev,
        [doctor]: [...(prev[doctor] || []), newActing]
      }));
    }
  };

  return {
    actingQueues,
    setActingQueues,
    handleCompleteActing,
    addActing,
    deleteActing,
    updateActing,
    addActingFromReservation,
    addActingForNewPatient,
  };
};
