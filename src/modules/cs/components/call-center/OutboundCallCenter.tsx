/**
 * 아웃바운드 콜 센터
 * 조건별 콜 대상자 리스트업 및 관리
 */

import React, { useState, useEffect, useCallback } from 'react';
import type { PortalUser } from '@shared/types';
import type { CallType, CallQueueItem, CallCenterStats } from '../../types/crm';
import { CALL_TYPE_LABELS } from '../../types/crm';
import type { CallNote } from '../../types/crm';
import {
  getTodayCallQueue,
  getCallCenterStats,
  getAllCallTargets,
  addTargetToQueue,
  completeCall,
  postponeCall,
  updateCallQueueItem,
  getCallNotesByQueueIds,
  addCallNote,
  deleteCallNote,
  updateCallNote,
  deleteCallQueueItem,
  undoPostpone,
  type CallTargetPatient,
} from '../../lib/callQueueApi';
import { createContactLog } from '../../lib/contactLogApi';
import PatientDashboard from '../PatientDashboard';
import { getLocalPatientById } from '../../lib/patientSync';
import type { LocalPatient } from '../../lib/patientSync';
import { MessageSendModal } from '../messaging';
import CallTargetList from './CallTargetList';
import CallResultModal from './CallResultModal';
import './OutboundCallCenter.css';

interface OutboundCallCenterProps {
  user: PortalUser;
}

const CALL_TYPES: CallType[] = [
  'delivery_call',
  'visit_call',
  'after_call',
  'unconsumed',
  'vip_care',
  'churn_risk_1',
  'remind_3month',
  'expiry_warning',
];

function formatLocalDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

/** "2026-02-21" → "26/2/21" */
function fmtDate(s: string | null | undefined): string {
  if (!s) return '-';
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return `${String(d.getFullYear()).slice(2)}/${d.getMonth()+1}/${d.getDate()}`;
}

