/**
 * 오늘 예약 현황 컴포넌트 - 실제 예약만 표시
 */

import { useState, useEffect, useRef } from 'react';
import type { TodayReservation } from '../types';
import { useTheme } from '../contexts/ThemeContext';

interface Props {
  doctorId: number;
  doctorName: string;
  doctorColor: string;
  onPatientClick?: (reservation: TodayReservation) => void;
}

// 상태별 스타일
const STATUS_STYLES: Record<string, {
  opacity: number;
  decoration: string;
  label: string;
  textClass: string;
  bgClass: string;
  disabled: boolean;
}> = {
  pending: {
    opacity: 1,
    decoration: 'none',
    label: '',
    textClass: 'text-gray-900',
    bgClass: '',
    disabled: false,
  },
  visited: {
    opacity: 0.5,
    decoration: 'none',
    label: '완료',
    textClass: 'text-gray-400',
    bgClass: 'bg-gray-100',
    disabled: true,
  },
  canceled: {
    opacity: 0.5,
    decoration: 'line-through',
    label: '취소',
    textClass: 'text-gray-400',
    bgClass: 'bg-gray-50',
    disabled: true,
  },
  no_show: {
    opacity: 0.85,
    decoration: 'none',
    label: '노쇼',
    textClass: 'text-red-500',
    bgClass: 'bg-red-50',
    disabled: true,
  },
};

