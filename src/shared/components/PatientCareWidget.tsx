/**
 * 환자관리 위젯 컴포넌트
 * 상담실 사이드바용 - 오늘의 환자관리 목록
 */

import React, { useState, useEffect, useCallback } from 'react';
import * as patientCareApi from '@shared/api/patientCareApi';
import type { PatientCareItem, PatientCareType } from '@shared/types/patientCare';
import { CARE_TYPE_LABELS } from '@shared/types/patientCare';

interface PatientCareWidgetProps {
  maxItems?: number;
  title?: string;
  onViewAll?: () => void;
  onItemClick?: (item: PatientCareItem) => void;
}

const PatientCareWidget: React.FC<PatientCareWidgetProps> = ({
  maxItems = 5,
  title = '오늘의 환자관리',
  onViewAll,
  onItemClick,
}) => {
  const [items, setItems] = useState<PatientCareItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  const loadItems = useCallback(async () => {
    try {
      setLoading(true);
      const data = await patientCareApi.fetchTodayPatientCare();
      setTotalCount(data.length);
      setItems(data.slice(0, maxItems));
    } catch (error) {
      console.error('환자관리 로드 오류:', error);
    } finally {
      setLoading(false);
    }
  }, [maxItems]);

  useEffect(() => {
    loadItems();
    // 1분마다 자동 새로고침
    const interval = setInterval(loadItems, 60000);
    return () => clearInterval(interval);
  }, [loadItems]);

  const handleComplete = async (itemId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await patientCareApi.completePatientCareItem(itemId, '상담실');
      setItems(prev => prev.filter(item => item.id !== itemId));
      setTotalCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('환자관리 완료 오류:', error);
    }
  };

  const handleSkip = async (itemId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await patientCareApi.skipPatientCareItem(itemId);
      setItems(prev => prev.filter(item => item.id !== itemId));
      setTotalCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('환자관리 건너뛰기 오류:', error);
    }
  };

  const getCareTypeColor = (careType: PatientCareType) => {
    switch (careType) {
      case 'happy_call_delivery':
        return 'bg-green-100 text-green-700';
      case 'happy_call_medication':
        return 'bg-blue-100 text-blue-700';
      case 'treatment_followup':
        return 'bg-purple-100 text-purple-700';
      case 'treatment_closure':
        return 'bg-orange-100 text-orange-700';
      case 'periodic_message':
        return 'bg-cyan-100 text-cyan-700';
      case 'reservation_reminder':
        return 'bg-yellow-100 text-yellow-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-12 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      {/* 헤더 */}
      <div className="px-4 py-3 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="font-medium text-gray-900">{title}</h3>
          {totalCount > 0 && (
            <span className="px-2 py-0.5 text-xs font-medium bg-orange-100 text-orange-700 rounded-full">
              {totalCount}
            </span>
          )}
        </div>
        {onViewAll && (
          <button
            onClick={onViewAll}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            전체 보기
          </button>
        )}
      </div>

      {/* 목록 */}
      <div className="divide-y">
        {items.length === 0 ? (
          <div className="p-6 text-center text-gray-400">
            <div className="text-2xl mb-1">📋</div>
            <div className="text-sm">오늘 처리할 항목이 없습니다</div>
          </div>
        ) : (
          items.map(item => (
            <div
              key={item.id}
              className="px-4 py-3 hover:bg-gray-50 cursor-pointer"
              onClick={() => onItemClick?.(item)}
            >
              <div className="flex items-start gap-3">
                {/* 유형 배지 */}
                <span className={`px-2 py-0.5 text-xs font-medium rounded flex-shrink-0 ${getCareTypeColor(item.care_type)}`}>
                  {CARE_TYPE_LABELS[item.care_type]}
                </span>

                {/* 내용 */}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">
                    {item.patient_name}
                  </div>
                  <div className="text-xs text-gray-500 truncate">
                    {item.title}
                  </div>
                  {item.patient_phone && (
                    <div className="text-xs text-gray-400 mt-0.5">
                      {item.patient_phone}
                    </div>
                  )}
                </div>

                {/* 액션 버튼 */}
                <div className="flex gap-1 flex-shrink-0">
                  <button
                    onClick={(e) => handleComplete(item.id, e)}
                    className="p-1 text-green-600 hover:bg-green-100 rounded"
                    title="완료"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </button>
                  <button
                    onClick={(e) => handleSkip(item.id, e)}
                    className="p-1 text-gray-400 hover:bg-gray-100 rounded"
                    title="건너뛰기"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 더 많은 항목 */}
      {totalCount > maxItems && (
        <div className="px-4 py-2 border-t text-center">
          <button
            onClick={onViewAll}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            +{totalCount - maxItems}개 더 보기
          </button>
        </div>
      )}
    </div>
  );
};

export default PatientCareWidget;
