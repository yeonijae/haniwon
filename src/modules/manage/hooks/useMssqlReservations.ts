/**
 * MSSQL 예약 데이터 폴링 훅
 * haniwon-sync API 서버에서 오늘의 예약 데이터를 가져옴
 */

import { useState, useEffect, useCallback } from 'react';

const API_BASE_URL = import.meta.env.VITE_MSSQL_API_URL || 'http://192.168.0.173:3100';
const POLL_INTERVAL = 5000; // 5초 (예약은 자주 변경되지 않으므로)

// MSSQL 예약 타입
export interface MssqlReservation {
  id: number;
  patient_id: number | null;
  chart_no: string;
  patient_name: string;
  phone: string | null;
  date: string;
  time: string;
  doctor: string;
  item: string | null;
  type: string | null; // 초진/재진
  memo: string | null;
  visited: boolean;
  canceled: boolean;
}

export const useMssqlReservations = () => {
  const [reservations, setReservations] = useState<MssqlReservation[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchReservations = useCallback(async () => {
    try {
      // 오늘 날짜
      const today = new Date().toISOString().split('T')[0];

      const response = await fetch(`${API_BASE_URL}/api/reservations?date=${today}`);

      if (!response.ok) {
        throw new Error(`API 오류: ${response.status}`);
      }

      const data: MssqlReservation[] = await response.json();

      // 시간순 정렬
      data.sort((a, b) => (a.time || '').localeCompare(b.time || ''));

      setReservations(data);
      setIsConnected(true);
      setError(null);
      setLastUpdated(new Date());
    } catch (err) {
      setIsConnected(false);
      setError(err instanceof Error ? err.message : '연결 실패');
    }
  }, []);

  // 폴링
  useEffect(() => {
    // 즉시 한 번 호출
    fetchReservations();

    // 폴링 시작
    const interval = setInterval(fetchReservations, POLL_INTERVAL);

    return () => clearInterval(interval);
  }, [fetchReservations]);

  // 시간 포맷 (HH:MM)
  const formatTime = useCallback((time: string | null): string => {
    if (!time) return '-';
    // MSSQL에서 오는 시간 형식에 따라 조정
    // 예: "0930" -> "09:30", "09:30" -> "09:30"
    if (time.length === 4 && !time.includes(':')) {
      return `${time.slice(0, 2)}:${time.slice(2)}`;
    }
    return time;
  }, []);

  // 통계
  const summary = {
    total: reservations.length,
    visited: reservations.filter(r => r.visited).length,
    pending: reservations.filter(r => !r.visited).length,
    firstVisit: reservations.filter(r => r.type === '초진').length,
  };

  return {
    reservations,
    summary,
    isConnected,
    error,
    lastUpdated,
    refresh: fetchReservations,
    formatTime,
  };
};
