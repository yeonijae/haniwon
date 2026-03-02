import { useState, useEffect, useCallback } from 'react';
import type { PortalUser } from '@shared/types';
import type { SurveyTemplate, SurveySession, SurveyQuestion, SurveyAnswer } from '../../types';
import { searchLocalPatients, searchAndSyncPatients, type LocalPatient } from '../../lib/patientSync';
import {
  getTemplates, createTemplate, updateTemplate, deleteTemplate, duplicateTemplate,
  createSession, getSessionsByDate, deleteSession,
  getResponseBySession,
} from '../../lib/surveyApi';
import SurveyTemplateEditorModal from './SurveyTemplateEditorModal';
import SurveyResponseModal from './SurveyResponseModal';

const MSSQL_API_URL = import.meta.env.VITE_MSSQL_API_URL || 'http://192.168.0.48:3100';

interface Doctor { id: string; name: string; isOther?: boolean; resigned?: boolean; workStartDate?: string; workEndDate?: string; }

interface SurveyManagementViewProps { user: PortalUser; }

type ViewMode = 'sessions' | 'templates';
type StatusFilter = 'all' | 'waiting' | 'completed';

const toDateStr = (d: Date) => d.toISOString().split('T')[0];
const formatDate = (s: string) => {
  const d = new Date(s + 'T00:00:00');
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return `${d.getMonth() + 1}/${d.getDate()} (${days[d.getDay()]})`;
};

