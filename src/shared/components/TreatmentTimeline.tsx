/**
 * 진료내역 타임라인 컴포넌트
 * 환자의 동선을 시각적으로 보여줌
 */

import React, { useState, useEffect } from 'react';
import * as treatmentRecordApi from '@shared/api/treatmentRecordApi';
import type { TreatmentRecord, TimelineEvent, TimelineEventType } from '@shared/types/treatmentRecord';
import { EVENT_TYPE_LABELS, RECORD_STATUS_LABELS, SERVICE_TYPE_LABELS } from '@shared/types/treatmentRecord';

interface TreatmentTimelineProps {
  recordId?: number;
  patientId?: number;
  showServices?: boolean;
  showWaitTime?: boolean;
  compact?: boolean;
}

const TreatmentTimeline: React.FC<TreatmentTimelineProps> = ({
  recordId,
  patientId,
  showServices = true,
  showWaitTime = true,
  compact = false,
}) => {
  const [record, setRecord] = useState<TreatmentRecord | null>(null);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [recordId, patientId]);

  const loadData = async () => {
    try {
      setLoading(true);

      let targetRecordId = recordId;

      // patientId로 오늘의 진료내역 조회
      if (!targetRecordId && patientId) {
        const activeRecord = await treatmentRecordApi.fetchActiveRecordForPatient(patientId);
        if (activeRecord) {
          targetRecordId = activeRecord.id;
        }
      }

      if (!targetRecordId) {
        setRecord(null);
        setEvents([]);
        return;
      }

      // 진료내역 및 타임라인 조회
      const [recordData, eventsData] = await Promise.all([
        treatmentRecordApi.fetchTreatmentRecordById(targetRecordId),
        treatmentRecordApi.fetchTimelineEvents(targetRecordId),
      ]);

      setRecord(recordData);
      setEvents(eventsData);
    } catch (error) {
      console.error('타임라인 로드 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  const getEventIcon = (eventType: TimelineEventType) => {
    switch (eventType) {
      case 'check_in':
        return (
          <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
            </svg>
          </div>
        );
      case 'waiting_consultation':
      case 'waiting_treatment':
      case 'waiting_payment':
        return (
          <div className="w-8 h-8 rounded-full bg-yellow-500 flex items-center justify-center text-white">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        );
      case 'consultation_start':
      case 'consultation_end':
        return (
          <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
        );
      case 'treatment_start':
      case 'treatment_end':
        return (
          <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center text-white">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </div>
        );
      case 'payment_complete':
        return (
          <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
        );
      case 'check_out':
        return (
          <div className="w-8 h-8 rounded-full bg-gray-500 flex items-center justify-center text-white">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </div>
        );
      default:
        return (
          <div className="w-8 h-8 rounded-full bg-gray-400 flex items-center justify-center text-white">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        );
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const calculateDuration = (start: string, end: string) => {
    const startTime = new Date(start).getTime();
    const endTime = new Date(end).getTime();
    const minutes = Math.round((endTime - startTime) / 60000);
    return minutes;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'in_progress':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'completed':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  if (loading) {
    return (
      <div className="p-4">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/3"></div>
          {[1, 2, 3].map(i => (
            <div key={i} className="flex gap-3">
              <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
              <div className="flex-1 h-12 bg-gray-200 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!record) {
    return (
      <div className="p-8 text-center text-gray-400">
        <div className="text-4xl mb-2">📋</div>
        <div>진료내역이 없습니다</div>
      </div>
    );
  }

  return (
    <div className={compact ? 'p-2' : 'p-4'}>
      {/* 헤더 */}
      {!compact && (
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <span className={`px-2 py-1 text-xs font-medium rounded border ${getStatusColor(record.status)}`}>
              {RECORD_STATUS_LABELS[record.status]}
            </span>
            <span className="text-sm text-gray-500">
              {new Date(record.visit_date).toLocaleDateString('ko-KR')}
            </span>
          </div>

          {/* 서비스 목록 */}
          {showServices && record.services.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {record.services.map(service => (
                <span
                  key={service}
                  className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded"
                >
                  {SERVICE_TYPE_LABELS[service] || service}
                </span>
              ))}
            </div>
          )}

          {/* 대기시간 요약 */}
          {showWaitTime && record.total_wait_time !== undefined && record.total_wait_time > 0 && (
            <div className="text-sm">
              <span className="text-gray-500">총 대기시간:</span>{' '}
              <span className="font-medium text-orange-600">{record.total_wait_time}분</span>
            </div>
          )}
        </div>
      )}

      {/* 타임라인 */}
      <div className="relative">
        {/* 세로 라인 */}
        <div className="absolute left-4 top-4 bottom-4 w-0.5 bg-gray-200"></div>

        {/* 이벤트 목록 */}
        <div className="space-y-4">
          {events.map((event, index) => {
            const nextEvent = events[index + 1];
            const duration = nextEvent
              ? calculateDuration(event.timestamp, nextEvent.timestamp)
              : null;

            const isWaiting = event.event_type.startsWith('waiting_');

            return (
              <div key={event.id} className="relative flex items-start gap-3">
                {/* 아이콘 */}
                <div className="relative z-10">
                  {getEventIcon(event.event_type)}
                </div>

                {/* 내용 */}
                <div className={`flex-1 ${compact ? 'py-1' : 'pb-4'}`}>
                  <div className="flex items-center gap-2">
                    <span className={`font-medium ${compact ? 'text-sm' : ''} text-gray-900`}>
                      {EVENT_TYPE_LABELS[event.event_type]}
                    </span>
                    <span className="text-xs text-gray-400">
                      {formatTime(event.timestamp)}
                    </span>
                  </div>

                  {/* 위치/담당자 정보 */}
                  {!compact && (event.location || event.staff_name) && (
                    <div className="text-xs text-gray-500 mt-0.5">
                      {event.location && <span>{event.location}</span>}
                      {event.location && event.staff_name && <span> • </span>}
                      {event.staff_name && <span>{event.staff_name}</span>}
                    </div>
                  )}

                  {/* 메모 */}
                  {!compact && event.memo && (
                    <div className="text-xs text-gray-600 mt-1 bg-gray-50 p-2 rounded">
                      {event.memo}
                    </div>
                  )}

                  {/* 소요 시간 */}
                  {duration !== null && duration > 0 && (
                    <div className={`text-xs mt-1 ${isWaiting ? 'text-orange-500' : 'text-gray-400'}`}>
                      {isWaiting ? '⏱ 대기 ' : '→ '}{duration}분
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default TreatmentTimeline;
