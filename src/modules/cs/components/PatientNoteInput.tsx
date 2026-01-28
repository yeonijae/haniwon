import React, { useState } from 'react';
import type {
  PatientNote,
  PatientNoteType,
  NoteChannel,
  StaffRole,
  CreatePatientNoteRequest,
} from '../types/crm';
import {
  NOTE_TYPE_LABELS,
  NOTE_TYPE_ICONS,
  NOTE_CHANNEL_LABELS,
  NOTE_CHANNEL_ICONS,
  STAFF_ROLE_LABELS,
} from '../types/crm';
import { createPatientNote, updatePatientNote } from '../lib/patientCrmApi';

interface PatientNoteInputProps {
  patientId: number;
  chartNumber: string;
  patientName?: string;
  staffName: string;
  staffRole: StaffRole;
  editNote?: PatientNote;
  onSuccess: () => void;
  onCancel?: () => void;
}

const PatientNoteInput: React.FC<PatientNoteInputProps> = ({
  patientId,
  chartNumber,
  patientName,
  staffName,
  staffRole,
  editNote,
  onSuccess,
  onCancel,
}) => {
  const [noteType, setNoteType] = useState<PatientNoteType>(editNote?.note_type || 'memo');
  const [channel, setChannel] = useState<NoteChannel | ''>(editNote?.channel || '');
  const [content, setContent] = useState(editNote?.content || '');
  const [response, setResponse] = useState(editNote?.response || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEditMode = !!editNote;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!content.trim()) {
      alert('내용을 입력해주세요.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (isEditMode && editNote) {
        await updatePatientNote(editNote.id, {
          note_type: noteType,
          channel: channel || undefined,
          content: content.trim(),
          response: response.trim() || undefined,
        });
      } else {
        const data: CreatePatientNoteRequest = {
          patient_id: patientId,
          chart_number: chartNumber,
          patient_name: patientName,
          note_type: noteType,
          channel: channel || undefined,
          content: content.trim(),
          response: response.trim() || undefined,
          staff_name: staffName,
          staff_role: staffRole,
        };
        await createPatientNote(data);
      }

      // 폼 초기화
      setContent('');
      setResponse('');
      setNoteType('memo');
      setChannel('');

      onSuccess();
    } catch (error) {
      console.error('메모 저장 오류:', error);
      alert('메모 저장 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Ctrl/Cmd + Enter로 저장
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      handleSubmit(e as any);
    }
    // Escape로 취소
    if (e.key === 'Escape' && onCancel) {
      onCancel();
    }
  };

  return (
    <form className="note-input-form" onSubmit={handleSubmit}>
      {/* 타입 선택 */}
      <div className="note-input-row">
        <div className="note-type-selector">
          {(['memo', 'complaint', 'inquiry'] as PatientNoteType[]).map(type => (
            <button
              key={type}
              type="button"
              className={`note-type-btn ${noteType === type ? 'active' : ''}`}
              onClick={() => setNoteType(type)}
            >
              {NOTE_TYPE_ICONS[type]} {NOTE_TYPE_LABELS[type]}
            </button>
          ))}
        </div>

        <div className="note-channel-selector">
          <select
            value={channel}
            onChange={e => setChannel(e.target.value as NoteChannel | '')}
          >
            <option value="">채널 선택</option>
            {(['phone', 'kakao', 'visit', 'naver'] as NoteChannel[]).map(ch => (
              <option key={ch} value={ch}>
                {NOTE_CHANNEL_ICONS[ch]} {NOTE_CHANNEL_LABELS[ch]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 내용 입력 */}
      <div className="note-input-content">
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`${NOTE_TYPE_LABELS[noteType]} 내용을 입력하세요... (Ctrl+Enter로 저장)`}
          rows={3}
          autoFocus
        />
      </div>

      {/* 응답 입력 (문의/컴플레인인 경우) */}
      {(noteType === 'inquiry' || noteType === 'complaint') && (
        <div className="note-input-response">
          <textarea
            value={response}
            onChange={e => setResponse(e.target.value)}
            placeholder="응답/조치 내용 (선택)"
            rows={2}
          />
        </div>
      )}

      {/* 액션 버튼 */}
      <div className="note-input-actions">
        <span className="note-input-info">
          {staffName} ({STAFF_ROLE_LABELS[staffRole]})
        </span>
        <div className="note-input-buttons">
          {onCancel && (
            <button
              type="button"
              className="btn-cancel"
              onClick={onCancel}
            >
              취소
            </button>
          )}
          <button
            type="submit"
            className="btn-submit"
            disabled={isSubmitting || !content.trim()}
          >
            {isSubmitting ? '저장중...' : (isEditMode ? '수정' : '저장')}
          </button>
        </div>
      </div>
    </form>
  );
};

export default PatientNoteInput;
