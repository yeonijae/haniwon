import React, { useState, useEffect, useMemo } from 'react';
import { DayView } from '../../reservation/components/DayView';
import { CalendarHeader } from '../../reservation/components/CalendarHeader';
import type { ReservationDraft } from '../../reservation/components/ReservationStep1Modal';
import type { Doctor, Reservation, CreateReservationRequest, TreatmentItem } from '../../reservation/types';
import { fetchDoctors, fetchReservationsByDate, createReservation } from '../../reservation/lib/api';
import { useReservationSettings } from '../../reservation/hooks/useReservationSettings';

interface QuickReservationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  // 환자 정보
  patientId: number;
  patientName: string;
  chartNo: string;
  // 기본값 (수납 정보에서)
  defaultDoctor?: string;
  // 1단계에서 전달된 정보 (선택적)
  selectedItems?: string[];
  requiredSlots?: number;
  memo?: string;
}

// 기본 진료 항목 (침)
const DEFAULT_ITEMS = ['침'];
const DEFAULT_SLOTS = 1;

// 현재 근무 중인 의사인지 확인
const isActiveDoctor = (doc: Doctor): boolean => {
  // 기타(DOCTOR) 제외
  if (doc.isOther || doc.name === 'DOCTOR') return false;

  // 퇴사자 제외
  if (doc.resigned) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 입사일이 오늘 이후면 제외
  if (doc.workStartDate) {
    const startDate = new Date(doc.workStartDate);
    if (startDate > today) return false;
  }

  // 퇴사일이 오늘 이전이면 제외
  if (doc.workEndDate) {
    const endDate = new Date(doc.workEndDate);
    if (endDate < today) return false;
  }

  return true;
};

