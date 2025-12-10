/**
 * MSSQL 대기/치료 현황 폴링 훅
 * haniwon-sync API 서버에서 실시간 데이터를 가져옴
 *
 * 주요 기능:
 * 1. MSSQL에서 진료대기/치료대기 환자 목록 폴링 (1초)
 * 2. MSSQL 치료대기 환자를 SQLite waiting_queue에 자동 등록
 * 3. 이미 치료실(베드)에 배정된 환자는 목록에서 필터링
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { query, queryOne, insert, execute, escapeString } from '@shared/lib/sqlite';

const API_BASE_URL = 'http://192.168.0.173:3100';
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

  // 치료실에 배정된 환자 차트번호 목록 (SQLite treatment_rooms에서)
  const [assignedChartNumbers, setAssignedChartNumbers] = useState<Set<string>>(new Set());

  // 이미 처리된 MSSQL treating 환자 추적 (중복 등록 방지) - chart_no 기준
  const processedTreatingChartNosRef = useRef<Set<string>>(new Set());

  // SQLite에서 치료실에 배정된 환자 목록 조회 (차트번호 기준)
  // 배정된 환자는 waiting_queue에서도 삭제
  const fetchAssignedPatients = useCallback(async () => {
    try {
      const data = await query<{ patient_chart_number: string; patient_id: number }>(`
        SELECT patient_chart_number, patient_id FROM treatment_rooms
        WHERE patient_chart_number IS NOT NULL AND patient_chart_number != ''
      `);

      const chartNumbers = new Set(
        (data || [])
          .map(room => room.patient_chart_number)
          .filter(Boolean)
      );
      setAssignedChartNumbers(chartNumbers);

      // 치료실에 배정된 환자는 waiting_queue에서 삭제
      for (const room of data || []) {
        if (room.patient_id) {
          await execute(`
            DELETE FROM waiting_queue
            WHERE patient_id = ${room.patient_id} AND queue_type = 'treatment'
          `);
        }
      }
    } catch (err) {
      console.error('치료실 환자 조회 실패:', err);
    }
  }, []);

  // MSSQL treating 환자를 SQLite waiting_queue에 등록
  const syncTreatingToSqlite = useCallback(async (treatingPatients: MssqlTreatingPatient[]) => {
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
        // SQLite patients 테이블에서 chart_no 또는 mssql_id로 환자 찾기
        let patientData = await queryOne<{ id: number }>(`
          SELECT id FROM patients WHERE chart_number = ${escapeString(chartNo)} OR mssql_id = ${patient.patient_id}
        `);

        // SQLite에 환자가 없으면 자동으로 생성
        if (!patientData) {
          console.log(`차트번호 ${chartNo} 환자가 SQLite에 없음 - 자동 생성`);
          try {
            const newPatientId = await insert(`
              INSERT INTO patients (name, chart_number, mssql_id)
              VALUES (${escapeString(patient.patient_name)}, ${escapeString(chartNo)}, ${patient.patient_id})
            `);
            patientData = { id: newPatientId };
            console.log(`✅ ${patient.patient_name} (${chartNo}) SQLite 환자 생성 완료 (ID: ${newPatientId})`);
          } catch (insertErr) {
            // UNIQUE constraint 오류 시 다시 조회
            console.log(`환자 생성 실패, 재조회 시도...`);
            patientData = await queryOne<{ id: number }>(`
              SELECT id FROM patients WHERE chart_number = ${escapeString(chartNo)} OR mssql_id = ${patient.patient_id}
            `);
            if (!patientData) {
              throw insertErr;
            }
          }
        }

        // 이미 waiting_queue에 있는지 확인 (patient_id 또는 차트번호로)
        const existingQueue = await queryOne<{ id: number }>(`
          SELECT wq.id FROM waiting_queue wq
          LEFT JOIN patients p ON wq.patient_id = p.id
          WHERE wq.queue_type = 'treatment'
            AND (wq.patient_id = ${patientData.id} OR p.chart_number = ${escapeString(chartNo)})
        `);

        if (existingQueue) {
          // 이미 등록되어 있으면 스킵
          processedTreatingChartNosRef.current.add(chartNo);
          continue;
        }

        // 현재 최대 position 조회
        const maxData = await queryOne<{ max_pos: number }>(`
          SELECT MAX(position) as max_pos FROM waiting_queue WHERE queue_type = 'treatment'
        `);

        const nextPosition = (maxData?.max_pos ?? -1) + 1;

        // waiting_queue에 추가 (INSERT OR IGNORE로 중복 방지)
        const details = `${patient.doctor || ''} ${patient.status || ''}`.trim() || '치료대기';
        await execute(`
          INSERT OR IGNORE INTO waiting_queue (patient_id, queue_type, details, position)
          VALUES (${patientData.id}, 'treatment', ${escapeString(details)}, ${nextPosition})
        `);

        console.log(`✅ ${patient.patient_name} (${chartNo}) 치료대기 등록 완료`);
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

      // MSSQL treating 환자를 SQLite에 동기화
      if (data.treating && data.treating.length > 0) {
        syncTreatingToSqlite(data.treating);
      }
    } catch (err) {
      setIsConnected(false);
      setError(err instanceof Error ? err.message : '연결 실패');
    }
  }, [syncTreatingToSqlite]);

  // 치료실 배정 환자 목록 주기적 조회 (Polling)
  useEffect(() => {
    // 초기 로드
    fetchAssignedPatients();

    // 2초마다 치료실 배정 환자 목록 갱신
    const assignedInterval = setInterval(() => {
      fetchAssignedPatients();
    }, 2000);

    return () => {
      clearInterval(assignedInterval);
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
