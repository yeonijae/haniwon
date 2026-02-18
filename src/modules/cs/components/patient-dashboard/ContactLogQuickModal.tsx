import React, { useState } from 'react';
import { createContactLog, updateContactLog, deleteContactLog } from '../../lib/contactLogApi';
import type { ContactLog } from '../../types/crm';

interface ContactLogQuickModalProps {
  patientId: number;
  patientName?: string;
  defaultCreatedBy?: string;
  editLog?: ContactLog | null;
  readOnly?: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const CHANNELS = [
  { value: 'phone', label: '전화' },
  { value: 'kakao', label: '카톡' },
  { value: 'sms', label: '문자' },
  { value: 'visit', label: '방문' },
  { value: 'naver', label: '네이버' },
  { value: 'homepage', label: '홈페이지' },
] as const;

const CONTACT_TYPES = [
  { value: 'inquiry', label: '문의' },
  { value: 'reservation', label: '예약' },
  { value: 'complaint', label: '불만' },
  { value: 'other', label: '기타' },
] as const;

function nowDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function nowTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

export default function ContactLogQuickModal({ patientId, patientName, defaultCreatedBy, editLog, readOnly: initReadOnly, onClose, onSuccess }: ContactLogQuickModalProps) {
  const [isReadOnly, setIsReadOnly] = useState(!!initReadOnly);

  // editLog에서 content/result 파싱 (발생: YYYY-MM-DD HH:MM | 담당: xxx\n실제내용)
  function parseLogContent(raw: string | null) {
    if (!raw) return { meta: '', body: '' };
    const lines = raw.split('\n');
    if (lines[0]?.startsWith('발생:') || lines[0]?.includes('담당:')) {
      return { meta: lines[0], body: lines.slice(1).join('\n') };
    }
    return { meta: '', body: raw };
  }
  function parseLogResult(raw: string | null) {
    if (!raw) return { meta: '', body: '', done: false };
    const lines = raw.split('\n');
    const done = raw.includes('[처리완료]');
    const cleaned = lines.map(l => l.replace('[처리완료]', '').trim()).filter(Boolean);
    if (cleaned[0]?.startsWith('응답:') || cleaned[0]?.includes('응답자:')) {
      return { meta: cleaned[0], body: cleaned.slice(1).join('\n'), done };
    }
    return { meta: '', body: cleaned.join('\n'), done };
  }

  const parsedContent = editLog ? parseLogContent(editLog.content) : null;
  const parsedResult = editLog ? parseLogResult(editLog.result) : null;

  // 발생일시 파싱
  function parseDateTime(meta: string, field: string) {
    const match = meta.match(new RegExp(`${field}:\\s*(\\d{4}-\\d{2}-\\d{2})\\s+(\\d{2}:\\d{2})`));
    return match ? { date: match[1], time: match[2] } : null;
  }
  function parseField(meta: string, field: string) {
    const match = meta.match(new RegExp(`${field}:\\s*([^|]+)`));
    return match ? match[1].trim() : '';
  }

  const initOccur = parsedContent ? parseDateTime(parsedContent.meta, '발생') : null;
  const initHandler = parsedContent ? parseField(parsedContent.meta, '담당') : '';
  const initResOccur = parsedResult ? parseDateTime(parsedResult.meta, '응답') : null;
  const initResponder = parsedResult ? parseField(parsedResult.meta, '응답자') : '';

  const [channel, setChannel] = useState<string>(editLog?.channel || 'phone');
  const editLogDate = (() => {
    if (!editLog?.created_at) return null;
    const d = new Date(editLog.created_at);
    if (isNaN(d.getTime())) return null;
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return { date: `${yyyy}-${mm}-${dd}`, time: `${hh}:${min}` };
  })();
  const [occurDate, setOccurDate] = useState(initOccur?.date || editLogDate?.date || nowDate());
  const [occurTime, setOccurTime] = useState(initOccur?.time || editLogDate?.time || nowTime());
  const [handler, setHandler] = useState(initHandler || editLog?.created_by || defaultCreatedBy || '');
  // JSON 또는 레거시 [이름 시간] 대화 감지
  const initIsChat = (() => {
    const raw = (editLog?.content || '').trim();
    // JSON 배열
    if (raw.startsWith('[')) {
      try {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr) && arr.length > 0 && typeof arr[0].m === 'string') return 'json';
      } catch { /* not JSON */ }
    }
    // 레거시: [이름 시간] 패턴이 2개 이상
    const bracketMatches = raw.match(/\[.+?\s+오[전후]\s?\d{1,2}:\d{2}\]/g);
    if (bracketMatches && bracketMatches.length >= 2) return 'legacy';
    return false;
  })();
  const initChatMessages = (() => {
    if (!initIsChat) return [] as Array<{ s: string; t: string; m: string }>;
    const raw = (editLog?.content || '').trim();
    if (initIsChat === 'json') {
      try { return JSON.parse(raw) as Array<{ s: string; t: string; m: string }>; } catch { return []; }
    }
    // 레거시 파싱: content + result 합쳐서 파싱
    const combined = [raw, (editLog?.result || '').replace('[처리완료]', '').trim()].filter(Boolean).join('\n');
    const parts = combined.split(/(?=\[.+?\])/);
    const msgs: Array<{ s: string; t: string; m: string }> = [];
    for (const part of parts) {
      const t = part.trim();
      if (!t) continue;
      const match = t.match(/^\[(.+?)\s+(오[전후]\s?\d{1,2}:\d{2})\]\s*(.*)$/s);
      if (match) { msgs.push({ s: match[1], t: match[2], m: match[3].trim() }); continue; }
      const nameOnly = t.match(/^\[(.+?)\]\s*(.*)$/s);
      if (nameOnly) { msgs.push({ s: nameOnly[1], t: '', m: nameOnly[2].trim() }); continue; }
      if (msgs.length > 0) msgs[msgs.length - 1].m += '\n' + t;
    }
    return msgs;
  })();

  const [chatMode, setChatMode] = useState(!!initIsChat);
  const [chatMessages, setChatMessages] = useState(initChatMessages);
  const [content, setContent] = useState(initIsChat ? '' : (parsedContent?.body || ''));
  const [responder, setResponder] = useState(initResponder || '');
  // 레거시 대화 모드: result가 대화에 합쳐졌으므로 메모는 빈값
  const [result, setResult] = useState(initIsChat === 'legacy' ? '' : (parsedResult?.body || ''));
  const [resultDate, setResultDate] = useState(initResOccur?.date || '');
  const [resultTime, setResultTime] = useState(initResOccur?.time || '');
  const [isDone, setIsDone] = useState(parsedResult?.done || false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [chatPaste, setChatPaste] = useState('');
  const [showChatPaste, setShowChatPaste] = useState(false);
  const [editingChat, setEditingChat] = useState(false);

  const isDirty = chatMode ? chatMessages.length > 0 || result.trim() !== '' : content.trim() !== '' || result.trim() !== '' || responder !== '';

  const handleClose = () => {
    if (isDirty && !confirm('작성 중인 내용이 있습니다. 닫으시겠습니까?')) return;
    onClose();
  };

  const handleSave = async () => {
    // 대화 편집 중이면 자동 적용
    let saveChatMessages = chatMessages;
    if (showChatPaste && chatPaste.trim()) {
      const parsed = parseChatText(chatPaste);
      if (parsed.length > 0) {
        saveChatMessages = parsed.map(msg => ({ s: msg.sender, t: msg.time || '', m: msg.text }));
        setChatMessages(saveChatMessages);
        setChatMode(true);
        setShowChatPaste(false);
      }
    }
    const isChatSave = chatMode || (showChatPaste && saveChatMessages.length > 0);
    if (!isChatSave && !content.trim()) { alert('문의 내용을 입력해주세요.'); return; }
    if (isChatSave && saveChatMessages.length === 0) { alert('대화 내용이 없습니다.'); return; }
    setIsSaving(true);
    try {
      let fullContent = '';
      if (isChatSave) {
        fullContent = JSON.stringify(saveChatMessages);
      } else {
        fullContent = content.trim();
      }

      // 단건 모드: 응답 메타 정보를 result에 포함
      let fullResult = '';
      if (isChatSave) {
        fullResult = [result.trim(), isDone ? '[처리완료]' : ''].filter(Boolean).join('\n');
      } else {
        const resMeta = [
          responder ? `응답자: ${responder}` : '',
          resultDate ? `응답: ${resultDate}${resultTime ? ' ' + resultTime : ''}` : '',
        ].filter(Boolean).join(' | ');
        fullResult = [resMeta, result.trim(), isDone ? '[처리완료]' : ''].filter(Boolean).join('\n');
      }

      if (editLog?.id) {
        await updateContactLog(editLog.id, {
          channel: channel as any,
          content: fullContent,
          result: fullResult.trim() || '',
          created_by: handler || defaultCreatedBy,
        });
      } else {
        await createContactLog({
          patient_id: patientId,
          direction: 'inbound',
          channel: channel as any,
          contact_type: 'inquiry' as any,
          content: fullContent,
          result: fullResult.trim() || undefined,
          created_by: handler || defaultCreatedBy,
        });
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('인콜 기록 저장 오류:', err);
      alert(`저장에 실패했습니다.\n${err?.message || err}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editLog) return;
    if (!confirm('이 인콜 기록을 삭제하시겠습니까?')) return;
    setIsDeleting(true);
    try {
      await deleteContactLog(editLog.id);
      onSuccess();
      onClose();
    } catch (err) {
      alert('삭제에 실패했습니다.');
    } finally {
      setIsDeleting(false);
    }
  };

  // 카톡 대화 파싱
  type ChatMsg = { sender: string; text: string; time?: string };
  function parseChatText(raw: string): ChatMsg[] {
    // [이름 시간] 내용 형식 감지 — 이미 정리된 형태
    const bracketPattern = /\[(.+?)\s+(오[전후]\s?\d{1,2}:\d{2})\]\s*/g;
    if (bracketPattern.test(raw)) {
      const msgs: ChatMsg[] = [];
      const parts = raw.split(/(?=\[.+?\s+오[전후]\s?\d{1,2}:\d{2}\])/);
      for (const part of parts) {
        const t = part.trim();
        if (!t) continue;
        const m = t.match(/^\[(.+?)\s+(오[전후]\s?\d{1,2}:\d{2})\]\s*(.*)$/s);
        if (m) { msgs.push({ sender: m[1], time: m[2], text: m[3].trim() }); }
        else if (msgs.length > 0) { msgs[msgs.length - 1].text += '\n' + t; }
      }
      return msgs;
    }

    const msgs: ChatMsg[] = [];
    let mySender = '';

    // 전처리: "님이 보냄"에서 내 이름 추출
    const senderMatch = raw.match(/([가-힣a-zA-Z0-9]+)님이 보냄/);
    if (senderMatch) mySender = senderMatch[1];

    // 노이즈 제거
    let cleaned = raw
      .replace(/프로필 사진\s*/g, '')
      .replace(/보낸 메시지 가이드\s*/g, '')
      .replace(/[가-힣a-zA-Z0-9]+님이 보냄\s*/g, `\n__MY_MSG__\n`)
      .replace(/ⓘ/g, '');

    // 시간 패턴을 메시지 구분자로 활용: "오후 08:22" 또는 "오후08:22"
    // 시간 뒤에 줄바꿈 삽입
    cleaned = cleaned.replace(/(오[전후]\s?\d{1,2}:\d{2})/g, '\n__TIME__$1\n');

    const lines = cleaned.split('\n').map(l => l.trim()).filter(Boolean);

    let currentSender = '';
    let currentTime = '';
    let currentText = '';
    let nextIsMine = false;

    const flush = () => {
      if (currentText.trim() && currentSender) {
        msgs.push({ sender: currentSender, text: currentText.trim(), time: currentTime || undefined });
      }
      currentText = '';
      currentTime = '';
    };

    for (const line of lines) {
      // 시간 마커
      if (line.startsWith('__TIME__')) {
        const time = line.replace('__TIME__', '').trim();
        // 시간은 이전 메시지의 끝 → flush
        if (currentText.trim()) {
          currentTime = time;
          flush();
        } else {
          currentTime = time;
        }
        continue;
      }

      // 내 메시지 마커
      if (line === '__MY_MSG__') {
        flush();
        nextIsMine = true;
        currentSender = mySender || '나';
        continue;
      }

      // 이름만 있는 줄 (2-4글자 한글, 단독)
      if (/^[가-힣]{2,4}$/.test(line)) {
        flush();
        currentSender = line;
        nextIsMine = false;
        continue;
      }

      // 카톡 내보내기: [이름] [시간] 내용
      const exportMatch = line.match(/^\[(.+?)\]\s*\[(.+?)\]\s*(.+)$/);
      if (exportMatch) {
        flush();
        msgs.push({ sender: exportMatch[1], time: exportMatch[2], text: exportMatch[3] });
        continue;
      }

      // "이름 : 내용"
      const colonMatch = line.match(/^([가-힣a-zA-Z]{2,10})\s*[:：]\s*(.+)$/);
      if (colonMatch) {
        flush();
        currentSender = colonMatch[1];
        currentText = colonMatch[2];
        nextIsMine = false;
        continue;
      }

      // 일반 텍스트: 현재 발신자에 이어붙이기
      if (!currentSender && !nextIsMine) {
        // 첫 줄이 "이름 내용" 형태인지 체크
        const nameStart = line.match(/^([가-힣]{2,4})\s+(.{2,})$/);
        if (nameStart) {
          currentSender = nameStart[1];
          currentText = nameStart[2];
          continue;
        }
      }

      if (currentSender || nextIsMine) {
        if (nextIsMine && !currentSender) currentSender = mySender || '나';
        currentText += (currentText ? '\n' : '') + line;
        nextIsMine = false;
      } else {
        currentText += (currentText ? '\n' : '') + line;
      }
    }
    flush();

    return msgs;
  }

  const parsedChat = showChatPaste && chatPaste.trim() ? parseChatText(chatPaste) : [];

  // 대화 적용: chatMode로 전환
  const applyChatToFields = () => {
    if (parsedChat.length === 0) return;
    const msgs = parsedChat.map(msg => ({ s: msg.sender, t: msg.time || '', m: msg.text }));
    setChatMessages(msgs);
    setChatMode(true);
    setShowChatPaste(false);
    setEditingChat(false);
    // 응답자 자동 설정
    const firstSender = parsedChat[0].sender;
    const responderMsg = parsedChat.find(m => m.sender !== firstSender);
    if (responderMsg && !responder) setResponder(responderMsg.sender);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      (e.nativeEvent as any).stopImmediatePropagation?.();
      handleClose();
    }
  };

  return (
    <div className="pkg-modal-overlay" onKeyDown={handleKeyDown} tabIndex={-1}>
      <div className="herbal-consult-modal" style={{ maxWidth: 520, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
        <div className="pkg-modal-header">
          <h3>{editLog ? (isReadOnly ? '인콜 상세' : '인콜 수정') : '인콜 기록'}{patientName ? ` — ${patientName}` : ''}</h3>
          <button className="pkg-modal-close-btn" onClick={handleClose}>×</button>
        </div>

        <div className="cl-modal-body">
          <div className="cl-row">
            <label className="cl-label">채널</label>
            <div className="cl-chips">
              {CHANNELS.map(ch => (
                <button key={ch.value} type="button" className={`cl-chip${channel === ch.value ? ' active' : ''}`} onClick={() => setChannel(ch.value)}>{ch.label}</button>
              ))}
            </div>
          </div>

          {/* 대화 붙여넣기 토글 */}
          {channel === 'kakao' && (
            <div className="cl-row">
              <label className="cl-label"></label>
              <button
                type="button"
                className={`cl-chip${showChatPaste ? ' active' : ''}`}
                onClick={() => setShowChatPaste(!showChatPaste)}
                style={{ fontSize: 12 }}
              >💬 대화 붙여넣기</button>
            </div>
          )}

          {/* 대화 붙여넣기 영역 */}
          {showChatPaste && (
            <div style={{ margin: '0 0 12px', padding: 12, background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
              <textarea
                value={chatPaste}
                onChange={e => setChatPaste(e.target.value)}
                placeholder={'카톡 대화를 붙여넣으세요.\n예) 석지윤 : 안녕하세요...\n    김원장 : 네 안녕하세요...'}
                rows={6}
                style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', resize: 'vertical', marginBottom: 8 }}
              />
              {parsedChat.length > 0 && (
                <div style={{ maxHeight: 200, overflowY: 'auto', marginBottom: 8 }}>
                  <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>미리보기 ({parsedChat.length}건)</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {parsedChat.map((msg, i) => {
                      const isFirst = msg.sender === parsedChat[0].sender;
                      return (
                        <div key={i} style={{
                          alignSelf: isFirst ? 'flex-start' : 'flex-end',
                          maxWidth: '80%', padding: '4px 8px', borderRadius: 8,
                          background: isFirst ? '#fff3cd' : '#d1ecf1',
                          fontSize: 12, lineHeight: 1.3,
                        }}>
                          <div style={{ fontSize: 9, color: '#6b7280' }}>{msg.sender} {msg.time || ''}</div>
                          <div>{msg.text}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              <button
                type="button"
                className="cl-chip active"
                onClick={applyChatToFields}
                disabled={parsedChat.length === 0}
                style={{ fontSize: 12 }}
              >문의/응답에 적용</button>
            </div>
          )}

          {/* 발생일시 */}
          <div className="cl-row">
            <label className="cl-label">발생일시</label>
            <input type="date" className="cl-input-sm" value={occurDate} onChange={e => setOccurDate(e.target.value)} />
            <input type="time" className="cl-input-sm" value={occurTime} onChange={e => setOccurTime(e.target.value)} />
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: '8px 0' }} />

          {/* 담당자 */}
          <div className="cl-row">
            <label className="cl-label">담당자</label>
            <input type="text" className="cl-input" value={handler} onChange={e => setHandler(e.target.value)} placeholder="접수자 이름" style={{ maxWidth: 160 }} />
          </div>

          {chatMode ? (
            <>
              {/* 대화 모드: 말풍선 미리보기 */}
              {!editingChat ? (
                <div style={{ margin: '4px 0 8px', padding: 10, background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', maxHeight: 200, overflowY: 'auto' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 11, color: '#6b7280' }}>대화 ({chatMessages.length}건)</span>
                    <button type="button" className="cl-chip" onClick={() => { setChatPaste(chatMessages.map(m => m.t ? `[${m.s} ${m.t}] ${m.m}` : `${m.s} : ${m.m}`).join('\n')); setEditingChat(true); setShowChatPaste(true); }} style={{ fontSize: 11, padding: '2px 8px' }}>대화 수정</button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {chatMessages.map((msg, i) => {
                      const isFirst = msg.s === chatMessages[0]?.s;
                      return (
                        <div key={i} style={{
                          alignSelf: isFirst ? 'flex-start' : 'flex-end',
                          maxWidth: '80%', padding: '4px 8px', borderRadius: 8,
                          background: isFirst ? '#fff3cd' : '#d1ecf1',
                          fontSize: 12, lineHeight: 1.3,
                        }}>
                          <div style={{ fontSize: 9, color: '#6b7280' }}>{msg.s} {msg.t}</div>
                          <div style={{ whiteSpace: 'pre-wrap' }}>{msg.m}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: '8px 0' }} />

              {/* 메모 */}
              <div className="cl-row" style={{ alignItems: 'flex-start' }}>
                <label className="cl-label" style={{ paddingTop: 6 }}>메모</label>
                <textarea
                  className="cl-input"
                  value={result}
                  onChange={e => setResult(e.target.value)}
                  placeholder="요약, 후속 조치 등 (선택)"
                  rows={2}
                />
              </div>

              <div className="cl-row">
                <label className="cl-label">처리완료</label>
                <button type="button" className={`cl-chip${isDone ? ' done' : ''}`} onClick={() => setIsDone(!isDone)}>{isDone ? '✓ 완료' : '미완료'}</button>
              </div>
            </>
          ) : (
            <>
              {/* 단건 모드: 기존 문의/응답 */}
              <div className="cl-row" style={{ alignItems: 'flex-start' }}>
                <label className="cl-label" style={{ paddingTop: 6 }}>문의내용</label>
                <textarea
                  className="cl-input"
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  placeholder="문의 내용을 입력하세요"
                  rows={3}
                />
              </div>

              <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: '8px 0' }} />

              <div className="cl-row">
                <label className="cl-label">응답자</label>
                <input type="text" className="cl-input" value={responder} onChange={e => setResponder(e.target.value)} placeholder="응답자 이름" style={{ maxWidth: 160 }} />
              </div>

              <div className="cl-row" style={{ alignItems: 'flex-start' }}>
                <label className="cl-label" style={{ paddingTop: 6 }}>응답내용</label>
                <textarea
                  className="cl-input"
                  value={result}
                  onChange={e => setResult(e.target.value)}
                  placeholder="응답/처리 내용 (선택)"
                  rows={3}
                />
              </div>

              <div className="cl-row">
                <label className="cl-label">응답일시</label>
                <input type="date" className="cl-input-sm" value={resultDate} onChange={e => setResultDate(e.target.value)} />
                <input type="time" className="cl-input-sm" value={resultTime} onChange={e => setResultTime(e.target.value)} />
                <button type="button" className="cl-chip active" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => { setResultDate(nowDate()); setResultTime(nowTime()); }}>지금</button>
              </div>

              <div className="cl-row">
                <label className="cl-label">처리완료</label>
                <button type="button" className={`cl-chip${isDone ? ' done' : ''}`} onClick={() => setIsDone(!isDone)}>{isDone ? '✓ 완료' : '미완료'}</button>
              </div>
            </>
          )}
        </div>

        <div className="cl-footer">
          {isReadOnly ? (
            <>
              <button className="cl-btn-delete" onClick={handleDelete} disabled={isDeleting}>{isDeleting ? '삭제 중...' : '삭제'}</button>
              <div style={{ flex: 1 }} />
              <button className="cl-btn-cancel" onClick={handleClose}>닫기</button>
              <button className="cl-btn-save" onClick={() => setIsReadOnly(false)}>수정</button>
            </>
          ) : (
            <>
              {editLog && <button className="cl-btn-delete" onClick={handleDelete} disabled={isDeleting}>{isDeleting ? '삭제 중...' : '삭제'}</button>}
              <div style={{ flex: 1 }} />
              <button className="cl-btn-cancel" onClick={handleClose}>취소</button>
              <button className="cl-btn-save" onClick={handleSave} disabled={isSaving || (!chatMode && !content.trim()) || (chatMode && chatMessages.length === 0)}>{isSaving ? '저장 중...' : (editLog ? '저장' : '등록')}</button>
            </>
          )}
        </div>
      </div>

      <style>{`
        .cl-modal-body {
          padding: 16px 24px;
          max-height: calc(100vh - 200px);
          overflow-y: auto;
        }
        .cl-row {
          display: flex;
          gap: 12px;
          align-items: center;
          margin-bottom: 14px;
        }
        .cl-label {
          font-size: 15px;
          font-weight: 600;
          color: #4b5563;
          min-width: 70px;
          flex-shrink: 0;
        }
        .cl-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }
        .cl-chip {
          padding: 5px 14px;
          border: 1.5px solid #d1d5db;
          border-radius: 20px;
          background: #fff;
          font-size: 13px;
          cursor: pointer;
          font-weight: 500;
          transition: all 0.15s;
        }
        .cl-chip:hover {
          border-color: #9ca3af;
          background: #f9fafb;
        }
        .cl-chip.active {
          border-color: #3b82f6;
          background: #eff6ff;
          color: #1d4ed8;
          font-weight: 600;
        }
        .cl-chip.done {
          border-color: #059669;
          background: #059669;
          color: #fff;
          font-weight: 600;
        }
        .cl-input {
          flex: 1;
          padding: 8px 12px;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          font-size: 14px;
          font-family: inherit;
          resize: vertical;
          min-height: 44px;
        }
        .cl-input-sm {
          padding: 6px 10px;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          font-size: 14px;
          font-family: inherit;
        }
        .cl-input-sm:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 2px rgba(59,130,246,0.1);
        }
        .cl-input:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 2px rgba(59,130,246,0.1);
        }
        .cl-footer {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          padding: 12px 24px 16px;
        }
        .cl-btn-cancel {
          padding: 8px 20px;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          background: #fff;
          font-size: 14px;
          cursor: pointer;
          color: #374151;
        }
        .cl-btn-cancel:hover { background: #f3f4f6; }
        .cl-btn-save {
          padding: 8px 24px;
          border: none;
          border-radius: 8px;
          background: #10b981;
          color: #fff;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
        }
        .cl-btn-save:hover { background: #059669; }
        .cl-btn-save:disabled { background: #d1d5db; cursor: not-allowed; }
        .cl-btn-delete {
          padding: 8px 16px;
          border: 1px solid #fca5a5;
          border-radius: 8px;
          background: #fff;
          color: #dc2626;
          font-size: 14px;
          cursor: pointer;
        }
        .cl-btn-delete:hover { background: #fef2f2; }
        .cl-btn-delete:disabled { opacity: 0.5; cursor: not-allowed; }
      `}</style>
    </div>
  );
}
