/**
 * 오늘 예약 현황 컴포넌트 (Visual Time Routing)
 */

import { useState, useEffect, useRef } from 'react';
import type { TodayReservation, TimeSlot } from '../types';
import { useTheme } from '../contexts/ThemeContext';

interface Props {
  doctorId: number;
  doctorName: string;
  doctorColor: string;
  onPatientClick?: (reservation: TodayReservation) => void;
}

// 시간 슬롯 생성 (09:00 ~ 20:30, 30분 단위)
const generateTimeSlots = (): string[] => {
  const slots: string[] = [];
  for (let hour = 9; hour <= 20; hour++) {
    slots.push(`${hour.toString().padStart(2, '0')}:00`);
    if (hour < 20 || (hour === 20 && true)) {
      slots.push(`${hour.toString().padStart(2, '0')}:30`);
    }
  }
  return slots;
};

const TIME_SLOTS = generateTimeSlots();

// 예약 타입별 색상
const RESERVATION_TYPE_COLORS: Record<string, string> = {
  initial: '#10B981',    // 초진 - 초록
  return: '#3B82F6',     // 재진 - 파랑
  re_initial: '#F59E0B', // 재초진 - 주황
};

// 상태별 스타일
const STATUS_STYLES: Record<string, { opacity: number; decoration: string }> = {
  pending: { opacity: 1, decoration: 'none' },
  visited: { opacity: 0.6, decoration: 'none' },
  canceled: { opacity: 0.4, decoration: 'line-through' },
  no_show: { opacity: 0.4, decoration: 'line-through' },
};

