/**
 * 데이터 테이블 컴포넌트
 */

import { useState, useRef, useEffect } from 'react';
import type { QueryResult, SortInfo, ColumnInfo, DbType } from '../types';
import { updateCell, deleteRow } from '../lib/api';

interface EditingCell {
  rowIndex: number;
  column: string;
  originalValue: any;
}

interface Props {
  data: QueryResult;
  sort: SortInfo | null;
  onSort: (column: string) => void;
  loading?: boolean;
  // 인라인 편집용 props
  dbType?: DbType;
  tableName?: string | null;
  database?: string;
  columnInfo?: ColumnInfo[];
  onDataUpdate?: () => void;
}

export function DataTable({
  data,
  sort,
  onSort,
  loading,
  dbType,
  tableName,
  database,
  columnInfo = [],
  onDataUpdate,
}: Props) {
  const { columns, rows, error } = data;
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 편집 모드 시 input에 포커스
  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingCell]);

  // PostgreSQL만 편집 가능
  const isEditable = dbType === 'postgres' && tableName && columnInfo.length > 0;

  // Primary Key 컬럼 찾기
  const getPrimaryKeyColumns = (): string[] => {
    return columnInfo.filter(col => col.isPrimary).map(col => col.name);
  };

  // 더블클릭: 편집 모드 진입
  const handleDoubleClick = (rowIndex: number, column: string, value: any) => {
    if (!isEditable) return;

    setEditingCell({ rowIndex, column, originalValue: value });
    setEditValue(value === null || value === undefined ? '' : String(value));
  };

  // ESC: 편집 취소
  const handleCancel = () => {
    setEditingCell(null);
    setEditValue('');
  };

  // Enter: 저장
  const handleSave = async () => {
    if (!editingCell || !tableName || saving) return;

    const pkColumns = getPrimaryKeyColumns();
    if (pkColumns.length === 0) {
      alert('Primary Key가 없어 수정할 수 없습니다.');
      handleCancel();
      return;
    }

    const row = rows[editingCell.rowIndex];

    // WHERE 조건 생성 (Primary Key 기준)
    const whereCondition: Record<string, any> = {};
    for (const pk of pkColumns) {
      whereCondition[pk] = row[pk];
    }

    // 값이 변경되지 않았으면 취소
    const newValue = editValue === '' ? null : editValue;
    if (String(editingCell.originalValue ?? '') === String(newValue ?? '')) {
      handleCancel();
      return;
    }

    setSaving(true);
    try {
      const result = await updateCell(tableName, whereCondition, {
        [editingCell.column]: newValue,
      }, database);

      if (result.success) {
        // 데이터 새로고침
        onDataUpdate?.();
        handleCancel();
      } else {
        alert(`저장 실패: ${result.error}`);
      }
    } catch (err) {
      alert(`오류: ${err}`);
    } finally {
      setSaving(false);
    }
  };

  // 키보드 이벤트
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  };

  // 행 삭제
  const handleDelete = async (rowIndex: number) => {
    if (!tableName || deleting !== null) return;

    const pkColumns = getPrimaryKeyColumns();
    if (pkColumns.length === 0) {
      alert('Primary Key가 없어 삭제할 수 없습니다.');
      return;
    }

    const row = rows[rowIndex];

    // 삭제 확인
    const pkValues = pkColumns.map(pk => `${pk}=${row[pk]}`).join(', ');
    if (!confirm(`이 행을 삭제하시겠습니까?\n(${pkValues})`)) {
      return;
    }

    // WHERE 조건 생성 (Primary Key 기준)
    const whereCondition: Record<string, any> = {};
    for (const pk of pkColumns) {
      whereCondition[pk] = row[pk];
    }

    setDeleting(rowIndex);
    try {
      const result = await deleteRow(tableName, whereCondition, database);

      if (result.success) {
        onDataUpdate?.();
      } else {
        alert(`삭제 실패: ${result.error}`);
      }
    } catch (err) {
      alert(`오류: ${err}`);
    } finally {
      setDeleting(null);
    }
  };

  if (loading) {
    return (
      <div className="loading-overlay" style={{ flex: 1 }}>
        <div className="loading-spinner" />
        <span style={{ marginLeft: '8px' }}>데이터 로딩 중...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="sql-error">
        <strong>Error:</strong> {error}
      </div>
    );
  }

  if (columns.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">📋</div>
        <div className="empty-state-text">
          테이블을 선택하면 데이터가 표시됩니다
        </div>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">🔍</div>
        <div className="empty-state-text">
          검색 결과가 없습니다
        </div>
      </div>
    );
  }

  const getSortIcon = (column: string): string => {
    if (!sort || sort.column !== column) return '';
    return sort.direction === 'ASC' ? ' ↑' : ' ↓';
  };

  const formatValue = (value: any): React.ReactNode => {
    if (value === null || value === undefined) {
      return <span className="null-value">NULL</span>;
    }
    if (typeof value === 'boolean') {
      return value ? 'true' : 'false';
    }
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return String(value);
  };

  const isEditingThisCell = (rowIndex: number, column: string) => {
    return editingCell?.rowIndex === rowIndex && editingCell?.column === column;
  };

  return (
    <div className="db-table-container">
      <table className="db-table">
        <thead>
          <tr>
            {isEditable && <th className="row-action"></th>}
            <th className="row-number">#</th>
            {columns.map((col) => (
              <th
                key={col}
                onClick={() => onSort(col)}
                className={sort?.column === col ? 'sorted' : ''}
              >
                {col}{getSortIcon(col)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {isEditable && (
                <td className="row-action">
                  <button
                    className="row-delete-btn"
                    onClick={() => handleDelete(rowIndex)}
                    disabled={deleting === rowIndex}
                    title="행 삭제"
                  >
                    {deleting === rowIndex ? '...' : '✕'}
                  </button>
                </td>
              )}
              <td className="row-number">{rowIndex + 1}</td>
              {columns.map((col) => (
                <td
                  key={col}
                  title={isEditable ? '더블클릭하여 편집' : (row[col] != null ? String(row[col]) : '')}
                  className={`${isEditable ? 'editable' : ''} ${isEditingThisCell(rowIndex, col) ? 'editing' : ''}`}
                  onDoubleClick={() => handleDoubleClick(rowIndex, col, row[col])}
                >
                  {isEditingThisCell(rowIndex, col) ? (
                    <input
                      ref={inputRef}
                      type="text"
                      className="cell-edit-input"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={handleKeyDown}
                      onBlur={handleCancel}
                      disabled={saving}
                    />
                  ) : (
                    formatValue(row[col])
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
