/**
 * 메시지 발송 API
 * message_templates, message_logs 테이블 CRUD
 */

import { query, execute, escapeString, getCurrentTimestamp } from '@shared/lib/postgres';
import type {
  MessageTemplate,
  CreateMessageTemplateRequest,
  UpdateMessageTemplateRequest,
  MessageLog,
  SendMessageRequest,
  MessageStats,
  MessageChannel,
} from '../types/crm';

// ============================================
// 템플릿 관리
// ============================================

/**
 * 모든 템플릿 조회
 */
export async function getMessageTemplates(activeOnly: boolean = false): Promise<MessageTemplate[]> {
  const whereClause = activeOnly ? 'WHERE is_active = true' : '';

  return query<MessageTemplate>(`
    SELECT * FROM message_templates
    ${whereClause}
    ORDER BY category, name
  `);
}

/**
 * 채널별 템플릿 조회
 */
export async function getTemplatesByChannel(
  channel: MessageChannel,
  activeOnly: boolean = true
): Promise<MessageTemplate[]> {
  let whereClause = `channel = ${escapeString(channel)}`;
  if (activeOnly) {
    whereClause += ' AND is_active = true';
  }

  return query<MessageTemplate>(`
    SELECT * FROM message_templates
    WHERE ${whereClause}
    ORDER BY category, name
  `);
}

/**
 * 템플릿 단건 조회
 */
export async function getTemplateById(id: number): Promise<MessageTemplate | null> {
  const results = await query<MessageTemplate>(`
    SELECT * FROM message_templates WHERE id = ${id}
  `);
  return results[0] || null;
}

/**
 * 템플릿 생성
 */
export async function createTemplate(
  data: CreateMessageTemplateRequest
): Promise<MessageTemplate> {
  const now = getCurrentTimestamp();
  const variables = JSON.stringify(data.variables || []);

  const result = await query<{ id: number }>(`
    INSERT INTO message_templates (name, channel, category, content, variables, created_at, updated_at)
    VALUES (
      ${escapeString(data.name)},
      ${escapeString(data.channel)},
      ${escapeString(data.category || null)},
      ${escapeString(data.content)},
      ${escapeString(variables)}::jsonb,
      ${escapeString(now)},
      ${escapeString(now)}
    ) RETURNING id
  `);

  const created = await getTemplateById(result[0].id);
  if (!created) {
    throw new Error('템플릿 생성 실패');
  }
  return created;
}

/**
 * 템플릿 수정
 */
export async function updateTemplate(
  id: number,
  data: UpdateMessageTemplateRequest
): Promise<MessageTemplate | null> {
  const now = getCurrentTimestamp();
  const updates: string[] = [`updated_at = ${escapeString(now)}`];

  if (data.name !== undefined) {
    updates.push(`name = ${escapeString(data.name)}`);
  }
  if (data.channel !== undefined) {
    updates.push(`channel = ${escapeString(data.channel)}`);
  }
  if (data.category !== undefined) {
    updates.push(`category = ${escapeString(data.category)}`);
  }
  if (data.content !== undefined) {
    updates.push(`content = ${escapeString(data.content)}`);
  }
  if (data.variables !== undefined) {
    updates.push(`variables = ${escapeString(JSON.stringify(data.variables))}::jsonb`);
  }
  if (data.is_active !== undefined) {
    updates.push(`is_active = ${data.is_active}`);
  }

  await execute(`
    UPDATE message_templates
    SET ${updates.join(', ')}
    WHERE id = ${id}
  `);

  return getTemplateById(id);
}

/**
 * 템플릿 삭제
 */
export async function deleteTemplate(id: number): Promise<boolean> {
  const result = await execute(`
    DELETE FROM message_templates WHERE id = ${id}
  `);
  return (result.changes || 0) > 0;
}

// ============================================
// 메시지 발송
// ============================================

/**
 * 템플릿 변수 치환
 */
export function replaceTemplateVariables(
  content: string,
  variables: Record<string, string>
): string {
  let result = content;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
  }
  return result;
}

/**
 * 메시지 발송 (실제 API 연동은 추후 구현)
 * 현재는 발송 기록만 저장하고 즉시 sent 상태로 변경
 */
