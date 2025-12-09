import React, { useMemo, useState } from 'react';
import type { Reservation, Doctor } from '../types';

interface DayViewProps {
  date: string;
  reservations: Reservation[];
  doctors: Doctor[];
  onReservationClick: (reservation: Reservation) => void;
  onTimeSlotClick: (time: string, doctor?: string) => void;
}

// 30분 단위 시간 슬롯 생성 (09:30 ~ 20:30)
const generateTimeSlots = (): string[] => {
  const slots: string[] = [];
  let hour = 9;
  let minute = 30;
  const endHour = 21; // 20:30까지 예약 가능

  while (hour < endHour) {
    slots.push(`${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`);
    minute += 30;
    if (minute >= 60) {
      hour++;
      minute = 0;
    }
  }
  return slots;
};

const TIME_SLOTS = generateTimeSlots();

// 슬롯 용량 상수 (30분당 침환자 6명 = 5분씩)
const SLOT_CAPACITY = 6;

// 예약 표시 텍스트 생성 (재초진의 경우 "재초진료,침" 형태로 표시)
const getDisplayText = (reservation: Reservation): string => {
  const item = reservation.item?.toLowerCase() || '';
  const type = reservation.type?.toLowerCase() || '';

  // 재초진인 경우 특별 표기
  if (type.includes('재초') || item.includes('재초')) {
    // item에 침이 포함되어 있으면
    if (item.includes('침')) {
      return '재초진료,침';
    }
    return '재초진료';
  }

  return reservation.item || reservation.type || '';
};

// 예약 타입별 슬롯 사용량 (침환자 기준)
// 30분 = 6칸, 5분 = 1칸
const getSlotUsage = (reservation: Reservation): number => {
  const item = reservation.item?.toLowerCase() || '';
  const type = reservation.type?.toLowerCase() || ''; // Res_Gubun (구분)

  // 취소된 예약은 슬롯을 차지하지 않음
  if (reservation.canceled) return 0;

  // === 약상담 (신규/초진) = 6칸 ===
  // item 기준: 신규약상담
  if (item.includes('신규') && (item.includes('약') || item.includes('상담'))) {
    return 6;
  }
  // item 기준: 약초진
  if (item.includes('약초진')) {
    return 6;
  }
  // type(구분) 기준: 약초진, 초진 + 한약 관련 item
  if (type.includes('약초진')) {
    return 6;
  }
  if ((type === '초진' || type === '초진예약') &&
      (item.includes('약') || item.includes('상담') || item.includes('한약'))) {
    return 6;
  }

  // === 약상담 (재진) - 전화상담 vs 내원상담 구분 ===
  const isYakReJin = item.includes('약재진') || item.includes('선결') ||
    (item.includes('재진') && (item.includes('약') || item.includes('상담'))) ||
    type.includes('약재진') ||
    (type === '재진' && (item.includes('약') || item.includes('상담') || item.includes('한약')));

  if (isYakReJin) {
    // 전화상담 = 1칸
    if (type.includes('전화상담')) {
      return 1;
    }
    // 내원상담 = 3칸 (기본)
    return 3;
  }

  // 선결 (전화/내원 구분)
  if (item.includes('선결')) {
    if (type.includes('전화상담')) {
      return 1;
    }
    return 3;
  }

  // === 재초진 = 2칸 (기본 1칸 + 추가 1칸) ===
  // item 또는 type에 '재초' 포함
  if (item.includes('재초') || type.includes('재초')) {
    return 2;
  }

  // 복합 진료 계산: 쉼표나 +로 구분된 항목들의 슬롯 합산
  // 예: "침,추나" = 침(1) + 추나(1) = 2칸
  let totalSlots = 0;
  const items = item.split(/[,+\/]/).map(s => s.trim()).filter(s => s);

  if (items.length > 1) {
    items.forEach(singleItem => {
      if (singleItem.includes('재초')) {
        totalSlots += 2; // 재초진은 2칸
      } else if (singleItem.includes('약재진') || singleItem.includes('선결')) {
        // 복합에서 약재진/선결은 전화상담이면 1칸, 아니면 3칸
        totalSlots += type.includes('전화상담') ? 1 : 3;
      } else if (singleItem.includes('추나')) {
        totalSlots += 1;
      } else if (singleItem.includes('침') || singleItem.includes('acupuncture')) {
        totalSlots += 1;
      } else if (singleItem.includes('부항')) {
        totalSlots += 1;
      } else if (singleItem.includes('뜸')) {
        totalSlots += 1;
      } else if (singleItem.includes('약침')) {
        totalSlots += 1;
      } else {
        // 기타 항목도 1칸
        totalSlots += 1;
      }
    });
    // type(구분)이 재초이면 추가 1칸
    if (type.includes('재초')) {
      totalSlots += 1;
    }
    return Math.min(totalSlots, SLOT_CAPACITY); // 최대 6칸
  }

  // 단일 항목 처리
  // 추나 = 1칸
  if (item.includes('추나')) {
    return 1;
  }

  // 침 = 1칸
  if (item.includes('침') || item.includes('acupuncture')) {
    return 1;
  }

  // 기본값: 1칸
  return 1;
};

