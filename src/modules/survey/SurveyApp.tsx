import { useState, useEffect, useCallback } from 'react';
import type { SurveySession, SurveyTemplate, SurveyQuestion, SurveyAnswer } from '../cs/types';
import { getWaitingSessions, getTemplate, updateSessionStatus, submitResponse } from '../cs/lib/surveyApi';

// 세션 정보로 자동 채우는 질문 ID들
const AUTO_FILL_IDS = ['name', 'chart_number', 'doctor', 'gender_age'];

export default function SurveyApp() {
  const [sessions, setSessions] = useState<SurveySession[]>([]);
  const [activeSession, setActiveSession] = useState<SurveySession | null>(null);
  const [template, setTemplate] = useState<SurveyTemplate | null>(null);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getWaitingSessions();
      setSessions(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  // Auto-refresh sessions every 10s
  useEffect(() => {
    if (activeSession) return;
    const interval = setInterval(loadSessions, 10000);
    return () => clearInterval(interval);
  }, [activeSession, loadSessions]);

  const handleSelectSession = async (session: SurveySession) => {
    try {
      await updateSessionStatus(session.id, 'in_progress');
      const tmpl = await getTemplate(session.template_id);
      if (!tmpl) { alert('템플릿을 찾을 수 없습니다.'); return; }
      setActiveSession(session);
      setTemplate(tmpl);

      // Auto-fill answers from session info
      const autoAnswers: Record<string, string | string[]> = {};
      if (session.patient_name) autoAnswers['name'] = session.patient_name;
      if (session.chart_number) autoAnswers['chart_number'] = session.chart_number;
      if (session.doctor_name) autoAnswers['doctor'] = session.doctor_name;
      if (session.gender || session.age) {
        const genderStr = session.gender === 'male' || session.gender === 'M' ? '남' : session.gender === 'female' || session.gender === 'F' ? '여' : session.gender || '';
        autoAnswers['gender_age'] = `${genderStr}/${session.age || ''}세`;
      }
      setAnswers(autoAnswers);
      setCompleted(false);
    } catch (e) { console.error(e); }
  };

  const handleAnswerChange = (questionId: string, value: string | string[]) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const handleToggleOption = (questionId: string, option: string) => {
    setAnswers(prev => {
      const current = (prev[questionId] as string[]) || [];
      const next = current.includes(option) ? current.filter(o => o !== option) : [...current, option];
      return { ...prev, [questionId]: next };
    });
  };

  const handleSubmit = async () => {
    if (!activeSession || !template) return;
    setSubmitting(true);
    try {
      const surveyAnswers: SurveyAnswer[] = Object.entries(answers)
        .filter(([_, v]) => v && (typeof v === 'string' ? v.length > 0 : v.length > 0))
        .map(([question_id, answer]) => ({ question_id, answer }));

      await submitResponse({
        session_id: activeSession.id,
        template_id: template.id,
        patient_id: activeSession.patient_id,
        answers: surveyAnswers,
      });
      setCompleted(true);
      setTimeout(() => {
        setActiveSession(null);
        setTemplate(null);
        setAnswers({});
        setCompleted(false);
        loadSessions();
      }, 3000);
    } catch (e) {
      console.error(e);
      alert('제출 실패. 다시 시도해주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBack = async () => {
    if (activeSession) {
      await updateSessionStatus(activeSession.id, 'waiting');
    }
    setActiveSession(null);
    setTemplate(null);
    setAnswers({});
    loadSessions();
  };

  // Completed screen
  if (completed) {
    return (
      <div style={styles.container}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
          <div style={{ fontSize: 72, marginBottom: 24 }}>✅</div>
          <h1 style={{ fontSize: 28, marginBottom: 12, color: '#10b981' }}>설문이 완료되었습니다</h1>
          <p style={{ fontSize: 18, color: '#64748b' }}>감사합니다. 잠시 후 목록으로 돌아갑니다.</p>
        </div>
      </div>
    );
  }

  // Survey form
  if (activeSession && template) {
    const visibleQuestions = template.questions.filter(q => !AUTO_FILL_IDS.includes(q.id));

    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <button onClick={handleBack} style={styles.backBtn}>← 돌아가기</button>
          <div style={{ textAlign: 'center', flex: 1 }}>
            <h1 style={{ margin: 0, fontSize: 22 }}>{template.name}</h1>
            <p style={{ margin: '4px 0 0', fontSize: 14, color: '#64748b' }}>
              {activeSession.patient_name} {activeSession.chart_number && `(${activeSession.chart_number})`} {activeSession.doctor_name && `| 담당의: ${activeSession.doctor_name}`}
            </p>
          </div>
          <div style={{ width: 100 }} />
        </div>

        <div style={styles.formBody}>
          {visibleQuestions.map(q => (
            <QuestionField
              key={q.id}
              question={q}
              value={answers[q.id]}
              onChange={v => handleAnswerChange(q.id, v)}
              onToggle={opt => handleToggleOption(q.id, opt)}
            />
          ))}

          <button onClick={handleSubmit} disabled={submitting} style={{ ...styles.submitBtn, opacity: submitting ? 0.6 : 1 }}>
            {submitting ? '제출 중...' : '설문 제출하기'}
          </button>
        </div>
      </div>
    );
  }

  // Session list
  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={{ margin: 0, fontSize: 24 }}>📝 설문 작성</h1>
      </div>

      <div style={{ padding: 20 }}>
        {loading ? (
          <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: 18, padding: 40 }}>로딩 중...</p>
        ) : sessions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>📋</div>
            <p style={{ fontSize: 20, color: '#94a3b8' }}>대기 중인 설문이 없습니다</p>
            <p style={{ fontSize: 14, color: '#cbd5e1' }}>데스크에서 설문 세션을 생성해주세요</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {sessions.map(s => (
              <button key={s.id} onClick={() => handleSelectSession(s)} style={styles.sessionCard}>
                <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>{s.patient_name || '이름 없음'}</div>
                <div style={{ fontSize: 14, color: '#64748b', marginBottom: 4 }}>
                  {s.chart_number && `차트: ${s.chart_number}`}
                  {s.gender && s.age && ` | ${s.gender === 'male' || s.gender === 'M' ? '남' : '여'}/${s.age}세`}
                </div>
                {s.doctor_name && <div style={{ fontSize: 14, color: '#64748b' }}>담당의: {s.doctor_name}</div>}
                <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 8 }}>{s.template_name || '설문'}</div>
                <div style={{ marginTop: 12, fontSize: 15, color: '#4f46e5', fontWeight: 600 }}>탭하여 시작 →</div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Question renderer
function QuestionField({ question, value, onChange, onToggle }: {
  question: SurveyQuestion;
  value: string | string[] | undefined;
  onChange: (v: string | string[]) => void;
  onToggle: (opt: string) => void;
}) {
  const isSection = question.question_text.startsWith('>');

  if (question.question_type === 'text' && !question.options) {
    // Section header or text input
    if (isSection) {
      return <h2 style={{ fontSize: 18, fontWeight: 700, marginTop: 24, marginBottom: 8, color: '#1e293b', borderBottom: '2px solid #e2e8f0', paddingBottom: 8 }}>{question.question_text}</h2>;
    }
    return (
      <div style={styles.questionBlock}>
        <label style={styles.questionLabel}>{question.question_text}{question.required && <span style={{ color: '#ef4444' }}> *</span>}</label>
        <input
          value={(value as string) || ''}
          onChange={e => onChange(e.target.value)}
          style={styles.textInput}
          placeholder="입력해주세요"
        />
      </div>
    );
  }

  if (question.question_type === 'single_choice' && question.options) {
    return (
      <div style={styles.questionBlock}>
        <label style={styles.questionLabel}>{question.question_text}{question.required && <span style={{ color: '#ef4444' }}> *</span>}</label>
        <div style={styles.optionsGrid}>
          {question.options.map(opt => (
            <button key={opt} onClick={() => onChange(opt)} style={{ ...styles.optionBtn, background: value === opt ? '#4f46e5' : '#f8fafc', color: value === opt ? '#fff' : '#374151', borderColor: value === opt ? '#4f46e5' : '#d1d5db' }}>
              {opt}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (question.question_type === 'multiple_choice' && question.options) {
    const selected = (value as string[]) || [];
    return (
      <div style={styles.questionBlock}>
        <label style={styles.questionLabel}>{question.question_text}{question.required && <span style={{ color: '#ef4444' }}> *</span>}</label>
        <div style={styles.optionsGrid}>
          {question.options.map(opt => (
            <button key={opt} onClick={() => onToggle(opt)} style={{ ...styles.optionBtn, background: selected.includes(opt) ? '#4f46e5' : '#f8fafc', color: selected.includes(opt) ? '#fff' : '#374151', borderColor: selected.includes(opt) ? '#4f46e5' : '#d1d5db' }}>
              {opt}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (question.question_type === 'scale') {
    return (
      <div style={styles.questionBlock}>
        <label style={styles.questionLabel}>{question.question_text}{question.required && <span style={{ color: '#ef4444' }}> *</span>}</label>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          {[1, 2, 3, 4, 5].map(n => (
            <button key={n} onClick={() => onChange(String(n))} style={{ ...styles.optionBtn, width: 48, height: 48, borderRadius: '50%', background: value === String(n) ? '#4f46e5' : '#f8fafc', color: value === String(n) ? '#fff' : '#374151', borderColor: value === String(n) ? '#4f46e5' : '#d1d5db', fontSize: 18 }}>
              {n}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return null;
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    background: '#f8fafc',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    padding: '16px 20px',
    background: '#fff',
    borderBottom: '1px solid #e2e8f0',
    position: 'sticky',
    top: 0,
    zIndex: 10,
  },
  backBtn: {
    padding: '8px 16px',
    borderRadius: 8,
    border: '1px solid #d1d5db',
    background: '#fff',
    cursor: 'pointer',
    fontSize: 15,
    width: 100,
  },
  formBody: {
    padding: '20px 20px 40px',
    maxWidth: 800,
    margin: '0 auto',
  },
  questionBlock: {
    marginBottom: 20,
    padding: 16,
    background: '#fff',
    borderRadius: 12,
    border: '1px solid #e2e8f0',
  },
  questionLabel: {
    display: 'block',
    fontSize: 16,
    fontWeight: 600,
    marginBottom: 10,
    color: '#1e293b',
  },
  textInput: {
    width: '100%',
    padding: '12px 16px',
    borderRadius: 10,
    border: '1px solid #d1d5db',
    fontSize: 16,
    boxSizing: 'border-box' as const,
  },
  optionsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: 12,
  },
  optionBtn: {
    padding: '10px 16px',
    borderRadius: 10,
    border: '2px solid #d1d5db',
    cursor: 'pointer',
    fontSize: 15,
    fontWeight: 500,
    minHeight: 44,
    transition: 'all 0.15s',
  },
  submitBtn: {
    width: '100%',
    padding: '16px',
    borderRadius: 12,
    border: 'none',
    background: '#4f46e5',
    color: '#fff',
    fontSize: 18,
    fontWeight: 700,
    cursor: 'pointer',
    marginTop: 24,
    minHeight: 56,
  },
  sessionCard: {
    padding: 20,
    background: '#fff',
    border: '2px solid #e2e8f0',
    borderRadius: 16,
    cursor: 'pointer',
    textAlign: 'left' as const,
    width: '100%',
    transition: 'all 0.15s',
  },
};
