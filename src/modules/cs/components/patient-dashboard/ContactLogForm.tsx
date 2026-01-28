/**
 * 응대 기록 입력 폼
 */

import React, { useState } from 'react';
import type {
  ContactDirection,
  ContactChannel,
  ContactType,
  InboundContactType,
  OutboundContactType,
  CreateContactLogRequest,
} from '../../types/crm';
import { createContactLog } from '../../lib/contactLogApi';

// 인바운드 유형 옵션
const INBOUND_TYPES: { value: InboundContactType; label: string }[] = [
  { value: 'inquiry', label: '문의' },
  { value: 'reservation', label: '예약' },
  { value: 'complaint', label: '컴플레인' },
  { value: 'other', label: '기타' },
];

// 아웃바운드 유형 옵션
const OUTBOUND_TYPES: { value: OutboundContactType; label: string }[] = [
  { value: 'delivery_call', label: '배송콜' },
  { value: 'visit_call', label: '내원콜' },
  { value: 'after_call', label: '애프터콜' },
  { value: 'follow_up', label: '후속연락' },
  { value: 'marketing', label: '마케팅' },
];

// 채널 옵션
const CHANNELS: { value: ContactChannel; label: string; icon: string }[] = [
  { value: 'phone', label: '전화', icon: 'fa-phone' },
  { value: 'kakao', label: '카톡', icon: 'fa-comment' },
  { value: 'sms', label: 'SMS', icon: 'fa-message' },
  { value: 'visit', label: '방문', icon: 'fa-person-walking' },
];

interface ContactLogFormProps {
  patientId: number;
  userName: string;
  // 콜 큐에서 호출 시
  queueId?: number;
  defaultType?: ContactType;
  // 콜백
  onSuccess: () => void;
  onCancel: () => void;
}

const ContactLogForm: React.FC<ContactLogFormProps> = ({
  patientId,
  userName,
  queueId,
  defaultType,
  onSuccess,
  onCancel,
}) => {
  const [direction, setDirection] = useState<ContactDirection>(
    defaultType && OUTBOUND_TYPES.some(t => t.value === defaultType) ? 'outbound' : 'inbound'
  );
  const [channel, setChannel] = useState<ContactChannel>('phone');
  const [contactType, setContactType] = useState<ContactType>(defaultType || 'inquiry');
  const [content, setContent] = useState('');
  const [result, setResult] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 방향 변경 시 유형 초기화
  const handleDirectionChange = (newDirection: ContactDirection) => {
    setDirection(newDirection);
    if (newDirection === 'inbound') {
      setContactType('inquiry');
    } else {
      setContactType('delivery_call');
    }
  };

  // 제출
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!content.trim()) {
      alert('내용을 입력해주세요.');
      return;
    }

    setIsSubmitting(true);
    try {
      const data: CreateContactLogRequest = {
        patient_id: patientId,
        direction,
        channel,
        contact_type: contactType,
        content: content.trim(),
        result: result.trim() || undefined,
        created_by: userName,
      };

      await createContactLog(data);
      onSuccess();
    } catch (err: any) {
      console.error('응대 기록 저장 오류:', err);
      alert(err.message || '저장에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const typeOptions = direction === 'inbound' ? INBOUND_TYPES : OUTBOUND_TYPES;

  return (
    <form className="contact-log-form" onSubmit={handleSubmit}>
      {/* 방향 선택 */}
      <div className="form-row direction-row">
        <button
          type="button"
          className={`direction-btn ${direction === 'inbound' ? 'active' : ''}`}
          onClick={() => handleDirectionChange('inbound')}
        >
          <i className="fa-solid fa-arrow-down"></i> 인바운드
        </button>
        <button
          type="button"
          className={`direction-btn ${direction === 'outbound' ? 'active' : ''}`}
          onClick={() => handleDirectionChange('outbound')}
        >
          <i className="fa-solid fa-arrow-up"></i> 아웃바운드
        </button>
      </div>

      {/* 채널 & 유형 */}
      <div className="form-row">
        <div className="form-group">
          <label>채널</label>
          <div className="channel-buttons">
            {CHANNELS.map(ch => (
              <button
                key={ch.value}
                type="button"
                className={`channel-btn ${channel === ch.value ? 'active' : ''}`}
                onClick={() => setChannel(ch.value)}
              >
                <i className={`fa-solid ${ch.icon}`}></i>
                {ch.label}
              </button>
            ))}
          </div>
        </div>

        <div className="form-group">
          <label>유형</label>
          <select
            value={contactType}
            onChange={e => setContactType(e.target.value as ContactType)}
            className="form-select"
          >
            {typeOptions.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 내용 */}
      <div className="form-group">
        <label>내용 *</label>
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="응대 내용을 입력하세요..."
          rows={3}
          className="form-textarea"
          autoFocus
        />
      </div>

      {/* 결과 */}
      <div className="form-group">
        <label>결과/메모</label>
        <input
          type="text"
          value={result}
          onChange={e => setResult(e.target.value)}
          placeholder="통화 결과 또는 메모"
          className="form-input"
        />
      </div>

      {/* 버튼 */}
      <div className="form-actions">
        <button
          type="button"
          className="btn-cancel"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          취소
        </button>
        <button
          type="submit"
          className="btn-submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <i className="fa-solid fa-spinner fa-spin"></i> 저장 중...
            </>
          ) : (
            <>
              <i className="fa-solid fa-check"></i> 저장
            </>
          )}
        </button>
      </div>
    </form>
  );
};

export default ContactLogForm;
