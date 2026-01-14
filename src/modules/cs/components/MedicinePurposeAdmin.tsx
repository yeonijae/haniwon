import { useState, useEffect, useCallback } from 'react';
import { getMedicinePurposes, setMedicinePurposes } from '../lib/api';

function MedicinePurposeAdmin() {
  const [purposes, setPurposes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newPurpose, setNewPurpose] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const [hasChanges, setHasChanges] = useState(false);

  // 데이터 로드
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getMedicinePurposes();
      setPurposes(data);
      setHasChanges(false);
    } catch (error) {
      console.error('사용목적 로드 오류:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 추가
  const handleAdd = () => {
    const trimmed = newPurpose.trim();
    if (!trimmed) {
      alert('사용목적을 입력해주세요.');
      return;
    }
    if (purposes.includes(trimmed)) {
      alert('이미 존재하는 사용목적입니다.');
      return;
    }
    setPurposes([...purposes, trimmed]);
    setNewPurpose('');
    setHasChanges(true);
  };

  // 삭제
  const handleDelete = (index: number) => {
    if (purposes.length <= 1) {
      alert('최소 1개 이상의 사용목적이 필요합니다.');
      return;
    }
    if (!confirm(`'${purposes[index]}'를 삭제하시겠습니까?`)) return;
    setPurposes(purposes.filter((_, i) => i !== index));
    setHasChanges(true);
  };

  // 순서 이동
  const handleMove = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === purposes.length - 1) return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    const newPurposes = [...purposes];
    [newPurposes[index], newPurposes[newIndex]] = [newPurposes[newIndex], newPurposes[index]];
    setPurposes(newPurposes);
    setHasChanges(true);
  };

  // 수정 시작
  const handleEditStart = (index: number) => {
    setEditingIndex(index);
    setEditValue(purposes[index]);
  };

  // 수정 취소
  const handleEditCancel = () => {
    setEditingIndex(null);
    setEditValue('');
  };

  // 수정 저장
  const handleEditSave = () => {
    if (editingIndex === null) return;
    const trimmed = editValue.trim();
    if (!trimmed) {
      alert('사용목적을 입력해주세요.');
      return;
    }
    // 다른 항목과 중복 체크
    if (purposes.some((p, i) => i !== editingIndex && p === trimmed)) {
      alert('이미 존재하는 사용목적입니다.');
      return;
    }
    const newPurposes = [...purposes];
    newPurposes[editingIndex] = trimmed;
    setPurposes(newPurposes);
    setEditingIndex(null);
    setEditValue('');
    setHasChanges(true);
  };

  // 저장
  const handleSave = async () => {
    if (purposes.length === 0) {
      alert('최소 1개 이상의 사용목적이 필요합니다.');
      return;
    }

    try {
      setSaving(true);
      await setMedicinePurposes(purposes);
      setHasChanges(false);
      alert('저장되었습니다.');
    } catch (error) {
      console.error('저장 오류:', error);
      alert('저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="medicine-purpose-admin">
        <div className="admin-loading">
          <i className="fa-solid fa-spinner fa-spin"></i> 로딩 중...
        </div>
      </div>
    );
  }

  return (
    <div className="medicine-purpose-admin">
      <div className="admin-header">
        <h3>
          <i className="fa-solid fa-pills"></i>
          상비약 사용목적 관리
        </h3>
        <p className="admin-description">
          상비약 기록 시 선택할 수 있는 사용목적 옵션을 관리합니다.
        </p>
      </div>

      {/* 새 항목 추가 */}
      <div className="admin-add-form">
        <input
          type="text"
          placeholder="새 사용목적 입력"
          value={newPurpose}
          onChange={(e) => setNewPurpose(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        />
        <button className="btn-add" onClick={handleAdd}>
          <i className="fa-solid fa-plus"></i> 추가
        </button>
      </div>

      {/* 목록 */}
      <div className="admin-list">
        {purposes.length === 0 ? (
          <div className="admin-empty">
            등록된 사용목적이 없습니다.
          </div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th style={{ width: '40px' }}>#</th>
                <th>사용목적</th>
                <th style={{ width: '120px' }}>순서</th>
                <th style={{ width: '100px' }}>관리</th>
              </tr>
            </thead>
            <tbody>
              {purposes.map((purpose, index) => (
                <tr key={index}>
                  <td className="index-cell">{index + 1}</td>
                  {editingIndex === index ? (
                    <td>
                      <input
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleEditSave();
                          if (e.key === 'Escape') handleEditCancel();
                        }}
                        autoFocus
                      />
                    </td>
                  ) : (
                    <td>{purpose}</td>
                  )}
                  <td className="order-actions">
                    <button
                      className="btn-move"
                      onClick={() => handleMove(index, 'up')}
                      disabled={index === 0}
                      title="위로"
                    >
                      <i className="fa-solid fa-chevron-up"></i>
                    </button>
                    <button
                      className="btn-move"
                      onClick={() => handleMove(index, 'down')}
                      disabled={index === purposes.length - 1}
                      title="아래로"
                    >
                      <i className="fa-solid fa-chevron-down"></i>
                    </button>
                  </td>
                  <td className="actions">
                    {editingIndex === index ? (
                      <>
                        <button className="btn-save" onClick={handleEditSave} title="저장">
                          <i className="fa-solid fa-check"></i>
                        </button>
                        <button className="btn-cancel" onClick={handleEditCancel} title="취소">
                          <i className="fa-solid fa-xmark"></i>
                        </button>
                      </>
                    ) : (
                      <>
                        <button className="btn-edit" onClick={() => handleEditStart(index)} title="수정">
                          <i className="fa-solid fa-pen"></i>
                        </button>
                        <button className="btn-delete" onClick={() => handleDelete(index)} title="삭제">
                          <i className="fa-solid fa-trash"></i>
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 저장 버튼 */}
      <div className="admin-footer">
        <button
          className={`btn-save-all ${hasChanges ? 'has-changes' : ''}`}
          onClick={handleSave}
          disabled={saving || !hasChanges}
        >
          {saving ? (
            <>
              <i className="fa-solid fa-spinner fa-spin"></i> 저장 중...
            </>
          ) : (
            <>
              <i className="fa-solid fa-floppy-disk"></i> 저장
            </>
          )}
        </button>
        {hasChanges && <span className="unsaved-note">저장되지 않은 변경사항이 있습니다.</span>}
      </div>

      <style>{`
        .medicine-purpose-admin {
          padding: 20px;
          max-width: 600px;
        }

        .admin-header {
          margin-bottom: 20px;
        }

        .admin-header h3 {
          margin: 0 0 8px 0;
          font-size: 16px;
          font-weight: 600;
          color: #1f2937;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .admin-header h3 i {
          color: #3b82f6;
        }

        .admin-description {
          margin: 0;
          font-size: 13px;
          color: #6b7280;
        }

        .admin-loading {
          padding: 40px;
          text-align: center;
          color: #6b7280;
        }

        .admin-add-form {
          display: flex;
          gap: 8px;
          margin-bottom: 16px;
          padding: 12px;
          background: #f9fafb;
          border-radius: 8px;
        }

        .admin-add-form input {
          flex: 1;
          padding: 8px 12px;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 13px;
        }

        .admin-add-form input:focus {
          outline: none;
          border-color: #3b82f6;
        }

        .admin-add-form .btn-add {
          padding: 8px 16px;
          background: #3b82f6;
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 13px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .admin-add-form .btn-add:hover {
          background: #2563eb;
        }

        .admin-empty {
          padding: 40px;
          text-align: center;
          color: #9ca3af;
          background: #f9fafb;
          border-radius: 8px;
        }

        .admin-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }

        .admin-table th {
          padding: 10px 12px;
          text-align: left;
          background: #f3f4f6;
          font-weight: 600;
          color: #374151;
          border-bottom: 1px solid #e5e7eb;
        }

        .admin-table td {
          padding: 10px 12px;
          border-bottom: 1px solid #e5e7eb;
        }

        .admin-table tr:hover {
          background: #f9fafb;
        }

        .admin-table input {
          width: 100%;
          padding: 6px 10px;
          border: 1px solid #3b82f6;
          border-radius: 4px;
          font-size: 13px;
        }

        .index-cell {
          color: #9ca3af;
          text-align: center;
        }

        .order-actions {
          display: flex;
          gap: 4px;
        }

        .btn-move {
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid #d1d5db;
          border-radius: 4px;
          background: white;
          cursor: pointer;
          font-size: 10px;
          color: #6b7280;
        }

        .btn-move:hover:not(:disabled) {
          background: #f3f4f6;
          border-color: #9ca3af;
        }

        .btn-move:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }

        .actions {
          display: flex;
          gap: 6px;
        }

        .actions button {
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
        }

        .btn-edit {
          background: #f3f4f6;
          color: #6b7280;
        }

        .btn-edit:hover {
          background: #e5e7eb;
          color: #374151;
        }

        .btn-delete {
          background: #fee2e2;
          color: #dc2626;
        }

        .btn-delete:hover {
          background: #fecaca;
        }

        .btn-save {
          background: #dcfce7;
          color: #166534;
        }

        .btn-save:hover {
          background: #bbf7d0;
        }

        .btn-cancel {
          background: #f3f4f6;
          color: #6b7280;
        }

        .btn-cancel:hover {
          background: #e5e7eb;
        }

        .admin-footer {
          margin-top: 20px;
          padding-top: 16px;
          border-top: 1px solid #e5e7eb;
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .btn-save-all {
          padding: 10px 20px;
          background: #e5e7eb;
          color: #6b7280;
          border: none;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 500;
          cursor: not-allowed;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .btn-save-all.has-changes {
          background: #3b82f6;
          color: white;
          cursor: pointer;
        }

        .btn-save-all.has-changes:hover {
          background: #2563eb;
        }

        .unsaved-note {
          font-size: 12px;
          color: #f59e0b;
        }
      `}</style>
    </div>
  );
}

export default MedicinePurposeAdmin;
