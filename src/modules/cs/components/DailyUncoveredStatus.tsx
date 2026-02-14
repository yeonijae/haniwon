import { useState, useEffect, useCallback } from 'react';
import { getCurrentDate } from '@shared/lib/postgres';
import { getDailyUncoveredSummary, deleteUncoveredRecord } from '../lib/api';
import type { DailyUncoveredRecord, UncoveredRecordType } from '../lib/api';

const RECORD_TYPE_CONFIG: Record<UncoveredRecordType, { label: string; icon: string; color: string }> = {
  yakchim: { label: '약침', icon: 'fa-syringe', color: '#8b5cf6' },
  medicine: { label: '상비약', icon: 'fa-pills', color: '#3b82f6' },
  herbal: { label: '한약', icon: 'fa-leaf', color: '#10b981' },
  package: { label: '패키지', icon: 'fa-box', color: '#f59e0b' },
  membership: { label: '멤버십', icon: 'fa-id-card', color: '#ec4899' },
  memo: { label: '메모', icon: 'fa-comment', color: '#6b7280' },
};

interface DailyUncoveredStatusProps {
  // 필요 시 user prop 추가 가능
}

export default function DailyUncoveredStatus({}: DailyUncoveredStatusProps) {
  const [selectedDate, setSelectedDate] = useState(getCurrentDate());
  const [records, setRecords] = useState<DailyUncoveredRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filterType, setFilterType] = useState<UncoveredRecordType | 'all'>('all');

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getDailyUncoveredSummary(selectedDate);
      setRecords(data);
    } catch (err) {
      console.error('비급여 현황 조회 오류:', err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 날짜 이동
  const moveDate = (delta: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + delta);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  // 필터된 레코드
  const filteredRecords = filterType === 'all'
    ? records
    : records.filter(r => r.recordType === filterType);

  // 유형별 건수
  const typeCounts = records.reduce((acc, r) => {
    acc[r.recordType] = (acc[r.recordType] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // 삭제 처리
  const handleDelete = async (record: DailyUncoveredRecord) => {
    const config = RECORD_TYPE_CONFIG[record.recordType];
    if (!confirm(`[${config.label}] ${record.patientName} - ${record.itemName}\n이 기록을 삭제하시겠습니까?`)) {
      return;
    }
    try {
      await deleteUncoveredRecord(record);
      setRecords(prev => prev.filter(r => !(r.id === record.id && r.sourceTable === record.sourceTable)));
    } catch (err) {
      console.error('삭제 오류:', err);
      alert('삭제 중 오류가 발생했습니다.');
    }
  };

  // 시간 포맷
  const formatTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    } catch {
      return '';
    }
  };

  return (
    <div className="daily-uncovered">
      {/* 날짜 선택 + 필터 */}
      <div className="daily-uncovered-header">
        <div className="daily-uncovered-date-nav">
          <button className="date-nav-btn" onClick={() => moveDate(-1)}>&lt;</button>
          <input
            type="date"
            className="date-picker"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
          />
          <button className="date-nav-btn" onClick={() => moveDate(1)}>&gt;</button>
          <button className="date-today-btn" onClick={() => setSelectedDate(getCurrentDate())}>오늘</button>
          <button className="daily-uncovered-refresh" onClick={loadData} disabled={isLoading}>
            <i className={`fa-solid fa-rotate-right ${isLoading ? 'fa-spin' : ''}`}></i>
          </button>
        </div>
      </div>

      {/* 통계 바 */}
      <div className="daily-uncovered-stats">
        <button
          className={`daily-stat-chip ${filterType === 'all' ? 'active' : ''}`}
          onClick={() => setFilterType('all')}
        >
          전체 <span className="stat-count">{records.length}</span>
        </button>
        {(Object.entries(RECORD_TYPE_CONFIG) as [UncoveredRecordType, typeof RECORD_TYPE_CONFIG[UncoveredRecordType]][]).map(([type, config]) => {
          const count = typeCounts[type] || 0;
          if (count === 0) return null;
          return (
            <button
              key={type}
              className={`daily-stat-chip ${filterType === type ? 'active' : ''}`}
              style={{ '--chip-color': config.color } as React.CSSProperties}
              onClick={() => setFilterType(filterType === type ? 'all' : type)}
            >
              <i className={`fa-solid ${config.icon}`}></i>
              {config.label} <span className="stat-count">{count}</span>
            </button>
          );
        })}
      </div>

      {/* 테이블 */}
      <div className="daily-uncovered-table-wrap">
        {isLoading ? (
          <div className="daily-uncovered-loading">
            <i className="fa-solid fa-spinner fa-spin"></i> 로딩 중...
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="daily-uncovered-empty">
            <i className="fa-solid fa-clipboard-check"></i>
            <p>{selectedDate} 처리된 비급여 항목이 없습니다.</p>
          </div>
        ) : (
          <table className="daily-uncovered-table">
            <thead>
              <tr>
                <th className="col-time">시간</th>
                <th className="col-patient">환자</th>
                <th className="col-type">유형</th>
                <th className="col-item">항목</th>
                <th className="col-detail">상세</th>
                <th className="col-action">삭제</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map(record => {
                const config = RECORD_TYPE_CONFIG[record.recordType];
                return (
                  <tr key={`${record.sourceTable}-${record.id}`}>
                    <td className="col-time">{formatTime(record.createdAt)}</td>
                    <td className="col-patient">
                      <span className="patient-name">{record.patientName}</span>
                      <span className="chart-number">{record.chartNumber}</span>
                    </td>
                    <td className="col-type">
                      <span className="type-badge" style={{ backgroundColor: config.color }}>
                        <i className={`fa-solid ${config.icon}`}></i> {config.label}
                      </span>
                    </td>
                    <td className="col-item">{record.itemName}</td>
                    <td className="col-detail">{record.detail}</td>
                    <td className="col-action">
                      <button
                        className="delete-btn"
                        onClick={() => handleDelete(record)}
                        title="삭제 (되돌리기)"
                      >
                        <i className="fa-solid fa-trash-can"></i>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
