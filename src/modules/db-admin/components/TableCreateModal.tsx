/**
 * 테이블 생성 모달 컴포넌트
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { createTable } from '../lib/api';

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

interface ColumnDef {
  id: string;
  name: string;
  type: string;
  isPrimary: boolean;
  isNullable: boolean;
  defaultValue: string;
}

interface Props {
  onClose: () => void;
  onTableCreated: (tableName: string) => void;
}

export function TableCreateModal({ onClose, onTableCreated }: Props) {
  const [tableName, setTableName] = useState('');
  const [columns, setColumns] = useState<ColumnDef[]>([
    { id: '1', name: 'id', type: 'SERIAL', isPrimary: true, isNullable: false, defaultValue: '' },
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const addColumn = () => {
    setColumns([
      ...columns,
      {
        id: Date.now().toString(),
        name: '',
        type: 'VARCHAR(255)',
        isPrimary: false,
        isNullable: true,
        defaultValue: '',
      },
    ]);
  };

  const removeColumn = (id: string) => {
    if (columns.length <= 1) {
      setError('최소 1개의 컬럼이 필요합니다.');
      return;
    }
    setColumns(columns.filter((col) => col.id !== id));
  };

  const updateColumn = (id: string, field: keyof ColumnDef, value: any) => {
    setColumns(
      columns.map((col) => {
        if (col.id === id) {
          const updated = { ...col, [field]: value };
          // PK로 설정하면 nullable은 false로
          if (field === 'isPrimary' && value === true) {
            updated.isNullable = false;
          }
          return updated;
        }
        // PK는 하나만 허용
        if (field === 'isPrimary' && value === true) {
          return { ...col, isPrimary: false };
        }
        return col;
      })
    );
  };

  const handleCreate = async () => {
    // Validation
    if (!tableName.trim()) {
      setError('테이블 이름을 입력하세요.');
      return;
    }

    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
      setError('테이블 이름은 영문, 숫자, 언더스코어만 사용 가능합니다.');
      return;
    }

    const emptyColumns = columns.filter((col) => !col.name.trim());
    if (emptyColumns.length > 0) {
      setError('모든 컬럼 이름을 입력하세요.');
      return;
    }

    const columnNames = columns.map((col) => col.name.toLowerCase());
    const duplicates = columnNames.filter((name, i) => columnNames.indexOf(name) !== i);
    if (duplicates.length > 0) {
      setError(`중복된 컬럼 이름: ${duplicates.join(', ')}`);
      return;
    }

    setLoading(true);
    setError(null);

    const result = await createTable(
      tableName,
      columns.map((col) => ({
        name: col.name,
        type: col.type,
        isPrimary: col.isPrimary,
        isNullable: col.isNullable,
        defaultValue: col.defaultValue || undefined,
      }))
    );

    setLoading(false);

    if (result.success) {
      onTableCreated(tableName);
      onClose();
    } else {
      setError(result.error || '테이블 생성 실패');
    }
  };

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
        className={`schema-modal table-create-modal ${isDragging ? 'dragging' : ''}`}
        style={modalStyle}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="schema-modal-header draggable"
          onMouseDown={handleMouseDown}
        >
          <h2>새 테이블 생성</h2>
          <button className="schema-modal-close" onClick={onClose}>✕</button>
        </div>

        {error && (
          <div className="schema-modal-error">
            {error}
          </div>
        )}

        <div className="schema-modal-body">
          {/* 테이블 이름 */}
          <div className="form-section">
            <label className="form-label">테이블 이름</label>
            <input
              type="text"
              className="schema-input"
              placeholder="table_name"
              value={tableName}
              onChange={(e) => setTableName(e.target.value)}
            />
          </div>

          {/* 컬럼 정의 */}
          <div className="form-section">
            <label className="form-label">컬럼 정의</label>
            <table className="schema-table column-def-table">
              <thead>
                <tr>
                  <th>컬럼명</th>
                  <th>타입</th>
                  <th>PK</th>
                  <th>NULL</th>
                  <th>기본값</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {columns.map((col) => (
                  <tr key={col.id}>
                    <td>
                      <input
                        type="text"
                        className="schema-input"
                        placeholder="column_name"
                        value={col.name}
                        onChange={(e) => updateColumn(col.id, 'name', e.target.value)}
                      />
                    </td>
                    <td>
                      <select
                        className="schema-select"
                        value={col.type}
                        onChange={(e) => updateColumn(col.id, 'type', e.target.value)}
                      >
                        {PG_TYPES.map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </td>
                    <td className="center">
                      <input
                        type="checkbox"
                        checked={col.isPrimary}
                        onChange={(e) => updateColumn(col.id, 'isPrimary', e.target.checked)}
                      />
                    </td>
                    <td className="center">
                      <input
                        type="checkbox"
                        checked={col.isNullable}
                        onChange={(e) => updateColumn(col.id, 'isNullable', e.target.checked)}
                        disabled={col.isPrimary}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        className="schema-input small"
                        placeholder="예: 0"
                        value={col.defaultValue}
                        onChange={(e) => updateColumn(col.id, 'defaultValue', e.target.value)}
                      />
                    </td>
                    <td className="center">
                      <button
                        className="schema-btn danger"
                        onClick={() => removeColumn(col.id)}
                        title="삭제"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <button className="add-column-btn" onClick={addColumn}>
              + 컬럼 추가
            </button>
          </div>
        </div>

        <div className="schema-modal-footer">
          <button
            className="db-btn db-btn-secondary"
            onClick={onClose}
            disabled={loading}
          >
            취소
          </button>
          <button
            className="db-btn db-btn-primary"
            onClick={handleCreate}
            disabled={loading}
          >
            {loading ? '생성 중...' : '테이블 생성'}
          </button>
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
