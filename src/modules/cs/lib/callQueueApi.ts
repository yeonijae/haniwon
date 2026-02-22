/**
 * 아웃바운드 콜 큐 API
 * outbound_call_queue, call_condition_settings 테이블 CRUD
 */

import { query, execute, escapeString, getCurrentTimestamp } from '@shared/lib/postgres';
import type {
  CallQueueItem,
  CallNote,
  CreateCallQueueRequest,
  UpdateCallQueueRequest,
  CallConditionSetting,
  CallType,
  CallStatus,
  CallCenterStats,
} from '../types/crm';

// ============================================
// 콜 큐 관리
// ============================================

/**
 * 콜 큐 목록 조회 (상태별)
 */
export async function getCallQueue(
  status: CallStatus = 'pending',
  callType?: CallType,
  limit: number = 100
): Promise<CallQueueItem[]> {
  let whereClause = `q.status = ${escapeString(status)}`;

  if (callType) {
    whereClause += ` AND q.call_type = ${escapeString(callType)}`;
  }

  return query<CallQueueItem>(`
    SELECT
      q.*,
      json_build_object(
        'name', p.name,
        'chart_number', p.chart_number,
        'phone', p.phone,
        'last_visit_date', p.last_visit_date
      ) as patient
    FROM outbound_call_queue q
    LEFT JOIN patients p ON q.patient_id = p.id
    WHERE ${whereClause}
    ORDER BY q.priority DESC, q.due_date ASC
    LIMIT ${limit}
  `);
}

/**
 * 오늘 콜 큐 조회 (예정일 기준)
 */
let _queueMigrated = false;
async function ensureQueueReasonColumn() {
  if (_queueMigrated) return;
  _queueMigrated = true;
  await execute(`ALTER TABLE outbound_call_queue ADD COLUMN IF NOT EXISTS reason TEXT`).catch(() => {});
  await execute(`ALTER TABLE outbound_call_queue ADD COLUMN IF NOT EXISTS original_due_date DATE`).catch(() => {});
}

export async function getTodayCallQueue(callType?: CallType, baseDate?: string, statusFilter?: 'all' | 'incomplete' | 'completed', dateFrom?: string): Promise<CallQueueItem[]> {
  await ensureQueueReasonColumn();
  const today = baseDate || new Date().toISOString().split('T')[0];

  let whereClause = `q.due_date <= ${escapeString(today)}`;

  // 상태 필터
  if (statusFilter === 'completed') {
    // 완료 + 오늘 미룬 건
    const from = dateFrom ? escapeString(dateFrom) : escapeString(today);
    whereClause = `(q.status = 'completed' AND q.due_date >= ${from} AND q.due_date <= ${escapeString(today)}) OR (q.postponed_to IS NOT NULL AND q.due_date > ${escapeString(today)} AND DATE(q.updated_at) >= ${from} AND DATE(q.updated_at) <= ${escapeString(today)})`;
  } else if (statusFilter === 'all') {
    // 전체: 조건 없음
  } else {
    // 기본(incomplete): pending + no_answer
    whereClause += ` AND q.status IN ('pending', 'no_answer')`;
  }

  if (callType) {
    whereClause += ` AND q.call_type = ${escapeString(callType)}`;
  }

  return query<CallQueueItem>(`
    SELECT
      q.*,
      json_build_object(
        'name', p.name,
        'chart_number', p.chart_number,
        'phone', p.phone,
        'last_visit_date', p.last_visit_date
      ) as patient,
      CASE WHEN q.related_type = 'herbal_draft' THEN
        COALESCE(d.herbal_name, d.consultation_type, '탕약')
      ELSE NULL END as herbal_name,
      q.reason
    FROM outbound_call_queue q
    LEFT JOIN patients p ON q.patient_id = p.id
    LEFT JOIN cs_herbal_drafts d ON q.related_type = 'herbal_draft' AND q.related_id = d.id
    WHERE ${whereClause}
    ORDER BY q.status ASC, q.priority DESC, q.due_date ASC
  `);
}

/**
 * 콜 큐 단건 조회
 */
export async function getCallQueueItemById(id: number): Promise<CallQueueItem | null> {
  const results = await query<CallQueueItem>(`
    SELECT
      q.*,
      json_build_object(
        'name', p.name,
        'chart_number', p.chart_number,
        'phone', p.phone,
        'last_visit_date', p.last_visit_date
      ) as patient
    FROM outbound_call_queue q
    LEFT JOIN patients p ON q.patient_id = p.id
    WHERE q.id = ${id}
  `);
  return results[0] || null;
}

/**
 * 콜 큐 아이템 생성
 */
