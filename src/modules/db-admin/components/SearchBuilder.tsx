/**
 * 검색 조건 빌더 컴포넌트 (phpMyAdmin 스타일)
 */

import { useState } from 'react';
import type { ColumnInfo, SearchCondition, DbType } from '../types';
import { OPERATORS, createCondition, operatorNeedsValue, operatorNeedsValue2, buildWhereClause } from '../lib/queryBuilder';

interface Props {
  columns: ColumnInfo[];
  dbType: DbType;
  onSearch: (whereClause: string) => void;
  onClear: () => void;
}

export function SearchBuilder({ columns, dbType, onSearch, onClear }: Props) {
  const [conditions, setConditions] = useState<SearchCondition[]>([createCondition()]);
  const [expanded, setExpanded] = useState(true);

  const addCondition = () => {
    setConditions([...conditions, createCondition()]);
  };

  const removeCondition = (id: string) => {
    if (conditions.length > 1) {
      setConditions(conditions.filter((c) => c.id !== id));
    }
  };

  const updateCondition = (id: string, field: keyof SearchCondition, value: string) => {
    setConditions(
      conditions.map((c) =>
        c.id === id ? { ...c, [field]: value } : c
      )
    );
  };

  const handleSearch = () => {
    const whereClause = buildWhereClause(conditions, dbType);
    onSearch(whereClause);
  };

  const handleClear = () => {
    setConditions([createCondition()]);
    onClear();
  };

  return (
    <div className="search-builder">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: expanded ? '12px' : '0',
          cursor: 'pointer',
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <div style={{ fontWeight: '600', fontSize: '14px' }}>
          🔍 검색 조건
        </div>
        <button className="db-btn-icon" style={{ fontSize: '12px' }}>
          {expanded ? '▲' : '▼'}
        </button>
      </div>

      {expanded && (
        <>
          {conditions.map((condition, index) => (
            <div key={condition.id} className="search-row">
              {index > 0 && (
                <span style={{ color: 'var(--text-muted)', fontSize: '12px', minWidth: '30px' }}>
                  AND
                </span>
              )}

              {/* 컬럼 선택 */}
              <select
                className="db-select"
                value={condition.column}
                onChange={(e) => updateCondition(condition.id, 'column', e.target.value)}
                style={{ minWidth: '150px' }}
              >
                <option value="">컬럼 선택</option>
                {columns.map((col) => (
                  <option key={col.name} value={col.name}>
                    {col.name}
                  </option>
                ))}
              </select>

              {/* 연산자 선택 */}
              <select
                className="db-select"
                value={condition.operator}
                onChange={(e) => updateCondition(condition.id, 'operator', e.target.value)}
                style={{ minWidth: '130px' }}
              >
                {OPERATORS.map((op) => (
                  <option key={op.value} value={op.value}>
                    {op.label}
                  </option>
                ))}
              </select>

              {/* 값 입력 */}
              {operatorNeedsValue(condition.operator) && (
                <input
                  type="text"
                  className="db-input"
                  placeholder={condition.operator === 'IN' || condition.operator === 'NOT IN' ? '값1, 값2, ...' : '값'}
                  value={condition.value}
                  onChange={(e) => updateCondition(condition.id, 'value', e.target.value)}
                />
              )}

              {/* BETWEEN용 두 번째 값 */}
              {operatorNeedsValue2(condition.operator) && (
                <>
                  <span style={{ color: 'var(--text-muted)' }}>~</span>
                  <input
                    type="text"
                    className="db-input"
                    placeholder="값2"
                    value={condition.value2 || ''}
                    onChange={(e) => updateCondition(condition.id, 'value2', e.target.value)}
                  />
                </>
              )}

              {/* 삭제 버튼 */}
              <button
                className="db-btn-icon"
                onClick={() => removeCondition(condition.id)}
                disabled={conditions.length === 1}
                title="조건 삭제"
              >
                ✕
              </button>
            </div>
          ))}

          <div className="search-actions">
            <button className="db-btn db-btn-secondary" onClick={addCondition}>
              + 조건 추가
            </button>
            <div style={{ flex: 1 }} />
            <button className="db-btn db-btn-secondary" onClick={handleClear}>
              초기화
            </button>
            <button className="db-btn db-btn-primary" onClick={handleSearch}>
              검색
            </button>
          </div>
        </>
      )}
    </div>
  );
}
