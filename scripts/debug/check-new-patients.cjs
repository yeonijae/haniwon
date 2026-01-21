const sql = require('mssql');

const config = {
  server: '192.168.0.173',
  port: 55555,
  user: 'members',
  password: 'msp1234',
  database: 'MasterDB',
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
};

async function main() {
  try {
    await sql.connect(config);
    console.log('MasterDB 연결 성공\n');

    // 1. 일간: 2025-12-10 신규 등록 환자
    console.log('=== 일간: 2025-12-10 신규 등록 환자 ===');
    const daily = await sql.query`
      SELECT COUNT(*) as cnt
      FROM Customer
      WHERE CAST(reg_date AS DATE) = '2025-12-10'
    `;
    console.log(`2025-12-10 신규환자: ${daily.recordset[0].cnt}명`);

    // 상세 목록
    const dailyList = await sql.query`
      SELECT sn, name, reg_date
      FROM Customer
      WHERE CAST(reg_date AS DATE) = '2025-12-10'
      ORDER BY reg_date
    `;
    dailyList.recordset.forEach(r =>
      console.log(`  ${r.sn} ${r.name}`)
    );

    // 2. 주간: 2025-12-09 ~ 2025-12-15 (이번 주)
    console.log('\n=== 주간: 2025-12-09 ~ 2025-12-11 신규 등록 환자 ===');
    const weekly = await sql.query`
      SELECT CAST(reg_date AS DATE) as reg_day, COUNT(*) as cnt
      FROM Customer
      WHERE CAST(reg_date AS DATE) >= '2025-12-09'
        AND CAST(reg_date AS DATE) <= '2025-12-11'
      GROUP BY CAST(reg_date AS DATE)
      ORDER BY reg_day
    `;
    let weeklyTotal = 0;
    weekly.recordset.forEach(r => {
      console.log(`  ${r.reg_day.toISOString().split('T')[0]}: ${r.cnt}명`);
      weeklyTotal += r.cnt;
    });
    console.log(`  주간 합계: ${weeklyTotal}명`);

    // 3. 월간: 2025-12월
    console.log('\n=== 월간: 2025년 12월 신규 등록 환자 ===');
    const monthly = await sql.query`
      SELECT CAST(reg_date AS DATE) as reg_day, COUNT(*) as cnt
      FROM Customer
      WHERE reg_date >= '2025-12-01'
        AND reg_date < '2026-01-01'
      GROUP BY CAST(reg_date AS DATE)
      ORDER BY reg_day
    `;
    let monthlyTotal = 0;
    monthly.recordset.forEach(r => {
      console.log(`  ${r.reg_day.toISOString().split('T')[0]}: ${r.cnt}명`);
      monthlyTotal += r.cnt;
    });
    console.log(`  12월 합계: ${monthlyTotal}명`);

    // 4. 최근 3개월 트렌드
    console.log('\n=== 최근 3개월 신규 등록 환자 ===');
    const trend = await sql.query`
      SELECT
        YEAR(reg_date) as year,
        MONTH(reg_date) as month,
        COUNT(*) as cnt
      FROM Customer
      WHERE reg_date >= '2025-10-01'
      GROUP BY YEAR(reg_date), MONTH(reg_date)
      ORDER BY year, month
    `;
    trend.recordset.forEach(r =>
      console.log(`  ${r.year}-${String(r.month).padStart(2, '0')}: ${r.cnt}명`)
    );

    await sql.close();
    console.log('\n완료');
  } catch (err) {
    console.error('오류:', err.message);
  }
}

main();