export async function createCallQueueItem(
  data: CreateCallQueueRequest
): Promise<CallQueueItem> {
  const now = getCurrentTimestamp();

  const result = await query<{ id: number }>(`
    INSERT INTO outbound_call_queue (
      patient_id, call_type, related_type, related_id,
      due_date, priority, status, reason, created_at, updated_at
    ) VALUES (
      ${data.patient_id},
      ${escapeString(data.call_type)},
      ${escapeString(data.related_type || null)},
      ${data.related_id || 'NULL'},
      ${escapeString(data.due_date)},
      ${data.priority || 0},
      'pending',
      ${escapeString((data as any).reason || null)},
      ${escapeString(now)},
      ${escapeString(now)}
    ) RETURNING id
  `);

  let id = result?.[0]?.id;
  if (!id) {
    // RETURNING fallback: 최근 생성된 레코드 조회
    const fallback = await query<{ id: number }>(`
      SELECT id FROM outbound_call_queue
      WHERE patient_id = ${data.patient_id} AND call_type = ${escapeString(data.call_type)}
      ORDER BY id DESC LIMIT 1
    `);
    id = fallback?.[0]?.id;
  }

  if (!id) throw new Error('콜 큐 아이템 생성 실패');

  const created = await getCallQueueItemById(id);
  if (!created) throw new Error('콜 큐 아이템 조회 실패');
  return created;
}

/**
 * 콜 큐 아이템 상태 업데이트
 */
export async function updateCallQueueItem(
  id: number,
  data: UpdateCallQueueRequest
): Promise<CallQueueItem | null> {
  const now = getCurrentTimestamp();
  const updates: string[] = [`updated_at = ${escapeString(now)}`];

  if (data.status !== undefined) {
    updates.push(`status = ${escapeString(data.status)}`);

    // 완료 시 completed_at 설정
    if (data.status === 'completed') {
      updates.push(`completed_at = ${escapeString(now)}`);
    }
  }

  if (data.postponed_to !== undefined) {
    updates.push(`postponed_to = ${escapeString(data.postponed_to)}`);
  }

  if (data.contact_log_id !== undefined) {
    updates.push(`contact_log_id = ${data.contact_log_id}`);
  }

  await execute(`
    UPDATE outbound_call_queue
    SET ${updates.join(', ')}
    WHERE id = ${id}
  `);

  return getCallQueueItemById(id);
}

/**
 * 콜 완료 처리 (응대 기록 연동)
 */
export async function completeCall(
  queueId: number,
  contactLogId?: number | null
): Promise<CallQueueItem | null> {
  const updates: Record<string, any> = { status: 'completed' };
  if (contactLogId != null) updates.contact_log_id = contactLogId;
  return updateCallQueueItem(queueId, updates);
}

/**
 * 콜 미루기
 */
export async function postponeCall(
  queueId: number,
  newDueDate: string
): Promise<CallQueueItem | null> {
  const now = getCurrentTimestamp();

  // original_due_date가 없으면 현재 due_date를 보존
  await execute(`
    UPDATE outbound_call_queue
    SET original_due_date = COALESCE(original_due_date, due_date),
        status = 'pending',
        postponed_to = ${escapeString(newDueDate)},
        due_date = ${escapeString(newDueDate)},
        updated_at = ${escapeString(now)}
    WHERE id = ${queueId}
  `);

  return getCallQueueItemById(queueId);
}

/**
 * 미루기 취소 → 원래 날짜로 복원
 */
export async function undoPostpone(queueId: number): Promise<CallQueueItem | null> {
  const now = getCurrentTimestamp();
  await execute(`
    UPDATE outbound_call_queue
    SET due_date = COALESCE(original_due_date, due_date),
        postponed_to = NULL,
        original_due_date = NULL,
        status = 'pending',
        updated_at = ${escapeString(now)}
    WHERE id = ${queueId}
  `);
  return getCallQueueItemById(queueId);
}

/**
 * 콜 큐 삭제
 */
export async function deleteCallQueueItem(id: number): Promise<boolean> {
  const result = await execute(`
    DELETE FROM outbound_call_queue WHERE id = ${id}
  `);
  return (result.changes || 0) > 0;
}

// ============================================
// 콜 조건 설정 관리
// ============================================

/**
 * 모든 콜 조건 설정 조회
 */
export async function getCallConditionSettings(): Promise<CallConditionSetting[]> {
  return query<CallConditionSetting>(`
    SELECT * FROM call_condition_settings
    ORDER BY id
  `);
}

/**
 * 활성 콜 조건 설정만 조회
 */
