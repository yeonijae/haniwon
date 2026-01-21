import React, { useState } from 'react';
import type { EditDraft } from './ReservationEditStep1Modal';
import type { UpdateReservationRequest, ReservationType } from '../types';

interface ReservationEditConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (id: number, data: UpdateReservationRequest) => Promise<void>;
  onBack: () => void;
  draft: EditDraft | null;
  selectedDate: string;
  selectedTime: string;
}

export const ReservationEditConfirmModal: React.FC<ReservationEditConfirmModalProps> = ({
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

  // 변경 사항 비교
  const hasDateChanged = draft.originalDate !== selectedDate;
  const hasTimeChanged = draft.originalTime !== selectedTime;
  const hasDateTimeChanged = hasDateChanged || hasTimeChanged;

  const handleConfirm = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      await onConfirm(draft.reservationId, {
        date: selectedDate,
        time: selectedTime,
        doctor: draft.doctor,
        item: draft.selectedItems.join(','),
        type: draft.type as ReservationType,
        memo: draft.memo,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || '예약 수정 실패');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="border-b px-6 py-4 flex items-center justify-between bg-clinic-secondary text-white rounded-t-xl">
          <div>
            <h3 className="text-lg font-bold">
              <i className="fa-solid fa-check-circle mr-2"></i>
              수정 확인
            </h3>
            <p className="text-sm text-blue-100">변경 내용을 확인하고 저장해주세요</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/20 rounded"
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
              {draft.patientName.charAt(0)}
            </div>
            <div>
              <p className="font-bold text-lg text-gray-900">{draft.patientName}</p>
              <p className="text-sm text-gray-500">
                차트번호: {draft.chartNo}
                {draft.phone && ` | ${draft.phone}`}
              </p>
            </div>
          </div>

          {/* 예약 상세 정보 */}
          <div className="border rounded-lg divide-y">
            <div className="flex justify-between p-3">
              <span className="text-gray-500">예약일시</span>
              <div className="text-right">
                {hasDateTimeChanged && (
                  <div className="text-sm text-gray-400 line-through">
                    {formatDate(draft.originalDate)} {draft.originalTime}
                  </div>
                )}
                <span className={`font-semibold ${hasDateTimeChanged ? 'text-green-600' : 'text-gray-900'}`}>
                  {formatDate(selectedDate)} {selectedTime}
                  {hasDateTimeChanged && <i className="fa-solid fa-arrow-up ml-1 text-xs"></i>}
                </span>
              </div>
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
            <div className="flex justify-between p-3">
              <span className="text-gray-500">예약 구분</span>
              <span className="font-semibold text-gray-900">
                {draft.type}
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
              className="flex-1 py-2.5 bg-clinic-secondary text-white font-semibold rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <i className="fa-solid fa-spinner fa-spin mr-2"></i>
                  저장 중...
                </>
              ) : (
                <>
                  <i className="fa-solid fa-check mr-2"></i>
                  수정 완료
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReservationEditConfirmModal;
