import React, { useState, useEffect, useCallback } from 'react';
import { getStaffSchedule, upsertStaffSchedule, getDecoctionCapacity } from '../lib/api';
import type { StaffScheduleEntry, DecoctionDayCapacity } from '../types';
import DecoctionCalendarPreview from './DecoctionCalendarPreview';

interface DayEntry {
  date: string;
  dayName: string;
  isWeekend: boolean;
  staffCount: number;
  isHoliday: boolean;
  maxCapacity: number;
}

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

function calcCapacity(staffCount: number, isWeekend: boolean, isHoliday: boolean): number {
  const isOff = isWeekend || isHoliday;
  if (isOff) return staffCount >= 2 ? 14 : 6;
  return staffCount >= 2 ? 22 : 8;
}

function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fmtShort(d: Date): string {
  return `${d.getMonth() + 1}/${d.getDate()}`;
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

function getMonthDates(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  // 달력 시작: 해당 월 1일이 속한 주의 월요일
  const startDay = first.getDay(); // 0=일
  const startOffset = startDay === 0 ? -6 : 1 - startDay;
  const start = new Date(year, month, 1 + startOffset);
  // 달력 끝: 마지막 날이 속한 주의 일요일
  const endDay = last.getDay();
  const endOffset = endDay === 0 ? 0 : 7 - endDay;
  const end = new Date(year, month, last.getDate() + endOffset);

  const dates: Date[] = [];
  const cur = new Date(start);
  while (cur <= end) {
    dates.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

export default function DecoctionStaffScheduleAdmin() {
  const viewMode = 'month' as const;
  const [weekOffset, setWeekOffset] = useState(0);
  const [monthDate, setMonthDate] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [entries, setEntries] = useState<Map<string, DayEntry>>(new Map());
  const [isSaving, setIsSaving] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [dirty, setDirty] = useState(new Set<string>());
  const [capacityMap, setCapacityMap] = useState<Map<string, DecoctionDayCapacity>>(new Map());

  const todayStr = fmtDate(new Date());

  const loadRange = useCallback(async (startDate: string, endDate: string) => {
    try {
      const schedules = await getStaffSchedule(startDate, endDate);
      const scheduleMap = new Map<string, StaffScheduleEntry>();
      for (const s of schedules) scheduleMap.set(s.schedule_date, s);

      const start = new Date(startDate + 'T00:00:00');
      const end = new Date(endDate + 'T00:00:00');
      const newEntries = new Map<string, DayEntry>();
      const cur = new Date(start);
      while (cur <= end) {
        const dateStr = fmtDate(cur);
        const dayOfWeek = cur.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const existing = scheduleMap.get(dateStr);
        const staffCount = existing ? existing.staff_count : 1;
        const isHoliday = existing ? existing.is_holiday : false;
        newEntries.set(dateStr, {
          date: dateStr,
          dayName: DAY_NAMES[dayOfWeek],
          isWeekend,
          staffCount,
          isHoliday,
          maxCapacity: calcCapacity(staffCount, isWeekend, isHoliday),
        });
        cur.setDate(cur.getDate() + 1);
      }
      setEntries(newEntries);
      setDirty(new Set());
      // 용량 데이터 로드
      try {
        const caps = await getDecoctionCapacity(startDate, endDate);
        const cMap = new Map<string, DecoctionDayCapacity>();
        for (const c of caps) cMap.set(c.date, c);
        setCapacityMap(cMap);
      } catch {}
    } catch (err) {
      console.error('인력 스케줄 로드 실패:', err);
    }
  }, []);

  useEffect(() => {
    if (viewMode === 'week') {
      const monday = getWeekStart(weekOffset);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      loadRange(fmtDate(monday), fmtDate(sunday));
    } else {
      const dates = getMonthDates(monthDate.year, monthDate.month);
      loadRange(fmtDate(dates[0]), fmtDate(dates[dates.length - 1]));
    }
  }, [viewMode, weekOffset, monthDate, loadRange]);

  const updateEntry = (dateStr: string, patch: Partial<DayEntry>) => {
    setEntries(prev => {
      const next = new Map(prev);
      const entry = next.get(dateStr);
      if (!entry) return prev;
      const updated = { ...entry, ...patch };
      updated.maxCapacity = calcCapacity(updated.staffCount, updated.isWeekend, updated.isHoliday);
      next.set(dateStr, updated);
      return next;
    });
    setDirty(prev => new Set(prev).add(dateStr));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      for (const dateStr of dirty) {
        const entry = entries.get(dateStr);
        if (entry) await upsertStaffSchedule(entry.date, entry.staffCount, entry.isHoliday);
      }
      setDirty(new Set());
      setRefreshKey(k => k + 1);
    } catch (err) {
      console.error('저장 실패:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // 주간뷰
  const renderWeekView = () => {
    const monday = getWeekStart(weekOffset);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const weekLabel = `${fmtShort(monday)} ~ ${fmtShort(sunday)}`;
    const weekDates: string[] = [];
    const cur = new Date(monday);
    for (let i = 0; i < 7; i++) {
      weekDates.push(fmtDate(cur));
      cur.setDate(cur.getDate() + 1);
    }

    return (
      <>
        <div className="dsa-nav">
          <div className="dsa-toggle">
            <button className={`dsa-toggle-btn ${viewMode === 'week' ? 'active' : ''}`} onClick={() => setViewMode('week')}>주간</button>
            <button className={`dsa-toggle-btn ${viewMode === 'month' ? 'active' : ''}`} onClick={() => setViewMode('month')}>월간</button>
          </div>
          <button className="dsa-nav-btn" onClick={() => setWeekOffset(o => o - 1)}>← 이전주</button>
          <span className="dsa-nav-label">{weekLabel}</span>
          <button className="dsa-nav-btn" onClick={() => setWeekOffset(o => o + 1)}>다음주 →</button>
          <button className="dsa-save-btn" style={{ marginLeft: 'auto' }} onClick={handleSave} disabled={isSaving || dirty.size === 0}>
            {isSaving ? '저장 중...' : `저장${dirty.size > 0 ? ` (${dirty.size})` : ''}`}
          </button>
        </div>
        <table className="dsa-table">
          <thead>
            <tr><th>날짜</th><th>요일</th><th>인력</th><th>공휴일</th><th>최대용량</th></tr>
          </thead>
          <tbody>
            {weekDates.map(dateStr => {
              const entry = entries.get(dateStr);
              if (!entry) return null;
              return (
                <tr key={dateStr} className={`${entry.isWeekend ? 'dsa-weekend' : ''} ${dateStr === todayStr ? 'dsa-today' : ''}`}>
                  <td>{fmtShort(new Date(dateStr + 'T00:00:00'))}</td>
                  <td>{entry.dayName}</td>
                  <td>
                    <select value={entry.staffCount} onChange={e => updateEntry(dateStr, { staffCount: Number(e.target.value) })}>
                      <option value={1}>1</option><option value={2}>2</option>
                    </select>
                  </td>
                  <td><input type="checkbox" checked={entry.isHoliday} onChange={e => updateEntry(dateStr, { isHoliday: e.target.checked })} /></td>
                  <td>{entry.maxCapacity}건</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </>
    );
  };

  // 월간뷰
  const renderMonthView = () => {
    const { year, month } = monthDate;
    const dates = getMonthDates(year, month);
    const weeks: Date[][] = [];
    for (let i = 0; i < dates.length; i += 7) {
      weeks.push(dates.slice(i, i + 7));
    }
    const monthLabel = `${year}년 ${month + 1}월`;

    return (
      <>
        <div className="dsa-nav">
          <button className="dsa-nav-btn" onClick={() => {
            const prev = month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 };
            setMonthDate(prev);
          }}>← 이전달</button>
          <span className="dsa-nav-label">{monthLabel}</span>
          <button className="dsa-nav-btn" onClick={() => {
            const next = month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 };
            setMonthDate(next);
          }}>다음달 →</button>
          <button className="dsa-save-btn" style={{ marginLeft: 'auto' }} onClick={handleSave} disabled={isSaving || dirty.size === 0}>
            {isSaving ? '저장 중...' : `저장${dirty.size > 0 ? ` (${dirty.size})` : ''}`}
          </button>
        </div>
        <div className="dsa-cal">
          <div className="dsa-cal-header">
            {['월', '화', '수', '목', '금', '토', '일'].map(d => (
              <div key={d} className={`dsa-cal-hd ${d === '토' || d === '일' ? 'weekend' : ''}`}>{d}</div>
            ))}
          </div>
          {weeks.map((week, wi) => (
            <div key={wi} className="dsa-cal-row">
              {week.map(date => {
                const dateStr = fmtDate(date);
                const entry = entries.get(dateStr);
                const isCurrentMonth = date.getMonth() === month;
                const isToday = dateStr === todayStr;
                const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                return (
                  <div key={dateStr} className={`dsa-cal-cell ${!isCurrentMonth ? 'other-month' : ''} ${isToday ? 'today' : ''} ${isWeekend ? 'weekend' : ''} ${entry?.isHoliday ? 'holiday' : ''} ${dirty.has(dateStr) ? 'dirty' : ''}`}>
                    <div className="dsa-cell-date">{date.getDate()}</div>
                    {entry && isCurrentMonth && (() => {
                      const cap = capacityMap.get(dateStr);
                      const used = cap?.usedCapacity ?? 0;
                      const remaining = entry.maxCapacity - used;
                      const isFull = remaining <= 0;
                      const pct = entry.maxCapacity > 0 ? Math.min(100, Math.round((used / entry.maxCapacity) * 100)) : 0;
                      const barColor = isFull ? '#ef4444' : remaining <= 2 ? '#f59e0b' : '#10b981';
                      return (
                        <div className="dsa-cell-body">
                          <div className="dsa-cell-controls">
                            <select className="dsa-cell-select" value={entry.staffCount} onChange={e => updateEntry(dateStr, { staffCount: Number(e.target.value) })}>
                              <option value={1}>1명</option><option value={2}>2명</option>
                            </select>
                            <label className="dsa-cell-holiday">
                              <input type="checkbox" checked={entry.isHoliday} onChange={e => updateEntry(dateStr, { isHoliday: e.target.checked })} />
                              <span>휴</span>
                            </label>
                            <span className={`dsa-cell-cap-inline ${isFull ? 'full' : remaining <= 2 ? 'low' : ''}`}>
                              {remaining}/{entry.maxCapacity}
                            </span>
                          </div>
                          <div className="dsa-cell-bar-wrap">
                            <div className="dsa-cell-bar" style={{ width: `${pct}%`, background: barColor }} />
                          </div>
                          <div className="dsa-cell-bar-label">{used}건 배정</div>
                        </div>
                      );
                    })()}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </>
    );
  };

  return (
    <div className="dsa-wrap">
      {renderMonthView()}

      <style>{`
        .dsa-wrap { padding: 16px; }
        .dsa-toggle { display: flex; gap: 2px; margin-right: auto; }
        .dsa-toggle-btn {
          padding: 6px 16px; border: 1px solid #d1d5db; border-radius: 6px;
          background: #fff; font-size: 13px; cursor: pointer; color: #6b7280;
          display: flex; align-items: center; gap: 5px;
        }
        .dsa-toggle-btn:hover { background: #f3f4f6; }
        .dsa-toggle-btn.active { background: #3b82f6; color: white; border-color: #3b82f6; }

        .dsa-nav { display: flex; align-items: center; gap: 16px; margin-bottom: 16px; width: 80%; margin-left: auto; margin-right: auto; }
        .dsa-nav-btn { padding: 4px 12px; border: 1px solid #d1d5db; border-radius: 6px; background: white; cursor: pointer; font-size: 13px; }
        .dsa-nav-btn:hover { background: #f3f4f6; }
        .dsa-nav-label { font-weight: 600; font-size: 15px; flex: 1; text-align: center; }

        /* 주간 테이블 */
        .dsa-table { width: 80%; margin: 0 auto; border-collapse: collapse; }
        .dsa-table th, .dsa-table td { padding: 8px 12px; border-bottom: 1px solid #e5e7eb; text-align: center; font-size: 13px; }
        .dsa-table th { background: #f9fafb; font-weight: 600; color: #374151; }
        .dsa-table .dsa-weekend { background: #f8fafc; }
        .dsa-table .dsa-today { background: #eff6ff; }

        /* 월간 달력 */
        .dsa-cal { border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; width: 80%; margin: 0 auto; }
        .dsa-cal-header { display: grid; grid-template-columns: repeat(7, 1fr); background: #f9fafb; border-bottom: 1px solid #e5e7eb; }
        .dsa-cal-hd { padding: 8px; text-align: center; font-size: 13px; font-weight: 600; color: #374151; }
        .dsa-cal-hd.weekend { color: #ef4444; }
        .dsa-cal-row { display: grid; grid-template-columns: repeat(7, 1fr); border-bottom: 1px solid #f3f4f6; }
        .dsa-cal-row:last-child { border-bottom: none; }

        .dsa-cal-cell {
          min-height: 110px; padding: 8px; border-right: 1px solid #f3f4f6;
          display: flex; flex-direction: column; gap: 4px;
        }
        .dsa-cal-cell:last-child { border-right: none; }
        .dsa-cal-cell.other-month { background: #fafafa; opacity: 0.4; }
        .dsa-cal-cell.today { background: #eff6ff; }
        .dsa-cal-cell.weekend .dsa-cell-date { color: #ef4444; }
        .dsa-cal-cell.holiday { background: #fef2f2; }
        .dsa-cal-cell.dirty { box-shadow: inset 0 0 0 2px #fbbf24; }

        .dsa-cell-date { font-size: 15px; font-weight: 600; color: #374151; }
        .dsa-cell-body { display: flex; flex-direction: column; gap: 4px; flex: 1; }
        .dsa-cell-controls {
          display: flex; align-items: center; gap: 4px;
        }
        .dsa-cell-select {
          width: auto; padding: 2px 4px; border: 1px solid #d1d5db; border-radius: 4px;
          font-size: 13px; background: white; box-sizing: border-box; flex-shrink: 0;
        }
        .dsa-cell-holiday {
          display: flex; align-items: center; gap: 2px; font-size: 12px; color: #ef4444; cursor: pointer; flex-shrink: 0;
        }
        .dsa-cell-holiday input { width: 11px; height: 11px; margin: 0; }
        .dsa-cell-cap-inline {
          font-size: 14px; font-weight: 600; color: #059669; margin-left: auto; white-space: nowrap;
        }
        .dsa-cell-cap-inline.low { color: #f59e0b; }
        .dsa-cell-cap-inline.full { color: #ef4444; }
        .dsa-cell-bar-wrap {
          width: 100%; height: 6px; background: #e5e7eb; border-radius: 3px; overflow: hidden;
        }
        .dsa-cell-bar {
          height: 100%; border-radius: 3px; transition: width 0.2s;
        }
        .dsa-cell-bar-label {
          font-size: 12px; color: #9ca3af; text-align: center;
        }

        .dsa-save-btn {
          background: #3b82f6; color: white; padding: 8px 24px;
          border: none; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 500;
        }
        .dsa-save-btn:hover:not(:disabled) { background: #2563eb; }
        .dsa-save-btn:disabled { opacity: 0.4; cursor: not-allowed; }
      `}</style>
    </div>
  );
}
