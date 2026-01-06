/**
 * 한약 복약관리 API
 * - MSSQL (오케이차트): 고액 비급여 결제 조회
 * - PostgreSQL: 복약관리 데이터 저장/조회
 */

import { query, execute, escapeString, toSqlValue, getCurrentDate } from '@shared/lib/postgres';
import type {
  HerbalTask,
  HerbalTasksResponse,
  HerbalSetupFormData,
  HerbalPurchase,
  HerbalCall,
  HerbalEvent,
  CallType,
  FirstVisitMessage,
  FirstVisitTemplateType
} from '../types';

// MSSQL API URL (unified-server)
const MSSQL_API_URL = import.meta.env.VITE_MSSQL_API_URL || 'http://192.168.0.173:3100';

// 한약 결제 판단 기준 금액
const HERBAL_MIN_AMOUNT = 200000;

/**
 * MSSQL에서 오늘 초진 환자 조회
 */
export async function fetchFirstVisitTargets(date?: string): Promise<HerbalTask[]> {
  try {
    const targetDate = date || getCurrentDate();

    // 이미 메시지 발송한 환자 조회
    const sent = await query<{ customer_pk: number; treatment_date: string }>(
      `SELECT customer_pk, treatment_date FROM first_visit_messages
       WHERE treatment_date = ${escapeString(targetDate)} AND message_sent = 1`
    );
    const sentKeys = new Set(sent.map(s => `${s.customer_pk}_${s.treatment_date}`));

    // MSSQL에서 해당 날짜 초진 환자 조회
    const sqlQuery = `
      SELECT DISTINCT
        c.Customer_PK,
        c.sn as chart_number,
        c.name as patient_name,
        c.cell as phone,
        CONVERT(varchar, d.TxDate, 23) as treatment_date,
        d.TxDoctor as doctor_name
      FROM Detail d
      JOIN Customer c ON d.Customer_PK = c.Customer_PK
      WHERE CONVERT(varchar, d.TxDate, 23) = '${targetDate}'
        AND NOT EXISTS (
          SELECT 1 FROM Detail d2
          WHERE d2.Customer_PK = d.Customer_PK
            AND d2.TxDate < d.TxDate
        )
      ORDER BY c.name
    `;

    const response = await fetch(`${MSSQL_API_URL}/api/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql: sqlQuery })
    });

    if (!response.ok) throw new Error('MSSQL 조회 실패');

    const data = await response.json();
    if (data.error) throw new Error(data.error);

    const columns: string[] = data.columns || [];
    const rows: any[][] = data.rows || [];

    return rows
      .map(row => {
        const rowObj: Record<string, any> = {};
        columns.forEach((col, idx) => {
          rowObj[col] = row[idx];
        });
        return rowObj;
      })
      .filter(row => !sentKeys.has(`${row.Customer_PK}_${row.treatment_date}`))
      .map(row => ({
        task_type: 'first_visit' as const,
        task_title: `${row.patient_name} 초진 감사 메시지`,
        task_description: `${row.treatment_date} 초진 - ${row.doctor_name || ''}`,
        priority: 'normal' as const,
        patient: {
          customer_pk: row.Customer_PK,
          chart_number: row.chart_number,
          name: row.patient_name,
          phone: row.phone
        },
        data: {
          customer_pk: row.Customer_PK,
          treatment_date: row.treatment_date,
          doctor_name: row.doctor_name
        }
      }));
  } catch (error) {
    console.error('초진 환자 조회 실패:', error);
    return [];
  }
}

/**
 * 초진 메시지 발송 완료 처리
 */
export async function markFirstVisitMessageSent(
  customerPk: number,
  chartNumber: string,
  patientName: string,
  patientPhone: string | undefined,
  treatmentDate: string,
  doctorName: string | undefined,
  templateType: FirstVisitTemplateType,
  sentBy: string,
  notes?: string
): Promise<void> {
  await execute(`
    INSERT INTO first_visit_messages (
      customer_pk, chart_number, patient_name, patient_phone,
      treatment_date, doctor_name, template_type,
      message_sent, sent_at, sent_by, notes, created_at
    ) VALUES (
      ${customerPk},
      ${escapeString(chartNumber)},
      ${escapeString(patientName)},
      ${escapeString(patientPhone)},
      ${escapeString(treatmentDate)},
      ${escapeString(doctorName)},
      ${escapeString(templateType)},
      1,
      NOW(),
      ${escapeString(sentBy)},
      ${escapeString(notes)},
      NOW()
    )
    ON CONFLICT(customer_pk, treatment_date) DO UPDATE SET
      message_sent = 1,
      sent_at = NOW(),
      sent_by = ${escapeString(sentBy)},
      template_type = ${escapeString(templateType)},
      notes = ${escapeString(notes)}
  `);
}

/**
 * 초진 메시지 발송 이력 조회
 */
export async function fetchFirstVisitMessageHistory(date?: string): Promise<FirstVisitMessage[]> {
  const whereClause = date ? `WHERE treatment_date = ${escapeString(date)}` : '';
  return query<FirstVisitMessage>(`
    SELECT * FROM first_visit_messages
    ${whereClause}
    ORDER BY treatment_date DESC, created_at DESC
    LIMIT 100
  `);
}

/**
 * MSSQL에서 고액 비급여 결제 조회 (복약관리 설정 필요 건)
 * - 결제 상세 내역 포함 (한약명, 녹용 여부)
 * @param days 조회 기간 (일수)
 * @param targetDate 기준 날짜 (YYYY-MM-DD)
 */
export async function fetchPendingHerbalSetup(days: number = 7, targetDate?: string): Promise<HerbalTask[]> {
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

    // 날짜 조건: targetDate가 있으면 해당 날짜 기준, 없으면 오늘 기준
    const dateCondition = targetDate
      ? `AND CONVERT(varchar, r.TxDate, 23) >= '${targetDate}' AND CONVERT(varchar, r.TxDate, 23) <= DATEADD(DAY, ${days}, '${targetDate}')`
      : `AND r.TxDate >= DATEADD(DAY, -${days}, GETDATE())`;

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
        ${dateCondition}
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

    const receipts = rows.map(row => {
      const rowObj: Record<string, any> = {};
      columns.forEach((col, idx) => {
        rowObj[col] = row[idx];
      });
      return rowObj;
    });

    // 결제 상세 내역 조회 (비급여 항목)
    const detailDateCondition = targetDate
      ? `AND CONVERT(varchar, d.TxDate, 23) >= '${targetDate}' AND CONVERT(varchar, d.TxDate, 23) <= DATEADD(DAY, ${days}, '${targetDate}')`
      : `AND d.TxDate >= DATEADD(DAY, -${days}, GETDATE())`;

    const detailQuery = `
      SELECT
        d.Customer_PK,
        CONVERT(varchar, d.TxDate, 23) as tx_date,
        d.PxName as px_name,
        d.TxMoney as tx_money
      FROM Detail d
      WHERE d.InsuYes = 0
        AND d.TxMoney > 0
        ${detailDateCondition}
      ORDER BY d.TxDate DESC, d.TxMoney DESC
    `;

    const detailResponse = await fetch(`${MSSQL_API_URL}/api/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql: detailQuery })
    });

    let detailMap: Map<string, { px_name: string; tx_money: number; is_deer_antler: boolean }[]> = new Map();

    if (detailResponse.ok) {
      const detailData = await detailResponse.json();
      if (!detailData.error && detailData.rows) {
        const detailCols: string[] = detailData.columns || [];
        detailData.rows.forEach((row: any[]) => {
          const detailObj: Record<string, any> = {};
          detailCols.forEach((col, idx) => {
            detailObj[col] = row[idx];
          });

          const key = `${detailObj.Customer_PK}_${detailObj.tx_date}`;
          const pxName = detailObj.px_name || '';
          const isDeerAntler = pxName.includes('녹용');

          if (!detailMap.has(key)) {
            detailMap.set(key, []);
          }
          detailMap.get(key)!.push({
            px_name: pxName,
            tx_money: Math.floor(detailObj.tx_money || 0),
            is_deer_antler: isDeerAntler
          });
        });
      }
    }

    return receipts.map(rowObj => {
      const key = `${rowObj.Customer_PK}_${rowObj.tx_date}`;
      const paymentDetails = detailMap.get(key) || [];
      const hasDeerAntler = paymentDetails.some(d => d.is_deer_antler);

      // 결제 상세 내역 요약 문자열 생성
      const detailSummary = paymentDetails
        .map(d => `${d.px_name} ${Math.floor(d.tx_money).toLocaleString()}원`)
        .join(', ');

      // 결제일 + 상세 내역
      const description = detailSummary
        ? `${rowObj.tx_date} | ${detailSummary}`
        : `${rowObj.tx_date} 결제 ${Math.floor(rowObj.total_amount || 0).toLocaleString()}원`;

      return {
        task_type: 'herbal_setup' as const,
        task_title: `${rowObj.patient_name} 복약관리 설정`,
        task_description: description,
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
          tx_doctor: rowObj.tx_doctor,
          payment_details: paymentDetails,
          has_deer_antler: hasDeerAntler
        }
      };
    });
  } catch (error) {
    console.error('복약관리 설정 대상 조회 실패:', error);
    return [];
  }
}

