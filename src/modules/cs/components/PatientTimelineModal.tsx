import { useState, useEffect, useCallback } from 'react';
import { useEscapeKey } from '@shared/hooks/useEscapeKey';
import { query, execute, escapeString } from '@shared/lib/sqlite';
import { EVENT_TYPES, EventTypeCode } from './NonCoveredManagementView';
import type { ConsultationPatient } from './CSSidebar';

interface PatientTimelineModalProps {
  patient: ConsultationPatient;
  onClose: () => void;
}

// 프로그램 타입
interface PatientProgram {
  id: number;
  patient_id: number;
  category_id: number;
  category_name: string;
  category_icon: string;
  grade_id: number | null;
  grade_name: string | null;
  unit_count: number;
  used_count: number;
  total_price: number;
  status: 'active' | 'completed' | 'cancelled';
  doctor_name: string | null;
  start_date: string;
  created_at: string;
}

// 타임라인 이벤트
interface TimelineEvent {
  id: number;
  patient_id: number;
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

// 카테고리/등급
interface Category {
  id: number;
  name: string;
  icon: string;
  default_unit_name: string;
}

interface Grade {
  id: number;
  category_id: number;
  name: string;
  description: string | null;
}

type ViewMode = 'timeline' | 'add_program' | 'add_event';

function PatientTimelineModal({ patient, onClose }: PatientTimelineModalProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('timeline');
  const [programs, setPrograms] = useState<PatientProgram[]>([]);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);