export async function getActiveCallConditionSettings(): Promise<CallConditionSetting[]> {
  return query<CallConditionSetting>(`
    SELECT * FROM call_condition_settings
    WHERE is_active = true
    ORDER BY id
  `);
}

/**
 * 콜 조건 설정 업데이트
 */
export async function updateCallConditionSetting(
  callType: CallType,
  data: Partial<Pick<CallConditionSetting, 'label' | 'description' | 'condition_params' | 'is_active'>>
): Promise<CallConditionSetting | null> {
  const updates: string[] = [];

  if (data.label !== undefined) {
    updates.push(`label = ${escapeString(data.label)}`);
  }
  if (data.description !== undefined) {
    updates.push(`description = ${escapeString(data.description)}`);
  }
  if (data.condition_params !== undefined) {
    updates.push(`condition_params = ${escapeString(JSON.stringify(data.condition_params))}::jsonb`);
  }
  if (data.is_active !== undefined) {
    updates.push(`is_active = ${data.is_active}`);
  }

  if (updates.length === 0) {
    const results = await query<CallConditionSetting>(`
      SELECT * FROM call_condition_settings WHERE call_type = ${escapeString(callType)}
    `);
    return results[0] || null;
  }

  await execute(`
    UPDATE call_condition_settings
    SET ${updates.join(', ')}
    WHERE call_type = ${escapeString(callType)}
  `);

  const results = await query<CallConditionSetting>(`
    SELECT * FROM call_condition_settings WHERE call_type = ${escapeString(callType)}
  `);
  return results[0] || null;
}

// ============================================
// 통계
// ============================================

/**
 * 콜 센터 통계
 */
export async function getCallCenterStats(): Promise<CallCenterStats> {
  const today = new Date().toISOString().split('T')[0];

  // 대기 중 콜 수
  const pendingStats = await query<{ call_type: string; count: number }>(`
    SELECT call_type, COUNT(*) as count
    FROM outbound_call_queue
    WHERE status = 'pending' AND due_date <= ${escapeString(today)}
    GROUP BY call_type
  `);

  // 오늘 완료한 콜 수
  const completedToday = await query<{ count: number }>(`
    SELECT COUNT(*) as count
    FROM outbound_call_queue
    WHERE status = 'completed'
      AND DATE(completed_at) = ${escapeString(today)}
  `);

  let total_pending = 0;
  const by_type: Record<CallType, number> = {} as Record<CallType, number>;

  for (const row of pendingStats) {
    const count = Number(row.count);
    total_pending += count;
    by_type[row.call_type as CallType] = count;
  }

  return {
    total_pending,
    by_type,
    completed_today: Number(completedToday[0]?.count || 0),
  };
}

/**
 * 환자별 콜 큐 이력 조회
 */
export async function getCallQueueByPatient(
  patientId: number,
  limit: number = 20
): Promise<CallQueueItem[]> {
  return query<CallQueueItem>(`
    SELECT * FROM outbound_call_queue
    WHERE patient_id = ${patientId}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `);
}

// ============================================
// 조건별 콜 대상자 리스트업 (Phase 3)
// ============================================

export interface CallTargetPatient {
  patient_id: number;
  name: string;
  chart_number: string;
  phone: string | null;
  call_type: CallType;
  reason: string;
  related_type?: string;
  related_id?: number;
  priority: number;
  last_visit_date?: string;
  // 추가 정보
  extra_info?: Record<string, any>;
}

/**
 * 배송콜 대상자 조회
 * 조건: 복약 시작(medication_start) 후 2~3일 경과
 * cs_herbal_drafts의 journey_status.medication_start 기준
 */
export async function getDeliveryCallTargets(daysAfter: number = 3, baseDate?: string): Promise<CallTargetPatient[]> {
  const now = baseDate ? new Date(baseDate + 'T00:00:00') : new Date();
  const dateTo = new Date(now);
  dateTo.setDate(now.getDate() - 2);
  const toStr = `${dateTo.getFullYear()}-${String(dateTo.getMonth()+1).padStart(2,'0')}-${String(dateTo.getDate()).padStart(2,'0')}`;
  const baseDateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;

  const results = await query<CallTargetPatient>(`
    SELECT
      p.id as patient_id,
      p.name,
      p.chart_number,
      p.phone,
      'delivery_call' as call_type,
      '복약 ' || (${escapeString(baseDateStr)}::date - (d.journey_status->>'medication_start')::date) || '일차 확인' as reason,
      'herbal_draft' as related_type,
      d.id as related_id,
      1 as priority,
      p.last_visit_date,
      json_build_object(
        'delivery_method', d.delivery_method,
        'shipping_date', d.shipping_date,
        'medication_start', d.journey_status->>'medication_start',
        'medication_days', d.journey_status->>'medication_days',
        'herbal_name', COALESCE(d.herbal_name, d.consultation_type, '탕약')
      ) as extra_info
    FROM cs_herbal_drafts d
    JOIN patients p ON d.chart_number = p.chart_number
    WHERE d.journey_status->>'medication_start' IS NOT NULL
      AND (d.journey_status->>'medication_start')::date <= ${escapeString(toStr)}
      AND NOT EXISTS (
        SELECT 1 FROM outbound_call_queue q
        WHERE q.patient_id = p.id
          AND q.call_type = 'delivery_call'
          AND q.related_id = d.id
          AND q.related_type = 'herbal_draft'
          AND q.status IN ('completed', 'pending', 'no_answer')
      )
    ORDER BY (d.journey_status->>'medication_start')::date DESC
    LIMIT 100
  `);

  return results;
}

