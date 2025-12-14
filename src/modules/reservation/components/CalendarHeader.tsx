import React, { useMemo, useState, useRef, useEffect } from 'react';
import type { CalendarViewType, Doctor, Reservation } from '../types';
import { fetchOnSiteReservationCount } from '../lib/api';

// 통계 데이터 타입
interface DayStats {
  total: number;
  visited: number;
  canceled: number;
  noShow: number;
  acuVisited: number; // 침치료 환자 수 (자보 + 청구금>0)
  visitedWithNextReservation: number; // 침치료 후 다음 예약 잡은 수
}

interface CalendarHeaderProps {
  selectedDate: string;
  viewType: CalendarViewType;
  doctors: Doctor[];
  selectedDoctor: string | null;
  reservations?: Reservation[]; // 통계용
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
  reservations = [],
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

  // 오늘 날짜인지 확인
  const today = getYYYYMMDD(new Date());
  const isToday = selectedDate === today;

  // 현장예약 데이터 (API에서 조회) - 침치료 환자 기준
  const [onSiteData, setOnSiteData] = useState<{ visited_count: number; on_site_count: number }>({ visited_count: 0, on_site_count: 0 });

  useEffect(() => {
    const loadOnSiteData = async () => {
      try {
        const data = await fetchOnSiteReservationCount(selectedDate);
        setOnSiteData({ visited_count: data.visited_count, on_site_count: data.on_site_count });
      } catch (err) {
        console.error('현장예약 카운트 조회 실패:', err);
        setOnSiteData({ visited_count: 0, on_site_count: 0 });
      }
    };
    loadOnSiteData();
  }, [selectedDate, reservations]); // reservations 변경 시에도 새로고침

  // 선택된 날짜의 예약 통계 계산
  const dayStats = useMemo((): DayStats => {
    const dayReservations = reservations.filter(r => r.date === selectedDate);
    const total = dayReservations.length;
    const canceled = dayReservations.filter(r => r.canceled).length;
    const visited = dayReservations.filter(r => r.visited && !r.canceled).length;
    // 노쇼: 오늘 이전 날짜인데 내원도 안하고 취소도 안한 예약
    const isPastDate = selectedDate < today;
    const noShow = isPastDate
      ? dayReservations.filter(r => !r.visited && !r.canceled).length
      : 0;

    return {
      total,
      visited,
      canceled,
      noShow,
      acuVisited: onSiteData.visited_count,  // 침치료 환자 수
      visitedWithNextReservation: onSiteData.on_site_count  // 침치료 후 예약 잡은 수
    };
  }, [reservations, selectedDate, today, onSiteData]);

