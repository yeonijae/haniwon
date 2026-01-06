/**
 * 데이터베이스 타입 및 DB 선택 컴포넌트
 */

import { useState, useEffect } from 'react';
import type { DbType, DatabaseInfo } from '../types';
import { getDatabases } from '../lib/api';

interface Props {
  dbType: DbType;
  database: string;
  onDbTypeChange: (type: DbType) => void;
  onDatabaseChange: (db: string) => void;
}

export function DatabaseSelector({ dbType, database, onDbTypeChange, onDatabaseChange }: Props) {
  const [databases, setDatabases] = useState<DatabaseInfo[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadDatabases();
  }, [dbType]);

  const loadDatabases = async () => {
    setLoading(true);
    try {
      const dbs = await getDatabases(dbType);
      setDatabases(dbs);
      if (dbs.length > 0 && !database) {
        onDatabaseChange(dbs[0].name);
      }
    } catch (error) {
      console.error('Failed to load databases:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="sidebar-section">
      <div className="sidebar-label">데이터베이스</div>

      {/* DB Type 선택 */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
        <button
          className={`db-type-badge ${dbType === 'mssql' ? 'mssql' : ''}`}
          onClick={() => onDbTypeChange('mssql')}
          style={{
            flex: 1,
            padding: '8px',
            cursor: 'pointer',
            border: dbType === 'mssql' ? '2px solid #ef4444' : '2px solid transparent',
            borderRadius: '6px',
          }}
        >
          MSSQL
        </button>
        <button
          className={`db-type-badge ${dbType === 'postgres' ? 'postgres' : ''}`}
          onClick={() => onDbTypeChange('postgres')}
          style={{
            flex: 1,
            padding: '8px',
            cursor: 'pointer',
            border: dbType === 'postgres' ? '2px solid #3b82f6' : '2px solid transparent',
            borderRadius: '6px',
          }}
        >
          PostgreSQL
        </button>
      </div>

      {/* Database 선택 (MSSQL만) */}
      {dbType === 'mssql' && (
        <select
          className="db-select"
          value={database}
          onChange={(e) => onDatabaseChange(e.target.value)}
          style={{ width: '100%' }}
          disabled={loading}
        >
          {loading ? (
            <option>Loading...</option>
          ) : (
            databases.map((db) => (
              <option key={db.name} value={db.name}>
                {db.name}
              </option>
            ))
          )}
        </select>
      )}

      {dbType === 'postgres' && (
        <div style={{
          padding: '8px 12px',
          backgroundColor: 'var(--bg-tertiary)',
          borderRadius: '6px',
          fontSize: '14px'
        }}>
          haniwon
        </div>
      )}
    </div>
  );
}
