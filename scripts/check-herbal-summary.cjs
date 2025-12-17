const sql = require('mssql');
const config = {
  server: '192.168.0.173',
  port: 55555,
  user: 'members',
  password: 'msp1234',
  database: 'MasterDB',
  options: { encrypt: false, trustServerCertificate: true }
};

async function run() {
  await sql.connect(config);

  // Receipt의 SUMMARYTREAT 확인 (고액 결제 건)
  console.log('=== 고액 결제 건의 SUMMARYTREAT 확인 ===\n');
  const result = await sql.query`
    SELECT TOP 20
      c.sn as chart_number,
      c.name as patient_name,
      CONVERT(varchar, r.TxDate, 23) as tx_date,
      r.General_Money,
      r.SUMMARYTREAT
    FROM Receipt r
    JOIN Customer c ON r.Customer_PK = c.Customer_PK
    WHERE r.TxDate >= DATEADD(DAY, -14, GETDATE())
      AND r.General_Money >= 300000
    ORDER BY r.TxDate DESC
  `;

  result.recordset.forEach((row, i) => {
    console.log(`${i+1}. [${row.chart_number}] ${row.patient_name}`);
    console.log(`   ${row.tx_date} | ${row.General_Money?.toLocaleString()}원`);
    console.log(`   SUMMARYTREAT: ${row.SUMMARYTREAT || '(없음)'}`);
    console.log();
  });

  // 공진단, 경옥고 키워드 검색
  console.log('\n=== 공진단/경옥고 키워드 검색 (SUMMARYTREAT) ===\n');
  const special = await sql.query`
    SELECT TOP 10
      c.sn as chart_number,
      c.name as patient_name,
      CONVERT(varchar, r.TxDate, 23) as tx_date,
      r.General_Money,
      r.SUMMARYTREAT
    FROM Receipt r
    JOIN Customer c ON r.Customer_PK = c.Customer_PK
    WHERE r.SUMMARYTREAT LIKE '%공진단%' OR r.SUMMARYTREAT LIKE '%경옥고%'
    ORDER BY r.TxDate DESC
  `;

  if (special.recordset.length === 0) {
    console.log('(공진단/경옥고 키워드가 포함된 SUMMARYTREAT 없음)');
  } else {
    special.recordset.forEach((row, i) => {
      console.log(`${i+1}. [${row.chart_number}] ${row.patient_name}`);
      console.log(`   ${row.tx_date} | ${row.General_Money?.toLocaleString()}원`);
      console.log(`   SUMMARYTREAT: ${row.SUMMARYTREAT}`);
      console.log();
    });
  }

  // 차수 키워드 검색
  console.log('\n=== 차수 키워드 검색 (SUMMARYTREAT에서 "차" 포함) ===\n');
  const withCha = await sql.query`
    SELECT TOP 15
      c.sn as chart_number,
      c.name as patient_name,
      CONVERT(varchar, r.TxDate, 23) as tx_date,
      r.General_Money,
      r.SUMMARYTREAT
    FROM Receipt r
    JOIN Customer c ON r.Customer_PK = c.Customer_PK
    WHERE r.SUMMARYTREAT LIKE '%차%'
      AND r.General_Money >= 100000
    ORDER BY r.TxDate DESC
  `;

  if (withCha.recordset.length === 0) {
    console.log('(차수 키워드 없음)');
  } else {
    withCha.recordset.forEach((row, i) => {
      console.log(`${i+1}. [${row.chart_number}] ${row.patient_name}`);
      console.log(`   ${row.tx_date} | ${row.General_Money?.toLocaleString()}원`);
      console.log(`   SUMMARYTREAT: ${row.SUMMARYTREAT}`);
      console.log();
    });
  }

  await sql.close();
}

run().catch(console.error);
