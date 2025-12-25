/**
 * 검사 수치 데이터 입력 컴포넌트
 * - 검사 유형별 수치 항목 템플릿
 * - 수치 입력 및 참조 범위 표시
 */

import { useState } from 'react';
import type { ExamType, ExamValue } from '../types';

// 수치 입력 항목 정의
interface ValueItem {
  item_name: string;
  unit: string;
  reference_min?: number;
  reference_max?: number;
  category?: string;  // 그룹핑용
}

// 검사 유형별 수치 항목 템플릿
const VALUE_TEMPLATES: Partial<Record<ExamType, ValueItem[]>> = {
  inbody: [
    // 체성분
    { item_name: '체중', unit: 'kg', category: '기본' },
    { item_name: '골격근량', unit: 'kg', category: '기본' },
    { item_name: '체지방량', unit: 'kg', category: '기본' },
    { item_name: '체지방률', unit: '%', reference_min: 10, reference_max: 20, category: '기본' },
    { item_name: 'BMI', unit: 'kg/m²', reference_min: 18.5, reference_max: 25, category: '기본' },
    { item_name: '체수분량', unit: 'L', category: '체수분' },
    { item_name: '단백질량', unit: 'kg', category: '체수분' },
    { item_name: '무기질량', unit: 'kg', category: '체수분' },
    // 부위별
    { item_name: '우측팔 근육량', unit: 'kg', category: '부위별' },
    { item_name: '좌측팔 근육량', unit: 'kg', category: '부위별' },
    { item_name: '몸통 근육량', unit: 'kg', category: '부위별' },
    { item_name: '우측다리 근육량', unit: 'kg', category: '부위별' },
    { item_name: '좌측다리 근육량', unit: 'kg', category: '부위별' },
    // 기타
    { item_name: '기초대사량', unit: 'kcal', category: '기타' },
    { item_name: '내장지방레벨', unit: '', reference_min: 1, reference_max: 9, category: '기타' },
    { item_name: '체세포량', unit: 'kg', category: '기타' },
  ],
  pulse: [
    // 맥진 수치
    { item_name: '맥박수', unit: 'bpm', reference_min: 60, reference_max: 100, category: '기본' },
    { item_name: '촌맥 강도', unit: '', reference_min: 1, reference_max: 5, category: '좌측' },
    { item_name: '관맥 강도', unit: '', reference_min: 1, reference_max: 5, category: '좌측' },
    { item_name: '척맥 강도', unit: '', reference_min: 1, reference_max: 5, category: '좌측' },
    { item_name: '촌맥 강도', unit: '', reference_min: 1, reference_max: 5, category: '우측' },
    { item_name: '관맥 강도', unit: '', reference_min: 1, reference_max: 5, category: '우측' },
    { item_name: '척맥 강도', unit: '', reference_min: 1, reference_max: 5, category: '우측' },
  ],
  balance: [
    // 평형검사
    { item_name: '좌우 균형', unit: '%', reference_min: 45, reference_max: 55, category: '균형' },
    { item_name: '전후 균형', unit: '%', reference_min: 45, reference_max: 55, category: '균형' },
    { item_name: '무게중심 X', unit: 'mm', category: '무게중심' },
    { item_name: '무게중심 Y', unit: 'mm', category: '무게중심' },
    { item_name: '동요면적', unit: 'mm²', category: '안정성' },
    { item_name: '동요속도', unit: 'mm/s', category: '안정성' },
    { item_name: '좌측 부하', unit: 'kg', category: '부하' },
    { item_name: '우측 부하', unit: 'kg', category: '부하' },
  ],
  ans: [
    // 자율신경검사
    { item_name: 'HRV (SDNN)', unit: 'ms', reference_min: 50, reference_max: 150, category: 'HRV' },
    { item_name: 'RMSSD', unit: 'ms', category: 'HRV' },
    { item_name: 'LF (교감신경)', unit: 'ms²', category: '주파수' },
    { item_name: 'HF (부교감신경)', unit: 'ms²', category: '주파수' },
    { item_name: 'LF/HF 비율', unit: '', reference_min: 0.5, reference_max: 2.0, category: '주파수' },
    { item_name: '자율신경 균형', unit: '%', reference_min: 40, reference_max: 60, category: '균형' },
    { item_name: '스트레스 지수', unit: '', reference_min: 0, reference_max: 50, category: '기타' },
    { item_name: '피로도 지수', unit: '', reference_min: 0, reference_max: 50, category: '기타' },
  ],
};

