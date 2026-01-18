import React, { useState, useEffect, useCallback } from 'react';
import type { TimelineEvent, TimelineEventType, TimelineAuditLog } from '../types';
import { TIMELINE_EVENT_ICONS } from '../types';
import {
  getPatientTimeline,
  createTimelineAuditLog,
  getTimelineAuditLogs,
} from '../lib/api';
import { getCurrentTimestamp } from '@shared/lib/postgres';

// 타입별 CSS 클래스 매핑
const EVENT_TYPE_CLASSES: Record<TimelineEventType, string> = {
  herbal_package_add: 'timeline-event--herbal',
  herbal_pickup: 'timeline-event--herbal',
  nokryong_package_add: 'timeline-event--nokryong',
  nokryong_usage: 'timeline-event--nokryong',
  treatment_package_add: 'timeline-event--treatment',
  treatment_usage: 'timeline-event--treatment',
  membership_add: 'timeline-event--membership',
  membership_usage: 'timeline-event--membership',
  custom_memo: 'timeline-event--memo',
};

interface PackageTimelineProps {
  patientId: number;
  onEventClick?: (event: TimelineEvent) => void;
  onRefresh?: () => void;
  currentUser?: string;
}

interface DateGroup {
  date: string;
  displayDate: string;
  isToday: boolean;
  events: TimelineEvent[];
}

