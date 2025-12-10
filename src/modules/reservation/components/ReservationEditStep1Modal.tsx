import React, { useState, useEffect, useMemo } from 'react';
import type { Doctor, Reservation } from '../types';

// 수정 1단계에서 선택한 정보 (2단계로 전달)
export interface EditDraft {
  reservationId: number;
  patientId: number;
  patientName: string;
  chartNo: string;
  phone?: string;
  doctor: string;
  doctorColor: string;
  selectedItems: string[];
  requiredSlots: number;
  type: string;
  memo: string;
  originalDate: string;
  originalTime: string;
}

interface ReservationEditStep1ModalProps {
  isOpen: boolean;
  reservation: Reservation | null;
  doctors: Doctor[];
  onClose: () => void;
  onNext: (draft: EditDraft) => void;
}

// 진료 항목 카테고리
const TREATMENT_CATEGORIES = {
  '기본진료': [
    { name: '침', slots: 1 },
    { name: '추나', slots: 1 },
    { name: '부항', slots: 1 },
    { name: '뜸', slots: 1 },
    { name: '약침', slots: 1 },
  ],
  '재초진': [
    { name: '재초진', slots: 2 },
  ],
  '약상담': [
    { name: '약재진(내원)', slots: 3 },
    { name: '약재진(전화)', slots: 1 },
    { name: '신규약상담', slots: 6 },
    { name: '약초진', slots: 6 },
  ],
};

// 모든 항목의 슬롯 사용량 맵
const ITEM_SLOT_USAGE: Record<string, number> = {};
Object.values(TREATMENT_CATEGORIES).flat().forEach(item => {
  ITEM_SLOT_USAGE[item.name] = item.slots;
});

// 예약 구분 옵션
const RESERVATION_TYPES = ['재진', '초진', '상담예약', '재초진', '약재진', '약초진'];

