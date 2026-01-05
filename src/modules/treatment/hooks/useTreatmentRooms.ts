import { useState, useEffect, useCallback, useRef } from 'react';
import { TreatmentRoom } from '../types';
import * as api from '../lib/api';
import { useSSE, SSEMessage } from '@shared/hooks/useSSE';

// 로컬 업데이트 후 해당 룸의 SSE 데이터를 무시할 시간
const ROOM_UPDATE_GRACE_PERIOD = 3000;
// SSE 실패 시 폴백 폴링 간격
const FALLBACK_POLLING_INTERVAL = 5000;

export const useTreatmentRooms = (currentUser: any) => {
  const [treatmentRooms, setTreatmentRooms] = useState<TreatmentRoom[]>([]);
  const roomsRef = useRef<Map<number, TreatmentRoom>>(new Map());
  // 각 룸별 마지막 업데이트 시간 추적
  const roomUpdateTimesRef = useRef<Map<number, number>>(new Map());

  // 치료실 데이터 로드 함수 (스마트 병합)
  const loadTreatmentRooms = useCallback(async () => {
    try {
      const roomsData = await api.fetchTreatmentRooms();
      const now = Date.now();

      setTreatmentRooms(prev => {
        // 각 룸에 대해 스마트 병합
        return roomsData.map(dbRoom => {
          const lastUpdateTime = roomUpdateTimesRef.current.get(dbRoom.id) || 0;
          const timeSinceUpdate = now - lastUpdateTime;

          // 최근에 로컬에서 업데이트된 룸은 로컬 상태 유지
          if (timeSinceUpdate < ROOM_UPDATE_GRACE_PERIOD) {
            const localRoom = prev.find(r => r.id === dbRoom.id);
            if (localRoom) {
              return localRoom;
            }
          }

          return dbRoom;
        });
      });

      // roomsRef 업데이트
      roomsRef.current.clear();
      roomsData.forEach(room => roomsRef.current.set(room.id, room));
    } catch (error) {
      console.error('❌ 치료실 데이터 로드 오류:', error);
    }
  }, []);

  // 초기 치료실 데이터 로드
  useEffect(() => {
    if (!currentUser) return;
    loadTreatmentRooms();
  }, [currentUser, loadTreatmentRooms]);

  // SSE 메시지 핸들러
  const handleSSEMessage = useCallback((message: SSEMessage) => {
    // treatment_rooms 또는 session_treatments 변경 시 데이터 리로드
    if (message.table === 'treatment_rooms' || message.table === 'session_treatments') {
      console.log('[SSE] 치료실 데이터 변경 감지:', message);
      loadTreatmentRooms();
    }
  }, [loadTreatmentRooms]);

  // SSE 실시간 구독
  const { isConnected: sseConnected } = useSSE({
    enabled: !!currentUser,
    onMessage: handleSSEMessage,
    onConnect: () => console.log('[SSE] 치료실 실시간 연결됨'),
    onDisconnect: () => console.log('[SSE] 치료실 연결 끊김'),
  });

  // SSE 연결 실패 시 폴백 폴링
  useEffect(() => {
    if (!currentUser || sseConnected) return;

    console.log('[Polling] SSE 연결 안됨, 폴백 폴링 시작');
    const intervalId = setInterval(() => {
      loadTreatmentRooms();
    }, FALLBACK_POLLING_INTERVAL);

    return () => {
      clearInterval(intervalId);
    };
  }, [currentUser, sseConnected, loadTreatmentRooms]);

  const updateSingleRoom = useCallback((roomId: number, updateFn: (room: TreatmentRoom) => TreatmentRoom) => {
    // 해당 룸의 업데이트 시간 기록
    roomUpdateTimesRef.current.set(roomId, Date.now());

    setTreatmentRooms(prev => {
      const roomIndex = prev.findIndex(r => r.id === roomId);
      if (roomIndex === -1) return prev;

      const updatedRoom = updateFn(prev[roomIndex]);
      const newRooms = [...prev];
      newRooms[roomIndex] = updatedRoom;

      roomsRef.current.set(roomId, updatedRoom);

      return newRooms;
    });
  }, []);

  const handleUpdateTreatmentRooms = useCallback(async (updatedRooms: TreatmentRoom[]) => {
    const now = Date.now();
    // 변경된 모든 룸의 업데이트 시간 기록
    updatedRooms.forEach(room => {
      roomUpdateTimesRef.current.set(room.id, now);
    });

    roomsRef.current.clear();
    updatedRooms.forEach(room => roomsRef.current.set(room.id, room));

    setTreatmentRooms(updatedRooms);
  }, []);

  const saveTreatmentRoomToDB = useCallback(async (roomId: number, room: TreatmentRoom) => {
    // 해당 룸의 업데이트 시간 기록
    roomUpdateTimesRef.current.set(roomId, Date.now());

    try {
      await api.updateTreatmentRoom(roomId, room);
      // DB 저장 완료 후에도 시간 갱신
      roomUpdateTimesRef.current.set(roomId, Date.now());
    } catch (error) {
      console.error('❌ 치료실 DB 저장 오류:', error);
    }
  }, []);

  return {
    treatmentRooms,
    setTreatmentRooms,
    handleUpdateTreatmentRooms,
    saveTreatmentRoomToDB,
    updateSingleRoom,
    roomsRef,
  };
};
