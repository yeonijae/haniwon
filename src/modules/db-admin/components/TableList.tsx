/**
 * 테이블 목록 컴포넌트
 */

import { useState, useEffect } from 'react';
import type { DbType, TableInfo } from '../types';
import { getTables, dropTable, renameTable } from '../lib/api';

interface Props {
  dbType: DbType;
  database: string;
  selectedTable: string | null;
  onTableSelect: (tableName: string) => void;
  onCreateTable?: () => void;
  onSchemaEdit?: (tableName: string) => void;
  onTablesChange?: () => void;
}

export function TableList({
  dbType,
  database,
  selectedTable,
  onTableSelect,
  onCreateTable,
  onSchemaEdit,
  onTablesChange,
}: Props) {
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(false);

  // Rename state
  const [renamingTable, setRenamingTable] = useState<string | null>(null);
  const [newTableName, setNewTableName] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (database) {
      loadTables();
    }
  }, [dbType, database]);

  const loadTables = async () => {
    setLoading(true);
    try {
      const tableList = await getTables(dbType, database);
      setTables(tableList);
    } catch (error) {
      console.error('Failed to load tables:', error);
    } finally {
      setLoading(false);
    }
  };

  // Expose reload function
  useEffect(() => {
    if (onTablesChange) {
      loadTables();
    }
  }, [onTablesChange]);

  const handleRenameStart = (tableName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setRenamingTable(tableName);
    setNewTableName(tableName);
  };

  const handleRenameSubmit = async (oldName: string) => {
    if (!newTableName || newTableName === oldName) {
      setRenamingTable(null);
      return;
    }

    setActionLoading(true);
    const result = await renameTable(oldName, newTableName);
    setActionLoading(false);

    if (result.success) {
      setRenamingTable(null);
      loadTables();
      if (selectedTable === oldName) {
        onTableSelect(newTableName);
      }
    } else {
      alert(result.error || '테이블 이름 변경 실패');
    }
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent, oldName: string) => {
    if (e.key === 'Enter') {
      handleRenameSubmit(oldName);
    } else if (e.key === 'Escape') {
      setRenamingTable(null);
    }
  };

  const handleDropTable = async (tableName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`"${tableName}" 테이블을 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없으며, 테이블의 모든 데이터가 삭제됩니다.`)) {
      return;
    }

    setActionLoading(true);
    const result = await dropTable(tableName);
    setActionLoading(false);

    if (result.success) {
      loadTables();
      if (selectedTable === tableName) {
        onTableSelect('');
      }
    } else {
      alert(result.error || '테이블 삭제 실패');
    }
  };

  const handleSchemaEdit = (tableName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (onSchemaEdit) {
      onSchemaEdit(tableName);
    }
  };

  const filteredTables = tables.filter((t) =>
    t.name.toLowerCase().includes(filter.toLowerCase())
  );

  const formatRowCount = (count: number): string => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  const isPostgres = dbType === 'postgres';

  return (
    <>
      <div className="sidebar-section">
        <input
          type="text"
          className="db-input"
          placeholder="테이블 검색..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        {isPostgres && onCreateTable && (
          <button
            className="create-table-btn"
            onClick={onCreateTable}
            disabled={actionLoading}
          >
            + 테이블 생성
          </button>
        )}
      </div>

      <div className="table-list">
        {loading ? (
          <div className="loading-overlay">
            <div className="loading-spinner" />
          </div>
        ) : filteredTables.length === 0 ? (
          <div className="empty-state" style={{ padding: '20px' }}>
            <div style={{ fontSize: '13px' }}>
              {filter ? '검색 결과 없음' : '테이블 없음'}
            </div>
          </div>
        ) : (
          filteredTables.map((table) => (
            <div
              key={table.name}
              className={`table-item ${selectedTable === table.name ? 'selected' : ''}`}
              onClick={() => onTableSelect(table.name)}
            >
              <div className="table-item-content">
                {renamingTable === table.name ? (
                  <input
                    type="text"
                    className="table-rename-input"
                    value={newTableName}
                    onChange={(e) => setNewTableName(e.target.value)}
                    onKeyDown={(e) => handleRenameKeyDown(e, table.name)}
                    onBlur={() => handleRenameSubmit(table.name)}
                    onClick={(e) => e.stopPropagation()}
                    autoFocus
                    disabled={actionLoading}
                  />
                ) : (
                  <>
                    <div className="table-item-name">{table.name}</div>
                    <div className="table-item-info">
                      {table.schema} · {formatRowCount(table.rowCount)} rows
                    </div>
                  </>
                )}
              </div>

              {isPostgres && renamingTable !== table.name && (
                <div className="table-item-actions">
                  <button
                    className="table-action-btn"
                    onClick={(e) => handleSchemaEdit(table.name, e)}
                    title="스키마 편집"
                    disabled={actionLoading}
                  >
                    🔧
                  </button>
                  <button
                    className="table-action-btn"
                    onClick={(e) => handleRenameStart(table.name, e)}
                    title="이름 변경"
                    disabled={actionLoading}
                  >
                    ✏️
                  </button>
                  <button
                    className="table-action-btn danger"
                    onClick={(e) => handleDropTable(table.name, e)}
                    title="테이블 삭제"
                    disabled={actionLoading}
                  >
                    🗑️
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </>
  );
}
