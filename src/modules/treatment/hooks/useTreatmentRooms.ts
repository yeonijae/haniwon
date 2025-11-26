import { useState, useEffect, useCallback, useRef } from 'react';
import { TreatmentRoom } from '../types';
import * as api from '../lib/api';
import { supabase } from '@shared/lib/supabase';

export const useTreatmentRooms = (currentUser: any) => {
  const [treatmentRooms, setTreatmentRooms] = useState<TreatmentRoom[]>([]);
  const roomsRef = useRef<Map<number, TreatmentRoom>>(new Map());
  const lastLocalUpdateRef = useRef<number>(0);
  const IGNORE_SUBSCRIPTION_MS = 2000;

  // 초기 치료실 데이터 로드
  useEffect(() => {
    if (!currentUser) return;

    const loadTreatmentRooms = async () => {
      try {
        const roomsData = await api.fetchTreatmentRooms();

        roomsRef.current.clear();
        roomsData.forEach(room => roomsRef.current.set(room.id, room));

        setTreatmentRooms(roomsData);
      } catch (error) {
        console.error('❌ 치료실 데이터 로드 오류:', error);
      }
    };

    loadTreatmentRooms();
  }, [currentUser]);

  // 실시간 구독
  useEffect(() => {
    if (!currentUser) return;

    const reloadRooms = async () => {
      const timeSinceLastUpdate = Date.now() - lastLocalUpdateRef.current;
      if (timeSinceLastUpdate < IGNORE_SUBSCRIPTION_MS) {
        return;
      }

      try {
        const roomsData = await api.fetchTreatmentRooms();

        roomsRef.current.clear();
        roomsData.forEach(room => roomsRef.current.set(room.id, room));

        setTreatmentRooms(roomsData);
      } catch (error) {
        console.error('❌ 실시간 치료실 데이터 로드 오류:', error);
      }
    };

    const treatmentRoomsSubscription = supabase
      .channel('treatment-rooms-changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'treatment_rooms' },
        reloadRooms
      )
      .subscribe();

    const sessionTreatmentsSubscription = supabase
      .channel('session-treatments-changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'session_treatments' },
        reloadRooms
      )
      .subscribe();

    return () => {
      supabase.removeChannel(treatmentRoomsSubscription);
      supabase.removeChannel(sessionTreatmentsSubscription);
    };
  }, [currentUser]);

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
