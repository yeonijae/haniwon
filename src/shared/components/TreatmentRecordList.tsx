/**
 * 진료내역 목록 컴포넌트
 * 오늘의 진료내역 또는 환자별 진료내역 조회
 */

import React, { useState, useEffect, useCallback } from 'react';
import * as treatmentRecordApi from '@shared/api/treatmentRecordApi';
import type { TreatmentRecord, TreatmentRecordStatus } from '@shared/types/treatmentRecord';
import { RECORD_STATUS_LABELS, SERVICE_TYPE_LABELS } from '@shared/types/treatmentRecord';
import TreatmentTimeline from './TreatmentTimeline';

interface TreatmentRecordListProps {
  patientId?: number;
  dateRange?: { start: string; end: string };
  onRecordClick?: (record: TreatmentRecord) => void;
}

type FilterTab = 'all' | 'in_progress' | 'completed';

const TreatmentRecordList: React.FC<TreatmentRecordListProps> = ({
  patientId,
  dateRange,
  onRecordClick,
}) => {
  const [records, setRecords] = useState<TreatmentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [selectedRecord, setSelectedRecord] = useState<TreatmentRecord | null>(null);

  const loadRecords = useCallback(async () => {
    try {
      setLoading(true);

      let data: TreatmentRecord[];

      if (patientId) {
        // 환자별 진료내역
        data = await treatmentRecordApi.fetchTreatmentRecordsByPatient(patientId);
      } else {
        // 오늘의 진료내역
        data = await treatmentRecordApi.fetchTodayTreatmentRecords();
      }

      setRecords(data);
    } catch (error) {
      console.error('진료내역 로드 오류:', error);
    } finally {
      setLoading(false);
    }
  }, [patientId, dateRange]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  // 필터링된 목록
  const filteredRecords = records.filter(record => {
    switch (activeTab) {
      case 'in_progress':
        return record.status === 'in_progress';
      case 'completed':
        return record.status === 'completed';
      default:
        return true;
    }
  });

  const getStatusColor = (status: TreatmentRecordStatus) => {
    switch (status) {
      case 'in_progress':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'completed':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ko-KR', {
      month: 'short',
      day: 'numeric',
      weekday: 'short',
    });
  };

  // 통계 계산
  const stats = {
    total: records.length,
    inProgress: records.filter(r => r.status === 'in_progress').length,
    completed: records.filter(r => r.status === 'completed').length,
  };

  if (loading) {
    return (
      <div className="p-4 text-center text-gray-500">
        진료내역 로딩 중...
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* 통계 헤더 */}
      <div className="p-3 bg-gray-50 border-b grid grid-cols-3 gap-2 text-center">
        <div>
          <div className="text-lg font-bold text-gray-900">{stats.total}</div>
          <div className="text-xs text-gray-500">전체</div>
        </div>
        <div>
          <div className="text-lg font-bold text-green-600">{stats.inProgress}</div>
          <div className="text-xs text-gray-500">진행중</div>
        </div>
        <div>
          <div className="text-lg font-bold text-blue-600">{stats.completed}</div>
          <div className="text-xs text-gray-500">완료</div>
        </div>
      </div>

      {/* 탭 필터 */}
      <div className="flex border-b bg-white">
        {[
          { key: 'all', label: '전체' },
          { key: 'in_progress', label: '진행중' },
          { key: 'completed', label: '완료' },
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
        {filteredRecords.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <div className="text-4xl mb-2">📋</div>
            <div>진료내역이 없습니다</div>
          </div>
        ) : (
          <ul className="divide-y">
            {filteredRecords.map(record => (
              <li
                key={record.id}
                className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                  record.status === 'in_progress' ? 'bg-green-50' : ''
                }`}
                onClick={() => {
                  setSelectedRecord(record);
                  onRecordClick?.(record);
                }}
              >
                <div className="flex items-start gap-3">
                  {/* 상태 배지 */}
                  <span className={`px-2 py-1 text-xs font-medium rounded border flex-shrink-0 ${getStatusColor(record.status)}`}>
                    {RECORD_STATUS_LABELS[record.status]}
                  </span>

                  {/* 내용 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">
                        {record.patient_name}
                      </span>
                      {record.patient_chart_number && (
                        <span className="text-sm text-gray-400">
                          ({record.patient_chart_number})
                        </span>
                      )}
                    </div>

                    {/* 서비스 목록 */}
                    {record.services.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {record.services.map(service => (
                          <span
                            key={service}
                            className="px-1.5 py-0.5 text-xs bg-gray-100 text-gray-600 rounded"
                          >
                            {SERVICE_TYPE_LABELS[service] || service}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* 시간 정보 */}
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                      {!patientId && (
                        <span>{formatDate(record.visit_date)}</span>
                      )}
                      <span>체크인: {formatTime(record.check_in_time)}</span>
                      {record.check_out_time && (
                        <span>체크아웃: {formatTime(record.check_out_time)}</span>
                      )}
                      {record.total_wait_time !== undefined && record.total_wait_time > 0 && (
                        <span className="text-orange-500">
                          대기: {record.total_wait_time}분
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 화살표 */}
                  <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 새로고침 버튼 */}
      <div className="p-2 border-t bg-gray-50">
        <button
          onClick={loadRecords}
          className="w-full py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
        >
          새로고침
        </button>
      </div>

      {/* 타임라인 모달 */}
      {selectedRecord && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[80vh] overflow-hidden flex flex-col">
            {/* 모달 헤더 */}
            <div className="px-4 py-3 border-b flex items-center justify-between flex-shrink-0">
              <div>
                <h3 className="font-medium text-gray-900">
                  {selectedRecord.patient_name} 진료내역
                </h3>
                <p className="text-sm text-gray-500">
                  {formatDate(selectedRecord.visit_date)}
                </p>
              </div>
              <button
                onClick={() => setSelectedRecord(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* 타임라인 */}
            <div className="flex-1 overflow-y-auto">
              <TreatmentTimeline recordId={selectedRecord.id} />
            </div>

            {/* 모달 푸터 */}
            <div className="px-4 py-3 border-t bg-gray-50 flex-shrink-0">
              <button
                onClick={() => setSelectedRecord(null)}
                className="w-full py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TreatmentRecordList;
