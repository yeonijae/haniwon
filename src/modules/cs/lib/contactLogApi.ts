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
 */
export async function getContactLogsByPatient(
  patientId: number,
  limit: number = 50
): Promise<ContactLog[]> {
  return query<ContactLog>(`
    SELECT * FROM patient_contact_logs
    WHERE patient_id = ${patientId}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `);
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
  let whereClause = `created_at >= '${startDate}' AND created_at < '${endDate}'::date + interval '1 day'`;

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
export async function createContactLog(
  data: CreateContactLogRequest
): Promise<ContactLog> {
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
    WHERE DATE(created_at) = '${today}'
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
