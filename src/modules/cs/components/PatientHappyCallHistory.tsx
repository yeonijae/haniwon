import React, { useState, useEffect } from 'react';
import { query, execute, escapeString } from '@shared/lib/postgres';
import type { HappyCallRecord } from '../types/crm';

interface PatientHappyCallHistoryProps {
  patientId: number;
  chartNumber: string;
}

// 해피콜 타입 라벨
const CALL_TYPE_LABELS: Record<string, string> = {
  post_visit: '내원 후 확인',
  follow_up: '후속 관리',
  reminder: '예약 알림',
  other: '기타',
};

// 해피콜 결과 라벨
const CALL_RESULT_LABELS: Record<string, string> = {
  completed: '완료',
  no_answer: '부재중',
  callback: '재연락 필요',
};

// 해피콜 결과 색상
const CALL_RESULT_COLORS: Record<string, string> = {
  completed: '#10b981',
  no_answer: '#f59e0b',
  callback: '#ef4444',
};

const PatientHappyCallHistory: React.FC<PatientHappyCallHistoryProps> = ({
  patientId,
  chartNumber,
}) => {
  const [records, setRecords] = useState<HappyCallRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadHappyCallRecords = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // 테이블 자동 생성
        await execute(`
          CREATE TABLE IF NOT EXISTS happy_call_records (
            id SERIAL PRIMARY KEY,
            patient_id INTEGER NOT NULL,
            chart_number TEXT,
            patient_name TEXT,
            call_date TIMESTAMPTZ DEFAULT NOW(),
            call_type TEXT NOT NULL DEFAULT 'post_visit',
            call_result TEXT NOT NULL DEFAULT 'completed',
            notes TEXT,
            staff_name TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW()
          )
        `).catch(() => {});

        const results = await query<HappyCallRecord>(`
          SELECT * FROM happy_call_records
          WHERE patient_id = ${patientId}
          OR chart_number = ${escapeString(chartNumber)}
          ORDER BY call_date DESC
          LIMIT 20
        `).catch(() => []);

        setRecords(results);
      } catch (err) {
        console.error('해피콜 기록 로드 오류:', err);
        setError('해피콜 기록을 불러올 수 없습니다.');
      } finally {
        setIsLoading(false);
      }
    };

    loadHappyCallRecords();
  }, [patientId, chartNumber]);

  // 날짜 포맷
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  if (isLoading) {
    return (
      <div className="happycall-loading">
        <span>로딩 중...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="happycall-error">
        <p>{error}</p>
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="happycall-empty">
        <p>해피콜 기록이 없습니다.</p>
        <p className="happycall-hint">
          patient-care 모듈에서 해피콜 기록을 관리합니다.
        </p>
      </div>
    );
  }

  return (
    <div className="happycall-history">
      <div className="happycall-list">
        {records.map(record => (
          <div key={record.id} className="happycall-item">
            <div className="happycall-item-header">
              <span className="happycall-date">{formatDate(record.call_date)}</span>
              <span className="happycall-type">
                {CALL_TYPE_LABELS[record.call_type] || record.call_type}
              </span>
              <span
                className="happycall-result"
                style={{ backgroundColor: CALL_RESULT_COLORS[record.call_result] || '#9ca3af' }}
              >
                {CALL_RESULT_LABELS[record.call_result] || record.call_result}
              </span>
            </div>
            {record.notes && (
              <div className="happycall-notes">
                {record.notes}
              </div>
            )}
            <div className="happycall-staff">
              담당: {record.staff_name}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PatientHappyCallHistory;
