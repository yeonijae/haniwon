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
        <div className="flex items-center gap-2" style={{ position: 'relative' }}>
          <button onClick={handlePrevMonth} style={{
            padding: '5px 10px', border: '1px solid #d1d5db', borderRadius: 6, background: 'white', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: '#374151'
          }}>◀</button>
          <button onClick={() => { setShowDatePicker(!showDatePicker); setPickerMode('month'); }} style={{
            padding: '5px 14px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14, fontWeight: 600, color: '#374151', background: 'white', cursor: 'pointer', whiteSpace: 'nowrap'
          }}>
            {`${String(year).slice(2)}년 ${month + 1}월`}
          </button>
          <button onClick={handleNextMonth} style={{
            padding: '5px 10px', border: '1px solid #d1d5db', borderRadius: 6, background: 'white', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: '#374151'
          }}>▶</button>
          {!isToday && (
            <button onClick={onToday} style={{
              padding: '5px 12px', border: '1px solid #d1d5db', borderRadius: 6, background: '#ec4899', color: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 600
            }}>오늘</button>
          )}

          {/* 년월 선택 팝업 */}
          {showDatePicker && (
            <div
              ref={pickerRef}
              className="absolute top-full left-0 mt-2 bg-white rounded-xl shadow-2xl border border-gray-200 p-4 z-50 min-w-[280px]"
            >
              {pickerMode === 'month' ? (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <button onClick={() => setPickerYear(pickerYear - 1)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-600">&lt;</button>
                    <button onClick={() => setPickerMode('year')} className="text-lg font-bold text-gray-800 hover:text-clinic-primary hover:bg-gray-100 px-3 py-1 rounded-lg">{pickerYear}년</button>
                    <button onClick={() => setPickerYear(pickerYear + 1)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-600">&gt;</button>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {Array.from({ length: 12 }, (_, i) => i).map((m) => (
                      <button key={m} onClick={() => { onDateChange(getYYYYMMDD(new Date(pickerYear, m, 1))); setShowDatePicker(false); setPickerMode('month'); }}
                        className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${pickerYear === year && m === month ? 'bg-clinic-primary text-white' : 'hover:bg-gray-100 text-gray-700'}`}
                      >{m + 1}월</button>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <button onClick={() => setPickerYear(pickerYear - 10)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-600">&lt;&lt;</button>
                    <span className="text-lg font-bold text-gray-800">{Math.floor(pickerYear / 10) * 10} - {Math.floor(pickerYear / 10) * 10 + 9}</span>
                    <button onClick={() => setPickerYear(pickerYear + 10)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-600">&gt;&gt;</button>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {Array.from({ length: 12 }, (_, i) => Math.floor(pickerYear / 10) * 10 - 1 + i).map((y) => (
                      <button key={y} onClick={() => { setPickerYear(y); setPickerMode('month'); }}
                        className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${y === year ? 'bg-clinic-primary text-white' : y < Math.floor(pickerYear / 10) * 10 || y > Math.floor(pickerYear / 10) * 10 + 9 ? 'text-gray-300' : 'hover:bg-gray-100 text-gray-700'}`}
                      >{y}</button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
        {/* 선택 날짜 */}
        <span style={{ fontSize: 15, fontWeight: 700, color: '#374151' }}>
          {`${selectedMonth}.${String(selectedDay).padStart(2,'0')}(${selectedDayOfWeek})`}
        </span>
        {/* 일간 통계 */}
        {dayStats.total > 0 && (
          <div style={{ display: 'flex', gap: 0, border: '1px solid #d1d5db', borderRadius: 6, overflow: 'hidden', fontSize: 13, fontWeight: 500 }}>
            <span style={{ padding: '5px 12px', borderRight: '1px solid #d1d5db', background: '#f9fafb', color: '#374151' }}>
              총<b>{dayStats.total}</b>
            </span>
            <span style={{ padding: '5px 12px', borderRight: '1px solid #d1d5db', background: '#f0fdf4', color: '#16a34a' }}>
              내원 <b>{dayStats.visited}</b> <span style={{ fontSize: 11 }}>({dayStats.total > 0 ? Math.round((dayStats.visited / dayStats.total) * 100) : 0}%)</span>
            </span>
            <span style={{ padding: '5px 12px', borderRight: '1px solid #d1d5db', background: '#fff7ed', color: '#ea580c' }}>
              취소 <b>{dayStats.canceled}</b> <span style={{ fontSize: 11 }}>({dayStats.total > 0 ? Math.round((dayStats.canceled / dayStats.total) * 100) : 0}%)</span>
            </span>
            {dayStats.noShow > 0 && (
              <span style={{ padding: '5px 12px', borderRight: '1px solid #d1d5db', background: '#fef2f2', color: '#dc2626' }}>
                노쇼 <b>{dayStats.noShow}</b> <span style={{ fontSize: 11 }}>({Math.round((dayStats.noShow / dayStats.total) * 100)}%)</span>
              </span>
            )}
            {selectedDate >= today && (
              <span style={{ padding: '5px 12px', borderRight: dayStats.acuVisited > 0 ? '1px solid #d1d5db' : 'none', background: '#eff6ff', color: '#2563eb' }}>
                대기 <b>{dayStats.total - dayStats.visited - dayStats.canceled}</b>
              </span>
            )}
            {dayStats.acuVisited > 0 && (
              <span style={{ padding: '5px 12px', background: '#faf5ff', color: '#7c3aed' }}>
                현장예약 <b>{dayStats.visitedWithNextReservation}</b>/{dayStats.acuVisited} <span style={{ fontSize: 11 }}>({Math.round((dayStats.visitedWithNextReservation / dayStats.acuVisited) * 100)}%)</span>
              </span>
            )}
          </div>
        )}
        </div>

        <div className="flex items-center gap-4">
          {/* 의사 필터 */}
          <div style={{ display: 'flex', gap: 0, border: '1px solid #d1d5db', borderRadius: 6, overflow: 'hidden' }}>
            <button onClick={() => onDoctorChange(null)} style={{
              padding: '5px 12px', border: 'none', borderRight: '1px solid #d1d5db', background: !selectedDoctor ? '#6366f1' : '#fff', color: !selectedDoctor ? '#fff' : '#6b7280', fontSize: 13, fontWeight: 500, cursor: 'pointer'
            }}>전체</button>
            {doctors.map((doctor) => (
              <button key={doctor.id} onClick={() => onDoctorChange(doctor.name)} style={{
                padding: '5px 12px', border: 'none', borderRight: '1px solid #d1d5db', background: selectedDoctor === doctor.name ? '#6366f1' : '#fff', color: selectedDoctor === doctor.name ? '#fff' : '#6b7280', fontSize: 13, fontWeight: 500, cursor: 'pointer'
              }}>{doctor.name}</button>
            ))}
          </div>

          {/* 뷰 타입 토글 */}
          <div style={{ display: 'flex', gap: 0, border: '1px solid #d1d5db', borderRadius: 6, overflow: 'hidden' }}>
            {(['day', 'week', 'month'] as const).map((v, i) => (
              <button key={v} onClick={() => onViewTypeChange(v)} style={{
                padding: '5px 12px', border: 'none', borderRight: i < 2 ? '1px solid #d1d5db' : 'none', background: viewType === v ? '#0d9488' : '#fff', color: viewType === v ? '#fff' : '#6b7280', fontSize: 13, fontWeight: 500, cursor: 'pointer'
              }}>{v === 'day' ? '일' : v === 'week' ? '주' : '월'}</button>
            ))}
          </div>
        </div>
      </div>

      {/* 하단: 가로 날짜 캘린더 (일별 뷰에서만 표시) */}
      {viewType === 'day' && (
        <div className="bg-gray-50 px-4 py-3 border-t">
          <div className="flex overflow-x-auto pb-1" style={{ gap: '3px' }}>
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
                  className={`flex-shrink-0 flex flex-col items-center justify-center py-2 rounded-lg border transition-colors duration-150
                    ${isSelected
                      ? 'bg-blue-600 text-white shadow-md border-blue-600'
                      : isToday
                        ? 'bg-blue-50 border-blue-300 hover:bg-blue-100'
                        : 'bg-white hover:bg-gray-100 border-gray-200'
                    }
                  `}
                  style={{ width: '44px' }}
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
