import { useState, useEffect, useCallback, useRef } from 'react';
import { TreatmentRoom } from '../types';
import * as api from '../lib/api';

// Polling 간격 (밀리초)
const POLLING_INTERVAL = 5000;
// DB 저장 완료 후 폴링 무시 시간 (DB 저장이 느릴 수 있으므로 충분히 여유있게)
const IGNORE_POLLING_MS = 4000;

export const useTreatmentRooms = (currentUser: any) => {
  const [treatmentRooms, setTreatmentRooms] = useState<TreatmentRoom[]>([]);
  const roomsRef = useRef<Map<number, TreatmentRoom>>(new Map());
  const lastLocalUpdateRef = useRef<number>(0);

  // 치료실 데이터 로드 함수
  const loadTreatmentRooms = useCallback(async () => {
    const timeSinceLastUpdate = Date.now() - lastLocalUpdateRef.current;
    if (timeSinceLastUpdate < IGNORE_POLLING_MS) {
      return;
    }

    try {
      const roomsData = await api.fetchTreatmentRooms();

      roomsRef.current.clear();
      roomsData.forEach(room => roomsRef.current.set(room.id, room));

      setTreatmentRooms(roomsData);
    } catch (error) {
      console.error('❌ 치료실 데이터 로드 오류:', error);
    }
  }, []);

  // 초기 치료실 데이터 로드
  useEffect(() => {
    if (!currentUser) return;
    loadTreatmentRooms();
  }, [currentUser, loadTreatmentRooms]);

  // Polling으로 실시간 업데이트 대체
  useEffect(() => {
    if (!currentUser) return;

    const intervalId = setInterval(() => {
      loadTreatmentRooms();
    }, POLLING_INTERVAL);

    return () => {
      clearInterval(intervalId);
    };
  }, [currentUser, loadTreatmentRooms]);

  const updateSingleRoom = useCallback((roomId: number, updateFn: (room: TreatmentRoom) => TreatmentRoom) => {
    lastLocalUpdateRef.current = Date.now();

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
    lastLocalUpdateRef.current = Date.now();

    roomsRef.current.clear();
    updatedRooms.forEach(room => roomsRef.current.set(room.id, room));

    setTreatmentRooms(updatedRooms);
  }, []);

  const saveTreatmentRoomToDB = useCallback(async (roomId: number, room: TreatmentRoom) => {
    lastLocalUpdateRef.current = Date.now();

    try {
      await api.updateTreatmentRoom(roomId, room);
      // DB 저장 완료 후에도 타임스탬프 갱신 (폴링이 완료된 DB 데이터를 덮어쓰지 않도록)
      lastLocalUpdateRef.current = Date.now();
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
