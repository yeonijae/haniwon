import React, { useMemo } from 'react';
import type { Reservation } from '../types';

interface MonthViewProps {
  selectedDate: string;
  reservations: Reservation[];
  onDateClick: (date: string) => void;
}

export const MonthView: React.FC<MonthViewProps> = ({
  selectedDate,
  reservations,
  onDateClick,
}) => {
  const { year, month, days, startDay } = useMemo(() => {
    const date = new Date(selectedDate);
    const year = date.getFullYear();
    const month = date.getMonth();

    // 해당 월의 첫째 날
    const firstDay = new Date(year, month, 1);
    const startDay = firstDay.getDay();

    // 해당 월의 마지막 날
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();

    const days: (number | null)[] = [];

    // 시작 요일 전까지 빈 칸
    for (let i = 0; i < startDay; i++) {
      days.push(null);
    }

    // 날짜 채우기
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }

    return { year, month, days, startDay };
  }, [selectedDate]);

  // 날짜별 예약 수 계산
  const reservationCountByDate = useMemo(() => {
    const counts: Record<string, { total: number; visited: number; canceled: number }> = {};

    reservations.forEach((reservation) => {
      const date = reservation.date;
      if (!counts[date]) {
        counts[date] = { total: 0, visited: 0, canceled: 0 };
      }
      counts[date].total++;
      if (reservation.visited) counts[date].visited++;
      if (reservation.canceled) counts[date].canceled++;
    });

    return counts;
  }, [reservations]);

  const formatDate = (day: number): string => {
    const m = (month + 1).toString().padStart(2, '0');
    const d = day.toString().padStart(2, '0');
    return `${year}-${m}-${d}`;
  };

  const today = new Date().toISOString().split('T')[0];
  const weekDays = ['일', '월', '화', '수', '목', '금', '토'];

  return (
    <div className="flex-1 overflow-auto p-4">
      <div className="bg-white rounded-lg border shadow-sm">
        {/* 요일 헤더 */}
        <div className="grid grid-cols-7 border-b">
          {weekDays.map((day, index) => (
            <div
              key={day}
              className={`py-3 text-center font-semibold ${
                index === 0 ? 'text-red-500' : index === 6 ? 'text-blue-500' : 'text-gray-700'
              }`}
            >
              {day}
            </div>
          ))}
        </div>

        {/* 날짜 그리드 */}
        <div className="grid grid-cols-7">
          {days.map((day, index) => {
            if (day === null) {
              return <div key={`empty-${index}`} className="min-h-24 border-b border-r bg-gray-50"></div>;
            }

            const dateStr = formatDate(day);
            const counts = reservationCountByDate[dateStr];
            const isToday = dateStr === today;
            const isSelected = dateStr === selectedDate;
            const dayOfWeek = (startDay + day - 1) % 7;
            const isSunday = dayOfWeek === 0;
            const isSaturday = dayOfWeek === 6;

            return (
              <div
                key={day}
                onClick={() => onDateClick(dateStr)}
                className={`min-h-24 border-b border-r p-2 cursor-pointer hover:bg-gray-50 transition-colors ${
                  isSelected ? 'bg-blue-50 ring-2 ring-blue-300 ring-inset' : ''
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={`inline-flex items-center justify-center w-7 h-7 text-sm font-medium rounded-full ${
                      isToday
                        ? 'bg-clinic-primary text-white'
                        : isSunday
                        ? 'text-red-500'
                        : isSaturday
                        ? 'text-blue-500'
                        : 'text-gray-700'
                    }`}
                  >
                    {day}
                  </span>
                </div>

                {counts && counts.total > 0 && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-1 text-xs">
                      <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                      <span className="text-gray-600">
                        예약 {counts.total - counts.canceled}건
                      </span>
                    </div>
                    {counts.visited > 0 && (
                      <div className="flex items-center gap-1 text-xs">
                        <span className="w-2 h-2 rounded-full bg-green-500"></span>
                        <span className="text-gray-600">내원 {counts.visited}건</span>
                      </div>
                    )}
                    {counts.canceled > 0 && (
                      <div className="flex items-center gap-1 text-xs">
                        <span className="w-2 h-2 rounded-full bg-gray-400"></span>
                        <span className="text-gray-400">취소 {counts.canceled}건</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default MonthView;