export function TodaySchedule({ doctorId, doctorName, doctorColor, onPatientClick }: Props) {
  const [reservations, setReservations] = useState<TodayReservation[]>([]);
  const [loading, setLoading] = useState(true);
  const nextReservationRef = useRef<HTMLDivElement>(null);

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

  // 다음 예약으로 스크롤
  useEffect(() => {
    if (!loading && nextReservationRef.current) {
      nextReservationRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [loading, reservations]);

  const loadReservations = async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      // 예약 API는 MSSQL(3100)에 있음
      const response = await fetch(
        `${import.meta.env.VITE_MSSQL_API_URL || 'http://192.168.0.173:3100'}/api/reservations?date=${today}`
      );

      if (response.ok) {
        const data = await response.json();
        // API 응답을 TodayReservation 형식으로 변환 후 담당 원장 필터링 및 시간순 정렬
        const mapped: TodayReservation[] = (data.reservations || data || [])
          .filter((r: any) => {
            // 담당 원장으로 필터링 (원장명 포함 여부)
            const resDoctor = r.doctor || '';
            return resDoctor.includes(doctorName) || resDoctor === 'DOCTOR';
          })
          .map((r: any) => ({
            id: r.id,
            patientId: r.patient_id || r.patientId,
            patientName: r.patient_name || r.patientName || '환자',
            chartNumber: r.chart_number || r.chartNumber || '',
            time: r.time?.substring(0, 5) || r.reservation_time?.substring(0, 5) || '09:00',
            treatmentType: r.treatment_type || r.treatmentType || r.item || '침',
            reservationType: mapReservationType(r.type || r.reservation_type || r.reservationType),
            status: mapStatus(r.visited, r.canceled),
            memo: r.memo || '',
          }))
          .sort((a: TodayReservation, b: TodayReservation) => a.time.localeCompare(b.time));
        setReservations(mapped);
      }
    } catch (error) {
      console.error('Failed to load reservations:', error);
    } finally {
      setLoading(false);
    }
  };

  // 예약 타입 매핑
  const mapReservationType = (type: string): string => {
    if (type?.includes('초진')) return 'initial';
    if (type?.includes('재초')) return 're_initial';
    return 'return';
  };

  // 상태 매핑
  const mapStatus = (visited: boolean, canceled: boolean): string => {
    if (canceled) return 'canceled';
    if (visited) return 'visited';
    return 'pending';
  };

  // 지난 예약 여부
  const isPast = (time: string): boolean => {
    return time < currentTime;
  };

  // 다음 예약 찾기 (현재 시간 이후 첫 번째 pending 예약)
  const findNextReservationIndex = (): number => {
    return reservations.findIndex(r => r.time >= currentTime && r.status === 'pending');
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

  const nextIndex = findNextReservationIndex();

  // 상태별 카운트 (노쇼 = 예약시간 지났는데 pending인 경우)
  const visitedCount = reservations.filter(r => r.status === 'visited').length;
  const noShowCount = reservations.filter(r => r.status === 'pending' && isPast(r.time)).length;
  const pendingCount = reservations.filter(r => r.status === 'pending' && !isPast(r.time)).length;

  return (
    <div className={`flex flex-col h-full ${t.container} rounded-lg overflow-hidden`}>
      {/* 헤더 */}
      <div className={`px-3 py-2 border-b ${t.border} flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          <span className="text-sm">📅</span>
          <span className={`text-sm font-medium ${t.text}`}>오늘 예약</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-green-500">{visitedCount}완료</span>
          {noShowCount > 0 && <span className="text-red-500">{noShowCount}노쇼</span>}
          <span className="text-blue-500 font-medium">{pendingCount}대기</span>
        </div>
      </div>

      {/* 예약 리스트 */}
      <div className="flex-1 overflow-y-auto">
        {reservations.length === 0 ? (
          <div className={`flex items-center justify-center h-full ${t.textMuted} text-sm`}>
            오늘 예약이 없습니다
          </div>
        ) : (
          <div className="py-1">
            {reservations.map((reservation, index) => {
              const past = isPast(reservation.time);
              // 노쇼: 예약시간이 지났는데 아직 방문하지 않은 환자
              const effectiveStatus =
                reservation.status === 'pending' && past ? 'no_show' : reservation.status;
              const statusStyle = STATUS_STYLES[effectiveStatus] || STATUS_STYLES.pending;
              const isNext = index === nextIndex;

              return (
                <div
                  key={reservation.id}
                  ref={isNext ? nextReservationRef : undefined}
                  onClick={() => !statusStyle.disabled && onPatientClick?.(reservation)}
                  className={`
                    px-3 py-1.5 border-b ${t.border} transition-all
                    ${isNext ? 'bg-blue-50 dark:bg-blue-900/30' : ''}
                    ${statusStyle.disabled ? 'cursor-default' : 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50'}
                    ${statusStyle.bgClass}
                  `}
                  style={{ opacity: statusStyle.opacity }}
                >
                  <div className="flex items-center gap-2">
                    {/* 예약시간 */}
                    <span
                      className={`text-sm font-mono font-medium w-12 ${
                        statusStyle.disabled ? t.textMuted : (past ? t.textMuted : 'text-blue-600')
                      }`}
                      style={{ textDecoration: statusStyle.decoration }}
                    >
                      {reservation.time}
                    </span>

                    {/* 환자성명(차트번호) */}
                    <span
                      className={`text-sm flex-1 ${statusStyle.disabled ? statusStyle.textClass : t.text}`}
                      style={{ textDecoration: statusStyle.decoration }}
                    >
                      {reservation.patientName}
                      {reservation.chartNumber && (
                        <span className={`${t.textMuted} ml-1`}>
                          ({reservation.chartNumber})
                        </span>
                      )}
                    </span>

                    {/* 진료종류 */}
                    <span
                      className={`text-xs ${statusStyle.disabled ? t.textMuted : t.text}`}
                      style={{ textDecoration: statusStyle.decoration }}
                    >
                      {reservation.treatmentType}
                    </span>

                    {/* 상태 배지 */}
                    {effectiveStatus === 'visited' && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-600 dark:bg-green-900/50 dark:text-green-400">
                        완료
                      </span>
                    )}
                    {effectiveStatus === 'canceled' && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400">
                        취소
                      </span>
                    )}
                    {effectiveStatus === 'no_show' && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-400 font-medium">
                        노쇼
                      </span>
                    )}

                    {/* 다음 예약 표시 (대기 상태인 경우만) */}
                    {isNext && effectiveStatus === 'pending' && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500 text-white font-medium">
                        다음
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 범례 */}
      <div className={`px-3 py-2 border-t ${t.border} flex gap-4 text-[10px]`}>
        <span className="flex items-center gap-1">
          <span className="px-1.5 py-0.5 rounded bg-green-100 text-green-600 dark:bg-green-900/50 dark:text-green-400">완료</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="line-through text-gray-400">취소</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-400">노쇼</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="px-1.5 py-0.5 rounded bg-blue-500 text-white">다음</span>
        </span>
      </div>
    </div>
  );
}
