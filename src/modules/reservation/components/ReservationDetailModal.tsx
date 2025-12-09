import React from 'react';
import type { Reservation } from '../types';

interface ReservationDetailModalProps {
  reservation: Reservation;
  onClose: () => void;
  onEdit: () => void;
  onCancel: () => void;
  onMarkVisited: () => void;
}

// 예약 타입에 따른 색상 반환
const getTypeColors = (type: string): { bg: string; text: string; border: string } => {
  if (type === '초진' || type === '초진예약') {
    return { bg: 'bg-pink-100', text: 'text-pink-800', border: 'border-pink-400' };
  }
  if (type === '상담예약') {
    return { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-400' };
  }
  return { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-400' };
};

export const ReservationDetailModal: React.FC<ReservationDetailModalProps> = ({
  reservation,
  onClose,
  onEdit,
  onCancel,
  onMarkVisited,
}) => {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const weekDays = ['일', '월', '화', '수', '목', '금', '토'];
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${year}년 ${month}월 ${day}일 (${weekDays[date.getDay()]})`;
  };

  const getStatusBadge = () => {
    if (reservation.canceled) {
      return (
        <span className="px-3 py-1 text-sm font-medium bg-gray-200 text-gray-600 rounded-full">
          취소됨
        </span>
      );
    }
    if (reservation.visited) {
      return (
        <span className="px-3 py-1 text-sm font-medium bg-green-100 text-green-700 rounded-full">
          내원완료
        </span>
      );
    }
    return (
      <span className="px-3 py-1 text-sm font-medium bg-blue-100 text-blue-700 rounded-full">
        예약확정
      </span>
    );
  };

  const typeColors = getTypeColors(reservation.type);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        {/* 헤더 */}
        <div className="bg-clinic-primary px-6 py-4 text-white flex items-center justify-between">
          <h3 className="text-xl font-bold">예약 상세</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center hover:bg-white/20 rounded-lg transition-colors"
          >
            <i className="fa-solid fa-xmark text-xl"></i>
          </button>
        </div>

        {/* 내용 */}
        <div className="p-6">
          {/* 환자 정보 카드 */}
          <div className="bg-gray-50 rounded-xl p-4 mb-6 border">
            <div className="flex items-start justify-between">
              <div>
                <h4 className="text-2xl font-bold text-clinic-primary">{reservation.patientName}</h4>
                <p className="text-gray-600 mt-1">차트번호: {reservation.chartNo || '-'}</p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className={`px-3 py-1 text-sm font-medium rounded-full border ${typeColors.bg} ${typeColors.text} ${typeColors.border}`}>
                  {reservation.type}
                </span>
                {getStatusBadge()}
              </div>
            </div>
          </div>

          {/* 예약 정보 */}
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <i className="fa-solid fa-calendar text-blue-600"></i>
              </div>
              <div>
                <p className="text-sm text-gray-500">예약일</p>
                <p className="font-semibold text-gray-800">{formatDate(reservation.date)}</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                <i className="fa-solid fa-clock text-green-600"></i>
              </div>
              <div>
                <p className="text-sm text-gray-500">예약시간</p>
                <p className="font-semibold text-gray-800">{reservation.time}</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                <i className="fa-solid fa-user-doctor text-purple-600"></i>
              </div>
              <div>
                <p className="text-sm text-gray-500">담당원장</p>
                <p className="font-semibold text-gray-800">{reservation.doctor} 원장</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                <i className="fa-solid fa-phone text-orange-600"></i>
              </div>
              <div>
                <p className="text-sm text-gray-500">연락처</p>
                <p className="font-semibold text-gray-800">{reservation.phone || '-'}</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-teal-100 flex items-center justify-center">
                <i className="fa-solid fa-stethoscope text-teal-600"></i>
              </div>
              <div>
                <p className="text-sm text-gray-500">진료내용</p>
                <p className="font-semibold text-gray-800">{reservation.item || '-'}</p>
              </div>
            </div>
          </div>

          {/* 메모 */}
          {reservation.memo && (
            <div className="mt-6 p-4 bg-yellow-50 rounded-xl border border-yellow-200">
              <div className="flex items-center gap-2 mb-2">
                <i className="fa-solid fa-sticky-note text-yellow-600"></i>
                <span className="text-sm font-medium text-yellow-800">메모</span>
              </div>
              <p className="text-gray-700 whitespace-pre-wrap">{reservation.memo}</p>
            </div>
          )}
        </div>

        {/* 버튼 */}
        <div className="px-6 py-4 bg-gray-50 border-t flex gap-3">
          {!reservation.canceled && !reservation.visited && (
            <>
              <button
                onClick={onMarkVisited}
                className="flex-1 py-3 bg-green-500 text-white font-semibold rounded-lg hover:bg-green-600 transition-colors flex items-center justify-center gap-2"
              >
                <i className="fa-solid fa-check"></i>
                내원 확인
              </button>
              <button
                onClick={onEdit}
                className="flex-1 py-3 bg-clinic-secondary text-white font-semibold rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
              >
                <i className="fa-solid fa-pen"></i>
                수정
              </button>
              <button
                onClick={onCancel}
                className="py-3 px-5 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition-colors"
              >
                취소
              </button>
            </>
          )}
          {(reservation.canceled || reservation.visited) && (
            <button
              onClick={onClose}
              className="flex-1 py-3 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition-colors"
            >
              닫기
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReservationDetailModal;