/**
 * 이탈위험(1회) 대상자 조회
 * 조건: 방문 1회, 마지막 방문 후 N일 이상 (기본 14일)
 */
export async function getChurnRisk1Targets(daysSince: number = 14): Promise<CallTargetPatient[]> {
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() - daysSince);
  const dateStr = targetDate.toISOString().split('T')[0];

  const results = await query<CallTargetPatient>(`
    SELECT
      p.id as patient_id,
      p.name,
      p.chart_number,
      p.phone,
      'churn_risk_1' as call_type,
      '초진 후 ' || ${daysSince} || '일 경과' as reason,
      NULL as related_type,
      NULL as related_id,
      2 as priority,
      p.last_visit_date,
      json_build_object(
        'total_visits', p.total_visits,
        'first_visit', p.first_visit_date,
        'days_since', EXTRACT(DAY FROM NOW() - p.last_visit_date::timestamp)::int
      ) as extra_info
    FROM patients p
    WHERE p.total_visits = 1
      AND p.last_visit_date IS NOT NULL
      AND p.last_visit_date <= ${escapeString(dateStr)}
      AND NOT EXISTS (
        SELECT 1 FROM outbound_call_queue q
        WHERE q.patient_id = p.id
          AND q.call_type = 'churn_risk_1'
          AND q.status IN ('completed', 'pending', 'no_answer')
          AND q.created_at > NOW() - INTERVAL '30 days'
      )
    ORDER BY p.last_visit_date ASC
    LIMIT 100
  `);

  return results;
}

/**
 * 재방문유도(3회 미만) 대상자 조회
 * 조건: 방문 3회 미만, 마지막 방문 후 N일 이상 (기본 30일)
 */
export async function getChurnRisk3Targets(daysSince: number = 30): Promise<CallTargetPatient[]> {
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() - daysSince);
  const dateStr = targetDate.toISOString().split('T')[0];

  const results = await query<CallTargetPatient>(`
    SELECT
      p.id as patient_id,
      p.name,
      p.chart_number,
      p.phone,
      'churn_risk_3' as call_type,
      p.total_visits || '회 방문 후 ' || ${daysSince} || '일 경과' as reason,
      NULL as related_type,
      NULL as related_id,
      1 as priority,
      p.last_visit_date,
      json_build_object(
        'total_visits', p.total_visits,
        'days_since', EXTRACT(DAY FROM NOW() - p.last_visit_date::timestamp)::int
      ) as extra_info
    FROM patients p
    WHERE p.total_visits > 1
      AND p.total_visits < 3
      AND p.last_visit_date IS NOT NULL
      AND p.last_visit_date <= ${escapeString(dateStr)}
      AND NOT EXISTS (
        SELECT 1 FROM outbound_call_queue q
        WHERE q.patient_id = p.id
          AND q.call_type = 'churn_risk_3'
          AND q.status IN ('completed', 'pending', 'no_answer')
          AND q.created_at > NOW() - INTERVAL '30 days'
      )
    ORDER BY p.last_visit_date ASC
    LIMIT 100
  `);

  return results;
}

/**
 * 미복용 대상자 조회
 * 조건: 한약 선결제 후 N개월 이상, 아직 수령 안 한 경우 (기본 2개월)
 */
