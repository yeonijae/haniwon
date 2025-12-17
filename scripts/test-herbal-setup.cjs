/**
 * 한약 복약관리 - 고액 비급여 결제 감지 (가상과제용)
 *
 * 조건: 비급여(InsuYes=0) + 약(IsDrug=1) + 30만원 이상
 * → "복약관리 설정 필요" 가상과제로 표시
 */

const sql = require('mssql');

const config = {
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

// 한약 결제 판단 기준 금액
const HERBAL_MIN_AMOUNT = 300000;

/**
 * 고액 비급여 결제 조회 (복약관리 설정 필요 건)
 * @param {number} days - 조회 기간 (일)
 * @param {number[]} excludeReceiptPks - 이미 처리된 Receipt_PK 목록
 */
async function getPendingHerbalSetup(days = 7, excludeReceiptPks = []) {
  const pool = await sql.connect(config);

  // 고액 비급여 결제 조회
  let query = `
    SELECT
      r.Receipt_PK,
      c.Customer_PK,
      c.sn as chart_number,
      c.name as patient_name,
      c.cell as phone,
      CONVERT(varchar, r.TxDate, 23) as tx_date,
      r.General_Money as total_amount,
      d.TxDoctor
    FROM Receipt r
    JOIN Customer c ON r.Customer_PK = c.Customer_PK
    LEFT JOIN Detail d ON r.Customer_PK = d.Customer_PK
      AND CAST(r.TxDate AS DATE) = CAST(d.TxDate AS DATE)
      AND d.IsDrug = 1 AND d.InsuYes = 0
    WHERE r.General_Money >= ${HERBAL_MIN_AMOUNT}
      AND r.TxDate >= DATEADD(DAY, -${days}, GETDATE())
      ${excludeReceiptPks.length > 0 ? `AND r.Receipt_PK NOT IN (${excludeReceiptPks.join(',')})` : ''}
    GROUP BY r.Receipt_PK, c.Customer_PK, c.sn, c.name, c.cell, r.TxDate, r.General_Money, d.TxDoctor
    ORDER BY r.TxDate DESC
  `;

  const result = await pool.request().query(query);
  await pool.close();

  return result.recordset.map(row => ({
    task_type: 'herbal_setup',
    task_title: `${row.patient_name} 복약관리 설정`,
    priority: 'high',
    patient: {
      customer_pk: row.Customer_PK,
      chart_number: row.chart_number,
      name: row.patient_name,
      phone: row.phone
    },
    payment: {
      receipt_pk: row.Receipt_PK,
      tx_date: row.tx_date,
      total_amount: row.total_amount,
      tx_doctor: row.TxDoctor
    }
  }));
}

async function run() {
  console.log('=== 복약관리 설정 필요 (가상과제) ===');
  console.log(`조건: 최근 7일 내 비급여 ${HERBAL_MIN_AMOUNT.toLocaleString()}원 이상 결제\n`);

  const tasks = await getPendingHerbalSetup(7, []);

  console.log(`📋 총 ${tasks.length}건\n`);
  console.log('─'.repeat(60));

  tasks.forEach((task, i) => {
    console.log(`${i + 1}. [${task.patient.chart_number}] ${task.patient.name}`);
    console.log(`   결제일: ${task.payment.tx_date}`);
    console.log(`   금액: ${task.payment.total_amount?.toLocaleString()}원`);
    console.log(`   담당: ${task.payment.tx_doctor || '-'}`);
    console.log(`   연락처: ${task.patient.phone || '-'}`);
    console.log();
  });

  // 금액대별 분포
  console.log('─'.repeat(60));
  console.log('\n=== 금액대별 분포 ===');
  const ranges = [
    { min: 300000, max: 500000, label: '30~50만원' },
    { min: 500000, max: 1000000, label: '50~100만원' },
    { min: 1000000, max: 1500000, label: '100~150만원' },
    { min: 1500000, max: Infinity, label: '150만원 이상' }
  ];

  ranges.forEach(range => {
    const count = tasks.filter(t =>
      t.payment.total_amount >= range.min && t.payment.total_amount < range.max
    ).length;
    if (count > 0) {
      console.log(`  ${range.label}: ${count}건`);
    }
  });
}

run().catch(console.error);

module.exports = { getPendingHerbalSetup, HERBAL_MIN_AMOUNT };
