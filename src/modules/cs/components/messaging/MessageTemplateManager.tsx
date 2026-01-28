/**
 * 메시지 템플릿 관리 컴포넌트
 * 설정 화면에서 사용
 */

import React, { useState, useEffect, useCallback } from 'react';
import type { MessageTemplate, MessageChannel, CreateMessageTemplateRequest } from '../../types/crm';
import { MESSAGE_CHANNEL_LABELS } from '../../types/crm';
import {
  getMessageTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
} from '../../lib/messageApi';
import './MessageTemplateManager.css';

const MessageTemplateManager: React.FC = () => {
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);

  // 폼 상태
  const [formData, setFormData] = useState<CreateMessageTemplateRequest>({
    name: '',
    channel: 'sms',
    category: '',
    content: '',
    variables: [],
  });
  const [variablesText, setVariablesText] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // 템플릿 로드
  const loadTemplates = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getMessageTemplates();
      setTemplates(data);
    } catch (error) {
      console.error('템플릿 로드 오류:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  // 폼 초기화
  const resetForm = () => {
    setFormData({
      name: '',
      channel: 'sms',
      category: '',
      content: '',
      variables: [],
    });
    setVariablesText('');
    setEditingTemplate(null);
    setShowForm(false);
  };

  // 신규 추가
  const handleAdd = () => {
    resetForm();
    setShowForm(true);
  };

  // 수정
  const handleEdit = (template: MessageTemplate) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      channel: template.channel,
      category: template.category || '',
      content: template.content,
      variables: template.variables || [],
    });
    setVariablesText((template.variables || []).join(', '));
    setShowForm(true);
  };

  // 삭제
  const handleDelete = async (template: MessageTemplate) => {
    if (!confirm(`"${template.name}" 템플릿을 삭제하시겠습니까?`)) return;

    try {
      await deleteTemplate(template.id);
      loadTemplates();
    } catch (error) {
      console.error('템플릿 삭제 오류:', error);
      alert('삭제에 실패했습니다.');
    }
  };

  // 활성/비활성 토글
  const handleToggleActive = async (template: MessageTemplate) => {
    try {
      await updateTemplate(template.id, { is_active: !template.is_active });
      loadTemplates();
    } catch (error) {
      console.error('상태 변경 오류:', error);
    }
  };

  // 저장
  const handleSave = async () => {
    if (!formData.name.trim()) {
      alert('템플릿 이름을 입력해주세요.');
      return;
    }
    if (!formData.content.trim()) {
      alert('메시지 내용을 입력해주세요.');
      return;
    }

    // 변수 파싱
    const variables = variablesText
      .split(',')
      .map(v => v.trim())
      .filter(v => v);

    setIsSaving(true);
    try {
      const data = { ...formData, variables };

      if (editingTemplate) {
        await updateTemplate(editingTemplate.id, data);
      } else {
        await createTemplate(data);
      }

      resetForm();
      loadTemplates();
    } catch (error) {
      console.error('저장 오류:', error);
      alert('저장에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  // 내용에서 변수 자동 추출
  const extractVariables = (content: string): string[] => {
    const matches = content.match(/{{(\w+)}}/g);
    if (!matches) return [];
    return [...new Set(matches.map(m => m.replace(/[{}]/g, '')))];
  };

  // 내용 변경 시 변수 자동 추출
  const handleContentChange = (content: string) => {
    setFormData({ ...formData, content });
    const extracted = extractVariables(content);
    if (extracted.length > 0) {
      setVariablesText(extracted.join(', '));
    }
  };

  return (
    <div className="template-manager">
      <div className="manager-header">
        <h3>메시지 템플릿 관리</h3>
        <button className="btn-add" onClick={handleAdd}>
          <i className="fa-solid fa-plus"></i>
          템플릿 추가
        </button>
      </div>

      {/* 템플릿 목록 */}
      {isLoading ? (
        <div className="loading-state">로딩 중...</div>
      ) : templates.length === 0 ? (
        <div className="empty-state">
          <i className="fa-solid fa-file-lines"></i>
          <span>등록된 템플릿이 없습니다.</span>
        </div>
      ) : (
        <div className="template-table">
          <table>
            <thead>
              <tr>
                <th>이름</th>
                <th>채널</th>
                <th>분류</th>
                <th>내용</th>
                <th>상태</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {templates.map(t => (
                <tr key={t.id} className={!t.is_active ? 'inactive' : ''}>
                  <td className="template-name">{t.name}</td>
                  <td>
                    <span className={`channel-badge ${t.channel}`}>
                      {MESSAGE_CHANNEL_LABELS[t.channel]}
                    </span>
                  </td>
                  <td className="template-category">{t.category || '-'}</td>
                  <td className="template-content">
                    <span title={t.content}>
                      {t.content.length > 40 ? t.content.slice(0, 40) + '...' : t.content}
                    </span>
                  </td>
                  <td>
                    <button
                      className={`status-toggle ${t.is_active ? 'active' : 'inactive'}`}
                      onClick={() => handleToggleActive(t)}
                    >
                      {t.is_active ? '활성' : '비활성'}
                    </button>
                  </td>
                  <td className="actions">
                    <button className="btn-edit" onClick={() => handleEdit(t)}>
                      <i className="fa-solid fa-pen"></i>
                    </button>
                    <button className="btn-delete" onClick={() => handleDelete(t)}>
                      <i className="fa-solid fa-trash"></i>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 추가/수정 폼 */}
      {showForm && (
        <div className="template-form-overlay" onClick={resetForm}>
          <div className="template-form" onClick={e => e.stopPropagation()}>
            <div className="form-header">
              <h4>{editingTemplate ? '템플릿 수정' : '새 템플릿'}</h4>
              <button className="btn-close" onClick={resetForm}>
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <div className="form-body">
              <div className="form-row">
                <div className="form-group">
                  <label>템플릿 이름 *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    placeholder="예: 예약 확인 안내"
                  />
                </div>
                <div className="form-group">
                  <label>분류</label>
                  <input
                    type="text"
                    value={formData.category}
                    onChange={e => setFormData({ ...formData, category: e.target.value })}
                    placeholder="예: 예약, 배송"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>발송 채널</label>
                <div className="channel-options">
                  {(['sms', 'kakao'] as MessageChannel[]).map(ch => (
                    <label key={ch} className="channel-option">
                      <input
                        type="radio"
                        checked={formData.channel === ch}
                        onChange={() => setFormData({ ...formData, channel: ch })}
                      />
                      {MESSAGE_CHANNEL_LABELS[ch]}
                    </label>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label>
                  메시지 내용 *
                  <span className="label-hint">변수는 {'{{변수명}}'} 형식으로 입력</span>
                </label>
                <textarea
                  value={formData.content}
                  onChange={e => handleContentChange(e.target.value)}
                  placeholder="[한의원] {{name}}님, {{date}} 예약이 확정되었습니다."
                  rows={4}
                />
                <div className="content-length">{formData.content.length}자</div>
              </div>

              <div className="form-group">
                <label>변수 목록 (자동 추출)</label>
                <input
                  type="text"
                  value={variablesText}
                  onChange={e => setVariablesText(e.target.value)}
                  placeholder="name, date, time"
                />
                <div className="form-hint">쉼표로 구분하여 입력</div>
              </div>
            </div>

            <div className="form-footer">
              <button className="btn-cancel" onClick={resetForm} disabled={isSaving}>
                취소
              </button>
              <button className="btn-save" onClick={handleSave} disabled={isSaving}>
                {isSaving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MessageTemplateManager;