export const PackageTimeline: React.FC<PackageTimelineProps> = ({
  patientId,
  onEventClick,
  onRefresh,
  currentUser = '직원',
}) => {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [offset, setOffset] = useState(0);
  const LIMIT = 10;

  // 수정 사유 모달 상태
  const [editingEvent, setEditingEvent] = useState<TimelineEvent | null>(null);
  const [modificationReason, setModificationReason] = useState('');
  const [showReasonModal, setShowReasonModal] = useState(false);

  // 수정 이력 모달 상태
  const [auditLogs, setAuditLogs] = useState<TimelineAuditLog[]>([]);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [auditTargetEvent, setAuditTargetEvent] = useState<TimelineEvent | null>(null);

  // 타임라인 데이터 로드
  const loadTimeline = useCallback(async (reset = false) => {
    if (!patientId) return;

    setLoading(true);
    try {
      const currentOffset = reset ? 0 : offset;
      const result = await getPatientTimeline(patientId, {
        limit: LIMIT,
        offset: currentOffset,
      });

      if (reset) {
        setEvents(result.events);
        setOffset(LIMIT);
      } else {
        setEvents(prev => [...prev, ...result.events]);
        setOffset(prev => prev + LIMIT);
      }

      setTotalCount(result.totalCount);
      setHasMore(result.hasMore);
    } catch (error) {
      console.error('타임라인 로드 오류:', error);
    } finally {
      setLoading(false);
    }
  }, [patientId, offset]);

  // 초기 로드
  useEffect(() => {
    loadTimeline(true);
  }, [patientId]);

  // 날짜별 그룹화
  const groupEventsByDate = useCallback((): DateGroup[] => {
    const today = new Date().toISOString().split('T')[0];
    const groups: Map<string, TimelineEvent[]> = new Map();

    events.forEach(event => {
      const date = event.date;
      if (!groups.has(date)) {
        groups.set(date, []);
      }
      groups.get(date)!.push(event);
    });

    return Array.from(groups.entries()).map(([date, dateEvents]) => {
      const isToday = date === today;
      const dateObj = new Date(date);
      const displayDate = isToday
        ? `${date.slice(2, 4)}/${date.slice(5, 7)}/${date.slice(8, 10)} 오늘`
        : `${date.slice(2, 4)}/${date.slice(5, 7)}/${date.slice(8, 10)}`;

      return {
        date,
        displayDate,
        isToday,
        events: dateEvents,
      };
    });
  }, [events]);

  // 이벤트 클릭 핸들러
  const handleEventClick = (event: TimelineEvent) => {
    if (!event.isEditable) {
      // 과거 날짜는 읽기 전용
      return;
    }

    if (event.isCompleted) {
      // 완료된 항목은 수정 사유 입력 필요
      setEditingEvent(event);
      setModificationReason('');
      setShowReasonModal(true);
    } else {
      // 미완료 항목은 바로 수정
      onEventClick?.(event);
    }
  };

  // 수정 사유 확인
  const handleConfirmModification = async () => {
    if (!editingEvent || !modificationReason.trim()) {
      alert('수정 사유를 입력해주세요.');
      return;
    }

    try {
      // 수정 이력 기록
      await createTimelineAuditLog({
        source_table: editingEvent.sourceTable,
        source_id: editingEvent.sourceId,
        patient_id: patientId,
        field_name: 'general_modification',
        old_value: JSON.stringify(editingEvent.originalData),
        new_value: null, // 실제 수정 후 업데이트
        modified_at: getCurrentTimestamp(),
        modified_by: currentUser,
        modification_reason: modificationReason,
      });

      setShowReasonModal(false);
      onEventClick?.(editingEvent);
    } catch (error) {
      console.error('수정 이력 기록 오류:', error);
      alert('수정 이력 기록에 실패했습니다.');
    }
  };

  // 수정 이력 조회
  const handleViewAuditLogs = async (event: TimelineEvent) => {
    try {
      const logs = await getTimelineAuditLogs(event.sourceTable, event.sourceId);
      setAuditLogs(logs);
      setAuditTargetEvent(event);
      setShowAuditModal(true);
    } catch (error) {
      console.error('수정 이력 조회 오류:', error);
    }
  };

  // 더보기
  const handleLoadMore = () => {
    loadTimeline(false);
  };

  // 새로고침
  const handleRefresh = () => {
    loadTimeline(true);
    onRefresh?.();
  };

  const dateGroups = groupEventsByDate();

  return (
    <div className="package-timeline">
      <div className="timeline-header">
        <h4 className="timeline-title">비급여 타임라인</h4>
        <span className="timeline-count">{totalCount}건</span>
        <button
          className="timeline-refresh-btn"
          onClick={handleRefresh}
          title="새로고침"
        >
          ↻
        </button>
      </div>

      <div className="timeline-content">
        {loading && events.length === 0 ? (
          <div className="timeline-loading">로딩 중...</div>
        ) : events.length === 0 ? (
          <div className="timeline-empty">기록이 없습니다</div>
        ) : (
          <>
            {dateGroups.map(group => (
              <div
                key={group.date}
                className={`timeline-date-group ${group.isToday ? 'timeline-date-group--today' : ''}`}
              >
                <div className="timeline-date-header">
                  <span className="timeline-date">{group.displayDate}</span>
                </div>

                <div className="timeline-events">
                  {group.events.map(event => (
                    <div
                      key={event.id}
                      className={`timeline-event ${EVENT_TYPE_CLASSES[event.type] || ''} ${
                        event.isEditable ? 'timeline-event--editable' : ''
                      } ${event.isCompleted ? 'timeline-event--completed' : ''}`}
                      onClick={() => handleEventClick(event)}
                    >
                      <span className="timeline-event-icon">{event.icon}</span>
                      <div className="timeline-event-content">
                        <span className="timeline-event-label">{event.label}</span>
                        {event.subLabel && (
                          <span className="timeline-event-sublabel">{event.subLabel}</span>
                        )}
                      </div>
                      {event.isEditable && (
                        <button
                          className="timeline-event-edit-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEventClick(event);
                          }}
                          title="수정"
                        >
                          ✏️
                        </button>
                      )}
                      <button
                        className="timeline-event-history-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewAuditLogs(event);
                        }}
                        title="수정 이력"
                      >
                        📋
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {hasMore && (
              <div className="timeline-load-more">
                <button
                  className="timeline-load-more-btn"
                  onClick={handleLoadMore}
                  disabled={loading}
                >
                  {loading ? '로딩 중...' : `더보기 (${events.length}/${totalCount})`}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* 수정 사유 입력 모달 */}
      {showReasonModal && (
        <div className="timeline-modal-overlay" onClick={() => setShowReasonModal(false)}>
          <div className="timeline-modal timeline-edit-modal" onClick={e => e.stopPropagation()}>
            <div className="timeline-modal-header">
              <h5>수정 사유 입력</h5>
              <button
                className="timeline-modal-close"
                onClick={() => setShowReasonModal(false)}
              >
                ×
              </button>
            </div>
            <div className="timeline-modal-body">
              <p className="timeline-modal-info">
                완료된 항목을 수정하려면 수정 사유를 입력해주세요.
              </p>
              <div className="timeline-modal-event">
                <span className="timeline-event-icon">{editingEvent?.icon}</span>
                <span>{editingEvent?.label}</span>
              </div>
              <textarea
                className="timeline-reason-input"
                placeholder="수정 사유를 입력하세요..."
                value={modificationReason}
                onChange={e => setModificationReason(e.target.value)}
                rows={3}
                autoFocus
              />
            </div>
            <div className="timeline-modal-footer">
              <button
                className="timeline-modal-btn timeline-modal-btn--cancel"
                onClick={() => setShowReasonModal(false)}
              >
                취소
              </button>
              <button
                className="timeline-modal-btn timeline-modal-btn--confirm"
                onClick={handleConfirmModification}
                disabled={!modificationReason.trim()}
              >
                확인 후 수정
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 수정 이력 조회 모달 */}
      {showAuditModal && (
        <div className="timeline-modal-overlay" onClick={() => setShowAuditModal(false)}>
          <div className="timeline-modal timeline-audit-modal" onClick={e => e.stopPropagation()}>
            <div className="timeline-modal-header">
              <h5>수정 이력</h5>
              <button
                className="timeline-modal-close"
                onClick={() => setShowAuditModal(false)}
              >
                ×
              </button>
            </div>
            <div className="timeline-modal-body">
              {auditTargetEvent && (
                <div className="timeline-modal-event">
                  <span className="timeline-event-icon">{auditTargetEvent.icon}</span>
                  <span>{auditTargetEvent.label}</span>
                </div>
              )}
              {auditLogs.length === 0 ? (
                <p className="timeline-audit-empty">수정 이력이 없습니다.</p>
              ) : (
                <div className="timeline-audit-list">
                  {auditLogs.map(log => (
                    <div key={log.id} className="timeline-audit-item">
                      <div className="timeline-audit-meta">
                        <span className="timeline-audit-date">
                          {new Date(log.modified_at).toLocaleString('ko-KR')}
                        </span>
                        <span className="timeline-audit-user">{log.modified_by}</span>
                      </div>
                      <div className="timeline-audit-reason">
                        <strong>사유:</strong> {log.modification_reason}
                      </div>
                      {log.field_name && log.field_name !== 'general_modification' && (
                        <div className="timeline-audit-field">
                          <strong>변경 필드:</strong> {log.field_name}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="timeline-modal-footer">
              <button
                className="timeline-modal-btn"
                onClick={() => setShowAuditModal(false)}
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

export default PackageTimeline;
