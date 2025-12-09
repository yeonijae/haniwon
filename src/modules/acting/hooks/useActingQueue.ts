/**
 * 액팅 대기열 관리 Hook
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@shared/lib/supabase';
import type { ActingQueueItem, DoctorQueueGroup, DoctorStatus, AddActingRequest } from '../types';
import * as actingApi from '../api';

interface Doctor {
  id: number;
  name: string;
  color?: string;
}

export function useActingQueue(doctors: Doctor[]) {
  const [queueGroups, setQueueGroups] = useState<DoctorQueueGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // 데이터 로드
  const loadQueueGroups = useCallback(async () => {
    try {
      const groups = await actingApi.fetchDoctorQueueGroups(doctors);
      setQueueGroups(groups);
      setError(null);
    } catch (err) {
      console.error('액팅 대기열 로드 오류:', err);
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [doctors]);

  // 초기 로드
  useEffect(() => {
    loadQueueGroups();
  }, [loadQueueGroups]);

  // 실시간 구독
  useEffect(() => {
    const queueSubscription = supabase
      .channel('acting-queue-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'acting_queue' }, () => {
        loadQueueGroups();
      })
      .subscribe();

    const statusSubscription = supabase
      .channel('doctor-status-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'doctor_status' }, () => {
        loadQueueGroups();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(queueSubscription);
      supabase.removeChannel(statusSubscription);
    };
  }, [loadQueueGroups]);

  // 액팅 추가
  const addActing = useCallback(async (request: AddActingRequest) => {
    try {
      await actingApi.addActing(request);
      await loadQueueGroups();
    } catch (err) {
      console.error('액팅 추가 오류:', err);
      throw err;
    }
  }, [loadQueueGroups]);

  // 액팅 취소
  const cancelActing = useCallback(async (actingId: number) => {
    try {
      await actingApi.cancelActing(actingId);
      await loadQueueGroups();
    } catch (err) {
      console.error('액팅 취소 오류:', err);
      throw err;
    }
  }, [loadQueueGroups]);

  // 액팅 순서 변경
  const reorderActing = useCallback(async (actingId: number, doctorId: number, fromIndex: number, toIndex: number) => {
    try {
      await actingApi.reorderActing(actingId, doctorId, fromIndex, toIndex);
      await loadQueueGroups();
    } catch (err) {
      console.error('액팅 순서 변경 오류:', err);
      throw err;
    }
  }, [loadQueueGroups]);

  // 액팅을 다른 원장에게 이동
  const moveActingToDoctor = useCallback(async (actingId: number, newDoctorId: number, newDoctorName: string) => {
    try {
      await actingApi.moveActingToDoctor(actingId, newDoctorId, newDoctorName);
      await loadQueueGroups();
    } catch (err) {
      console.error('액팅 이동 오류:', err);
      throw err;
    }
  }, [loadQueueGroups]);

  // 진료 시작
  const startActing = useCallback(async (actingId: number, doctorId: number, doctorName: string) => {
    try {
      await actingApi.startActing(actingId, doctorId, doctorName);
      await loadQueueGroups();
    } catch (err) {
      console.error('진료 시작 오류:', err);
      throw err;
    }
  }, [loadQueueGroups]);

  // 진료 완료
  const completeActing = useCallback(async (actingId: number, doctorId: number, doctorName: string) => {
    try {
      await actingApi.completeActing(actingId, doctorId, doctorName);
      await loadQueueGroups();
    } catch (err) {
      console.error('진료 완료 오류:', err);
      throw err;
    }
  }, [loadQueueGroups]);

  // 원장 상태 변경
  const setDoctorStatus = useCallback(async (doctorId: number, doctorName: string, status: DoctorStatus['status']) => {
    try {
      await actingApi.upsertDoctorStatus(doctorId, doctorName, status);
      await loadQueueGroups();
    } catch (err) {
      console.error('원장 상태 변경 오류:', err);
      throw err;
    }
  }, [loadQueueGroups]);

  return {
    queueGroups,
    loading,
    error,
    refresh: loadQueueGroups,
    addActing,
    cancelActing,
    reorderActing,
    moveActingToDoctor,
    startActing,
    completeActing,
    setDoctorStatus,
  };
}
