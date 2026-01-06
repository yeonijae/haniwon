/**
 * 페이지네이션 컴포넌트
 */

import type { Pagination as PaginationType } from '../types';

interface Props {
  pagination: PaginationType;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  executionTime?: number;
}

export function Pagination({ pagination, onPageChange, onPageSizeChange, executionTime }: Props) {
  const { page, pageSize, totalRows } = pagination;
  const totalPages = Math.ceil(totalRows / pageSize);
  const startRow = (page - 1) * pageSize + 1;
  const endRow = Math.min(page * pageSize, totalRows);

  const pageSizes = [25, 50, 100, 200, 500];

  return (
    <div className="pagination">
      <div className="pagination-info">
        {totalRows > 0 ? (
          <>
            {startRow.toLocaleString()} - {endRow.toLocaleString()} / {totalRows.toLocaleString()} rows
            {executionTime !== undefined && (
              <span style={{ marginLeft: '12px', color: 'var(--text-muted)' }}>
                ({executionTime.toFixed(0)}ms)
              </span>
            )}
          </>
        ) : (
          '0 rows'
        )}
      </div>

      <div className="pagination-controls">
        {/* Page Size */}
        <select
          className="db-select"
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          style={{ width: 'auto', padding: '4px 8px', fontSize: '13px' }}
        >
          {pageSizes.map((size) => (
            <option key={size} value={size}>
              {size}개
            </option>
          ))}
        </select>

        {/* Page Navigation */}
        <button
          className="db-btn db-btn-secondary pagination-btn"
          onClick={() => onPageChange(1)}
          disabled={page === 1}
        >
          ⟨⟨
        </button>
        <button
          className="db-btn db-btn-secondary pagination-btn"
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
        >
          ⟨
        </button>

        <span style={{ padding: '0 12px', fontSize: '13px' }}>
          {page} / {totalPages || 1}
        </span>

        <button
          className="db-btn db-btn-secondary pagination-btn"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
        >
          ⟩
        </button>
        <button
          className="db-btn db-btn-secondary pagination-btn"
          onClick={() => onPageChange(totalPages)}
          disabled={page >= totalPages}
        >
          ⟩⟩
        </button>
      </div>
    </div>
  );
}
