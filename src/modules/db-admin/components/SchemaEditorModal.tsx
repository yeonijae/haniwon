/**
 * 스키마 편집 모달 컴포넌트
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import type { ColumnInfo } from '../types';
import { addColumn, dropColumn, renameColumn, alterColumnType, alterColumnNullable, getColumns } from '../lib/api';

// PostgreSQL 기본 데이터 타입 목록
const PG_TYPES = [
  'INTEGER',
  'BIGINT',
  'SMALLINT',
  'SERIAL',
  'BIGSERIAL',
  'NUMERIC',
  'REAL',
  'DOUBLE PRECISION',
  'VARCHAR(255)',
  'VARCHAR(100)',
  'VARCHAR(50)',
  'TEXT',
  'CHAR(1)',
  'BOOLEAN',
  'DATE',
  'TIME',
  'TIMESTAMP',
  'TIMESTAMPTZ',
  'UUID',
  'JSON',
  'JSONB',
];

interface Props {
  tableName: string;
  columns: ColumnInfo[];
  onClose: () => void;
  onSchemaChange: () => void;
}

type EditMode = 'view' | 'add' | 'rename' | 'changeType';

interface EditState {
  mode: EditMode;
  targetColumn?: string;
  newName?: string;
  newType?: string;
  // 추가용
  addName?: string;
  addType?: string;
  addNullable?: boolean;
  addDefault?: string;
}

export function SchemaEditorModal({ tableName, columns: propColumns, onClose, onSchemaChange }: Props) {
  const [editState, setEditState] = useState<EditState>({ mode: 'view' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 내부 컬럼 상태 (props가 비어있을 때 직접 로드)
  const [internalColumns, setInternalColumns] = useState<ColumnInfo[]>([]);
  const [columnsLoading, setColumnsLoading] = useState(false);

  // 실제 사용할 컬럼 (props 또는 내부 상태)
  const columns = propColumns.length > 0 ? propColumns : internalColumns;

  // props가 비어있으면 직접 컬럼 로드
  useEffect(() => {
    if (propColumns.length === 0) {
      loadColumns();
    }
  }, [tableName, propColumns.length]);

  const loadColumns = async () => {
    setColumnsLoading(true);
    try {
      const cols = await getColumns('postgres', tableName);
      setInternalColumns(cols);
    } catch (error) {
      console.error('Failed to load columns:', error);
      setError('컬럼 정보를 불러오는데 실패했습니다.');
    } finally {
      setColumnsLoading(false);
    }
  };

  // Drag state
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const modalRef = useRef<HTMLDivElement>(null);

  // Drag handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (modalRef.current) {
      const rect = modalRef.current.getBoundingClientRect();
      dragOffset.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
      setIsDragging(true);
    }
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragOffset.current.x,
        y: e.clientY - dragOffset.current.y,
      });
    }
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Attach/detach global mouse events
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const resetEdit = () => {
    setEditState({ mode: 'view' });
    setError(null);
  };

  // 컬럼 추가
  const handleAddColumn = async () => {
    if (!editState.addName || !editState.addType) {
      setError('컬럼 이름과 타입을 입력하세요.');
      return;
    }

    setLoading(true);
    setError(null);

    const result = await addColumn(
      tableName,
      editState.addName,
      editState.addType,
      editState.addNullable ?? true,
      editState.addDefault
    );

    setLoading(false);

    if (result.success) {
      onSchemaChange();
      if (propColumns.length === 0) loadColumns();
      resetEdit();
    } else {
      setError(result.error || '컬럼 추가 실패');
    }
  };

  // 컬럼 삭제
  const handleDropColumn = async (columnName: string) => {
    if (!confirm(`"${columnName}" 컬럼을 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없으며, 해당 컬럼의 모든 데이터가 삭제됩니다.`)) {
      return;
    }

    setLoading(true);
    setError(null);

    const result = await dropColumn(tableName, columnName);

    setLoading(false);

    if (result.success) {
      onSchemaChange();
      if (propColumns.length === 0) loadColumns();
    } else {
      setError(result.error || '컬럼 삭제 실패');
    }
  };

  // 컬럼 이름 변경
  const handleRenameColumn = async () => {
    if (!editState.targetColumn || !editState.newName) {
      setError('새 컬럼 이름을 입력하세요.');
      return;
    }

    if (editState.targetColumn === editState.newName) {
      resetEdit();
      return;
    }

    setLoading(true);
    setError(null);

    const result = await renameColumn(tableName, editState.targetColumn, editState.newName);

    setLoading(false);

    if (result.success) {
      onSchemaChange();
      if (propColumns.length === 0) loadColumns();
      resetEdit();
    } else {
      setError(result.error || '이름 변경 실패');
    }
  };

  // 컬럼 타입 변경
  const handleChangeType = async () => {
    if (!editState.targetColumn || !editState.newType) {
      setError('새 타입을 선택하세요.');
      return;
    }

    setLoading(true);
    setError(null);

    const result = await alterColumnType(tableName, editState.targetColumn, editState.newType);

    setLoading(false);

    if (result.success) {
      onSchemaChange();
      if (propColumns.length === 0) loadColumns();
      resetEdit();
    } else {
      setError(result.error || '타입 변경 실패');
    }
  };

  // NULL 허용 토글
  const handleToggleNullable = async (column: ColumnInfo) => {
    const action = column.isNullable ? 'NOT NULL로 변경' : 'NULL 허용으로 변경';
    if (!confirm(`"${column.name}" 컬럼을 ${action}하시겠습니까?`)) {
      return;
    }

    setLoading(true);
    setError(null);

    const result = await alterColumnNullable(tableName, column.name, !column.isNullable);

    setLoading(false);

    if (result.success) {
      onSchemaChange();
      if (propColumns.length === 0) loadColumns();
    } else {
      setError(result.error || 'NULL 설정 변경 실패');
    }
  };

  // Calculate modal style for dragging
  const modalStyle: React.CSSProperties = position
    ? {
        position: 'fixed',
        left: position.x,
        top: position.y,
        margin: 0,
        transform: 'none',
      }
    : {};

  return (
    <div className="schema-modal-overlay">
      <div
        ref={modalRef}
        className={`schema-modal ${isDragging ? 'dragging' : ''}`}
        style={modalStyle}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="schema-modal-header draggable"
          onMouseDown={handleMouseDown}
        >
          <h2>스키마 편집: {tableName}</h2>
          <button className="schema-modal-close" onClick={onClose}>✕</button>
        </div>

        {error && (
          <div className="schema-modal-error">
            {error}
          </div>
        )}

        <div className="schema-modal-body">
          {columnsLoading ? (
            <div className="loading-overlay">
              <div className="loading-spinner" />
              <span style={{ marginLeft: '8px' }}>컬럼 정보 로딩 중...</span>
            </div>
          ) : (
          <>
          {/* 컬럼 목록 */}
          <table className="schema-table">
            <thead>
              <tr>
                <th>컬럼명</th>
                <th>타입</th>
                <th>NULL</th>
                <th>PK</th>
                <th>기본값</th>
                <th>작업</th>
              </tr>
            </thead>
            <tbody>
              {columns.map((col) => (
                <tr key={col.name} className={col.isPrimary ? 'primary-row' : ''}>
                  <td>
                    {editState.mode === 'rename' && editState.targetColumn === col.name ? (
                      <input
                        type="text"
                        className="schema-input"
                        value={editState.newName || ''}
                        onChange={(e) => setEditState({ ...editState, newName: e.target.value })}
                        autoFocus
                      />
                    ) : (
                      <span className="column-name">{col.name}</span>
                    )}
                  </td>
                  <td>
                    {editState.mode === 'changeType' && editState.targetColumn === col.name ? (
                      <select
                        className="schema-select"
                        value={editState.newType || col.type}
                        onChange={(e) => setEditState({ ...editState, newType: e.target.value })}
                      >
                        {PG_TYPES.map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    ) : (
                      <span className="column-type">{col.type}</span>
                    )}
                  </td>
                  <td>
                    <button
                      className={`nullable-btn ${col.isNullable ? 'yes' : 'no'}`}
                      onClick={() => handleToggleNullable(col)}
                      disabled={loading || col.isPrimary}
                      title={col.isPrimary ? 'PK는 변경 불가' : '클릭하여 변경'}
                    >
                      {col.isNullable ? 'YES' : 'NO'}
                    </button>
                  </td>
                  <td>{col.isPrimary ? '🔑' : ''}</td>
                  <td className="default-value">{col.defaultValue || '-'}</td>
                  <td className="action-cell">
                    {editState.mode === 'view' ? (
                      <>
                        <button
                          className="schema-btn"
                          onClick={() => setEditState({ mode: 'rename', targetColumn: col.name, newName: col.name })}
                          disabled={loading}
                          title="이름 변경"
                        >
                          ✏️
                        </button>
                        <button
                          className="schema-btn"
                          onClick={() => setEditState({ mode: 'changeType', targetColumn: col.name, newType: col.type })}
                          disabled={loading}
                          title="타입 변경"
                        >
                          🔄
                        </button>
                        <button
                          className="schema-btn danger"
                          onClick={() => handleDropColumn(col.name)}
                          disabled={loading || col.isPrimary}
                          title={col.isPrimary ? 'PK는 삭제 불가' : '컬럼 삭제'}
                        >
                          🗑️
                        </button>
                      </>
                    ) : editState.targetColumn === col.name ? (
                      <>
                        <button
                          className="schema-btn confirm"
                          onClick={editState.mode === 'rename' ? handleRenameColumn : handleChangeType}
                          disabled={loading}
                        >
                          ✓
                        </button>
                        <button
                          className="schema-btn"
                          onClick={resetEdit}
                          disabled={loading}
                        >
                          ✕
                        </button>
                      </>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* 컬럼 추가 */}
          {editState.mode === 'view' && (
            <button
              className="add-column-btn"
              onClick={() => setEditState({ mode: 'add', addNullable: true, addType: 'VARCHAR(255)' })}
              disabled={loading}
            >
              + 컬럼 추가
            </button>
          )}

          {editState.mode === 'add' && (
            <div className="add-column-form">
              <h3>새 컬럼 추가</h3>
              <div className="form-row">
                <label>컬럼명</label>
                <input
                  type="text"
                  className="schema-input"
                  placeholder="column_name"
                  value={editState.addName || ''}
                  onChange={(e) => setEditState({ ...editState, addName: e.target.value })}
                />
              </div>
              <div className="form-row">
                <label>타입</label>
                <select
                  className="schema-select"
                  value={editState.addType || 'VARCHAR(255)'}
                  onChange={(e) => setEditState({ ...editState, addType: e.target.value })}
                >
                  {PG_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div className="form-row">
                <label>NULL 허용</label>
                <input
                  type="checkbox"
                  checked={editState.addNullable ?? true}
                  onChange={(e) => setEditState({ ...editState, addNullable: e.target.checked })}
                />
              </div>
              <div className="form-row">
                <label>기본값</label>
                <input
                  type="text"
                  className="schema-input"
                  placeholder="예: 'default' 또는 0"
                  value={editState.addDefault || ''}
                  onChange={(e) => setEditState({ ...editState, addDefault: e.target.value })}
                />
              </div>
              <div className="form-actions">
                <button
                  className="schema-btn confirm"
                  onClick={handleAddColumn}
                  disabled={loading}
                >
                  추가
                </button>
                <button
                  className="schema-btn"
                  onClick={resetEdit}
                  disabled={loading}
                >
                  취소
                </button>
              </div>
            </div>
          )}
          </>
          )}
        </div>

        {loading && (
          <div className="schema-modal-loading">
            처리 중...
          </div>
        )}
      </div>
    </div>
  );
}
