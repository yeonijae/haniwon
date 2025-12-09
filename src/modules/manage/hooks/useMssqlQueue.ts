/**
 * MSSQL 대기/치료 현황 폴링 훅
 * haniwon-sync API 서버에서 실시간 데이터를 가져옴
 *
 * 주요 기능:
 * 1. MSSQL에서 진료대기/치료대기 환자 목록 폴링 (1초)
 * 2. MSSQL 치료대기 환자를 Supabase waiting_queue에 자동 등록
 * 3. 이미 치료실(베드)에 배정된 환자는 목록에서 필터링
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@shared/lib/supabase';

const API_BASE_URL = 'http://localhost:3100';
const POLL_INTERVAL = 1000; // 1초

// MSSQL 대기 환자 타입
export interface MssqlWaitingPatient {
  id: number;
  patient_id: number;
  chart_no: string;
  patient_name: string;
  age: number;
  sex: 'M' | 'F';
  waiting_since: string | null;
  doctor: string;
  chart_done: boolean;
  status: string;
  progress: string;
  reg_type: string | null;
}

// MSSQL 치료 환자 타입
export interface MssqlTreatingPatient {
  id: number;
  patient_id: number;
  bed: number;
  chart_no: string;
  patient_name: string;
  age: number;
  sex: 'M' | 'F';
  treating_since: string | null;
  doctor: string;
  chart_done: boolean;
  status: string;
}

// MSSQL 베드 타입
export interface MssqlBed {
  id: number;
  bed_name: string;
  bed_seq: number;
  patient_id: number | null;
  patient_info: string | null;
  treat_status: string | null;
  alarm_time: string | null;
  stop_time: string | null;
}

// API 응답 타입
export interface MssqlQueueStatus {
  waiting: MssqlWaitingPatient[];
  treating: MssqlTreatingPatient[];
  beds: MssqlBed[];
  summary: {
    waiting_count: number;
    treating_count: number;
    occupied_beds: number;
    total_beds: number;
  };
  timestamp: string;
}

export const useMssqlQueue = () => {
  const [queueStatus, setQueueStatus] = useState<MssqlQueueStatus | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // 치료실에 배정된 환자 차트번호 목록 (Supabase treatment_rooms에서)
  const [assignedChartNumbers, setAssignedChartNumbers] = useState<Set<string>>(new Set());

  // 이미 처리된 MSSQL treating 환자 추적 (중복 등록 방지) - chart_no 기준
  const processedTreatingChartNosRef = useRef<Set<string>>(new Set());

  // Supabase에서 치료실에 배정된 환자 목록 조회 (차트번호 기준)
  const fetchAssignedPatients = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('treatment_rooms')
        .select('patient_chart_number')
        .not('patient_chart_number', 'is', null);

      if (error) {
        console.error('치료실 환자 조회 오류:', error);
        return;
      }

      const chartNumbers = new Set(
        (data || [])
          .map(room => room.patient_chart_number as string)
          .filter(Boolean)
      );
      setAssignedChartNumbers(chartNumbers);
    } catch (err) {
      console.error('치료실 환자 조회 실패:', err);
    }
  }, []);

  // MSSQL treating 환자를 Supabase waiting_queue에 등록
  const syncTreatingToSupabase = useCallback(async (treatingPatients: MssqlTreatingPatient[]) => {
    for (const patient of treatingPatients) {
      // 차트번호 정규화 (앞의 0 제거)
      const chartNo = patient.chart_no?.replace(/^0+/, '') || '';

      // 이미 처리된 환자는 스킵
      if (processedTreatingChartNosRef.current.has(chartNo)) {
        continue;
      }

      // 이미 치료실에 배정된 환자는 스킵
      if (assignedChartNumbers.has(chartNo)) {
        continue;
      }

      try {
        // Supabase patients 테이블에서 chart_no로 환자 찾기
        const { data: patientData } = await supabase
          .from('patients')
          .select('id')
          .eq('chart_number', chartNo)
          .single();

        if (!patientData) {
          console.log(`차트번호 ${chartNo} 환자가 Supabase에 없음 - 스킵`);
          processedTreatingChartNosRef.current.add(chartNo);
          continue;
        }

        // 이미 waiting_queue에 있는지 확인
        const { data: existingQueue } = await supabase
          .from('waiting_queue')
          .select('id')
          .eq('patient_id', patientData.id)
          .eq('queue_type', 'treatment')
          .single();

        if (existingQueue) {
          // 이미 등록되어 있으면 스킵
          processedTreatingChartNosRef.current.add(chartNo);
          continue;
        }

        // 현재 최대 position 조회
        const { data: maxData } = await supabase
          .from('waiting_queue')
          .select('position')
          .eq('queue_type', 'treatment')
          .order('position', { ascending: false })
          .limit(1);

        const nextPosition = maxData && maxData.length > 0 ? maxData[0].position + 1 : 0;

        // waiting_queue에 추가
        const { error: insertError } = await supabase
          .from('waiting_queue')
          .insert({
            patient_id: patientData.id,
            queue_type: 'treatment',
            details: `${patient.doctor || ''} ${patient.status || ''}`.trim() || '치료대기',
            position: nextPosition,
          });

        if (insertError) {
          console.error('치료대기 등록 오류:', insertError);
        } else {
          console.log(`✅ ${patient.patient_name} (${chartNo}) 치료대기 등록 완료`);
        }

        processedTreatingChartNosRef.current.add(chartNo);
      } catch (err) {
        console.error('치료대기 동기화 오류:', err);
      }
    }
  }, [assignedChartNumbers]);

  const fetchQueueStatus = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/queue/status`);

      if (!response.ok) {
        throw new Error(`API 오류: ${response.status}`);
      }

      const data: MssqlQueueStatus = await response.json();
      setQueueStatus(data);
      setIsConnected(true);
      setError(null);
      setLastUpdated(new Date());

      // MSSQL treating 환자를 Supabase에 동기화
      if (data.treating && data.treating.length > 0) {
        syncTreatingToSupabase(data.treating);
      }
    } catch (err) {
      setIsConnected(false);
      setError(err instanceof Error ? err.message : '연결 실패');
    }
  }, [syncTreatingToSupabase]);

  // 치료실 배정 환자 목록 실시간 구독
  useEffect(() => {
    // 초기 로드
    fetchAssignedPatients();

    // Supabase Realtime 구독
    const channel = supabase
      .channel('treatment_rooms_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'treatment_rooms' },
        () => {
          fetchAssignedPatients();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchAssignedPatients]);

  // 1초마다 폴링
  useEffect(() => {
    // 즉시 한 번 호출
    fetchQueueStatus();

    // 폴링 시작
    const interval = setInterval(fetchQueueStatus, POLL_INTERVAL);

    return () => clearInterval(interval);
  }, [fetchQueueStatus]);

  // 매일 자정에 처리된 환자 목록 초기화
  useEffect(() => {
    const resetAtMidnight = () => {
      const now = new Date();
      const midnight = new Date(now);
      midnight.setHours(24, 0, 0, 0);
      const msUntilMidnight = midnight.getTime() - now.getTime();

      return setTimeout(() => {
        processedTreatingChartNosRef.current.clear();
        console.log('🔄 처리된 환자 목록 초기화 (자정)');
        // 다음 자정 타이머 설정
        const dailyInterval = setInterval(() => {
          processedTreatingChartNosRef.current.clear();
          console.log('🔄 처리된 환자 목록 초기화 (자정)');
        }, 24 * 60 * 60 * 1000);
        return () => clearInterval(dailyInterval);
      }, msUntilMidnight);
    };

    const timeout = resetAtMidnight();
    return () => clearTimeout(timeout);
  }, []);

  // 대기 시간 계산 (분 단위)
  const getWaitingMinutes = useCallback((waitingSince: string | null): number => {
    if (!waitingSince) return 0;
    const start = new Date(waitingSince);
    const now = new Date();
    return Math.floor((now.getTime() - start.getTime()) / 60000);
  }, []);

  // 대기 시간 포맷 (HH:MM)
  const formatWaitingTime = useCallback((waitingSince: string | null): string => {
    if (!waitingSince) return '-';
    const date = new Date(waitingSince);
    return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
  }, []);

  // 치료실에 배정된 환자를 제외한 treating 목록 (차트번호 기준)
  const filteredTreating = (queueStatus?.treating || []).filter(patient => {
    const chartNo = patient.chart_no?.replace(/^0+/, '') || '';
    return !assignedChartNumbers.has(chartNo);
  });

  return {
    queueStatus,
    waiting: queueStatus?.waiting || [],
    treating: filteredTreating,
    beds: queueStatus?.beds || [],
    summary: queueStatus?.summary || { waiting_count: 0, treating_count: 0, occupied_beds: 0, total_beds: 0 },
    isConnected,
    error,
    lastUpdated,
    refresh: fetchQueueStatus,
    getWaitingMinutes,
    formatWaitingTime,
    assignedChartNumbers, // 디버깅용
  };
};