/**
 * PostgreSQL에서 콜 예정 조회
 * @param targetDate 기준 날짜 (YYYY-MM-DD)
 */
export async function fetchPendingCalls(targetDate?: string): Promise<HerbalTask[]> {
  const callTypeLabels: Record<CallType, string> = {
    chojin: '초진콜',
    bokyak: '복약콜',
    naewon: '내원콜'
  };

  const date = targetDate ? `'${targetDate}'` : `CURRENT_DATE`;

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
      AND hc.scheduled_date <= ${date}
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
 * PostgreSQL에서 이벤트 혜택 발송 대상 조회
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
    WHERE he.end_date < CURRENT_DATE
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
 * PostgreSQL에서 사후관리 대상 조회
 */
export async function fetchFollowupNeeded(): Promise<HerbalTask[]> {
  const data = await query<any>(`
    SELECT
      hp.*,
      EXTRACT(DAY FROM NOW() - hp.actual_end_date::timestamp) as days_since_completion
    FROM herbal_purchases hp
    WHERE hp.status = 'completed'
      AND hp.actual_end_date < CURRENT_DATE - INTERVAL '90 days'
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
 * @param targetDate 기준 날짜 (YYYY-MM-DD), 기본값은 오늘
 */
export async function fetchAllHerbalTasks(targetDate?: string): Promise<HerbalTasksResponse> {
  const date = targetDate || getCurrentDate();

  const [firstVisits, setup, activePurchases, calls, benefits, followup] = await Promise.all([
    fetchFirstVisitTargets(date),
    fetchPendingHerbalSetup(7, date),
    fetchActiveHerbalPurchases(),
    fetchPendingCalls(date),
    fetchPendingEventBenefits(),
    fetchFollowupNeeded()
  ]);

  return {
    first_visits: firstVisits,
    herbal_setup: setup,
    active_purchases: activePurchases,
    calls,
    event_benefits: benefits,
    followup,
    summary: {
      total: firstVisits.length + setup.length + calls.length + benefits.length + followup.length,
      first_visit_count: firstVisits.length,
      setup_count: setup.length,
      active_count: activePurchases.length,
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
        completed_at = NOW(),
        completed_by = ${escapeString(completedBy)},
        contact_method = ${escapeString(contactMethod)},
        result = ${escapeString(result)},
        updated_at = NOW()
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
        updated_at = NOW()
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
        event_benefit_sent_at = NOW(),
        updated_at = NOW()
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
 * 진행 중인 복약관리 목록 조회
 */
export async function fetchActiveHerbalPurchases(): Promise<HerbalPurchase[]> {
  return query<HerbalPurchase>(`
    SELECT * FROM herbal_purchases
    WHERE status = 'active'
    ORDER BY start_date DESC
  `);
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
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
