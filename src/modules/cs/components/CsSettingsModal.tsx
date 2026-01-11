import React, { useState, useEffect } from 'react';
import { getMedicinePurposes, setMedicinePurposes } from '../lib/api';

interface CsSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CsSettingsModal({ isOpen, onClose }: CsSettingsModalProps) {
  const [purposes, setPurposes] = useState<string[]>([]);
  const [newPurpose, setNewPurpose] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 설정 로드
  useEffect(() => {
    if (isOpen) {
      loadSettings();
    }
  }, [isOpen]);

  const loadSettings = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getMedicinePurposes();
      setPurposes(data);
    } catch (err) {
      setError('설정을 불러오는데 실패했습니다.');
      console.error('Settings load error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddPurpose = () => {
    const trimmed = newPurpose.trim();
    if (!trimmed) return;
    if (purposes.includes(trimmed)) {
      setError('이미 존재하는 항목입니다.');
      return;
    }
    setPurposes([...purposes, trimmed]);
    setNewPurpose('');
    setError(null);
  };

  const handleRemovePurpose = (index: number) => {
    setPurposes(purposes.filter((_, i) => i !== index));
  };

  const handleMovePurpose = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === purposes.length - 1) return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    const newPurposes = [...purposes];
    [newPurposes[index], newPurposes[newIndex]] = [newPurposes[newIndex], newPurposes[index]];
    setPurposes(newPurposes);
  };

  const handleSave = async () => {
    if (purposes.length === 0) {
      setError('최소 1개 이상의 항목이 필요합니다.');
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      await setMedicinePurposes(purposes);
      onClose();
    } catch (err) {
      setError('저장에 실패했습니다.');
      console.error('Settings save error:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddPurpose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content cs-settings-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2><i className="fa-solid fa-gear"></i> CS 설정</h2>
          <button className="close-btn" onClick={onClose}>
            <i className="fa-solid fa-times"></i>
          </button>
        </div>

        <div className="modal-body">
          {isLoading ? (
            <div className="loading-state">
              <i className="fa-solid fa-spinner fa-spin"></i> 로딩 중...
            </div>
          ) : (
            <>
              {error && (
                <div className="error-message">
                  <i className="fa-solid fa-exclamation-circle"></i> {error}
                </div>
              )}

              <div className="settings-section">
                <h3>상비약 사용목적</h3>
                <p className="section-desc">상비약 기록 시 선택할 수 있는 사용목적 옵션을 관리합니다.</p>

                <div className="purpose-list">
                  {purposes.map((purpose, index) => (
                    <div key={index} className="purpose-item">
                      <span className="purpose-name">{purpose}</span>
                      <div className="purpose-actions">
                        <button
                          className="action-btn"
                          onClick={() => handleMovePurpose(index, 'up')}
                          disabled={index === 0}
                          title="위로 이동"
                        >
                          <i className="fa-solid fa-chevron-up"></i>
                        </button>
                        <button
                          className="action-btn"
                          onClick={() => handleMovePurpose(index, 'down')}
                          disabled={index === purposes.length - 1}
                          title="아래로 이동"
                        >
                          <i className="fa-solid fa-chevron-down"></i>
                        </button>
                        <button
                          className="action-btn delete"
                          onClick={() => handleRemovePurpose(index)}
                          title="삭제"
                        >
                          <i className="fa-solid fa-trash"></i>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="add-purpose">
                  <input
                    type="text"
                    value={newPurpose}
                    onChange={e => setNewPurpose(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="새 사용목적 입력..."
                    className="input-new-purpose"
                  />
                  <button
                    className="btn-add"
                    onClick={handleAddPurpose}
                    disabled={!newPurpose.trim()}
                  >
                    <i className="fa-solid fa-plus"></i> 추가
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn-cancel" onClick={onClose}>
            취소
          </button>
          <button
            className="btn-save"
            onClick={handleSave}
            disabled={isLoading || isSaving}
          >
            {isSaving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}
