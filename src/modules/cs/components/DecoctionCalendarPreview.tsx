import { useState, useEffect, useCallback, useMemo } from 'react';
import { getDecoctionCapacity } from '../lib/api';
import type { DecoctionDayCapacity } from '../types';

interface DecoctionCalendarPreviewProps {
  selectedDate?: string;
  onDateSelect?: (date: string) => void;
  readonly?: boolean;
}

const DAY_NAMES = ['월', '화', '수', '목', '금', '토', '일'];

/** weekOffset=0이면 이번 주 월요일, ±N이면 N주 전/후 월요일 */
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

function getUsageClass(day: DecoctionDayCapacity): string {
  if (day.maxCapacity === 0) return 'holiday';
  const ratio = day.usedCapacity / day.maxCapacity;
  if (ratio >= 1) return 'full';
  if (ratio >= 0.7) return 'warning';
  return 'available';
}

function getBarColor(day: DecoctionDayCapacity): string {
  if (day.maxCapacity === 0) return '#cbd5e1';
  const ratio = day.usedCapacity / day.maxCapacity;
  if (ratio >= 1) return '#ef4444';
  if (ratio >= 0.7) return '#eab308';
  return '#22c55e';
}

export default function DecoctionCalendarPreview({
  selectedDate,
  onDateSelect,
  readonly = false,
}: DecoctionCalendarPreviewProps) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [capacity, setCapacity] = useState<DecoctionDayCapacity[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingDate, setPendingDate] = useState<string | null>(null);

  const todayStr = useMemo(() => formatDate(new Date()), []);

  const weekStart = useMemo(() => getWeekStart(weekOffset), [weekOffset]);
  const weekEnd = useMemo(() => {
    const end = new Date(weekStart);
    end.setDate(end.getDate() + 6);
    return end;
  }, [weekStart]);

  const weekLabel = useMemo(() => {
    const s = weekStart;
    const e = weekEnd;
    return `${s.getMonth() + 1}/${s.getDate()} ~ ${e.getMonth() + 1}/${e.getDate()}`;
  }, [weekStart, weekEnd]);

  const loadCapacity = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getDecoctionCapacity(formatDate(weekStart), formatDate(weekEnd));
      setCapacity(data);
    } catch (err) {
      console.error('탕전 캘린더 로딩 오류:', err);
      setError('캘린더 데이터를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [weekStart, weekEnd]);

  useEffect(() => {
    loadCapacity();
  }, [loadCapacity]);

  // 7일 날짜 배열 생성 (capacity에 없는 날짜도 빈 데이터로 표시)
  const days = useMemo(() => {
    const result: DecoctionDayCapacity[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      const dateStr = formatDate(d);
      const found = capacity.find((c) => c.date === dateStr);
      if (found) {
        result.push(found);
      } else {
        result.push({
          date: dateStr,
          staffCount: 0,
          isHoliday: false,
          isWeekend: i >= 5,
          maxCapacity: 0,
          usedCapacity: 0,
          remainingCapacity: 0,
        });
      }
    }
    return result;
  }, [weekStart, capacity]);

  const TIME_SLOTS = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'];

  const handleDayClick = useCallback(
    (day: DecoctionDayCapacity) => {
      if (readonly || !onDateSelect) return;
      if (day.remainingCapacity <= 0 && day.maxCapacity > 0) return;
      if (day.maxCapacity === 0) return;
      setPendingDate(prev => prev === day.date ? null : day.date);
    },
    [readonly, onDateSelect]
  );

  const handleTimeSelect = useCallback(
    (time: string) => {
      if (!pendingDate || !onDateSelect) return;
      onDateSelect(`${pendingDate} ${time}`);
      setPendingDate(null);
    },
    [pendingDate, onDateSelect]
  );

  return (
    <div className="decoction-calendar">
      {/* 네비게이션 */}
      <div className="decoction-calendar-nav">
        <button
          type="button"
          className="decoction-nav-btn"
          onClick={() => setWeekOffset((prev) => prev - 1)}
        >
          &larr; 이전주
        </button>
        <div className="decoction-nav-center">
          <span className="decoction-week-label">{weekLabel}</span>
          {weekOffset !== 0 && (
            <button
              type="button"
              className="decoction-nav-btn decoction-nav-today"
              onClick={() => setWeekOffset(0)}
            >
              이번주
            </button>
          )}
        </div>
        <button
          type="button"
          className="decoction-nav-btn"
          onClick={() => setWeekOffset((prev) => prev + 1)}
        >
          다음주 &rarr;
        </button>
      </div>

      {/* 로딩/에러 상태 */}
      {loading && <div className="decoction-loading">로딩 중...</div>}
      {error && <div className="decoction-error">{error}</div>}

      {/* 캘린더 그리드 */}
      {!loading && !error && (
        <div className="decoction-calendar-grid">
          {days.map((day, idx) => {
            const isToday = day.date === todayStr;
            const isSelected = day.date === selectedDate || (selectedDate?.startsWith(day.date) ?? false);
            const isPending = day.date === pendingDate;
            const usageClass = getUsageClass(day);
            const isWeekend = idx >= 5;
            const isClickable =
              !readonly &&
              !!onDateSelect &&
              day.maxCapacity > 0 &&
              day.remainingCapacity > 0;
            const fillPct =
              day.maxCapacity > 0
                ? Math.min(100, Math.round((day.usedCapacity / day.maxCapacity) * 100))
                : 0;

            const d = new Date(day.date + 'T00:00:00');
            const dateLabel = `${d.getMonth() + 1}/${d.getDate()}`;

            return (
              <div
                key={day.date}
                className={[
                  'decoction-day-cell',
                  usageClass,
                  isWeekend ? 'weekend' : '',
                  isSelected ? 'selected' : '',
                  isPending ? 'pending' : '',
                  isToday ? 'today' : '',
                  isClickable ? 'clickable' : '',
                ].filter(Boolean).join(' ')}
                onClick={() => isClickable && handleDayClick(day)}
              >
                <div className="decoction-day-header">
                  <span className="decoction-day-date">{dateLabel}</span>
                  <span className="decoction-day-name">{DAY_NAMES[idx]}</span>
                  {isToday && <span className="decoction-today-badge">오늘</span>}
                </div>

                <div className="decoction-day-staff">
                  인력: {day.staffCount}명
                </div>

                <div className="decoction-capacity-bar">
                  <div
                    className="decoction-capacity-fill"
                    style={{
                      width: `${fillPct}%`,
                      backgroundColor: getBarColor(day),
                    }}
                  />
                </div>

                <div className="decoction-day-remaining">
                  {day.maxCapacity === 0
                    ? '휴무'
                    : day.remainingCapacity > 0
                      ? `잔여 ${day.remainingCapacity}건`
                      : '마감'}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 시간 슬롯 선택 */}
      {pendingDate && !readonly && (
        <div className="decoction-time-picker">
          <div className="decoction-time-label">
            탕전 예정: {(() => { const [,m,d] = pendingDate.split('-'); return `${Number(m)}/${Number(d)}`; })()} ({DAY_NAMES[(() => { const d = new Date(pendingDate + 'T00:00:00'); const day = d.getDay(); return day === 0 ? 6 : day - 1; })()]})
          </div>
          <div className="decoction-time-slots">
            {TIME_SLOTS.map(t => {
              const isSelected = selectedDate === `${pendingDate} ${t}`;
              return (
                <button
                  key={t}
                  type="button"
                  className={`decoction-time-slot ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleTimeSelect(t)}
                >
                  {t}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <style>{`
        .decoction-calendar {
          width: 100%;
          font-size: 13px;
        }

        .decoction-calendar-nav {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 8px;
          gap: 8px;
        }

        .decoction-nav-center {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .decoction-week-label {
          font-weight: 600;
          font-size: 13px;
          color: #334155;
        }

        .decoction-nav-btn {
          background: #f1f5f9;
          border: 1px solid #cbd5e1;
          border-radius: 4px;
          padding: 3px 10px;
          font-size: 12px;
          color: #475569;
          cursor: pointer;
          white-space: nowrap;
        }

        .decoction-nav-btn:hover {
          background: #e2e8f0;
        }

        .decoction-nav-today {
          font-size: 11px;
          padding: 2px 8px;
        }

        .decoction-loading,
        .decoction-error {
          text-align: center;
          padding: 24px 0;
          color: #64748b;
          font-size: 13px;
        }

        .decoction-error {
          color: #dc2626;
        }

        .decoction-calendar-grid {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 4px;
        }

        .decoction-day-cell {
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          padding: 6px;
          display: flex;
          flex-direction: column;
          gap: 4px;
          background: #ffffff;
          min-height: 90px;
          transition: border-color 0.15s, box-shadow 0.15s;
        }

        .decoction-day-cell.clickable {
          cursor: pointer;
        }

        .decoction-day-cell.clickable:hover {
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
        }

        .decoction-day-cell.available {
          background: #f0fdf4;
        }

        .decoction-day-cell.warning {
          background: #fefce8;
        }

        .decoction-day-cell.full {
          background: #fef2f2;
          cursor: not-allowed;
        }

        .decoction-day-cell.holiday {
          background: #f8fafc;
          color: #94a3b8;
        }

        .decoction-day-cell.weekend {
          background-color: #f8fafc;
        }

        .decoction-day-cell.weekend.available {
          background: linear-gradient(135deg, #f0fdf4, #f8fafc);
        }

        .decoction-day-cell.weekend.warning {
          background: linear-gradient(135deg, #fefce8, #f8fafc);
        }

        .decoction-day-cell.weekend.full {
          background: linear-gradient(135deg, #fef2f2, #f8fafc);
        }

        .decoction-day-cell.selected {
          border-color: #3b82f6;
          background: #dbeafe !important;
          box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.25);
        }

        .decoction-day-cell.pending {
          border-color: #0ea5e9;
          background: #e0f2fe !important;
          box-shadow: 0 0 0 2px rgba(14, 165, 233, 0.3);
        }

        .decoction-day-cell.today {
          border-color: #6366f1;
        }

        .decoction-day-header {
          display: flex;
          align-items: center;
          gap: 4px;
          font-weight: 600;
        }

        .decoction-day-date {
          font-size: 13px;
          color: #1e293b;
        }

        .decoction-day-name {
          font-size: 11px;
          color: #64748b;
        }

        .decoction-today-badge {
          font-size: 10px;
          background: #6366f1;
          color: #fff;
          border-radius: 3px;
          padding: 0 4px;
          line-height: 16px;
          font-weight: 500;
        }

        .decoction-day-staff {
          font-size: 11px;
          color: #64748b;
        }

        .decoction-capacity-bar {
          height: 8px;
          background: #e2e8f0;
          border-radius: 4px;
          overflow: hidden;
        }

        .decoction-capacity-fill {
          height: 100%;
          border-radius: 4px;
          transition: width 0.3s ease;
        }

        .decoction-day-remaining {
          font-size: 11px;
          font-weight: 600;
          color: #334155;
        }

        .decoction-day-cell.full .decoction-day-remaining {
          color: #dc2626;
        }

        .decoction-day-cell.holiday .decoction-day-remaining {
          color: #94a3b8;
          font-weight: 400;
        }

        .decoction-time-picker {
          margin-top: 10px;
          padding: 10px 12px;
          background: #f0f9ff;
          border: 1px solid #bae6fd;
          border-radius: 8px;
        }
        .decoction-time-label {
          font-size: 13px;
          font-weight: 600;
          color: #0369a1;
          margin-bottom: 8px;
        }
        .decoction-time-slots {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }
        .decoction-time-slot {
          padding: 5px 12px;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          background: #fff;
          font-size: 12px;
          font-weight: 500;
          color: #374151;
          cursor: pointer;
          transition: all 0.15s;
        }
        .decoction-time-slot:hover {
          background: #eff6ff;
          border-color: #93c5fd;
          color: #2563eb;
        }
        .decoction-time-slot.selected {
          background: #3b82f6;
          color: #fff;
          border-color: #3b82f6;
        }
      `}</style>
    </div>
  );
}
