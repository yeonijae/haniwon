/**
 * 치료 정보 편집 컴포넌트
 * 환자별 기본 치료 정보를 편집하는 UI
 */

import React, { useState, useEffect, useCallback } from 'react';
import type { PatientDefaultTreatments, YakchimType } from '../types';
import {
  TREATMENT_CHECKBOX_ITEMS,
  YAKCHIM_SELECT_ITEMS,
} from '../hooks/useTreatmentInfo';

interface TreatmentInfoEditorProps {
  /** 환자 ID */
  patientId: number;
  /** 환자 이름 */
  patientName: string;
  /** 초기 치료 정보 (없으면 기본값 사용) */
  initialData?: PatientDefaultTreatments | null;
  /** 저장 콜백 */
  onSave: (patientId: number, data: Partial<PatientDefaultTreatments>) => Promise<void>;
  /** 취소 콜백 */
  onCancel?: () => void;
  /** 로딩 상태 */
  isLoading?: boolean;
  /** 컴팩트 모드 (인라인 편집용) */
  compact?: boolean;
  /** 저장 버튼 텍스트 */
  saveButtonText?: string;
}

const TreatmentInfoEditor: React.FC<TreatmentInfoEditorProps> = ({
  patientId,
  patientName,
  initialData,
  onSave,
  onCancel,
  isLoading = false,
  compact = false,
  saveButtonText = '저장',
}) => {
  // 치료 항목 상태
  const [treatments, setTreatments] = useState({
    has_acupuncture: true,
    has_moxa: true,
    has_hotpack: true,
    has_cupping: false,
    has_chuna: false,
    has_ultrasound: false,
    has_highfreq: false,
    has_aroma: false,
  });

  // 약침 상태
  const [yakchimType, setYakchimType] = useState<YakchimType | ''>('');
  const [yakchimQuantity, setYakchimQuantity] = useState(0);

  // 메모
  const [memo, setMemo] = useState('');

  // 변경 여부 추적
  const [hasChanges, setHasChanges] = useState(false);

  // 초기 데이터 로드
  useEffect(() => {
    if (initialData) {
      setTreatments({
        has_acupuncture: initialData.has_acupuncture,
        has_moxa: initialData.has_moxa,
        has_hotpack: initialData.has_hotpack,
        has_cupping: initialData.has_cupping,
        has_chuna: initialData.has_chuna,
        has_ultrasound: initialData.has_ultrasound,
        has_highfreq: initialData.has_highfreq,
        has_aroma: initialData.has_aroma,
      });
      setYakchimType(initialData.yakchim_type || '');
      setYakchimQuantity(initialData.yakchim_quantity || 0);
      setMemo(initialData.memo || '');
      setHasChanges(false);
    }
  }, [initialData]);

  // 체크박스 변경 핸들러
  const handleTreatmentChange = useCallback((key: keyof typeof treatments) => {
    setTreatments(prev => ({ ...prev, [key]: !prev[key] }));
    setHasChanges(true);
  }, []);

  // 약침 종류 변경
  const handleYakchimTypeChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setYakchimType(e.target.value as YakchimType | '');
    setHasChanges(true);
  }, []);

  // 약침 수량 변경
  const handleYakchimQuantityChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10) || 0;
    setYakchimQuantity(Math.max(0, value));
    setHasChanges(true);
  }, []);

  // 메모 변경
  const handleMemoChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMemo(e.target.value);
    setHasChanges(true);
  }, []);

  // 저장
  const handleSave = useCallback(async () => {
    const data: Partial<PatientDefaultTreatments> = {
      ...treatments,
      yakchim_type: yakchimType || null,
      yakchim_quantity: yakchimQuantity,
      memo: memo || null,
    };

    await onSave(patientId, data);
    setHasChanges(false);
  }, [patientId, treatments, yakchimType, yakchimQuantity, memo, onSave]);

  // 컴팩트 모드 렌더링
  if (compact) {
    return (
      <div className="space-y-3">
        {/* 치료 항목 체크박스 (2열) */}
        <div className="grid grid-cols-4 gap-2">
          {TREATMENT_CHECKBOX_ITEMS.map(item => (
            <label
              key={item.key}
              className={`flex items-center gap-1.5 cursor-pointer p-1.5 rounded text-sm ${
                treatments[item.key] ? 'bg-blue-50 text-blue-700' : 'bg-gray-50 text-gray-500'
              }`}
            >
              <input
                type="checkbox"
                checked={treatments[item.key]}
                onChange={() => handleTreatmentChange(item.key)}
                className="w-3.5 h-3.5 rounded text-blue-600"
              />
              <span className={item.isActing ? 'font-medium' : ''}>
                {item.label}
                {item.isActing && <span className="text-xs text-orange-500 ml-0.5">*</span>}
              </span>
            </label>
          ))}
        </div>

        {/* 약침 */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600 w-12">약침:</span>
          <select
            value={yakchimType}
            onChange={handleYakchimTypeChange}
            className="flex-1 px-2 py-1 text-sm border rounded focus:ring-1 focus:ring-blue-500"
          >
            <option value="">선택안함</option>
            {YAKCHIM_SELECT_ITEMS.map(item => (
              <option key={item.value} value={item.value}>{item.label}</option>
            ))}
          </select>
          <input
            type="number"
            value={yakchimQuantity}
            onChange={handleYakchimQuantityChange}
            min="0"
            className="w-16 px-2 py-1 text-sm border rounded text-center focus:ring-1 focus:ring-blue-500"
            placeholder="수량"
          />
          <span className="text-sm text-gray-500">cc</span>
        </div>

        {/* 버튼 */}
        <div className="flex justify-end gap-2 pt-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded"
            >
              취소
            </button>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={isLoading || !hasChanges}
            className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? '저장 중...' : saveButtonText}
          </button>
        </div>
      </div>
    );
  }

  // 전체 모드 렌더링
  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="border-b pb-3">
        <h3 className="text-lg font-semibold text-gray-800">
          {patientName} 치료 정보
        </h3>
        <p className="text-sm text-gray-500 mt-1">
          기본 치료 항목을 설정합니다. <span className="text-orange-500">*</span> 표시는 원장 액팅 항목입니다.
        </p>
      </div>

      {/* 치료 항목 체크박스 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          치료 항목
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {TREATMENT_CHECKBOX_ITEMS.map(item => (
            <label
              key={item.key}
              className={`flex items-center gap-2 cursor-pointer p-3 rounded-lg border transition-colors ${
                treatments[item.key]
                  ? 'bg-blue-50 border-blue-300 text-blue-700'
                  : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'
              }`}
            >
              <input
                type="checkbox"
                checked={treatments[item.key]}
                onChange={() => handleTreatmentChange(item.key)}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
              />
              <span className={item.isActing ? 'font-medium' : ''}>
                {item.label}
                {item.isActing && <span className="text-orange-500 ml-1">*</span>}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* 약침 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          약침
        </label>
        <div className="flex items-center gap-4">
          <select
            value={yakchimType}
            onChange={handleYakchimTypeChange}
            className="flex-1 max-w-xs px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">선택안함</option>
            {YAKCHIM_SELECT_ITEMS.map(item => (
              <option key={item.value} value={item.value}>{item.label}</option>
            ))}
          </select>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={yakchimQuantity}
              onChange={handleYakchimQuantityChange}
              min="0"
              className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-center focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="수량"
            />
            <span className="text-gray-500">cc</span>
          </div>
        </div>
      </div>

      {/* 메모 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          메모
        </label>
        <textarea
          value={memo}
          onChange={handleMemoChange}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
          placeholder="추가 지시사항이나 메모를 입력하세요"
        />
      </div>

      {/* 버튼 */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            취소
          </button>
        )}
        <button
          type="button"
          onClick={handleSave}
          disabled={isLoading || !hasChanges}
          className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <i className="fa-solid fa-spinner fa-spin"></i>
              저장 중...
            </span>
          ) : (
            saveButtonText
          )}
        </button>
      </div>
    </div>
  );
};

export default TreatmentInfoEditor;
