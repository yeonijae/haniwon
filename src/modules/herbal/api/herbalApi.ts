/**
 * 한약 복약관리 API
 * - MSSQL (오케이차트): 고액 비급여 결제 조회
 * - SQLite: 복약관리 데이터 저장/조회
 */

import { query, execute, escapeString, toSqlValue, getCurrentDate } from '@shared/lib/sqlite';
import type {
  HerbalTask,
  HerbalTasksResponse,
  HerbalSetupFormData,
  HerbalPurchase,
  HerbalCall,
  HerbalEvent,
  CallType
} from '../types';

// MSSQL API URL (unified-server)
const MSSQL_API_URL = import.meta.env.VITE_MSSQL_API_URL || 'http://192.168.0.173:3100';

// 한약 결제 판단 기준 금액
const HERBAL_MIN_AMOUNT = 200000;

/**
 * MSSQL에서 고액 비급여 결제 조회 (복약관리 설정 필요 건)
 */
export async function fetchPendingHerbalSetup(days: number = 7): Promise<HerbalTask[]> {
  try {
    // 이미 처리된 receipt_pk 목록 조회
    const processed = await query<{ receipt_pk: number }>(
      `SELECT receipt_pk FROM herbal_purchases WHERE receipt_pk IS NOT NULL`
    );
    const processedPks = processed.map(p => p.receipt_pk);

    // MSSQL 쿼리 생성
    const excludeClause = processedPks.length > 0
      ? `AND r.Receipt_PK NOT IN (${processedPks.join(',')})`
      : '';

    const sqlQuery = `
      SELECT
        r.Receipt_PK,
        c.Customer_PK,
        c.sn as chart_number,
        c.name as patient_name,
        c.cell as phone,
        CONVERT(varchar, r.TxDate, 23) as tx_date,
        r.General_Money as total_amount,
        (SELECT TOP 1 d.TxDoctor FROM Detail d
         WHERE d.Customer_PK = r.Customer_PK
           AND CAST(d.TxDate AS DATE) = CAST(r.TxDate AS DATE)
           AND d.TxDoctor IS NOT NULL AND d.TxDoctor != '') as tx_doctor
      FROM Receipt r
      JOIN Customer c ON r.Customer_PK = c.Customer_PK
      WHERE r.General_Money >= ${HERBAL_MIN_AMOUNT}
        AND r.TxDate >= DATEADD(DAY, -${days}, GETDATE())
        ${excludeClause}
      ORDER BY r.TxDate DESC
    `;

    // unified-server의 /api/execute 호출
    const response = await fetch(`${MSSQL_API_URL}/api/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql: sqlQuery })
    });

    if (!response.ok) {
      throw new Error('MSSQL 조회 실패');
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error);
    }

    // columns/rows 형식을 객체 배열로 변환
    const columns: string[] = data.columns || [];
    const rows: any[][] = data.rows || [];

    return rows.map(row => {
      const rowObj: Record<string, any> = {};
      columns.forEach((col, idx) => {
        rowObj[col] = row[idx];
      });

      return {
        task_type: 'herbal_setup' as const,
        task_title: `${rowObj.patient_name} 복약관리 설정`,
        task_description: `${rowObj.tx_date} 결제 ${rowObj.total_amount?.toLocaleString()}원`,
        priority: 'high' as const,
        patient: {
          customer_pk: rowObj.Customer_PK,
          chart_number: rowObj.chart_number,
          name: rowObj.patient_name,
          phone: rowObj.phone
        },
        data: {
          receipt_pk: rowObj.Receipt_PK,
          customer_pk: rowObj.Customer_PK,
          tx_date: rowObj.tx_date,
          total_amount: rowObj.total_amount,
          tx_doctor: rowObj.tx_doctor
        }
      };
    });
  } catch (error) {
    console.error('복약관리 설정 대상 조회 실패:', error);
    return [];
  }
}

/**
 * SQLite에서 오늘의 콜 예정 조회
 */
export async function fetchPendingCalls(): Promise<HerbalTask[]> {
  const callTypeLabels: Record<CallType, string> = {
    chojin: '초진콜',
    bokyak: '복약콜',
    naewon: '내원콜'
  };

  const data = await query<any>(`
    SELECT
      hc.*,
      hp.herbal_name,
      hp.sequence_code,
      hp.remaining_count,
      hp.patient_name,
      hp.patient_chart_number,
      hp.patient_phone
    FROM herbal_calls hc
    JOIN herbal_purchases hp ON hc.purchase_id = hp.id
    WHERE hc.status = 'pending'
      AND hc.scheduled_date <= date('now')
    ORDER BY
      CASE hc.call_type
        WHEN 'chojin' THEN 1
        WHEN 'bokyak' THEN 2
        WHEN 'naewon' THEN 3
      END,
      hc.scheduled_date
  `);

  return data.map(row => ({
    task_type: `call_${row.call_type}` as any,
    task_title: `${row.patient_name} ${callTypeLabels[row.call_type as CallType]}`,
    task_description: `${row.herbal_name || ''} ${row.sequence_code || ''} - 잔여 ${row.remaining_count}회`,
    priority: row.call_type === 'naewon' ? 'high' : 'normal',
    patient: {
      chart_number: row.patient_chart_number,
      name: row.patient_name,
      phone: row.patient_phone
    },
    data: {
      call_id: row.id,
      purchase_id: row.purchase_id,
      call_type: row.call_type,
      scheduled_date: row.scheduled_date
    }
  }));
}

/**
 * SQLite에서 이벤트 혜택 발송 대상 조회
 */
export async function fetchPendingEventBenefits(): Promise<HerbalTask[]> {
  const data = await query<any>(`
    SELECT
      hp.*,
      he.name as event_name,
      he.end_date as event_end_date,
      he.benefit_message
    FROM herbal_purchases hp
    JOIN herbal_events he ON hp.event_id = he.id
    WHERE he.end_date < date('now')
      AND hp.event_benefit_sent = 0
  `);

  return data.map(row => ({
    task_type: 'event_benefit',
    task_title: `${row.patient_name} 이벤트 혜택 안내`,
    task_description: `${row.event_name} 종료 - ${row.herbal_name}`,
    priority: 'normal' as const,
    patient: {
      chart_number: row.patient_chart_number,
      name: row.patient_name,
      phone: row.patient_phone
    },
    data: {
      purchase_id: row.id,
      event_id: row.event_id,
      event_name: row.event_name,
      benefit_message: row.benefit_message
    }
  }));
}

/**
 * SQLite에서 사후관리 대상 조회
 */
export async function fetchFollowupNeeded(): Promise<HerbalTask[]> {
  const data = await query<any>(`
    SELECT
      hp.*,
      julianday('now') - julianday(hp.actual_end_date) as days_since_completion
    FROM herbal_purchases hp
    WHERE hp.status = 'completed'
      AND hp.actual_end_date < date('now', '-90 days')
      AND NOT EXISTS (
        SELECT 1 FROM herbal_purchases hp2
        WHERE hp2.patient_chart_number = hp.patient_chart_number
          AND hp2.created_at > hp.created_at
      )
    ORDER BY hp.actual_end_date
    LIMIT 20
  `);

  return data.map(row => ({
    task_type: 'followup',
    task_title: `${row.patient_name} 사후관리`,
    task_description: `${row.herbal_name || ''} 복용 완료 후 ${Math.floor(row.days_since_completion)}일 경과`,
    priority: 'low' as const,
    patient: {
      chart_number: row.patient_chart_number,
      name: row.patient_name,
      phone: row.patient_phone
    },
    data: {
      purchase_id: row.id,
      actual_end_date: row.actual_end_date,
      days_since_completion: Math.floor(row.days_since_completion)
    }
  }));
}

/**
 * 전체 가상과제 조회
 */
export async function fetchAllHerbalTasks(): Promise<HerbalTasksResponse> {
  const [setup, calls, benefits, followup] = await Promise.all([
    fetchPendingHerbalSetup(),
    fetchPendingCalls(),
    fetchPendingEventBenefits(),
    fetchFollowupNeeded()
  ]);

  return {
    herbal_setup: setup,
    calls,
    event_benefits: benefits,
    followup,
    summary: {
      total: setup.length + calls.length + benefits.length + followup.length,
      setup_count: setup.length,
      calls_count: calls.length,
      benefits_count: benefits.length,
      followup_count: followup.length
    }
  };
}

/**
 * 복약관리 등록
 */
export async function createHerbalPurchase(data: HerbalSetupFormData): Promise<number> {
  // 복용 시작일 계산
  const startDate = data.delivery_method === 'pickup'
    ? data.delivery_date
    : addDays(data.delivery_date, 1);

  // 예상 종료일 계산
  const daysToComplete = Math.ceil(data.total_count / data.dose_per_day);
  const expectedEndDate = addDays(startDate, daysToComplete);

  const sql = `
    INSERT INTO herbal_purchases (
      receipt_pk, customer_pk, okc_tx_date, okc_tx_money,
      patient_chart_number, patient_name, patient_phone,
      herbal_type, herbal_name, sequence_code,
      total_count, remaining_count, dose_per_day,
      delivery_method, delivery_date, start_date, expected_end_date,
      event_id, status, memo
    ) VALUES (
      ${toSqlValue(data.receipt_pk)},
      ${toSqlValue(data.customer_pk)},
      ${escapeString(data.okc_tx_date)},
      ${toSqlValue(data.okc_tx_money)},
      ${escapeString(data.patient_chart_number)},
      ${escapeString(data.patient_name)},
      ${escapeString(data.patient_phone)},
      ${escapeString(data.herbal_type)},
      ${escapeString(data.herbal_name)},
      ${escapeString(data.sequence_code)},
      ${toSqlValue(data.total_count)},
      ${toSqlValue(data.total_count)},
      ${toSqlValue(data.dose_per_day)},
      ${escapeString(data.delivery_method)},
      ${escapeString(data.delivery_date)},
      ${escapeString(startDate)},
      ${escapeString(expectedEndDate)},
      ${data.event_id ? toSqlValue(data.event_id) : 'NULL'},
      'active',
      ${escapeString(data.memo)}
    )
  `;

  await execute(sql);

  // 방금 생성된 ID 조회
  const result = await query<{ id: number }>('SELECT last_insert_rowid() as id');
  const purchaseId = result[0]?.id || 0;

  // 콜 스케줄 생성
  if (purchaseId > 0) {
    await createCallSchedules(purchaseId, data, startDate, expectedEndDate);
  }

  return purchaseId;
}

/**
 * 콜 스케줄 생성
 */
async function createCallSchedules(
  purchaseId: number,
  data: HerbalSetupFormData,
  startDate: string,
  expectedEndDate: string
): Promise<void> {
  const calls: { call_type: CallType; scheduled_date: string }[] = [];

  // 탕약인 경우에만 콜 생성
  if (data.herbal_type === 'tang') {
    // 복약콜: 시작일 + 2일
    calls.push({
      call_type: 'bokyak',
      scheduled_date: addDays(startDate, 2)
    });

    // 내원콜: 종료 예정일 - 3일 (5~6회분 남은 시점)
    const naewonDate = addDays(expectedEndDate, -3);
    if (naewonDate > startDate) {
      calls.push({
        call_type: 'naewon',
        scheduled_date: naewonDate
      });
    }
  }

  // 콜 INSERT
  for (const call of calls) {
    await execute(`
      INSERT INTO herbal_calls (purchase_id, call_type, scheduled_date, status)
      VALUES (${purchaseId}, ${escapeString(call.call_type)}, ${escapeString(call.scheduled_date)}, 'pending')
    `);
  }
}

/**
 * 콜 완료 처리
 */
export async function completeCall(
  callId: number,
  completedBy: string,
  contactMethod: string,
  result: string
): Promise<void> {
  await execute(`
    UPDATE herbal_calls
    SET status = 'completed',
        completed_at = datetime('now'),
        completed_by = ${escapeString(completedBy)},
        contact_method = ${escapeString(contactMethod)},
        result = ${escapeString(result)},
        updated_at = datetime('now')
    WHERE id = ${callId}
  `);
}

/**
 * 콜 건너뛰기
 */
export async function skipCall(callId: number, reason: string): Promise<void> {
  await execute(`
    UPDATE herbal_calls
    SET status = 'skipped',
        reschedule_reason = ${escapeString(reason)},
        updated_at = datetime('now')
    WHERE id = ${callId}
  `);
}

/**
 * 이벤트 목록 조회
 */
export async function fetchEvents(): Promise<HerbalEvent[]> {
  return query<HerbalEvent>(`
    SELECT * FROM herbal_events
    WHERE status = 'active'
    ORDER BY end_date DESC
  `);
}

/**
 * 이벤트 혜택 발송 완료 처리
 */
export async function markEventBenefitSent(purchaseId: number): Promise<void> {
  await execute(`
    UPDATE herbal_purchases
    SET event_benefit_sent = 1,
        event_benefit_sent_at = datetime('now'),
        updated_at = datetime('now')
    WHERE id = ${purchaseId}
  `);
}

/**
 * 복약관리 상세 조회
 */
export async function fetchHerbalPurchase(id: number): Promise<HerbalPurchase | null> {
  const results = await query<HerbalPurchase>(`
    SELECT * FROM herbal_purchases WHERE id = ${id}
  `);
  return results[0] || null;
}

/**
 * 환자별 복약관리 이력 조회
 */
export async function fetchPatientHerbalHistory(chartNumber: string): Promise<HerbalPurchase[]> {
  return query<HerbalPurchase>(`
    SELECT * FROM herbal_purchases
    WHERE patient_chart_number = ${escapeString(chartNumber)}
    ORDER BY created_at DESC
  `);
}

// 유틸리티 함수
function addDays(dateStr: string, days: number): string {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}