  // 프로그램 등록용 상태
  const [categories, setCategories] = useState<Category[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [programForm, setProgramForm] = useState({
    category_id: 0,
    grade_id: null as number | null,
    unit_count: 1,
    doctor_name: '',
    memo: '',
  });

  // 이벤트 등록용 상태
  const [eventForm, setEventForm] = useState({
    program_id: null as number | null,
    event_type: 'happy_call' as EventTypeCode,
    event_date: new Date().toISOString().split('T')[0],
    event_time: new Date().toTimeString().slice(0, 5),
    content: '',
    result: '',
  });

  const [saving, setSaving] = useState(false);

  // ESC 키로 모달 닫기
  useEscapeKey(onClose);

  // 환자 ID 가져오기 (SQLite)
  const getPatientId = useCallback(async (): Promise<number | null> => {
    const chartNo = patient.chart_no?.replace(/^0+/, '') || '';
    const result = await query<{ id: number }>(`
      SELECT id FROM patients WHERE chart_number = ${escapeString(chartNo)} OR mssql_id = ${patient.patient_id}
    `);
    return result[0]?.id || null;
  }, [patient]);

  // 프로그램 목록 조회
  const loadPrograms = useCallback(async () => {
    const patientId = await getPatientId();
    if (!patientId) {
      setPrograms([]);
      return;
    }

    try {
      const data = await query<PatientProgram>(`
        SELECT
          p.id, p.patient_id, p.category_id,
          c.name as category_name, c.icon as category_icon,
          p.grade_id, g.name as grade_name,
          p.unit_count,
          COALESCE((SELECT SUM(usage_count) FROM program_usage_records WHERE program_id = p.id), 0) as used_count,
          p.total_price, p.status, p.doctor_name, p.start_date, p.created_at
        FROM patient_treatment_programs p
        LEFT JOIN treatment_program_categories c ON p.category_id = c.id
        LEFT JOIN treatment_program_grades g ON p.grade_id = g.id
        WHERE p.patient_id = ${patientId}
        ORDER BY p.created_at DESC
      `);
      setPrograms(data);
    } catch (error) {
      console.error('프로그램 조회 오류:', error);
    }
  }, [getPatientId]);

  // 타임라인 이벤트 조회
  const loadEvents = useCallback(async () => {
    const patientId = await getPatientId();
    if (!patientId) {
      setEvents([]);
      return;
    }

    try {
      const data = await query<TimelineEvent>(`
        SELECT
          e.*,
          c.icon || ' ' || c.name || ' ' || COALESCE(g.name, '') as program_name
        FROM patient_timeline_events e
        LEFT JOIN patient_treatment_programs p ON e.program_id = p.id
        LEFT JOIN treatment_program_categories c ON p.category_id = c.id
        LEFT JOIN treatment_program_grades g ON p.grade_id = g.id
        WHERE e.patient_id = ${patientId}
        ORDER BY e.event_date DESC, e.event_time DESC, e.created_at DESC
        LIMIT 50
      `);
      setEvents(data);
    } catch (error) {
      console.error('타임라인 조회 오류:', error);
    }
  }, [getPatientId]);

  // 카테고리/등급 로드
  const loadCategoriesAndGrades = useCallback(async () => {
    try {
      const [cats, grs] = await Promise.all([
        query<Category>('SELECT * FROM treatment_program_categories WHERE is_active = 1 ORDER BY sort_order'),
        query<Grade>('SELECT * FROM treatment_program_grades WHERE is_active = 1 ORDER BY category_id, sort_order'),
      ]);
      setCategories(cats);
      setGrades(grs);
      if (cats.length > 0) {
        setProgramForm(prev => ({ ...prev, category_id: cats[0].id }));
      }
    } catch (error) {
      console.error('카테고리/등급 조회 오류:', error);
    }
  }, []);

  // 초기 로드
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([loadPrograms(), loadEvents(), loadCategoriesAndGrades()]);
      setLoading(false);
    };
    load();
  }, [loadPrograms, loadEvents, loadCategoriesAndGrades]);

  // 카테고리별 등급 필터
  const filteredGrades = grades.filter(g => g.category_id === programForm.category_id);

  // 프로그램 등록
  const handleSubmitProgram = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!programForm.category_id) {
      alert('카테고리를 선택해주세요.');
      return;
    }

    setSaving(true);
    try {
      // 환자가 SQLite에 없으면 생성
      let patientId = await getPatientId();
      const chartNo = patient.chart_no?.replace(/^0+/, '') || '';

      if (!patientId) {
        const gender = patient.sex === 'M' ? 'male' : patient.sex === 'F' ? 'female' : null;
        const insertId = await execute(`
          INSERT INTO patients (name, chart_number, mssql_id, gender)
          VALUES (${escapeString(patient.patient_name)}, ${escapeString(chartNo)}, ${patient.patient_id}, ${gender ? escapeString(gender) : 'NULL'})
        `);
        patientId = insertId as unknown as number;
        // 다시 조회
        const result = await query<{ id: number }>(`SELECT id FROM patients WHERE chart_number = ${escapeString(chartNo)}`);
        patientId = result[0]?.id || patientId;
      }

      const today = new Date().toISOString().split('T')[0];

      // 프로그램 등록
      await execute(`
        INSERT INTO patient_treatment_programs
        (patient_id, patient_name, chart_number, category_id, grade_id, unit_count, total_price, status, doctor_name, memo, start_date)
        VALUES (
          ${patientId},
          ${escapeString(patient.patient_name)},
          ${escapeString(chartNo)},
          ${programForm.category_id},
          ${programForm.grade_id || 'NULL'},
          ${programForm.unit_count},
          0,
          'active',
          ${programForm.doctor_name ? escapeString(programForm.doctor_name) : 'NULL'},
          ${programForm.memo ? escapeString(programForm.memo) : 'NULL'},
          ${escapeString(today)}
        )
      `);

      // 타임라인에 프로그램 등록 이벤트 추가
      const newProgramResult = await query<{ id: number }>(`
        SELECT id FROM patient_treatment_programs
        WHERE patient_id = ${patientId} ORDER BY id DESC LIMIT 1
      `);
      const newProgramId = newProgramResult[0]?.id;

      if (newProgramId) {
        const category = categories.find(c => c.id === programForm.category_id);
        const grade = filteredGrades.find(g => g.id === programForm.grade_id);
        await execute(`
          INSERT INTO patient_timeline_events
          (patient_id, patient_name, chart_number, program_id, event_type, event_date, event_time, content, created_by)
          VALUES (
            ${patientId},
            ${escapeString(patient.patient_name)},
            ${escapeString(chartNo)},
            ${newProgramId},
            'program_start',
            ${escapeString(today)},
            ${escapeString(new Date().toTimeString().slice(0, 5))},
            ${escapeString(`${category?.icon || ''} ${category?.name || ''} ${grade?.name || ''} ${programForm.unit_count}${category?.default_unit_name || '제'} 등록`)},
            ${programForm.doctor_name ? escapeString(programForm.doctor_name) : 'NULL'}
          )
        `);
      }

      console.log(`✅ ${patient.patient_name} 프로그램 등록 완료`);
      await Promise.all([loadPrograms(), loadEvents()]);
      setViewMode('timeline');
      setProgramForm({ category_id: categories[0]?.id || 0, grade_id: null, unit_count: 1, doctor_name: '', memo: '' });
    } catch (error) {
      console.error('프로그램 등록 오류:', error);
      alert('프로그램 등록에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  // 이벤트 추가
  const handleSubmitEvent = async (e: React.FormEvent) => {
    e.preventDefault();

    setSaving(true);
    try {
      let patientId = await getPatientId();
      const chartNo = patient.chart_no?.replace(/^0+/, '') || '';

      if (!patientId) {
        const gender = patient.sex === 'M' ? 'male' : patient.sex === 'F' ? 'female' : null;
        await execute(`
          INSERT INTO patients (name, chart_number, mssql_id, gender)
          VALUES (${escapeString(patient.patient_name)}, ${escapeString(chartNo)}, ${patient.patient_id}, ${gender ? escapeString(gender) : 'NULL'})
        `);
        const result = await query<{ id: number }>(`SELECT id FROM patients WHERE chart_number = ${escapeString(chartNo)}`);
        patientId = result[0]?.id;
      }

      await execute(`
        INSERT INTO patient_timeline_events
        (patient_id, patient_name, chart_number, program_id, event_type, event_date, event_time, content, result, created_by)
        VALUES (
          ${patientId},
          ${escapeString(patient.patient_name)},
          ${escapeString(chartNo)},
          ${eventForm.program_id || 'NULL'},
          ${escapeString(eventForm.event_type)},
          ${escapeString(eventForm.event_date)},
          ${eventForm.event_time ? escapeString(eventForm.event_time) : 'NULL'},
          ${eventForm.content ? escapeString(eventForm.content) : 'NULL'},
          ${eventForm.result ? escapeString(eventForm.result) : 'NULL'},
          NULL
        )
      `);

      // 사용 이벤트면 program_usage_records에도 추가
      if (eventForm.event_type === 'program_usage' && eventForm.program_id) {
        await execute(`
          INSERT INTO program_usage_records (program_id, usage_date, usage_count, memo)
          VALUES (${eventForm.program_id}, ${escapeString(eventForm.event_date)}, 1, ${eventForm.content ? escapeString(eventForm.content) : 'NULL'})
        `);
      }

      console.log(`✅ ${patient.patient_name} 이벤트 추가: ${eventForm.event_type}`);
      await Promise.all([loadPrograms(), loadEvents()]);
      setViewMode('timeline');
      setEventForm({
        program_id: null,
        event_type: 'happy_call',
        event_date: new Date().toISOString().split('T')[0],
        event_time: new Date().toTimeString().slice(0, 5),
        content: '',
        result: '',
      });
    } catch (error) {
      console.error('이벤트 추가 오류:', error);
      alert('이벤트 추가에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  // 이벤트 타입 정보
  const getEventTypeInfo = (code: string) => {
    return EVENT_TYPES.find(t => t.code === code) || { icon: '📌', label: code, color: '#64748b' };
  };

  // 날짜 포맷
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (dateStr === today.toISOString().split('T')[0]) return '오늘';
    if (dateStr === yesterday.toISOString().split('T')[0]) return '어제';

    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content patient-timeline-modal" onClick={e => e.stopPropagation()}>
        {/* 헤더 */}
        <div className="modal-header">
          <div className="patient-timeline-header-info">
            <h3>비급여 관리</h3>
            <div className="patient-timeline-patient">
              <span className="patient-name">{patient.patient_name}</span>
              <span className="patient-chart">({patient.chart_no?.replace(/^0+/, '') || ''})</span>
              {patient.sex && patient.age && (
                <span className="patient-demo">{patient.sex === 'M' ? '남' : '여'}/{patient.age}세</span>
              )}
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose}>×</button>
        </div>

        {/* 탭 메뉴 */}
        <div className="patient-timeline-tabs">
          <button
            className={`timeline-tab ${viewMode === 'timeline' ? 'active' : ''}`}
            onClick={() => setViewMode('timeline')}
          >
            <i className="fas fa-stream"></i> 타임라인
          </button>
          <button
            className={`timeline-tab ${viewMode === 'add_program' ? 'active' : ''}`}
            onClick={() => setViewMode('add_program')}
          >
            <i className="fas fa-plus-circle"></i> 프로그램 등록
          </button>
          <button
            className={`timeline-tab ${viewMode === 'add_event' ? 'active' : ''}`}
            onClick={() => setViewMode('add_event')}
          >
            <i className="fas fa-calendar-plus"></i> 이벤트 추가
          </button>
        </div>

        {/* 콘텐츠 */}
        <div className="modal-body patient-timeline-body">
          {loading ? (
            <div className="timeline-loading">
              <i className="fas fa-spinner fa-spin"></i> 로딩 중...
            </div>
          ) : viewMode === 'timeline' ? (
            <>
              {/* 활성 프로그램 요약 */}
              {programs.filter(p => p.status === 'active').length > 0 && (
                <div className="patient-programs-summary">
                  <h4>진행 중인 프로그램</h4>
                  <div className="programs-summary-list">
                    {programs.filter(p => p.status === 'active').map(p => (
                      <div key={p.id} className="program-summary-item">
                        <span className="program-icon">{p.category_icon}</span>
                        <span className="program-name">{p.category_name} {p.grade_name || ''}</span>
                        <span className="program-progress">{p.used_count}/{p.unit_count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 타임라인 */}
              <div className="patient-timeline-list">
                {events.length === 0 ? (
                  <div className="timeline-empty">
                    <i className="fas fa-clock"></i>
                    <p>기록이 없습니다</p>
                  </div>
                ) : (
                  events.map(event => {
                    const typeInfo = getEventTypeInfo(event.event_type);
                    return (
                      <div
                        key={event.id}
                        className="patient-timeline-item"
                        style={{ '--event-color': typeInfo.color } as React.CSSProperties}
                      >
                        <div className="timeline-item-dot">
                          <span>{typeInfo.icon}</span>
                        </div>
                        <div className="timeline-item-content">
                          <div className="timeline-item-header">
                            <span className="timeline-item-date">{formatDate(event.event_date)}</span>
                            {event.event_time && (
                              <span className="timeline-item-time">{event.event_time}</span>
                            )}
                            <span
                              className="timeline-item-type"
                              style={{ backgroundColor: typeInfo.color }}
                            >
                              {typeInfo.label}
                            </span>
                          </div>
                          {event.program_name && (
                            <div className="timeline-item-program">{event.program_name}</div>
                          )}
                          {event.content && (
                            <div className="timeline-item-body">{event.content}</div>
                          )}
                          {event.result && (
                            <div className="timeline-item-result">→ {event.result}</div>
                          )}
                          {event.created_by && (
                            <div className="timeline-item-by">담당: {event.created_by}</div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          ) : viewMode === 'add_program' ? (
            <form onSubmit={handleSubmitProgram} className="program-add-form">
              {/* 카테고리 선택 */}
              <div className="form-group">
                <label>카테고리</label>
                <div className="category-select-grid">
                  {categories.map(cat => (
                    <button
                      key={cat.id}
                      type="button"
                      className={`category-select-btn ${programForm.category_id === cat.id ? 'active' : ''}`}
                      onClick={() => setProgramForm(prev => ({ ...prev, category_id: cat.id, grade_id: null }))}
                    >
                      <span className="cat-icon">{cat.icon}</span>
                      <span className="cat-name">{cat.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 등급 선택 */}
              {filteredGrades.length > 0 && (
                <div className="form-group">
                  <label>등급</label>
                  <div className="grade-select-grid">
                    {filteredGrades.map(grade => (
                      <button
                        key={grade.id}
                        type="button"
                        className={`grade-select-btn ${programForm.grade_id === grade.id ? 'active' : ''}`}
                        onClick={() => setProgramForm(prev => ({ ...prev, grade_id: grade.id }))}
                      >
                        {grade.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 횟수 */}
              <div className="form-row">
                <div className="form-group">
                  <label>횟수 ({categories.find(c => c.id === programForm.category_id)?.default_unit_name || '제'})</label>
                  <input
                    type="number"
                    min="1"
                    value={programForm.unit_count}
                    onChange={(e) => setProgramForm(prev => ({ ...prev, unit_count: parseInt(e.target.value) || 1 }))}
                  />
                </div>
                <div className="form-group">
                  <label>담당의</label>
                  <input
                    type="text"
                    value={programForm.doctor_name}
                    onChange={(e) => setProgramForm(prev => ({ ...prev, doctor_name: e.target.value }))}
                    placeholder="담당의 이름"
                  />
                </div>
              </div>

              {/* 메모 */}
              <div className="form-group">
                <label>메모</label>
                <textarea
                  value={programForm.memo}
                  onChange={(e) => setProgramForm(prev => ({ ...prev, memo: e.target.value }))}
                  placeholder="메모 입력"
                  rows={2}
                />
              </div>

              <div className="form-actions">
                <button type="button" className="btn-cancel" onClick={() => setViewMode('timeline')}>취소</button>
                <button type="submit" className="btn-submit" disabled={saving}>
                  {saving ? '등록 중...' : '프로그램 등록'}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSubmitEvent} className="event-add-form">
              {/* 관련 프로그램 */}
              {programs.filter(p => p.status === 'active').length > 0 && (
                <div className="form-group">
                  <label>관련 프로그램 (선택)</label>
                  <div className="program-select-grid">
                    <button
                      type="button"
                      className={`program-select-btn ${eventForm.program_id === null ? 'active' : ''}`}
                      onClick={() => setEventForm(prev => ({ ...prev, program_id: null }))}
                    >
                      없음
                    </button>
                    {programs.filter(p => p.status === 'active').map(p => (
                      <button
                        key={p.id}
                        type="button"
                        className={`program-select-btn ${eventForm.program_id === p.id ? 'active' : ''}`}
                        onClick={() => setEventForm(prev => ({ ...prev, program_id: p.id }))}
                      >
                        {p.category_icon} {p.category_name}
                        <span className="usage-info">({p.used_count}/{p.unit_count})</span>
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
                      className={`event-type-btn ${eventForm.event_type === type.code ? 'active' : ''}`}
                      style={{ '--type-color': type.color } as React.CSSProperties}
                      onClick={() => setEventForm(prev => ({ ...prev, event_type: type.code }))}
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
                    value={eventForm.event_date}
                    onChange={(e) => setEventForm(prev => ({ ...prev, event_date: e.target.value }))}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>시간</label>
                  <input
                    type="time"
                    value={eventForm.event_time}
                    onChange={(e) => setEventForm(prev => ({ ...prev, event_time: e.target.value }))}
                  />
                </div>
              </div>

              {/* 내용 */}
              <div className="form-group">
                <label>내용</label>
                <textarea
                  value={eventForm.content}
                  onChange={(e) => setEventForm(prev => ({ ...prev, content: e.target.value }))}
                  placeholder="이벤트 내용 입력..."
                  rows={3}
                />
              </div>

              {/* 결과 */}
              {(eventForm.event_type === 'happy_call' || eventForm.event_type === 'follow_up') && (
                <div className="form-group">
                  <label>결과/응답</label>
                  <input
                    type="text"
                    value={eventForm.result}
                    onChange={(e) => setEventForm(prev => ({ ...prev, result: e.target.value }))}
                    placeholder="통화 결과, 환자 응답 등..."
                  />
                </div>
              )}

              <div className="form-actions">
                <button type="button" className="btn-cancel" onClick={() => setViewMode('timeline')}>취소</button>
                <button type="submit" className="btn-submit" disabled={saving}>
                  {saving ? '추가 중...' : '이벤트 추가'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default PatientTimelineModal;
