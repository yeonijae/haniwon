import { useState, useEffect, useCallback, useRef } from 'react';
import { TreatmentRoom } from '../types';
import * as api from '../lib/api';

// Polling 간격 (밀리초)
const POLLING_INTERVAL = 2000;

export const useTreatmentRooms = (currentUser: any) => {
  const [treatmentRooms, setTreatmentRooms] = useState<TreatmentRoom[]>([]);
  // 개별 룸 업데이트를 위한 ref (배열 전체를 갱신하지 않고 특정 룸만 업데이트)
  const roomsRef = useRef<Map<number, TreatmentRoom>>(new Map());
  // 자신의 변경을 무시하기 위한 타임스탬프 (로컬 변경 후 일정 시간 내 폴링 무시)
  const lastLocalUpdateRef = useRef<number>(0);
  const IGNORE_POLLING_MS = 2000; // 2초 내 폴링 무시 (네트워크 지연 고려)

  // 치료실 데이터 로드 함수
  const loadTreatmentRooms = useCallback(async () => {
    // 자신의 변경 직후라면 폴링 무시 (낙관적 업데이트 유지)
    const timeSinceLastUpdate = Date.now() - lastLocalUpdateRef.current;
    if (timeSinceLastUpdate < IGNORE_POLLING_MS) {
      return;
    }

    try {
      const roomsData = await api.fetchTreatmentRooms();

      // Map에 저장
      roomsRef.current.clear();
      roomsData.forEach(room => roomsRef.current.set(room.id, room));

      // DB의 startTime을 그대로 사용하여 모든 클라이언트가 동일한 시간 기준으로 계산
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

  // 개별 룸 업데이트 함수 (특정 룸만 업데이트하여 불필요한 리렌더링 방지)
  const updateSingleRoom = useCallback((roomId: number, updateFn: (room: TreatmentRoom) => TreatmentRoom) => {
    // 로컬 변경 타임스탬프 기록 (폴링 무시용)
    lastLocalUpdateRef.current = Date.now();

    setTreatmentRooms(prev => {
      const roomIndex = prev.findIndex(r => r.id === roomId);
      if (roomIndex === -1) return prev;

      const updatedRoom = updateFn(prev[roomIndex]);
      // 변경된 룸만 새 객체로 대체, 나머지는 기존 참조 유지
      const newRooms = [...prev];
      newRooms[roomIndex] = updatedRoom;

      // Map도 업데이트
      roomsRef.current.set(roomId, updatedRoom);

      return newRooms;
    });
  }, []);

  const handleUpdateTreatmentRooms = useCallback(async (updatedRooms: TreatmentRoom[]) => {
    // 로컬 변경 타임스탬프 기록 (폴링 무시용)
    lastLocalUpdateRef.current = Date.now();

    // Map 업데이트
    roomsRef.current.clear();
    updatedRooms.forEach(room => roomsRef.current.set(room.id, room));

    // 로컬 상태 업데이트
    setTreatmentRooms(updatedRooms);
  }, []);

  const saveTreatmentRoomToDB = useCallback(async (roomId: number, room: TreatmentRoom) => {
    // 로컬 변경 타임스탬프 기록 (폴링 무시용)
    lastLocalUpdateRef.current = Date.now();

    // 중요한 변경사항만 DB에 저장 (환자 입실/퇴실, 치료 완료 등)
    try {
      await api.updateTreatmentRoom(roomId, room);
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
