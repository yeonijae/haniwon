import React, { useState, useEffect, useRef } from 'react';
import type { PortalUser } from '@shared/types';
import { createInquiry } from '../lib/api';
import type { InquiryChannel, InquiryType } from '../types';
import {
  CHANNEL_LABELS,
  CHANNEL_ICONS,
  INQUIRY_TYPE_LABELS,
} from '../types';

interface QuickMemoPanelProps {
  user: PortalUser;
  onClose: () => void;
  onSaved: () => void;
}

const CHANNELS: InquiryChannel[] = ['phone', 'kakao', 'visit', 'naver'];
const INQUIRY_TYPES: InquiryType[] = ['new_patient', 'reservation', 'general', 'other'];

/**
 * 빠른 기록 모달
 * - 환자 연결 없이 문의/메모를 즉시 기록
 * - 나중에 기존 환자와 연결하거나 문의환자로 유지
 */
const QuickMemoPanel: React.FC<QuickMemoPanelProps> = ({ user, onClose, onSaved }) => {
  const [channel, setChannel] = useState<InquiryChannel>('phone');
  const [inquiryType, setInquiryType] = useState<InquiryType>('general');
  const [content, setContent] = useState('');
  const [callerName, setCallerName] = useState('');
  const [callerPhone, setCallerPhone] = useState('');
  const [response, setResponse] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const contentRef = useRef<HTMLTextAreaElement>(null);

  // 모달 열릴 때 메모 입력에 포커스
  useEffect(() => {
    contentRef.current?.focus();
  }, []);

  // ESC 키로 닫기
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // 오버레이 클릭으로 닫기
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  // 저장 처리
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    setIsSubmitting(true);
    try {
      await createInquiry({
        channel,
        patient_name: callerName.trim() || undefined,
        contact: callerPhone.trim() || undefined,
        inquiry_type: inquiryType,
        content: content.trim(),
        response: response.trim() || undefined,
        staff_name: user.name,
      });

      setContent('');
      setCallerName('');
      setCallerPhone('');
      setResponse('');
      onSaved();
    } catch (error) {
      console.error('빠른 기록 저장 오류:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="cs-quick-memo-overlay" onClick={handleOverlayClick}>
      <div className="cs-quick-memo-modal">
        {/* 모달 헤더 */}
        <div className="cs-quick-memo-header">
          <h3 className="cs-quick-memo-title">빠른 기록</h3>
          <button className="cs-quick-memo-close" onClick={onClose}>&times;</button>
        </div>

        <form className="cs-quick-memo-form" onSubmit={handleSubmit}>
          {/* 채널 선택 */}
          <div className="cs-quick-memo-field">
            <label className="cs-quick-memo-label">채널</label>
            <div className="cs-quick-memo-channels">
              {CHANNELS.map((ch) => (
                <button
                  key={ch}
                  type="button"
                  className={`cs-quick-memo-channel ${channel === ch ? 'active' : ''}`}
                  onClick={() => setChannel(ch)}
                >
                  <span>{CHANNEL_ICONS[ch]}</span>
                  <span>{CHANNEL_LABELS[ch]}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 문의 유형 */}
          <div className="cs-quick-memo-field">
            <label className="cs-quick-memo-label">유형</label>
            <div className="cs-quick-memo-channels">
              {INQUIRY_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`cs-quick-memo-channel ${inquiryType === t ? 'active' : ''}`}
                  onClick={() => setInquiryType(t)}
                >
                  {INQUIRY_TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          {/* 발신자 정보 */}
          <div className="cs-quick-memo-field">
            <label className="cs-quick-memo-label">발신자</label>
            <div className="cs-quick-memo-caller">
              <input
                type="text"
                className="cs-quick-memo-input"
                placeholder="이름"
                value={callerName}
                onChange={(e) => setCallerName(e.target.value)}
              />
              <input
                type="text"
                className="cs-quick-memo-input"
                placeholder="전화번호"
                value={callerPhone}
                onChange={(e) => setCallerPhone(e.target.value)}
              />
            </div>
          </div>

          {/* 메모 내용 */}
          <div className="cs-quick-memo-field">
            <label className="cs-quick-memo-label">내용</label>
            <textarea
              ref={contentRef}
              className="cs-quick-memo-textarea"
              placeholder="문의/메모 내용을 입력하세요..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
            />
          </div>

          {/* 응대 내용 */}
          <div className="cs-quick-memo-field">
            <label className="cs-quick-memo-label">응대 내용</label>
            <textarea
              className="cs-quick-memo-textarea"
              placeholder="응대 내용을 입력하세요..."
              value={response}
              onChange={(e) => setResponse(e.target.value)}
              rows={2}
            />
          </div>

          {/* 하단 버튼 */}
          <div className="cs-quick-memo-footer">
            <button
              type="button"
              className="cs-quick-memo-cancel-btn"
              onClick={onClose}
            >
              취소
            </button>
            <button
              type="submit"
              className="cs-quick-memo-save-btn"
              disabled={isSubmitting || !content.trim()}
            >
              {isSubmitting ? '저장 중...' : '저장'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default QuickMemoPanel;