/** any date string → "26/2/21 14:30" */
function fmtDateTime(s: string | null | undefined): string {
  if (!s) return '';
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  const date = `${String(d.getFullYear()).slice(2)}/${d.getMonth()+1}/${d.getDate()}`;
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${date} ${h}:${m}`;
}

const OutboundCallCenter: React.FC<OutboundCallCenterProps> = ({ user }) => {
  const [selectedType, setSelectedType] = useState<CallType | null>(null);
  const [queueItems, setQueueItems] = useState<CallQueueItem[]>([]);       // 미완료 큐
  const [completedItems, setCompletedItems] = useState<CallQueueItem[]>([]); // 완료 큐
  const [targetPatients, setTargetPatients] = useState<CallTargetPatient[]>([]);
  const [stats, setStats] = useState<CallCenterStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [baseDate, setBaseDate] = useState<string>(formatLocalDate(new Date()));
  const [rangeMode, setRangeMode] = useState<'day' | '1w' | '1m' | '3m'>('day');
  const [targetSelected, setTargetSelected] = useState<Set<number>>(new Set());
  const [operator, setOperator] = useState<string>(() => localStorage.getItem('occ_operator') || '');
  const [showOperatorInput, setShowOperatorInput] = useState(false);

  // 미루기 모달
  const [postponeTarget, setPostponeTarget] = useState<CallQueueItem | null>(null);
  const [postponeDate, setPostponeDate] = useState('');
  const [postponeReason, setPostponeReason] = useState('');

  const moveDate = (days: number) => {
    const d = new Date(baseDate + 'T00:00:00');
    d.setDate(d.getDate() + days);
    setBaseDate(formatLocalDate(d));
  };
  const isToday = baseDate === formatLocalDate(new Date());

  // 메모 상태
  const [notesMap, setNotesMap] = useState<Map<number, CallNote[]>>(new Map());
  const [expandedNotes, setExpandedNotes] = useState<Set<number>>(new Set());
  const [noteInput, setNoteInput] = useState<Record<number, string>>({});
  const [editingNote, setEditingNote] = useState<{ id: number; queueId: number; content: string } | null>(null);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; item: CallQueueItem } | null>(null);

  // 모달 상태
  const [showDashboard, setShowDashboard] = useState(false);
  const [dashboardPatient, setDashboardPatient] = useState<LocalPatient | null>(null);
  const [showResultModal, setShowResultModal] = useState(false);
  const [selectedQueueItem, setSelectedQueueItem] = useState<CallQueueItem | null>(null);
  // 메시지 발송 모달
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [messageTarget, setMessageTarget] = useState<{
    patientId?: number;
    patientName?: string;
    phone: string;
  } | null>(null);

  // 통계 로드
  const loadStats = useCallback(async () => {
    try {
      const data = await getCallCenterStats();
      setStats(data);
    } catch (error) {
      console.error('통계 로드 오류:', error);
    }
  }, []);

  // 전체 데이터 로드 (3컬럼 동시)
  const loadAll = useCallback(async () => {
    setIsLoading(true);
    try {
      // 기간 계산
      const calcDateFrom = () => {
        if (rangeMode === 'day') return undefined;
        const d = new Date(baseDate + 'T00:00:00');
        if (rangeMode === '1w') d.setDate(d.getDate() - 6);
        else if (rangeMode === '1m') d.setMonth(d.getMonth() - 1);
        else if (rangeMode === '3m') d.setMonth(d.getMonth() - 3);
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      };
      const dateFrom = calcDateFrom();
      const [incompleteItems, doneItems, targets, st] = await Promise.all([
        getTodayCallQueue(selectedType || undefined, baseDate, 'incomplete'),
        getTodayCallQueue(selectedType || undefined, baseDate, 'completed', dateFrom),
        getAllCallTargets(selectedType || undefined, baseDate),
        getCallCenterStats(),
      ]);
      setQueueItems(incompleteItems);
      setCompletedItems(doneItems);
      setTargetPatients(targets);
      setTargetSelected(new Set());
      setStats(st);
      // 메모 일괄 로드
      const allIds = [...incompleteItems, ...doneItems].map(i => i.id);
      if (allIds.length > 0) {
        const notes = await getCallNotesByQueueIds(allIds);
        setNotesMap(notes);
      } else {
        setNotesMap(new Map());
      }
    } catch (error) {
      console.error('콜 센터 로드 오류:', error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedType, baseDate, rangeMode]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const handleRefresh = () => { loadAll(); };

  // 환자 클릭 → 환자 통합 대시보드 열기
  const handlePatientClick = async (patientId: number) => {
    const patient = await getLocalPatientById(patientId);
    if (patient) {
      setDashboardPatient(patient);
      setShowDashboard(true);
    }
  };

  // 콜 완료 버튼 클릭
  const requireOperator = (): boolean => {
    if (!operator.trim()) {
      alert('담당자를 입력하세요.');
      setShowOperatorInput(true);
      return false;
    }
    return true;
  };

  const saveOperator = (name: string) => {
    setOperator(name);
    localStorage.setItem('occ_operator', name);
    setShowOperatorInput(false);
  };

  const handleCallComplete = async (item: CallQueueItem) => {
    if (!requireOperator()) return;
    const notes = notesMap.get(item.id) || [];
    const hasActivity = item.status === 'no_answer' || notes.length > 0;
    if (!hasActivity) {
      if (!confirm('메모없이 완료하시겠습니까?')) return;
    }
    try {
      // 메모 내용을 모아서 contact_log 생성
      const memoLines = notes.filter(Boolean).map(n => {
        const dt = fmtDateTime(n.created_at);
        return `${dt} ${n.content}`;
      });
      const memoText = memoLines.join('\n');
      // result에 메타 정보 저장 (콜종류, 약종류, 사유)
      const meta = [
        `콜종류:${CALL_TYPE_LABELS[item.call_type]}`,
        item.herbal_name ? `약종류:${item.herbal_name}` : '',
        item.reason ? `사유:${item.reason}` : '',
      ].filter(Boolean).join('|');
      const log = await createContactLog({
        patient_id: item.patient_id,
        direction: 'outbound',
        channel: 'phone',
        contact_type: item.call_type as any,
        content: memoText || `[${CALL_TYPE_LABELS[item.call_type]}] 완료`,
        result: meta,
        related_type: item.related_type || undefined,
        related_id: item.related_id || undefined,
        created_by: operator,
      });
      await completeCall(item.id, log?.id);
      handleRefresh();
    } catch (error) {
      console.error('완료 처리 오류:', error);
    }
  };

  // 콜 결과 저장
  const handleSaveResult = async (result: string, content: string) => {
    if (!selectedQueueItem) return;

    try {
      // 응대 기록 생성
      const log = await createContactLog({
        patient_id: selectedQueueItem.patient_id,
        direction: 'outbound',
        channel: 'phone',
        contact_type: selectedQueueItem.call_type as any,
        content,
        result,
        related_type: selectedQueueItem.related_type || undefined,
        related_id: selectedQueueItem.related_id || undefined,
        created_by: user.name,
      });

      // 콜 큐 완료 처리
      await completeCall(selectedQueueItem.id, log.id);

      setShowResultModal(false);
      setSelectedQueueItem(null);
      handleRefresh();
    } catch (error) {
      console.error('콜 결과 저장 오류:', error);
      alert('저장에 실패했습니다.');
    }
  };

  // 콜 미루기 모달 열기
  const handlePostponeOpen = (item: CallQueueItem) => {
    if (!requireOperator()) return;
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setPostponeTarget(item);
    setPostponeDate(formatLocalDate(tomorrow));
    setPostponeReason('');
  };

  // 콜 미루기 확정
  const handlePostponeConfirm = async () => {
    if (!postponeTarget || !postponeDate) return;
    try {
      await postponeCall(postponeTarget.id, postponeDate);
      const memoText = `[미루기 → ${fmtDate(postponeDate)}]${postponeReason.trim() ? ' ' + postponeReason.trim() : ''}`;
      await addCallNote(postponeTarget.id, memoText, operator);
      // contact_log에도 기록 → 환자대시보드 표시
      const meta = [
        `콜종류:${CALL_TYPE_LABELS[postponeTarget.call_type]}`,
        postponeTarget.herbal_name ? `약종류:${postponeTarget.herbal_name}` : '',
        postponeTarget.reason ? `사유:${postponeTarget.reason}` : '',
      ].filter(Boolean).join('|');
      await createContactLog({
        patient_id: postponeTarget.patient_id,
        direction: 'outbound',
        channel: 'phone',
        contact_type: postponeTarget.call_type as any,
        content: memoText,
        result: meta,
        related_type: postponeTarget.related_type || undefined,
        related_id: postponeTarget.related_id || undefined,
        created_by: operator,
      });
      setPostponeTarget(null);
      handleRefresh();
    } catch (error) {
      console.error('콜 미루기 오류:', error);
      alert('미루기에 실패했습니다.');
    }
  };

  // 미루기 취소
  const handleUndoPostpone = async (item: CallQueueItem) => {
    if (!requireOperator()) return;
    try {
      await undoPostpone(item.id);
      // 미루기 메모 삭제
      const itemNotes = notesMap.get(item.id) || [];
      const postponeNote = itemNotes.find(n => n.content.startsWith('[미루기 →'));
      if (postponeNote) await deleteCallNote(postponeNote.id);
      // 미루기 contact_log 삭제
      try {
        const { getContactLogsByPatient, deleteContactLog } = await import('../../lib/contactLogApi');
        const logs = await getContactLogsByPatient(item.patient_id);
        const match = logs.find(l =>
          l.direction === 'outbound' &&
          l.contact_type === item.call_type &&
          l.content?.startsWith('[미루기 →')
        );
        if (match) await deleteContactLog(match.id).catch(() => {});
      } catch {}
      setCtxMenu(null);
      handleRefresh();
    } catch (err) {
      console.error('미루기 취소 실패:', err);
    }
  };

  // 부재중 처리
  // 완료 취소 → 콜큐로 되돌리기 + contact_log 삭제
  const handleUndoComplete = async (item: CallQueueItem) => {
    try {
      const { deleteContactLog, getContactLogsByPatient } = await import('../../lib/contactLogApi');
      // 먼저 FK 해제 + 상태 변경
      const logId = item.contact_log_id;
      await updateCallQueueItem(item.id, { status: 'pending', contact_log_id: null });
      // 그 다음 contact_log 삭제
      if (logId) {
        await deleteContactLog(logId).catch(() => {});
      } else {
        try {
          const logs = await getContactLogsByPatient(item.patient_id);
          const match = logs.find(l =>
            l.direction === 'outbound' &&
            l.contact_type === item.call_type &&
            l.related_id === item.related_id
          );
          if (match) await deleteContactLog(match.id).catch(() => {});
        } catch {}
      }
      setCtxMenu(null);
      handleRefresh();
    } catch (err) {
      console.error('완료 취소 실패:', err);
    }
  };

  // 콜큐에서 제거 (대상자로 되돌리기)
  const handleRemoveFromQueue = async (item: CallQueueItem) => {
    try {
      await deleteCallQueueItem(item.id);
      handleRefresh();
    } catch (err) {
      console.error('큐 제거 실패:', err);
    }
  };

  const handleClearNoAnswer = async (item: CallQueueItem) => {
    try {
      await updateCallQueueItem(item.id, { status: 'pending' });
      // 부재중 메모 삭제
      const notes = notesMap.get(item.id) || [];
      const noAnswerNote = notes.find(n => n.content === '[부재중]');
      if (noAnswerNote) await deleteCallNote(noAnswerNote.id);
      handleRefresh();
    } catch (err) {
      console.error('부재 해제 실패:', err);
    }
  };

  const handleNoAnswer = async (item: CallQueueItem) => {
    if (!requireOperator()) return;
    try {
      await updateCallQueueItem(item.id, { status: 'no_answer' });
      await addCallNote(item.id, '[부재중]', operator);
      handleRefresh();
    } catch (error) {
      console.error('부재중 처리 오류:', error);
    }
  };

  // 대상자를 큐에 추가
  const handleAddToQueue = async (target: CallTargetPatient) => {
    try {
      await addTargetToQueue(target);
      handleRefresh();
    } catch (error) {
      console.error('큐 추가 오류:', error);
    }
  };

  // 일괄 큐 추가 (전체)
  const handleBulkAddToQueue = async () => {
    if (targetPatients.length === 0) return;
    await batchAddToQueueInternal(targetPatients);
  };

  // 선택 큐 추가
  const handleBatchAddTargets = async (targets: CallTargetPatient[]) => {
    await batchAddToQueueInternal(targets);
  };

  const batchAddToQueueInternal = async (targets: CallTargetPatient[]) => {
    try {
      setIsLoading(true);
      for (const target of targets) {
        await addTargetToQueue(target);
      }
      handleRefresh();
    } catch (error) {
      console.error('일괄 추가 오류:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 대상자 정렬 (CallTargetList와 동일 순서)
  const sortedTargets = [...targetPatients].sort((a, b) => b.priority - a.priority);

  const toggleTargetSelect = (idx: number) => {
    setTargetSelected(prev => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  const toggleTargetSelectAll = () => {
    if (targetSelected.size === sortedTargets.length) {
      setTargetSelected(new Set());
    } else {
      setTargetSelected(new Set(sortedTargets.map((_, i) => i)));
    }
  };

  const handleTargetDragStart = (e: React.DragEvent, index: number) => {
    const indices = targetSelected.size > 0 && targetSelected.has(index)
      ? [...targetSelected]
      : [index];
    e.dataTransfer.setData('text/plain', JSON.stringify(indices));
    e.dataTransfer.effectAllowed = 'move';
  };

  // 드래그앤드롭: 콜큐 컬럼에 드롭
  const handleQueueDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.remove('occ-drop-over');
    try {
      const data = e.dataTransfer.getData('text/plain');
      const indices: number[] = JSON.parse(data);
      const targets = indices.map(i => sortedTargets[i]).filter(Boolean);
      if (targets.length > 0) {
        await batchAddToQueueInternal(targets);
      }
    } catch {}
  };

  const handleQueueDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    e.currentTarget.classList.add('occ-drop-over');
  };

  const handleQueueDragLeave = (e: React.DragEvent) => {
    e.currentTarget.classList.remove('occ-drop-over');
  };

  // 드래그앤드롭: 대상자 컬럼에 큐 아이템 드롭 → 큐에서 제거
  const handleTargetDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.remove('occ-drop-over');
    const queueItemId = e.dataTransfer.getData('application/queue-item');
    if (queueItemId) {
      try {
        await deleteCallQueueItem(Number(queueItemId));
        handleRefresh();
      } catch {}
    }
  };

  const handleTargetDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('application/queue-item')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      e.currentTarget.classList.add('occ-drop-over');
    }
  };

  const handleTargetDragLeave = (e: React.DragEvent) => {
    e.currentTarget.classList.remove('occ-drop-over');
  };

  // 메모 토글
  const toggleNotes = (queueId: number) => {
    setExpandedNotes(prev => {
      const next = new Set(prev);
      next.has(queueId) ? next.delete(queueId) : next.add(queueId);
      return next;
    });
  };

  // 메모 추가
  const handleAddNote = async (queueId: number) => {
    if (!requireOperator()) return;
    const text = noteInput[queueId]?.trim();
    if (!text) return;
    try {
      const note = await addCallNote(queueId, text, operator);
      if (!note) return;
      setNotesMap(prev => {
        const next = new Map(prev);
        const list = next.get(queueId) || [];
        next.set(queueId, [...list, note]);
        return next;
      });
      setNoteInput(prev => ({ ...prev, [queueId]: '' }));
      // 저장 후 입력패널 닫기
      setExpandedNotes(prev => {
        const next = new Set(prev);
        next.delete(queueId);
        return next;
      });
    } catch (err) {
      console.error('메모 추가 실패:', err);
    }
  };

  // 메모 삭제
  const handleEditNoteSave = async () => {
    if (!requireOperator()) return;
    if (!editingNote || !editingNote.content.trim()) return;
    try {
      await updateCallNote(editingNote.id, editingNote.content.trim());
      setNotesMap(prev => {
        const next = new Map(prev);
        const list = (next.get(editingNote.queueId) || []).map(n =>
          n.id === editingNote.id ? { ...n, content: editingNote.content.trim() } : n
        );
        next.set(editingNote.queueId, list);
        return next;
      });
      setEditingNote(null);
    } catch (err) {
      console.error('메모 수정 실패:', err);
    }
  };

  const handleDeleteNote = async (queueId: number, noteId: number) => {
    try {
      await deleteCallNote(noteId);
      setNotesMap(prev => {
        const next = new Map(prev);
        next.set(queueId, (next.get(queueId) || []).filter(n => n.id !== noteId));
        return next;
      });
    } catch (err) {
      console.error('메모 삭제 실패:', err);
    }
  };

  // 메시지 발송 (콜 큐 아이템)
  const handleSendMessage = (item: CallQueueItem) => {
    if (!item.patient?.phone) {
      alert('연락처 정보가 없습니다.');
      return;
    }
    setMessageTarget({
      patientId: item.patient_id,
      patientName: item.patient.name,
      phone: item.patient.phone,
    });
    setShowMessageModal(true);
  };

  // 메시지 발송 (대상자)
  const handleSendMessageToTarget = (target: CallTargetPatient) => {
    if (!target.phone) {
      alert('연락처 정보가 없습니다.');
      return;
    }
    setMessageTarget({
      patientId: target.patient_id,
      patientName: target.name,
      phone: target.phone,
    });
    setShowMessageModal(true);
  };

  // 큐 아이템 → 카드 렌더러
  const renderQueueCard = (item: CallQueueItem, showActions: boolean = true) => {
    const notes = notesMap.get(item.id) || [];
    const isExpanded = expandedNotes.has(item.id);
    const isDone = item.status === 'completed';
    const isNoAnswer = item.status === 'no_answer';
    return (
      <div
        key={item.id}
        className={`qc-card ${isDone ? 'qc-done' : ''} ${isNoAnswer ? 'qc-no-answer' : ''} ${item.postponed_to && !isDone ? 'qc-postponed' : ''}`}
        draggable={!isDone}
        onContextMenu={(isDone || (item.postponed_to && !isDone)) ? (e => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, item }); }) : undefined}
        onDragStart={e => {
          e.dataTransfer.setData('application/queue-item', String(item.id));
          e.dataTransfer.effectAllowed = 'move';
        }}
      >
        {!isDone && showActions && (
          <button className="qc-remove-btn" onClick={() => handleRemoveFromQueue(item)} title="큐에서 제거">
            <i className="fa-solid fa-xmark"></i>
          </button>
        )}
        {/* 1행: 콜종류 + 약종류 + 이름 + 차트 + 전화 */}
        <div className="qc-row1">
          <span className={`call-type-badge sm ${item.call_type}`}>{CALL_TYPE_LABELS[item.call_type]}</span>
          {item.herbal_name && <span className="ct-tag">{item.herbal_name}</span>}
          <span className="ct-name" onClick={() => handlePatientClick(item.patient_id)}>{item.patient?.name || '-'}</span>
          <span className="ct-chart">{item.patient?.chart_number}</span>
          <a href={`tel:${item.patient?.phone}`} className="ct-phone" onClick={e => e.stopPropagation()}>
            {item.patient?.phone || '-'}
          </a>
          {isNoAnswer && <span className="q-status-badge no-answer clickable" onClick={() => handleClearNoAnswer(item)} title="부재 해제">부재 ✕</span>}
          {isDone && <span className="q-status-badge completed">완료</span>}
        </div>
        {/* 2행: 예정일 + 사유 + 액션 */}
        <div className="qc-row2">
          <span className="qc-date">{item.due_date === baseDate ? '오늘' : fmtDate(item.due_date)}</span>
          {item.reason && <span className="ct-reason">{item.reason}</span>}
          {showActions && !isDone && (
            <div className="qc-actions">
              <button className="q-act-btn complete" onClick={() => handleCallComplete(item)} title="완료"><i className="fa-solid fa-check"></i></button>
              <button className="q-act-btn postpone" onClick={() => handlePostponeOpen(item)} title="미루기"><i className="fa-solid fa-clock"></i></button>
              <button className="q-act-btn no-answer" onClick={() => handleNoAnswer(item)} title="부재중"><i className="fa-solid fa-phone-slash"></i></button>
              <button className="q-act-btn message" onClick={() => handleSendMessage(item)} title="문자"><i className="fa-solid fa-message"></i></button>
              <button className="q-act-btn memo" onClick={() => toggleNotes(item.id)} title="메모"><i className="fa-solid fa-note-sticky"></i></button>
            </div>
          )}
        </div>
        {/* 메모 (있을때만 표시) */}
        {(notes.length > 0 || isExpanded) && (
          <div className="qc-notes">
            {notes.filter(Boolean).map(n => (
              <div key={n.id} className="queue-memo-line">
                {editingNote?.id === n.id ? (
                  <div className="queue-note-input queue-note-edit">
                    <textarea
                      rows={2}
                      value={editingNote.content}
                      onChange={e => setEditingNote({ ...editingNote, content: e.target.value })}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); handleEditNoteSave(); }
                        if (e.key === 'Escape') setEditingNote(null);
                      }}
                      autoFocus
                    />
                    <div className="queue-note-edit-actions">
                      <button onClick={handleEditNoteSave} disabled={!editingNote.content.trim()}>저장</button>
                      <button className="cancel" onClick={() => setEditingNote(null)}>취소</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <span className="queue-memo-dt">{fmtDateTime(n.created_at)}</span>
                    <span className="queue-memo-text">{n.content}</span>
                    {!isDone && (
                      <>
                        <button className="queue-memo-edit" onClick={() => setEditingNote({ id: n.id, queueId: item.id, content: n.content })} title="수정">
                          <i className="fa-solid fa-pen"></i>
                        </button>
                        <button className="queue-memo-del" onClick={() => handleDeleteNote(item.id, n.id)} title="삭제">
                          <i className="fa-solid fa-trash"></i>
                        </button>
                      </>
                    )}
                  </>
                )}
              </div>
            ))}
            {isExpanded && (
              <div className="queue-note-input">
                <textarea
                  placeholder="메모..."
                  rows={2}
                  value={noteInput[item.id] || ''}
                  onChange={e => setNoteInput(prev => ({ ...prev, [item.id]: e.target.value }))}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); handleAddNote(item.id); }
                    if (e.key === 'Escape') toggleNotes(item.id);
                  }}
                  autoFocus
                />
                <button onClick={() => handleAddNote(item.id)} disabled={!noteInput[item.id]?.trim()}>저장</button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="outbound-call-center occ-3col">
      {/* 헤더: 기준일 + 카테고리 + 새로고침 */}
      <div className="occ-header-bar">
        <div className="occ-date-nav">
          <button onClick={() => moveDate(-1)} className="occ-date-btn">◀</button>
          <div className="occ-date-wrap">
            <input
              type="date"
              value={baseDate}
              onChange={e => setBaseDate(e.target.value)}
              className="occ-date-hidden"
              id="occ-date-picker"
            />
            <button className="occ-date-display" onClick={() => {
              const el = document.getElementById('occ-date-picker') as HTMLInputElement;
              el?.showPicker?.();
            }}>
              {(() => {
                const d = new Date(baseDate + 'T00:00:00');
                const days = ['일','월','화','수','목','금','토'];
                return `${d.getFullYear()}. ${String(d.getMonth()+1).padStart(2,'0')}. ${String(d.getDate()).padStart(2,'0')}. (${days[d.getDay()]})`;
              })()}
            </button>
          </div>
          <button onClick={() => moveDate(1)} className="occ-date-btn">▶</button>
          {!isToday && (
            <button onClick={() => setBaseDate(formatLocalDate(new Date()))} className="occ-today-btn">오늘</button>
          )}
          <div className="occ-filter-group">
            {([['day', '1일'], ['1w', '1주일'], ['1m', '1개월'], ['3m', '3개월']] as const).map(([key, label]) => (
              <button key={key} className={`occ-filter-btn ${rangeMode === key ? 'active' : ''}`} onClick={() => setRangeMode(key)}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="occ-filter-group occ-filter-calltype">
          <button className={`occ-filter-btn ${selectedType === null ? 'active' : ''}`} onClick={() => setSelectedType(null)}>전체</button>
          {CALL_TYPES.map(type => (
            <button key={type} className={`occ-filter-btn ${selectedType === type ? 'active' : ''}`} onClick={() => setSelectedType(type)}>
              {CALL_TYPE_LABELS[type]}
            </button>
          ))}
        </div>
        <div className="occ-header-actions">
          <button className="occ-refresh-btn" onClick={handleRefresh} disabled={isLoading}>
            <i className="fa-solid fa-refresh"></i>
          </button>
        </div>
      </div>

      {/* 3컬럼 레이아웃 */}
      <div className="occ-columns">
        {/* 1. 대상자 */}
        <div
          className="occ-col"
          onDrop={handleTargetDrop}
          onDragOver={handleTargetDragOver}
          onDragLeave={handleTargetDragLeave}
        >
          <div className="occ-col-header">
            <h3>📋 대상자 <span className="occ-col-count">{sortedTargets.length}</span></h3>
            <div className="occ-col-header-right">
              {targetSelected.size > 0 && (
                <button className="ct-btn-batch" onClick={() => handleBatchAddTargets(sortedTargets.filter((_, i) => targetSelected.has(i)))}>
                  <i className="fa-solid fa-arrow-right"></i> {targetSelected.size}명 큐 추가
                </button>
              )}
              <button
                className={`ct-btn-selectall ${targetSelected.size === sortedTargets.length && sortedTargets.length > 0 ? 'active' : ''}`}
                onClick={toggleTargetSelectAll}
                disabled={sortedTargets.length === 0}
              >
                전체
              </button>
            </div>
          </div>
          <div className="occ-col-body">
            {isLoading ? (
              <div className="occ-loading"><i className="fa-solid fa-spinner fa-spin"></i></div>
            ) : sortedTargets.length === 0 ? (
              <div className="occ-empty">대상자 없음</div>
            ) : (
              <CallTargetList
                targets={sortedTargets}
                selected={targetSelected}
                onToggleSelect={toggleTargetSelect}
                onPatientClick={handlePatientClick}
                onAddToQueue={handleAddToQueue}
                onSendMessage={handleSendMessageToTarget}
                onDragStart={handleTargetDragStart}
              />
            )}
          </div>
        </div>

        {/* 2. 콜큐 (미완료) */}
        <div
          className="occ-col occ-col-queue"
          onDrop={handleQueueDrop}
          onDragOver={handleQueueDragOver}
          onDragLeave={handleQueueDragLeave}
        >
          <div className="occ-col-header">
            <h3>📞 콜큐 <span className="occ-col-count">{queueItems.length}</span></h3>
            <div className="occ-operator">
              {operator && !showOperatorInput ? (
                <span className="occ-operator-badge" onClick={() => setShowOperatorInput(true)} title="담당자 변경">
                  {operator} ✕
                </span>
              ) : (
                <span className="occ-operator-input-wrap">
                  <input
                    type="text"
                    className="occ-operator-input"
                    placeholder="담당자 이름"
                    defaultValue={operator}
                    autoFocus
                    onKeyDown={e => {
                      if (e.key === 'Enter') saveOperator((e.target as HTMLInputElement).value.trim());
                      if (e.key === 'Escape') setShowOperatorInput(false);
                    }}
                    onBlur={e => { if (e.target.value.trim()) saveOperator(e.target.value.trim()); else setShowOperatorInput(false); }}
                  />
                </span>
              )}
            </div>
          </div>
          <div className="occ-col-body">
            {queueItems.length === 0 ? (
              <div className="occ-empty">대기 중인 콜 없음</div>
            ) : (
              <div className="qc-list">
                {queueItems.map(item => renderQueueCard(item, true))}
              </div>
            )}
          </div>
        </div>

        {/* 3. 완료 */}
        <div className="occ-col occ-col-done">
          <div className="occ-col-header">
            <h3>✅ 완료 <span className="occ-col-count">{completedItems.filter(i => i.status === 'completed').length}</span> <span style={{ marginLeft: 12 }}>미루기</span> <span className="occ-col-count postponed">{completedItems.filter(i => i.postponed_to && i.status !== 'completed').length}</span></h3>
          </div>
          <div className="occ-col-body">
            {completedItems.length === 0 ? (
              <div className="occ-empty">완료된 콜 없음</div>
            ) : (
              <div className="qc-list">
                {completedItems.map(item => renderQueueCard(item, false))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 우클릭 컨텍스트 메뉴 */}
      {ctxMenu && (
        <div className="occ-ctx-backdrop" onClick={() => setCtxMenu(null)}>
          <div className="occ-ctx-menu" style={{ top: ctxMenu.y, left: ctxMenu.x }} onClick={e => e.stopPropagation()}>
            {ctxMenu.item.status === 'completed' && (
              <button onClick={() => handleUndoComplete(ctxMenu.item)}>
                <i className="fa-solid fa-rotate-left"></i> 완료 취소
              </button>
            )}
            {ctxMenu.item.postponed_to && ctxMenu.item.status !== 'completed' && (
              <button onClick={() => handleUndoPostpone(ctxMenu.item)}>
                <i className="fa-solid fa-rotate-left"></i> 미루기 취소
              </button>
            )}
          </div>
        </div>
      )}

      {/* 환자 통합 대시보드 */}
      {showDashboard && dashboardPatient && (
        <PatientDashboard
          isOpen={showDashboard}
          patient={dashboardPatient}
          user={user}
          onClose={() => {
            setShowDashboard(false);
            setDashboardPatient(null);
          }}
        />
      )}

      {/* 콜 결과 입력 모달 */}
      {showResultModal && selectedQueueItem && (
        <CallResultModal
          queueItem={selectedQueueItem}
          onSave={handleSaveResult}
          onCancel={() => {
            setShowResultModal(false);
            setSelectedQueueItem(null);
          }}
        />
      )}

      {/* 메시지 발송 모달 */}
      {showMessageModal && messageTarget && (
        <MessageSendModal
          isOpen={showMessageModal}
          onClose={() => {
            setShowMessageModal(false);
            setMessageTarget(null);
          }}
          phone={messageTarget.phone}
          patientName={messageTarget.patientName}
          patientId={messageTarget.patientId}
          createdBy={user.name}
          onSuccess={() => {
            setShowMessageModal(false);
            setMessageTarget(null);
          }}
        />
      )}

      {/* 미루기 모달 */}
      {postponeTarget && (
        <div className="call-result-modal-overlay" onClick={() => setPostponeTarget(null)}>
          <div className="call-result-modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>콜 미루기</h3>
              <button className="modal-close" onClick={() => setPostponeTarget(null)}>
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <div className="modal-body">
              <div className="patient-info-bar">
                <span className={`call-type-badge ${postponeTarget.call_type}`}>
                  {CALL_TYPE_LABELS[postponeTarget.call_type]}
                </span>
                {postponeTarget.herbal_name && <span className="ct-tag herbal">{postponeTarget.herbal_name}</span>}
                <span className="patient-name">{postponeTarget.patient?.name}</span>
                <span className="ct-chart">{postponeTarget.patient?.chart_number}</span>
              </div>
              <div className="postpone-info">
                {fmtDate(postponeTarget.due_date)}{postponeTarget.reason ? ` - ${postponeTarget.reason}` : ''}
              </div>
              <div className="form-group">
                <label>미루기 날짜</label>
                <div className="postpone-quick-btns">
                  {[1, 3, 5, 7, 10].map(d => {
                    const target = new Date(baseDate + 'T00:00:00');
                    target.setDate(target.getDate() + d);
                    const val = formatLocalDate(target);
                    return (
                      <button
                        key={d}
                        className={`postpone-quick-btn ${postponeDate === val ? 'active' : ''}`}
                        onClick={() => setPostponeDate(val)}
                      >
                        +{d}일
                      </button>
                    );
                  })}
                </div>
                <input
                  type="date"
                  value={postponeDate}
                  onChange={e => setPostponeDate(e.target.value)}
                  className="postpone-date-input"
                />
              </div>
              <div className="form-group">
                <label>사유 <span style={{ color: '#ef4444' }}>*</span></label>
                <textarea
                  value={postponeReason}
                  onChange={e => setPostponeReason(e.target.value)}
                  placeholder="미루기 사유를 입력하세요..."
                  rows={3}
                  className="form-textarea"
                  autoFocus
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setPostponeTarget(null)}>취소</button>
              <button className="btn-submit" onClick={handlePostponeConfirm} disabled={!postponeDate || !postponeReason.trim()}>
                미루기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OutboundCallCenter;
