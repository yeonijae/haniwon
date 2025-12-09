/**
 * 액팅 대기열 관리 Hook
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { ActingQueueItem, DoctorQueueGroup, DoctorStatus, AddActingRequest } from '../types';
import * as actingApi from '../api';

// Polling 간격 (밀리초)
const POLLING_INTERVAL = 5000;

interface Doctor {
  id: number;
  name: string;
  color?: string;
}

export function useActingQueue(doctors: Doctor[]) {
  const [queueGroups, setQueueGroups] = useState<DoctorQueueGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const lastLocalUpdateRef = useRef<number>(0);
  const IGNORE_POLLING_MS = 2000;

  // 데이터 로드
  const loadQueueGroups = useCallback(async () => {
    const timeSinceLastUpdate = Date.now() - lastLocalUpdateRef.current;
    if (timeSinceLastUpdate < IGNORE_POLLING_MS) {
      return;
    }

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

  // Polling으로 실시간 구독 대체
  useEffect(() => {
    const intervalId = setInterval(() => {
      loadQueueGroups();
    }, POLLING_INTERVAL);

    return () => {
      clearInterval(intervalId);
    };
  }, [loadQueueGroups]);

  // 액팅 추가
  const addActing = useCallback(async (request: AddActingRequest) => {
    lastLocalUpdateRef.current = Date.now();
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
    lastLocalUpdateRef.current = Date.now();
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
    lastLocalUpdateRef.current = Date.now();
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
    lastLocalUpdateRef.current = Date.now();
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
    lastLocalUpdateRef.current = Date.now();
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
    lastLocalUpdateRef.current = Date.now();
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
    lastLocalUpdateRef.current = Date.now();
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
