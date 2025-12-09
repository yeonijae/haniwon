/**
 * SQLite API 클라이언트
 * 내부 SQLite 서버 (192.168.0.173:3200)와 통신
 */

const SQLITE_API_URL = import.meta.env.VITE_SQLITE_API_URL || 'http://192.168.0.173:3200';

interface SqliteResponse {
  columns?: string[];
  rows?: any[][];
  error?: string;
  message?: string;
  changes?: number;
  lastInsertRowid?: number;
}

/**
 * SQL 쿼리 실행 (SELECT용)
 * 결과를 object array로 반환
 */
export async function query<T = Record<string, any>>(sql: string): Promise<T[]> {
  try {
    const res = await fetch(`${SQLITE_API_URL}/api/sqlite/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql })
    });

    const data: SqliteResponse = await res.json();

    if (data.error) {
      throw new Error(data.error);
    }

    if (!data.columns || !data.rows) {
      return [];
    }

    // columns + rows → object array 변환
    return data.rows.map((row: any[]) =>
      Object.fromEntries(
        data.columns!.map((col: string, i: number) => [col, row[i]])
      )
    ) as T[];
  } catch (error) {
    console.error('SQLite query error:', error);
    throw error;
  }
}

/**
 * SQL 쿼리 실행 후 첫 번째 행만 반환 (단일 조회용)
 */
export async function queryOne<T = Record<string, any>>(sql: string): Promise<T | null> {
  const results = await query<T>(sql);
  return results.length > 0 ? results[0] : null;
}

/**
 * SQL 실행 (INSERT, UPDATE, DELETE용)
 */
export async function execute(sql: string): Promise<{
  success: boolean;
  message?: string;
  changes?: number;
  lastInsertRowid?: number;
}> {
  try {
    const res = await fetch(`${SQLITE_API_URL}/api/sqlite/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql })
    });

    const data: SqliteResponse = await res.json();

    if (data.error) {
      throw new Error(data.error);
    }

    return {
      success: true,
      message: data.message,
      changes: data.changes,
      lastInsertRowid: data.lastInsertRowid
    };
  } catch (error) {
    console.error('SQLite execute error:', error);
    throw error;
  }
}

/**
 * INSERT 후 마지막 삽입 ID 반환
 */
export async function insert(sql: string): Promise<number> {
  const result = await execute(sql);
  return result.lastInsertRowid || 0;
}

/**
 * SQL 문자열 이스케이프 (SQL Injection 방지)
 */
export function escapeString(value: string | null | undefined): string {
  if (value === null || value === undefined) {
    return 'NULL';
  }
  // 작은따옴표를 두 개로 이스케이프
  return `'${String(value).replace(/'/g, "''")}'`;
}

/**
 * 값을 SQL 형식으로 변환
 */
export function toSqlValue(value: any): string {
  if (value === null || value === undefined) {
    return 'NULL';
  }
  if (typeof value === 'number') {
    return String(value);
  }
  if (typeof value === 'boolean') {
    return value ? '1' : '0';
  }
  if (value instanceof Date) {
    return escapeString(value.toISOString());
  }
  return escapeString(String(value));
}

/**
 * 현재 날짜 (YYYY-MM-DD 형식)
 */
export function getCurrentDate(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * 현재 시간 (ISO 8601 형식)
 */
export function getCurrentTimestamp(): string {
  return new Date().toISOString();
}

/**
 * 테이블 존재 여부 확인
 */
export async function tableExists(tableName: string): Promise<boolean> {
  const result = await query<{ name: string }>(
    `SELECT name FROM sqlite_master WHERE type='table' AND name=${escapeString(tableName)}`
  );
  return result.length > 0;
}

/**
 * 모든 테이블 목록 조회
 */
export async function getTables(): Promise<string[]> {
  const result = await query<{ name: string }>(
    `SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`
  );
  return result.map(r => r.name);
}
