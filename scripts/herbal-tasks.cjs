/**
 * 한약 복약관리 - 오늘의 가상과제 조회
 *
 * 과제 유형:
 * 1. herbal_setup    - 신규 복약관리 설정 필요 (MSSQL에서 조회)
 * 2. call_chojin     - 초진콜 예정
 * 3. call_bokyak     - 복약콜 예정
 * 4. call_naewon     - 내원콜 예정
 * 5. event_benefit   - 이벤트 혜택 문자 발송
 * 6. followup        - 사후관리 대상
 */

const sql = require('mssql');

// MSSQL 설정 (오케이차트)
const mssqlConfig = {
  server: '192.168.0.173',
  port: 55555,
  user: 'members',
  password: 'msp1234',
  database: 'MasterDB',
  options: {
    encrypt: false,
    trustServerCertificate: true
  }
};

// PostgreSQL API 설정
const POSTGRES_API_URL = 'http://192.168.0.173:3200';

// 한약 결제 판단 기준 금액
const HERBAL_MIN_AMOUNT = 200000;

/**
 * PostgreSQL API 쿼리 실행
 */
async function postgresQuery(sqlQuery) {
  const res = await fetch(`${POSTGRES_API_URL}/api/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql: sqlQuery })
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  if (!data.columns || !data.rows) return [];
  return data.rows.map(row =>
    Object.fromEntries(data.columns.map((col, i) => [col, row[i]]))
  );
}

/**
 * 1. 신규 복약관리 설정 필요 건 조회 (MSSQL)
 * - 최근 N일 내 고액 비급여 결제 (30만원 이상)
 * - 아직 herbal_purchases에 등록 안 된 건
 */
async function getPendingHerbalSetup(days = 7) {
  const pool = await sql.connect(mssqlConfig);

  // SQLite에서 이미 처리된 receipt_pk 목록 조회
  let processedPks = [];
  try {
    const processed = await postgresQuery(
      `SELECT receipt_pk FROM herbal_purchases WHERE receipt_pk IS NOT NULL`
    );
    processedPks = processed.map(p => p.receipt_pk);
  } catch (e) {
    console.log('SQLite 조회 실패, 전체 조회:', e.message);
  }

  // MSSQL에서 고액 비급여 결제 조회 (30만원 이상)
  const query = `
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
      ${processedPks.length > 0 ? `AND r.Receipt_PK NOT IN (${processedPks.join(',')})` : ''}
    ORDER BY r.TxDate DESC
  `;
  const result = await pool.request().query(query);

  await pool.close();

  return result.recordset.map(row => ({
    task_type: 'herbal_setup',
    task_title: `${row.patient_name} 복약관리 설정`,
    task_description: `${row.tx_date} 결제 ${row.total_amount?.toLocaleString()}원`,
    priority: 'high',
    patient: {
      customer_pk: row.Customer_PK,
      chart_number: row.chart_number,
      name: row.patient_name,
      phone: row.phone
    },
    data: {
      receipt_pk: row.Receipt_PK,
      customer_pk: row.Customer_PK,
      tx_date: row.tx_date,
      total_amount: row.total_amount,
      tx_doctor: row.tx_doctor
    }
  }));
}

/**
 * TxItem 파싱 - 한약 종류 및 수량 추출
 */
function parseHerbalItem(txItem, txMoney) {
  const item = (txItem || '').trim();

  // 공진단
  if (item.includes('공진단')) {
    const countMatch = item.match(/(\d+)\s*환/);
    return {
      herbal_type: 'hwan',
      herbal_name: '공진단',
      total_count: countMatch ? parseInt(countMatch[1]) : 1,
      dose_per_day: null
    };
  }

  // 경옥고
  if (item.includes('경옥고')) {
    const countMatch = item.match(/(\d+)\s*(단지|통)/);
    return {
      herbal_type: 'go',
      herbal_name: '경옥고',
      total_count: countMatch ? parseInt(countMatch[1]) : 1,
      dose_per_day: null
    };
  }

  // 탕약 (차수 추출)
  const seqMatch = item.match(/(\d+)\s*차/);
  return {
    herbal_type: 'tang',
    herbal_name: item,
    sequence_code: seqMatch ? `${seqMatch[1]}차` : null,
    total_count: 30,  // 기본 복용 횟수
    dose_per_day: 3   // 기본 하루 3회
  };
}

/**
 * 2. 콜 예정 건 조회 (SQLite)
 */
async function getPendingCalls() {
  const callTypeLabels = {
    chojin: '초진콜',
    bokyak: '복약콜',
    naewon: '내원콜'
  };

  try {
    const data = await postgresQuery(`
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
      task_type: `call_${row.call_type}`,
      task_title: `${row.patient_name} ${callTypeLabels[row.call_type]}`,
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
  } catch (e) {
    console.error('콜 조회 오류:', e.message);
    return [];
  }
}