export async function getUnconsumedTargets(monthsSince: number = 2): Promise<CallTargetPatient[]> {
  const targetDate = new Date();
  targetDate.setMonth(targetDate.getMonth() - monthsSince);
  const dateStr = targetDate.toISOString().split('T')[0];

  const results = await query<CallTargetPatient>(`
    SELECT
      p.id as patient_id,
      p.name,
      p.chart_number,
      p.phone,
      'unconsumed' as call_type,
      '선결제 ${monthsSince}개월 이상, 잔여 ' || hpkg.remaining_count || '첩' as reason,
      'herbal_package' as related_type,
      hpkg.id as related_id,
      3 as priority,
      p.last_visit_date,
      json_build_object(
        'herbal_name', hpkg.herbal_name,
        'total_count', hpkg.total_count,
        'used_count', hpkg.used_count,
        'remaining', hpkg.total_count - hpkg.used_count,
        'purchased_at', hpkg.created_at
      ) as extra_info
    FROM cs_herbal_packages hpkg
    JOIN patients p ON hpkg.patient_id = p.id
    WHERE hpkg.status = 'active'
      AND hpkg.used_count < hpkg.total_count
      AND hpkg.created_at <= ${escapeString(dateStr)}
      AND NOT EXISTS (
        SELECT 1 FROM outbound_call_queue q
        WHERE q.patient_id = p.id
          AND q.call_type = 'unconsumed'
          AND q.related_id = hpkg.id
          AND q.status IN ('completed', 'pending', 'no_answer')
      )
    ORDER BY hpkg.created_at ASC
    LIMIT 100
  `);

  return results;
}

/**
 * VIP 관리 대상자 조회
 * 조건: 공진단/녹용 구매자
 */
export async function getVipCareTargets(): Promise<CallTargetPatient[]> {
  // VIP 상품명 키워드
  const vipKeywords = ['공진단', '녹용', '경옥고', '쌍패탕'];
  const keywordCondition = vipKeywords.map(k => `hpkg.herbal_name ILIKE ${escapeString('%' + k + '%')}`).join(' OR ');

  const results = await query<CallTargetPatient>(`
    SELECT
      p.id as patient_id,
      p.name,
      p.chart_number,
      p.phone,
      'vip_care' as call_type,
      hpkg.herbal_name || ' 복용 관리' as reason,
      'herbal_package' as related_type,
      hpkg.id as related_id,
      5 as priority,
      p.last_visit_date,
      json_build_object(
        'herbal_name', hpkg.herbal_name,
        'total_count', hpkg.total_count,
        'used_count', hpkg.used_count,
        'remaining', hpkg.total_count - hpkg.used_count,
        'last_pickup', (SELECT MAX(created_at) FROM cs_herbal_pickups WHERE package_id = hpkg.id)
      ) as extra_info
    FROM cs_herbal_packages hpkg
    JOIN patients p ON hpkg.patient_id = p.id
    WHERE hpkg.status = 'active'
      AND (${keywordCondition})
      AND NOT EXISTS (
        SELECT 1 FROM outbound_call_queue q
        WHERE q.patient_id = p.id
          AND q.call_type = 'vip_care'
          AND q.status IN ('completed', 'pending', 'no_answer')
          AND q.created_at > NOW() - INTERVAL '30 days'
      )
    ORDER BY hpkg.created_at DESC
    LIMIT 100
  `);

  return results;
}

/**
 * 내원콜 대상자
 * 조건: 복약 시작 후 medication_days - 5일 경과 (복약 완료 5일 전 내원 안내)
 * cs_herbal_drafts의 journey_status 기준
 */
export async function getVisitCallTargets(baseDate?: string): Promise<CallTargetPatient[]> {
  const now = baseDate ? new Date(baseDate + 'T00:00:00') : new Date();
  const baseDateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;

  const results = await query<CallTargetPatient>(`
    SELECT
      p.id as patient_id,
      p.name,
      p.chart_number,
      p.phone,
      'visit_call' as call_type,
      '복약 ' || (${escapeString(baseDateStr)}::date - (d.journey_status->>'medication_start')::date) || '일차 / '
        || COALESCE(d.journey_status->>'medication_days', '15') || '일분 - 내원 안내' as reason,
      'herbal_draft' as related_type,
      d.id as related_id,
      7 as priority,
      p.last_visit_date,
      json_build_object(
        'herbal_name', COALESCE(d.herbal_name, d.consultation_type, '탕약'),
        'medication_start', d.journey_status->>'medication_start',
        'medication_days', d.journey_status->>'medication_days',
        'shipping_date', d.shipping_date
      ) as extra_info
    FROM cs_herbal_drafts d
    JOIN patients p ON d.chart_number = p.chart_number
    WHERE d.journey_status->>'medication_start' IS NOT NULL
      AND COALESCE((d.journey_status->>'medication_days')::int, 15) > 0
      AND (${escapeString(baseDateStr)}::date - (d.journey_status->>'medication_start')::date)
          >= COALESCE((d.journey_status->>'medication_days')::int, 15) - 5
      AND NOT EXISTS (
        SELECT 1 FROM outbound_call_queue q
        WHERE q.patient_id = p.id
          AND q.call_type = 'visit_call'
          AND q.related_id = d.id
          AND q.related_type = 'herbal_draft'
          AND q.status IN ('completed', 'pending', 'no_answer')
      )
    ORDER BY (d.journey_status->>'medication_start')::date ASC
    LIMIT 100
  `);

  return results;
}

