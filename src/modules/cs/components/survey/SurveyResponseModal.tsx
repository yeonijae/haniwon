/**
 * 설문 응답 상세 보기 모달
 * - 전체 보기 / 답변 모아보기 토글
 * - 답변 복사하기 (문진 텍스트)
 * gosibang ResponseViewerModal 참고
 */
import React, { useState } from 'react';
import type { SurveyTemplate, SurveyAnswer, SurveySession } from '../../types';

interface SurveyResponseModalProps {
  session: SurveySession;
  answers: SurveyAnswer[];
  template: SurveyTemplate;
  onClose: () => void;
}

export default function SurveyResponseModal({ session, answers, template, onClose }: SurveyResponseModalProps) {
  const [viewMode, setViewMode] = useState<'full' | 'summary'>('summary');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set(template.questions.map(q => q.id)));
  const [copied, setCopied] = useState(false);

  const getAnswer = (qId: string): SurveyAnswer | undefined => answers.find(a => a.question_id === qId);

  const fmtAnswer = (a: SurveyAnswer | undefined): string => {
    if (!a) return '(답변 없음)';
    if (Array.isArray(a.answer)) return a.answer.join(', ') || '(선택 없음)';
    return String(a.answer || '(답변 없음)');
  };

  const hasAnswer = (qId: string): boolean => {
    const a = getAnswer(qId);
    if (!a) return false;
    if (Array.isArray(a.answer)) return a.answer.length > 0;
    return !!a.answer;
  };

  const toggle = (id: string) => {
    const s = new Set(expandedIds);
    s.has(id) ? s.delete(id) : s.add(id);
    setExpandedIds(s);
  };

  // 문진 텍스트 생성 (gosibang 로직)
  const formatText = (): string => {
    const ga = (qId: string) => {
      const a = getAnswer(qId);
      if (!a) return '';
      if (Array.isArray(a.answer)) return a.answer.join(' / ');
      return String(a.answer || '');
    };

    const lines: string[] = [];
    let currentSection = '';

    for (const q of template.questions) {
      if (!hasAnswer(q.id)) continue;
      const txt = ga(q.id);

      // 기본정보 스킵
      if (['name', 'chart_number', 'doctor'].includes(q.id)) continue;
      if (['gender_age', 'height_weight'].includes(q.id)) continue;

      // 섹션 헤더
      if (q.question_text.startsWith('>')) {
        if (lines.length > 0 && currentSection) lines.push('');
        currentSection = q.question_text;
        lines.push(`${q.question_text} ${txt}`);
      } else if (q.question_text.startsWith('-')) {
        lines.push(`${q.question_text} ${txt}`);
      } else {
        lines.push(`${q.question_text}: ${txt}`);
      }
    }

    const result: string[] = [];
    // 세션 정보에서 기본정보 구성
    const nameLine = [session.patient_name, session.chart_number ? `(${session.chart_number})` : ''].filter(Boolean).join(' ');
    if (nameLine) result.push(nameLine);
    const genderAge = [
      session.gender ? (session.gender === 'M' ? '남' : session.gender === 'F' ? '여' : session.gender) : '',
      session.age != null ? `${session.age}세` : '',
    ].filter(Boolean).join('/');
    const heightWeight = ga('height_weight');
    const basicInfo = [genderAge, heightWeight].filter(Boolean).join(' / ');
    if (basicInfo) result.push(basicInfo);
    if (lines.length > 0) { result.push('[문진]'); result.push(...lines); }

    return result.join('\n');
  };

  const handleCopy = async () => {
    const text = formatText();
    try {
      // HTTPS/localhost에서만 동작
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      // HTTP fallback: textarea + execCommand
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
      } catch { alert('복사에 실패했습니다.'); }
    }
    if (setCopied) setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={e => e.stopPropagation()}>
        {/* 헤더 */}
        <div style={S.header}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{template.name}</h3>
            <p style={{ margin: '2px 0 0', fontSize: 13, color: '#64748b' }}>
              {session.patient_name || '-'}{session.chart_number ? ` (${session.chart_number})` : ''} · {session.completed_at ? new Date(session.completed_at).toLocaleString('ko-KR') : ''}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* 뷰 모드 토글 */}
            <div style={S.toggleWrap}>
              <button style={{ ...S.toggleBtn, ...(viewMode === 'full' ? S.toggleActive : {}) }} onClick={() => setViewMode('full')}>전체 보기</button>
              <button style={{ ...S.toggleBtn, ...(viewMode === 'summary' ? S.toggleActive : {}) }} onClick={() => setViewMode('summary')}>답변 모아보기</button>
            </div>
            <button style={S.closeBtn} onClick={onClose}>✕</button>
          </div>
        </div>

        {/* 본문 */}
        <div style={S.body}>
          {viewMode === 'summary' ? (
            /* 답변 모아보기: 문진 텍스트 */
            <div style={S.summaryBox}>
              {formatText() || '(답변 없음)'}
            </div>
          ) : (
            /* 전체 보기: 질문별 아코디언 */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {template.questions.map((q, i) => {
                const answer = getAnswer(q.id);
                const expanded = expandedIds.has(q.id);
                return (
                  <div key={q.id} style={S.qCard}>
                    <button style={S.qHeader} onClick={() => toggle(q.id)}>
                      <div style={{ flex: 1 }}>
                        <span style={{ color: '#94a3b8', fontSize: 12, marginRight: 6 }}>Q{i + 1}.</span>
                        <span style={{ fontWeight: 500, fontSize: 14 }}>{q.question_text}</span>
                      </div>
                      <span style={{ color: '#94a3b8', fontSize: 12 }}>{expanded ? '▲' : '▼'}</span>
                    </button>
                    {expanded && (
                      <div style={S.qBody}>
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

        {/* 푸터 */}
        <div style={S.footer}>
          <button style={{ ...S.copyBtn, ...(copied ? { background: '#dcfce7', color: '#16a34a', borderColor: '#86efac' } : {}) }} onClick={handleCopy}>
            {copied ? '✅ 복사됨' : '📋 답변 복사'}
          </button>
          <button style={S.cancelBtn} onClick={onClose}>닫기</button>
        </div>
      </div>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 },
  modal: { background: '#fff', borderRadius: 12, width: 680, maxWidth: '95vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' },
  header: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid #e5e7eb' },
  closeBtn: { background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#94a3b8' },
  toggleWrap: { display: 'flex', background: '#f1f5f9', borderRadius: 6, padding: 2 },
  toggleBtn: { padding: '4px 12px', borderRadius: 4, border: 'none', background: 'transparent', fontSize: 12, cursor: 'pointer', color: '#64748b', fontWeight: 500 },
  toggleActive: { background: '#fff', color: '#1e293b', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' },
  body: { flex: 1, overflowY: 'auto' as const, padding: 20 },
  summaryBox: { background: '#f8fafc', borderRadius: 8, padding: 16, fontFamily: 'monospace', fontSize: 13, whiteSpace: 'pre-wrap' as const, lineHeight: 1.7, color: '#334155' },
  qCard: { border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' },
  qHeader: { width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#f8fafc', border: 'none', cursor: 'pointer', textAlign: 'left' as const },
  qBody: { padding: '10px 14px', background: '#fff' },
  footer: { display: 'flex', justifyContent: 'space-between', padding: '12px 20px', borderTop: '1px solid #e5e7eb', background: '#f9fafb' },
  copyBtn: { padding: '7px 16px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 500 },
  cancelBtn: { padding: '7px 16px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontSize: 13 },
};
