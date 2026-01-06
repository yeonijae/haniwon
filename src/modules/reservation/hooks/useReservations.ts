import { useState, useEffect, useCallback } from 'react';
import type { Reservation, Doctor, CalendarViewType } from '../types';
import * as api from '../lib/api';
import { getCurrentDate } from '@shared/lib/postgres';

export function useReservations(initialDate?: string) {
  const [selectedDate, setSelectedDate] = useState(
    initialDate || getCurrentDate()
  );
  const [viewType, setViewType] = useState<CalendarViewType>('day');
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 의료진 목록 로드 (API에서 전체 의사 목록을 받아 프론트에서 필터링)
  useEffect(() => {
    const loadDoctors = async () => {
      try {
        const data = await api.fetchDoctors(selectedDate);

        // 의사 필터링 및 isWorking 계산
        const processedDoctors = data
          .filter((doc: any) => {
            // 기타여부 제외 (DOCTOR 등 시스템 계정)
            if (doc.isOther) return false;
            // 'DOCTOR' 같은 테스트 계정 제외
            if (doc.name === 'DOCTOR') return false;
            // 근무시작일이 없는 의사 제외
            if (!doc.workStartDate) return false;
            return true;
          })
          .map((doc: any) => {
            // isWorking 계산: 근무기간 내에 있는지 확인
            const parseToYYYYMMDD = (dateStr: string | null): string | null => {
              if (!dateStr) return null;
              try {
                const date = new Date(dateStr);
                if (isNaN(date.getTime())) return null;
                return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
              } catch {
                return null;
              }
            };

            const targetDateStr = selectedDate;
            const workStartStr = parseToYYYYMMDD(doc.workStartDate);
            const workEndStr = parseToYYYYMMDD(doc.workEndDate);

            let isWorking = true;
            if (workStartStr && targetDateStr < workStartStr) {
              isWorking = false;
            }
            if (workEndStr && targetDateStr > workEndStr) {
              isWorking = false;
            }

            return {
              ...doc,
              isWorking,
            };
          })
          // 근무 중인 의사만 필터링
          .filter((doc: any) => doc.isWorking)
          // 입사일(workStartDate) 기준 정렬 (오래된 순)
          .sort((a: any, b: any) => {
            const parseDate = (d: string | null) => d ? new Date(d).getTime() : 0;
            return parseDate(a.workStartDate) - parseDate(b.workStartDate);
          });

        setDoctors(processedDoctors);
        // 선택된 의사가 목록에 없으면 필터 해제
        if (selectedDoctor && !processedDoctors.find((d: any) => d.name === selectedDoctor)) {
          setSelectedDoctor(null);
        }
      } catch (err) {
        console.error('의료진 로드 실패:', err);
      }
    };
    loadDoctors();
  }, [selectedDate]);

  // 예약 데이터 로드
  const loadReservations = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      let data: Reservation[];

      if (viewType === 'day') {
        data = await api.fetchReservationsByDate(selectedDate);
      } else if (viewType === 'week') {
        const startDate = getWeekStart(selectedDate);
        const endDate = getWeekEnd(selectedDate);
        data = await api.fetchReservationsByDateRange(startDate, endDate);
      } else {
        const startDate = getMonthStart(selectedDate);
        const endDate = getMonthEnd(selectedDate);
        data = await api.fetchReservationsByDateRange(startDate, endDate);
      }

      // 의사 필터 적용
      if (selectedDoctor) {
        data = data.filter((r) => r.doctor === selectedDoctor);
      }

      setReservations(data);
    } catch (err: any) {
      setError(err.message || '예약 로드 실패');
    } finally {
      setIsLoading(false);
    }
  }, [selectedDate, viewType, selectedDoctor]);

  useEffect(() => {
    loadReservations();
  }, [loadReservations]);

  // 날짜 이동
  const goToDate = (date: string) => {
    setSelectedDate(date);
  };

  const goToPrevious = () => {
    const date = new Date(selectedDate);
    if (viewType === 'day') {
      date.setDate(date.getDate() - 1);
    } else if (viewType === 'week') {
      date.setDate(date.getDate() - 7);
    } else {
      date.setMonth(date.getMonth() - 1);
    }
    setSelectedDate(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`);
  };

  const goToNext = () => {
    const date = new Date(selectedDate);
    if (viewType === 'day') {
      date.setDate(date.getDate() + 1);
    } else if (viewType === 'week') {
      date.setDate(date.getDate() + 7);
    } else {
      date.setMonth(date.getMonth() + 1);
    }
    setSelectedDate(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`);
  };

  const goToToday = () => {
    setSelectedDate(getCurrentDate());
  };

  // 예약 CRUD
  const createReservation = async (req: Parameters<typeof api.createReservation>[0]) => {
    try {
      const newReservation = await api.createReservation(req);
      setReservations((prev) => [...prev, newReservation]);
      return newReservation;
    } catch (err: any) {
      throw new Error(err.message || '예약 생성 실패');
    }
  };

  const updateReservation = async (
    id: number,
    req: Parameters<typeof api.updateReservation>[1]
  ) => {
    try {
      const updated = await api.updateReservation(id, req);
      setReservations((prev) =>
        prev.map((r) => (r.id === id ? updated : r))
      );
      return updated;
    } catch (err: any) {
      throw new Error(err.message || '예약 수정 실패');
    }
  };

  const cancelReservation = async (id: number) => {
    try {
      await api.cancelReservation(id);
      setReservations((prev) =>
        prev.map((r) =>
          r.id === id ? { ...r, canceled: true, status: 'canceled' as const } : r
        )
      );
    } catch (err: any) {
      throw new Error(err.message || '예약 취소 실패');
    }
  };

  const markAsVisited = async (id: number) => {
    try {
      await api.markAsVisited(id);
      setReservations((prev) =>
        prev.map((r) =>
          r.id === id ? { ...r, visited: true, status: 'visited' as const } : r
        )
      );
    } catch (err: any) {
      throw new Error(err.message || '내원 확인 실패');
    }
  };

  return {
    // 상태
    selectedDate,
    viewType,
    reservations,
    doctors,
    selectedDoctor,
    isLoading,
    error,
    // 액션
    setViewType,
    setSelectedDoctor,
    goToDate,
    goToPrevious,
    goToNext,
    goToToday,
    loadReservations,
    createReservation,
    updateReservation,
    cancelReservation,
    markAsVisited,
  };
}

// 헬퍼 함수
function getWeekStart(dateStr: string): string {
  const date = new Date(dateStr);
  const day = date.getDay();
  date.setDate(date.getDate() - day);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getWeekEnd(dateStr: string): string {
  const date = new Date(dateStr);
  const day = date.getDay();
  date.setDate(date.getDate() + (6 - day));
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getMonthStart(dateStr: string): string {
  const date = new Date(dateStr);
  date.setDate(1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getMonthEnd(dateStr: string): string {
  const date = new Date(dateStr);
  date.setMonth(date.getMonth() + 1);
  date.setDate(0);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