/**
 * 애프터콜 대상자
 * 조건: 복약 완료 후 1~3일 경과 (복약 종료 직후 상태 확인)
 * cs_herbal_drafts의 journey_status 기준
 */
export async function getAfterCallTargets(baseDate?: string): Promise<CallTargetPatient[]> {
  const now = baseDate ? new Date(baseDate + 'T00:00:00') : new Date();
  const baseDateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;

  const results = await query<CallTargetPatient>(`
    SELECT
      p.id as patient_id,
      p.name,
      p.chart_number,
      p.phone,
      'after_call' as call_type,
      '복약완료 ' || (${escapeString(baseDateStr)}::date - ((d.journey_status->>'medication_start')::date + COALESCE((d.journey_status->>'medication_days')::int, 15))) || '일차 - 상태 확인' as reason,
      'herbal_draft' as related_type,
      d.id as related_id,
      5 as priority,
      p.last_visit_date,
      json_build_object(
        'herbal_name', COALESCE(d.herbal_name, d.consultation_type, '탕약'),
        'medication_start', d.journey_status->>'medication_start',
        'medication_days', d.journey_status->>'medication_days',
        'medication_end', (d.journey_status->>'medication_start')::date + COALESCE((d.journey_status->>'medication_days')::int, 15)
      ) as extra_info
    FROM cs_herbal_drafts d
    JOIN patients p ON d.chart_number = p.chart_number
    WHERE d.journey_status->>'medication_start' IS NOT NULL
      AND COALESCE((d.journey_status->>'medication_days')::int, 15) > 0
      AND ${escapeString(baseDateStr)}::date >= (d.journey_status->>'medication_start')::date + COALESCE((d.journey_status->>'medication_days')::int, 15) + 1
      AND NOT EXISTS (
        SELECT 1 FROM outbound_call_queue q
        WHERE q.patient_id = p.id
          AND q.call_type = 'after_call'
          AND q.related_id = d.id
          AND q.related_type = 'herbal_draft'
          AND q.status IN ('completed', 'pending', 'no_answer')
      )
    ORDER BY (d.journey_status->>'medication_start')::date DESC
    LIMIT 100
  `);

  return results;
}

/**
 * 재결제 상담 대상자
 * 조건: 한약 선결제 패키지의 잔여 횟수가 0이고 아직 활성 상태인 환자
 */
export async function getRepaymentConsultTargets(): Promise<CallTargetPatient[]> {
  const results = await query<CallTargetPatient>(`
    SELECT
      p.id as patient_id,
      p.name,
      p.chart_number,
      p.phone,
      'repayment_consult' as call_type,
      hpkg.herbal_name || ' 선결제 소진 - 재결제 상담' as reason,
      'herbal_package' as related_type,
      hpkg.id as related_id,
      8 as priority,
      p.last_visit_date,
      json_build_object(
        'herbal_name', hpkg.herbal_name,
        'total_count', hpkg.total_count,
        'used_count', hpkg.used_count,
        'last_pickup', (SELECT MAX(pickup_date) FROM cs_herbal_pickups WHERE package_id = hpkg.id)
      ) as extra_info
    FROM cs_herbal_packages hpkg
    JOIN patients p ON hpkg.patient_id = p.id
    WHERE hpkg.status = 'active'
      AND hpkg.remaining_count = 0
      AND NOT EXISTS (
        SELECT 1 FROM outbound_call_queue q
        WHERE q.patient_id = p.id
          AND q.call_type = 'repayment_consult'
          AND q.related_id = hpkg.id
          AND q.status IN ('completed', 'pending', 'no_answer')
          AND q.created_at > NOW() - INTERVAL '30 days'
      )
    ORDER BY hpkg.updated_at ASC
    LIMIT 100
  `);

  return results;
}

/**
 * 리마인드콜 대상자 (복약 완료 3개월 후)
 * 조건: 패키지가 완료(completed)되고, 마지막 수령일로부터 3개월 경과
 */