export async function sendMessage(data: SendMessageRequest): Promise<MessageLog> {
  const now = getCurrentTimestamp();

  // 변수 치환된 내용
  const finalContent = data.variables
    ? replaceTemplateVariables(data.content, data.variables)
    : data.content;

  const variablesJson = data.variables
    ? `${escapeString(JSON.stringify(data.variables))}::jsonb`
    : 'NULL';

  // 발송 기록 생성
  const result = await query<{ id: number }>(`
    INSERT INTO message_logs (
      patient_id, template_id, channel, phone, content,
      variables_used, status, sent_at, created_at, created_by
    ) VALUES (
      ${data.patient_id || 'NULL'},
      ${data.template_id || 'NULL'},
      ${escapeString(data.channel)},
      ${escapeString(data.phone)},
      ${escapeString(finalContent)},
      ${variablesJson},
      'sent',
      ${escapeString(now)},
      ${escapeString(now)},
      ${escapeString(data.created_by || null)}
    ) RETURNING id
  `);

  const log = await getMessageLogById(result[0].id);
  if (!log) {
    throw new Error('메시지 발송 기록 생성 실패');
  }

  // TODO: 실제 SMS/카카오 API 연동
  // 성공/실패에 따라 status 업데이트
  console.log(`📱 메시지 발송 (${data.channel}): ${data.phone} - ${finalContent.slice(0, 50)}...`);

  return log;
}

/**
 * 일괄 메시지 발송
 */
export async function sendBulkMessages(
  messages: SendMessageRequest[]
): Promise<{ success: number; failed: number; logs: MessageLog[] }> {
  const logs: MessageLog[] = [];
  let success = 0;
  let failed = 0;

  for (const message of messages) {
    try {
      const log = await sendMessage(message);
      logs.push(log);
      success++;
    } catch (error) {
      console.error('메시지 발송 실패:', error);
      failed++;
    }
  }

  return { success, failed, logs };
}

// ============================================
// 발송 이력 조회
// ============================================

/**
 * 메시지 로그 단건 조회
 */
export async function getMessageLogById(id: number): Promise<MessageLog | null> {
  const results = await query<MessageLog>(`
    SELECT
      ml.*,
      json_build_object(
        'name', p.name,
        'chart_number', p.chart_number
      ) as patient
    FROM message_logs ml
    LEFT JOIN patients p ON ml.patient_id = p.id
    WHERE ml.id = ${id}
  `);
  return results[0] || null;
}

/**
 * 메시지 발송 이력 조회
 */
export async function getMessageLogs(
  options: {
    patientId?: number;
    channel?: MessageChannel;
    status?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
  } = {}
): Promise<MessageLog[]> {
  const conditions: string[] = [];

  if (options.patientId) {
    conditions.push(`ml.patient_id = ${options.patientId}`);
  }
  if (options.channel) {
    conditions.push(`ml.channel = ${escapeString(options.channel)}`);
  }
  if (options.status) {
    conditions.push(`ml.status = ${escapeString(options.status)}`);
  }
  if (options.startDate) {
    conditions.push(`ml.created_at >= ${escapeString(options.startDate)}`);
  }
  if (options.endDate) {
    conditions.push(`ml.created_at <= ${escapeString(options.endDate)}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = options.limit || 100;

  return query<MessageLog>(`
    SELECT
      ml.*,
      json_build_object(
        'name', p.name,
        'chart_number', p.chart_number
      ) as patient
    FROM message_logs ml
    LEFT JOIN patients p ON ml.patient_id = p.id
    ${whereClause}
    ORDER BY ml.created_at DESC
    LIMIT ${limit}
  `);
}

/**
 * 오늘 발송 이력 조회
 */
export async function getTodayMessageLogs(): Promise<MessageLog[]> {
  const today = new Date().toISOString().split('T')[0];
  return getMessageLogs({ startDate: today });
}

/**
 * 환자별 발송 이력 조회
 */
export async function getMessageLogsByPatient(
  patientId: number,
  limit: number = 20
): Promise<MessageLog[]> {
  return getMessageLogs({ patientId, limit });
}

// ============================================
// 통계
// ============================================

/**
 * 메시지 발송 통계
 */
export async function getMessageStats(): Promise<MessageStats> {
  const today = new Date().toISOString().split('T')[0];

  const stats = await query<{ channel: string; status: string; count: number }>(`
    SELECT channel, status, COUNT(*) as count
    FROM message_logs
    WHERE DATE(created_at) = ${escapeString(today)}
    GROUP BY channel, status
  `);

  let total_sent_today = 0;
  let failed_today = 0;
  const by_channel: Record<MessageChannel, number> = { sms: 0, kakao: 0 };

  for (const row of stats) {
    const count = Number(row.count);
    if (row.status !== 'failed') {
      total_sent_today += count;
      by_channel[row.channel as MessageChannel] = (by_channel[row.channel as MessageChannel] || 0) + count;
    } else {
      failed_today += count;
    }
  }

  return {
    total_sent_today,
    by_channel,
    failed_today,
  };
}
