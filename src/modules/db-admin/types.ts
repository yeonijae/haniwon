/**
 * DB Admin 타입 정의
 */

// 데이터베이스 타입
export type DbType = 'mssql' | 'postgres';

// 테마 타입
export type Theme = 'light' | 'dark';

// 데이터베이스 정보
export interface DatabaseInfo {
  name: string;
  id?: number;
}

// 테이블 정보
export interface TableInfo {
  name: string;
  schema: string;
  rowCount: number;
}

// 컬럼 정보
export interface ColumnInfo {
  name: string;
  type: string;
  maxLength?: number;
  isNullable: boolean;
  isPrimary: boolean;
  defaultValue?: string;
}

// 쿼리 결과
export interface QueryResult {
  columns: string[];
  rows: Record<string, any>[];
  rowCount: number;
  error?: string;
  executionTime?: number;
}

// 검색 연산자
export type SearchOperator =
  | '='
  | '!='
  | '>'
  | '>='
  | '<'
  | '<='
  | 'LIKE'
  | 'NOT LIKE'
  | 'IN'
  | 'NOT IN'
  | 'IS NULL'
  | 'IS NOT NULL'
  | 'BETWEEN';

// 검색 조건
export interface SearchCondition {
  id: string;
  column: string;
  operator: SearchOperator;
  value: string;
  value2?: string; // BETWEEN용
}

// 정렬 방향
export type SortDirection = 'ASC' | 'DESC';

// 정렬 정보
export interface SortInfo {
  column: string;
  direction: SortDirection;
}

// 페이지네이션
export interface Pagination {
  page: number;
  pageSize: number;
  totalRows: number;
}

// API 설정
export interface ApiConfig {
  mssql: string;
  postgres: string;
}

// 검색 상태
export interface SearchState {
  conditions: SearchCondition[];
  sort: SortInfo | null;
  pagination: Pagination;
}
