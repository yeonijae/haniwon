import React, { useState } from 'react';
import type { ReservationDraft } from './ReservationStep1Modal';
import type { CreateReservationRequest } from '../types';

interface ReservationConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: CreateReservationRequest) => Promise<void>;
  onBack: () => void;
  draft: ReservationDraft | null;
  selectedDate: string;
  selectedTime: string;
}

export const ReservationConfirmModal: React.FC<ReservationConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  onBack,
  draft,
  selectedDate,
  selectedTime,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !draft) return null;

  // 날짜 포맷팅
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];
    return `${year}년 ${month}월 ${day}일 (${dayOfWeek})`;
  };

  const handleConfirm = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      await onConfirm({
        patientId: draft.patient.id,
        date: selectedDate,
        time: selectedTime,
        doctor: draft.doctor,
        item: draft.selectedItems.join(','),
        type: '재진',
        memo: draft.memo,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || '예약 저장 실패');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="border-b px-6 py-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-green-600">
              <i className="fa-solid fa-check-circle mr-2"></i>
              예약 확인
            </h3>
            <p className="text-sm text-gray-500">예약 정보를 확인하고 저장해주세요</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <i className="fa-solid fa-xmark text-xl"></i>
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* 에러 메시지 */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              <i className="fa-solid fa-circle-exclamation mr-2"></i>
              {error}
            </div>
          )}

          {/* 환자 정보 */}
          <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg"
              style={{ backgroundColor: draft.doctorColor }}
            >
              {draft.patient.name.charAt(0)}
            </div>
            <div>
              <p className="font-bold text-lg text-gray-900">{draft.patient.name}</p>
              <p className="text-sm text-gray-500">
                차트번호: {draft.patient.chartNo}
                {draft.patient.phone && ` | ${draft.patient.phone}`}
              </p>
            </div>
          </div>

          {/* 예약 상세 정보 */}
          <div className="border rounded-lg divide-y">
            <div className="flex justify-between p-3">
              <span className="text-gray-500">예약일시</span>
              <span className="font-semibold text-gray-900">
                {formatDate(selectedDate)} {selectedTime}
              </span>
            </div>
            <div className="flex justify-between p-3">
              <span className="text-gray-500">담당의</span>
              <span className="font-semibold text-gray-900 flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: draft.doctorColor }}
                ></span>
                {draft.doctor}
              </span>
            </div>
            <div className="flex justify-between p-3">
              <span className="text-gray-500">진료항목</span>
              <span className="font-semibold text-gray-900">
                {draft.selectedItems.join(', ')}
              </span>
            </div>
            <div className="flex justify-between p-3">
              <span className="text-gray-500">필요 슬롯</span>
              <span className="font-semibold text-clinic-primary">
                {draft.requiredSlots}칸
              </span>
            </div>
            {draft.memo && (
              <div className="p-3">
                <span className="text-gray-500 block mb-1">메모</span>
                <span className="text-gray-900">{draft.memo}</span>
              </div>
            )}
          </div>

          {/* 버튼 */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onBack}
              className="flex-1 py-2.5 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition-colors"
            >
              <i className="fa-solid fa-arrow-left mr-2"></i>
              시간 다시 선택
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isSubmitting}
              className="flex-1 py-2.5 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <i className="fa-solid fa-spinner fa-spin mr-2"></i>
                  저장 중...
                </>
              ) : (
                <>
                  <i className="fa-solid fa-check mr-2"></i>
                  예약 확정
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReservationConfirmModal;
