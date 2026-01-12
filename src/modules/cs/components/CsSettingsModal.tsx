import React, { useState, useEffect } from 'react';
import { getMedicinePurposes, setMedicinePurposes, getMembershipTypes, setMembershipTypes } from '../lib/api';

interface CsSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CsSettingsModal({ isOpen, onClose }: CsSettingsModalProps) {
  const [purposes, setPurposes] = useState<string[]>([]);
  const [newPurpose, setNewPurpose] = useState('');
  const [membershipTypes, setMembershipTypesState] = useState<string[]>([]);
  const [newMembershipType, setNewMembershipType] = useState('');
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
      const [purposesData, membershipTypesData] = await Promise.all([
        getMedicinePurposes(),
        getMembershipTypes(),
      ]);
      setPurposes(purposesData);
      setMembershipTypesState(membershipTypesData);
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

  // 멤버십 종류 관리
  const handleAddMembershipType = () => {
    const trimmed = newMembershipType.trim();
    if (!trimmed) return;
    if (membershipTypes.includes(trimmed)) {
      setError('이미 존재하는 멤버십 종류입니다.');
      return;
    }
    setMembershipTypesState([...membershipTypes, trimmed]);
    setNewMembershipType('');
    setError(null);
  };

  const handleRemoveMembershipType = (index: number) => {
    setMembershipTypesState(membershipTypes.filter((_, i) => i !== index));
  };

  const handleMoveMembershipType = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === membershipTypes.length - 1) return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    const newTypes = [...membershipTypes];
    [newTypes[index], newTypes[newIndex]] = [newTypes[newIndex], newTypes[index]];
    setMembershipTypesState(newTypes);
  };

  const handleSave = async () => {
    if (purposes.length === 0) {
      setError('상비약 사용목적은 최소 1개 이상 필요합니다.');
      return;
    }
    if (membershipTypes.length === 0) {
      setError('멤버십 종류는 최소 1개 이상 필요합니다.');
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      await Promise.all([
        setMedicinePurposes(purposes),
        setMembershipTypes(membershipTypes),
      ]);
      onClose();
    } catch (err) {
      setError('저장에 실패했습니다.');
      console.error('Settings save error:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, type: 'purpose' | 'membership') => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (type === 'purpose') {
        handleAddPurpose();
      } else {
        handleAddMembershipType();
      }
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

              {/* 멤버십 종류 관리 */}
              <div className="settings-section">
                <h3>멤버십 종류</h3>
                <p className="section-desc">비급여 항목에서 멤버십 등록 시 선택할 수 있는 종류를 관리합니다.</p>

                <div className="purpose-list">
                  {membershipTypes.map((type, index) => (
                    <div key={index} className="purpose-item">
                      <span className="purpose-name">{type}</span>
                      <div className="purpose-actions">
                        <button
                          className="action-btn"
                          onClick={() => handleMoveMembershipType(index, 'up')}
                          disabled={index === 0}
                          title="위로 이동"
                        >
                          <i className="fa-solid fa-chevron-up"></i>
                        </button>
                        <button
                          className="action-btn"
                          onClick={() => handleMoveMembershipType(index, 'down')}
                          disabled={index === membershipTypes.length - 1}
                          title="아래로 이동"
                        >
                          <i className="fa-solid fa-chevron-down"></i>
                        </button>
                        <button
                          className="action-btn delete"
                          onClick={() => handleRemoveMembershipType(index)}
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
                    value={newMembershipType}
                    onChange={e => setNewMembershipType(e.target.value)}
                    onKeyDown={e => handleKeyDown(e, 'membership')}
                    placeholder="새 멤버십 종류 입력..."
                    className="input-new-purpose"
                  />
                  <button
                    className="btn-add"
                    onClick={handleAddMembershipType}
                    disabled={!newMembershipType.trim()}
                  >
                    <i className="fa-solid fa-plus"></i> 추가
                  </button>
                </div>
              </div>

              {/* 상비약 사용목적 관리 */}
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
                    onKeyDown={e => handleKeyDown(e, 'purpose')}
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