export const ReservationEditStep1Modal: React.FC<ReservationEditStep1ModalProps> = ({
  isOpen,
  reservation,
  doctors,
  onClose,
  onNext,
}) => {
  const [selectedDoctor, setSelectedDoctor] = useState('');
  const [selectedItems, setSelectedItems] = useState<string[]>(['침']);
  const [type, setType] = useState('재진');
  const [memo, setMemo] = useState('');
  const [error, setError] = useState<string | null>(null);

  // 예약 데이터로 폼 초기화
  useEffect(() => {
    if (reservation && isOpen) {
      setSelectedDoctor(reservation.doctor);
      setType(reservation.type || '재진');
      setMemo(reservation.memo || '');

      // 진료 항목 파싱
      const items = reservation.item?.split(',').map(s => s.trim()).filter(s => s) || [];
      setSelectedItems(items.length > 0 ? items : ['침']);
      setError(null);
    }
  }, [reservation, isOpen]);

  // 선택된 진료 항목들의 총 슬롯 사용량
  // DayView의 getSlotUsage와 동일한 로직 적용
  const requiredSlots = useMemo(() => {
    // 복합 진료인 경우 (2개 이상 선택)
    if (selectedItems.length > 1) {
      let totalSlots = 0;
      selectedItems.forEach(item => {
        if (item.includes('재초')) {
          totalSlots += 1; // 재초진은 복합에서 1칸
        } else if (item.includes('약재진') && item.includes('내원')) {
          totalSlots += 3;
        } else if (item.includes('약재진') && item.includes('전화')) {
          totalSlots += 1;
        } else if (item.includes('신규약상담') || item.includes('약초진')) {
          totalSlots += 6;
        } else {
          totalSlots += 1; // 침, 추나, 부항, 뜸, 약침 등
        }
      });
      return Math.min(totalSlots, 6); // 최대 6칸
    }

    // 단일 항목인 경우
    return ITEM_SLOT_USAGE[selectedItems[0]] || 1;
  }, [selectedItems]);

  // 선택한 의사의 색상
  const selectedDoctorColor = useMemo(() => {
    const doc = doctors.find(d => d.name === selectedDoctor);
    return doc?.color || '#3B82F6';
  }, [doctors, selectedDoctor]);

  // 조건부 렌더링 - hooks 호출 후에 배치
  if (!isOpen || !reservation) return null;

  // 항목 선택/해제 토글
  const toggleItem = (itemName: string) => {
    setSelectedItems(prev => {
      if (prev.includes(itemName)) {
        if (prev.length === 1) return prev;
        return prev.filter(i => i !== itemName);
      } else {
        return [...prev, itemName];
      }
    });
  };

  const handleNext = () => {
    setError(null);

    if (!selectedDoctor) {
      setError('담당 의사를 선택해주세요.');
      return;
    }

    if (selectedItems.length === 0) {
      setError('진료 항목을 선택해주세요.');
      return;
    }

    onNext({
      reservationId: reservation.id,
      patientId: reservation.patientId,
      patientName: reservation.patientName,
      chartNo: reservation.chartNo,
      phone: reservation.phone,
      doctor: selectedDoctor,
      doctorColor: selectedDoctorColor,
      selectedItems,
      requiredSlots,
      type,
      memo,
      originalDate: reservation.date,
      originalTime: reservation.time,
    });
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-clinic-secondary px-6 py-4 text-white flex items-center justify-between z-10">
          <div>
            <h3 className="text-lg font-bold">
              <i className="fa-solid fa-pen mr-2"></i>
              예약 수정 - 1단계
            </h3>
            <p className="text-sm text-blue-100">진료항목과 담당의 수정</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center hover:bg-white/20 rounded-lg transition-colors"
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

          {/* 환자 정보 (수정 불가) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">환자</label>
            <div className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
              <div className="w-10 h-10 bg-clinic-primary text-white rounded-full flex items-center justify-center font-bold">
                {reservation.patientName.charAt(0)}
              </div>
              <div>
                <p className="font-semibold text-gray-900">
                  {reservation.patientName}
                  <span className="ml-2 text-sm font-normal text-gray-500">
                    ({reservation.chartNo})
                  </span>
                </p>
                {reservation.phone && (
                  <p className="text-sm text-gray-500">{reservation.phone}</p>
                )}
              </div>
            </div>
          </div>

          {/* 현재 예약일시 표시 */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center gap-2 text-blue-700">
              <i className="fa-solid fa-calendar-check"></i>
              <span className="font-medium">현재 예약:</span>
              <span>{formatDate(reservation.date)} {reservation.time}</span>
            </div>
            <p className="text-sm text-blue-600 mt-1">
              <i className="fa-solid fa-info-circle mr-1"></i>
              다음 단계에서 날짜/시간을 변경할 수 있습니다.
            </p>
          </div>

          {/* 진료 항목 - 복수 선택 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              진료 항목 <span className="text-red-500">*</span>
              <span className="ml-2 text-xs text-gray-500 font-normal">
                (선택: {selectedItems.length}개, 총 <span className="font-bold text-clinic-primary">{requiredSlots}칸</span>)
              </span>
            </label>
            <div className="space-y-3">
              {Object.entries(TREATMENT_CATEGORIES).map(([category, items]) => (
                <div key={category} className="border rounded-lg p-3">
                  <div className="text-xs font-semibold text-gray-500 mb-2">{category}</div>
                  <div className="flex flex-wrap gap-2">
                    {items.map(({ name, slots }) => {
                      const isSelected = selectedItems.includes(name);
                      return (
                        <button
                          key={name}
                          type="button"
                          onClick={() => toggleItem(name)}
                          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                            isSelected
                              ? 'bg-clinic-primary text-white ring-2 ring-clinic-primary ring-offset-1'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {name}
                          <span className={`ml-1 text-xs ${isSelected ? 'text-white/80' : 'text-gray-500'}`}>
                            ({slots}칸)
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            {selectedItems.length > 0 && (
              <div className="mt-2 text-sm text-gray-600">
                선택됨: {selectedItems.join(', ')}
              </div>
            )}
          </div>

          {/* 담당 의사 - 버튼 형태 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              담당 의사 <span className="text-red-500">*</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {doctors.filter(d => !d.resigned && !d.isOther).map((doc) => {
                const isSelected = selectedDoctor === doc.name;
                return (
                  <button
                    key={doc.id}
                    type="button"
                    onClick={() => setSelectedDoctor(doc.name)}
                    className={`px-4 py-2 rounded-lg font-medium transition-all ${
                      isSelected
                        ? 'bg-clinic-primary text-white ring-2 ring-clinic-primary ring-offset-1'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'
                    }`}
                    style={isSelected ? {} : { borderLeftColor: doc.color, borderLeftWidth: '4px' }}
                  >
                    {doc.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 예약 구분 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <i className="fa-solid fa-tag mr-2 text-gray-400"></i>
              예약 구분
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
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
              메모 <span className="text-xs text-gray-400">(선택)</span>
            </label>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-clinic-primary focus:border-clinic-primary"
              rows={2}
              placeholder="예약 관련 메모"
            />
          </div>

          {/* 버튼 */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition-colors"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="flex-1 py-2.5 bg-clinic-secondary text-white font-semibold rounded-lg hover:bg-blue-600 transition-colors"
            >
              다음: 시간 선택
              <i className="fa-solid fa-arrow-right ml-2"></i>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReservationEditStep1Modal;
