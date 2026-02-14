/**
 * 검사결과 API 서비스
 */

import type {
  ExamResult,
  ExamAttachment,
  ExamValue,
  CreateExamRequest,
  UpdateExamRequest,
  Patient,
  ExamDateGroup,
} from '../types';

const API_URL = import.meta.env.VITE_POSTGRES_API_URL || 'http://192.168.0.173:5200';
const MSSQL_API_URL = import.meta.env.VITE_MSSQL_API_URL || 'http://192.168.0.173:3100';

// SQL 문자열 이스케이프
function escapeString(value: string | null | undefined): string {
  if (value === null || value === undefined || value === '') return 'NULL';
  return "'" + String(value).replace(/'/g, "''") + "'";
}

// PostgreSQL 쿼리 실행
async function query<T>(sql: string): Promise<T[]> {
  const response = await fetch(`${API_URL}/api/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql }),
  });

  const data = await response.json();
  if (data.error) {
    throw new Error(data.error);
  }

  if (!data.rows || data.rows.length === 0) return [];

  // PostgreSQL은 rows를 객체 배열로 반환
  if (typeof data.rows[0] === 'object' && !Array.isArray(data.rows[0])) {
    return data.rows as T[];
  }

  // 구버전 호환: rows 배열을 객체 배열로 변환
  if (data.columns && Array.isArray(data.rows[0])) {
    return data.rows.map((row: any[]) => {
      const obj: any = {};
      data.columns.forEach((col: string, idx: number) => {
        obj[col] = row[idx];
      });
      return obj as T;
    });
  }

  return data.rows as T[];
}

// PostgreSQL INSERT 실행 (RETURNING id 사용)
async function insert(sql: string): Promise<number> {
  // RETURNING id 추가
  let insertSql = sql.trim();
  if (!insertSql.toUpperCase().includes('RETURNING')) {
    insertSql = insertSql.replace(/;?\s*$/, ' RETURNING id');
  }

  const response = await fetch(`${API_URL}/api/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql: insertSql }),
  });

  const data = await response.json();
  if (data.error) {
    // RETURNING 실패 시 일반 실행
    await execute(sql);
    return 0;
  }

  // PostgreSQL: rows에서 id 추출
  if (data.rows && data.rows.length > 0) {
    return data.rows[0].id || 0;
  }
  return 0;
}

