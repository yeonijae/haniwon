/**
 * 치료실 세션 치료 정보 편집 모달
 * 치료실 입실 후 세션의 치료 항목을 수정하는 모달
 */

import React, { useState, useEffect, useMemo } from 'react';
import { TreatmentRoom, SessionTreatment, TreatmentItem } from '../types';

interface TreatmentInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  room: TreatmentRoom;
  onSave: (roomId: number, treatments: SessionTreatment[]) => void;
  treatmentItems: TreatmentItem[];
}

const TreatmentInfoModal: React.FC<TreatmentInfoModalProps> = ({
  isOpen,
  onClose,
  room,
  onSave,
  treatmentItems,
}) => {
  const [treatments, setTreatments] = useState<SessionTreatment[]>([]);

  // room이 변경되면 치료 목록 초기화
  useEffect(() => {
    if (room.sessionTreatments) {
      setTreatments([...room.sessionTreatments]);
    }
  }, [room]);

  // 사용 가능한 치료 항목 (이미 추가된 것 제외)
  const availableTreatments = useMemo(() => {
    const existingNames = new Set(treatments.map(t => t.name));
    return treatmentItems.filter(t => !existingNames.has(t.name));
  }, [treatments, treatmentItems]);

  // 치료 항목 추가
  const handleAddTreatment = (item: TreatmentItem) => {
    const newTreatment: SessionTreatment = {
      id: `tx-${room.patientId}-${Date.now()}-${treatments.length}`,
      name: item.name,
      duration: item.defaultDuration,
      status: 'pending',
      elapsedSeconds: 0,
    };
    setTreatments([...treatments, newTreatment]);
  };

  // 치료 항목 제거
  const handleRemoveTreatment = (treatmentId: string) => {
    setTreatments(treatments.filter(t => t.id !== treatmentId));
  };

  // 시간 변경
  const handleDurationChange = (treatmentId: string, duration: number) => {
    setTreatments(treatments.map(t =>
      t.id === treatmentId ? { ...t, duration: Math.max(1, duration) } : t
    ));
  };

  // 저장
  const handleSave = () => {
    onSave(room.id, treatments);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] overflow-hidden">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="text-xl font-bold text-gray-800">
              {room.patientName}
              {room.patientChartNumber && (
                <span className="text-sm font-normal text-gray-500 ml-2">
                  ({room.patientChartNumber})
                </span>
              )}
            </h2>
            <p className="text-sm text-gray-500">
              {room.name} - 치료 정보 수정
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <i className="fa-solid fa-xmark text-gray-500"></i>
          </button>
        </div>

        {/* 본문 */}
        <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(80vh - 160px)' }}>
          {/* 현재 치료 항목 */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">현재 치료 항목</h3>
            <div className="space-y-2">
              {treatments.length > 0 ? (
                treatments.map(treatment => (
                  <div
                    key={treatment.id}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      treatment.status === 'completed'
                        ? 'bg-green-50 border-green-200'
                        : treatment.status === 'running'
                        ? 'bg-blue-50 border-blue-200'
                        : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`font-medium ${
                        treatment.status === 'completed' ? 'text-green-700' : 'text-gray-800'
                      }`}>
                        {treatment.name}
                      </span>
                      {treatment.status !== 'pending' && (
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          treatment.status === 'completed'
                            ? 'bg-green-100 text-green-700'
                            : treatment.status === 'running'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {treatment.status === 'completed' ? '완료' :
                           treatment.status === 'running' ? '진행중' : '일시정지'}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={treatment.duration}
                        onChange={(e) => handleDurationChange(treatment.id, parseInt(e.target.value) || 1)}
                        min="1"
                        className="w-16 px-2 py-1 text-sm border rounded text-center"
                        disabled={treatment.status !== 'pending'}
                      />
                      <span className="text-sm text-gray-500">분</span>
                      {treatment.status === 'pending' && (
                        <button
                          onClick={() => handleRemoveTreatment(treatment.id)}
                          className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
                        >
                          <i className="fa-solid fa-trash-can"></i>
                        </button>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-center text-gray-500 py-4">
                  치료 항목이 없습니다.
                </p>
              )}
            </div>
          </div>

          {/* 추가 가능한 치료 항목 */}
          {availableTreatments.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">추가 가능한 치료</h3>
              <div className="flex flex-wrap gap-2">
                {availableTreatments.map(item => (
                  <button
                    key={item.id}
                    onClick={() => handleAddTreatment(item)}
                    className="px-3 py-1.5 bg-white border border-gray-300 rounded-full text-sm text-gray-700 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-colors"
                  >
                    <i className="fa-solid fa-plus mr-1 text-xs"></i>
                    {item.name}
                    <span className="text-gray-400 ml-1">({item.defaultDuration}분)</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            저장
          </button>
        </div>
      </div>
    </div>
  );
};

export default TreatmentInfoModal;