// 수치 입력값 타입
export interface ValueInput {
  item_name: string;
  item_value: number | '';
  unit: string;
  reference_min?: number;
  reference_max?: number;
}

interface ExamValueEditorProps {
  examType: ExamType;
  values: ValueInput[];
  onChange: (values: ValueInput[]) => void;
}

const ExamValueEditor: React.FC<ExamValueEditorProps> = ({ examType, values, onChange }) => {
  const [showAll, setShowAll] = useState(false);
  const [customItemName, setCustomItemName] = useState('');
  const [customUnit, setCustomUnit] = useState('');

  const template = VALUE_TEMPLATES[examType] || [];
  const categories = [...new Set(template.map(t => t.category || '기타'))];

  // 템플릿에서 항목 추가
  const addFromTemplate = (item: ValueItem) => {
    // 이미 추가된 항목인지 확인
    const exists = values.some(v =>
      v.item_name === item.item_name &&
      (!item.category || !values.find(x => x.item_name === `${item.category} ${item.item_name}`))
    );

    if (!exists) {
      onChange([
        ...values,
        {
          item_name: item.item_name,
          item_value: '',
          unit: item.unit,
          reference_min: item.reference_min,
          reference_max: item.reference_max,
        },
      ]);
    }
  };

  // 사용자 정의 항목 추가
  const addCustomItem = () => {
    if (!customItemName.trim()) return;

    onChange([
      ...values,
      {
        item_name: customItemName.trim(),
        item_value: '',
        unit: customUnit.trim(),
      },
    ]);

    setCustomItemName('');
    setCustomUnit('');
  };

  // 항목 제거
  const removeItem = (index: number) => {
    const newValues = [...values];
    newValues.splice(index, 1);
    onChange(newValues);
  };

  // 값 변경
  const updateValue = (index: number, value: number | '') => {
    const newValues = [...values];
    newValues[index] = { ...newValues[index], item_value: value };
    onChange(newValues);
  };

  // 값이 참조 범위 내인지 확인
  const isInRange = (val: ValueInput): boolean | null => {
    if (val.item_value === '' || val.item_value === null) return null;
    const v = Number(val.item_value);
    if (val.reference_min !== undefined && v < val.reference_min) return false;
    if (val.reference_max !== undefined && v > val.reference_max) return false;
    return true;
  };

  // 범위 텍스트
  const getRangeText = (val: ValueInput): string => {
    if (val.reference_min !== undefined && val.reference_max !== undefined) {
      return `${val.reference_min} ~ ${val.reference_max}`;
    }
    if (val.reference_min !== undefined) return `≥ ${val.reference_min}`;
    if (val.reference_max !== undefined) return `≤ ${val.reference_max}`;
    return '';
  };

  return (
    <div className="space-y-4">
      {/* 템플릿에서 항목 선택 */}
      {template.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-700">항목 선택</label>
            <button
              type="button"
              onClick={() => setShowAll(!showAll)}
              className="text-xs text-purple-600 hover:underline"
            >
              {showAll ? '간략히' : '모두 보기'}
            </button>
          </div>

          {showAll ? (
            // 카테고리별 전체 보기
            <div className="space-y-3">
              {categories.map(cat => (
                <div key={cat}>
                  <p className="text-xs text-gray-500 mb-1">{cat}</p>
                  <div className="flex flex-wrap gap-1">
                    {template
                      .filter(t => (t.category || '기타') === cat)
                      .map((item, idx) => {
                        const added = values.some(v => v.item_name === item.item_name);
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => !added && addFromTemplate(item)}
                            disabled={added}
                            className={`px-2 py-1 text-xs rounded-full transition-colors ${
                              added
                                ? 'bg-gray-200 text-gray-400 cursor-default'
                                : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                            }`}
                          >
                            {item.item_name}
                            {item.unit && <span className="text-gray-500 ml-1">({item.unit})</span>}
                          </button>
                        );
                      })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            // 자주 사용하는 항목만
            <div className="flex flex-wrap gap-1">
              {template.slice(0, 8).map((item, idx) => {
                const added = values.some(v => v.item_name === item.item_name);
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => !added && addFromTemplate(item)}
                    disabled={added}
                    className={`px-2 py-1 text-xs rounded-full transition-colors ${
                      added
                        ? 'bg-gray-200 text-gray-400 cursor-default'
                        : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                    }`}
                  >
                    {item.item_name}
                  </button>
                );
              })}
              {template.length > 8 && (
                <button
                  type="button"
                  onClick={() => setShowAll(true)}
                  className="px-2 py-1 text-xs text-gray-500 hover:text-purple-600"
                >
                  +{template.length - 8}개 더
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* 사용자 정의 항목 추가 */}
      <div className="flex gap-2">
        <input
          type="text"
          value={customItemName}
          onChange={(e) => setCustomItemName(e.target.value)}
          placeholder="항목명 직접 입력..."
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
        />
        <input
          type="text"
          value={customUnit}
          onChange={(e) => setCustomUnit(e.target.value)}
          placeholder="단위"
          className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
        />
        <button
          type="button"
          onClick={addCustomItem}
          disabled={!customItemName.trim()}
          className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50"
        >
          <i className="fas fa-plus"></i>
        </button>
      </div>

      {/* 입력된 수치 목록 */}
      {values.length > 0 && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">입력된 수치</label>
          <div className="space-y-2">
            {values.map((val, idx) => {
              const inRange = isInRange(val);
              const rangeText = getRangeText(val);

              return (
                <div
                  key={idx}
                  className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                >
                  {/* 항목명 */}
                  <span className="flex-1 text-sm font-medium text-gray-700">
                    {val.item_name}
                  </span>

                  {/* 수치 입력 */}
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={val.item_value}
                      onChange={(e) => updateValue(idx, e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="0"
                      step="any"
                      className={`w-24 px-3 py-1.5 border rounded-lg text-sm text-right focus:ring-2 focus:ring-purple-500 ${
                        inRange === false
                          ? 'border-red-300 bg-red-50'
                          : inRange === true
                          ? 'border-green-300 bg-green-50'
                          : 'border-gray-300'
                      }`}
                    />
                    {val.unit && (
                      <span className="text-sm text-gray-500 w-12">{val.unit}</span>
                    )}
                  </div>

                  {/* 참조 범위 */}
                  {rangeText && (
                    <span className="text-xs text-gray-400 w-24 text-right">
                      ({rangeText})
                    </span>
                  )}

                  {/* 상태 표시 */}
                  {inRange !== null && (
                    <span className={`text-sm ${inRange ? 'text-green-500' : 'text-red-500'}`}>
                      {inRange ? (
                        <i className="fas fa-check-circle"></i>
                      ) : (
                        <i className="fas fa-exclamation-circle"></i>
                      )}
                    </span>
                  )}

                  {/* 삭제 버튼 */}
                  <button
                    type="button"
                    onClick={() => removeItem(idx)}
                    className="text-gray-400 hover:text-red-500"
                  >
                    <i className="fas fa-times"></i>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 빈 상태 */}
      {values.length === 0 && (
        <div className="text-center py-4 text-gray-400 text-sm">
          <i className="fas fa-chart-line text-2xl mb-2"></i>
          <p>위에서 항목을 선택하거나 직접 입력하세요</p>
        </div>
      )}
    </div>
  );
};

export default ExamValueEditor;
