/**
 * 응대 기록 API
 * patient_contact_logs 테이블 CRUD
 */

import { query, execute, escapeString, getCurrentTimestamp } from '@shared/lib/postgres';
import type {
  ContactLog,
  CreateContactLogRequest,
  ContactDirection,
  ContactChannel,
  ContactType,
} from '../types/crm';

/**
 * 응대 기록 목록 조회 (환자별)
 * patient_contact_logs + cs_inquiries(매칭된 문의)를 병합하여 반환
 */
export async function getContactLogsByPatient(
  patientId: number,
  limit: number = 50
): Promise<ContactLog[]> {
  const INQUIRY_TYPE_MAP: Record<string, ContactType> = {
    new_patient: 'inquiry',
    reservation: 'reservation',
    general: 'inquiry',
    other: 'other',
  };

  const pid = Number(patientId);

  const [logs, inquiries] = await Promise.all([
    query<ContactLog>(`
      SELECT * FROM patient_contact_logs
      WHERE patient_id = ${pid}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `),
    query<{
      id: number; patient_id: number; channel: ContactChannel;
      inquiry_type: string; content: string; response: string | null;
      staff_name: string | null; created_at: string;
    }>(`
      SELECT id, patient_id, channel, inquiry_type, content, response, staff_name, created_at
      FROM cs_inquiries
      WHERE patient_id = ${pid}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `),
  ]);

  // 문의를 ContactLog 형식으로 변환
  const inquiryLogs: ContactLog[] = inquiries.map(inq => ({
    id: -(inq.id),
    patient_id: inq.patient_id,
    direction: 'inbound' as ContactDirection,
    channel: inq.channel as ContactChannel,
    contact_type: INQUIRY_TYPE_MAP[inq.inquiry_type] || 'other',
    content: inq.content,
    result: inq.response,
    related_type: 'inquiry',
    related_id: inq.id,
    created_by: inq.staff_name,
    created_at: inq.created_at,
  }));

  // 병합 후 날짜순 정렬
  return [...logs, ...inquiryLogs]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, limit);
}

/**
 * 응대 기록 목록 조회 (날짜 범위)
 */
export async function getContactLogsByDateRange(
  startDate: string,
  endDate: string,
  direction?: ContactDirection,
  contactType?: ContactType
): Promise<ContactLog[]> {
  let whereClause = `created_at >= ${escapeString(startDate)} AND created_at < ${escapeString(endDate)}::date + interval '1 day'`;

  if (direction) {
    whereClause += ` AND direction = ${escapeString(direction)}`;
  }
  if (contactType) {
    whereClause += ` AND contact_type = ${escapeString(contactType)}`;
  }

  return query<ContactLog>(`
    SELECT * FROM patient_contact_logs
    WHERE ${whereClause}
    ORDER BY created_at DESC
  `);
}

/**
 * 응대 기록 단건 조회
 */
export async function getContactLogById(id: number): Promise<ContactLog | null> {
  const results = await query<ContactLog>(`
    SELECT * FROM patient_contact_logs WHERE id = ${id}
  `);
  return results[0] || null;
}

/**
 * 응대 기록 생성
 */
let _contactLogTableChecked = false;
async function ensureContactLogTable() {
  if (_contactLogTableChecked) return;
  await execute(`
    CREATE TABLE IF NOT EXISTS patient_contact_logs (
      id SERIAL PRIMARY KEY,
      patient_id INTEGER NOT NULL,
      direction TEXT NOT NULL DEFAULT 'inbound',
      channel TEXT NOT NULL DEFAULT 'phone',
      contact_type TEXT NOT NULL DEFAULT 'inquiry',
      content TEXT,
      result TEXT,
      related_type TEXT,
      related_id INTEGER,
      created_by TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `).catch(() => {});
  _contactLogTableChecked = true;
}

