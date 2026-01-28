/**
 * 메시지 발송 모달
 * 템플릿 선택 + 변수 입력 + 미리보기 + 발송
 */

import React, { useState, useEffect, useMemo } from 'react';
import type { MessageTemplate, MessageChannel, SendMessageRequest } from '../../types/crm';
import { MESSAGE_CHANNEL_LABELS } from '../../types/crm';
import {
  getTemplatesByChannel,
  replaceTemplateVariables,
  sendMessage,
} from '../../lib/messageApi';
import './MessageSendModal.css';

interface MessageSendModalProps {
  isOpen: boolean;
  onClose: () => void;
  // 수신자 정보
  patientId?: number;
  patientName?: string;
  phone: string;
  // 기본값
  defaultChannel?: MessageChannel;
  // 콜백
  onSuccess?: () => void;
  createdBy?: string;
}

const MessageSendModal: React.FC<MessageSendModalProps> = ({
  isOpen,
  onClose,
  patientId,
  patientName,
  phone,
  defaultChannel = 'sms',
  onSuccess,
  createdBy,
}) => {
  const [channel, setChannel] = useState<MessageChannel>(defaultChannel);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [customContent, setCustomContent] = useState('');
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // 선택된 템플릿
  const selectedTemplate = useMemo(
    () => templates.find(t => t.id === selectedTemplateId) || null,
    [templates, selectedTemplateId]
  );

  // 미리보기 내용
  const previewContent = useMemo(() => {
    if (selectedTemplate) {
      return replaceTemplateVariables(selectedTemplate.content, variables);
    }
    return customContent;
  }, [selectedTemplate, customContent, variables]);

  // 템플릿 로드
  useEffect(() => {
    if (!isOpen) return;

    const loadTemplates = async () => {
      setIsLoading(true);
      try {
        const data = await getTemplatesByChannel(channel);
        setTemplates(data);
        // 첫 번째 템플릿 자동 선택
        if (data.length > 0) {
          setSelectedTemplateId(data[0].id);
        } else {
          setSelectedTemplateId(null);
        }
      } catch (error) {
        console.error('템플릿 로드 오류:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadTemplates();
  }, [isOpen, channel]);

  // 템플릿 변경 시 변수 초기화
  useEffect(() => {
    if (selectedTemplate) {
      const initialVars: Record<string, string> = {};
      for (const v of selectedTemplate.variables || []) {
        // 환자 이름 자동 채우기
        if (v === 'name' && patientName) {
          initialVars[v] = patientName;
        } else {
          initialVars[v] = '';
        }
      }
      setVariables(initialVars);
    }
  }, [selectedTemplate, patientName]);

  // 채널 변경
  const handleChannelChange = (newChannel: MessageChannel) => {
    setChannel(newChannel);
    setSelectedTemplateId(null);
    setCustomContent('');
    setVariables({});
  };

  // 발송
  const handleSend = async () => {
    const content = selectedTemplate ? selectedTemplate.content : customContent;

    if (!content.trim()) {
      alert('메시지 내용을 입력해주세요.');
      return;
    }

    if (!phone) {
      alert('수신자 연락처가 없습니다.');
      return;
    }

    setIsSending(true);
    try {
      const request: SendMessageRequest = {
        patient_id: patientId,
        template_id: selectedTemplate?.id,
        channel,
        phone,
        content,
        variables: Object.keys(variables).length > 0 ? variables : undefined,
        created_by: createdBy,
      };

      await sendMessage(request);
      alert('메시지가 발송되었습니다.');
      onSuccess?.();
      onClose();
    } catch (error: any) {
      console.error('메시지 발송 오류:', error);
      alert(error.message || '발송에 실패했습니다.');
    } finally {
      setIsSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="message-send-overlay" onClick={onClose}>
      <div className="message-send-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>메시지 발송</h3>
          <button className="modal-close" onClick={onClose}>
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div className="modal-body">
          {/* 수신자 정보 */}
          <div className="recipient-info">
            <span className="recipient-label">수신자:</span>
            {patientName && <span className="recipient-name">{patientName}</span>}
            <span className="recipient-phone">{phone}</span>
          </div>

          {/* 채널 선택 */}
          <div className="form-group">
            <label>발송 채널</label>
            <div className="channel-tabs">
              {(['sms', 'kakao'] as MessageChannel[]).map(ch => (
                <button
                  key={ch}
                  className={`channel-tab ${channel === ch ? 'active' : ''}`}
                  onClick={() => handleChannelChange(ch)}
                >
                  <i className={`fa-solid ${ch === 'sms' ? 'fa-message' : 'fa-comment'}`}></i>
                  {MESSAGE_CHANNEL_LABELS[ch]}
                </button>
              ))}
            </div>
          </div>

          {/* 템플릿 선택 */}
          <div className="form-group">
            <label>템플릿 선택</label>
            {isLoading ? (
              <div className="loading-templates">로딩 중...</div>
            ) : templates.length === 0 ? (
              <div className="no-templates">
                등록된 템플릿이 없습니다.
                <button
                  className="btn-custom-input"
                  onClick={() => setSelectedTemplateId(null)}
                >
                  직접 입력
                </button>
              </div>
            ) : (
              <div className="template-list">
                {templates.map(t => (
                  <button
                    key={t.id}
                    className={`template-item ${selectedTemplateId === t.id ? 'active' : ''}`}
                    onClick={() => setSelectedTemplateId(t.id)}
                  >
                    <span className="template-name">{t.name}</span>
                    {t.category && <span className="template-category">{t.category}</span>}
                  </button>
                ))}
                <button
                  className={`template-item custom ${selectedTemplateId === null ? 'active' : ''}`}
                  onClick={() => setSelectedTemplateId(null)}
                >
                  <i className="fa-solid fa-pen"></i>
                  직접 입력
                </button>
              </div>
            )}
          </div>

          {/* 변수 입력 (템플릿 선택 시) */}
          {selectedTemplate && selectedTemplate.variables && selectedTemplate.variables.length > 0 && (
            <div className="form-group">
              <label>변수 입력</label>
              <div className="variables-grid">
                {selectedTemplate.variables.map(v => (
                  <div key={v} className="variable-input">
                    <span className="variable-name">{`{{${v}}}`}</span>
                    <input
                      type="text"
                      value={variables[v] || ''}
                      onChange={e => setVariables({ ...variables, [v]: e.target.value })}
                      placeholder={v}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 직접 입력 (템플릿 미선택 시) */}
          {selectedTemplateId === null && (
            <div className="form-group">
              <label>메시지 내용</label>
              <textarea
                value={customContent}
                onChange={e => setCustomContent(e.target.value)}
                placeholder="메시지 내용을 입력하세요..."
                rows={4}
              />
            </div>
          )}

          {/* 미리보기 */}
          <div className="form-group">
            <label>미리보기</label>
            <div className="message-preview">
              {previewContent || '(내용 없음)'}
            </div>
            <div className="message-length">
              {previewContent.length}자
              {channel === 'sms' && previewContent.length > 90 && (
                <span className="length-warning"> (장문 메시지)</span>
              )}
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-cancel" onClick={onClose} disabled={isSending}>
            취소
          </button>
          <button
            className="btn-send"
            onClick={handleSend}
            disabled={isSending || !previewContent.trim()}
          >
            {isSending ? (
              <>
                <i className="fa-solid fa-spinner fa-spin"></i>
                발송 중...
              </>
            ) : (
              <>
                <i className="fa-solid fa-paper-plane"></i>
                발송
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MessageSendModal;
