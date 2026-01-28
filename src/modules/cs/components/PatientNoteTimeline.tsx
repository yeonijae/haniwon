import React, { useState, useMemo } from 'react';
import type {
  PatientNote,
  PatientNoteType,
  NoteChannel,
  NoteFilterOptions,
} from '../types/crm';
import {
  NOTE_TYPE_LABELS,
  NOTE_TYPE_ICONS,
  NOTE_TYPE_COLORS,
  NOTE_CHANNEL_LABELS,
  NOTE_CHANNEL_ICONS,
  NOTE_STATUS_LABELS,
} from '../types/crm';
import { updatePatientNote, deletePatientNote } from '../lib/patientCrmApi';

interface PatientNoteTimelineProps {
  notes: PatientNote[];
  onRefresh: () => void;
  onEdit?: (note: PatientNote) => void;
  editable?: boolean;
}

const PatientNoteTimeline: React.FC<PatientNoteTimelineProps> = ({
  notes,
  onRefresh,
  onEdit,
  editable = true,
}) => {
  const [filter, setFilter] = useState<PatientNoteType | 'all'>('all');
  const [expandedNoteId, setExpandedNoteId] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState<number | null>(null);

  // 필터링된 메모 목록
  const filteredNotes = useMemo(() => {
    if (filter === 'all') return notes;
    return notes.filter(note => note.note_type === filter);
  }, [notes, filter]);

  // 날짜별 그룹화
  const groupedNotes = useMemo(() => {
    const groups: Record<string, PatientNote[]> = {};

    filteredNotes.forEach(note => {
      const date = note.created_at.split('T')[0];
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(note);
    });

    // 날짜 내림차순 정렬
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [filteredNotes]);

  // 날짜 포맷
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const dateOnly = dateStr.split('T')[0];
    const todayStr = today.toISOString().split('T')[0];
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    if (dateOnly === todayStr) return '오늘';
    if (dateOnly === yesterdayStr) return '어제';

    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  // 시간 포맷
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  // 메모 삭제
  const handleDelete = async (noteId: number) => {
    if (!confirm('이 메모를 삭제하시겠습니까?')) return;

    setIsDeleting(noteId);
    try {
      await deletePatientNote(noteId);
      onRefresh();
    } catch (error) {
      console.error('메모 삭제 오류:', error);
      alert('메모 삭제 중 오류가 발생했습니다.');
    } finally {
      setIsDeleting(null);
    }
  };

  // 상태 토글
  const handleToggleStatus = async (note: PatientNote) => {
    try {
      const newStatus = note.status === 'active' ? 'resolved' : 'active';
      await updatePatientNote(note.id, { status: newStatus });
      onRefresh();
    } catch (error) {
      console.error('상태 변경 오류:', error);
    }
  };

  if (notes.length === 0) {
    return (
      <div className="note-timeline-empty">
        <p>등록된 메모가 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="note-timeline">
      {/* 필터 */}
      <div className="note-timeline-filter">
        <button
          className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          전체
        </button>
        <button
          className={`filter-btn ${filter === 'memo' ? 'active' : ''}`}
          onClick={() => setFilter('memo')}
          style={{ '--filter-color': NOTE_TYPE_COLORS.memo } as React.CSSProperties}
        >
          {NOTE_TYPE_ICONS.memo} {NOTE_TYPE_LABELS.memo}
        </button>
        <button
          className={`filter-btn ${filter === 'complaint' ? 'active' : ''}`}
          onClick={() => setFilter('complaint')}
          style={{ '--filter-color': NOTE_TYPE_COLORS.complaint } as React.CSSProperties}
        >
          {NOTE_TYPE_ICONS.complaint} {NOTE_TYPE_LABELS.complaint}
        </button>
        <button
          className={`filter-btn ${filter === 'inquiry' ? 'active' : ''}`}
          onClick={() => setFilter('inquiry')}
          style={{ '--filter-color': NOTE_TYPE_COLORS.inquiry } as React.CSSProperties}
        >
          {NOTE_TYPE_ICONS.inquiry} {NOTE_TYPE_LABELS.inquiry}
        </button>
      </div>

      {/* 타임라인 */}
      <div className="note-timeline-list">
        {groupedNotes.map(([date, dateNotes]) => (
          <div key={date} className="note-timeline-group">
            <div className="note-timeline-date">
              {formatDate(date)}
            </div>

            {dateNotes.map(note => (
              <div
                key={note.id}
                className={`note-timeline-item ${note.status !== 'active' ? 'resolved' : ''} ${expandedNoteId === note.id ? 'expanded' : ''}`}
                onClick={() => setExpandedNoteId(expandedNoteId === note.id ? null : note.id)}
              >
                {/* 헤더 */}
                <div className="note-item-header">
                  <div className="note-item-badges">
                    <span
                      className="note-type-badge"
                      style={{ backgroundColor: NOTE_TYPE_COLORS[note.note_type] }}
                    >
                      {NOTE_TYPE_ICONS[note.note_type]} {NOTE_TYPE_LABELS[note.note_type]}
                    </span>
                    {note.channel && (
                      <span className="note-channel-badge">
                        {NOTE_CHANNEL_ICONS[note.channel]} {NOTE_CHANNEL_LABELS[note.channel]}
                      </span>
                    )}
                    {note.status === 'resolved' && (
                      <span className="note-status-badge resolved">해결됨</span>
                    )}
                  </div>
                  <span className="note-item-time">
                    {formatTime(note.created_at)}
                  </span>
                </div>

                {/* 내용 */}
                <div className="note-item-content">
                  {note.content}
                </div>

                {/* 응답 (있는 경우) */}
                {note.response && (
                  <div className="note-item-response">
                    <span className="response-label">응답:</span>
                    {note.response}
                  </div>
                )}

                {/* 확장 영역 */}
                {expandedNoteId === note.id && (
                  <div className="note-item-expanded" onClick={e => e.stopPropagation()}>
                    <div className="note-item-meta">
                      <span>작성: {note.staff_name}</span>
                      {note.related_date && (
                        <span>관련일: {note.related_date}</span>
                      )}
                    </div>

                    {editable && (
                      <div className="note-item-actions">
                        {note.note_type === 'complaint' && (
                          <button
                            className={`action-btn ${note.status === 'resolved' ? 'reopen' : 'resolve'}`}
                            onClick={() => handleToggleStatus(note)}
                          >
                            {note.status === 'resolved' ? '다시 열기' : '해결 완료'}
                          </button>
                        )}
                        {onEdit && (
                          <button
                            className="action-btn edit"
                            onClick={() => onEdit(note)}
                          >
                            수정
                          </button>
                        )}
                        <button
                          className="action-btn delete"
                          onClick={() => handleDelete(note.id)}
                          disabled={isDeleting === note.id}
                        >
                          {isDeleting === note.id ? '삭제중...' : '삭제'}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export default PatientNoteTimeline;
