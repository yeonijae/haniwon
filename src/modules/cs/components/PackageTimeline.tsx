import React, { useState, useEffect, useCallback } from 'react';
import type { TimelineEvent, TimelineEventType, TimelineAuditLog } from '../types';
import { TIMELINE_EVENT_ICONS } from '../types';
import {
  getPatientTimeline,
  getTimelineAuditLogs,
} from '../lib/api';

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
  'yakchim-membership': 'timeline-event--yakchim',
  'yakchim-package': 'timeline-event--yakchim',
  'yakchim-onetime': 'timeline-event--yakchim',
  custom_memo: 'timeline-event--memo',
};

interface PackageTimelineProps {
  patientId: number;
  patientName: string;
  chartNumber: string;
  onRefresh?: () => void;
  onEventClick?: (event: TimelineEvent) => void;
  renderEditPanel?: (event: TimelineEvent, onClose: () => void, onReload: () => void) => React.ReactNode;
  currentUser?: string;
  refreshTrigger?: number;
  // 외부 패널을 특정 날짜 아래에 렌더링
  externalPanel?: React.ReactNode;
  externalPanelDate?: string;
}

interface DateGroup {
  date: string;
  displayDate: string;
  isToday: boolean;
  events: TimelineEvent[];
}

export const PackageTimeline: React.FC<PackageTimelineProps> = ({
  patientId,
  patientName,
  chartNumber,
  onRefresh,
  onEventClick,
  renderEditPanel,
  currentUser = '직원',
  refreshTrigger,
  externalPanel,
  externalPanelDate,
}) => {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [offset, setOffset] = useState(0);
  const LIMIT = 10;

  // 인라인 편집 상태
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);

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

  // 외부에서 트리거된 새로고침
  useEffect(() => {
    if (refreshTrigger !== undefined && refreshTrigger > 0) {
      loadTimeline(true);
    }
  }, [refreshTrigger]);

  // 타임라인 리로드 함수 (renderEditPanel에 전달)
  const reloadTimeline = useCallback(() => {
    loadTimeline(true);
  }, [loadTimeline]);

  // 날짜별 그룹화 (외부 패널 날짜도 포함하여 정렬)
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

    // 외부 패널 날짜가 있고 groups에 없으면 추가 (빈 이벤트 배열로)
    if (externalPanelDate && !groups.has(externalPanelDate)) {
      groups.set(externalPanelDate, []);
    }

    return Array.from(groups.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))  // 최신순 정렬 (내림차순)
      .map(([date, dateEvents]) => {
        const isToday = date === today;
        const isSelectedDate = date === externalPanelDate && date !== today;
        const displayDate = isToday
          ? `${date.slice(2, 4)}/${date.slice(5, 7)}/${date.slice(8, 10)} 오늘`
          : isSelectedDate
          ? `${date.slice(2, 4)}/${date.slice(5, 7)}/${date.slice(8, 10)} 선택`
          : `${date.slice(2, 4)}/${date.slice(5, 7)}/${date.slice(8, 10)}`;

        return {
          date,
          displayDate,
          isToday,
          events: dateEvents,
        };
      });
  }, [events, externalPanelDate]);

  // 이벤트 클릭 핸들러
  const handleEventClick = (event: TimelineEvent) => {
    // 같은 이벤트 클릭하면 닫기, 다른 이벤트면 열기
    if (expandedEventId === event.id) {
      setExpandedEventId(null);
    } else {
      setExpandedEventId(event.id);
      onEventClick?.(event);
    }
  };

  // 패널 닫기
  const handleClosePanel = () => {
    setExpandedEventId(null);
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
    setExpandedEventId(null);
    loadTimeline(true);
    onRefresh?.();
  };

  const dateGroups = groupEventsByDate();

  return (
    <div className="package-timeline">
      <div className="timeline-header">
        <h4 className="timeline-title">CS 타임라인</h4>
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
        {loading && events.length === 0 && !externalPanel ? (
          <div className="timeline-loading">로딩 중...</div>
        ) : events.length === 0 && !externalPanel ? (
          <div className="timeline-empty">기록이 없습니다</div>
        ) : (
          <>
            {dateGroups.map(group => (
              <React.Fragment key={group.date}>
                <div
                  className={`timeline-date-group ${group.isToday ? 'timeline-date-group--today' : ''}`}
                >
                  <div className="timeline-date-header">
                    <span className="timeline-date">{group.displayDate}</span>
                  </div>

                  <div className="timeline-events">
                    {/* 외부 패널 (해당 날짜 최상단에 표시) */}
                    {externalPanel && externalPanelDate === group.date && (
                      <div className="timeline-inline-panel timeline-external-panel">
                        {externalPanel}
                      </div>
                    )}

                    {group.events.map(event => (
                      <React.Fragment key={event.id}>
                        <div
                          className={`timeline-event ${EVENT_TYPE_CLASSES[event.type] || ''} ${
                            event.isEditable ? 'timeline-event--editable' : ''
                          } ${event.isCompleted ? 'timeline-event--completed' : ''} ${
                            expandedEventId === event.id ? 'timeline-event--expanded' : ''
                          }`}
                          onClick={() => handleEventClick(event)}
                        >
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

                        {/* 인라인 편집 패널 */}
                        {expandedEventId === event.id && renderEditPanel && (
                          <div className="timeline-inline-panel">
                            {renderEditPanel(event, handleClosePanel, reloadTimeline)}
                          </div>
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              </React.Fragment>
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
