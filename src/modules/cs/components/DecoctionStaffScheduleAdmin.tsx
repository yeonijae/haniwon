import React, { useState, useEffect, useCallback } from 'react';
import { getStaffSchedule, upsertStaffSchedule } from '../lib/api';
import type { StaffScheduleEntry } from '../types';
import DecoctionCalendarPreview from './DecoctionCalendarPreview';

interface DayEntry {
  date: string;         // YYYY-MM-DD
  dayName: string;      // 월~일
  isWeekend: boolean;
  staffCount: number;   // 1 or 2
  isHoliday: boolean;
  maxCapacity: number;  // 자동 계산
}

const DAY_NAMES = ['월', '화', '수', '목', '금', '토', '일'];

function calcCapacity(staffCount: number, isWeekend: boolean, isHoliday: boolean): number {
  const isOff = isWeekend || isHoliday;
  if (isOff) return staffCount >= 2 ? 14 : 6;
  return staffCount >= 2 ? 22 : 8;
}

function getWeekStart(offset: number): Date {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now);
  monday.setDate(diff + offset * 7);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function formatShortDate(d: Date): string {
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export default function DecoctionStaffScheduleAdmin() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [entries, setEntries] = useState<DayEntry[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const loadWeek = useCallback(async () => {
    const monday = getWeekStart(weekOffset);
    const dates: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      dates.push(d);
    }

    const startDate = formatDate(dates[0]);
    const endDate = formatDate(dates[6]);

    try {
      const schedules = await getStaffSchedule(startDate, endDate);
      const scheduleMap = new Map<string, StaffScheduleEntry>();
      for (const s of schedules) {
        scheduleMap.set(s.schedule_date, s);
      }

      const newEntries: DayEntry[] = dates.map((d, i) => {
        const dateStr = formatDate(d);
        const isWeekend = i >= 5;
        const existing = scheduleMap.get(dateStr);
        const staffCount = existing ? existing.staff_count : 1;
        const isHoliday = existing ? existing.is_holiday : false;
        return {
          date: dateStr,
          dayName: DAY_NAMES[i],
          isWeekend,
          staffCount,
          isHoliday,
          maxCapacity: calcCapacity(staffCount, isWeekend, isHoliday),
        };
      });

      setEntries(newEntries);
    } catch (err) {
      console.error('인력 스케줄 로드 실패:', err);
    }
  }, [weekOffset]);

  useEffect(() => {
    loadWeek();
  }, [loadWeek]);

  const handleStaffCountChange = (index: number, value: number) => {
    setEntries((prev) => {
      const updated = [...prev];
      const entry = { ...updated[index], staffCount: value };
      entry.maxCapacity = calcCapacity(entry.staffCount, entry.isWeekend, entry.isHoliday);
      updated[index] = entry;
      return updated;
    });
  };

  const handleHolidayChange = (index: number, checked: boolean) => {
    setEntries((prev) => {
      const updated = [...prev];
      const entry = { ...updated[index], isHoliday: checked };
      entry.maxCapacity = calcCapacity(entry.staffCount, entry.isWeekend, entry.isHoliday);
      updated[index] = entry;
      return updated;
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      for (const entry of entries) {
        await upsertStaffSchedule(entry.date, entry.staffCount, entry.isHoliday);
      }
      setRefreshKey((k) => k + 1);
    } catch (err) {
      console.error('인력 스케줄 저장 실패:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // 주간 범위 표시 텍스트
  const monday = getWeekStart(weekOffset);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const weekLabel = `${formatShortDate(monday)} ~ ${formatShortDate(sunday)}`;

  return (
    <div className="staff-schedule-admin">
      <div className="staff-schedule-nav">
        <button
          className="staff-schedule-nav-btn"
          onClick={() => setWeekOffset((o) => o - 1)}
        >
          &larr; 이전주
        </button>
        <span style={{ fontWeight: 600, fontSize: '14px' }}>{weekLabel}</span>
        <button
          className="staff-schedule-nav-btn"
          onClick={() => setWeekOffset((o) => o + 1)}
        >
          다음주 &rarr;
        </button>
      </div>

      <table className="staff-schedule-table">
        <thead>
          <tr>
            <th>날짜</th>
            <th>요일</th>
            <th>인력</th>
            <th>공휴일</th>
            <th>최대용량</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, idx) => (
            <tr
              key={entry.date}
              className={entry.isWeekend ? 'staff-schedule-weekend' : ''}
            >
              <td>{formatShortDate(new Date(entry.date + 'T00:00:00'))}</td>
              <td>{entry.dayName}</td>
              <td>
                <select
                  value={entry.staffCount}
                  onChange={(e) =>
                    handleStaffCountChange(idx, Number(e.target.value))
                  }
                >
                  <option value={1}>1</option>
                  <option value={2}>2</option>
                </select>
              </td>
              <td>
                <input
                  type="checkbox"
                  checked={entry.isHoliday}
                  onChange={(e) => handleHolidayChange(idx, e.target.checked)}
                />
              </td>
              <td>{entry.maxCapacity}건</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ textAlign: 'center', margin: '16px 0' }}>
        <button
          className="staff-schedule-save-btn"
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving ? '저장 중...' : '저장'}
        </button>
      </div>

      <div style={{ marginTop: '24px' }}>
        <DecoctionCalendarPreview key={refreshKey} readonly />
      </div>

      <style>{`
        .staff-schedule-admin {
          padding: 16px;
        }

        .staff-schedule-nav {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 16px;
          margin-bottom: 16px;
        }

        .staff-schedule-nav-btn {
          padding: 4px 12px;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          background: white;
          cursor: pointer;
          font-size: 13px;
        }

        .staff-schedule-nav-btn:hover {
          background: #f3f4f6;
        }

        .staff-schedule-table {
          width: 100%;
          border-collapse: collapse;
        }

        .staff-schedule-table th,
        .staff-schedule-table td {
          padding: 8px 12px;
          border-bottom: 1px solid #e5e7eb;
          text-align: center;
          font-size: 13px;
        }

        .staff-schedule-table th {
          background: #f9fafb;
          font-weight: 600;
          color: #374151;
        }

        .staff-schedule-weekend {
          background: #f8fafc;
        }

        .staff-schedule-save-btn {
          background: #667eea;
          color: white;
          padding: 8px 24px;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 13px;
          font-weight: 500;
        }

        .staff-schedule-save-btn:hover {
          background: #5a6fd6;
        }

        .staff-schedule-save-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}
