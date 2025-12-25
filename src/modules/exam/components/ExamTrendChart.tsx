/**
 * 검사 수치 추이 그래프 컴포넌트
 * - 시간에 따른 수치 변화 시각화
 * - 복수 항목 비교
 * - 참조 범위 표시
 */

import { useState, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
} from 'recharts';
import type { ExamResult, ExamType, ExamValue } from '../types';
import { getExamTypeInfo } from '../types';

interface ExamTrendChartProps {
  exams: ExamResult[];
  examType: ExamType;
}

// 차트 색상
const CHART_COLORS = [
  '#8B5CF6', // purple
  '#3B82F6', // blue
  '#10B981', // green
  '#F59E0B', // amber
  '#EF4444', // red
  '#EC4899', // pink
  '#6366F1', // indigo
  '#14B8A6', // teal
];

// 항목별 참조 범위
interface ReferenceRange {
  min?: number;
  max?: number;
}

const ExamTrendChart: React.FC<ExamTrendChartProps> = ({ exams, examType }) => {
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  const typeInfo = getExamTypeInfo(examType);

  // 해당 유형의 검사만 필터링하고 날짜순 정렬
  const filteredExams = useMemo(() => {
    return exams
      .filter(e => e.exam_type === examType && e.values && e.values.length > 0)
      .sort((a, b) => a.exam_date.localeCompare(b.exam_date));
  }, [exams, examType]);

  // 사용 가능한 항목 목록 추출
  const availableItems = useMemo(() => {
    const itemMap = new Map<string, { unit: string; min?: number; max?: number }>();

    filteredExams.forEach(exam => {
      exam.values?.forEach(v => {
        if (!itemMap.has(v.item_name)) {
          itemMap.set(v.item_name, {
            unit: v.unit || '',
            min: v.reference_min,
            max: v.reference_max,
          });
        }
      });
    });

    return Array.from(itemMap.entries()).map(([name, info]) => ({
      name,
      ...info,
    }));
  }, [filteredExams]);

  // 선택된 항목이 없으면 처음 3개 자동 선택
  useMemo(() => {
    if (selectedItems.length === 0 && availableItems.length > 0) {
      setSelectedItems(availableItems.slice(0, 3).map(i => i.name));
    }
  }, [availableItems]);

  // 차트 데이터 변환
  const chartData = useMemo(() => {
    return filteredExams.map(exam => {
      const dataPoint: Record<string, any> = {
        date: exam.exam_date,
        displayDate: formatDate(exam.exam_date),
      };

      exam.values?.forEach(v => {
        if (v.item_value !== undefined && v.item_value !== null) {
          dataPoint[v.item_name] = Number(v.item_value);
        }
      });

      return dataPoint;
    });
  }, [filteredExams]);

  // 선택된 항목의 참조 범위
  const referenceRanges = useMemo(() => {
    const ranges: Record<string, ReferenceRange> = {};
    selectedItems.forEach(item => {
      const info = availableItems.find(i => i.name === item);
      if (info) {
        ranges[item] = { min: info.min, max: info.max };
      }
    });
    return ranges;
  }, [selectedItems, availableItems]);

  // 항목 선택/해제 토글
  const toggleItem = (itemName: string) => {
    setSelectedItems(prev => {
      if (prev.includes(itemName)) {
        return prev.filter(i => i !== itemName);
      } else {
        return [...prev, itemName];
      }
    });
  };

  // 날짜 포맷
  function formatDate(dateStr: string): string {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[1]}/${parts[2]}`;
    }
    return dateStr;
  }

  // 데이터가 없는 경우
  if (filteredExams.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        <i className="fas fa-chart-line text-4xl mb-3"></i>
        <p>수치 데이터가 있는 검사가 없습니다.</p>
        <p className="text-sm mt-1">인바디, 맥진, 평형검사 등의 수치를 입력해주세요.</p>
      </div>
    );
  }

  if (chartData.length < 2) {
    return (
      <div className="text-center py-8 text-gray-400">
        <i className="fas fa-chart-line text-4xl mb-3"></i>
        <p>추이를 보려면 최소 2회 이상의 검사가 필요합니다.</p>
        <p className="text-sm mt-1">현재 {chartData.length}회 검사 기록이 있습니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <i className={`fas ${typeInfo?.icon || 'fa-chart-line'} text-purple-600`}></i>
          <span className="font-medium text-gray-700">
            {typeInfo?.name || examType} 추이
          </span>
          <span className="text-sm text-gray-400">
            ({filteredExams.length}회 검사)
          </span>
        </div>
      </div>

      {/* 항목 선택 */}
      <div className="flex flex-wrap gap-2">
        {availableItems.map((item, idx) => {
          const isSelected = selectedItems.includes(item.name);
          const color = CHART_COLORS[idx % CHART_COLORS.length];

          return (
            <button
              key={item.name}
              onClick={() => toggleItem(item.name)}
              className={`px-3 py-1 text-sm rounded-full border transition-colors flex items-center gap-1 ${
                isSelected
                  ? 'border-transparent text-white'
                  : 'border-gray-200 text-gray-600 hover:border-gray-400'
              }`}
              style={isSelected ? { backgroundColor: color } : {}}
            >
              {isSelected && <i className="fas fa-check text-xs"></i>}
              {item.name}
              {item.unit && <span className="text-xs opacity-70">({item.unit})</span>}
            </button>
          );
        })}
      </div>

      {/* 차트 */}
      {selectedItems.length > 0 ? (
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 10, right: 30, left: 10, bottom: 10 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis
                dataKey="displayDate"
                tick={{ fontSize: 12, fill: '#6B7280' }}
                axisLine={{ stroke: '#E5E7EB' }}
                tickLine={{ stroke: '#E5E7EB' }}
              />
              <YAxis
                tick={{ fontSize: 12, fill: '#6B7280' }}
                axisLine={{ stroke: '#E5E7EB' }}
                tickLine={{ stroke: '#E5E7EB' }}
                width={50}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #E5E7EB',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                }}
                labelFormatter={(label) => `날짜: ${label}`}
                formatter={(value: number, name: string) => {
                  const item = availableItems.find(i => i.name === name);
                  return [`${value}${item?.unit || ''}`, name];
                }}
              />
              <Legend
                wrapperStyle={{ paddingTop: '10px' }}
                formatter={(value) => (
                  <span className="text-sm text-gray-600">{value}</span>
                )}
              />

              {/* 참조 범위 영역 표시 (첫 번째 선택 항목만) */}
              {selectedItems.length === 1 && referenceRanges[selectedItems[0]] && (
                <>
                  {referenceRanges[selectedItems[0]].min !== undefined &&
                    referenceRanges[selectedItems[0]].max !== undefined && (
                      <ReferenceArea
                        y1={referenceRanges[selectedItems[0]].min}
                        y2={referenceRanges[selectedItems[0]].max}
                        fill="#10B981"
                        fillOpacity={0.1}
                        stroke="none"
                      />
                    )}
                  {referenceRanges[selectedItems[0]].min !== undefined && (
                    <ReferenceLine
                      y={referenceRanges[selectedItems[0]].min}
                      stroke="#10B981"
                      strokeDasharray="5 5"
                      label={{
                        value: `하한 ${referenceRanges[selectedItems[0]].min}`,
                        position: 'insideBottomLeft',
                        fill: '#10B981',
                        fontSize: 10,
                      }}
                    />
                  )}
                  {referenceRanges[selectedItems[0]].max !== undefined && (
                    <ReferenceLine
                      y={referenceRanges[selectedItems[0]].max}
                      stroke="#10B981"
                      strokeDasharray="5 5"
                      label={{
                        value: `상한 ${referenceRanges[selectedItems[0]].max}`,
                        position: 'insideTopLeft',
                        fill: '#10B981',
                        fontSize: 10,
                      }}
                    />
                  )}
                </>
              )}

              {/* 데이터 라인 */}
              {selectedItems.map((itemName, idx) => (
                <Line
                  key={itemName}
                  type="monotone"
                  dataKey={itemName}
                  stroke={CHART_COLORS[availableItems.findIndex(i => i.name === itemName) % CHART_COLORS.length]}
                  strokeWidth={2}
                  dot={{
                    fill: CHART_COLORS[availableItems.findIndex(i => i.name === itemName) % CHART_COLORS.length],
                    strokeWidth: 0,
                    r: 4,
                  }}
                  activeDot={{
                    r: 6,
                    strokeWidth: 2,
                    stroke: 'white',
                  }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="h-80 flex items-center justify-center text-gray-400">
          <p>표시할 항목을 선택해주세요</p>
        </div>
      )}

      {/* 최근 수치 변화 요약 */}
      {selectedItems.length > 0 && chartData.length >= 2 && (
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-700 mb-3">최근 변화</h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {selectedItems.map((itemName) => {
              const lastTwo = chartData.slice(-2);
              const prev = lastTwo[0]?.[itemName];
              const curr = lastTwo[1]?.[itemName];

              if (prev === undefined || curr === undefined) return null;

              const change = curr - prev;
              const changePercent = prev !== 0 ? ((change / prev) * 100).toFixed(1) : 0;
              const isUp = change > 0;
              const isDown = change < 0;

              const item = availableItems.find(i => i.name === itemName);

              return (
                <div key={itemName} className="bg-white rounded-lg p-3 border border-gray-200">
                  <p className="text-xs text-gray-500 truncate">{itemName}</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {curr}
                    {item?.unit && <span className="text-sm text-gray-400 ml-1">{item.unit}</span>}
                  </p>
                  <p className={`text-xs flex items-center gap-1 ${
                    isUp ? 'text-red-500' : isDown ? 'text-blue-500' : 'text-gray-400'
                  }`}>
                    {isUp && <i className="fas fa-arrow-up"></i>}
                    {isDown && <i className="fas fa-arrow-down"></i>}
                    {!isUp && !isDown && <i className="fas fa-minus"></i>}
                    {Math.abs(change).toFixed(1)} ({isUp ? '+' : ''}{changePercent}%)
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default ExamTrendChart;
