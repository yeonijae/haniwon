/**
 * 아웃바운드 콜 큐 API
 * outbound_call_queue, call_condition_settings 테이블 CRUD
 */

import { query, execute, escapeString, getCurrentTimestamp } from '@shared/lib/postgres';
import type {
  CallQueueItem,
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
export async function getTodayCallQueue(callType?: CallType): Promise<CallQueueItem[]> {
  const today = new Date().toISOString().split('T')[0];

  let whereClause = `q.status = 'pending' AND q.due_date <= '${today}'`;

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
      due_date, priority, status, created_at, updated_at
    ) VALUES (
      ${data.patient_id},
      ${escapeString(data.call_type)},
      ${escapeString(data.related_type || null)},
      ${data.related_id || 'NULL'},
      ${escapeString(data.due_date)},
      ${data.priority || 0},
      'pending',
      ${escapeString(now)},
      ${escapeString(now)}
    ) RETURNING id
  `);

  const created = await getCallQueueItemById(result[0].id);
  if (!created) {
    throw new Error('콜 큐 아이템 생성 실패');
  }
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
  contactLogId: number
): Promise<CallQueueItem | null> {
  return updateCallQueueItem(queueId, {
    status: 'completed',
    contact_log_id: contactLogId,
  });
}

/**
 * 콜 미루기
 */
export async function postponeCall(
  queueId: number,
  newDueDate: string
): Promise<CallQueueItem | null> {
  const now = getCurrentTimestamp();

  await execute(`
    UPDATE outbound_call_queue
    SET status = 'postponed',
        postponed_to = ${escapeString(newDueDate)},
        due_date = ${escapeString(newDueDate)},
        updated_at = ${escapeString(now)}
    WHERE id = ${queueId}
  `);

  // 상태를 다시 pending으로 변경 (새 날짜에 다시 대기)
  await execute(`
    UPDATE outbound_call_queue
    SET status = 'pending'
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
    updates.push(`condition_params = '${JSON.stringify(data.condition_params)}'::jsonb`);
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
    WHERE status = 'pending' AND due_date <= '${today}'
    GROUP BY call_type
  `);

  // 오늘 완료한 콜 수
  const completedToday = await query<{ count: number }>(`
    SELECT COUNT(*) as count
    FROM outbound_call_queue
    WHERE status = 'completed'
      AND DATE(completed_at) = '${today}'
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
 * 조건: 배송 후 N일 (기본 3일)
 */
export async function getDeliveryCallTargets(daysAfter: number = 3): Promise<CallTargetPatient[]> {
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() - daysAfter);
  const dateStr = targetDate.toISOString().split('T')[0];

  // herbal_pickups 테이블에서 배송 완료된 건 중 배송일이 N일 전인 건
  const results = await query<CallTargetPatient>(`
    SELECT
      p.id as patient_id,
      p.name,
      p.chart_number,
      p.phone,
      'delivery_call' as call_type,
      '배송 ' || ${daysAfter} || '일차 확인' as reason,
      'herbal_pickup' as related_type,
      hp.id as related_id,
      1 as priority,
      p.last_visit_date,
      json_build_object(
        'pickup_type', hp.pickup_type,
        'delivery_date', hp.delivery_date,
        'herbal_name', COALESCE(hpkg.herbal_name, '한약')
      ) as extra_info
    FROM herbal_pickups hp
    JOIN patients p ON hp.patient_id = p.id
    LEFT JOIN herbal_packages hpkg ON hp.package_id = hpkg.id
    WHERE hp.pickup_type = 'delivery'
      AND hp.delivery_date = '${dateStr}'
      AND hp.status = 'completed'
      AND NOT EXISTS (
        SELECT 1 FROM outbound_call_queue q
        WHERE q.patient_id = p.id
          AND q.call_type = 'delivery_call'
          AND q.related_id = hp.id
          AND q.status IN ('completed', 'pending')
      )
    ORDER BY hp.delivery_date DESC
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
      AND p.last_visit_date <= '${dateStr}'
      AND NOT EXISTS (
        SELECT 1 FROM outbound_call_queue q
        WHERE q.patient_id = p.id
          AND q.call_type = 'churn_risk_1'
          AND q.status IN ('completed', 'pending')
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
      AND p.last_visit_date <= '${dateStr}'
      AND NOT EXISTS (
        SELECT 1 FROM outbound_call_queue q
        WHERE q.patient_id = p.id
          AND q.call_type = 'churn_risk_3'
          AND q.status IN ('completed', 'pending')
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
      '선결제 ' || ${monthsSince} || '개월 이상, 미수령 ' || (hpkg.total_count - hpkg.used_count) || '첩' as reason,
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
    FROM herbal_packages hpkg
    JOIN patients p ON hpkg.patient_id = p.id
    WHERE hpkg.status = 'active'
      AND hpkg.used_count < hpkg.total_count
      AND hpkg.created_at <= '${dateStr}'
      AND NOT EXISTS (
        SELECT 1 FROM outbound_call_queue q
        WHERE q.patient_id = p.id
          AND q.call_type = 'unconsumed'
          AND q.related_id = hpkg.id
          AND q.status IN ('completed', 'pending')
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
  const keywordCondition = vipKeywords.map(k => `hpkg.herbal_name ILIKE '%${k}%'`).join(' OR ');

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
        'last_pickup', (SELECT MAX(created_at) FROM herbal_pickups WHERE package_id = hpkg.id)
      ) as extra_info
    FROM herbal_packages hpkg
    JOIN patients p ON hpkg.patient_id = p.id
    WHERE hpkg.status = 'active'
      AND (${keywordCondition})
      AND NOT EXISTS (
        SELECT 1 FROM outbound_call_queue q
        WHERE q.patient_id = p.id
          AND q.call_type = 'vip_care'
          AND q.status IN ('completed', 'pending')
          AND q.created_at > NOW() - INTERVAL '30 days'
      )
    ORDER BY hpkg.created_at DESC
    LIMIT 100
  `);

  return results;
}

/**
 * 전체 콜 대상자 조회 (유형별 통합)
 */
export async function getAllCallTargets(callType?: CallType): Promise<CallTargetPatient[]> {
  if (callType) {
    switch (callType) {
      case 'delivery_call':
        return getDeliveryCallTargets();
      case 'churn_risk_1':
        return getChurnRisk1Targets();
      case 'churn_risk_3':
        return getChurnRisk3Targets();
      case 'unconsumed':
        return getUnconsumedTargets();
      case 'vip_care':
        return getVipCareTargets();
      default:
        return [];
    }
  }

  // 전체 조회 시 우선순위별로 합침
  const [delivery, churn1, churn3, unconsumed, vip] = await Promise.all([
    getDeliveryCallTargets(),
    getChurnRisk1Targets(),
    getChurnRisk3Targets(),
    getUnconsumedTargets(),
    getVipCareTargets(),
  ]);

  return [...vip, ...delivery, ...unconsumed, ...churn1, ...churn3]
    .sort((a, b) => b.priority - a.priority);
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
  });
}
