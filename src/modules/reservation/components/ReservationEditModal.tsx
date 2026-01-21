import React, { useState, useEffect } from 'react';
import type { Reservation, Doctor, UpdateReservationRequest, ReservationType } from '../types';

interface ReservationEditModalProps {
  isOpen: boolean;
  reservation: Reservation | null;
  doctors: Doctor[];
  onClose: () => void;
  onSave: (id: number, data: UpdateReservationRequest) => Promise<void>;
}

// 진료 항목 옵션
const TREATMENT_ITEMS = [
  { id: 'acupuncture', label: '침', value: '침' },
  { id: 'chuna', label: '추나', value: '추나' },
  { id: 'cupping', label: '부항', value: '부항' },
  { id: 'moxibustion', label: '뜸', value: '뜸' },
  { id: 'pharmacopuncture', label: '약침', value: '약침' },
  { id: 'jaechojin', label: '재초진', value: '재초진' },
];

// 예약 구분 옵션
const RESERVATION_TYPES: ReservationType[] = ['재진', '초진', '상담예약', '기타'];

export const ReservationEditModal: React.FC<ReservationEditModalProps> = ({
  isOpen,
  reservation,
  doctors,
  onClose,
  onSave,
}) => {
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [doctor, setDoctor] = useState('');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [type, setType] = useState<ReservationType>('재진');
  const [memo, setMemo] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 예약 데이터로 폼 초기화
  useEffect(() => {
    if (reservation) {
      setDate(reservation.date);
      setTime(reservation.time);
      setDoctor(reservation.doctor);
      setType(reservation.type ?? '재진');
      setMemo(reservation.memo || '');

      // 진료 항목 파싱
      const items = reservation.item?.split(',').map(s => s.trim()).filter(s => s) || [];
      setSelectedItems(items);
    }
  }, [reservation]);

  if (!isOpen || !reservation) return null;

  const handleItemToggle = (itemValue: string) => {
    setSelectedItems(prev => {
      if (prev.includes(itemValue)) {
        return prev.filter(i => i !== itemValue);
      }
      return [...prev, itemValue];
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!date || !time || !doctor || selectedItems.length === 0) {
      setError('모든 필수 항목을 입력해주세요.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSave(reservation.id, {
        date,
        time,
        doctor,
        item: selectedItems.join(','),
        type,
        memo,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || '저장 실패');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 날짜 포맷팅
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const day = d.getDate();
    const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];
    return `${year}년 ${month}월 ${day}일 (${dayOfWeek})`;
  };

  // 시간 옵션 생성 (09:00 ~ 20:30)
  const timeOptions: string[] = [];
  for (let hour = 9; hour <= 20; hour++) {
    timeOptions.push(`${hour.toString().padStart(2, '0')}:00`);
    if (hour < 20 || (hour === 20 && true)) {
      timeOptions.push(`${hour.toString().padStart(2, '0')}:30`);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        {/* 헤더 */}
        <div className="sticky top-0 bg-clinic-secondary px-6 py-4 text-white flex items-center justify-between z-10">
          <div>
            <h3 className="text-lg font-bold">
              <i className="fa-solid fa-pen mr-2"></i>
              예약 수정
            </h3>
            <p className="text-sm text-blue-100">{reservation.patientName} ({reservation.chartNo})</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center hover:bg-white/20 rounded-lg transition-colors"
          >
            <i className="fa-solid fa-xmark text-xl"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* 에러 메시지 */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              <i className="fa-solid fa-circle-exclamation mr-2"></i>
              {error}
            </div>
          )}

          {/* 예약일 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <i className="fa-solid fa-calendar mr-2 text-gray-400"></i>
              예약일
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-clinic-primary focus:border-transparent"
              required
            />
            {date && (
              <p className="mt-1 text-sm text-gray-500">{formatDate(date)}</p>
            )}
          </div>

          {/* 예약시간 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <i className="fa-solid fa-clock mr-2 text-gray-400"></i>
              예약시간
            </label>
            <select
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-clinic-primary focus:border-transparent"
              required
            >
              <option value="">시간 선택</option>
              {timeOptions.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* 담당의 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <i className="fa-solid fa-user-doctor mr-2 text-gray-400"></i>
              담당원장
            </label>
            <select
              value={doctor}
              onChange={(e) => setDoctor(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-clinic-primary focus:border-transparent"
              required
            >
              <option value="">원장 선택</option>
              {doctors.filter(d => !d.resigned && !d.isOther).map(d => (
                <option key={d.id} value={d.name}>{d.name} 원장</option>
              ))}
            </select>
          </div>

          {/* 진료항목 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <i className="fa-solid fa-stethoscope mr-2 text-gray-400"></i>
              진료항목
            </label>
            <div className="flex flex-wrap gap-2">
              {TREATMENT_ITEMS.map(item => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleItemToggle(item.value)}
                  className={`px-4 py-2 rounded-full border-2 font-medium transition-colors ${
                    selectedItems.includes(item.value)
                      ? 'bg-clinic-primary text-white border-clinic-primary'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-clinic-primary'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            {selectedItems.length > 0 && (
              <p className="mt-2 text-sm text-clinic-primary font-medium">
                선택됨: {selectedItems.join(', ')}
              </p>
            )}
          </div>

          {/* 예약 구분 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <i className="fa-solid fa-tag mr-2 text-gray-400"></i>
              예약 구분
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as ReservationType)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-clinic-primary focus:border-transparent"
            >
              {RESERVATION_TYPES.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* 메모 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <i className="fa-solid fa-sticky-note mr-2 text-gray-400"></i>
              메모
            </label>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              rows={3}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-clinic-primary focus:border-transparent resize-none"
              placeholder="메모 입력 (선택사항)"
            />
          </div>

          {/* 버튼 */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-3 bg-clinic-secondary text-white font-semibold rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <i className="fa-solid fa-spinner fa-spin mr-2"></i>
                  저장 중...
                </>
              ) : (
                <>
                  <i className="fa-solid fa-check mr-2"></i>
                  저장
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ReservationEditModal;
