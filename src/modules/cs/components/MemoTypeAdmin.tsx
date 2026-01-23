import { useState, useEffect } from 'react';
import {
  getMemoTypes,
  createMemoType,
  updateMemoType,
  deleteMemoType,
  type MemoType,
} from '../lib/api';

export default function MemoTypeAdmin() {
  const [memoTypes, setMemoTypes] = useState<MemoType[]>([]);
  const [newMemoType, setNewMemoType] = useState('');
  const [newMemoColor, setNewMemoColor] = useState('#6b7280');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 데이터 로드
  useEffect(() => {
    loadMemoTypes();
  }, []);

  const loadMemoTypes = async () => {
    setIsLoading(true);
    try {
      const types = await getMemoTypes(true);
      setMemoTypes(types);
    } catch (err) {
      setError('메모 종류를 불러오는데 실패했습니다.');
      console.error('Load memo types error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddMemoType = async () => {
    const trimmed = newMemoType.trim();
    if (!trimmed) return;
    if (memoTypes.some(t => t.name === trimmed)) {
      setError('이미 존재하는 메모 종류입니다.');
      return;
    }
    try {
      const newId = await createMemoType({
        name: trimmed,
        color: newMemoColor,
        sort_order: memoTypes.length,
      });
      setMemoTypes([...memoTypes, {
        id: newId,
        name: trimmed,
        color: newMemoColor,
        icon: 'comment',
        sort_order: memoTypes.length,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }]);
      setNewMemoType('');
      setNewMemoColor('#6b7280');
      setError(null);
    } catch (err) {
      setError('메모 종류 추가에 실패했습니다.');
      console.error('Add memo type error:', err);
    }
  };

  const handleRemoveMemoType = async (id: number) => {
    if (!confirm('이 메모 종류를 삭제하시겠습니까?')) return;
    try {
      await deleteMemoType(id);
      setMemoTypes(memoTypes.filter(t => t.id !== id));
    } catch (err) {
      setError('메모 종류 삭제에 실패했습니다.');
      console.error('Delete memo type error:', err);
    }
  };

  const handleMoveMemoType = async (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === memoTypes.length - 1) return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    const newTypes = [...memoTypes];
    [newTypes[index], newTypes[newIndex]] = [newTypes[newIndex], newTypes[index]];

    try {
      await Promise.all([
        updateMemoType(newTypes[index].id, { sort_order: index }),
        updateMemoType(newTypes[newIndex].id, { sort_order: newIndex }),
      ]);
      setMemoTypes(newTypes.map((t, i) => ({ ...t, sort_order: i })));
    } catch (err) {
      setError('순서 변경에 실패했습니다.');
      console.error('Move memo type error:', err);
    }
  };

  const handleUpdateMemoColor = async (id: number, color: string) => {
    try {
      await updateMemoType(id, { color });
      setMemoTypes(memoTypes.map(t => t.id === id ? { ...t, color } : t));
    } catch (err) {
      setError('색상 변경에 실패했습니다.');
      console.error('Update memo color error:', err);
    }
  };

  if (isLoading) {
    return (
      <div className="memo-type-admin loading">
        <i className="fa-solid fa-spinner fa-spin"></i> 로딩 중...
      </div>
    );
  }

  return (
    <div className="memo-type-admin">
      <div className="admin-header">
        <h3>메모 종류 관리</h3>
        <p className="admin-desc">타임라인에 추가하는 커스텀 메모의 종류를 관리합니다.</p>
      </div>

      {error && (
        <div className="admin-error">
          <i className="fa-solid fa-exclamation-circle"></i> {error}
          <button onClick={() => setError(null)}>
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>
      )}

      <div className="memo-type-list">
        {memoTypes.map((memoType, index) => (
          <div key={memoType.id} className="memo-type-item">
            <input
              type="color"
              value={memoType.color}
              onChange={(e) => handleUpdateMemoColor(memoType.id, e.target.value)}
              className="memo-type-color-input"
              title="색상 변경"
            />
            <span className="memo-type-name" style={{ color: memoType.color }}>
              {memoType.name}
            </span>
            <div className="memo-type-actions">
              <button
                className="action-btn"
                onClick={() => handleMoveMemoType(index, 'up')}
                disabled={index === 0}
                title="위로 이동"
              >
                <i className="fa-solid fa-chevron-up"></i>
              </button>
              <button
                className="action-btn"
                onClick={() => handleMoveMemoType(index, 'down')}
                disabled={index === memoTypes.length - 1}
                title="아래로 이동"
              >
                <i className="fa-solid fa-chevron-down"></i>
              </button>
              <button
                className="action-btn delete"
                onClick={() => handleRemoveMemoType(memoType.id)}
                title="삭제"
              >
                <i className="fa-solid fa-trash"></i>
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="memo-type-add">
        <input
          type="color"
          value={newMemoColor}
          onChange={(e) => setNewMemoColor(e.target.value)}
          className="memo-type-color-input"
          title="색상 선택"
        />
        <input
          type="text"
          value={newMemoType}
          onChange={(e) => setNewMemoType(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleAddMemoType();
            }
          }}
          placeholder="새 메모 종류 입력..."
          className="memo-type-name-input"
        />
        <button
          className="btn-add"
          onClick={handleAddMemoType}
          disabled={!newMemoType.trim()}
        >
          <i className="fa-solid fa-plus"></i> 추가
        </button>
      </div>

      <style>{`
        .memo-type-admin {
          padding: 20px;
          max-width: 600px;
        }

        .memo-type-admin.loading {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          color: #6b7280;
          padding: 40px;
        }

        .memo-type-admin .admin-header h3 {
          font-size: 16px;
          font-weight: 600;
          color: #1f2937;
          margin: 0 0 4px 0;
        }

        .memo-type-admin .admin-desc {
          font-size: 13px;
          color: #6b7280;
          margin: 0 0 20px 0;
        }

        .memo-type-admin .admin-error {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 12px;
          background: #fee2e2;
          color: #dc2626;
          border-radius: 6px;
          font-size: 13px;
          margin-bottom: 16px;
        }

        .memo-type-admin .admin-error button {
          margin-left: auto;
          background: none;
          border: none;
          color: #dc2626;
          cursor: pointer;
          padding: 2px 6px;
        }

        .memo-type-list {
          display: flex;
          flex-direction: column;
          gap: 6px;
          margin-bottom: 16px;
        }

        .memo-type-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 14px;
          background: #f9fafb;
          border-radius: 8px;
          border: 1px solid #e5e7eb;
        }

        .memo-type-color-input {
          width: 32px;
          height: 32px;
          padding: 0;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          cursor: pointer;
          flex-shrink: 0;
        }

        .memo-type-color-input::-webkit-color-swatch-wrapper {
          padding: 3px;
        }

        .memo-type-color-input::-webkit-color-swatch {
          border: none;
          border-radius: 3px;
        }

        .memo-type-name {
          flex: 1;
          font-size: 14px;
          font-weight: 600;
        }

        .memo-type-actions {
          display: flex;
          gap: 4px;
        }

        .memo-type-actions .action-btn {
          padding: 6px 10px;
          font-size: 12px;
          background: #ffffff;
          border: 1px solid #d1d5db;
          border-radius: 4px;
          color: #6b7280;
          cursor: pointer;
          transition: all 0.15s;
        }

        .memo-type-actions .action-btn:hover:not(:disabled) {
          background: #f3f4f6;
          color: #374151;
        }

        .memo-type-actions .action-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .memo-type-actions .action-btn.delete:hover:not(:disabled) {
          background: #fee2e2;
          border-color: #fecaca;
          color: #dc2626;
        }

        .memo-type-add {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .memo-type-name-input {
          flex: 1;
          padding: 10px 14px;
          font-size: 14px;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          outline: none;
        }

        .memo-type-name-input:focus {
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .memo-type-add .btn-add {
          padding: 10px 18px;
          font-size: 14px;
          font-weight: 500;
          background: #3b82f6;
          color: white;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: all 0.15s;
        }

        .memo-type-add .btn-add:hover:not(:disabled) {
          background: #2563eb;
        }

        .memo-type-add .btn-add:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}
