/**
 * 콜 결과 입력 모달
 */

import React, { useState } from 'react';
import type { CallQueueItem } from '../../types/crm';
import { CALL_TYPE_LABELS } from '../../types/crm';

interface CallResultModalProps {
  queueItem: CallQueueItem;
  onSave: (result: string, content: string) => void;
  onCancel: () => void;
}

const RESULT_OPTIONS = [
  { value: 'connected', label: '통화 완료', icon: 'fa-check-circle' },
  { value: 'callback', label: '콜백 요청', icon: 'fa-phone-flip' },
  { value: 'not_interested', label: '관심 없음', icon: 'fa-hand' },
  { value: 'wrong_number', label: '번호 오류', icon: 'fa-phone-slash' },
];

const CallResultModal: React.FC<CallResultModalProps> = ({
  queueItem,
  onSave,
  onCancel,
}) => {
  const [result, setResult] = useState('connected');
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSave(result, content);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="call-result-modal-overlay" onClick={onCancel}>
      <div className="call-result-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>통화 결과 기록</h3>
          <button className="modal-close" onClick={onCancel}>
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {/* 환자 정보 */}
            <div className="patient-info-bar">
              <span className={`call-type-badge ${queueItem.call_type}`}>
                {CALL_TYPE_LABELS[queueItem.call_type]}
              </span>
              <span className="patient-name">{queueItem.patient?.name}</span>
              <span className="patient-chart">({queueItem.patient?.chart_number})</span>
            </div>

            {/* 통화 결과 선택 */}
            <div className="form-group">
              <label>통화 결과</label>
              <div className="result-options">
                {RESULT_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`result-btn ${result === opt.value ? 'active' : ''}`}
                    onClick={() => setResult(opt.value)}
                  >
                    <i className={`fa-solid ${opt.icon}`}></i>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 내용 입력 */}
            <div className="form-group">
              <label>통화 내용</label>
              <textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder="통화 내용을 입력하세요..."
                rows={4}
                className="form-textarea"
                autoFocus
              />
            </div>
          </div>

          <div className="modal-footer">
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
                  <i className="fa-solid fa-spinner fa-spin"></i>
                  저장 중...
                </>
              ) : (
                <>
                  <i className="fa-solid fa-check"></i>
                  저장
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CallResultModal;
