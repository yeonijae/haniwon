/**
 * PostgreSQL API 클라이언트
 * 내부 PostgreSQL 서버 (192.168.0.173:3200)와 통신
 */

const API_URL = import.meta.env.VITE_POSTGRES_API_URL || 'http://192.168.0.173:3200';

interface ApiResponse {
  columns?: string[];
  rows?: any[] | Record<string, any>[];
  error?: string;
  message?: string;
  success?: boolean;
  affected_rows?: number;
}

/**
 * SQL 쿼리 실행 (SELECT용)
 * 결과를 object array로 반환
 */
export async function query<T = Record<string, any>>(sql: string): Promise<T[]> {
  try {
    const res = await fetch(`${API_URL}/api/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql })
    });

    const data: ApiResponse = await res.json();

    if (data.error) {
      throw new Error(data.error);
    }

    if (!data.rows || data.rows.length === 0) {
      return [];
    }

    // PostgreSQL API는 rows를 객체 배열로 반환
    // 이미 객체 배열이면 그대로 반환, 아니면 변환
    if (typeof data.rows[0] === 'object' && !Array.isArray(data.rows[0])) {
      return data.rows as T[];
    }

    // 구버전 호환: columns + rows(배열) → object array 변환
    if (data.columns && Array.isArray(data.rows[0])) {
      return (data.rows as any[][]).map((row: any[]) =>
        Object.fromEntries(
          data.columns!.map((col: string, i: number) => [col, row[i]])
        )
      ) as T[];
    }

    return data.rows as T[];
  } catch (error) {
    console.error('Database query error:', error);
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
    const res = await fetch(`${API_URL}/api/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql })
    });

    const data: ApiResponse = await res.json();

    if (data.error) {
      throw new Error(data.error);
    }

    return {
      success: true,
      message: data.message,
      changes: data.affected_rows,
      lastInsertRowid: undefined // PostgreSQL은 RETURNING 사용
    };
  } catch (error) {
    console.error('Database execute error:', error);
    throw error;
  }
}

/**
 * INSERT 후 마지막 삽입 ID 반환
 * PostgreSQL에서는 RETURNING id 사용
 */
export async function insert(sql: string): Promise<number> {
  try {
    // RETURNING id가 없으면 추가
    let insertSql = sql.trim();
    if (!insertSql.toUpperCase().includes('RETURNING')) {
      insertSql = insertSql.replace(/;?\s*$/, ' RETURNING id');
    }

    const res = await fetch(`${API_URL}/api/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql: insertSql })
    });

    const data: ApiResponse = await res.json();

    if (data.error) {
      // RETURNING 실패 시 (id 컬럼 없음) 일반 실행
      await execute(sql);
      return 0;
    }

    // rows에서 id 추출
    if (data.rows && data.rows.length > 0) {
      const firstRow = data.rows[0] as Record<string, any>;
      return firstRow.id || 0;
    }

    return 0;
  } catch (error) {
    console.error('Database insert error:', error);
    throw error;
  }
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
  const result = await query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = ${escapeString(tableName)}`
  );
  return result.length > 0;
}

/**
 * 모든 테이블 목록 조회
 */
export async function getTables(): Promise<string[]> {
  const result = await query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' ORDER BY table_name`
  );
  return result.map(r => r.table_name);
}