export const QuickReservationModal: React.FC<QuickReservationModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  patientId,
  patientName,
  chartNo,
  defaultDoctor,
  selectedItems: propItems,
  requiredSlots: propSlots,
  memo: propMemo,
}) => {
  // 1단계에서 전달된 값 또는 기본값 사용
  const items = propItems && propItems.length > 0 ? propItems : DEFAULT_ITEMS;
  const slots = propSlots || DEFAULT_SLOTS;
  const memoText = propMemo || '';
  // 날짜 상태
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });

  // 데이터 상태
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // 예약 설정
  const { settings: reservationSettings } = useReservationSettings();

  // 선택 상태 (2-step preview)
  const [selectedDoctor, setSelectedDoctor] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);

  // Draft 생성
  const reservationDraft: ReservationDraft | null = useMemo(() => {
    if (!selectedDoctor) return null;
    const doc = doctors.find(d => d.name === selectedDoctor);
    return {
      patient: {
        id: patientId,
        chartNo,
        name: patientName,
      },
      doctor: selectedDoctor,
      doctorColor: doc?.color || '#3B82F6',
      selectedItems: items,
      requiredSlots: slots,
      memo: memoText,
    };
  }, [selectedDoctor, doctors, patientId, chartNo, patientName, items, slots, memoText]);

  // 의사 목록 로드 (현재 근무 중인 원장만)
  useEffect(() => {
    const loadDoctors = async () => {
      try {
        const allDocs = await fetchDoctors();
        // 현재 근무 중인 의사만 필터링
        const activeDocs = allDocs.filter(isActiveDoctor);
        setDoctors(activeDocs);

        // 기본 의사 선택 (유연한 매칭: 이름 포함 여부로 비교)
        if (defaultDoctor) {
          const matchedDoc = activeDocs.find(d =>
            d.name === defaultDoctor ||
            d.name.includes(defaultDoctor.replace(/원장$/g, '')) ||
            defaultDoctor.includes(d.name.replace(/원장$/g, ''))
          );
          if (matchedDoc) {
            setSelectedDoctor(matchedDoc.name);
          } else if (activeDocs.length > 0) {
            setSelectedDoctor(activeDocs[0].name);
          }
        } else if (activeDocs.length > 0) {
          setSelectedDoctor(activeDocs[0].name);
        }
      } catch (err) {
        console.error('의사 목록 로드 실패:', err);
      }
    };
    if (isOpen) {
      loadDoctors();
    }
  }, [isOpen, defaultDoctor]);

  // 예약 목록 로드
  useEffect(() => {
    const loadReservations = async () => {
      setIsLoading(true);
      try {
        const res = await fetchReservationsByDate(selectedDate);
        setReservations(res);
      } catch (err) {
        console.error('예약 목록 로드 실패:', err);
      } finally {
        setIsLoading(false);
      }
    };
    if (isOpen && selectedDate) {
      loadReservations();
    }
  }, [isOpen, selectedDate]);

  // 모달 닫힐 때 상태 초기화
  useEffect(() => {
    if (!isOpen) {
      setSelectedTime(null);
      setIsConfirming(false);
    }
  }, [isOpen]);

  // 날짜 이동
  const goToPrevious = () => {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() - 1);
    setSelectedDate(current.toISOString().split('T')[0]);
    setSelectedTime(null);
  };

  const goToNext = () => {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() + 1);
    setSelectedDate(current.toISOString().split('T')[0]);
    setSelectedTime(null);
  };

  const goToToday = () => {
    setSelectedDate(new Date().toISOString().split('T')[0]);
    setSelectedTime(null);
  };

  // 시간 슬롯 클릭 (2-step)
  const handleSelectTimeSlot = (time: string) => {
    if (selectedTime === time) {
      // Step 2: 같은 슬롯 다시 클릭 → 확정
      handleConfirm();
    } else {
      // Step 1: 새로운 슬롯 선택 → 프리뷰
      setSelectedTime(time);
    }
  };

  // 예약 확정
  const handleConfirm = async () => {
    if (!selectedTime || !reservationDraft) return;

    setIsConfirming(true);
    try {
      const data: CreateReservationRequest = {
        patientId,
        patientName,
        chartNo,
        date: selectedDate,
        time: selectedTime,
        doctor: selectedDoctor,
        item: items.join(', '),
        type: '재진',
        memo: memoText,
      };

      await createReservation(data);
      onSuccess();
      onClose();
    } catch (err: any) {
      alert(err.message || '예약 생성에 실패했습니다.');
    } finally {
      setIsConfirming(false);
    }
  };

  // 선택 취소
  const handleCancelSelection = () => {
    setSelectedTime(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl mx-4 h-[85vh] flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-clinic-primary text-white rounded-t-xl">
          <div className="flex items-center gap-4">
            <i className="fa-solid fa-calendar-plus text-xl"></i>
            <div>
              <h3 className="text-lg font-bold">빠른 예약</h3>
              <p className="text-sm text-white/80">
                {patientName} ({chartNo}) | 원하는 시간을 클릭하세요
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <i className="fa-solid fa-xmark text-xl"></i>
          </button>
        </div>

        {/* 담당의 선택 + 날짜 네비게이션 */}
        <div className="flex items-center justify-between px-6 py-3 border-b bg-gray-50">
          {/* 담당의 선택 */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-600">담당의:</span>
            <div className="flex gap-2">
              {doctors.map(doc => (
                <button
                  key={doc.id}
                  onClick={() => {
                    setSelectedDoctor(doc.name);
                    setSelectedTime(null);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    selectedDoctor === doc.name
                      ? 'bg-clinic-primary text-white'
                      : 'bg-white text-gray-700 border hover:bg-gray-100'
                  }`}
                  style={selectedDoctor !== doc.name ? { borderLeftColor: doc.color, borderLeftWidth: '3px' } : {}}
                >
                  {doc.name}
                </button>
              ))}
            </div>
          </div>

          {/* 날짜 네비게이션 */}
          <div className="flex items-center gap-2">
            <button
              onClick={goToPrevious}
              className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <i className="fa-solid fa-chevron-left"></i>
            </button>
            <span className="font-semibold text-gray-800 min-w-[120px] text-center">
              {new Date(selectedDate).toLocaleDateString('ko-KR', {
                month: 'long',
                day: 'numeric',
                weekday: 'short',
              })}
            </span>
            <button
              onClick={goToNext}
              className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <i className="fa-solid fa-chevron-right"></i>
            </button>
            <button
              onClick={goToToday}
              className="ml-2 px-3 py-1.5 bg-clinic-primary text-white rounded-lg text-sm font-medium hover:bg-clinic-primary/90 transition-colors"
            >
              오늘
            </button>
          </div>
        </div>

        {/* 선택된 시간 프리뷰 배너 (Step 1 완료 상태) */}
        {selectedTime && (
          <div className="px-6 py-3 bg-green-50 border-b border-green-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <i className="fa-solid fa-clock text-green-600"></i>
              <div>
                <span className="font-semibold text-green-800">
                  {selectedDate} {selectedTime}
                </span>
                <span className="text-green-600 ml-2">
                  {selectedDoctor} | {items.join(', ')}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCancelSelection}
                className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleConfirm}
                disabled={isConfirming}
                className="px-4 py-1.5 bg-green-600 text-white rounded-lg text-sm font-bold hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                {isConfirming ? (
                  <><i className="fa-solid fa-spinner fa-spin mr-2"></i>저장 중...</>
                ) : (
                  <><i className="fa-solid fa-check mr-2"></i>예약 확정</>
                )}
              </button>
            </div>
          </div>
        )}

        {/* 캘린더 뷰 */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <i className="fa-solid fa-spinner fa-spin text-3xl text-gray-400"></i>
            </div>
          ) : (
            <DayView
              date={selectedDate}
              reservations={reservations}
              doctors={doctors.filter(d => d.name === selectedDoctor)}
              onReservationClick={() => {}}
              onTimeSlotClick={() => {}}
              reservationDraft={reservationDraft}
              onSelectTimeSlot={handleSelectTimeSlot}
              treatmentItems={reservationSettings.treatmentItems}
              maxSlots={reservationSettings.maxSlotsPerReservation}
            />
          )}
        </div>

        {/* 안내 문구 */}
        <div className="px-6 py-3 border-t bg-gray-50 text-center text-sm text-gray-600">
          <i className="fa-solid fa-info-circle mr-2"></i>
          원하는 시간대를 클릭하면 프리뷰가 표시됩니다.
          <span className="font-semibold text-green-600 ml-1">같은 위치를 다시 클릭</span>하거나
          <span className="font-semibold text-green-600 ml-1">예약 확정 버튼</span>을 눌러 예약을 완료하세요.
        </div>
      </div>
    </div>
  );
};

export default QuickReservationModal;
