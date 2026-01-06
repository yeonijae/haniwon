/**
 * 검색 조건 → SQL WHERE 절 빌더
 */

import type { SearchCondition, SearchOperator, DbType } from '../types';

/**
 * 연산자 목록
 */
export const OPERATORS: { value: SearchOperator; label: string; needsValue: boolean; needsValue2?: boolean }[] = [
  { value: '=', label: '같음 (=)', needsValue: true },
  { value: '!=', label: '다름 (!=)', needsValue: true },
  { value: '>', label: '초과 (>)', needsValue: true },
  { value: '>=', label: '이상 (>=)', needsValue: true },
  { value: '<', label: '미만 (<)', needsValue: true },
  { value: '<=', label: '이하 (<=)', needsValue: true },
  { value: 'LIKE', label: '포함 (LIKE)', needsValue: true },
  { value: 'NOT LIKE', label: '미포함 (NOT LIKE)', needsValue: true },
  { value: 'IN', label: '목록 (IN)', needsValue: true },
  { value: 'NOT IN', label: '제외 (NOT IN)', needsValue: true },
  { value: 'IS NULL', label: 'NULL', needsValue: false },
  { value: 'IS NOT NULL', label: 'NOT NULL', needsValue: false },
  { value: 'BETWEEN', label: '범위 (BETWEEN)', needsValue: true, needsValue2: true },
];

/**
 * 값 이스케이프 (SQL Injection 방지)
 */
export function escapeValue(value: string): string {
  if (value === null || value === undefined) {
    return 'NULL';
  }
  // 작은따옴표 이스케이프
  return value.replace(/'/g, "''");
}

/**
 * 숫자인지 확인
 */
function isNumeric(value: string): boolean {
  return !isNaN(parseFloat(value)) && isFinite(Number(value));
}

/**
 * 값을 SQL 리터럴로 변환
 */
function toSqlLiteral(value: string): string {
  if (value === null || value === undefined || value === '') {
    return 'NULL';
  }

  // 숫자면 따옴표 없이
  if (isNumeric(value)) {
    return value;
  }

  // 문자열은 따옴표로 감싸기
  return `'${escapeValue(value)}'`;
}

/**
 * 단일 조건을 SQL 조건절로 변환
 */
export function conditionToSql(condition: SearchCondition, dbType: DbType): string {
  const { column, operator, value, value2 } = condition;

  // 컬럼명 래핑 (MSSQL: [], PostgreSQL: "")
  const columnName = dbType === 'mssql' ? `[${column}]` : `"${column}"`;

  switch (operator) {
    case '=':
    case '!=':
    case '>':
    case '>=':
    case '<':
    case '<=':
      return `${columnName} ${operator} ${toSqlLiteral(value)}`;

    case 'LIKE':
      // 값에 %가 없으면 앞뒤에 추가
      const likeValue = value.includes('%') ? value : `%${value}%`;
      return `${columnName} LIKE '${escapeValue(likeValue)}'`;

    case 'NOT LIKE':
      const notLikeValue = value.includes('%') ? value : `%${value}%`;
      return `${columnName} NOT LIKE '${escapeValue(notLikeValue)}'`;

    case 'IN': {
      // 쉼표로 구분된 값 파싱
      const inValues = value
        .split(',')
        .map(v => v.trim())
        .filter(v => v)
        .map(v => toSqlLiteral(v))
        .join(', ');
      return `${columnName} IN (${inValues})`;
    }

    case 'NOT IN': {
      const notInValues = value
        .split(',')
        .map(v => v.trim())
        .filter(v => v)
        .map(v => toSqlLiteral(v))
        .join(', ');
      return `${columnName} NOT IN (${notInValues})`;
    }

    case 'IS NULL':
      return `${columnName} IS NULL`;

    case 'IS NOT NULL':
      return `${columnName} IS NOT NULL`;

    case 'BETWEEN':
      return `${columnName} BETWEEN ${toSqlLiteral(value)} AND ${toSqlLiteral(value2 || '')}`;

    default:
      return '';
  }
}

/**
 * 여러 조건을 WHERE 절로 변환
 */
export function buildWhereClause(conditions: SearchCondition[], dbType: DbType): string {
  if (!conditions || conditions.length === 0) {
    return '';
  }

  const validConditions = conditions
    .filter(c => c.column && c.operator)
    .map(c => conditionToSql(c, dbType))
    .filter(sql => sql);

  if (validConditions.length === 0) {
    return '';
  }

  return validConditions.join(' AND ');
}

/**
 * 새 검색 조건 생성
 */
export function createCondition(): SearchCondition {
  return {
    id: crypto.randomUUID(),
    column: '',
    operator: '=',
    value: '',
  };
}

/**
 * 연산자가 값을 필요로 하는지 확인
 */
export function operatorNeedsValue(operator: SearchOperator): boolean {
  return !['IS NULL', 'IS NOT NULL'].includes(operator);
}

/**
 * 연산자가 두 번째 값(BETWEEN)을 필요로 하는지 확인
 */
export function operatorNeedsValue2(operator: SearchOperator): boolean {
  return operator === 'BETWEEN';
}
