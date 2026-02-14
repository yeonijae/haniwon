/**
 * DB Admin API 모듈
 * MSSQL 및 PostgreSQL 통합 API
 */

import type { DbType, DatabaseInfo, TableInfo, ColumnInfo, QueryResult } from '../types';

// API 엔드포인트
const API_ENDPOINTS = {
  mssql: import.meta.env.VITE_MSSQL_API_URL || 'http://192.168.0.173:3100',
  postgres: import.meta.env.VITE_POSTGRES_API_URL || 'http://192.168.0.173:5200',
};

/**
 * SQL 쿼리 실행
 */
export async function executeQuery(
  dbType: DbType,
  sql: string
): Promise<QueryResult> {
  const startTime = performance.now();

  try {
    const response = await fetch(`${API_ENDPOINTS[dbType]}/api/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql }),
    });

    const data = await response.json();
    const executionTime = performance.now() - startTime;

    if (data.error) {
      return {
        columns: [],
        rows: [],
        rowCount: 0,
        error: data.error,
        executionTime,
      };
    }

    // 결과 정규화 (MSSQL은 배열, PostgreSQL은 객체)
    let rows: Record<string, any>[] = [];
    let columns: string[] = data.columns || [];

    if (data.rows && data.rows.length > 0) {
      // PostgreSQL: 이미 객체 배열
      if (typeof data.rows[0] === 'object' && !Array.isArray(data.rows[0])) {
        rows = data.rows;
        if (columns.length === 0) {
          columns = Object.keys(data.rows[0]);
        }
      }
      // MSSQL: 배열의 배열 → 객체로 변환
      else if (Array.isArray(data.rows[0])) {
        rows = data.rows.map((row: any[]) =>
          Object.fromEntries(columns.map((col, i) => [col, row[i]]))
        );
      }
    }

    return {
      columns,
      rows,
      rowCount: rows.length,
      executionTime,
    };
  } catch (error) {
    return {
      columns: [],
      rows: [],
      rowCount: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
      executionTime: performance.now() - startTime,
    };
  }
}

/**
 * 데이터베이스 목록 조회 (MSSQL 전용)
 */
export async function getDatabases(dbType: DbType): Promise<DatabaseInfo[]> {
  if (dbType === 'postgres') {
    // PostgreSQL은 단일 DB (haniwon)
    return [{ name: 'haniwon' }];
  }

  const sql = `
    SELECT name, database_id as id
    FROM sys.databases
    WHERE database_id > 4
    ORDER BY name
  `;

  const result = await executeQuery(dbType, sql);

  if (result.error || !result.rows) {
    return [];
  }

  return result.rows.map(row => ({
    name: row.name,
    id: row.id,
  }));
}

/**
 * 테이블 목록 조회
 */
export async function getTables(
  dbType: DbType,
  database?: string
): Promise<TableInfo[]> {
  let sql: string;

  if (dbType === 'mssql') {
    const db = database || 'MasterDB';
    sql = `
      SELECT
        t.name,
        s.name as schema_name,
        p.rows as row_count
      FROM ${db}.sys.tables t
      JOIN ${db}.sys.schemas s ON t.schema_id = s.schema_id
      JOIN ${db}.sys.partitions p ON t.object_id = p.object_id AND p.index_id IN (0, 1)
      ORDER BY t.name
    `;
  } else {
    // PostgreSQL
    sql = `
      SELECT
        t.table_name as name,
        t.table_schema as schema_name,
        COALESCE(s.n_live_tup, 0) as row_count
      FROM information_schema.tables t
      LEFT JOIN pg_stat_user_tables s ON t.table_name = s.relname
      WHERE t.table_schema = 'public'
      AND t.table_type = 'BASE TABLE'
      ORDER BY t.table_name
    `;
  }

  const result = await executeQuery(dbType, sql);

  if (result.error || !result.rows) {
    return [];
  }

  return result.rows.map(row => ({
    name: row.name,
    schema: row.schema_name || 'dbo',
    rowCount: parseInt(row.row_count) || 0,
  }));
}

/**
 * 컬럼 정보 조회
 */
export async function getColumns(
  dbType: DbType,
  tableName: string,
  database?: string
): Promise<ColumnInfo[]> {
  let sql: string;

  if (dbType === 'mssql') {
    const db = database || 'MasterDB';
    sql = `
      SELECT
        c.name,
        t.name as type_name,
        c.max_length,
        c.is_nullable,
        CASE WHEN pk.column_id IS NOT NULL THEN 1 ELSE 0 END as is_primary,
        dc.definition as default_value
      FROM ${db}.sys.columns c
      JOIN ${db}.sys.types t ON c.user_type_id = t.user_type_id
      JOIN ${db}.sys.tables tb ON c.object_id = tb.object_id
      LEFT JOIN (
        SELECT ic.object_id, ic.column_id
        FROM ${db}.sys.index_columns ic
        JOIN ${db}.sys.indexes i ON ic.object_id = i.object_id AND ic.index_id = i.index_id
        WHERE i.is_primary_key = 1
      ) pk ON c.object_id = pk.object_id AND c.column_id = pk.column_id
      LEFT JOIN ${db}.sys.default_constraints dc ON c.default_object_id = dc.object_id
      WHERE tb.name = '${tableName}'
      ORDER BY c.column_id
    `;
  } else {
    // PostgreSQL
    sql = `
      SELECT
        c.column_name as name,
        c.data_type as type_name,
        c.character_maximum_length as max_length,
        CASE WHEN c.is_nullable = 'YES' THEN true ELSE false END as is_nullable,
        CASE WHEN tc.constraint_type = 'PRIMARY KEY' THEN true ELSE false END as is_primary,
        c.column_default as default_value
      FROM information_schema.columns c
      LEFT JOIN information_schema.key_column_usage kcu
        ON c.table_name = kcu.table_name AND c.column_name = kcu.column_name
      LEFT JOIN information_schema.table_constraints tc
        ON kcu.constraint_name = tc.constraint_name AND tc.constraint_type = 'PRIMARY KEY'
      WHERE c.table_name = '${tableName}'
      AND c.table_schema = 'public'
      ORDER BY c.ordinal_position
    `;
  }

  const result = await executeQuery(dbType, sql);

  if (result.error || !result.rows) {
    return [];
  }

  return result.rows.map(row => ({
    name: row.name,
    type: row.type_name,
    maxLength: row.max_length,
    isNullable: row.is_nullable === true || row.is_nullable === 1,
    isPrimary: row.is_primary === true || row.is_primary === 1,
    defaultValue: row.default_value,
  }));
}

/**
 * 테이블 데이터 조회
 */
export async function getTableData(
  dbType: DbType,
  tableName: string,
  options: {
    database?: string;
    limit?: number;
    offset?: number;
    orderBy?: string;
    orderDir?: 'ASC' | 'DESC';
    where?: string;
  } = {}
): Promise<QueryResult> {
  const { database, limit = 100, offset = 0, orderBy, orderDir = 'ASC', where } = options;

  let sql: string;
  const whereClause = where ? `WHERE ${where}` : '';
  const orderClause = orderBy ? `ORDER BY "${orderBy}" ${orderDir}` : '';

  if (dbType === 'mssql') {
    const db = database || 'MasterDB';
    // MSSQL: OFFSET/FETCH (ORDER BY 필수)
    const order = orderClause || 'ORDER BY (SELECT NULL)';
    sql = `
      SELECT * FROM ${db}.dbo.[${tableName}]
      ${whereClause}
      ${order}
      OFFSET ${offset} ROWS
      FETCH NEXT ${limit} ROWS ONLY
    `;
  } else {
    // PostgreSQL: LIMIT/OFFSET
    sql = `
      SELECT * FROM "${tableName}"
      ${whereClause}
      ${orderClause}
      LIMIT ${limit} OFFSET ${offset}
    `;
  }

  return executeQuery(dbType, sql);
}

/**
 * 테이블 총 행 수 조회
 */
export async function getTableCount(
  dbType: DbType,
  tableName: string,
  options: {
    database?: string;
    where?: string;
  } = {}
): Promise<number> {
  const { database, where } = options;
  const whereClause = where ? `WHERE ${where}` : '';

  let sql: string;

  if (dbType === 'mssql') {
    const db = database || 'MasterDB';
    sql = `SELECT COUNT(*) as cnt FROM ${db}.dbo.[${tableName}] ${whereClause}`;
  } else {
    sql = `SELECT COUNT(*) as cnt FROM "${tableName}" ${whereClause}`;
  }

  const result = await executeQuery(dbType, sql);

  if (result.error || !result.rows || result.rows.length === 0) {
    return 0;
  }

  return parseInt(result.rows[0].cnt) || 0;
}

/**
 * 커스텀 쿼리 실행 (SELECT만 허용)
 */
export async function executeCustomQuery(
  dbType: DbType,
  sql: string
): Promise<QueryResult> {
  // 보안: SELECT/WITH만 허용
  const trimmed = sql.trim().toUpperCase();
  if (!trimmed.startsWith('SELECT') && !trimmed.startsWith('WITH')) {
    return {
      columns: [],
      rows: [],
      rowCount: 0,
      error: 'SELECT 또는 WITH 쿼리만 실행 가능합니다.',
    };
  }

  return executeQuery(dbType, sql);
}

/**
 * 셀 값 업데이트 (PostgreSQL 전용)
 */
export async function updateCell(
  tableName: string,
  whereCondition: Record<string, any>,
  setData: Record<string, any>
): Promise<{ success: boolean; error?: string; affected_rows?: number }> {
  try {
    const response = await fetch(`${API_ENDPOINTS.postgres}/api/tables/${tableName}/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        where: whereCondition,
        set: setData,
      }),
    });

    const data = await response.json();

    if (data.error) {
      return { success: false, error: data.error };
    }

    return {
      success: true,
      affected_rows: data.affected_rows,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * 행 삭제 (PostgreSQL 전용)
 */
export async function deleteRow(
  tableName: string,
  whereCondition: Record<string, any>
): Promise<{ success: boolean; error?: string; affected_rows?: number }> {
  try {
    const response = await fetch(`${API_ENDPOINTS.postgres}/api/tables/${tableName}/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        where: whereCondition,
      }),
    });

    const data = await response.json();

    if (data.error) {
      return { success: false, error: data.error };
    }

    return {
      success: true,
      affected_rows: data.affected_rows,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * DDL 쿼리 실행 (PostgreSQL 전용)
 */
export async function executeDDL(
  sql: string
): Promise<{ success: boolean; error?: string; message?: string }> {
  try {
    const response = await fetch(`${API_ENDPOINTS.postgres}/api/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql }),
    });

    const data = await response.json();

    if (data.error) {
      return { success: false, error: data.error };
    }

    return {
      success: true,
      message: data.message,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * 컬럼 추가
 */
export async function addColumn(
  tableName: string,
  columnName: string,
  columnType: string,
  isNullable: boolean = true,
  defaultValue?: string
): Promise<{ success: boolean; error?: string }> {
  let sql = `ALTER TABLE "${tableName}" ADD COLUMN "${columnName}" ${columnType}`;

  if (!isNullable) {
    sql += ' NOT NULL';
  }

  if (defaultValue !== undefined && defaultValue !== '') {
    sql += ` DEFAULT ${defaultValue}`;
  }

  return executeDDL(sql);
}

/**
 * 컬럼 삭제
 */
export async function dropColumn(
  tableName: string,
  columnName: string
): Promise<{ success: boolean; error?: string }> {
  const sql = `ALTER TABLE "${tableName}" DROP COLUMN "${columnName}"`;
  return executeDDL(sql);
}

/**
 * 컬럼 이름 변경
 */
export async function renameColumn(
  tableName: string,
  oldName: string,
  newName: string
): Promise<{ success: boolean; error?: string }> {
  const sql = `ALTER TABLE "${tableName}" RENAME COLUMN "${oldName}" TO "${newName}"`;
  return executeDDL(sql);
}

/**
 * 컬럼 타입 변경
 */
export async function alterColumnType(
  tableName: string,
  columnName: string,
  newType: string
): Promise<{ success: boolean; error?: string }> {
  const sql = `ALTER TABLE "${tableName}" ALTER COLUMN "${columnName}" TYPE ${newType} USING "${columnName}"::${newType}`;
  return executeDDL(sql);
}

/**
 * 컬럼 NULL 허용 변경
 */
export async function alterColumnNullable(
  tableName: string,
  columnName: string,
  isNullable: boolean
): Promise<{ success: boolean; error?: string }> {
  const action = isNullable ? 'DROP NOT NULL' : 'SET NOT NULL';
  const sql = `ALTER TABLE "${tableName}" ALTER COLUMN "${columnName}" ${action}`;
  return executeDDL(sql);
}

/**
 * 테이블 생성
 */
export async function createTable(
  tableName: string,
  columns: {
    name: string;
    type: string;
    isPrimary?: boolean;
    isNullable?: boolean;
    defaultValue?: string;
  }[]
): Promise<{ success: boolean; error?: string }> {
  if (!tableName || columns.length === 0) {
    return { success: false, error: '테이블명과 최소 1개의 컬럼이 필요합니다.' };
  }

  const columnDefs = columns.map((col) => {
    let def = `"${col.name}" ${col.type}`;
    if (col.isPrimary) {
      def += ' PRIMARY KEY';
    }
    if (!col.isNullable && !col.isPrimary) {
      def += ' NOT NULL';
    }
    if (col.defaultValue) {
      def += ` DEFAULT ${col.defaultValue}`;
    }
    return def;
  });

  const sql = `CREATE TABLE "${tableName}" (\n  ${columnDefs.join(',\n  ')}\n)`;
  return executeDDL(sql);
}

/**
 * 테이블 삭제
 */
export async function dropTable(
  tableName: string
): Promise<{ success: boolean; error?: string }> {
  const sql = `DROP TABLE "${tableName}"`;
  return executeDDL(sql);
}

/**
 * 테이블 이름 변경
 */
export async function renameTable(
  oldName: string,
  newName: string
): Promise<{ success: boolean; error?: string }> {
  const sql = `ALTER TABLE "${oldName}" RENAME TO "${newName}"`;
  return executeDDL(sql);
}