// 예약 타입에 따른 색상 반환
const getReservationColors = (reservation: Reservation): {
  bg: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
} => {
  const item = reservation.item?.toLowerCase() || '';
  const type = reservation.type?.toLowerCase() || ''; // Res_Gubun (구분)

  if (reservation.canceled) {
    return {
      bg: 'bg-gray-100',
      border: 'border-gray-300',
      textPrimary: 'text-gray-500',
      textSecondary: 'text-gray-400',
    };
  }
  if (reservation.visited) {
    return {
      bg: 'bg-green-100',
      border: 'border-green-400',
      textPrimary: 'text-green-800',
      textSecondary: 'text-green-700',
    };
  }

  // 추나 - 보라색
  if (item.includes('추나')) {
    return {
      bg: 'bg-purple-100',
      border: 'border-purple-400',
      textPrimary: 'text-purple-800',
      textSecondary: 'text-purple-700',
    };
  }

  // 약상담 - 초진 (신규약상담, 약초진) - 주황색
  if (item.includes('신규') && (item.includes('약') || item.includes('상담'))) {
    return {
      bg: 'bg-orange-100',
      border: 'border-orange-400',
      textPrimary: 'text-orange-800',
      textSecondary: 'text-orange-700',
    };
  }
  if (item.includes('약초진') || type.includes('약초진')) {
    return {
      bg: 'bg-orange-100',
      border: 'border-orange-400',
      textPrimary: 'text-orange-800',
      textSecondary: 'text-orange-700',
    };
  }
  if ((type === '초진' || type === '초진예약') &&
      (item.includes('약') || item.includes('상담') || item.includes('한약'))) {
    return {
      bg: 'bg-orange-100',
      border: 'border-orange-400',
      textPrimary: 'text-orange-800',
      textSecondary: 'text-orange-700',
    };
  }

  // 약상담 - 재진 (재진약상담, 약재진, 선결) - 연두/라임색
  if ((item.includes('재진') && (item.includes('약') || item.includes('상담'))) ||
      item.includes('약재진') || type.includes('약재진') ||
      item.includes('선결') ||
      (type === '재진' && (item.includes('약') || item.includes('상담') || item.includes('한약')))) {
    return {
      bg: 'bg-lime-100',
      border: 'border-lime-500',
      textPrimary: 'text-lime-800',
      textSecondary: 'text-lime-700',
    };
  }

  // 재초진 - 하늘색/시안색
  if (item.includes('재초') || type.includes('재초')) {
    return {
      bg: 'bg-cyan-100',
      border: 'border-cyan-400',
      textPrimary: 'text-cyan-800',
      textSecondary: 'text-cyan-700',
    };
  }

  // 초진
  if (type === '초진' || type === '초진예약') {
    return {
      bg: 'bg-pink-100',
      border: 'border-pink-400',
      textPrimary: 'text-pink-800',
      textSecondary: 'text-pink-700',
    };
  }
  // 상담예약
  if (type === '상담예약') {
    return {
      bg: 'bg-yellow-100',
      border: 'border-yellow-400',
      textPrimary: 'text-yellow-800',
      textSecondary: 'text-yellow-700',
    };
  }
  // 기본 (재진 등)
  return {
    bg: 'bg-blue-100',
    border: 'border-blue-400',
    textPrimary: 'text-blue-800',
    textSecondary: 'text-blue-700',
  };
};

