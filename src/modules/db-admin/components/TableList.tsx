/**
 * 테이블 목록 컴포넌트
 */

import { useState, useEffect } from 'react';
import type { DbType, TableInfo } from '../types';
import { getTables } from '../lib/api';

interface Props {
  dbType: DbType;
  database: string;
  selectedTable: string | null;
  onTableSelect: (tableName: string) => void;
}

export function TableList({ dbType, database, selectedTable, onTableSelect }: Props) {
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(false);

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

  const filteredTables = tables.filter((t) =>
    t.name.toLowerCase().includes(filter.toLowerCase())
  );

  const formatRowCount = (count: number): string => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

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
              <div className="table-item-name">{table.name}</div>
              <div className="table-item-info">
                {table.schema} · {formatRowCount(table.rowCount)} rows
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}
