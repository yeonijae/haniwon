import { useState, useEffect } from 'react';
import { TreatmentRoom, RoomStatus } from '../types';
import * as api from '../lib/api';
import { supabase } from '@shared/lib/supabase';

export const useTreatmentRooms = (currentUser: any) => {
  const [treatmentRooms, setTreatmentRooms] = useState<TreatmentRoom[]>([]);

  // 초기 치료실 데이터 로드
  useEffect(() => {
    if (!currentUser) return;

    const loadTreatmentRooms = async () => {
      try {
        const roomsData = await api.fetchTreatmentRooms();

        // DB의 startTime을 그대로 사용하여 모든 클라이언트가 동일한 시간 기준으로 계산
        setTreatmentRooms(roomsData);
      } catch (error) {
        console.error('❌ 치료실 데이터 로드 오류:', error);
      }
    };

    loadTreatmentRooms();
  }, [currentUser]);

  // 실시간 구독 (treatment_rooms + session_treatments 두 테이블 모두)
  useEffect(() => {
    if (!currentUser) return;

    const reloadRooms = async () => {
      try {
        const roomsData = await api.fetchTreatmentRooms();

        // DB 데이터를 그대로 사용하여 모든 클라이언트가 동일한 시간 기준으로 동기화
        setTreatmentRooms(roomsData);
      } catch (error) {
        console.error('❌ 실시간 치료실 데이터 로드 오류:', error);
      }
    };

    // treatment_rooms 테이블 구독
    const treatmentRoomsSubscription = supabase
      .channel('treatment-rooms-changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'treatment_rooms' },
        reloadRooms
      )
      .subscribe();

    // session_treatments 테이블 구독 (타이머 동기화용)
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

  // 치료 타이머 관리
  useEffect(() => {
    const timer = setInterval(() => {
      setTreatmentRooms(currentRooms => {
        let hasChanged = false;
        const updatedRooms = currentRooms.map(room => {
          if (room.status !== RoomStatus.IN_USE) return room;

          const newTreatments = room.sessionTreatments.map(tx => {
            if (tx.status === 'running' && tx.startTime) {
              // 타이머가 running일 때만 경과 시간 계산
              // 이렇게 하면 UI가 매초 업데이트됨
              hasChanged = true;

              const elapsed = (Date.now() - new Date(tx.startTime).getTime()) / 1000 + (tx.elapsedSeconds || 0);

              // 시간이 지나도 자동으로 completed로 변경하지 않음
              // UI에서 "완료" 표시만 하고, 사용자가 수동으로 완료 처리
              return tx;
            }
            return tx;
          });

          if (hasChanged) {
            return { ...room, sessionTreatments: newTreatments };
          }
          return room;
        });

        return hasChanged ? updatedRooms : currentRooms;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleUpdateTreatmentRooms = async (updatedRooms: TreatmentRoom[]) => {
    // 로컬 상태만 업데이트 (타이머 클릭 등)
    setTreatmentRooms(updatedRooms);
  };

  const saveTreatmentRoomToDB = async (roomId: number, room: TreatmentRoom) => {
    // 중요한 변경사항만 DB에 저장 (환자 입실/퇴실, 치료 완료 등)
    const startTime = Date.now();
    try {
      await api.updateTreatmentRoom(roomId, room);
    } catch (error) {
      console.error('❌ 치료실 DB 저장 오류:', error);
    }
  };

  return {
    treatmentRooms,
    setTreatmentRooms,
    handleUpdateTreatmentRooms,
    saveTreatmentRoomToDB,
  };
};
