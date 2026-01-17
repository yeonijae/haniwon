import { useState, useEffect, useCallback } from 'react';
import { getHerbalDiseaseTags, createHerbalDiseaseTag, updateHerbalDiseaseTag, deleteHerbalDiseaseTag, type HerbalDiseaseTag } from '../lib/api';

function HerbalDiseaseAdmin() {
  const [diseases, setDiseases] = useState<HerbalDiseaseTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newDisease, setNewDisease] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');

  // 데이터 로드
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getHerbalDiseaseTags();
      setDiseases(data);
    } catch (error) {
      console.error('질환명 로드 오류:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 추가
  const handleAdd = async () => {
    const trimmed = newDisease.trim();
    if (!trimmed) {
      alert('질환명을 입력해주세요.');
      return;
    }
    if (diseases.some(d => d.name === trimmed)) {
      alert('이미 존재하는 질환명입니다.');
      return;
    }

    setSaving(true);
    try {
      await createHerbalDiseaseTag(trimmed);
      setNewDisease('');
      await loadData();
    } catch (error) {
      console.error('추가 오류:', error);
      alert('추가에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  // 삭제
  const handleDelete = async (disease: HerbalDiseaseTag) => {
    if (!confirm(`'${disease.name}'를 삭제하시겠습니까?\n\n※ 이 태그가 연결된 모든 기록에서도 제거됩니다.`)) return;

    setSaving(true);
    try {
      await deleteHerbalDiseaseTag(disease.id);
      await loadData();
    } catch (error) {
      console.error('삭제 오류:', error);
      alert('삭제에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  // 수정 시작
  const handleEditStart = (disease: HerbalDiseaseTag) => {
    setEditingId(disease.id);
    setEditValue(disease.name);
  };

  // 수정 취소
  const handleEditCancel = () => {
    setEditingId(null);
    setEditValue('');
  };

  // 수정 저장
  const handleEditSave = async () => {
    if (editingId === null) return;
    const trimmed = editValue.trim();
    if (!trimmed) {
      alert('질환명을 입력해주세요.');
      return;
    }
    // 다른 항목과 중복 체크
    if (diseases.some(d => d.id !== editingId && d.name === trimmed)) {
      alert('이미 존재하는 질환명입니다.');
      return;
    }

    setSaving(true);
    try {
      await updateHerbalDiseaseTag(editingId, trimmed);
      setEditingId(null);
      setEditValue('');
      await loadData();
    } catch (error) {
      console.error('수정 오류:', error);
      alert('수정에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="herbal-disease-admin">
        <div className="admin-loading">
          <i className="fa-solid fa-spinner fa-spin"></i> 로딩 중...
        </div>
      </div>
    );
  }

  return (
    <div className="herbal-disease-admin">
      <div className="admin-header">
        <h3>
          <i className="fa-solid fa-tag"></i>
          질환명 태그
        </h3>
      </div>

      {/* 새 항목 추가 */}
      <div className="admin-add-form">
        <input
          type="text"
          placeholder="새 질환명 입력"
          value={newDisease}
          onChange={(e) => setNewDisease(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          disabled={saving}
        />
        <button className="btn-add" onClick={handleAdd} disabled={saving}>
          {saving ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-plus"></i>} 추가
        </button>
      </div>

      {/* 목록 */}
      <div className="admin-list">
        {diseases.length === 0 ? (
          <div className="admin-empty">
            <i className="fa-solid fa-inbox"></i>
            <p>등록된 질환명 태그가 없습니다.</p>
            <p className="admin-empty-hint">위에서 새 질환명을 입력하여 추가하세요.</p>
          </div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th style={{ width: '40px' }}>#</th>
                <th>질환명</th>
                <th style={{ width: '100px' }}>관리</th>
              </tr>
            </thead>
            <tbody>
              {diseases.map((disease, index) => (
                <tr key={disease.id}>
                  <td className="index-cell">{index + 1}</td>
                  {editingId === disease.id ? (
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
                        disabled={saving}
                      />
                    </td>
                  ) : (
                    <td>
                      <span className="disease-tag">{disease.name}</span>
                    </td>
                  )}
                  <td>
                    <div className="actions">
                      {editingId === disease.id ? (
                        <>
                          <button className="btn-save" onClick={handleEditSave} title="저장" disabled={saving}>
                            <i className="fa-solid fa-check"></i>
                          </button>
                          <button className="btn-cancel" onClick={handleEditCancel} title="취소" disabled={saving}>
                            <i className="fa-solid fa-xmark"></i>
                          </button>
                        </>
                      ) : (
                        <>
                          <button className="btn-edit" onClick={() => handleEditStart(disease)} title="수정" disabled={saving}>
                            <i className="fa-solid fa-pen"></i>
                          </button>
                          <button className="btn-delete" onClick={() => handleDelete(disease)} title="삭제" disabled={saving}>
                            <i className="fa-solid fa-trash"></i>
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <style>{`
        .herbal-disease-admin {
          padding: 20px;
          max-width: 800px;
        }

        .admin-header {
          margin-bottom: 20px;
          display: flex;
          flex-direction: column;
        }

        .admin-header h3 {
          margin: 0 0 4px 0;
          font-size: 15px;
          font-weight: 600;
          color: #1f2937;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .admin-header h3 i {
          color: #f59e0b;
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
          border-color: #f59e0b;
        }

        .admin-add-form input:disabled {
          background: #f3f4f6;
        }

        .admin-add-form .btn-add {
          padding: 8px 16px;
          background: #f59e0b;
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 13px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .admin-add-form .btn-add:hover:not(:disabled) {
          background: #d97706;
        }

        .admin-add-form .btn-add:disabled {
          background: #9ca3af;
          cursor: not-allowed;
        }

        .admin-empty {
          padding: 40px;
          text-align: center;
          color: #9ca3af;
          background: #f9fafb;
          border-radius: 8px;
        }

        .admin-empty i {
          font-size: 32px;
          margin-bottom: 12px;
          display: block;
        }

        .admin-empty p {
          margin: 0 0 4px 0;
        }

        .admin-empty-hint {
          font-size: 12px;
          color: #9ca3af;
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
          border: 1px solid #f59e0b;
          border-radius: 4px;
          font-size: 13px;
        }

        .index-cell {
          color: #9ca3af;
          text-align: center;
        }

        .disease-tag {
          display: inline-block;
          padding: 3px 10px;
          background: #fef3c7;
          color: #92400e;
          font-size: 12px;
          font-weight: 500;
          border-radius: 12px;
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

        .actions button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-edit {
          background: #f3f4f6;
          color: #6b7280;
        }

        .btn-edit:hover:not(:disabled) {
          background: #e5e7eb;
          color: #374151;
        }

        .btn-delete {
          background: #fee2e2;
          color: #dc2626;
        }

        .btn-delete:hover:not(:disabled) {
          background: #fecaca;
        }

        .btn-save {
          background: #dcfce7;
          color: #166534;
        }

        .btn-save:hover:not(:disabled) {
          background: #bbf7d0;
        }

        .btn-cancel {
          background: #f3f4f6;
          color: #6b7280;
        }

        .btn-cancel:hover:not(:disabled) {
          background: #e5e7eb;
        }
      `}</style>
    </div>
  );
}

export default HerbalDiseaseAdmin;
