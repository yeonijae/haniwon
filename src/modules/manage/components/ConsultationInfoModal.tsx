import React, { useState, useEffect } from 'react';
import { Patient, ConsultationItem } from '../types';

export interface SelectedConsultationItem {
  itemId: number;
  itemName: string;
  subItemId?: number;
  subItemName?: string;
}

interface ConsultationInfoModalProps {
  patient: Patient;
  consultationItems: ConsultationItem[];
  onSave: (patientId: number, details: string) => void;
  onClose: () => void;
}

const ConsultationInfoModal: React.FC<ConsultationInfoModalProps> = ({
  patient,
  consultationItems,
  onSave,
  onClose,
}) => {
  const [selectedConsultationItems, setSelectedConsultationItems] = useState<SelectedConsultationItem[]>([]);
  const [memo, setMemo] = useState<string>('');

  // 기존 details에서 선택된 항목과 메모 파싱 (초기화)
  useEffect(() => {
    if (patient.details) {
      // 메모 분리 (| 로 구분)
      const [itemsPart, memoPart] = patient.details.split(' | ');

      if (memoPart) {
        setMemo(memoPart);
      }

      // 기존 details 문자열에서 항목 파싱 시도
      const detailParts = (itemsPart || patient.details).split(', ');
      const parsedItems: SelectedConsultationItem[] = [];

      detailParts.forEach(part => {
        // "항목명(세부항목명)" 형태 파싱
        const match = part.match(/^(.+?)\((.+)\)$/);
        if (match) {
          const [, itemName, subItemName] = match;
          const item = consultationItems.find(i => i.name === itemName);
          if (item) {
            const subItem = item.subItems.find(s => s.name === subItemName);
            if (subItem) {
              parsedItems.push({
                itemId: item.id,
                itemName: item.name,
                subItemId: subItem.id,
                subItemName: subItem.name,
              });
            }
          }
        } else {
          // "항목명" 형태
          const item = consultationItems.find(i => i.name === part);
          if (item && item.subItems.length === 0) {
            parsedItems.push({
              itemId: item.id,
              itemName: item.name,
            });
          }
        }
      });

      if (parsedItems.length > 0) {
        setSelectedConsultationItems(parsedItems);
      }
    }
  }, [patient.details, consultationItems]);

  const toggleItem = (item: ConsultationItem) => {
    const existing = selectedConsultationItems.find(s => s.itemId === item.id && !s.subItemId);
    if (existing) {
      // 이미 선택된 항목 제거 (해당 항목과 모든 세부항목 제거)
      setSelectedConsultationItems(prev =>
        prev.filter(s => s.itemId !== item.id)
      );
    } else {
      // 새로 선택 추가 (세부항목이 없는 경우만 메인 항목으로 추가)
      if (item.subItems.length === 0) {
        setSelectedConsultationItems(prev => [
          ...prev,
          { itemId: item.id, itemName: item.name }
        ]);
      }
    }
  };

  const toggleSubItem = (item: ConsultationItem, subItem: { id: number; name: string }) => {
    const existing = selectedConsultationItems.find(
      s => s.itemId === item.id && s.subItemId === subItem.id
    );
    if (existing) {
      // 이미 선택된 세부항목 제거
      setSelectedConsultationItems(prev =>
        prev.filter(s => !(s.itemId === item.id && s.subItemId === subItem.id))
      );
    } else {
      // 새로 선택 추가
      setSelectedConsultationItems(prev => [
        ...prev,
        { itemId: item.id, itemName: item.name, subItemId: subItem.id, subItemName: subItem.name }
      ]);
    }
  };

  const isItemSelected = (itemId: number) => {
    return selectedConsultationItems.some(s => s.itemId === itemId && !s.subItemId);
  };

  const isSubItemSelected = (itemId: number, subItemId: number) => {
    return selectedConsultationItems.some(s => s.itemId === itemId && s.subItemId === subItemId);
  };

  const hasAnySubItemSelected = (itemId: number) => {
    return selectedConsultationItems.some(s => s.itemId === itemId && s.subItemId);
  };

  const handleSave = () => {
    // 선택된 항목들을 문자열로 변환
    const itemsText = selectedConsultationItems.length > 0
      ? selectedConsultationItems.map(item => {
          if (item.subItemName) {
            return `${item.itemName}(${item.subItemName})`;
          }
          return item.itemName;
        }).join(', ')
      : '';

    // 메모가 있으면 | 로 구분하여 추가
    const detailsText = memo.trim()
      ? (itemsText ? `${itemsText} | ${memo.trim()}` : memo.trim())
      : itemsText;

    onSave(patient.id, detailsText);
    onClose();
  };

  return (
    <div className="flex flex-col h-[60vh]">
      <div className="bg-gray-50 p-3 rounded-lg mb-4">
        <div className="flex items-center gap-2">
          <span className="font-bold text-clinic-primary text-lg">{patient.name}</span>
          {patient.chartNumber && (
            <span className="text-sm text-gray-500">({patient.chartNumber})</span>
          )}
        </div>
        <p className="text-sm text-gray-600 mt-1">오늘 받을 진료항목을 선택해주세요.</p>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
        {consultationItems.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>등록된 진료항목이 없습니다.</p>
            <p className="text-sm mt-1">설정에서 진료항목을 추가해주세요.</p>
          </div>
        ) : (
          consultationItems.map((item) => (
            <div key={item.id} className="border rounded-lg bg-white">
              {/* 메인 항목 */}
              <div
                onClick={() => item.subItems.length === 0 && toggleItem(item)}
                className={`p-3 flex items-center justify-between ${
                  item.subItems.length === 0 ? 'cursor-pointer hover:bg-gray-50' : ''
                } ${
                  isItemSelected(item.id) ? 'bg-blue-50 border-blue-200' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  {item.subItems.length === 0 ? (
                    <div className={`w-5 h-5 rounded border flex items-center justify-center ${
                      isItemSelected(item.id)
                        ? 'bg-clinic-secondary border-clinic-secondary text-white'
                        : 'border-gray-300'
                    }`}>
                      {isItemSelected(item.id) && <i className="fa-solid fa-check text-xs"></i>}
                    </div>
                  ) : (
                    <div className={`w-5 h-5 rounded border flex items-center justify-center ${
                      hasAnySubItemSelected(item.id)
                        ? 'bg-clinic-secondary border-clinic-secondary text-white'
                        : 'border-gray-300 bg-gray-100'
                    }`}>
                      {hasAnySubItemSelected(item.id) && <i className="fa-solid fa-minus text-xs"></i>}
                    </div>
                  )}
                  <span className="font-medium">{item.name}</span>
                </div>
                {item.subItems.length > 0 && (
                  <span className="text-sm text-gray-500">{item.subItems.length}개 세부항목</span>
                )}
              </div>

              {/* 세부항목 */}
              {item.subItems.length > 0 && (
                <div className="border-t bg-gray-50 p-2 grid grid-cols-2 gap-2">
                  {item.subItems.map((subItem) => (
                    <div
                      key={subItem.id}
                      onClick={() => toggleSubItem(item, subItem)}
                      className={`p-2 rounded cursor-pointer flex items-center gap-2 ${
                        isSubItemSelected(item.id, subItem.id)
                          ? 'bg-blue-100 border border-blue-300'
                          : 'bg-white border border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                        isSubItemSelected(item.id, subItem.id)
                          ? 'bg-clinic-secondary border-clinic-secondary text-white'
                          : 'border-gray-300'
                      }`}>
                        {isSubItemSelected(item.id, subItem.id) && <i className="fa-solid fa-check text-xs"></i>}
                      </div>
                      <span className="text-sm">{subItem.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* 메모 입력 */}
      <div className="mt-4 flex-shrink-0">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          <i className="fa-solid fa-pen mr-1"></i>메모
        </label>
        <input
          type="text"
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="추가 메모를 입력하세요..."
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-clinic-secondary focus:border-clinic-secondary text-sm"
        />
      </div>

      {/* 선택된 항목 요약 및 버튼 */}
      <div className="border-t pt-4 mt-4 flex-shrink-0">
        {(selectedConsultationItems.length > 0 || memo.trim()) && (
          <div className="mb-3 p-2 bg-blue-50 rounded text-sm">
            {selectedConsultationItems.length > 0 && (
              <div>
                <span className="font-medium text-blue-800">선택된 항목: </span>
                <span className="text-blue-600">
                  {selectedConsultationItems.map(s =>
                    s.subItemName ? `${s.itemName}(${s.subItemName})` : s.itemName
                  ).join(', ')}
                </span>
              </div>
            )}
            {memo.trim() && (
              <div className={selectedConsultationItems.length > 0 ? 'mt-1' : ''}>
                <span className="font-medium text-blue-800">메모: </span>
                <span className="text-blue-600">{memo.trim()}</span>
              </div>
            )}
          </div>
        )}
        <div className="flex justify-end space-x-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-700 font-semibold rounded-md hover:bg-gray-300 transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-clinic-secondary text-white font-semibold rounded-md hover:bg-blue-700 transition-colors"
          >
            <i className="fa-solid fa-check mr-2"></i>
            저장
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConsultationInfoModal;
