import React, { useMemo } from 'react';
import type { CalendarViewType, Doctor } from '../types';

interface CalendarHeaderProps {
  selectedDate: string;
  viewType: CalendarViewType;
  doctors: Doctor[];
  selectedDoctor: string | null;
  onViewTypeChange: (type: CalendarViewType) => void;
  onDoctorChange: (doctor: string | null) => void;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
  onDateChange: (date: string) => void;
}

const daysOfWeek = ['일', '월', '화', '수', '목', '금', '토'];

const getYYYYMMDD = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const CalendarHeader: React.FC<CalendarHeaderProps> = ({
  selectedDate,
  viewType,
  doctors,
  selectedDoctor,
  onViewTypeChange,
  onDoctorChange,
  onPrevious,
  onNext,
  onToday,
  onDateChange,
}) => {
  const currentDate = new Date(selectedDate);
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // 해당 월의 모든 날짜 생성
  const daysInMonth = useMemo(() => {
    const days: Date[] = [];
    const date = new Date(year, month, 1);
    while (date.getMonth() === month) {
      days.push(new Date(date));
      date.setDate(date.getDate() + 1);
    }
    return days;
  }, [year, month]);

  // 선택된 날짜 정보
  const selectedDay = currentDate.getDate();
  const selectedDayOfWeek = daysOfWeek[currentDate.getDay()];
  const selectedMonth = (month + 1).toString().padStart(2, '0');

  const handleDateClick = (day: Date) => {
    onDateChange(getYYYYMMDD(day));
  };

  const handlePrevMonth = () => {
    const newDate = new Date(year, month - 1, 1);
    onDateChange(getYYYYMMDD(newDate));
  };

  const handleNextMonth = () => {
    const newDate = new Date(year, month + 1, 1);
    onDateChange(getYYYYMMDD(newDate));
  };

  return (
    <div className="bg-white border-b">
      {/* 상단: 월 네비게이션 + 선택일자 + 필터 */}
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <button
              onClick={handlePrevMonth}
              className="w-10 h-10 flex items-center justify-center rounded-lg border border-gray-300 hover:bg-gray-100 font-bold text-lg focus:outline-none focus:ring-2 focus:ring-clinic-secondary"
              aria-label="이전 달"
            >
              &lt;
            </button>
            <h2 className="text-2xl font-bold text-gray-800">{`${year}년 ${String(month + 1).padStart(2, '0')}월`}</h2>
            <button
              onClick={handleNextMonth}
              className="w-10 h-10 flex items-center justify-center rounded-lg border border-gray-300 hover:bg-gray-100 font-bold text-lg focus:outline-none focus:ring-2 focus:ring-clinic-secondary"
              aria-label="다음 달"
            >
              &gt;
            </button>
          </div>
          <button
            onClick={onToday}
            className="px-4 py-2 text-sm font-semibold text-clinic-secondary border border-clinic-secondary rounded-lg hover:bg-clinic-secondary hover:text-white transition-colors"
          >
            오늘
          </button>
        </div>

        <h3 className="text-xl font-bold text-gray-800">
          {`선택일자: ${selectedMonth}월 ${String(selectedDay).padStart(2, '0')}일 (${selectedDayOfWeek})`}
        </h3>

        <div className="flex items-center gap-4">
          {/* 의사 필터 */}
          <select
            value={selectedDoctor || ''}
            onChange={(e) => onDoctorChange(e.target.value || null)}
            className="px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-clinic-secondary"
          >
            <option value="">전체 의료진</option>
            {doctors.map((doctor) => (
              <option key={doctor.id} value={doctor.name}>
                {doctor.name}
              </option>
            ))}
          </select>

          {/* 뷰 타입 토글 */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => onViewTypeChange('day')}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                viewType === 'day'
                  ? 'bg-white text-clinic-primary shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              일
            </button>
            <button
              onClick={() => onViewTypeChange('week')}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                viewType === 'week'
                  ? 'bg-white text-clinic-primary shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              주
            </button>
            <button
              onClick={() => onViewTypeChange('month')}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                viewType === 'month'
                  ? 'bg-white text-clinic-primary shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              월
            </button>
          </div>
        </div>
      </div>

      {/* 하단: 가로 날짜 캘린더 (일별 뷰에서만 표시) */}
      {viewType === 'day' && (
        <div className="bg-gray-50 px-4 py-3 border-t">
          <div className="flex gap-1 overflow-x-auto pb-1">
            {daysInMonth.map((day) => {
              const dayNumber = day.getDate();
              const dayOfWeekIndex = day.getDay();
              const isSelected = getYYYYMMDD(day) === selectedDate;
              const isToday = getYYYYMMDD(day) === getYYYYMMDD(new Date());

              // 요일별 색상
              let dayColorClass = 'text-gray-500';
              let dateColorClass = 'text-gray-800';

              if (dayOfWeekIndex === 0) {
                dayColorClass = 'text-red-500';
                dateColorClass = 'text-red-600';
              } else if (dayOfWeekIndex === 6) {
                dayColorClass = 'text-blue-500';
                dateColorClass = 'text-blue-600';
              }

              return (
                <button
                  key={day.toISOString()}
                  onClick={() => handleDateClick(day)}
                  className={`flex-shrink-0 w-12 flex flex-col items-center justify-center py-2 rounded-lg border transition-colors duration-150
                    ${isSelected
                      ? 'bg-blue-600 text-white shadow-md border-blue-600'
                      : isToday
                        ? 'bg-blue-50 border-blue-300 hover:bg-blue-100'
                        : 'bg-white hover:bg-gray-100 border-gray-200'
                    }
                  `}
                  aria-label={`${month + 1}월 ${dayNumber}일 ${daysOfWeek[dayOfWeekIndex]}요일`}
                  aria-pressed={isSelected}
                >
                  <span className={`text-sm font-semibold ${isSelected ? 'text-white' : dateColorClass}`}>
                    {String(dayNumber).padStart(2, '0')}
                  </span>
                  <span className={`text-xs mt-0.5 ${isSelected ? 'text-blue-100' : dayColorClass}`}>
                    {daysOfWeek[dayOfWeekIndex]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default CalendarHeader;