export async function getRemind3MonthTargets(): Promise<CallTargetPatient[]> {
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  const dateStr = threeMonthsAgo.toISOString().split('T')[0];

  const results = await query<CallTargetPatient>(`
    SELECT
      p.id as patient_id,
      p.name,
      p.chart_number,
      p.phone,
      'remind_3month' as call_type,
      hpkg.herbal_name || ' 복약완료 3개월 - 리마인드' as reason,
      'herbal_package' as related_type,
      hpkg.id as related_id,
      4 as priority,
      p.last_visit_date,
      json_build_object(
        'herbal_name', hpkg.herbal_name,
        'total_count', hpkg.total_count,
        'completed_at', hpkg.updated_at,
        'last_pickup', (SELECT MAX(pickup_date) FROM cs_herbal_pickups WHERE package_id = hpkg.id)
      ) as extra_info
    FROM cs_herbal_packages hpkg
    JOIN patients p ON hpkg.patient_id = p.id
    WHERE hpkg.status = 'completed'
      AND hpkg.remaining_count = 0
      AND (SELECT MAX(pickup_date) FROM cs_herbal_pickups WHERE package_id = hpkg.id) <= '${dateStr}'
      AND NOT EXISTS (
        SELECT 1 FROM outbound_call_queue q
        WHERE q.patient_id = p.id
          AND q.call_type = 'remind_3month'
          AND q.related_id = hpkg.id
          AND q.status IN ('completed', 'pending', 'no_answer')
      )
    ORDER BY hpkg.updated_at ASC
    LIMIT 100
  `);

  return results;
}

/**
 * 유효기간 임박 대상자
 * 조건: 약침 패키지 유효기간이 14일 이내이고, 연락 횟수가 3회 미만
 */
export async function getExpiryWarningTargets(daysUntilExpiry: number = 14): Promise<CallTargetPatient[]> {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + daysUntilExpiry);
  const futureDateStr = futureDate.toISOString().split('T')[0];
  const todayStr = new Date().toISOString().split('T')[0];

  const results = await query<CallTargetPatient>(`
    SELECT
      p.id as patient_id,
      p.name,
      p.chart_number,
      p.phone,
      'expiry_warning' as call_type,
      tp.package_name || ' 유효기간 ' || tp.expire_date || ' 임박' as reason,
      'treatment_package' as related_type,
      tp.id as related_id,
      9 as priority,
      p.last_visit_date,
      json_build_object(
        'package_name', tp.package_name,
        'expire_date', tp.expire_date,
        'remaining_count', tp.remaining_count,
        'days_until_expiry', tp.expire_date::date - CURRENT_DATE,
        'contact_count', COALESCE((
          SELECT COUNT(*) FROM patient_contact_logs cl
          WHERE cl.patient_id = p.id
            AND cl.related_type = 'treatment_package'
            AND cl.related_id = tp.id
        ), 0)
      ) as extra_info
    FROM cs_treatment_packages tp
    JOIN patients p ON tp.patient_id = p.id
    WHERE tp.status = 'active'
      AND tp.expire_date IS NOT NULL
      AND tp.expire_date <= '${futureDateStr}'
      AND tp.expire_date >= '${todayStr}'
      AND tp.remaining_count > 0
      AND COALESCE((
        SELECT COUNT(*) FROM patient_contact_logs cl
        WHERE cl.patient_id = p.id
          AND cl.related_type = 'treatment_package'
          AND cl.related_id = tp.id
      ), 0) < 3
      AND NOT EXISTS (
        SELECT 1 FROM outbound_call_queue q
        WHERE q.patient_id = p.id
          AND q.call_type = 'expiry_warning'
          AND q.related_id = tp.id
          AND q.status IN ('completed', 'pending', 'no_answer')
          AND q.created_at > NOW() - INTERVAL '7 days'
      )
    ORDER BY tp.expire_date ASC
    LIMIT 100
  `);

  return results;
}

/**
 * 전체 콜 대상자 조회 (유형별 통합)
 */