export default function SurveyManagementView({ user }: SurveyManagementViewProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('sessions');
  const [selectedDate, setSelectedDate] = useState(toDateStr(new Date()));
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [templates, setTemplates] = useState<SurveyTemplate[]>([]);
  const [allTemplates, setAllTemplates] = useState<SurveyTemplate[]>([]);
  const [sessions, setSessions] = useState<SurveySession[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(false);

  // Session creation form
  const [selectedPatient, setSelectedPatient] = useState<LocalPatient | null>(null);
  const [patientQuery, setPatientQuery] = useState('');
  const [patientResults, setPatientResults] = useState<LocalPatient[]>([]);
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | ''>('');

  // Template editor (inline for templates view)
  const [selectedTemplateForEdit, setSelectedTemplateForEdit] = useState<SurveyTemplate | null>(null);

  // Response preview
  const [previewResponse, setPreviewResponse] = useState<{ session: SurveySession; answers: SurveyAnswer[]; template: SurveyTemplate } | null>(null);

  // Load sessions (silent=true이면 로딩 표시 없이 백그라운드 갱신)
  const loadSessions = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const sess = await getSessionsByDate(selectedDate, statusFilter);
      setSessions(sess);
    } catch (e) { console.error(e); } finally { if (!silent) setLoading(false); }
  }, [selectedDate, statusFilter]);

  // Load templates
  const loadTemplates = useCallback(async () => {
    try {
      const tpls = await getTemplates();
      setTemplates(tpls);
      setAllTemplates(tpls);
      if (tpls.length > 0 && selectedTemplateId === '') setSelectedTemplateId(tpls[0].id);
    } catch (e) { console.error(e); }
  }, []);

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
        } catch { /* ignore keepalive / parse errors */ }
      };
      es.onerror = () => {
        // SSE 연결 실패 시 폴링 fallback은 아래에서 처리
        es?.close();
        es = null;
      };
    } catch { /* EventSource 미지원 시 무시 */ }

    // SSE 연결 실패 시 폴링 fallback (10초)
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

  // Date navigation
  const moveDate = (offset: number) => {
    const d = new Date(selectedDate + 'T00:00:00');
    d.setDate(d.getDate() + offset);
    setSelectedDate(toDateStr(d));
  };
  const goToday = () => setSelectedDate(toDateStr(new Date()));
  const isToday = selectedDate === toDateStr(new Date());

  // Session CRUD
  const handleCreateSession = async () => {
    if (!selectedPatient || !selectedTemplateId) return alert('환자와 템플릿을 선택해주세요.');
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
      setSelectedPatient(null); setPatientQuery(''); setSelectedDoctor('');
      loadSessions();
    } catch (e) { console.error(e); alert('세션 생성 실패'); }
  };

  const handleDeleteSession = async (id: number) => {
    if (!confirm('삭제하시겠습니까?')) return;
    try { await deleteSession(id); loadSessions(); } catch (e) { console.error(e); }
  };

  const handlePreviewResponse = async (session: SurveySession) => {
    try {
      const resp = await getResponseBySession(session.id);
      if (!resp) return alert('응답 데이터가 없습니다.');
      const tmpl = allTemplates.find(t => t.id === session.template_id);
      if (!tmpl) return;
      setPreviewResponse({ session, answers: resp.answers as SurveyAnswer[], template: tmpl });
    } catch (e) { console.error(e); }
  };

  // Template CRUD (inline save for templates view)
  const handleSaveTemplateInline = async (data: { name: string; description?: string; display_mode: string; questions: SurveyQuestion[] }) => {
    try {
      if (selectedTemplateForEdit) {
        await updateTemplate(selectedTemplateForEdit.id, { name: data.name, description: data.description, questions: data.questions, display_mode: data.display_mode });
      } else {
        await createTemplate({ name: data.name, description: data.description, questions: data.questions, display_mode: data.display_mode });
      }
      await loadTemplates();
      // Re-select updated template
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

  const statusBadge = (status: string) => {
    const c: Record<string, string> = { waiting: '#f59e0b', in_progress: '#3b82f6', completed: '#10b981' };
    const l: Record<string, string> = { waiting: '대기', in_progress: '작성중', completed: '완료' };
    return <span style={{ background: c[status] || '#9ca3af', color: '#fff', padding: '2px 8px', borderRadius: 12, fontSize: 12, fontWeight: 600 }}>{l[status] || status}</span>;
  };

  /* ========== 렌더링 ========== */

  return (
    <div style={{ padding: 20, height: '100%', display: 'flex', flexDirection: 'column' }}>

      {/* ===== 헤더 ===== */}
      <div style={H.header}>
        <div style={H.left}>
          <span style={{ fontSize: 18, fontWeight: 700 }}>📝 설문 관리</span>
          {viewMode === 'sessions' && (
            <div style={H.dateNav}>
              <button style={H.navBtn} onClick={() => moveDate(-1)}>◀</button>
              <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} style={H.dateInput} />
              <span style={{ fontSize: 14, color: '#374151', fontWeight: 500 }}>{formatDate(selectedDate)}</span>
              <button style={H.navBtn} onClick={() => moveDate(1)}>▶</button>
              {!isToday && <button style={H.todayBtn} onClick={goToday}>오늘</button>}
            </div>
          )}
        </div>

        <div style={H.right}>
          {viewMode === 'sessions' && (
            <div style={{ display: 'flex', gap: 4 }}>
              {(['all', 'waiting', 'completed'] as StatusFilter[]).map(s => (
                <button key={s} onClick={() => setStatusFilter(s)} style={{ ...H.filterBtn, ...(statusFilter === s ? H.filterActive : {}) }}>
                  {{ all: '전체', waiting: '대기중', completed: '작성완료' }[s]}
                </button>
              ))}
            </div>
          )}
          <button
            onClick={() => setViewMode(viewMode === 'sessions' ? 'templates' : 'sessions')}
            style={H.modeBtn}
          >
            {viewMode === 'sessions' ? '⚙️ 템플릿 관리' : '📋 세션 관리'}
          </button>
        </div>
      </div>

      {/* ===== 세션 관리 뷰 ===== */}
      {viewMode === 'sessions' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16, minHeight: 0 }}>
          {/* 세션 생성 폼 */}
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 16 }}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              {/* 환자 검색 */}
              <div style={{ position: 'relative', flex: '1 1 200px' }}>
                <label style={H.formLabel}>환자</label>
                <input
                  value={selectedPatient ? `${selectedPatient.name} (${selectedPatient.chart_number || ''})` : patientQuery}
                  onChange={e => { setPatientQuery(e.target.value); setSelectedPatient(null); }}
                  onFocus={() => patientResults.length > 0 && setShowPatientDropdown(true)}
                  placeholder="이름/차트번호"
                  style={H.formInput}
                />
                {showPatientDropdown && patientResults.length > 0 && (
                  <div style={H.dropdown}>
                    {patientResults.map(p => (
                      <div key={p.id} onClick={() => { setSelectedPatient(p); setShowPatientDropdown(false); setPatientQuery(''); }}
                        style={H.dropdownItem}
                        onMouseEnter={e => (e.currentTarget.style.background = '#f1f5f9')}
                        onMouseLeave={e => (e.currentTarget.style.background = '#fff')}>
                        <strong>{p.name}</strong> <span style={{ color: '#64748b' }}>({p.chart_number || '-'})</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ flex: '0 1 140px' }}>
                <label style={H.formLabel}>담당의</label>
                <select value={selectedDoctor} onChange={e => setSelectedDoctor(e.target.value)} style={H.formInput}>
                  <option value="">선택</option>
                  {doctors.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                </select>
              </div>
              <div style={{ flex: '0 1 180px' }}>
                <label style={H.formLabel}>템플릿</label>
                <select value={selectedTemplateId} onChange={e => setSelectedTemplateId(Number(e.target.value))} style={H.formInput}>
                  <option value="">선택</option>
                  {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <button onClick={handleCreateSession} disabled={!selectedPatient || !selectedTemplateId}
                style={{ ...H.createBtn, opacity: selectedPatient && selectedTemplateId ? 1 : 0.4 }}>
                생성
              </button>
            </div>
          </div>

          {/* 세션 목록 */}
          <div style={{ flex: 1, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'auto' }}>
            {loading ? <p style={{ textAlign: 'center', color: '#94a3b8', padding: 40 }}>로딩 중...</p> : sessions.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#94a3b8', padding: 40 }}>세션이 없습니다</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e2e8f0', background: '#f8fafc' }}>
                    <th style={H.th}>환자</th>
                    <th style={H.th}>차트번호</th>
                    <th style={H.th}>나이/성별</th>
                    <th style={H.th}>담당의</th>
                    <th style={H.th}>템플릿</th>
                    <th style={{ ...H.th, textAlign: 'center' }}>상태</th>
                    <th style={{ ...H.th, textAlign: 'center' }}>시간</th>
                    <th style={{ ...H.th, textAlign: 'center' }}>작업</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map(s => (
                    <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ ...H.td, fontWeight: 600 }}>{s.patient_name || '-'}</td>
                      <td style={{ ...H.td, color: '#64748b' }}>{s.chart_number || '-'}</td>
                      <td style={{ ...H.td, color: '#64748b', fontSize: 12 }}>{[s.age != null ? `${s.age}세` : '', s.gender ? (s.gender === 'M' || s.gender === '남' ? '남' : '여') : ''].filter(Boolean).join('/')}</td>
                      <td style={H.td}>{s.doctor_name || '-'}</td>
                      <td style={H.td}>{s.template_name || '-'}</td>
                      <td style={{ ...H.td, textAlign: 'center' }}>{statusBadge(s.status)}</td>
                      <td style={{ ...H.td, textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>
                        {s.created_at ? new Date(s.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '-'}
                      </td>
                      <td style={{ ...H.td, textAlign: 'center' }}>
                        {s.status === 'completed' && (
                          <button onClick={() => handlePreviewResponse(s)} style={H.actionBtn}>👁️ 보기</button>
                        )}
                        {s.status === 'waiting' && (
                          <button onClick={() => handleDeleteSession(s.id)} style={{ ...H.actionBtn, color: '#ef4444', borderColor: '#fca5a5' }}>삭제</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ===== 템플릿 관리 뷰 (2단) ===== */}
      {viewMode === 'templates' && (
        <div style={{ flex: 1, display: 'flex', gap: 16, minHeight: 0 }}>
          {/* 좌측: 템플릿 목록 */}
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

          {/* 우측: 인라인 편집 */}
          <div style={{ flex: 1, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            {selectedTemplateForEdit === null && allTemplates.length > 0 && !selectedTemplateForEdit ? (
              <InlineTemplateEditor
                key="new"
                template={null}
                onSave={handleSaveTemplateInline}
              />
            ) : selectedTemplateForEdit ? (
              <InlineTemplateEditor
                key={selectedTemplateForEdit.id}
                template={selectedTemplateForEdit}
                onSave={handleSaveTemplateInline}
              />
            ) : (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>
                좌측에서 템플릿을 선택하세요
              </div>
            )}
          </div>
        </div>
      )}

      {/* 응답 상세 모달 */}
      {previewResponse && (
        <SurveyResponseModal
          session={previewResponse.session}
          answers={previewResponse.answers}
          template={previewResponse.template}
          onClose={() => setPreviewResponse(null)}
        />
      )}
    </div>
  );
}

/* ===== 인라인 템플릿 편집기 (우측 패널용) ===== */
import type { SurveyQuestionType } from '../../types';

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
      {/* 헤더 */}
      <div style={{ padding: '12px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>{template ? '템플릿 수정' : '새 템플릿'}</h3>
        <button onClick={save} disabled={saving} style={{ padding: '6px 16px', borderRadius: 6, border: 'none', background: '#4f46e5', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, opacity: saving ? 0.5 : 1 }}>
          {saving ? '저장 중...' : '저장'}
        </button>
      </div>

      {/* 본문 스크롤 */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
        {/* 기본 정보 */}
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

        {/* 질문 목록 */}
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
                  {/* 이동 */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0, paddingTop: 2 }}>
                    <button style={H.moveBtn} onClick={() => moveQ(i, 'up')} disabled={i === 0}>▲</button>
                    <span style={{ color: '#ccc', fontSize: 10 }}>⋮⋮</span>
                    <button style={H.moveBtn} onClick={() => moveQ(i, 'down')} disabled={i === questions.length - 1}>▼</button>
                  </div>
                  {/* 내용 */}
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
                    {/* 옵션 */}
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
                  {/* 삭제 */}
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

/* ===== 스타일 ===== */
const H = {
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' as const, gap: 10 } as React.CSSProperties,
  left: { display: 'flex', alignItems: 'center', gap: 16 } as React.CSSProperties,
  right: { display: 'flex', alignItems: 'center', gap: 10 } as React.CSSProperties,
  dateNav: { display: 'flex', alignItems: 'center', gap: 6 } as React.CSSProperties,
  navBtn: { background: 'none', border: '1px solid #d1d5db', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontSize: 12, color: '#374151' } as React.CSSProperties,
  dateInput: { padding: '3px 8px', borderRadius: 4, border: '1px solid #d1d5db', fontSize: 13 } as React.CSSProperties,
  todayBtn: { padding: '3px 10px', borderRadius: 4, border: 'none', background: '#dbeafe', color: '#1d4ed8', fontSize: 12, cursor: 'pointer', fontWeight: 600 } as React.CSSProperties,
  filterBtn: { padding: '4px 12px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', color: '#374151', cursor: 'pointer', fontSize: 12, fontWeight: 500 } as React.CSSProperties,
  filterActive: { background: '#4f46e5', color: '#fff', borderColor: '#4f46e5' } as React.CSSProperties,
  modeBtn: { padding: '6px 14px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 500 } as React.CSSProperties,
  formLabel: { display: 'block', fontSize: 12, marginBottom: 3, color: '#64748b' } as React.CSSProperties,
  formInput: { width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, boxSizing: 'border-box' as const, outline: 'none' } as React.CSSProperties,
  createBtn: { padding: '7px 20px', borderRadius: 6, border: 'none', background: '#4f46e5', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 13, height: 36 } as React.CSSProperties,
  dropdown: { position: 'absolute' as const, top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #d1d5db', borderRadius: 8, maxHeight: 200, overflowY: 'auto' as const, zIndex: 100, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' } as React.CSSProperties,
  dropdownItem: { padding: '7px 12px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', fontSize: 13 } as React.CSSProperties,
  th: { padding: '8px 10px', textAlign: 'left' as const, fontSize: 12, fontWeight: 600, color: '#64748b' } as React.CSSProperties,
  td: { padding: '8px 10px' } as React.CSSProperties,
  actionBtn: { padding: '3px 8px', borderRadius: 4, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontSize: 11 } as React.CSSProperties,
  smallBtn: { padding: '2px 8px', borderRadius: 4, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontSize: 11 } as React.CSSProperties,
  moveBtn: { background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 10, padding: '1px 3px' } as React.CSSProperties,
};
