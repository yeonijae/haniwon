/**
 * 설문 템플릿 편집 모달
 * gosibang의 TemplateEditorModal 참고 — haniwon 인라인 스타일 버전
 */
import React, { useState } from 'react';
import type { SurveyTemplate, SurveyQuestion, SurveyQuestionType } from '../../types';

interface SurveyTemplateEditorModalProps {
  template: SurveyTemplate | null; // null이면 새로 만들기
  onSave: (data: { name: string; description?: string; display_mode: string; questions: SurveyQuestion[] }) => Promise<void>;
  onClose: () => void;
}

const QUESTION_TYPES: { value: SurveyQuestionType; label: string }[] = [
  { value: 'text', label: '주관식' },
  { value: 'single_choice', label: '단일선택' },
  { value: 'multiple_choice', label: '복수선택' },
  { value: 'scale', label: '척도' },
];

let _qidCounter = 0;
function genId(): string {
  return `q_${Date.now()}_${++_qidCounter}`;
}

export default function SurveyTemplateEditorModal({ template, onSave, onClose }: SurveyTemplateEditorModalProps) {
  const [name, setName] = useState(template?.name || '');
  const [description, setDescription] = useState(template?.description || '');
  const [displayMode, setDisplayMode] = useState(template?.display_mode || 'single_page');
  const [questions, setQuestions] = useState<SurveyQuestion[]>(template?.questions || []);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const addQuestion = () => {
    setQuestions([...questions, {
      id: genId(),
      question_text: '',
      question_type: 'single_choice',
      options: ['옵션 1', '옵션 2'],
      required: true,
      order: questions.length,
    }]);
  };

  const updateQuestion = (idx: number, patch: Partial<SurveyQuestion>) => {
    setQuestions(qs => qs.map((q, i) => i === idx ? { ...q, ...patch } : q));
  };

  const deleteQuestion = (idx: number) => {
    setQuestions(qs => qs.filter((_, i) => i !== idx));
  };

  const moveQuestion = (idx: number, dir: 'up' | 'down') => {
    const target = dir === 'up' ? idx - 1 : idx + 1;
    if (target < 0 || target >= questions.length) return;
    const next = [...questions];
    [next[idx], next[target]] = [next[target], next[idx]];
    setQuestions(next.map((q, i) => ({ ...q, order: i })));
  };

  const handleSubmit = async () => {
    if (!name.trim()) return alert('템플릿 이름을 입력하세요.');
    if (questions.length === 0) return alert('질문을 하나 이상 추가하세요.');
    if (questions.some(q => !q.question_text.trim())) return alert('모든 질문 내용을 입력하세요.');
    setSaving(true);
    try {
      await onSave({ name, description, display_mode: displayMode, questions });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={S.header}>
          <h3 style={S.title}>{template ? '템플릿 수정' : '새 템플릿'}</h3>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {questions.length > 0 && (
              <button style={S.previewBtn} onClick={() => setShowPreview(!showPreview)}>
                {showPreview ? '✏️ 편집' : '👁 미리보기'}
              </button>
            )}
            <button style={S.closeBtn} onClick={onClose}>×</button>
          </div>
        </div>

        {/* Body */}
        <div style={S.body}>
          {showPreview ? (
            <PreviewMode name={name} description={description} questions={questions} />
          ) : (
            <>
              {/* 템플릿 이름 */}
              <div style={S.field}>
                <label style={S.label}>템플릿 이름 <span style={{ color: '#ef4444' }}>*</span></label>
                <input style={S.input} value={name} onChange={e => setName(e.target.value)} placeholder="예: 기본설문지-여성" />
              </div>

              {/* 설명 */}
              <div style={S.field}>
                <label style={S.label}>설명</label>
                <textarea style={{ ...S.input, height: 60, resize: 'vertical' }} value={description} onChange={e => setDescription(e.target.value)} placeholder="설문지에 대한 간단한 설명" />
              </div>

              {/* 표시 방식 */}
              <div style={S.field}>
                <label style={S.label}>표시 방식</label>
                <div style={{ display: 'flex', gap: 16 }}>
                  <label style={S.radioLabel}>
                    <input type="radio" checked={displayMode === 'one_by_one'} onChange={() => setDisplayMode('one_by_one')} />
                    <span>한 문항씩 보기</span>
                  </label>
                  <label style={S.radioLabel}>
                    <input type="radio" checked={displayMode === 'single_page'} onChange={() => setDisplayMode('single_page')} />
                    <span>원페이지 스크롤</span>
                  </label>
                </div>
                <p style={S.hint}>
                  {displayMode === 'one_by_one' ? '질문을 하나씩 순서대로 표시합니다.' : '모든 질문을 한 페이지에 표시하여 스크롤로 작성합니다.'}
                </p>
              </div>

              {/* 질문 목록 */}
              <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 16, marginTop: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>질문 목록</span>
                  <button style={S.addBtn} onClick={addQuestion}>+ 질문 추가</button>
                </div>

                {questions.length === 0 ? (
                  <div style={S.emptyBox}>
                    <p>아직 질문이 없습니다.</p>
                    <button style={{ ...S.addBtn, marginTop: 8 }} onClick={addQuestion}>첫 번째 질문 추가하기</button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {questions.map((q, i) => (
                      <QuestionEditor
                        key={q.id}
                        question={q}
                        index={i}
                        total={questions.length}
                        onUpdate={patch => updateQuestion(i, patch)}
                        onDelete={() => deleteQuestion(i)}
                        onMove={dir => moveQuestion(i, dir)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={S.footer}>
          <button style={S.cancelBtn} onClick={onClose}>취소</button>
          <button style={{ ...S.saveBtn, opacity: saving ? 0.5 : 1 }} onClick={handleSubmit} disabled={saving}>
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ===== 질문 편집기 ===== */
function QuestionEditor({ question, index, total, onUpdate, onDelete, onMove }: {
  question: SurveyQuestion; index: number; total: number;
  onUpdate: (p: Partial<SurveyQuestion>) => void; onDelete: () => void; onMove: (d: 'up' | 'down') => void;
}) {
  const handleTypeChange = (type: SurveyQuestionType) => {
    const patch: Partial<SurveyQuestion> = { question_type: type };
    if (type === 'single_choice' || type === 'multiple_choice') {
      if (!question.options?.length) patch.options = ['옵션 1', '옵션 2'];
    } else {
      patch.options = undefined;
    }
    onUpdate(patch);
  };

  const updateOption = (oi: number, val: string) => {
    const opts = [...(question.options || [])];
    opts[oi] = val;
    onUpdate({ options: opts });
  };

  const deleteOption = (oi: number) => {
    onUpdate({ options: (question.options || []).filter((_, i) => i !== oi) });
  };

  const addOption = () => {
    onUpdate({ options: [...(question.options || []), `옵션 ${(question.options?.length || 0) + 1}`] });
  };

  return (
    <div style={S.qCard}>
      {/* 좌측: 이동 버튼 */}
      <div style={S.qMove}>
        <button style={S.moveBtn} onClick={() => onMove('up')} disabled={index === 0}>▲</button>
        <span style={{ color: '#9ca3af', fontSize: 12 }}>⋮⋮</span>
        <button style={S.moveBtn} onClick={() => onMove('down')} disabled={index === total - 1}>▼</button>
      </div>

      {/* 중앙: 내용 */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* 질문 텍스트 */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ color: '#6b7280', fontSize: 13, fontWeight: 500 }}>Q{index + 1}.</span>
          <input
            style={{ ...S.input, flex: 1 }}
            value={question.question_text}
            onChange={e => onUpdate({ question_text: e.target.value })}
            placeholder="질문 내용을 입력하세요"
          />
        </div>

        {/* 타입 + 필수 */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <select
            style={{ ...S.input, width: 140 }}
            value={question.question_type}
            onChange={e => handleTypeChange(e.target.value as SurveyQuestionType)}
          >
            {QUESTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, cursor: 'pointer' }}>
            <input type="checkbox" checked={question.required} onChange={e => onUpdate({ required: e.target.checked })} />
            필수
          </label>
        </div>

        {/* 선택지 편집 */}
        {(question.question_type === 'single_choice' || question.question_type === 'multiple_choice') && (
          <div style={{ paddingLeft: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {question.options?.map((opt, oi) => (
              <div key={oi} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ color: '#9ca3af', fontSize: 12, minWidth: 20 }}>{oi + 1}.</span>
                <input
                  style={{ ...S.input, flex: 1 }}
                  value={opt}
                  onChange={e => updateOption(oi, e.target.value)}
                />
                {(question.options?.length || 0) > 2 && (
                  <button style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16 }} onClick={() => deleteOption(oi)}>×</button>
                )}
              </div>
            ))}
            <button style={S.addBtn} onClick={addOption}>+ 옵션 추가</button>
          </div>
        )}
      </div>

      {/* 우측: 삭제 */}
      <button style={S.deleteBtn} onClick={onDelete} title="질문 삭제">🗑️</button>
    </div>
  );
}

/* ===== 미리보기 ===== */
function PreviewMode({ name, description, questions }: { name: string; description: string; questions: SurveyQuestion[] }) {
  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <h3 style={{ fontSize: 18, fontWeight: 700 }}>{name || '(제목 없음)'}</h3>
        {description && <p style={{ color: '#6b7280', marginTop: 4 }}>{description}</p>}
      </div>
      {questions.map((q, i) => (
        <div key={q.id} style={{ background: '#f9fafb', borderRadius: 8, padding: 16, marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 4 }}>Q{i + 1}. {q.required && <span style={{ color: '#ef4444' }}>*</span>}</div>
          <div style={{ fontWeight: 500, marginBottom: 8 }}>{q.question_text || '(질문 없음)'}</div>
          {q.question_type === 'text' && (
            <div style={{ ...S.input, background: '#fff', color: '#9ca3af' }}>텍스트 입력란</div>
          )}
          {(q.question_type === 'single_choice' || q.question_type === 'multiple_choice') && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {q.options?.map((opt, oi) => (
                <label key={oi} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
                  <input type={q.question_type === 'single_choice' ? 'radio' : 'checkbox'} disabled />
                  {opt}
                </label>
              ))}
            </div>
          )}
          {q.question_type === 'scale' && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {[1, 2, 3, 4, 5].map(n => (
                <span key={n} style={{ width: 32, height: 32, borderRadius: '50%', border: '1px solid #d1d5db', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>{n}</span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ===== 스타일 ===== */
const S: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000,
  },
  modal: {
    background: '#fff', borderRadius: 12, width: 720, maxWidth: '95vw', maxHeight: '90vh',
    display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '14px 20px', borderBottom: '1px solid #e5e7eb',
  },
  title: { margin: 0, fontSize: 16, fontWeight: 700 },
  closeBtn: { background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#6b7280' },
  previewBtn: {
    padding: '5px 12px', borderRadius: 6, border: '1px solid #d1d5db',
    background: '#f9fafb', fontSize: 13, cursor: 'pointer',
  },
  body: { flex: 1, overflowY: 'auto' as const, padding: 20 },
  footer: {
    display: 'flex', justifyContent: 'flex-end', gap: 8,
    padding: '12px 20px', borderTop: '1px solid #e5e7eb', background: '#f9fafb',
  },
  field: { marginBottom: 14 },
  label: { display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 5 },
  input: {
    padding: '7px 12px', borderRadius: 6, border: '1px solid #d1d5db',
    fontSize: 14, width: '100%', boxSizing: 'border-box' as const, outline: 'none',
  },
  radioLabel: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' },
  hint: { fontSize: 12, color: '#9ca3af', marginTop: 4 },
  addBtn: {
    background: 'none', border: 'none', color: '#3b82f6', fontSize: 13,
    cursor: 'pointer', padding: 0, fontWeight: 500,
  },
  emptyBox: {
    textAlign: 'center' as const, padding: 32, border: '2px dashed #d1d5db',
    borderRadius: 8, color: '#9ca3af',
  },
  cancelBtn: {
    padding: '8px 16px', borderRadius: 6, border: '1px solid #d1d5db',
    background: '#fff', cursor: 'pointer', fontSize: 13,
  },
  saveBtn: {
    padding: '8px 20px', borderRadius: 6, border: 'none',
    background: '#3b82f6', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600,
  },
  qCard: {
    display: 'flex', gap: 8, padding: 14, border: '1px solid #e5e7eb',
    borderRadius: 8, background: '#f9fafb',
  },
  qMove: {
    display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 2, paddingTop: 4,
  },
  moveBtn: {
    background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af',
    fontSize: 11, padding: '2px 4px',
  },
  deleteBtn: {
    background: 'none', border: 'none', cursor: 'pointer', fontSize: 16,
    padding: '4px', alignSelf: 'flex-start' as const,
  },
};
