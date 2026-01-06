/**
 * SQL 쿼리 실행 패널 컴포넌트
 */

import { useState } from 'react';
import type { DbType, QueryResult } from '../types';
import { executeCustomQuery } from '../lib/api';
import { DataTable } from './DataTable';

interface Props {
  dbType: DbType;
}

export function SqlQueryPanel({ dbType }: Props) {
  const [sql, setSql] = useState('');
  const [result, setResult] = useState<QueryResult | null>(null);
  const [loading, setLoading] = useState(false);

  const handleExecute = async () => {
    if (!sql.trim()) return;

    setLoading(true);
    try {
      const queryResult = await executeCustomQuery(dbType, sql);
      setResult(queryResult);
    } catch (error) {
      setResult({
        columns: [],
        rows: [],
        rowCount: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleExecute();
    }
  };

  return (
    <div className="sql-panel">
      <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
        <textarea
          className="db-textarea"
          value={sql}
          onChange={(e) => setSql(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`SELECT 쿼리를 입력하세요... (Ctrl+Enter로 실행)\n\n예시:\nSELECT * FROM table_name LIMIT 100`}
          style={{ flex: 1, minHeight: '120px' }}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button
            className="db-btn db-btn-primary"
            onClick={handleExecute}
            disabled={loading || !sql.trim()}
          >
            {loading ? (
              <div className="loading-spinner" style={{ width: '16px', height: '16px' }} />
            ) : (
              '▶ 실행'
            )}
          </button>
          <button
            className="db-btn db-btn-secondary"
            onClick={() => {
              setSql('');
              setResult(null);
            }}
          >
            지우기
          </button>
        </div>
      </div>

      {result && (
        <div className="sql-result">
          <div className="sql-result-header">
            {result.error ? (
              <span style={{ color: 'var(--accent-error)' }}>Error</span>
            ) : (
              <>
                {result.rowCount} rows
                {result.executionTime !== undefined && (
                  <span> · {result.executionTime.toFixed(0)}ms</span>
                )}
              </>
            )}
          </div>
          <DataTable
            data={result}
            sort={null}
            onSort={() => {}}
            loading={false}
          />
        </div>
      )}
    </div>
  );
}