export async function createContactLog(
  data: CreateContactLogRequest
): Promise<ContactLog> {
  await ensureContactLogTable();
  const now = getCurrentTimestamp();

  const result = await query<{ id: number }>(`
    INSERT INTO patient_contact_logs (
      patient_id, direction, channel, contact_type,
      content, result, related_type, related_id,
      created_by, created_at
    ) VALUES (
      ${data.patient_id},
      ${escapeString(data.direction)},
      ${escapeString(data.channel)},
      ${escapeString(data.contact_type)},
      ${escapeString(data.content || null)},
      ${escapeString(data.result || null)},
      ${escapeString(data.related_type || null)},
      ${data.related_id || 'NULL'},
      ${escapeString(data.created_by || null)},
      ${escapeString(now)}
    ) RETURNING id
  `);

  if (!result || result.length === 0 || !result[0]?.id) {
    // RETURNING이 지원 안 되는 경우 — 최근 레코드 조회
    const recent = await query<ContactLog>(`SELECT * FROM patient_contact_logs WHERE patient_id = ${data.patient_id} ORDER BY id DESC LIMIT 1`);
    if (recent.length > 0) return recent[0];
    throw new Error('응대 기록 생성 실패');
  }
  const created = await getContactLogById(result[0].id);
  if (!created) {
    throw new Error('응대 기록 생성 실패');
  }
  return created;
}

/**
 * 응대 기록 수정
 */
export async function updateContactLog(
  id: number,
  data: Partial<CreateContactLogRequest>
): Promise<ContactLog | null> {
  const updates: string[] = [];

  if (data.direction !== undefined) {
    updates.push(`direction = ${escapeString(data.direction)}`);
  }
  if (data.channel !== undefined) {
    updates.push(`channel = ${escapeString(data.channel)}`);
  }
  if (data.contact_type !== undefined) {
    updates.push(`contact_type = ${escapeString(data.contact_type)}`);
  }
  if (data.content !== undefined) {
    updates.push(`content = ${escapeString(data.content)}`);
  }
  if (data.result !== undefined) {
    updates.push(`result = ${escapeString(data.result)}`);
  }
  if (data.related_type !== undefined) {
    updates.push(`related_type = ${escapeString(data.related_type)}`);
  }
  if (data.related_id !== undefined) {
    updates.push(`related_id = ${data.related_id}`);
  }
  if (data.created_by !== undefined) {
    updates.push(`created_by = ${escapeString(data.created_by)}`);
  }

  if (updates.length === 0) {
    return getContactLogById(id);
  }

  await execute(`
    UPDATE patient_contact_logs
    SET ${updates.join(', ')}
    WHERE id = ${id}
  `);

  return getContactLogById(id);
}

/**
 * 응대 기록 삭제
 */
export async function deleteContactLog(id: number): Promise<boolean> {
  const result = await execute(`
    DELETE FROM patient_contact_logs WHERE id = ${id}
  `);
  return (result.changes || 0) > 0;
}

/**
 * 최근 응대 기록 조회 (전체)
 */
export async function getRecentContactLogs(limit: number = 20): Promise<ContactLog[]> {
  return query<ContactLog>(`
    SELECT cl.*, p.name as patient_name, p.chart_number
    FROM patient_contact_logs cl
    LEFT JOIN patients p ON cl.patient_id = p.id
    ORDER BY cl.created_at DESC
    LIMIT ${limit}
  `);
}

/**
 * 오늘 응대 통계
 */
export async function getTodayContactStats(): Promise<{
  total: number;
  inbound: number;
  outbound: number;
  by_type: Record<string, number>;
}> {
  const today = new Date().toISOString().split('T')[0];

  const stats = await query<{ direction: string; contact_type: string; count: number }>(`
    SELECT direction, contact_type, COUNT(*) as count
    FROM patient_contact_logs
    WHERE DATE(created_at) = ${escapeString(today)}
    GROUP BY direction, contact_type
  `);

  let total = 0;
  let inbound = 0;
  let outbound = 0;
  const by_type: Record<string, number> = {};

  for (const row of stats) {
    const count = Number(row.count);
    total += count;

    if (row.direction === 'inbound') {
      inbound += count;
    } else {
      outbound += count;
    }

    by_type[row.contact_type] = (by_type[row.contact_type] || 0) + count;
  }

  return { total, inbound, outbound, by_type };
}
