import { useState, useEffect, useCallback, useMemo } from 'react';
import type { PortalUser } from '@shared/types';
import type { SurveyTemplate, SurveySession, SurveyQuestion, SurveyAnswer, SurveyResponse, SurveyQuestionType } from '../../types';
import '../call-center/OutboundCallCenter.css';
import { searchLocalPatients, searchAndSyncPatients, type LocalPatient } from '../../lib/patientSync';
import {
  getTemplates, createTemplate, updateTemplate, deleteTemplate, duplicateTemplate,
  createSession, getSessionsByDate, deleteSession,
  getResponseBySession,
} from '../../lib/surveyApi';

const MSSQL_API_URL = import.meta.env.VITE_MSSQL_API_URL || 'http://192.168.0.48:3100';

interface Doctor { id: string; name: string; isOther?: boolean; resigned?: boolean; workStartDate?: string; workEndDate?: string; }
interface SurveyManagementViewProps { user: PortalUser; }

type ViewMode = 'sessions' | 'templates';
type StatusFilter = 'all' | 'waiting' | 'completed';
type DateRangeMode = 'day' | '1w' | '1m' | '3m';
type SessionDetailMode = 'full' | 'summary';

const toDateStr = (d: Date) => d.toISOString().split('T')[0];
const formatDate = (s: string) => {
  const d = new Date(s + 'T00:00:00');
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}/${mm}/${dd}(${days[d.getDay()]})`;
};

const GENDER_MAP: Record<string, string> = { M: '남', F: '여', 남: '남', 여: '여' };

const formatSessionDate = (dateTime?: string) => {
  if (!dateTime) return '-';
  const d = new Date(dateTime);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
};

const formatSessionTime = (dateTime?: string) => {
  if (!dateTime) return '-';
  const d = new Date(dateTime);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
};

export default function SurveyManagementView({ user }: SurveyManagementViewProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('sessions');
  const [selectedDate, setSelectedDate] = useState(toDateStr(new Date()));
  const [rangeMode, setRangeMode] = useState<DateRangeMode>('day');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [templates, setTemplates] = useState<SurveyTemplate[]>([]);
  const [allTemplates, setAllTemplates] = useState<SurveyTemplate[]>([]);
  const [sessions, setSessions] = useState<SurveySession[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(false);

  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [responseBySessionId, setResponseBySessionId] = useState<Record<number, SurveyResponse | null>>({});
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailViewMode, setDetailViewMode] = useState<SessionDetailMode>('summary');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);

  // Session creation form
  const [selectedPatient, setSelectedPatient] = useState<LocalPatient | null>(null);
  const [patientQuery, setPatientQuery] = useState('');
  const [patientResults, setPatientResults] = useState<LocalPatient[]>([]);
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | ''>('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCreatingSession, setIsCreatingSession] = useState(false);

  // Template editor (inline for templates view)
  const [selectedTemplateForEdit, setSelectedTemplateForEdit] = useState<SurveyTemplate | null>(null);

  const getRangeStartDate = useCallback((date: string, mode: DateRangeMode) => {
    if (mode === 'day') return date;
    const d = new Date(date + 'T00:00:00');
    if (mode === '1w') d.setDate(d.getDate() - 6);
    else if (mode === '1m') d.setMonth(d.getMonth() - 1);
    else if (mode === '3m') d.setMonth(d.getMonth() - 3);
    return toDateStr(d);
  }, []);

  const loadResponseForSession = useCallback(async (session: SurveySession) => {
    if (session.status !== 'completed') return;
    if (responseBySessionId[session.id] !== undefined) return;
    setDetailLoading(true);
    try {
      const resp = await getResponseBySession(session.id);
      setResponseBySessionId(prev => ({ ...prev, [session.id]: resp || null }));
    } catch (e) {
      console.error(e);
      setResponseBySessionId(prev => ({ ...prev, [session.id]: null }));
    } finally {
      setDetailLoading(false);
    }
  }, [responseBySessionId]);

  // Load sessions
  const loadSessions = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const startDate = getRangeStartDate(selectedDate, rangeMode);
      const sess = await getSessionsByDate({ startDate, endDate: selectedDate }, statusFilter);
      setSessions(sess);
      setSelectedSessionId(prev => {
        if (!sess.length) return null;
        if (prev && sess.some(s => s.id === prev)) return prev;
        return sess[0].id;
      });
    } catch (e) { console.error(e); } finally { if (!silent) setLoading(false); }
  }, [getRangeStartDate, selectedDate, rangeMode, statusFilter]);

  // Load templates
  const loadTemplates = useCallback(async () => {
    try {
      const tpls = await getTemplates();
      setTemplates(tpls);
      setAllTemplates(tpls);
      if (tpls.length > 0 && selectedTemplateId === '') setSelectedTemplateId(tpls[0].id);
    } catch (e) { console.error(e); }
  }, [selectedTemplateId]);

  useEffect(() => { loadTemplates(); }, [loadTemplates]);
  useEffect(() => { loadSessions(); }, [loadSessions]);

  // SSE로 survey_sessions 변경 실시간 감지
  useEffect(() => {
    if (viewMode !== 'sessions') return;
    const pgUrl = import.meta.env.VITE_POSTGRES_API_URL || 'http://192.168.0.48:3200';
    let es: EventSource | null = null;
    try {
      es = new EventSource(`${pgUrl}/api/subscribe/survey_sessions`);
      es.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data);
          if (data.table === 'survey_sessions') loadSessions(true);
        } catch { /* ignore */ }
      };
      es.onerror = () => {
        es?.close();
        es = null;
      };
    } catch { /* ignore */ }

    const fallback = setInterval(() => {
      if (!es || es.readyState === EventSource.CLOSED) loadSessions(true);
    }, 10000);

    return () => {
      es?.close();
      clearInterval(fallback);
    };
  }, [viewMode, loadSessions]);

  // Load doctors
  useEffect(() => {
    fetch(`${MSSQL_API_URL}/api/doctors`)
      .then(r => r.json())
      .then((data: Doctor[]) => setDoctors(data.filter(d => !d.isOther && !d.resigned && d.name !== 'DOCTOR')))
      .catch(console.error);
  }, []);

  // Patient search with MSSQL fallback
  useEffect(() => {
    if (patientQuery.length < 2) { setPatientResults([]); setShowPatientDropdown(false); return; }
    const timer = setTimeout(async () => {
      try {
        let results = await searchLocalPatients(patientQuery);
        if (results.length === 0) results = await searchAndSyncPatients(patientQuery);
        setPatientResults(results);
        setShowPatientDropdown(true);
      } catch (e) { console.error(e); }
    }, 300);
    return () => clearTimeout(timer);
  }, [patientQuery]);

  const selectedSession = useMemo(
    () => sessions.find(s => s.id === selectedSessionId) || null,
    [sessions, selectedSessionId],
  );

  const selectedTemplate = useMemo(
    () => allTemplates.find(t => t.id === selectedSession?.template_id) || null,
    [allTemplates, selectedSession],
  );

  const selectedResponse = selectedSession ? responseBySessionId[selectedSession.id] : null;

  useEffect(() => {
    if (!selectedSession || !selectedTemplate) {
      setExpandedIds(new Set());
      return;
    }
    setExpandedIds(new Set(selectedTemplate.questions.map(q => q.id)));
    if (selectedSession.status === 'completed') loadResponseForSession(selectedSession);
  }, [selectedSession, selectedTemplate, loadResponseForSession]);

  // Date navigation
  const moveDate = (offset: number) => {
    const d = new Date(selectedDate + 'T00:00:00');
    d.setDate(d.getDate() + offset);
    setSelectedDate(toDateStr(d));
  };
  const goToday = () => setSelectedDate(toDateStr(new Date()));
  const isToday = selectedDate === toDateStr(new Date());

  const resetCreateSessionForm = useCallback(() => {
    setSelectedPatient(null);
    setPatientQuery('');
    setPatientResults([]);
    setShowPatientDropdown(false);
    setSelectedDoctor('');
    setSelectedTemplateId(templates.length > 0 ? templates[0].id : '');
  }, [templates]);

  const closeCreateSessionModal = useCallback(() => {
    if (isCreatingSession) return;
    setIsCreateModalOpen(false);
    resetCreateSessionForm();
  }, [isCreatingSession, resetCreateSessionForm]);

  // Session CRUD
  const handleCreateSession = async () => {
    if (isCreatingSession) return;
    if (!selectedPatient || !selectedTemplateId) {
      alert('환자와 템플릿을 선택해주세요.');
      return;
    }

    setIsCreatingSession(true);
    try {
      await createSession({
        patient_id: selectedPatient.mssql_id || selectedPatient.id,
        patient_name: selectedPatient.name,
        chart_number: selectedPatient.chart_number || undefined,
        age: selectedPatient.birth_date ? Math.floor((Date.now() - new Date(selectedPatient.birth_date).getTime()) / 31557600000) : undefined,
        gender: selectedPatient.gender || undefined,
        template_id: selectedTemplateId as number,
        doctor_name: selectedDoctor || undefined,
        created_by: user.name,
      });
      await loadSessions();
      setIsCreateModalOpen(false);
      resetCreateSessionForm();
    } catch (e) {
      console.error(e);
      alert('세션 생성 실패');
    } finally {
      setIsCreatingSession(false);
    }
  };

  const handleDeleteSession = async (id: number) => {
    if (!confirm('삭제하시겠습니까?')) return;
    try {
      await deleteSession(id);
      setResponseBySessionId(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      loadSessions();
    } catch (e) { console.error(e); }
  };

  const handleSelectSession = async (session: SurveySession) => {
    setSelectedSessionId(session.id);
    if (session.status === 'completed') await loadResponseForSession(session);
  };

  // Template CRUD
  const handleSaveTemplateInline = async (data: { name: string; description?: string; display_mode: string; questions: SurveyQuestion[] }) => {
    try {
      if (selectedTemplateForEdit) {
        await updateTemplate(selectedTemplateForEdit.id, { name: data.name, description: data.description, questions: data.questions, display_mode: data.display_mode });
      } else {
        await createTemplate({ name: data.name, description: data.description, questions: data.questions, display_mode: data.display_mode });
      }
      await loadTemplates();
      if (selectedTemplateForEdit) {
        const refreshed = (await getTemplates()).find(t => t.id === selectedTemplateForEdit.id);
        setSelectedTemplateForEdit(refreshed || null);
      }
    } catch (e) { console.error(e); alert('저장 실패'); }
  };

  const handleDuplicateTemplate = async (id: number) => {
    try { await duplicateTemplate(id); loadTemplates(); } catch (e) { console.error(e); }
  };

  const handleDeleteTemplate = async (id: number) => {
    if (!confirm('이 템플릿을 삭제하시겠습니까?')) return;
    try {
      await deleteTemplate(id);
      if (selectedTemplateForEdit?.id === id) setSelectedTemplateForEdit(null);
      loadTemplates();
    } catch (e) { console.error(e); }
  };

  const getAnswer = (qId: string): SurveyAnswer | undefined => {
    if (!selectedResponse) return undefined;
    return selectedResponse.answers.find(a => a.question_id === qId);
  };

  const hasAnswer = (qId: string): boolean => {
    const a = getAnswer(qId);
    if (!a) return false;
    if (Array.isArray(a.answer)) return a.answer.length > 0;
    return !!a.answer;
  };

  const fmtAnswer = (a: SurveyAnswer | undefined): string => {
    if (!a) return '(답변 없음)';
    if (Array.isArray(a.answer)) return a.answer.join(', ') || '(선택 없음)';
    return String(a.answer || '(답변 없음)');
  };

  const formatResponseSummary = () => {
    if (!selectedSession || !selectedTemplate || !selectedResponse) return '';
    const ga = (qId: string) => {
      const a = getAnswer(qId);
      if (!a) return '';
      if (Array.isArray(a.answer)) return a.answer.join(' / ');
      return String(a.answer || '');
    };

    const lines: string[] = [];
    for (const q of selectedTemplate.questions) {
      if (!hasAnswer(q.id)) continue;
      const txt = ga(q.id);

      if (['name', 'chart_number', 'doctor', 'gender_age', 'height_weight'].includes(q.id)) continue;
      if (q.question_text.startsWith('>')) lines.push(`${q.question_text} ${txt}`);
      else if (q.question_text.startsWith('-')) lines.push(`${q.question_text} ${txt}`);
      else lines.push(`${q.question_text}: ${txt}`);
    }

    const result: string[] = [];
    const nameLine = [selectedSession.patient_name, selectedSession.chart_number ? `(${selectedSession.chart_number})` : ''].filter(Boolean).join(' ');
    if (nameLine) result.push(nameLine);

    const genderAge = [
      selectedSession.gender ? (GENDER_MAP[selectedSession.gender] || selectedSession.gender) : '',
      selectedSession.age != null ? `${selectedSession.age}세` : '',
    ].filter(Boolean).join('/');

    const heightWeight = ga('height_weight');
    const basicInfo = [genderAge, heightWeight].filter(Boolean).join(' / ');
    if (basicInfo) result.push(basicInfo);

    if (lines.length > 0) {
      result.push('[문진]');
      result.push(...lines);
    }

    return result.join('\n');
  };

  const handleCopySummary = async () => {
    const text = formatResponseSummary();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        setCopied(true);
      } catch {
        alert('복사에 실패했습니다.');
      }
    }
    setTimeout(() => setCopied(false), 2000);
  };

  const toggle = (id: string) => {
    const s = new Set(expandedIds);
    s.has(id) ? s.delete(id) : s.add(id);
    setExpandedIds(s);
  };

  const statusBadge = (status: string) => {
    const c: Record<string, string> = { waiting: '#f59e0b', in_progress: '#3b82f6', completed: '#10b981' };
    const l: Record<string, string> = { waiting: '대기', in_progress: '작성중', completed: '완료' };
    return <span style={{ background: c[status] || '#9ca3af', color: '#fff', padding: '2px 8px', borderRadius: 12, fontSize: 12, fontWeight: 600 }}>{l[status] || status}</span>;
  };

  return (
    <div style={{ padding: '0 12px 12px', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* ===== 헤더 ===== */}
      <div className="occ-header-bar">
        <div className="occ-date-nav">
          {viewMode === 'sessions' && (
            <>
              <button className="occ-date-btn" onClick={() => moveDate(-1)}>◀</button>
              <div className="occ-date-wrap">
                <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="occ-date-hidden" id="survey-date-picker" />
                <button className="occ-date-display" onClick={() => { (document.getElementById('survey-date-picker') as HTMLInputElement)?.showPicker?.(); }}>
                  {formatDate(selectedDate)}
                </button>
              </div>
              <button className="occ-date-btn" onClick={() => moveDate(1)}>▶</button>
              {!isToday && <button className="occ-today-btn" onClick={goToday}>오늘</button>}
              <div className="occ-filter-group">
                {([
                  ['day', '1일'],
                  ['1w', '1주일'],
                  ['1m', '1개월'],
                  ['3m', '3개월'],
                ] as const).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setRangeMode(key)}
                    className={`occ-filter-btn ${rangeMode === key ? 'active' : ''}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="occ-header-actions">
          {viewMode === 'sessions' && (
            <>
              <div className="occ-filter-group occ-filter-patient">
                {(['all', 'waiting', 'completed'] as StatusFilter[]).map(s => (
                  <button key={s} onClick={() => setStatusFilter(s)} className={`occ-filter-btn ${statusFilter === s ? 'active' : ''}`}>
                    {{ all: '전체', waiting: '대기중', completed: '작성완료' }[s]}
                  </button>
                ))}
              </div>
              <button onClick={() => { resetCreateSessionForm(); setIsCreateModalOpen(true); }} style={H.createBtn}>
                설문지 생성
              </button>
            </>
          )}
          <button
            onClick={() => setViewMode(viewMode === 'sessions' ? 'templates' : 'sessions')}
            className="occ-refresh-btn"
          >
            {viewMode === 'sessions' ? '⚙️ 템플릿 관리' : '📋 세션 관리'}
          </button>
        </div>
      </div>

      {/* ===== 세션 관리 뷰 ===== */}
      {viewMode === 'sessions' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0 }}>
          {/* 2단 본문 */}
          <div style={H.sessionSplitWrap}>
            {/* 좌측: 세션 목록 */}
            <div style={H.sessionListPanel}>
              <div style={H.panelTitle}>검색 결과 ({sessions.length})</div>
              <div style={H.sessionListBody}>
                {loading ? <p style={{ textAlign: 'center', color: '#94a3b8', padding: 40 }}>로딩 중...</p> : sessions.length === 0 ? (
                  <p style={{ textAlign: 'center', color: '#94a3b8', padding: 40 }}>세션이 없습니다</p>
                ) : (
                  <div style={H.sessionTableWrap}>
                    <div style={H.sessionTableHead}>
                      <span style={{ ...H.sessionCol, ...H.colName }}>환자이름</span>
                      <span style={{ ...H.sessionCol, ...H.colChart }}>차트</span>
                      <span style={{ ...H.sessionCol, ...H.colAge }}>나이</span>
                      <span style={{ ...H.sessionCol, ...H.colGender }}>성별</span>
                      <span style={{ ...H.sessionCol, ...H.colTemplate }}>설문지 종류</span>
                      <span style={{ ...H.sessionCol, ...H.colDate }}>작성 날짜</span>
                      <span style={{ ...H.sessionCol, ...H.colTime }}>작성 시간</span>
                      <span style={{ ...H.sessionCol, ...H.colStatus }}>상태</span>
                      <span style={{ ...H.sessionCol, ...H.colAction }}>관리</span>
                    </div>
                    <div style={H.sessionTableBody}>
                      {sessions.map(s => {
                        const active = s.id === selectedSessionId;
                        return (
                          <div
                            key={s.id}
                            onClick={() => handleSelectSession(s)}
                            style={{ ...H.sessionRow, ...(active ? H.sessionRowActive : {}) }}
                            title={`${s.patient_name || '-'} / ${s.template_name || '-'} / ${formatSessionDate(s.created_at)} ${formatSessionTime(s.created_at)}`}
                          >
                            <span style={{ ...H.sessionCol, ...H.colName }} title={s.patient_name || '-'}>{s.patient_name || '-'}</span>
                            <span style={{ ...H.sessionCol, ...H.colChart }} title={s.chart_number || '-'}>{s.chart_number || '-'}</span>
                            <span style={{ ...H.sessionCol, ...H.colAge }}>{s.age != null ? `${s.age}세` : '-'}</span>
                            <span style={{ ...H.sessionCol, ...H.colGender }}>{s.gender ? (GENDER_MAP[s.gender] || s.gender) : '-'}</span>
                            <span style={{ ...H.sessionCol, ...H.colTemplate }} title={s.template_name || '-'}>{s.template_name || '-'}</span>
                            <span style={{ ...H.sessionCol, ...H.colDate }}>{formatSessionDate(s.created_at)}</span>
                            <span style={{ ...H.sessionCol, ...H.colTime }}>{formatSessionTime(s.created_at)}</span>
                            <span style={{ ...H.sessionCol, ...H.colStatus }}>{statusBadge(s.status)}</span>
                            <span style={{ ...H.sessionCol, ...H.colAction }}>
                              {s.status === 'waiting' && (
                                <button
                                  onClick={e => { e.stopPropagation(); handleDeleteSession(s.id); }}
                                  style={{ ...H.smallBtn, color: '#ef4444', borderColor: '#fca5a5' }}
                                >
                                  삭제
                                </button>
                              )}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 우측: 상세 + 답변 모아보기 + 복사 */}
            <div style={H.sessionDetailPanel}>
              {!selectedSession ? (
                <div style={H.emptyState}>좌측에서 설문 세션을 선택하세요</div>
              ) : (
                <>
                  <div style={H.detailHeader}>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 700 }}>{selectedSession.patient_name || '-'}</div>
                      <div style={{ marginTop: 2, color: '#64748b', fontSize: 12 }}>
                        {selectedSession.chart_number || '-'} · {selectedSession.template_name || '-'}
                        {selectedSession.doctor_name ? ` · ${selectedSession.doctor_name}` : ''}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {statusBadge(selectedSession.status)}
                      {selectedSession.status === 'completed' && (
                        <>
                          <div style={H.toggleWrap}>
                            <button style={{ ...H.toggleBtn, ...(detailViewMode === 'full' ? H.toggleActive : {}) }} onClick={() => setDetailViewMode('full')}>전체 보기</button>
                            <button style={{ ...H.toggleBtn, ...(detailViewMode === 'summary' ? H.toggleActive : {}) }} onClick={() => setDetailViewMode('summary')}>답변 모아보기</button>
                          </div>
                          <button style={{ ...H.copyBtn, ...(copied ? H.copyDone : {}) }} onClick={handleCopySummary}>
                            {copied ? '✅ 복사됨' : '📋 답변 복사'}
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
                    {selectedSession.status !== 'completed' ? (
                      <div style={H.emptyState}>아직 응답이 제출되지 않았습니다.</div>
                    ) : detailLoading ? (
                      <div style={H.emptyState}>응답 불러오는 중...</div>
                    ) : !selectedResponse ? (
                      <div style={H.emptyState}>응답 데이터가 없습니다.</div>
                    ) : detailViewMode === 'summary' ? (
                      <pre style={H.summaryBox}>{formatResponseSummary() || '(답변 없음)'}</pre>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {(selectedTemplate?.questions || []).map((q, i) => {
                          const answer = getAnswer(q.id);
                          const expanded = expandedIds.has(q.id);
                          return (
                            <div key={q.id} style={H.qCard}>
                              <button style={H.qHeader} onClick={() => toggle(q.id)}>
                                <div style={{ flex: 1, textAlign: 'left' }}>
                                  <span style={{ color: '#94a3b8', fontSize: 12, marginRight: 6 }}>Q{i + 1}.</span>
                                  <span style={{ fontWeight: 500, fontSize: 14 }}>{q.question_text}</span>
                                </div>
                                <span style={{ color: '#94a3b8', fontSize: 12 }}>{expanded ? '▲' : '▼'}</span>
                              </button>
                              {expanded && (
                                <div style={H.qBody}>
                                  <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>
                                    {{ text: '주관식', single_choice: '단일선택', multiple_choice: '복수선택', scale: '척도' }[q.question_type]}
                                  </div>
                                  <div style={{ fontSize: 14, color: answer ? '#1e293b' : '#94a3b8', fontStyle: answer ? 'normal' : 'italic' }}>
                                    {fmtAnswer(answer)}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {isCreateModalOpen && (
        <div style={H.modalOverlay} onClick={closeCreateSessionModal} role="dialog" aria-modal="true" aria-labelledby="survey-create-modal-title">
          <div style={H.modalCard} onClick={e => e.stopPropagation()}>
            <div style={H.modalHeader}>
              <h3 id="survey-create-modal-title" style={H.modalTitle}>설문지 생성</h3>
              <button
                onClick={closeCreateSessionModal}
                style={H.modalCloseBtn}
                disabled={isCreatingSession}
                aria-label="설문지 생성 모달 닫기"
              >
                ×
              </button>
            </div>
            <div style={H.modalBody}>
              <div style={{ position: 'relative' }}>
                <label style={H.formLabel}>환자</label>
                <input
                  value={selectedPatient ? `${selectedPatient.name} (${selectedPatient.chart_number || ''})` : patientQuery}
                  onChange={e => { setPatientQuery(e.target.value); setSelectedPatient(null); }}
                  onFocus={() => patientResults.length > 0 && setShowPatientDropdown(true)}
                  placeholder="이름/차트번호"
                  style={H.formInput}
                  autoFocus
                />
                {showPatientDropdown && patientResults.length > 0 && (
                  <div style={H.dropdown}>
                    {patientResults.map(p => (
                      <div
                        key={p.id}
                        onClick={() => { setSelectedPatient(p); setShowPatientDropdown(false); setPatientQuery(''); }}
                        style={H.dropdownItem}
                        onMouseEnter={e => (e.currentTarget.style.background = '#f1f5f9')}
                        onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
                      >
                        <strong>{p.name}</strong> <span style={{ color: '#64748b' }}>({p.chart_number || '-'})</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label style={H.formLabel}>담당의</label>
                <select value={selectedDoctor} onChange={e => setSelectedDoctor(e.target.value)} style={H.formInput}>
                  <option value="">선택</option>
                  {doctors.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label style={H.formLabel}>템플릿</label>
                <select value={selectedTemplateId} onChange={e => setSelectedTemplateId(Number(e.target.value))} style={H.formInput}>
                  <option value="">선택</option>
                  {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            </div>
            <div style={H.modalFooter}>
              <button
                onClick={closeCreateSessionModal}
                style={H.modalCancelBtn}
                disabled={isCreatingSession}
              >
                취소
              </button>
              <button
                onClick={handleCreateSession}
                disabled={!selectedPatient || !selectedTemplateId || isCreatingSession}
                style={{ ...H.createBtn, opacity: selectedPatient && selectedTemplateId && !isCreatingSession ? 1 : 0.5 }}
              >
                {isCreatingSession ? '생성 중...' : '생성'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== 템플릿 관리 뷰 (2단) ===== */}
      {viewMode === 'templates' && (
        <div style={{ flex: 1, display: 'flex', gap: 16, minHeight: 0 }}>
          <div style={{ width: 300, flexShrink: 0, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #e5e7eb' }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>템플릿 목록</span>
              <button onClick={() => setSelectedTemplateForEdit(null)} style={{ padding: '3px 10px', borderRadius: 4, border: 'none', background: '#4f46e5', color: '#fff', cursor: 'pointer', fontSize: 12 }}>+ 추가</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {allTemplates.length === 0 ? (
                <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>템플릿 없음</div>
              ) : allTemplates.map(t => (
                <div
                  key={t.id}
                  onClick={() => setSelectedTemplateForEdit(t)}
                  style={{
                    padding: '10px 16px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9',
                    background: selectedTemplateForEdit?.id === t.id ? '#eff6ff' : '#fff',
                    borderLeft: selectedTemplateForEdit?.id === t.id ? '3px solid #3b82f6' : '3px solid transparent',
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{t.name}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                    {(t.questions || []).length}문항 · {t.display_mode === 'single_page' ? '원페이지' : '한문항씩'}
                  </div>
                  <div style={{ marginTop: 6, display: 'flex', gap: 4 }}>
                    <button onClick={e => { e.stopPropagation(); handleDuplicateTemplate(t.id); }} style={H.smallBtn}>복사</button>
                    <button onClick={e => { e.stopPropagation(); handleDeleteTemplate(t.id); }} style={{ ...H.smallBtn, color: '#ef4444', borderColor: '#fca5a5' }}>삭제</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ flex: 1, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            {selectedTemplateForEdit === null && allTemplates.length > 0 && !selectedTemplateForEdit ? (
              <InlineTemplateEditor key="new" template={null} onSave={handleSaveTemplateInline} />
            ) : selectedTemplateForEdit ? (
              <InlineTemplateEditor key={selectedTemplateForEdit.id} template={selectedTemplateForEdit} onSave={handleSaveTemplateInline} />
            ) : (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>
                좌측에서 템플릿을 선택하세요
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const Q_TYPES: { value: SurveyQuestionType; label: string }[] = [
  { value: 'text', label: '주관식' },
  { value: 'single_choice', label: '단일선택' },
  { value: 'multiple_choice', label: '복수선택' },
  { value: 'scale', label: '척도' },
];

let _qid = 0;
const genQid = () => `q_${Date.now()}_${++_qid}`;

function InlineTemplateEditor({ template, onSave }: { template: SurveyTemplate | null; onSave: (d: { name: string; description?: string; display_mode: string; questions: SurveyQuestion[] }) => Promise<void> }) {
  const [name, setName] = useState(template?.name || '');
  const [desc, setDesc] = useState(template?.description || '');
  const [mode, setMode] = useState(template?.display_mode || 'single_page');
  const [questions, setQuestions] = useState<SurveyQuestion[]>(template?.questions || []);
  const [saving, setSaving] = useState(false);

  const addQ = () => setQuestions(qs => [...qs, { id: genQid(), question_text: '', question_type: 'single_choice', options: ['옵션 1', '옵션 2'], required: true, order: qs.length }]);
  const updateQ = (i: number, p: Partial<SurveyQuestion>) => setQuestions(qs => qs.map((q, idx) => idx === i ? { ...q, ...p } : q));
  const deleteQ = (i: number) => setQuestions(qs => qs.filter((_, idx) => idx !== i));
  const moveQ = (i: number, dir: 'up' | 'down') => {
    const t = dir === 'up' ? i - 1 : i + 1;
    if (t < 0 || t >= questions.length) return;
    setQuestions(qs => { const n = [...qs]; [n[i], n[t]] = [n[t], n[i]]; return n.map((q, idx) => ({ ...q, order: idx })); });
  };

  const save = async () => {
    if (!name.trim()) return alert('이름을 입력하세요.');
    setSaving(true);
    try { await onSave({ name, description: desc, display_mode: mode, questions }); } finally { setSaving(false); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '12px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>{template ? '템플릿 수정' : '새 템플릿'}</h3>
        <button onClick={save} disabled={saving} style={{ padding: '6px 16px', borderRadius: 6, border: 'none', background: '#4f46e5', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, opacity: saving ? 0.5 : 1 }}>
          {saving ? '저장 중...' : '저장'}
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
        <div style={{ marginBottom: 12 }}>
          <label style={H.formLabel}>템플릿 이름 <span style={{ color: '#ef4444' }}>*</span></label>
          <input style={H.formInput} value={name} onChange={e => setName(e.target.value)} placeholder="예: 기본설문지-여성" />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={H.formLabel}>설명</label>
          <textarea style={{ ...H.formInput, height: 50, resize: 'vertical' }} value={desc} onChange={e => setDesc(e.target.value)} placeholder="간단한 설명" />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={H.formLabel}>표시 방식</label>
          <div style={{ display: 'flex', gap: 16 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, cursor: 'pointer' }}>
              <input type="radio" checked={mode === 'one_by_one'} onChange={() => setMode('one_by_one')} /> 한문항씩
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, cursor: 'pointer' }}>
              <input type="radio" checked={mode === 'single_page'} onChange={() => setMode('single_page')} /> 원페이지
            </label>
          </div>
        </div>

        <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>질문 목록 ({questions.length})</span>
            <button style={{ background: 'none', border: 'none', color: '#3b82f6', fontSize: 13, cursor: 'pointer', fontWeight: 500 }} onClick={addQ}>+ 질문 추가</button>
          </div>
          {questions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 24, border: '2px dashed #d1d5db', borderRadius: 8, color: '#9ca3af', fontSize: 13 }}>
              질문이 없습니다. <button style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer' }} onClick={addQ}>추가</button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {questions.map((q, i) => (
                <div key={q.id} style={{ display: 'flex', gap: 6, padding: 10, border: '1px solid #e5e7eb', borderRadius: 8, background: '#fafafa' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0, paddingTop: 2 }}>
                    <button style={H.moveBtn} onClick={() => moveQ(i, 'up')} disabled={i === 0}>▲</button>
                    <span style={{ color: '#ccc', fontSize: 10 }}>⋮⋮</span>
                    <button style={H.moveBtn} onClick={() => moveQ(i, 'down')} disabled={i === questions.length - 1}>▼</button>
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                      <span style={{ color: '#6b7280', fontSize: 12, fontWeight: 500 }}>Q{i + 1}.</span>
                      <input style={{ ...H.formInput, flex: 1, padding: '5px 8px', fontSize: 13 }} value={q.question_text} onChange={e => updateQ(i, { question_text: e.target.value })} placeholder="질문 내용" />
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <select style={{ ...H.formInput, width: 120, padding: '4px 8px', fontSize: 12 }} value={q.question_type}
                        onChange={e => {
                          const t = e.target.value as SurveyQuestionType;
                          const p: Partial<SurveyQuestion> = { question_type: t };
                          if ((t === 'single_choice' || t === 'multiple_choice') && !q.options?.length) p.options = ['옵션 1', '옵션 2'];
                          else if (t === 'text' || t === 'scale') p.options = undefined;
                          updateQ(i, p);
                        }}>
                        {Q_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 12, cursor: 'pointer' }}>
                        <input type="checkbox" checked={q.required} onChange={e => updateQ(i, { required: e.target.checked })} /> 필수
                      </label>
                    </div>
                    {(q.question_type === 'single_choice' || q.question_type === 'multiple_choice') && (
                      <div style={{ paddingLeft: 4, display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {q.options?.map((opt, oi) => (
                          <div key={oi} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                            <span style={{ color: '#bbb', fontSize: 11, minWidth: 16 }}>{oi + 1}.</span>
                            <input style={{ ...H.formInput, flex: 1, padding: '3px 6px', fontSize: 12 }} value={opt}
                              onChange={e => { const o = [...(q.options || [])]; o[oi] = e.target.value; updateQ(i, { options: o }); }} />
                            {(q.options?.length || 0) > 2 && (
                              <button style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 14 }}
                                onClick={() => updateQ(i, { options: (q.options || []).filter((_, j) => j !== oi) })}>×</button>
                            )}
                          </div>
                        ))}
                        <button style={{ background: 'none', border: 'none', color: '#3b82f6', fontSize: 12, cursor: 'pointer', textAlign: 'left', padding: 0 }}
                          onClick={() => updateQ(i, { options: [...(q.options || []), `옵션 ${(q.options?.length || 0) + 1}`] })}>
                          + 옵션 추가
                        </button>
                      </div>
                    )}
                  </div>
                  <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, alignSelf: 'flex-start', padding: 2 }}
                    onClick={() => deleteQ(i)} title="삭제">🗑️</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const H = {
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' as const, gap: 10 } as React.CSSProperties,
  left: { display: 'flex', alignItems: 'center', gap: 16 } as React.CSSProperties,
  right: { display: 'flex', alignItems: 'center', gap: 10 } as React.CSSProperties,
  dateNav: { display: 'flex', alignItems: 'center', gap: 6 } as React.CSSProperties,
  navBtn: { background: 'none', border: '1px solid #d1d5db', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontSize: 12, color: '#374151' } as React.CSSProperties,
  dateInput: { padding: '3px 8px', borderRadius: 4, border: '1px solid #d1d5db', fontSize: 13 } as React.CSSProperties,
  todayBtn: { padding: '3px 10px', borderRadius: 4, border: 'none', background: '#dbeafe', color: '#1d4ed8', fontSize: 12, cursor: 'pointer', fontWeight: 600 } as React.CSSProperties,
  rangeFilterGroup: { display: 'flex', gap: 4, marginLeft: 4 } as React.CSSProperties,
  filterBtn: { padding: '4px 12px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', color: '#374151', cursor: 'pointer', fontSize: 12, fontWeight: 500 } as React.CSSProperties,
  filterActive: { background: '#4f46e5', color: '#fff', borderColor: '#4f46e5' } as React.CSSProperties,
  modeBtn: { padding: '6px 14px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 500 } as React.CSSProperties,
  formLabel: { display: 'block', fontSize: 12, marginBottom: 3, color: '#64748b' } as React.CSSProperties,
  formInput: { width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, boxSizing: 'border-box' as const, outline: 'none' } as React.CSSProperties,
  createBtn: { padding: '5px 16px', borderRadius: 6, border: 'none', background: '#3b82f6', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 13 } as React.CSSProperties,
  dropdown: { position: 'absolute' as const, top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #d1d5db', borderRadius: 8, maxHeight: 200, overflowY: 'auto' as const, zIndex: 100, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' } as React.CSSProperties,
  modalOverlay: { position: 'fixed' as const, inset: 0, background: 'rgba(15, 23, 42, 0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 } as React.CSSProperties,
  modalCard: { width: 'min(560px, 92vw)', background: '#fff', borderRadius: 12, boxShadow: '0 20px 50px rgba(15, 23, 42, 0.3)', display: 'flex', flexDirection: 'column' } as React.CSSProperties,
  modalHeader: { padding: '14px 18px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' } as React.CSSProperties,
  modalTitle: { margin: 0, fontSize: 16, fontWeight: 700, color: '#111827' } as React.CSSProperties,
  modalCloseBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 24, color: '#64748b', lineHeight: 1 } as React.CSSProperties,
  modalBody: { padding: 18, display: 'flex', flexDirection: 'column', gap: 12 } as React.CSSProperties,
  modalFooter: { padding: '14px 18px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: 8 } as React.CSSProperties,
  modalCancelBtn: { padding: '7px 16px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', color: '#374151', cursor: 'pointer', fontSize: 13 } as React.CSSProperties,
  dropdownItem: { padding: '7px 12px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', fontSize: 13 } as React.CSSProperties,
  smallBtn: { padding: '2px 8px', borderRadius: 4, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontSize: 11 } as React.CSSProperties,
  moveBtn: { background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 10, padding: '1px 3px' } as React.CSSProperties,

  sessionSplitWrap: { flex: 1, display: 'flex', gap: 12, minHeight: 0, flexWrap: 'wrap' as const } as React.CSSProperties,
  sessionListPanel: { flex: '1 1 340px', minWidth: 320, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, display: 'flex', flexDirection: 'column', minHeight: 360 } as React.CSSProperties,
  sessionDetailPanel: { flex: '1.3 1 440px', minWidth: 360, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, display: 'flex', flexDirection: 'column', minHeight: 360 } as React.CSSProperties,
  panelTitle: { padding: '12px 14px', borderBottom: '1px solid #e5e7eb', fontSize: 13, fontWeight: 600, color: '#334155' } as React.CSSProperties,
  sessionListBody: { flex: 1, overflow: 'auto' as const } as React.CSSProperties,
  sessionTableWrap: { minWidth: 900, display: 'flex', flexDirection: 'column' } as React.CSSProperties,
  sessionTableHead: { display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px', borderBottom: '1px solid #e5e7eb', background: '#f8fafc', position: 'sticky' as const, top: 0, zIndex: 1 } as React.CSSProperties,
  sessionTableBody: { display: 'flex', flexDirection: 'column' } as React.CSSProperties,
  sessionRow: { display: 'flex', alignItems: 'center', gap: 6, padding: '9px 10px', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', background: '#fff', lineHeight: 1.35 } as React.CSSProperties,
  sessionRowActive: { background: '#eff6ff', boxShadow: 'inset 3px 0 0 #3b82f6' } as React.CSSProperties,
  sessionCol: { fontSize: 13, color: '#334155', whiteSpace: 'nowrap' as const, overflow: 'hidden' as const, textOverflow: 'ellipsis' as const } as React.CSSProperties,
  colName: { flex: '0 0 112px', fontWeight: 600, fontSize: 14 } as React.CSSProperties,
  colChart: { flex: '0 0 84px', color: '#64748b' } as React.CSSProperties,
  colAge: { flex: '0 0 54px', textAlign: 'right' as const } as React.CSSProperties,
  colGender: { flex: '0 0 48px', textAlign: 'center' as const } as React.CSSProperties,
  colTemplate: { flex: '1 1 200px' } as React.CSSProperties,
  colDate: { flex: '0 0 110px', color: '#64748b' } as React.CSSProperties,
  colTime: { flex: '0 0 66px', color: '#64748b' } as React.CSSProperties,
  colStatus: { flex: '0 0 64px', textAlign: 'center' as const } as React.CSSProperties,
  colAction: { flex: '0 0 44px', textAlign: 'right' as const } as React.CSSProperties,
  detailHeader: { padding: '12px 14px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' as const } as React.CSSProperties,
  emptyState: { height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 13 } as React.CSSProperties,

  toggleWrap: { display: 'flex', background: '#f1f5f9', borderRadius: 6, padding: 2 } as React.CSSProperties,
  toggleBtn: { padding: '4px 10px', borderRadius: 4, border: 'none', background: 'transparent', fontSize: 12, cursor: 'pointer', color: '#64748b', fontWeight: 500 } as React.CSSProperties,
  toggleActive: { background: '#fff', color: '#1e293b', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' } as React.CSSProperties,
  copyBtn: { padding: '6px 12px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 500 } as React.CSSProperties,
  copyDone: { background: '#dcfce7', color: '#16a34a', borderColor: '#86efac' } as React.CSSProperties,
  summaryBox: { margin: 0, background: '#f8fafc', borderRadius: 8, padding: 16, fontFamily: 'monospace', fontSize: 13, whiteSpace: 'pre-wrap' as const, lineHeight: 1.7, color: '#334155' } as React.CSSProperties,

  qCard: { border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' } as React.CSSProperties,
  qHeader: { width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#f8fafc', border: 'none', cursor: 'pointer' } as React.CSSProperties,
  qBody: { padding: '10px 14px', background: '#fff' } as React.CSSProperties,
};