export function TodaySchedule({ doctorId, doctorName, doctorColor, onPatientClick }: Props) {
  const [reservations, setReservations] = useState<TodayReservation[]>([]);
  const [loading, setLoading] = useState(true);
  const currentTimeRef = useRef<HTMLDivElement>(null);

  // 현재 시간 가져오기
  const getCurrentTime = () => {
    const now = new Date();
    return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  };

  const [currentTime, setCurrentTime] = useState(getCurrentTime());

  // 예약 데이터 로드
  useEffect(() => {
    loadReservations();

    // 1분마다 현재 시간 업데이트
    const interval = setInterval(() => {
      setCurrentTime(getCurrentTime());
    }, 60000);

    return () => clearInterval(interval);
  }, [doctorId]);

  // 현재 시간으로 스크롤
  useEffect(() => {
    if (!loading && currentTimeRef.current) {
      currentTimeRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [loading]);

  const loadReservations = async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const response = await fetch(
        `${import.meta.env.VITE_POSTGRES_API_URL || 'http://192.168.0.173:3200'}/api/reservations?date=${today}&doctorId=${doctorId}`
      );

      if (response.ok) {
        const data = await response.json();
        // API 응답을 TodayReservation 형식으로 변환
        const mapped: TodayReservation[] = (data.reservations || data || []).map((r: any) => ({
          id: r.id,
          patientId: r.patient_id || r.patientId,
          patientName: r.patient_name || r.patientName || '환자',
          chartNumber: r.chart_number || r.chartNumber || '',
          time: r.time?.substring(0, 5) || r.reservation_time?.substring(0, 5) || '09:00',
          treatmentType: r.treatment_type || r.treatmentType || r.item || '침',
          reservationType: r.reservation_type || r.reservationType || 'return',
          status: r.status || 'pending',
          memo: r.memo || '',
        }));
        setReservations(mapped);
      }
    } catch (error) {
      console.error('Failed to load reservations:', error);
    } finally {
      setLoading(false);
    }
  };

  // 시간 슬롯별 예약 그룹화
  const getSlotReservations = (slotTime: string): TodayReservation[] => {
    return reservations.filter(r => r.time === slotTime);
  };

  // 점심시간 여부
  const isLunchTime = (time: string): boolean => {
    const hour = parseInt(time.split(':')[0]);
    return hour === 13;
  };

  // 현재 시간 슬롯 여부
  const isCurrentSlot = (slotTime: string): boolean => {
    const [slotHour, slotMin] = slotTime.split(':').map(Number);
    const [curHour, curMin] = currentTime.split(':').map(Number);
    const slotMinutes = slotHour * 60 + slotMin;
    const curMinutes = curHour * 60 + curMin;
    return curMinutes >= slotMinutes && curMinutes < slotMinutes + 30;
  };

  // 지난 시간 여부
  const isPastSlot = (slotTime: string): boolean => {
    const [slotHour, slotMin] = slotTime.split(':').map(Number);
    const [curHour, curMin] = currentTime.split(':').map(Number);
    const slotMinutes = slotHour * 60 + slotMin;
    const curMinutes = curHour * 60 + curMin;
    return curMinutes >= slotMinutes + 30;
  };

  const { isDark } = useTheme();

  // 테마별 스타일
  const t = {
    container: isDark ? 'bg-gray-800' : 'bg-white shadow-sm',
    border: isDark ? 'border-gray-700' : 'border-gray-200',
    text: isDark ? 'text-white' : 'text-gray-900',
    textMuted: isDark ? 'text-gray-400' : 'text-gray-500',
    slotBg: isDark ? 'bg-gray-700/50' : 'bg-gray-100',
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center h-full ${t.textMuted}`}>
        <div className={`animate-spin rounded-full h-6 w-6 border-2 ${isDark ? 'border-gray-400' : 'border-gray-300'} border-t-transparent`} />
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full ${t.container} rounded-lg overflow-hidden`}>
      {/* 헤더 */}
      <div className={`px-3 py-2 border-b ${t.border} flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          <span className="text-sm">📅</span>
          <span className={`text-sm font-medium ${t.text}`}>오늘 예약</span>
        </div>
        <span className={`text-xs ${t.textMuted}`}>
          {reservations.length}건
        </span>
      </div>

      {/* 타임라인 */}
      <div className="flex-1 overflow-y-auto">
        {TIME_SLOTS.map((slotTime) => {
          const slotReservations = getSlotReservations(slotTime);
          const lunch = isLunchTime(slotTime);
          const current = isCurrentSlot(slotTime);
          const past = isPastSlot(slotTime);

          return (
            <div
              key={slotTime}
              ref={current ? currentTimeRef : undefined}
              className={`
                flex border-b ${isDark ? 'border-gray-700/50' : 'border-gray-200'} min-h-[36px]
                ${lunch ? (isDark ? 'bg-orange-900/20' : 'bg-orange-50') : ''}
                ${current ? (isDark ? 'bg-blue-900/30' : 'bg-blue-50') + ' border-l-2 border-l-blue-500' : ''}
                ${past && !current ? 'opacity-50' : ''}
              `}
            >
              {/* 시간 라벨 */}
              <div className={`
                w-12 flex-shrink-0 px-2 py-1 text-xs font-mono
                ${current ? 'text-blue-500 font-bold' : t.textMuted}
              `}>
                {slotTime}
              </div>

              {/* 예약 블록 */}
              <div className="flex-1 py-1 pr-2 flex flex-col gap-1">
                {slotReservations.length === 0 ? (
                  <div className="h-full flex items-center">
                    <div className={`
                      w-full h-[2px] rounded
                      ${lunch ? (isDark ? 'bg-orange-800/50' : 'bg-orange-200') : (isDark ? 'bg-gray-700/50' : 'bg-gray-200')}
                    `} />
                  </div>
                ) : (
                  slotReservations.map((reservation) => {
                    const typeColor = RESERVATION_TYPE_COLORS[reservation.reservationType] || '#6B7280';
                    const statusStyle = STATUS_STYLES[reservation.status] || STATUS_STYLES.pending;

                    return (
                      <div
                        key={reservation.id}
                        onClick={() => onPatientClick?.(reservation)}
                        className="
                          px-2 py-1 rounded text-xs cursor-pointer
                          hover:brightness-110 transition-all
                        "
                        style={{
                          backgroundColor: `${typeColor}${isDark ? '30' : '20'}`,
                          borderLeft: `3px solid ${typeColor}`,
                          opacity: statusStyle.opacity,
                          textDecoration: statusStyle.decoration,
                        }}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className={`font-medium ${t.text} truncate`}>
                            {reservation.patientName}
                          </span>
                          <span
                            className="text-[10px] px-1 rounded"
                            style={{ backgroundColor: `${typeColor}50`, color: typeColor }}
                          >
                            {reservation.treatmentType}
                          </span>
                        </div>
                        {reservation.memo && (
                          <div className={`${t.textMuted} text-[10px] truncate mt-0.5`}>
                            {reservation.memo}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 범례 */}
      <div className={`px-3 py-2 border-t ${t.border} flex gap-3 text-[10px]`}>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-green-500" />
          <span className={t.textMuted}>초진</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-blue-500" />
          <span className={t.textMuted}>재진</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-orange-500" />
          <span className={t.textMuted}>재초진</span>
        </span>
      </div>
    </div>
  );
}
