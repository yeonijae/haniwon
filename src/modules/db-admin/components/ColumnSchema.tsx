/**
 * 컬럼 스키마 표시 컴포넌트
 */

import type { ColumnInfo } from '../types';

interface Props {
  columns: ColumnInfo[];
  loading?: boolean;
}

export function ColumnSchema({ columns, loading }: Props) {
  if (loading) {
    return (
      <div className="column-schema">
        <div className="loading-spinner" style={{ margin: '0 auto' }} />
      </div>
    );
  }

  if (columns.length === 0) {
    return null;
  }

  return (
    <div className="column-schema">
      <div className="column-tags">
        {columns.map((col) => (
          <div
            key={col.name}
            className={`column-tag ${col.isPrimary ? 'primary' : ''}`}
            title={`${col.type}${col.maxLength ? `(${col.maxLength})` : ''} ${col.isNullable ? 'NULL' : 'NOT NULL'}`}
          >
            {col.isPrimary && <span>🔑</span>}
            <span className="column-tag-name">{col.name}</span>
            <span className="column-tag-type">{col.type}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