  // 날짜 선택 팝업 상태
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickerYear, setPickerYear] = useState(year);
  const [pickerMode, setPickerMode] = useState<'month' | 'year'>('month');
  const pickerRef = useRef<HTMLDivElement>(null);

  // 팝업 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowDatePicker(false);
        setPickerMode('month');
      }
    };
    if (showDatePicker) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDatePicker]);

  // 팝업 열 때 현재 년도로 초기화
  useEffect(() => {
    if (showDatePicker) {
      setPickerYear(year);
    }
  }, [showDatePicker, year]);

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
          <div className="flex items-center space-x-2 relative">
            <button
              onClick={handlePrevMonth}
              className="w-10 h-10 flex items-center justify-center rounded-lg border border-gray-300 hover:bg-gray-100 font-bold text-lg focus:outline-none focus:ring-2 focus:ring-clinic-secondary"
              aria-label="이전 달"
            >
              &lt;
            </button>
            <button
              onClick={() => setShowDatePicker(!showDatePicker)}
              className="text-2xl font-bold text-gray-800 hover:text-clinic-primary hover:bg-gray-100 px-3 py-1 rounded-lg transition-colors cursor-pointer"
            >
              {`${year}년 ${String(month + 1).padStart(2, '0')}월`}
            </button>
            <button
              onClick={handleNextMonth}
              className="w-10 h-10 flex items-center justify-center rounded-lg border border-gray-300 hover:bg-gray-100 font-bold text-lg focus:outline-none focus:ring-2 focus:ring-clinic-secondary"
              aria-label="다음 달"
            >
              &gt;
            </button>

            {/* 날짜 선택 팝업 */}
            {showDatePicker && (
              <div
                ref={pickerRef}
                className="absolute top-full left-0 mt-2 bg-white rounded-xl shadow-2xl border border-gray-200 p-4 z-50 min-w-[280px]"
              >
                {pickerMode === 'month' ? (
                  <>
                    {/* 년도 선택 헤더 */}
                    <div className="flex items-center justify-between mb-4">
                      <button
                        onClick={() => setPickerYear(pickerYear - 1)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-600"
                      >
                        &lt;
                      </button>
                      <button
                        onClick={() => setPickerMode('year')}
                        className="text-lg font-bold text-gray-800 hover:text-clinic-primary hover:bg-gray-100 px-3 py-1 rounded-lg"
                      >
                        {pickerYear}년
                      </button>
                      <button
                        onClick={() => setPickerYear(pickerYear + 1)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-600"
                      >
                        &gt;
                      </button>
                    </div>
                    {/* 월 그리드 */}
                    <div className="grid grid-cols-4 gap-2">
                      {Array.from({ length: 12 }, (_, i) => i).map((m) => {
                        const isCurrentMonth = pickerYear === year && m === month;
                        return (
                          <button
                            key={m}
                            onClick={() => {
                              onDateChange(getYYYYMMDD(new Date(pickerYear, m, 1)));
                              setShowDatePicker(false);
                              setPickerMode('month');
                            }}
                            className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors
                              ${isCurrentMonth
                                ? 'bg-clinic-primary text-white'
                                : 'hover:bg-gray-100 text-gray-700'
                              }`}
                          >
                            {m + 1}월
                          </button>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <>
                    {/* 년도 범위 선택 헤더 */}
                    <div className="flex items-center justify-between mb-4">
                      <button
                        onClick={() => setPickerYear(pickerYear - 10)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-600"
                      >
                        &lt;&lt;
                      </button>
                      <span className="text-lg font-bold text-gray-800">
                        {Math.floor(pickerYear / 10) * 10} - {Math.floor(pickerYear / 10) * 10 + 9}
                      </span>
                      <button
                        onClick={() => setPickerYear(pickerYear + 10)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-600"
                      >
                        &gt;&gt;
                      </button>
                    </div>
                    {/* 년도 그리드 */}
                    <div className="grid grid-cols-4 gap-2">
                      {Array.from({ length: 12 }, (_, i) => Math.floor(pickerYear / 10) * 10 - 1 + i).map((y) => {
                        const isCurrentYear = y === year;
                        const isOutOfRange = y < Math.floor(pickerYear / 10) * 10 || y > Math.floor(pickerYear / 10) * 10 + 9;
                        return (
                          <button
                            key={y}
                            onClick={() => {
                              setPickerYear(y);
                              setPickerMode('month');
                            }}
                            className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors
                              ${isCurrentYear
                                ? 'bg-clinic-primary text-white'
                                : isOutOfRange
                                  ? 'text-gray-300'
                                  : 'hover:bg-gray-100 text-gray-700'
                              }`}
                          >
                            {y}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
          <button
            onClick={onToday}
            className="px-4 py-2 text-sm font-semibold text-clinic-secondary border border-clinic-secondary rounded-lg hover:bg-clinic-secondary hover:text-white transition-colors"
          >
            오늘
          </button>
        </div>

        <div className="flex items-center gap-6">
          <h3 className="text-xl font-bold text-gray-800">
            {`${selectedMonth}월 ${String(selectedDay).padStart(2, '0')}일 (${selectedDayOfWeek})`}
          </h3>
          {/* 일간 통계 */}
          {dayStats.total > 0 && (
            <div className="flex items-center gap-3 text-sm">
              <span className="text-gray-600">
                총 <span className="font-bold text-gray-800">{dayStats.total}</span>
              </span>
              <span className="text-green-600">
                내원 <span className="font-bold">{dayStats.visited}</span>
                <span className="text-xs ml-0.5">
                  ({dayStats.total > 0 ? Math.round((dayStats.visited / dayStats.total) * 100) : 0}%)
                </span>
              </span>
              <span className="text-orange-500">
                취소 <span className="font-bold">{dayStats.canceled}</span>
                <span className="text-xs ml-0.5">
                  ({dayStats.total > 0 ? Math.round((dayStats.canceled / dayStats.total) * 100) : 0}%)
                </span>
              </span>
              {dayStats.noShow > 0 && (
                <span className="text-red-500">
                  노쇼 <span className="font-bold">{dayStats.noShow}</span>
                  <span className="text-xs ml-0.5">
                    ({Math.round((dayStats.noShow / dayStats.total) * 100)}%)
                  </span>
                </span>
              )}
              {/* 대기 중 (오늘/미래) */}
              {selectedDate >= today && (
                <span className="text-blue-500">
                  대기 <span className="font-bold">{dayStats.total - dayStats.visited - dayStats.canceled}</span>
                </span>
              )}
              {/* 현장예약율 (침치료 환자가 있을 때만) */}
              {dayStats.acuVisited > 0 && (
                <span className="text-purple-600 border-l border-gray-300 pl-3 ml-1">
                  <i className="fa-solid fa-calendar-plus mr-1 text-xs"></i>
                  현장예약 <span className="font-bold">{dayStats.visitedWithNextReservation}</span>/{dayStats.acuVisited}
                  <span className="text-xs ml-0.5">
                    ({Math.round((dayStats.visitedWithNextReservation / dayStats.acuVisited) * 100)}%)
                  </span>
                </span>
              )}
            </div>
          )}
        </div>

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
