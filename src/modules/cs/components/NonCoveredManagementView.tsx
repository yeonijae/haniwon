import { useState, useEffect, useCallback } from 'react';
import type { PortalUser } from '@shared/types';
import { query, execute, escapeString } from '@shared/lib/sqlite';

interface NonCoveredManagementViewProps {
  user: PortalUser;
}

// 이벤트 타입 정의
export const EVENT_TYPES = [
  { code: 'program_start', icon: '🎯', label: '프로그램 등록', color: '#10b981' },
  { code: 'program_usage', icon: '💊', label: '사용', color: '#3b82f6' },
  { code: 'program_complete', icon: '✅', label: '완료', color: '#6b7280' },
  { code: 'happy_call', icon: '📞', label: '해피콜', color: '#f59e0b' },
  { code: 'follow_up', icon: '📋', label: '후속체크', color: '#8b5cf6' },
  { code: 'memo', icon: '📝', label: '메모', color: '#64748b' },
  { code: 'reservation', icon: '📅', label: '예약', color: '#06b6d4' },
  { code: 'complaint', icon: '⚠️', label: '이슈', color: '#ef4444' },
] as const;

export type EventTypeCode = typeof EVENT_TYPES[number]['code'];

// 타임라인 이벤트 인터페이스
interface TimelineEvent {
  id: number;
  patient_id: number;
  patient_name: string;
  chart_number: string;
  program_id: number | null;
  program_name?: string;
  event_type: EventTypeCode;
  event_date: string;
  event_time: string | null;
  content: string | null;
  result: string | null;
  created_by: string | null;
  created_at: string;
}

// 프로그램 인터페이스
interface PatientProgram {
  id: number;
  patient_id: number;
  patient_name: string;
  chart_number: string;
  category_name: string;
  category_icon: string;
  grade_name: string | null;
  unit_count: number;
  used_count: number;
  status: string;
}

// 날짜별 그룹핑된 이벤트
interface GroupedEvents {
  date: string;
  events: TimelineEvent[];
}