export const DayView: React.FC<DayViewProps> = ({
  date,
  reservations,
  doctors,
  onReservationClick,
  onTimeSlotClick,
}) => {
  // 호버 툴팁 상태
  const [hoveredReservation, setHoveredReservation] = useState<{
    reservation: Reservation;
    x: number;
    y: number;
  } | null>(null);

  // 의사별, 시간별로 예약 그룹화
  const reservationsByDoctorAndTime = useMemo(() => {
    const grouped: Record<string, Record<string, Reservation[]>> = {};

    doctors.forEach((doctor) => {
      grouped[doctor.name] = {};
      TIME_SLOTS.forEach((time) => {
        grouped[doctor.name][time] = [];
      });
    });

    reservations.forEach((reservation) => {
      if (grouped[reservation.doctor]) {
        // 30분 단위로 맞추기
        const [hour, min] = reservation.time.split(':').map(Number);
        const roundedMin = min < 30 ? '00' : '30';
        const roundedTime = `${hour.toString().padStart(2, '0')}:${roundedMin}`;

        if (grouped[reservation.doctor][roundedTime]) {
          grouped[reservation.doctor][roundedTime].push(reservation);
        }
      }
    });

    return grouped;
  }, [reservations, doctors]);

  // 의사가 없으면 안내 메시지
  if (doctors.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center text-gray-500">
          <i className="fa-solid fa-user-doctor text-4xl mb-4"></i>
          <p>선택한 날짜에 근무하는 의료진이 없습니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-hidden bg-white flex flex-col">
      <div className="border border-gray-200 rounded-lg overflow-hidden m-4 flex-1 flex flex-col">
        {/* 헤더: 의사 이름 */}
        <div className={`grid bg-gray-100 z-10 shadow-sm font-semibold flex-shrink-0`}
          style={{ gridTemplateColumns: `minmax(80px, auto) repeat(${doctors.length}, minmax(0, 1fr))` }}
        >
          <div className="p-3 text-center border-r border-b text-gray-700">시간</div>
          {doctors.map((doctor) => (
            <div
              key={doctor.id}
              className={`p-3 text-center border-r border-b last:border-r-0 ${
                doctor.isWorking === false ? 'bg-gray-200 text-gray-400' : 'text-gray-700'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <span
                  className={`w-3 h-3 rounded-full ${doctor.isWorking === false ? 'opacity-40' : ''}`}
                  style={{ backgroundColor: doctor.color }}
                ></span>
                <span>{doctor.name}</span>
                {doctor.isWorking === false && (
                  <span className="text-[10px] text-gray-400">(휴무)</span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* 시간 슬롯 */}
        <div className="flex-1 overflow-y-auto">
          {TIME_SLOTS.map((time, timeIndex) => {
            const isLunchTime = time >= '13:00' && time < '14:00';

            return (
              <div
                key={time}
                className={`grid border-b last:border-b-0 min-h-[50px] ${
                  isLunchTime ? 'bg-orange-50' : ''
                }`}
                style={{ gridTemplateColumns: `minmax(80px, auto) repeat(${doctors.length}, minmax(0, 1fr))` }}
              >
                {/* 시간 셀 */}
                <div className="p-2 text-center text-sm font-medium border-r flex items-center justify-center text-gray-600 bg-gray-50">
                  {time}
                </div>

                {/* 각 의사별 슬롯 */}
                {doctors.map((doctor) => {
                  const slotReservations = reservationsByDoctorAndTime[doctor.name]?.[time] || [];
                  const isNotWorking = doctor.isWorking === false;

                  // 6칸 그리드에 예약 배치 (슬롯 사용량에 따라)
                  const cellContent: { startIndex: number; span: number; reservation: Reservation }[] = [];
                  let currentCell = 0;
                  let totalUsage = 0;

                  slotReservations.forEach(res => {
                    const usage = getSlotUsage(res);
                    if (currentCell + usage <= SLOT_CAPACITY) {
                      cellContent.push({
                        startIndex: currentCell,
                        span: usage,
                        reservation: res,
                      });
                      currentCell += usage;
                      totalUsage += usage;
                    }
                  });

                  const isFull = totalUsage >= SLOT_CAPACITY;
                  const remainingSlots = SLOT_CAPACITY - totalUsage;

                  return (
                    <div
                      key={doctor.id}
                      className={`grid grid-cols-6 border-r last:border-r-0 group relative ${
                        isNotWorking ? 'bg-gray-100' : ''
                      }`}
                    >
                      {/* 클릭 가능한 빈 영역 - 근무하는 의사만 */}
                      {!isFull && !isNotWorking && (
                        <button
                          onClick={() => onTimeSlotClick(time, doctor.name)}
                          className="absolute inset-0 group-hover:bg-blue-50 transition-colors duration-150 z-0 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-clinic-secondary"
                          aria-label={`새 예약 추가: ${doctor.name}, ${time}`}
                        ></button>
                      )}

                      {/* 세로 그리드 라인 */}
                      {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className={`border-l first:border-l-0 h-full ${isNotWorking ? 'border-gray-200' : 'border-gray-100'}`}></div>
                      ))}

                      {/* 예약 블록 렌더링 */}
                      {cellContent.map(({ startIndex, span, reservation }) => {
                        const colors = getReservationColors(reservation);
                        const widthPercent = (span / SLOT_CAPACITY) * 100;
                        const leftPercent = (startIndex / SLOT_CAPACITY) * 100;

                        return (
                          <div
                            key={reservation.id}
                            style={{
                              position: 'absolute',
                              left: `${leftPercent}%`,
                              width: `${widthPercent}%`,
                              top: '2px',
                              bottom: '2px',
                            }}
                            className={`${colors.bg} border ${colors.border} flex flex-col justify-center px-1.5 py-1 text-xs overflow-hidden z-10 cursor-pointer rounded-md hover:ring-2 hover:ring-offset-1 hover:ring-clinic-primary transition-shadow`}
                            onClick={(e) => {
                              e.stopPropagation();
                              onReservationClick(reservation);
                            }}
                            onMouseEnter={(e) => {
                              const rect = e.currentTarget.getBoundingClientRect();
                              setHoveredReservation({
                                reservation,
                                x: rect.left + rect.width / 2,
                                y: rect.top - 10,
                              });
                            }}
                            onMouseLeave={() => setHoveredReservation(null)}
                          >
                            <p className={`font-bold ${colors.textPrimary} truncate ${reservation.canceled ? 'line-through' : ''}`}>
                              {reservation.patientName}
                            </p>
                            <p className={`${colors.textSecondary} text-[10px] truncate ${reservation.canceled ? 'line-through' : ''}`}>
                              {getDisplayText(reservation)}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* 호버 툴팁 */}
      {hoveredReservation && (
        <div
          className="fixed z-50 bg-gray-900 text-white text-sm rounded-lg shadow-lg px-4 py-3 pointer-events-none"
          style={{
            left: hoveredReservation.x,
            top: hoveredReservation.y,
            transform: 'translate(-50%, -100%)',
            maxWidth: '300px',
          }}
        >
          <div className="flex flex-col gap-1">
            <div className="font-bold text-base border-b border-gray-700 pb-1 mb-1">
              {hoveredReservation.reservation.patientName}
              {hoveredReservation.reservation.canceled && (
                <span className="ml-2 text-red-400 text-xs">(취소됨)</span>
              )}
              {hoveredReservation.reservation.visited && (
                <span className="ml-2 text-green-400 text-xs">(내원완료)</span>
              )}
            </div>
            <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
              <span className="text-gray-400">시간</span>
              <span>{hoveredReservation.reservation.time}</span>
              <span className="text-gray-400">담당</span>
              <span>{hoveredReservation.reservation.doctor}</span>
              <span className="text-gray-400">진료</span>
              <span>{hoveredReservation.reservation.item || '-'}</span>
              <span className="text-gray-400">구분</span>
              <span>{hoveredReservation.reservation.type || '-'}</span>
              {hoveredReservation.reservation.phone && (
                <>
                  <span className="text-gray-400">연락처</span>
                  <span>{hoveredReservation.reservation.phone}</span>
                </>
              )}
              {hoveredReservation.reservation.memo && (
                <>
                  <span className="text-gray-400">메모</span>
                  <span className="truncate">{hoveredReservation.reservation.memo}</span>
                </>
              )}
            </div>
          </div>
          {/* 툴팁 화살표 */}
          <div
            className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0"
            style={{
              borderLeft: '8px solid transparent',
              borderRight: '8px solid transparent',
              borderTop: '8px solid #111827',
            }}
          ></div>
        </div>
      )}
    </div>
  );
};

export default DayView;
