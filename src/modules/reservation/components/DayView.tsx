import React, { useMemo, useState } from 'react';
import type { Reservation, Doctor, TreatmentItem } from '../types';
import type { ReservationDraft } from './ReservationStep1Modal';
import type { EditDraft } from './ReservationEditStep1Modal';
import type { OnSiteReservationCount } from '../lib/api';
import { getCurrentDate } from '@shared/lib/postgres';

interface DayViewProps {
  date: string;
  reservations: Reservation[];
  doctors: Doctor[];
  onReservationClick: (reservation: Reservation) => void;
  onTimeSlotClick: (time: string, doctor?: string) => void;
  // 2단계 예약 모드 props
  reservationDraft?: ReservationDraft | null;
  onSelectTimeSlot?: (time: string) => void;
  // 2단계 예약 수정 모드 props
  editDraft?: EditDraft | null;
  onSelectTimeSlotForEdit?: (time: string) => void;
  // 설정 데이터
  treatmentItems?: TreatmentItem[];
  maxSlots?: number;
  // 현장예약 데이터
  onSiteData?: OnSiteReservationCount | null;
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

// 전화상담 여부 확인
const isPhoneConsultation = (reservation: Reservation): boolean => {
  const item = reservation.item?.toLowerCase() || '';
  const type = reservation.type?.toLowerCase() || '';

  // type에 '전화' 포함
  if (type.includes('전화')) return true;

  // item에 '전화' 포함 (약재진(전화) 등)
  if (item.includes('전화')) return true;

  return false;
};

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

// 설정 기반 슬롯 사용량 계산
const createSlotCalculator = (treatmentItems?: TreatmentItem[], maxSlots: number = SLOT_CAPACITY) => {
  // 설정에서 항목 찾기 (이름으로 매칭)
  const findItemByName = (name: string): TreatmentItem | undefined => {
    if (!treatmentItems) return undefined;
    const lowerName = name.toLowerCase();
    return treatmentItems.find(item =>
      item.isActive && item.name.toLowerCase() === lowerName
    );
  };

  // 부분 매칭으로 항목 찾기 (포함 관계)
  const findItemByPartialMatch = (name: string): TreatmentItem | undefined => {
    if (!treatmentItems) return undefined;
    const lowerName = name.toLowerCase();
    return treatmentItems.find(item =>
      item.isActive && (
        item.name.toLowerCase().includes(lowerName) ||
        lowerName.includes(item.name.toLowerCase())
      )
    );
  };

  return (reservation: Reservation): number => {
    const itemStr = reservation.item || '';
    const type = reservation.type?.toLowerCase() || '';

    // 취소된 예약은 슬롯을 차지하지 않음
    if (reservation.canceled) return 0;

    // 복합 진료 계산: 쉼표나 +로 구분된 항목들
    const items = itemStr.split(/[,+\/]/).map(s => s.trim()).filter(s => s);

    if (items.length > 1) {
      // 복합 진료
      let totalSlots = 0;
      items.forEach(singleItem => {
        // 설정에서 정확히 매칭되는 항목 찾기
        const configItem = findItemByName(singleItem);
        if (configItem) {
          totalSlots += configItem.slotsInCompound ?? configItem.slots;
        } else {
          // 설정에 없으면 기존 하드코딩 로직 사용
          totalSlots += getFallbackSlots(singleItem, type, true);
        }
      });
      // type(구분)이 재초이면 추가 1칸
      if (type.includes('재초')) {
        totalSlots += 1;
      }
      return Math.min(totalSlots, maxSlots);
    }

    // 단일 항목
    const singleItem = items[0] || itemStr;

    // 설정에서 정확히 매칭되는 항목 찾기
    const configItem = findItemByName(singleItem);
    if (configItem) {
      return configItem.slots;
    }

    // 부분 매칭 시도
    const partialMatch = findItemByPartialMatch(singleItem);
    if (partialMatch) {
      return partialMatch.slots;
    }

    // 설정에 없으면 기존 하드코딩 로직
    return getFallbackSlots(singleItem, type, false);
  };
};

// 기존 하드코딩 로직 (설정에 없는 항목용)
const getFallbackSlots = (item: string, type: string, isCompound: boolean): number => {
  const lowerItem = item.toLowerCase();

  // 재초진
  if (lowerItem.includes('재초')) {
    return isCompound ? 1 : 2;
  }

  // 신규약상담, 약초진 = 6칸
  if (lowerItem.includes('신규약상담') || lowerItem.includes('약초진')) {
    return 6;
  }

  // 약재진
  if (lowerItem.includes('약재진')) {
    if (lowerItem.includes('내원')) return 3;
    if (lowerItem.includes('전화')) return 1;
    return type.includes('전화상담') ? 1 : 3;
  }

  // 선결
  if (lowerItem.includes('선결')) {
    if (lowerItem.includes('전화')) return 1;
    return type.includes('전화상담') ? 1 : 3;
  }

  // 기본 치료 항목들
  if (lowerItem.includes('침') || lowerItem.includes('추나') ||
      lowerItem.includes('부항') || lowerItem.includes('뜸') ||
      lowerItem.includes('약침')) {
    return 1;
  }

  // 기본값
  return 1;
};

// 기존 함수 (설정 없이 사용할 때)
const getSlotUsage = createSlotCalculator();

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
  reservationDraft,
  onSelectTimeSlot,
  editDraft,
  onSelectTimeSlotForEdit,
  treatmentItems,
  maxSlots = SLOT_CAPACITY,
  onSiteData,
}) => {
  // 호버 툴팁 상태
  const [hoveredReservation, setHoveredReservation] = useState<{
    reservation: Reservation;
    x: number;
    y: number;
  } | null>(null);

  // 호버 중인 시간 슬롯 (예약 모드에서 사용)
  const [hoveredTimeSlot, setHoveredTimeSlot] = useState<string | null>(null);

  // 설정 기반 슬롯 계산기 생성
  const calculateSlots = useMemo(
    () => createSlotCalculator(treatmentItems, maxSlots),
    [treatmentItems, maxSlots]
  );

  // 예약 모드인지 확인 (신규 예약 또는 수정 모드)
  const isReservationMode = !!reservationDraft;
  const isEditMode = !!editDraft;
  const isSelectionMode = isReservationMode || isEditMode;

  // 현재 선택 모드의 draft 정보
  const currentDraft = reservationDraft || editDraft;
  const currentDoctor = reservationDraft?.doctor || editDraft?.doctor;
  const currentRequiredSlots = reservationDraft?.requiredSlots || editDraft?.requiredSlots || 1;
  const currentDoctorColor = reservationDraft?.doctorColor || editDraft?.doctorColor;

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

  // 의사별, 시간별 슬롯 사용량 계산 (예약 모드에서 프리뷰용)
  const slotUsageByDoctorAndTime = useMemo(() => {
    const usage: Record<string, Record<string, number>> = {};

    doctors.forEach((doc) => {
      usage[doc.name] = {};
      TIME_SLOTS.forEach((time) => {
        usage[doc.name][time] = 0;
      });
    });

    reservations.forEach((res) => {
      if (!usage[res.doctor]) return;

      const [hour, min] = res.time.split(':').map(Number);
      const roundedMin = min < 30 ? '00' : '30';
      const roundedTime = `${hour.toString().padStart(2, '0')}:${roundedMin}`;

      if (usage[res.doctor][roundedTime] !== undefined) {
        usage[res.doctor][roundedTime] += calculateSlots(res);
      }
    });

    return usage;
  }, [reservations, doctors, calculateSlots]);

  // 원장별 통계 계산
  const doctorStats = useMemo(() => {
    const today = getCurrentDate();
    const isPastDate = date < today;

    const stats: Record<string, { total: number; visited: number; canceled: number; noShow: number; onSiteReservation: number }> = {};

    doctors.forEach(doc => {
      const docReservations = reservations.filter(r => r.doctor === doc.name);
      const total = docReservations.length;
      const visited = docReservations.filter(r => r.visited && !r.canceled).length;
      const canceled = docReservations.filter(r => r.canceled).length;
      const noShow = isPastDate
        ? docReservations.filter(r => !r.visited && !r.canceled).length
        : 0;

      // 현장예약 카운트 (API 데이터 사용)
      const onSiteReservation = onSiteData?.by_doctor?.[doc.name]?.on_site_count || 0;

      stats[doc.name] = { total, visited, canceled, noShow, onSiteReservation };
    });

    return stats;
  }, [reservations, doctors, date, onSiteData]);

  // 예약/수정 모드에서 호버 시 슬롯 배치 가능 여부 및 프리뷰 계산
  const getSlotPreview = (time: string) => {
    if (!currentDraft || !hoveredTimeSlot) return null;
    if (time !== hoveredTimeSlot) return null;

    const doctor = currentDoctor!;
    const requiredSlots = currentRequiredSlots;
    const currentUsed = slotUsageByDoctorAndTime[doctor]?.[time] || 0;
    const remainingInCurrent = SLOT_CAPACITY - currentUsed;

    // 현재 슬롯에 충분한 공간이 있는 경우
    if (requiredSlots <= remainingInCurrent) {
      return {
        canBook: true,
        currentSlotStart: currentUsed,
        currentSlotEnd: currentUsed + requiredSlots,
        nextSlotStart: 0,
        nextSlotEnd: 0,
        message: `예약 가능 (${requiredSlots}칸)`,
      };
    }

    // 현재 슬롯이 꽉 찬 경우
    if (remainingInCurrent === 0) {
      return {
        canBook: false,
        currentSlotStart: 0,
        currentSlotEnd: 0,
        nextSlotStart: 0,
        nextSlotEnd: 0,
        message: '슬롯 가득 참',
      };
    }

    // 다음 슬롯으로 넘치는 경우
    const overflow = requiredSlots - remainingInCurrent;
    const timeIndex = TIME_SLOTS.indexOf(time);
    const nextTime = timeIndex < TIME_SLOTS.length - 1 ? TIME_SLOTS[timeIndex + 1] : null;

    if (!nextTime) {
      return {
        canBook: false,
        currentSlotStart: currentUsed,
        currentSlotEnd: SLOT_CAPACITY,
        nextSlotStart: 0,
        nextSlotEnd: 0,
        message: '마지막 시간대',
      };
    }

    const nextUsed = slotUsageByDoctorAndTime[doctor]?.[nextTime] || 0;
    const remainingInNext = SLOT_CAPACITY - nextUsed;

    if (overflow <= remainingInNext) {
      return {
        canBook: true,
        currentSlotStart: currentUsed,
        currentSlotEnd: SLOT_CAPACITY,
        nextSlotStart: nextUsed,
        nextSlotEnd: nextUsed + overflow,
        nextTime,
        message: `예약 가능 (${remainingInCurrent}칸 + 다음 ${overflow}칸)`,
      };
    }

    return {
      canBook: false,
      currentSlotStart: currentUsed,
      currentSlotEnd: currentUsed + remainingInCurrent,
      nextSlotStart: 0,
      nextSlotEnd: 0,
      message: '공간 부족',
    };
  };

  // 다음 슬롯 프리뷰 (넘침 표시용)
  const getNextSlotPreview = (time: string) => {
    if (!currentDraft || !hoveredTimeSlot) return null;

    const timeIndex = TIME_SLOTS.indexOf(hoveredTimeSlot);
    const nextTime = timeIndex < TIME_SLOTS.length - 1 ? TIME_SLOTS[timeIndex + 1] : null;

    if (time !== nextTime) return null;

    const preview = getSlotPreview(hoveredTimeSlot);
    if (!preview || preview.nextSlotEnd === 0) return null;

    return {
      start: preview.nextSlotStart,
      end: preview.nextSlotEnd,
      canBook: preview.canBook,
    };
  };

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
          {doctors.map((doctor) => {
            const stats = doctorStats[doctor.name] || { total: 0, visited: 0, canceled: 0, noShow: 0, onSiteReservation: 0 };
            const today = getCurrentDate();
            const isPastDate = date < today;
            const pending = stats.total - stats.visited - stats.canceled - stats.noShow;

            return (
              <div
                key={doctor.id}
                className={`p-2 text-center border-r border-b last:border-r-0 ${
                  doctor.isWorking === false ? 'bg-gray-200 text-gray-400' : 'text-gray-700'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <span
                    className={`w-3 h-3 rounded-full ${doctor.isWorking === false ? 'opacity-40' : ''}`}
                    style={{ backgroundColor: doctor.color }}
                  ></span>
                  <span className="font-semibold">{doctor.name}</span>
                  {doctor.isWorking === false && (
                    <span className="text-[10px] text-gray-400">(휴무)</span>
                  )}
                </div>
                {/* 원장별 통계 */}
                {stats.total > 0 && (
                  <div className="flex items-center justify-center gap-1.5 mt-1 text-[10px] font-normal">
                    <span className="text-gray-500" title="총 예약">{stats.total}</span>
                    <span className="text-green-600" title="내원">{stats.visited}</span>
                    <span className="text-orange-500" title="취소">{stats.canceled}</span>
                    {stats.noShow > 0 && <span className="text-red-500" title="노쇼">{stats.noShow}</span>}
                    {!isPastDate && pending > 0 && <span className="text-blue-500" title="대기">{pending}</span>}
                    {stats.visited > 0 && (
                      <span className="text-purple-600 border-l border-gray-300 pl-1.5 ml-0.5" title="현장예약">
                        <i className="fa-solid fa-calendar-plus mr-0.5"></i>
                        {stats.onSiteReservation}/{stats.visited}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
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

                  // 예약/수정 모드에서 선택한 의사가 아닌 경우 비활성화 표시
                  const isTargetDoctor = isSelectionMode && currentDoctor === doctor.name;
                  const isOtherDoctorInSelectionMode = isSelectionMode && currentDoctor !== doctor.name;

                  // 6칸 그리드에 예약 배치 (슬롯 사용량에 따라)
                  const cellContent: { startIndex: number; span: number; reservation: Reservation }[] = [];
                  let currentCell = 0;
                  let totalUsage = 0;

                  slotReservations.forEach(res => {
                    const usage = calculateSlots(res);
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

                  // 예약 모드 프리뷰 계산
                  const slotPreview = isTargetDoctor ? getSlotPreview(time) : null;
                  const nextSlotPreview = isTargetDoctor ? getNextSlotPreview(time) : null;

                  return (
                    <div
                      key={doctor.id}
                      className={`grid grid-cols-6 border-r last:border-r-0 group relative ${
                        isNotWorking ? 'bg-gray-100' : ''
                      } ${isOtherDoctorInSelectionMode ? 'bg-gray-50 opacity-40' : ''}`}
                      onMouseEnter={() => {
                        if (isTargetDoctor && !isFull) {
                          setHoveredTimeSlot(time);
                        }
                      }}
                      onMouseLeave={() => {
                        if (isTargetDoctor) {
                          setHoveredTimeSlot(null);
                        }
                      }}
                    >
                      {/* 클릭 가능한 빈 영역 - 근무하는 의사만, 선택 모드에서는 선택 의사만 */}
                      {!isFull && !isNotWorking && !isOtherDoctorInSelectionMode && (
                        <button
                          onClick={() => {
                            if (isSelectionMode && slotPreview?.canBook) {
                              // 신규 예약 모드
                              if (isReservationMode && onSelectTimeSlot) {
                                onSelectTimeSlot(time);
                              }
                              // 수정 모드
                              if (isEditMode && onSelectTimeSlotForEdit) {
                                onSelectTimeSlotForEdit(time);
                              }
                            } else if (!isSelectionMode) {
                              onTimeSlotClick(time, doctor.name);
                            }
                          }}
                          className={`absolute inset-0 transition-colors duration-150 z-0 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-clinic-secondary ${
                            isSelectionMode
                              ? slotPreview?.canBook
                                ? 'cursor-pointer'
                                : 'cursor-not-allowed'
                              : 'group-hover:bg-blue-50'
                          }`}
                          aria-label={`${isEditMode ? '예약 시간 변경' : '새 예약 추가'}: ${doctor.name}, ${time}`}
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
                            className={`${colors.bg} border ${colors.border} flex flex-col justify-center px-1.5 py-1 text-xs overflow-hidden z-10 cursor-pointer rounded-md hover:ring-2 hover:ring-offset-1 hover:ring-clinic-primary transition-shadow ${reservation.canceled ? 'opacity-70' : ''}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!isSelectionMode) {
                                onReservationClick(reservation);
                              }
                            }}
                            onMouseEnter={(e) => {
                              if (!isSelectionMode) {
                                const rect = e.currentTarget.getBoundingClientRect();
                                setHoveredReservation({
                                  reservation,
                                  x: rect.left + rect.width / 2,
                                  y: rect.top - 10,
                                });
                              }
                            }}
                            onMouseLeave={() => !isSelectionMode && setHoveredReservation(null)}
                          >
                            {/* 취소 표시 */}
                            {reservation.canceled && (
                              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <span className="bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded transform -rotate-12 shadow-sm">
                                  취소
                                </span>
                              </div>
                            )}
                            <p className={`font-bold ${colors.textPrimary} truncate ${reservation.canceled ? 'line-through' : ''}`}>
                              {reservation.patientName}
                            </p>
                            <p className={`${colors.textSecondary} text-[10px] truncate ${reservation.canceled ? 'line-through' : ''} flex items-center gap-1`}>
                              {isPhoneConsultation(reservation) && (
                                <i className="fa-solid fa-phone" title="전화상담"></i>
                              )}
                              {getDisplayText(reservation)}
                            </p>
                          </div>
                        );
                      })}

                      {/* 예약/수정 모드: 호버 프리뷰 (현재 슬롯) */}
                      {slotPreview && slotPreview.currentSlotEnd > slotPreview.currentSlotStart && (
                        <div
                          style={{
                            position: 'absolute',
                            left: `${(slotPreview.currentSlotStart / SLOT_CAPACITY) * 100}%`,
                            width: `${((slotPreview.currentSlotEnd - slotPreview.currentSlotStart) / SLOT_CAPACITY) * 100}%`,
                            top: '2px',
                            bottom: '2px',
                          }}
                          className={`z-20 rounded-md border-2 border-dashed flex flex-col justify-center items-center text-xs font-medium pointer-events-none ${
                            slotPreview.canBook
                              ? isEditMode
                                ? 'bg-blue-100/80 border-blue-500 text-blue-700'
                                : 'bg-green-100/80 border-green-500 text-green-700'
                              : 'bg-red-100/80 border-red-500 text-red-700'
                          }`}
                        >
                          <span className="truncate px-1">
                            {reservationDraft?.patient.name || editDraft?.patientName}
                          </span>
                          <span className="text-[10px]">{slotPreview.message}</span>
                        </div>
                      )}

                      {/* 예약/수정 모드: 다음 슬롯 넘침 프리뷰 */}
                      {nextSlotPreview && (
                        <div
                          style={{
                            position: 'absolute',
                            left: `${(nextSlotPreview.start / SLOT_CAPACITY) * 100}%`,
                            width: `${((nextSlotPreview.end - nextSlotPreview.start) / SLOT_CAPACITY) * 100}%`,
                            top: '2px',
                            bottom: '2px',
                          }}
                          className={`z-20 rounded-md border-2 border-dashed flex items-center justify-center text-xs pointer-events-none ${
                            nextSlotPreview.canBook
                              ? isEditMode
                                ? 'bg-blue-100/60 border-blue-400 text-blue-600'
                                : 'bg-green-100/60 border-green-400 text-green-600'
                              : 'bg-red-100/60 border-red-400 text-red-600'
                          }`}
                        >
                          <span className="text-[10px]">+{nextSlotPreview.end - nextSlotPreview.start}칸</span>
                        </div>
                      )}
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
            <div className="font-bold text-base border-b border-gray-700 pb-1 mb-1 flex items-center gap-2">
              {isPhoneConsultation(hoveredReservation.reservation) && (
                <i className="fa-solid fa-phone text-blue-400" title="전화상담"></i>
              )}
              {hoveredReservation.reservation.patientName}
              {hoveredReservation.reservation.canceled && (
                <span className="ml-2 text-red-400 text-xs">(취소됨)</span>
              )}
              {hoveredReservation.reservation.visited && (
                <span className="ml-2 text-green-400 text-xs">(내원완료)</span>
              )}
              {isPhoneConsultation(hoveredReservation.reservation) && (
                <span className="text-blue-400 text-xs">(전화상담)</span>
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
