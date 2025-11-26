import { useState } from 'react';
import { ActingQueueState, Acting, ActingType, TreatmentRoom } from '../types';
import { DOCTORS } from '../constants';

const INITIAL_ACTING_QUEUES: ActingQueueState = {
  '김원장': [],
  '강원장': [],
  '임원장': [],
  '전원장': [],
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