export async function getAllCallTargets(callType?: CallType, baseDate?: string): Promise<CallTargetPatient[]> {
  if (callType) {
    switch (callType) {
      case 'delivery_call':
        return getDeliveryCallTargets(3, baseDate);
      case 'visit_call':
        return getVisitCallTargets(baseDate);
      case 'after_call':
        return getAfterCallTargets(baseDate);
      case 'churn_risk_1':
        return getChurnRisk1Targets();
      case 'churn_risk_3':
        return getChurnRisk3Targets();
      case 'unconsumed':
        return getUnconsumedTargets();
      case 'vip_care':
        return getVipCareTargets();
      case 'repayment_consult':
        return getRepaymentConsultTargets();
      case 'remind_3month':
        return getRemind3MonthTargets();
      case 'expiry_warning':
        return getExpiryWarningTargets();
      default:
        return [];
    }
  }

  // 전체 조회 시 우선순위별로 합침
  const [delivery, visitCall, afterCall, churn1, churn3, unconsumed, vip, repayment, remind, expiry] = await Promise.all([
    getDeliveryCallTargets(3, baseDate),
    getVisitCallTargets(baseDate),
    getAfterCallTargets(baseDate),
    getChurnRisk1Targets(),
    getChurnRisk3Targets(),
    getUnconsumedTargets(),
    getVipCareTargets(),
    getRepaymentConsultTargets(),
    getRemind3MonthTargets(),
    getExpiryWarningTargets(),
  ]);

  return [...expiry, ...repayment, ...vip, ...afterCall, ...visitCall, ...delivery, ...unconsumed, ...remind, ...churn1, ...churn3]
    .sort((a, b) => b.priority - a.priority);
}

// ============================================
// 콜 메모 (outbound_call_notes)
// ============================================

async function ensureCallNotesTable(): Promise<void> {
  await execute(`
    CREATE TABLE IF NOT EXISTS outbound_call_notes (
      id SERIAL PRIMARY KEY,
      queue_id INTEGER NOT NULL REFERENCES outbound_call_queue(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      created_by TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
}

/**
 * 콜 메모 목록 조회
 */
export async function getCallNotes(queueId: number): Promise<CallNote[]> {
  await ensureCallNotesTable();
  return query<CallNote>(`
    SELECT * FROM outbound_call_notes
    WHERE queue_id = ${queueId}
    ORDER BY created_at ASC
  `);
}

/**
 * 콜 메모 추가
 */
export async function addCallNote(queueId: number, content: string, createdBy?: string): Promise<CallNote> {
  await ensureCallNotesTable();
  const now = getCurrentTimestamp();
  await execute(`
    INSERT INTO outbound_call_notes (queue_id, content, created_by, created_at)
    VALUES (${queueId}, ${escapeString(content)}, ${createdBy ? escapeString(createdBy) : 'NULL'}, ${escapeString(now)})
  `);
  const result = await query<CallNote>(`
    SELECT * FROM outbound_call_notes WHERE queue_id = ${queueId} ORDER BY id DESC LIMIT 1
  `);
  return result[0];
}

/**
 * 콜 메모 삭제
 */
export async function deleteCallNote(noteId: number): Promise<void> {
  await execute(`DELETE FROM outbound_call_notes WHERE id = ${noteId}`);
}

export async function updateCallNote(noteId: number, content: string): Promise<void> {
  await execute(`UPDATE outbound_call_notes SET content = ${escapeString(content)} WHERE id = ${noteId}`);
}

/**
 * 큐 아이템별 메모 일괄 조회 (큐 목록용)
 */
export async function getCallNotesByQueueIds(queueIds: number[]): Promise<Map<number, CallNote[]>> {
  if (queueIds.length === 0) return new Map();
  await ensureCallNotesTable();
  const notes = await query<CallNote>(`
    SELECT * FROM outbound_call_notes
    WHERE queue_id IN (${queueIds.join(',')})
    ORDER BY created_at ASC
  `);
  const map = new Map<number, CallNote[]>();
  for (const n of notes) {
    if (!map.has(n.queue_id)) map.set(n.queue_id, []);
    map.get(n.queue_id)!.push(n);
  }
  return map;
}

/**
 * 대상자(환자+call_type+related) 기준 메모 조회 (대상자 리스트용)
 * 큐에 등록된 적이 있으면 그 큐의 메모를 반환
 */
export async function getCallNotesByTarget(patientId: number, callType: string, relatedId?: number): Promise<CallNote[]> {
  await ensureCallNotesTable();
  let where = `q.patient_id = ${patientId} AND q.call_type = ${escapeString(callType)}`;
  if (relatedId) where += ` AND q.related_id = ${relatedId}`;
  return query<CallNote>(`
    SELECT n.* FROM outbound_call_notes n
    JOIN outbound_call_queue q ON n.queue_id = q.id
    WHERE ${where}
    ORDER BY n.created_at ASC
  `);
}

/**
 * 콜 대상자를 콜 큐에 등록
 */
export async function addTargetToQueue(target: CallTargetPatient): Promise<CallQueueItem> {
  const today = new Date().toISOString().split('T')[0];

  return createCallQueueItem({
    patient_id: target.patient_id,
    call_type: target.call_type,
    related_type: target.related_type,
    related_id: target.related_id,
    due_date: today,
    priority: target.priority,
    reason: target.reason,
  } as any);
}