/**
 * 3. 이벤트 혜택 발송 대상 조회 (SQLite)
 */
async function getPendingEventBenefits() {
  try {
    const data = await postgresQuery(`
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
      priority: 'normal',
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
  } catch (e) {
    console.error('이벤트 혜택 조회 오류:', e.message);
    return [];
  }
}

/**
 * 4. 사후관리 대상 조회 (SQLite)
 */
async function getFollowupNeeded() {
  try {
    const data = await postgresQuery(`
      SELECT
        hp.*,
        julianday('now') - julianday(hp.actual_end_date) as days_since_completion
      FROM herbal_purchases hp
      WHERE hp.status = 'completed'
        AND hp.actual_end_date < date('now', '-90 days')
        AND NOT EXISTS (
          SELECT 1 FROM herbal_purchases hp2
          WHERE hp2.patient_id = hp.patient_id
            AND hp2.created_at > hp.created_at
        )
      ORDER BY hp.actual_end_date
      LIMIT 20
    `);

    return data.map(row => ({
      task_type: 'followup',
      task_title: `${row.patient_name} 사후관리`,
      task_description: `${row.herbal_name || ''} 복용 완료 후 ${Math.floor(row.days_since_completion)}일 경과`,
      priority: 'low',
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
  } catch (e) {
    console.error('사후관리 조회 오류:', e.message);
    return [];
  }
}

/**
 * 전체 가상과제 조회
 */
async function getAllHerbalTasks() {
  try {
    const [setup, calls, benefits, followup] = await Promise.all([
      getPendingHerbalSetup(),
      getPendingCalls(),
      getPendingEventBenefits(),
      getFollowupNeeded()
    ]);

    return {
      herbal_setup: setup,
      calls: calls,
      event_benefits: benefits,
      followup: followup,
      summary: {
        total: setup.length + calls.length + benefits.length + followup.length,
        setup_count: setup.length,
        calls_count: calls.length,
        benefits_count: benefits.length,
        followup_count: followup.length
      }
    };
  } catch (error) {
    console.error('가상과제 조회 오류:', error);
    throw error;
  }
}

// 테스트 실행
async function test() {
  console.log('=== 한약 복약관리 가상과제 조회 ===\n');

  try {
    const tasks = await getAllHerbalTasks();

    console.log(`📊 요약: 총 ${tasks.summary.total}건`);
    console.log(`   - 신규 설정: ${tasks.summary.setup_count}건`);
    console.log(`   - 콜 예정: ${tasks.summary.calls_count}건`);
    console.log(`   - 이벤트 혜택: ${tasks.summary.benefits_count}건`);
    console.log(`   - 사후관리: ${tasks.summary.followup_count}건`);
    console.log();

    if (tasks.herbal_setup.length > 0) {
      console.log('─'.repeat(60));
      console.log('🆕 신규 복약관리 설정 필요');
      console.log('─'.repeat(60));
      tasks.herbal_setup.forEach((task, i) => {
        console.log(`${i + 1}. [${task.patient.chart_number}] ${task.patient.name}`);
        console.log(`   ${task.task_description}`);
        console.log(`   담당: ${task.data.tx_doctor || '-'} | 연락처: ${task.patient.phone || '-'}`);
        console.log();
      });
    }

    if (tasks.calls.length > 0) {
      console.log('─'.repeat(60));
      console.log('📞 콜 예정');
      console.log('─'.repeat(60));
      tasks.calls.forEach((task, i) => {
        console.log(`${i + 1}. ${task.task_title}`);
        console.log(`   ${task.task_description}`);
        console.log();
      });
    }

    if (tasks.event_benefits.length > 0) {
      console.log('─'.repeat(60));
      console.log('🎁 이벤트 혜택 안내');
      console.log('─'.repeat(60));
      tasks.event_benefits.forEach((task, i) => {
        console.log(`${i + 1}. ${task.task_title}`);
        console.log(`   ${task.task_description}`);
        console.log();
      });
    }

    if (tasks.followup.length > 0) {
      console.log('─'.repeat(60));
      console.log('📋 사후관리 대상');
      console.log('─'.repeat(60));
      tasks.followup.forEach((task, i) => {
        console.log(`${i + 1}. ${task.task_title}`);
        console.log(`   ${task.task_description}`);
        console.log();
      });
    }

  } catch (error) {
    console.error('테스트 오류:', error.message);
  }

  process.exit(0);
}

// 직접 실행 시 테스트
if (require.main === module) {
  test();
}

module.exports = {
  getPendingHerbalSetup,
  getPendingCalls,
  getPendingEventBenefits,
  getFollowupNeeded,
  getAllHerbalTasks,
  parseHerbalItem
};
