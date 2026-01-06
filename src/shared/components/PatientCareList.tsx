/**
 * 환자관리 목록 컴포넌트
 * 상담실 전체 환자관리 화면
 */

import React, { useState, useEffect, useCallback } from 'react';
import * as patientCareApi from '@shared/api/patientCareApi';
import { getCurrentDate } from '@shared/lib/postgres';
import type { PatientCareItem, PatientCareType, PatientCareStatus } from '@shared/types/patientCare';
import { CARE_TYPE_LABELS, TREATMENT_STATUS_LABELS } from '@shared/types/patientCare';

interface PatientCareListProps {
  onPatientClick?: (patientId: number) => void;
}

type FilterTab = 'all' | 'happy_call' | 'followup' | 'overdue';

const PatientCareList: React.FC<PatientCareListProps> = ({
  onPatientClick,
}) => {
  const [items, setItems] = useState<PatientCareItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [stats, setStats] = useState<{
    pending: number;
    scheduled: number;
    completed_today: number;
    overdue: number;
  } | null>(null);

  // 상세 모달
  const [selectedItem, setSelectedItem] = useState<PatientCareItem | null>(null);
  const [resultNote, setResultNote] = useState('');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [itemsData, statsData] = await Promise.all([
        patientCareApi.fetchTodayPatientCare(),
        patientCareApi.fetchPatientCareStats(),
      ]);
      setItems(itemsData);
      setStats(statsData);
    } catch (error) {
      console.error('환자관리 로드 오류:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 필터링된 목록
  const filteredItems = items.filter(item => {
    const today = getCurrentDate();
    const isOverdue = item.scheduled_date && item.scheduled_date < today;

    switch (activeTab) {
      case 'happy_call':
        return item.care_type.startsWith('happy_call');
      case 'followup':
        return item.care_type === 'treatment_followup' || item.care_type === 'treatment_closure';
      case 'overdue':
        return isOverdue;
      default:
        return true;
    }
  });

  const handleComplete = async (item: PatientCareItem, result?: string) => {
    try {
      await patientCareApi.completePatientCareItem(item.id, '상담실', result);
      setItems(prev => prev.filter(i => i.id !== item.id));
      if (stats) {
        setStats({
          ...stats,
          pending: Math.max(0, stats.pending - 1),
          completed_today: stats.completed_today + 1,
        });
      }
      setSelectedItem(null);
      setResultNote('');
    } catch (error) {
      console.error('완료 처리 오류:', error);
    }
  };

  const handleSkip = async (item: PatientCareItem, reason?: string) => {
    try {
      await patientCareApi.skipPatientCareItem(item.id, reason);
      setItems(prev => prev.filter(i => i.id !== item.id));
      if (stats) {
        setStats({
          ...stats,
          pending: Math.max(0, stats.pending - 1),
        });
      }
    } catch (error) {
      console.error('건너뛰기 오류:', error);
    }
  };

  const handleReschedule = async (item: PatientCareItem, newDate: string) => {
    try {
      await patientCareApi.reschedulePatientCareItem(item.id, newDate);
      setItems(prev => prev.map(i =>
        i.id === item.id ? { ...i, scheduled_date: newDate, status: 'scheduled' } : i
      ));
    } catch (error) {
      console.error('일정 변경 오류:', error);
    }
  };

  const getCareTypeColor = (careType: PatientCareType) => {
    switch (careType) {
      case 'happy_call_delivery':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'happy_call_medication':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'treatment_followup':
        return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'treatment_closure':
        return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'periodic_message':
        return 'bg-cyan-100 text-cyan-700 border-cyan-200';
      case 'reservation_reminder':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const isOverdue = (item: PatientCareItem) => {
    if (!item.scheduled_date) return false;
    const today = getCurrentDate();
    return item.scheduled_date < today;
  };

  if (loading) {
    return (
      <div className="p-4 text-center text-gray-500">
        환자관리 로딩 중...
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* 통계 헤더 */}
      {stats && (
        <div className="p-3 bg-gray-50 border-b grid grid-cols-4 gap-2 text-center">
          <div>
            <div className="text-lg font-bold text-blue-600">{stats.pending}</div>
            <div className="text-xs text-gray-500">대기</div>
          </div>
          <div>
            <div className="text-lg font-bold text-yellow-600">{stats.scheduled}</div>
            <div className="text-xs text-gray-500">예정</div>
          </div>
          <div>
            <div className="text-lg font-bold text-green-600">{stats.completed_today}</div>
            <div className="text-xs text-gray-500">오늘 완료</div>
          </div>
          <div>
            <div className="text-lg font-bold text-red-600">{stats.overdue}</div>
            <div className="text-xs text-gray-500">기한초과</div>
          </div>
        </div>
      )}

      {/* 탭 필터 */}
      <div className="flex border-b bg-white">
        {[
          { key: 'all', label: '전체' },
          { key: 'happy_call', label: '해피콜' },
          { key: 'followup', label: '상담' },
          { key: 'overdue', label: '기한초과' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as FilterTab)}
            className={`flex-1 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 목록 */}
      <div className="flex-1 overflow-y-auto">
        {filteredItems.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <div className="text-4xl mb-2">📋</div>
            <div>처리할 항목이 없습니다</div>
          </div>
        ) : (
          <ul className="divide-y">
            {filteredItems.map(item => (
              <li
                key={item.id}
                className={`p-4 hover:bg-gray-50 cursor-pointer ${
                  isOverdue(item) ? 'bg-red-50' : ''
                }`}
                onClick={() => setSelectedItem(item)}
              >
                <div className="flex items-start gap-3">
                  {/* 유형 배지 */}
                  <span className={`px-2 py-1 text-xs font-medium rounded border ${getCareTypeColor(item.care_type)}`}>
                    {CARE_TYPE_LABELS[item.care_type]}
                  </span>

                  {/* 내용 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">
                        {item.patient_name}
                      </span>
                      {item.patient_chart_number && (
                        <span className="text-xs text-gray-400">
                          ({item.patient_chart_number})
                        </span>
                      )}
                      {item.treatment_status && (
                        <span className="px-1.5 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
                          {TREATMENT_STATUS_LABELS[item.treatment_status]}
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      {item.title}
                    </div>
                    {item.description && (
                      <div className="text-xs text-gray-400 mt-1 truncate">
                        {item.description}
                      </div>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                      {item.patient_phone && (
                        <span className="flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                          </svg>
                          {item.patient_phone}
                        </span>
                      )}
                      {item.scheduled_date && (
                        <span className={isOverdue(item) ? 'text-red-500' : ''}>
                          예정: {item.scheduled_date}
                        </span>
                      )}
                      {item.total_visits !== undefined && (
                        <span>내원 {item.total_visits}회</span>
                      )}
                    </div>
                  </div>

                  {/* 액션 버튼 */}
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleComplete(item);
                      }}
                      className="px-2 py-1 text-xs text-green-600 hover:bg-green-100 rounded border border-green-200"
                    >
                      완료
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSkip(item);
                      }}
                      className="px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 rounded border border-gray-200"
                    >
                      건너뛰기
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 새로고침 버튼 */}
      <div className="p-2 border-t bg-gray-50">
        <button
          onClick={loadData}
          className="w-full py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
        >
          새로고침
        </button>
      </div>

      {/* 상세 모달 */}
      {selectedItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            {/* 모달 헤더 */}
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <h3 className="font-medium text-gray-900">환자관리 상세</h3>
              <button
                onClick={() => {
                  setSelectedItem(null);
                  setResultNote('');
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* 모달 내용 */}
            <div className="p-4 space-y-4">
              {/* 환자 정보 */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`px-2 py-1 text-xs font-medium rounded border ${getCareTypeColor(selectedItem.care_type)}`}>
                    {CARE_TYPE_LABELS[selectedItem.care_type]}
                  </span>
                  {isOverdue(selectedItem) && (
                    <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-700 rounded">
                      기한초과
                    </span>
                  )}
                </div>
                <div className="text-lg font-medium text-gray-900">
                  {selectedItem.patient_name}
                  {selectedItem.patient_chart_number && (
                    <span className="text-sm text-gray-400 ml-2">
                      ({selectedItem.patient_chart_number})
                    </span>
                  )}
                </div>
                {selectedItem.patient_phone && (
                  <a
                    href={`tel:${selectedItem.patient_phone}`}
                    className="text-blue-600 hover:underline text-sm"
                  >
                    {selectedItem.patient_phone}
                  </a>
                )}
              </div>

              {/* 관리 내용 */}
              <div className="bg-gray-50 rounded p-3">
                <div className="font-medium text-gray-900 mb-1">{selectedItem.title}</div>
                {selectedItem.description && (
                  <div className="text-sm text-gray-600">{selectedItem.description}</div>
                )}
              </div>

              {/* 치료 정보 */}
              <div className="grid grid-cols-2 gap-2 text-sm">
                {selectedItem.treatment_status && (
                  <div>
                    <span className="text-gray-500">치료 상태:</span>{' '}
                    <span className="font-medium">{TREATMENT_STATUS_LABELS[selectedItem.treatment_status]}</span>
                  </div>
                )}
                {selectedItem.total_visits !== undefined && (
                  <div>
                    <span className="text-gray-500">총 내원:</span>{' '}
                    <span className="font-medium">{selectedItem.total_visits}회</span>
                  </div>
                )}
                {selectedItem.last_visit_date && (
                  <div>
                    <span className="text-gray-500">마지막 내원:</span>{' '}
                    <span className="font-medium">{selectedItem.last_visit_date}</span>
                  </div>
                )}
                {selectedItem.scheduled_date && (
                  <div>
                    <span className="text-gray-500">예정일:</span>{' '}
                    <span className={`font-medium ${isOverdue(selectedItem) ? 'text-red-600' : ''}`}>
                      {selectedItem.scheduled_date}
                    </span>
                  </div>
                )}
              </div>

              {/* 결과 메모 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  결과 메모
                </label>
                <textarea
                  value={resultNote}
                  onChange={(e) => setResultNote(e.target.value)}
                  placeholder="통화 내용이나 결과를 입력하세요..."
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  rows={3}
                />
              </div>
            </div>

            {/* 모달 푸터 */}
            <div className="px-4 py-3 border-t bg-gray-50 flex gap-2">
              <button
                onClick={() => handleComplete(selectedItem, resultNote)}
                className="flex-1 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
              >
                완료
              </button>
              <button
                onClick={() => {
                  const tomorrow = new Date();
                  tomorrow.setDate(tomorrow.getDate() + 1);
                  const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
                  handleReschedule(selectedItem, tomorrowStr);
                  setSelectedItem(null);
                }}
                className="flex-1 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 font-medium"
              >
                내일로 미루기
              </button>
              <button
                onClick={() => {
                  handleSkip(selectedItem, resultNote);
                  setSelectedItem(null);
                }}
                className="flex-1 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 font-medium"
              >
                건너뛰기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PatientCareList;
