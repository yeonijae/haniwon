/**
 * 데이터 테이블 컴포넌트
 */

import type { QueryResult, SortInfo, SortDirection } from '../types';

interface Props {
  data: QueryResult;
  sort: SortInfo | null;
  onSort: (column: string) => void;
  loading?: boolean;
}

export function DataTable({ data, sort, onSort, loading }: Props) {
  const { columns, rows, error } = data;

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

  return (
    <div className="db-table-container">
      <table className="db-table">
        <thead>
          <tr>
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
          {rows.map((row, index) => (
            <tr key={index}>
              <td className="row-number">{index + 1}</td>
              {columns.map((col) => (
                <td key={col} title={row[col] != null ? String(row[col]) : ''}>
                  {formatValue(row[col])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
