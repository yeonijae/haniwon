import React, { useState } from 'react';
import type { ContactLog } from '../../types/crm';
import { deleteContactLog } from '../../lib/contactLogApi';

interface PatientInquirySectionProps {
  contactLogs: ContactLog[];
  patientName?: string;
  isLoading: boolean;
  onRefresh?: () => void;
  onEditLog?: (log: ContactLog) => void;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const y = String(d.getFullYear()).slice(2);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${y}/${m}/${day} ${h}:${min}`;
}

function stripMeta(raw: string | null): string {
  if (!raw) return '';
  const lines = raw.split('\n');
  const body = lines.filter(l => !l.match(/^(발생:|담당:|응답:|응답자:)/)).map(l => l.replace('[처리완료]', '').trim()).filter(Boolean);
  return body.join('\n');
}

// 대화 메시지를 개별 말풍선으로 분리
type ChatBubble = { sender: string; time: string; text: string };
function parseIntoBubbles(raw: string): ChatBubble[] {
  if (!raw) return [];

  // JSON 배열 형태인지 확인
  const trimmed = raw.trim();
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      const arr = JSON.parse(trimmed) as Array<{ s: string; t: string; m: string }>;
      if (Array.isArray(arr) && arr.length > 0 && typeof arr[0].m === 'string') {
        return arr.map(item => ({ sender: item.s || '', time: item.t || '', text: item.m || '' }));
      }
    } catch { /* not JSON, fall through */ }
  }

  // 레거시: "[이름 시간] 내용" 패턴
  const stripped = stripMeta(raw);
  if (!stripped) return [];

  const parts = stripped.split(/(?=\[.+?\])/);
  const bubbles: ChatBubble[] = [];

  for (const part of parts) {
    const t = part.trim();
    if (!t) continue;
    const match = t.match(/^\[(.+?)\s+(오[전후]\s?\d{1,2}:\d{2})\]\s*(.*)$/s);
    if (match) { bubbles.push({ sender: match[1], time: match[2], text: match[3].trim() }); continue; }
    const nameOnly = t.match(/^\[(.+?)\]\s*(.*)$/s);
    if (nameOnly) { bubbles.push({ sender: nameOnly[1], time: '', text: nameOnly[2].trim() }); continue; }
    if (bubbles.length > 0) { bubbles[bubbles.length - 1].text += '\n' + t; }
    else { bubbles.push({ sender: '', time: '', text: t }); }
  }

  // 패턴 없는 일반 텍스트 → 하나의 말풍선
  if (bubbles.length === 0 && stripped) {
    bubbles.push({ sender: '', time: '', text: stripped });
  }
  return bubbles;
}

const PatientInquirySection: React.FC<PatientInquirySectionProps> = ({
  contactLogs,
  patientName,
  isLoading,
  onRefresh,
  onEditLog,
}) => {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const handleDelete = async (log: ContactLog) => {
    if (!confirm('이 인콜 기록을 삭제하시겠습니까?')) return;
    try {
      await deleteContactLog(log.id);
      onRefresh?.();
    } catch { alert('삭제에 실패했습니다.'); }
  };

  if (isLoading) return <div className="section-loading">로딩 중...</div>;

  // 환자 vs 직원 구분: 첫 발신자 = 환자
  function isPatientBubble(bubble: ChatBubble, log: ContactLog, allBubbles: ChatBubble[]): boolean {
    if (!bubble.sender) return true;
    // JSON 대화: 첫 번째 발신자 = 환자
    const firstSender = allBubbles[0]?.sender;
    if (firstSender && bubble.sender === firstSender) return true;
    if (firstSender && bubble.sender !== firstSender) return false;
    // fallback
    const staff = log.created_by || '';
    if (staff && bubble.sender.includes(staff)) return false;
    if (/원장|선생|김대현|강희종|임세열|전인태/.test(bubble.sender)) return false;
    return true;
  }

  const OUTBOUND_CALL_TYPES = new Set(['delivery_call','visit_call','after_call','unconsumed','vip_care','churn_risk_1','churn_risk_3','repayment_consult','remind_3month','expiry_warning']);

  const CALL_TYPE_LABELS: Record<string, string> = {
    delivery_call: '배송콜', visit_call: '내원콜', after_call: '애프터콜',
    unconsumed: '미복용', vip_care: 'VIP관리', churn_risk_1: '이탈위험',
    churn_risk_3: '재방문유도', repayment_consult: '재결제상담',
    remind_3month: '리마인드', expiry_warning: '유효기간임박',
  };

  function isOutboundLog(log: ContactLog): boolean {
    return log.direction === 'outbound' || OUTBOUND_CALL_TYPES.has(log.contact_type);
  }

  // result 메타 파싱 (아웃콜용)
  function parseMeta(result: string | null): Record<string, string> {
    if (!result) return {};
    // 메타 형식: "콜종류:배송콜|약종류:자보약|사유:..."
    if (!result.includes(':')) return {};
    const meta: Record<string, string> = {};
    result.split('|').forEach(part => {
      const idx = part.indexOf(':');
      if (idx > 0) meta[part.slice(0, idx).trim()] = part.slice(idx + 1).trim();
    });
    return meta;
  }

  // 아웃콜 카드 렌더
  function renderOutboundCard(log: ContactLog) {
    const meta = parseMeta(log.result);
    const callType = meta['콜종류'] || CALL_TYPE_LABELS[log.contact_type] || '';
    const herbalName = meta['약종류'] || '';
    const reason = meta['사유'] || '';
    return (
      <div key={log.id} className="cl-card cl-outbound-card">
        <div className="cl-card-actions">
          {onEditLog && <button className="cl-action-btn" onClick={e => { e.stopPropagation(); onEditLog(log); }} title="수정"><i className="fa-solid fa-pen" /></button>}
          <button className="cl-action-btn delete" onClick={e => { e.stopPropagation(); handleDelete(log); }} title="삭제"><i className="fa-solid fa-trash" /></button>
        </div>
        <div className="cl-outbound-row1">
          <span className="cl-outbound-dt">{formatDate(log.created_at)}</span>
          {callType && <span className="cl-outbound-badge call">{callType}</span>}
          {herbalName && <span className="cl-outbound-badge herbal">{herbalName}</span>}
          {reason && <span className="cl-outbound-reason">{reason}</span>}
          {!reason && !callType && log.content && <span className="cl-outbound-reason">{log.content.split('\n')[0]}</span>}
          <span className="cl-outbound-by">{log.created_by || ''}</span>
        </div>
        {log.content && (
          <div className="cl-outbound-memos">
            {log.content.split('\n').filter(Boolean).map((line, i) => (
              <div key={i} className="cl-outbound-memo-line">{line}</div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="dashboard-section-content">
      {contactLogs.length === 0 ? (
        <div className="section-empty">응대 기록이 없습니다.</div>
      ) : (
        <div className="cl-list">
          {contactLogs.slice(0, 15).map(log => {
            // 아웃콜은 카드 형태
            if (isOutboundLog(log)) return renderOutboundCard(log);
            const isExpanded = expandedId === log.id;
            // JSON이면 content에 전체 대화, 아니면 문의+응답 합침
            const isJson = log.content?.trim().startsWith('[');
            let allBubbles: ChatBubble[];
            if (isJson) {
              allBubbles = parseIntoBubbles(log.content);
            } else {
              const contentBubbles = parseIntoBubbles(log.content);
              // result에서 응답자 이름 추출
              const resultText = stripMeta(log.result);
              const responderMatch = (log.result || '').match(/응답자:\s*([^|\n]+)/);
              const responderName = responderMatch?.[1]?.trim() || '';
              const responseTimeMatch = (log.result || '').match(/응답:\s*(\d{4}-\d{2}-\d{2}\s*\d{2}:\d{2})/);
              const responseTime = responseTimeMatch?.[1]?.trim() || '';
              const resultBubbles = resultText ? [{ sender: responderName || (log.created_by || '담당'), time: responseTime, text: resultText }] : [];
              // 문의 말풍선에 환자 이름 세팅
              contentBubbles.forEach(b => { if (!b.sender) b.sender = patientName || '환자'; });
              allBubbles = [...contentBubbles, ...resultBubbles];
            }
            // 말풍선 없으면 스킵
            if (allBubbles.length === 0) return null;
            // 접힌 상태: 처음 2개만
            const visibleBubbles = isExpanded ? allBubbles : allBubbles.slice(0, 2);
            const hasMore = allBubbles.length > 2;

            return (
              <div key={log.id} className={`cl-card${isExpanded ? ' expanded' : ''}`}
                onClick={() => setExpandedId(isExpanded ? null : log.id)}>
                <div className="cl-card-actions">
                  {onEditLog && <button className="cl-action-btn" onClick={e => { e.stopPropagation(); onEditLog(log); }} title="수정"><i className="fa-solid fa-pen" /></button>}
                  <button className="cl-action-btn delete" onClick={e => { e.stopPropagation(); handleDelete(log); }} title="삭제"><i className="fa-solid fa-trash" /></button>
                </div>
                <div className="cl-date-line">
                  <span className={`cl-ch-badge ${log.channel || 'phone'}`}>{({'phone':'📞','kakao':'💬','sms':'✉️','visit':'🏥','naver':'🟢','homepage':'🌐'}[log.channel] || '📞')}</span>
                  {formatDate(log.created_at)}
                </div>
                <div className="cl-chat">
                  {visibleBubbles.map((b, i) => {
                    const isPatient = isPatientBubble(b, log, allBubbles);
                    return (
                      <div key={i} className={`cl-bubble ${isPatient ? 'question' : 'answer'}`}>
                        <div className="cl-bubble-meta">{b.sender || (isPatient ? (patientName || '환자') : (log.created_by || '담당'))} {b.time}</div>
                        <div className={`cl-bubble-text${isExpanded ? ' expanded' : ''}`}>{b.text}</div>
                      </div>
                    );
                  })}
                </div>
                {!isExpanded && hasMore && (
                  <div className="cl-more">+ {allBubbles.length - 2}개 더보기</div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <style>{`
        .cl-list { display: flex; flex-direction: column; gap: 6px; }
        .cl-card {
          padding: 8px 12px;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          position: relative;
          cursor: pointer;
          transition: border-color 0.15s;
        }
        .cl-card:hover { border-color: #d1d5db; }
        .cl-card.expanded { border-color: #93c5fd; background: #fafbff; }
        .cl-date-line {
          font-size: 10px; color: #9ca3af; margin-bottom: 4px;
          display: flex; align-items: center; gap: 4px;
        }
        .cl-ch-badge {
          font-size: 12px; line-height: 1;
        }
        .cl-card-actions {
          display: none;
          position: absolute;
          top: 6px; right: 6px;
          gap: 4px;
          z-index: 1;
        }
        .cl-card:hover .cl-card-actions { display: flex; }
        .cl-action-btn {
          width: 24px; height: 24px;
          border: 1px solid #d1d5db; border-radius: 6px;
          background: #fff; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          font-size: 11px; color: #6b7280;
        }
        .cl-action-btn:hover { background: #f3f4f6; }
        .cl-action-btn.delete:hover { background: #fef2f2; color: #dc2626; border-color: #fca5a5; }
        .cl-chat { display: flex; flex-direction: column; gap: 4px; }
        .cl-bubble {
          display: flex; flex-direction: column;
          padding: 6px 10px; border-radius: 10px;
          font-size: 14px; line-height: 1.4;
          max-width: 85%;
        }
        .cl-bubble.question {
          background: #fff3cd; align-self: flex-start;
          border-bottom-left-radius: 2px;
        }
        .cl-bubble.answer {
          background: #d1ecf1; align-self: flex-end;
          border-bottom-right-radius: 2px;
        }
        .cl-card.expanded .cl-bubble { max-width: 100%; }
        .cl-bubble-meta {
          font-size: 10px; font-weight: 600; color: #6b7280;
          margin-bottom: 2px;
        }
        .cl-bubble-text {
          overflow: hidden; text-overflow: ellipsis;
          display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
          white-space: pre-wrap;
        }
        .cl-bubble-text.expanded {
          -webkit-line-clamp: unset;
          display: block;
        }
        .cl-more {
          text-align: center; font-size: 11px; color: #6b7280;
          margin-top: 4px; padding: 2px 0;
        }
        /* 아웃콜 카드 */
        .cl-outbound-card {
          background: #f0f9ff;
          cursor: default;
        }
        .cl-outbound-card:hover { border-color: #93c5fd; }
        .cl-outbound-row1 {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
          margin-bottom: 4px;
        }
        .cl-outbound-dt {
          font-size: 11px;
          color: #9ca3af;
          white-space: nowrap;
        }
        .cl-outbound-badge {
          font-size: 11px;
          padding: 2px 7px;
          border-radius: 8px;
          font-weight: 500;
          white-space: nowrap;
        }
        .cl-outbound-badge.call {
          background: #dbeafe;
          color: #1e40af;
        }
        .cl-outbound-badge.herbal {
          background: #f3e8ff;
          color: #7c3aed;
        }
        .cl-outbound-reason {
          font-size: 13px;
          color: #374151;
          flex: 1;
        }
        .cl-outbound-by {
          font-size: 11px;
          color: #6b7280;
          margin-left: auto;
          white-space: nowrap;
        }
        .cl-outbound-memos {
          background: #fffbeb;
          border-radius: 6px;
          padding: 6px 8px;
        }
        .cl-outbound-memo-line {
          font-size: 13px;
          color: #374151;
          line-height: 1.5;
          white-space: pre-wrap;
          word-break: break-word;
        }
      `}</style>
    </div>
  );
};

export default PatientInquirySection;