// PostgreSQL UPDATE/DELETE 실행
async function execute(sql: string): Promise<{ success: boolean; affected: number }> {
  const response = await fetch(`${API_URL}/api/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql }),
  });

  const data = await response.json();
  if (data.error) {
    throw new Error(data.error);
  }

  return {
    success: true,
    affected: data.affected_rows || 0,
  };
}

// ============ 환자 검색 (MSSQL) ============

/**
 * 환자 검색
 */
export async function searchPatients(keyword: string): Promise<Patient[]> {
  const response = await fetch(`${MSSQL_API_URL}/api/patients/search?q=${encodeURIComponent(keyword)}`);
  const data = await response.json();

  if (!response.ok || data.error) {
    throw new Error(data.error || '환자 검색 실패');
  }

  // API returns array directly
  const patients = Array.isArray(data) ? data : (data.patients || []);

  return patients.map((p: any) => ({
    id: p.id,
    chart_number: p.chart_no,
    name: p.name,
    birth_date: p.birth,
    gender: p.sex,
    phone: p.phone,
  }));
}

/**
 * 최근 검사한 환자 목록
 */
export async function getRecentExamPatients(limit: number = 10): Promise<Patient[]> {
  const results = await query<{ patient_id: number }>(`
    SELECT DISTINCT patient_id
    FROM exam_results
    ORDER BY created_at DESC
    LIMIT ${limit}
  `);

  if (results.length === 0) return [];

  // MSSQL에서 환자 정보 조회
  const patientIds = results.map(r => r.patient_id).join(',');
  const response = await fetch(`${MSSQL_API_URL}/api/patients/by-ids?ids=${patientIds}`);
  const data = await response.json();

  return (data.patients || []).map((p: any) => ({
    id: p.id,
    chart_number: p.chart_no,
    name: p.name,
    birth_date: p.birth,
    gender: p.sex,
    phone: p.phone,
  }));
}

// ============ 검사결과 CRUD ============

/**
 * 검사결과 목록 조회 (환자별)
 */
export async function getExamResultsByPatient(patientId: number): Promise<ExamResult[]> {
  const results = await query<ExamResult>(`
    SELECT * FROM exam_results
    WHERE patient_id = ${patientId}
    ORDER BY exam_date DESC, created_at DESC
  `);

  // 각 검사에 첨부파일 조회
  for (const exam of results) {
    exam.attachments = await getExamAttachments(exam.id);
    exam.values = await getExamValues(exam.id);
  }

  return results;
}

/**
 * 검사결과 날짜별 그룹핑
 */
export async function getExamResultsGroupedByDate(patientId: number): Promise<ExamDateGroup[]> {
  const exams = await getExamResultsByPatient(patientId);

  const groups: Map<string, ExamResult[]> = new Map();

  for (const exam of exams) {
    const date = exam.exam_date;
    if (!groups.has(date)) {
      groups.set(date, []);
    }
    groups.get(date)!.push(exam);
  }

  return Array.from(groups.entries())
    .map(([date, exams]) => ({ date, exams }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * 검사결과 상세 조회
 */
export async function getExamResult(id: number): Promise<ExamResult | null> {
  const results = await query<ExamResult>(`
    SELECT * FROM exam_results WHERE id = ${id}
  `);

  if (results.length === 0) return null;

  const exam = results[0];
  exam.attachments = await getExamAttachments(id);
  exam.values = await getExamValues(id);

  return exam;
}

/**
 * 검사결과 생성
 */
export async function createExamResult(data: CreateExamRequest): Promise<number> {
  const now = new Date().toISOString();

  const id = await insert(`
    INSERT INTO exam_results (
      patient_id, exam_date, exam_type, exam_name,
      findings, memo, doctor_name, created_at, updated_at
    ) VALUES (
      ${data.patient_id},
      ${escapeString(data.exam_date)},
      ${escapeString(data.exam_type)},
      ${escapeString(data.exam_name)},
      ${escapeString(data.findings)},
      ${escapeString(data.memo)},
      ${escapeString(data.doctor_name)},
      ${escapeString(now)},
      ${escapeString(now)}
    )
  `);

  return id;
}

/**
 * 검사결과 수정
 */
export async function updateExamResult(id: number, data: UpdateExamRequest): Promise<boolean> {
  const now = new Date().toISOString();

  const sets: string[] = [];
  if (data.exam_name !== undefined) sets.push(`exam_name = ${escapeString(data.exam_name)}`);
  if (data.findings !== undefined) sets.push(`findings = ${escapeString(data.findings)}`);
  if (data.memo !== undefined) sets.push(`memo = ${escapeString(data.memo)}`);
  if (data.doctor_name !== undefined) sets.push(`doctor_name = ${escapeString(data.doctor_name)}`);
  sets.push(`updated_at = ${escapeString(now)}`);

  const result = await execute(`
    UPDATE exam_results SET ${sets.join(', ')} WHERE id = ${id}
  `);

  return result.success;
}

/**
 * 검사결과 삭제
 */
export async function deleteExamResult(id: number): Promise<boolean> {
  // 첨부파일도 함께 삭제됨 (CASCADE)
  const result = await execute(`DELETE FROM exam_results WHERE id = ${id}`);
  return result.success;
}

// ============ 첨부파일 ============

/**
 * 첨부파일 목록 조회
 */
export async function getExamAttachments(examResultId: number): Promise<ExamAttachment[]> {
  return query<ExamAttachment>(`
    SELECT * FROM exam_attachments
    WHERE exam_result_id = ${examResultId}
    ORDER BY sort_order ASC, uploaded_at ASC
  `);
}

/**
 * 첨부파일 추가
 */
export async function addExamAttachment(
  examResultId: number,
  data: {
    file_name: string;
    file_path: string;
    file_size?: number;
    mime_type?: string;
    thumbnail_path?: string;
    sort_order?: number;
  }
): Promise<number> {
  const now = new Date().toISOString();

  return insert(`
    INSERT INTO exam_attachments (
      exam_result_id, file_name, file_path, file_size,
      mime_type, thumbnail_path, sort_order, uploaded_at
    ) VALUES (
      ${examResultId},
      ${escapeString(data.file_name)},
      ${escapeString(data.file_path)},
      ${data.file_size || 'NULL'},
      ${escapeString(data.mime_type)},
      ${escapeString(data.thumbnail_path)},
      ${data.sort_order || 0},
      ${escapeString(now)}
    )
  `);
}

/**
 * 첨부파일 삭제
 */
export async function deleteExamAttachment(id: number): Promise<boolean> {
  const result = await execute(`DELETE FROM exam_attachments WHERE id = ${id}`);
  return result.success;
}

/**
 * 첨부파일 캡션 업데이트
 */
export async function updateAttachmentCaption(id: number, caption: string): Promise<boolean> {
  const result = await execute(`
    UPDATE exam_attachments
    SET caption = ${escapeString(caption)}
    WHERE id = ${id}
  `);
  return result.success;
}

// ============ 수치 데이터 ============

/**
 * 수치 데이터 조회
 */
export async function getExamValues(examResultId: number): Promise<ExamValue[]> {
  return query<ExamValue>(`
    SELECT * FROM exam_values WHERE exam_result_id = ${examResultId}
  `);
}

/**
 * 수치 데이터 추가
 */
export async function addExamValue(
  examResultId: number,
  data: {
    item_name: string;
    item_value?: number;
    unit?: string;
    reference_min?: number;
    reference_max?: number;
  }
): Promise<number> {
  return insert(`
    INSERT INTO exam_values (
      exam_result_id, item_name, item_value, unit, reference_min, reference_max
    ) VALUES (
      ${examResultId},
      ${escapeString(data.item_name)},
      ${data.item_value ?? 'NULL'},
      ${escapeString(data.unit)},
      ${data.reference_min ?? 'NULL'},
      ${data.reference_max ?? 'NULL'}
    )
  `);
}

/**
 * 수치 데이터 삭제
 */
export async function deleteExamValue(id: number): Promise<boolean> {
  const result = await execute(`DELETE FROM exam_values WHERE id = ${id}`);
  return result.success;
}

// ============ 통계 ============

/**
 * 환자의 검사 통계
 */
export async function getExamStats(patientId: number): Promise<{
  total: number;
  byType: { exam_type: string; count: number }[];
  lastExamDate: string | null;
}> {
  const total = await query<{ count: number }>(`
    SELECT COUNT(*) as count FROM exam_results WHERE patient_id = ${patientId}
  `);

  const byType = await query<{ exam_type: string; count: number }>(`
    SELECT exam_type, COUNT(*) as count
    FROM exam_results
    WHERE patient_id = ${patientId}
    GROUP BY exam_type
  `);

  const last = await query<{ exam_date: string }>(`
    SELECT exam_date FROM exam_results
    WHERE patient_id = ${patientId}
    ORDER BY exam_date DESC
    LIMIT 1
  `);

  return {
    total: total[0]?.count || 0,
    byType,
    lastExamDate: last[0]?.exam_date || null,
  };
}
