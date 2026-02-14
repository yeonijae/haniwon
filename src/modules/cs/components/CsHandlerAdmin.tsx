import { useState, useEffect } from 'react';
import {
  getHandlers,
  createHandler,
  updateHandler,
  deleteHandler,
  type CsHandler,
} from '../lib/api';

export default function CsHandlerAdmin() {
  const [handlers, setHandlers] = useState<CsHandler[]>([]);
  const [newHandlerName, setNewHandlerName] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 데이터 로드
  useEffect(() => {
    loadHandlers();
  }, []);

  const loadHandlers = async () => {
    setIsLoading(true);
    try {
      const data = await getHandlers(false);
      setHandlers(data);
    } catch (err) {
      setError('담당자 목록을 불러오는데 실패했습니다.');
      console.error('Load handlers error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddHandler = async () => {
    const trimmed = newHandlerName.trim();
    if (!trimmed) return;
    if (handlers.some(h => h.name === trimmed)) {
      setError('이미 존재하는 담당자입니다.');
      return;
    }
    try {
      const newId = await createHandler(trimmed);
      setHandlers([...handlers, {
        id: newId,
        name: trimmed,
        is_active: true,
        sort_order: handlers.length,
        created_at: new Date().toISOString(),
      }]);
      setNewHandlerName('');
      setError(null);
    } catch (err) {
      setError('담당자 추가에 실패했습니다.');
      console.error('Add handler error:', err);
    }
  };

  const handleDeleteHandler = async (id: number) => {
    if (!confirm('이 담당자를 삭제하시겠습니까?')) return;
    try {
      await deleteHandler(id);
      setHandlers(handlers.filter(h => h.id !== id));
    } catch (err) {
      setError('담당자 삭제에 실패했습니다.');
      console.error('Delete handler error:', err);
    }
  };

  const handleMoveHandler = async (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === handlers.length - 1) return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    const newHandlers = [...handlers];
    [newHandlers[index], newHandlers[newIndex]] = [newHandlers[newIndex], newHandlers[index]];

    try {
      await Promise.all([
        updateHandler(newHandlers[index].id, { sort_order: index }),
        updateHandler(newHandlers[newIndex].id, { sort_order: newIndex }),
      ]);
      setHandlers(newHandlers.map((h, i) => ({ ...h, sort_order: i })));
    } catch (err) {
      setError('순서 변경에 실패했습니다.');
      console.error('Move handler error:', err);
    }
  };

  const handleToggleActive = async (id: number, currentActive: boolean) => {
    try {
      await updateHandler(id, { is_active: !currentActive });
      setHandlers(handlers.map(h => h.id === id ? { ...h, is_active: !currentActive } : h));
    } catch (err) {
      setError('상태 변경에 실패했습니다.');
      console.error('Toggle handler active error:', err);
    }
  };

  const handleStartEdit = (handler: CsHandler) => {
    setEditingId(handler.id);
    setEditingName(handler.name);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingName('');
  };

  const handleSaveEdit = async (id: number) => {
    const trimmed = editingName.trim();
    if (!trimmed) return;
    if (handlers.some(h => h.id !== id && h.name === trimmed)) {
      setError('이미 존재하는 담당자 이름입니다.');
      return;
    }
    try {
      await updateHandler(id, { name: trimmed });
      setHandlers(handlers.map(h => h.id === id ? { ...h, name: trimmed } : h));
      setEditingId(null);
      setEditingName('');
      setError(null);
    } catch (err) {
      setError('담당자 이름 변경에 실패했습니다.');
      console.error('Update handler name error:', err);
    }
  };

  if (isLoading) {
    return (
      <div className="cs-handler-admin loading">
        <i className="fa-solid fa-spinner fa-spin"></i> 로딩 중...
      </div>
    );
  }

  return (
    <div className="cs-handler-admin">
      <div className="admin-header">
        <h3>CS 담당자 관리</h3>
        <p className="admin-desc">CS 업무를 처리하는 담당자를 관리합니다.</p>
      </div>

      {error && (
        <div className="admin-error">
          <i className="fa-solid fa-exclamation-circle"></i> {error}
          <button onClick={() => setError(null)}>
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>
      )}

      <div className="cs-handler-list">
        {handlers.map((handler, index) => (
          <div key={handler.id} className={`cs-handler-item ${!handler.is_active ? 'inactive' : ''}`}>
            {editingId === handler.id ? (
              <input
                type="text"
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSaveEdit(handler.id);
                  }
                  if (e.key === 'Escape') {
                    handleCancelEdit();
                  }
                }}
                className="cs-handler-edit-input"
                autoFocus
              />
            ) : (
              <span
                className="cs-handler-name"
                onDoubleClick={() => handleStartEdit(handler)}
                title="더블클릭하여 이름 수정"
              >
                {handler.name}
              </span>
            )}
            <div className="cs-handler-actions">
              {editingId === handler.id ? (
                <>
                  <button
                    className="action-btn save"
                    onClick={() => handleSaveEdit(handler.id)}
                    title="저장"
                  >
                    <i className="fa-solid fa-check"></i>
                  </button>
                  <button
                    className="action-btn"
                    onClick={handleCancelEdit}
                    title="취소"
                  >
                    <i className="fa-solid fa-xmark"></i>
                  </button>
                </>
              ) : (
                <>
                  <button
                    className={`action-btn toggle ${handler.is_active ? 'active' : ''}`}
                    onClick={() => handleToggleActive(handler.id, handler.is_active)}
                    title={handler.is_active ? '비활성화' : '활성화'}
                  >
                    {handler.is_active ? '활성' : '비활성'}
                  </button>
                  <button
                    className="action-btn"
                    onClick={() => handleStartEdit(handler)}
                    title="이름 수정"
                  >
                    <i className="fa-solid fa-pen"></i>
                  </button>
                  <button
                    className="action-btn"
                    onClick={() => handleMoveHandler(index, 'up')}
                    disabled={index === 0}
                    title="위로 이동"
                  >
                    <i className="fa-solid fa-chevron-up"></i>
                  </button>
                  <button
                    className="action-btn"
                    onClick={() => handleMoveHandler(index, 'down')}
                    disabled={index === handlers.length - 1}
                    title="아래로 이동"
                  >
                    <i className="fa-solid fa-chevron-down"></i>
                  </button>
                  <button
                    className="action-btn delete"
                    onClick={() => handleDeleteHandler(handler.id)}
                    title="삭제"
                  >
                    <i className="fa-solid fa-trash"></i>
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="cs-handler-add">
        <input
          type="text"
          value={newHandlerName}
          onChange={(e) => setNewHandlerName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleAddHandler();
            }
          }}
          placeholder="담당자 이름"
          className="cs-handler-name-input"
        />
        <button
          className="btn-add"
          onClick={handleAddHandler}
          disabled={!newHandlerName.trim()}
        >
          <i className="fa-solid fa-plus"></i> 추가
        </button>
      </div>

      <style>{`
        .cs-handler-admin {
          padding: 20px;
          max-width: 600px;
        }

        .cs-handler-admin.loading {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          color: #6b7280;
          padding: 40px;
        }

        .cs-handler-admin .admin-header h3 {
          font-size: 16px;
          font-weight: 600;
          color: #1f2937;
          margin: 0 0 4px 0;
        }

        .cs-handler-admin .admin-desc {
          font-size: 13px;
          color: #6b7280;
          margin: 0 0 20px 0;
        }

        .cs-handler-admin .admin-error {
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

        .cs-handler-admin .admin-error button {
          margin-left: auto;
          background: none;
          border: none;
          color: #dc2626;
          cursor: pointer;
          padding: 2px 6px;
        }

        .cs-handler-list {
          display: flex;
          flex-direction: column;
          gap: 6px;
          margin-bottom: 16px;
        }

        .cs-handler-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 14px;
          background: #f9fafb;
          border-radius: 8px;
          border: 1px solid #e5e7eb;
        }

        .cs-handler-item.inactive {
          opacity: 0.5;
          background: #f3f4f6;
        }

        .cs-handler-name {
          flex: 1;
          font-size: 14px;
          font-weight: 600;
          color: #1f2937;
          cursor: default;
        }

        .cs-handler-edit-input {
          flex: 1;
          padding: 6px 10px;
          font-size: 14px;
          font-weight: 600;
          border: 1px solid #3b82f6;
          border-radius: 6px;
          outline: none;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .cs-handler-actions {
          display: flex;
          gap: 4px;
        }

        .cs-handler-actions .action-btn {
          padding: 6px 10px;
          font-size: 12px;
          background: #ffffff;
          border: 1px solid #d1d5db;
          border-radius: 4px;
          color: #6b7280;
          cursor: pointer;
          transition: all 0.15s;
        }

        .cs-handler-actions .action-btn:hover:not(:disabled) {
          background: #f3f4f6;
          color: #374151;
        }

        .cs-handler-actions .action-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .cs-handler-actions .action-btn.delete:hover:not(:disabled) {
          background: #fee2e2;
          border-color: #fecaca;
          color: #dc2626;
        }

        .cs-handler-actions .action-btn.save {
          background: #ecfdf5;
          border-color: #a7f3d0;
          color: #059669;
        }

        .cs-handler-actions .action-btn.save:hover {
          background: #d1fae5;
          color: #047857;
        }

        .cs-handler-actions .action-btn.toggle {
          font-size: 11px;
          font-weight: 500;
          min-width: 52px;
          text-align: center;
          background: #f3f4f6;
          color: #9ca3af;
          border-color: #d1d5db;
        }

        .cs-handler-actions .action-btn.toggle.active {
          background: #ecfdf5;
          color: #059669;
          border-color: #a7f3d0;
        }

        .cs-handler-add {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .cs-handler-name-input {
          flex: 1;
          padding: 10px 14px;
          font-size: 14px;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          outline: none;
        }

        .cs-handler-name-input:focus {
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .cs-handler-add .btn-add {
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

        .cs-handler-add .btn-add:hover:not(:disabled) {
          background: #2563eb;
        }

        .cs-handler-add .btn-add:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}
