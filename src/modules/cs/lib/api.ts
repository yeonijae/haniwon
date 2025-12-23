import { query, execute, insert, escapeString, toSqlValue, getCurrentTimestamp } from '@shared/lib/sqlite';
import type { Inquiry, CreateInquiryRequest, UpdateInquiryRequest } from '../types';

/**
 * 문의 목록 조회
 */
export async function getInquiries(options?: {
  status?: string;
  date?: string;
  limit?: number;
}): Promise<Inquiry[]> {
  let sql = 'SELECT * FROM cs_inquiries WHERE 1=1';

  if (options?.status) {
    sql += ` AND status = ${escapeString(options.status)}`;
  }

  if (options?.date) {
    sql += ` AND DATE(created_at) = ${escapeString(options.date)}`;
  }

  sql += ' ORDER BY created_at DESC';

  if (options?.limit) {
    sql += ` LIMIT ${options.limit}`;
  }

  return query<Inquiry>(sql);
}

/**
 * 오늘 문의 조회
 */
export async function getTodayInquiries(): Promise<Inquiry[]> {
  const today = new Date().toISOString().split('T')[0];
  return getInquiries({ date: today });
}

/**
 * 미처리 문의 조회
 */
export async function getPendingInquiries(): Promise<Inquiry[]> {
  return getInquiries({ status: 'pending' });
}

/**
 * 문의 상세 조회
 */
export async function getInquiry(id: number): Promise<Inquiry | null> {
  const results = await query<Inquiry>(
    `SELECT * FROM cs_inquiries WHERE id = ${id}`
  );
  return results.length > 0 ? results[0] : null;
}

/**
 * 문의 등록
 */
export async function createInquiry(data: CreateInquiryRequest): Promise<number> {
  const sql = `
    INSERT INTO cs_inquiries (
      channel, patient_name, contact, inquiry_type, content, response, status, staff_name, created_at, updated_at
    ) VALUES (
      ${escapeString(data.channel)},
      ${toSqlValue(data.patient_name)},
      ${toSqlValue(data.contact)},
      ${escapeString(data.inquiry_type)},
      ${escapeString(data.content)},
      ${toSqlValue(data.response)},
      'pending',
      ${toSqlValue(data.staff_name)},
      ${escapeString(getCurrentTimestamp())},
      ${escapeString(getCurrentTimestamp())}
    )
  `;
  return insert(sql);
}

/**
 * 문의 수정
 */
export async function updateInquiry(id: number, data: UpdateInquiryRequest): Promise<void> {
  const updates: string[] = [];

  if (data.channel !== undefined) updates.push(`channel = ${escapeString(data.channel)}`);
  if (data.patient_name !== undefined) updates.push(`patient_name = ${toSqlValue(data.patient_name)}`);
  if (data.contact !== undefined) updates.push(`contact = ${toSqlValue(data.contact)}`);
  if (data.inquiry_type !== undefined) updates.push(`inquiry_type = ${escapeString(data.inquiry_type)}`);
  if (data.content !== undefined) updates.push(`content = ${escapeString(data.content)}`);
  if (data.response !== undefined) updates.push(`response = ${toSqlValue(data.response)}`);
  if (data.status !== undefined) updates.push(`status = ${escapeString(data.status)}`);
  if (data.staff_name !== undefined) updates.push(`staff_name = ${toSqlValue(data.staff_name)}`);

  updates.push(`updated_at = ${escapeString(getCurrentTimestamp())}`);

  const sql = `UPDATE cs_inquiries SET ${updates.join(', ')} WHERE id = ${id}`;
  await execute(sql);
}

/**
 * 문의 삭제
 */
export async function deleteInquiry(id: number): Promise<void> {
  await execute(`DELETE FROM cs_inquiries WHERE id = ${id}`);
}

/**
 * 문의 상태 변경
 */
export async function updateInquiryStatus(id: number, status: string): Promise<void> {
  await updateInquiry(id, { status: status as any });
}

/**
 * cs_inquiries 테이블 생성 (없으면)
 */
export async function ensureInquiriesTable(): Promise<void> {
  const sql = `
    CREATE TABLE IF NOT EXISTS cs_inquiries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel TEXT NOT NULL,
      patient_name TEXT,
      contact TEXT,
      inquiry_type TEXT NOT NULL,
      content TEXT NOT NULL,
      response TEXT,
      status TEXT DEFAULT 'pending',
      staff_name TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `;
  await execute(sql);
}