function NonCoveredManagementView({ user }: NonCoveredManagementViewProps) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<EventTypeCode | 'all'>('all');
  const [showAddModal, setShowAddModal] = useState(false);

  // 이벤트 목록 조회
  const loadEvents = useCallback(async () => {
    setLoading(true);
    try {
      let sql = `
        SELECT
          e.*,
          p.category_name || ' ' || COALESCE(p.grade_name, '') as program_name
        FROM patient_timeline_events e
        LEFT JOIN (
          SELECT pt.id, c.name as category_name, g.name as grade_name
          FROM patient_treatment_programs pt
          LEFT JOIN treatment_program_categories c ON pt.category_id = c.id
          LEFT JOIN treatment_program_grades g ON pt.grade_id = g.id
        ) p ON e.program_id = p.id
        WHERE 1=1
      `;

      if (searchTerm) {
        sql += ` AND (e.patient_name LIKE '%${searchTerm}%' OR e.chart_number LIKE '%${searchTerm}%')`;
      }
      if (filterType !== 'all') {
        sql += ` AND e.event_type = '${filterType}'`;
      }

      sql += ` ORDER BY e.event_date DESC, e.event_time DESC, e.created_at DESC LIMIT 200`;

      const data = await query<TimelineEvent>(sql);
      setEvents(data);
    } catch (error) {
      console.error('이벤트 목록 조회 오류:', error);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, filterType]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  // 날짜별 그룹핑
  const groupedEvents: GroupedEvents[] = events.reduce((acc: GroupedEvents[], event) => {
    const existingGroup = acc.find(g => g.date === event.event_date);
    if (existingGroup) {
      existingGroup.events.push(event);
    } else {
      acc.push({ date: event.event_date, events: [event] });
    }
    return acc;
  }, []);

  // 이벤트 타입 정보 가져오기
  const getEventTypeInfo = (code: string) => {
    return EVENT_TYPES.find(t => t.code === code) || { icon: '📌', label: code, color: '#64748b' };
  };

  // 날짜 포맷
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (dateStr === today.toISOString().split('T')[0]) {
      return '오늘';
    } else if (dateStr === yesterday.toISOString().split('T')[0]) {
      return '어제';
    }

    const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
    return `${date.getMonth() + 1}/${date.getDate()} (${weekdays[date.getDay()]})`;
  };

  return (
    <div className="noncovered-management">
      {/* 헤더 */}
      <div className="noncovered-header">
        <div className="noncovered-header-left">
          <h2>비급여 타임라인</h2>
          <span className="noncovered-count">총 {events.length}건</span>
        </div>
        <div className="noncovered-header-right">
          <input
            type="text"
            className="noncovered-search"
            placeholder="환자명/차트번호 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <select
            className="noncovered-filter"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as EventTypeCode | 'all')}
          >
            <option value="all">전체 유형</option>
            {EVENT_TYPES.map(type => (
              <option key={type.code} value={type.code}>
                {type.icon} {type.label}
              </option>
            ))}
          </select>
          <button className="noncovered-add-btn" onClick={() => setShowAddModal(true)}>
            <i className="fas fa-plus"></i> 이벤트 추가
          </button>
          <button className="noncovered-refresh-btn" onClick={loadEvents} disabled={loading}>
            <i className={`fas fa-sync-alt ${loading ? 'fa-spin' : ''}`}></i>
          </button>
        </div>
      </div>

      {/* 타임라인 */}
      <div className="timeline-container">
        {loading ? (
          <div className="timeline-loading">
            <i className="fas fa-spinner fa-spin"></i> 로딩 중...
          </div>
        ) : groupedEvents.length === 0 ? (
          <div className="timeline-empty">
            <i className="fas fa-calendar-times"></i>
            <p>이벤트가 없습니다</p>
          </div>
        ) : (
          groupedEvents.map((group) => (
            <div key={group.date} className="timeline-date-group">
              <div className="timeline-date-header">
                <span className="timeline-date">{formatDate(group.date)}</span>
                <span className="timeline-date-full">{group.date}</span>
              </div>
              <div className="timeline-events">
                {group.events.map((event) => {
                  const typeInfo = getEventTypeInfo(event.event_type);
                  return (
                    <div
                      key={event.id}
                      className="timeline-event"
                      style={{ '--event-color': typeInfo.color } as React.CSSProperties}
                    >
                      <div className="timeline-event-dot">
                        <span className="timeline-event-icon">{typeInfo.icon}</span>
                      </div>
                      <div className="timeline-event-content">
                        <div className="timeline-event-header">
                          {event.event_time && (
                            <span className="timeline-event-time">{event.event_time}</span>
                          )}
                          <span className="timeline-event-patient">
                            {event.patient_name}
                            <span className="timeline-event-chart">({event.chart_number})</span>
                          </span>
                          <span
                            className="timeline-event-type-badge"
                            style={{ backgroundColor: typeInfo.color }}
                          >
                            {typeInfo.label}
                          </span>
                        </div>
                        {event.program_name && (
                          <div className="timeline-event-program">
                            💊 {event.program_name}
                          </div>
                        )}
                        {event.content && (
                          <div className="timeline-event-body">{event.content}</div>
                        )}
                        {event.result && (
                          <div className="timeline-event-result">
                            <span className="result-label">결과:</span> {event.result}
                          </div>
                        )}
                        {event.created_by && (
                          <div className="timeline-event-footer">
                            담당: {event.created_by}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* 이벤트 추가 모달 */}
      {showAddModal && (
        <AddEventModal
          user={user}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            loadEvents();
          }}
        />
      )}
    </div>
  );
}

// 이벤트 추가 모달
interface AddEventModalProps {
  user: PortalUser;
  patient?: { id: number; name: string; chart_number: string };
  onClose: () => void;
  onSuccess: () => void;
}

function AddEventModal({ user, patient, onClose, onSuccess }: AddEventModalProps) {
  const [form, setForm] = useState({
    patient_id: patient?.id || 0,
    patient_name: patient?.name || '',
    chart_number: patient?.chart_number || '',
    program_id: null as number | null,
    event_type: 'happy_call' as EventTypeCode,
    event_date: new Date().toISOString().split('T')[0],
    event_time: new Date().toTimeString().slice(0, 5),
    content: '',
    result: '',
  });
  const [programs, setPrograms] = useState<PatientProgram[]>([]);
  const [searchResults, setSearchResults] = useState<{ id: number; name: string; chart_number: string }[]>([]);
  const [patientSearch, setPatientSearch] = useState('');
  const [saving, setSaving] = useState(false);

  // 환자 검색
  const searchPatients = useCallback(async (term: string) => {
    if (!term || term.length < 2) {
      setSearchResults([]);
      return;
    }
    try {
      const results = await query<{ id: number; name: string; chart_number: string }>(`
        SELECT id, name, chart_number FROM patients
        WHERE name LIKE '%${term}%' OR chart_number LIKE '%${term}%'
        LIMIT 10
      `);
      setSearchResults(results);
    } catch (error) {
      console.error('환자 검색 오류:', error);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => searchPatients(patientSearch), 300);
    return () => clearTimeout(timer);
  }, [patientSearch, searchPatients]);

  // 환자 선택 시 프로그램 목록 조회
  const loadPatientPrograms = useCallback(async (patientId: number) => {
    try {
      const data = await query<PatientProgram>(`
        SELECT
          p.id, p.patient_id, p.patient_name, p.chart_number,
          c.name as category_name, c.icon as category_icon,
          g.name as grade_name, p.unit_count,
          COALESCE((SELECT SUM(usage_count) FROM program_usage_records WHERE program_id = p.id), 0) as used_count,
          p.status
        FROM patient_treatment_programs p
        LEFT JOIN treatment_program_categories c ON p.category_id = c.id
        LEFT JOIN treatment_program_grades g ON p.grade_id = g.id
        WHERE p.patient_id = ${patientId} AND p.status = 'active'
        ORDER BY p.created_at DESC
      `);
      setPrograms(data);
    } catch (error) {
      console.error('프로그램 조회 오류:', error);
    }
  }, []);

  const handlePatientSelect = useCallback((p: { id: number; name: string; chart_number: string }) => {
    setForm(prev => ({
      ...prev,
      patient_id: p.id,
      patient_name: p.name,
      chart_number: p.chart_number,
      program_id: null,
    }));
    setPatientSearch('');
    setSearchResults([]);
    loadPatientPrograms(p.id);
  }, [loadPatientPrograms]);

  // 저장
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.patient_id) {
      alert('환자를 선택해주세요.');
      return;
    }

    setSaving(true);
    try {
      await execute(`
        INSERT INTO patient_timeline_events
        (patient_id, patient_name, chart_number, program_id, event_type, event_date, event_time, content, result, created_by)
        VALUES (
          ${form.patient_id},
          ${escapeString(form.patient_name)},
          ${escapeString(form.chart_number)},
          ${form.program_id || 'NULL'},
          ${escapeString(form.event_type)},
          ${escapeString(form.event_date)},
          ${form.event_time ? escapeString(form.event_time) : 'NULL'},
          ${form.content ? escapeString(form.content) : 'NULL'},
          ${form.result ? escapeString(form.result) : 'NULL'},
          ${escapeString(user.name)}
        )
      `);
      console.log(`✅ 타임라인 이벤트 추가: ${form.patient_name} - ${form.event_type}`);
      onSuccess();
    } catch (error) {
      console.error('이벤트 추가 오류:', error);
      alert('이벤트 추가에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content add-event-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>이벤트 추가</h3>
          <button className="modal-close-btn" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit} className="modal-body">
          {/* 환자 선택 */}
          {!patient && (
            <div className="form-group">
              <label>환자 검색</label>
              {form.patient_id ? (
                <div className="selected-patient-bar">
                  <span className="selected-patient-name">{form.patient_name}</span>
                  <span className="selected-patient-chart">({form.chart_number})</span>
                  <button
                    type="button"
                    className="clear-patient-btn"
                    onClick={() => {
                      setForm(prev => ({ ...prev, patient_id: 0, patient_name: '', chart_number: '', program_id: null }));
                      setPrograms([]);
                    }}
                  >×</button>
                </div>
              ) : (
                <div className="patient-search-wrapper">
                  <input
                    type="text"
                    placeholder="환자명 또는 차트번호 입력..."
                    value={patientSearch}
                    onChange={(e) => setPatientSearch(e.target.value)}
                  />
                  {searchResults.length > 0 && (
                    <div className="patient-search-results">
                      {searchResults.map(p => (
                        <button
                          key={p.id}
                          type="button"
                          className="patient-search-item"
                          onClick={() => handlePatientSelect(p)}
                        >
                          {p.name} ({p.chart_number})
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 프로그램 선택 (선택사항) */}
          {programs.length > 0 && (
            <div className="form-group">
              <label>관련 프로그램 (선택)</label>
              <div className="program-select-grid">
                <button
                  type="button"
                  className={`program-select-btn ${form.program_id === null ? 'active' : ''}`}
                  onClick={() => setForm(prev => ({ ...prev, program_id: null }))}
                >
                  없음
                </button>
                {programs.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    className={`program-select-btn ${form.program_id === p.id ? 'active' : ''}`}
                    onClick={() => setForm(prev => ({ ...prev, program_id: p.id }))}
                  >
                    {p.category_icon} {p.category_name} {p.grade_name || ''}
                    <span className="program-usage">({p.used_count}/{p.unit_count})</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 이벤트 유형 */}
          <div className="form-group">
            <label>이벤트 유형</label>
            <div className="event-type-grid">
              {EVENT_TYPES.map(type => (
                <button
                  key={type.code}
                  type="button"
                  className={`event-type-btn ${form.event_type === type.code ? 'active' : ''}`}
                  style={{ '--type-color': type.color } as React.CSSProperties}
                  onClick={() => setForm(prev => ({ ...prev, event_type: type.code }))}
                >
                  <span className="type-icon">{type.icon}</span>
                  <span className="type-label">{type.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 날짜/시간 */}
          <div className="form-row">
            <div className="form-group">
              <label>날짜</label>
              <input
                type="date"
                value={form.event_date}
                onChange={(e) => setForm(prev => ({ ...prev, event_date: e.target.value }))}
                required
              />
            </div>
            <div className="form-group">
              <label>시간</label>
              <input
                type="time"
                value={form.event_time}
                onChange={(e) => setForm(prev => ({ ...prev, event_time: e.target.value }))}
              />
            </div>
          </div>

          {/* 내용 */}
          <div className="form-group">
            <label>내용</label>
            <textarea
              value={form.content}
              onChange={(e) => setForm(prev => ({ ...prev, content: e.target.value }))}
              placeholder="이벤트 내용 입력..."
              rows={3}
            />
          </div>

          {/* 결과 (해피콜, 후속체크 등) */}
          {(form.event_type === 'happy_call' || form.event_type === 'follow_up') && (
            <div className="form-group">
              <label>결과/응답</label>
              <input
                type="text"
                value={form.result}
                onChange={(e) => setForm(prev => ({ ...prev, result: e.target.value }))}
                placeholder="통화 결과, 환자 응답 등..."
              />
            </div>
          )}

          <div className="modal-footer">
            <button type="button" className="btn-cancel" onClick={onClose}>취소</button>
            <button type="submit" className="btn-submit" disabled={saving || !form.patient_id}>
              {saving ? '저장 중...' : '이벤트 추가'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default NonCoveredManagementView;
export { AddEventModal };
