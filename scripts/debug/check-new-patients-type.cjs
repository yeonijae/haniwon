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

    const targetDate = '2025-12-10';

    // 신규 등록 환자 분류 (일간)
    console.log(`=== ${targetDate} 신규 등록 환자 분류 ===\n`);

    const newPatients = await sql.query`
      SELECT
        c.Customer_PK,
        c.sn,
        c.name,
        r.CheongGu_Money,
        r.General_Money,
        r.Bonin_Money,
        -- 자보 여부 확인
        (SELECT COUNT(*) FROM Detail d
         WHERE d.Customer_PK = c.Customer_PK
         AND CAST(d.TxDate AS DATE) = CAST(c.reg_date AS DATE)
         AND d.TxItem LIKE '%자동차보험%') as jabo_count
      FROM Customer c
      LEFT JOIN Receipt r ON c.Customer_PK = r.Customer_PK
        AND CAST(r.TxDate AS DATE) = CAST(c.reg_date AS DATE)
      WHERE CAST(c.reg_date AS DATE) = ${targetDate}
    `;

    let chimChoJin = 0;
    let jaboChoJin = 0;
    let yakChoJin = 0;
    let etcChoJin = 0;

    console.log('상세 내역:');
    newPatients.recordset.forEach(r => {
      const cheonggu = r.CheongGu_Money || 0;
      const general = r.General_Money || 0;
      const isJabo = r.jabo_count > 0;

      let type = '';
      if (isJabo) {
        type = '자보초진';
        jaboChoJin++;
      } else if (cheonggu > 0) {
        type = '침초진';
        chimChoJin++;
      } else if (general > 0) {
        type = '약초진';
        yakChoJin++;
      } else {
        type = '기타';
        etcChoJin++;
      }

      console.log(`  ${r.sn} ${r.name}: 청구=${cheonggu}, 비급여=${general}, 자보=${isJabo} → ${type}`);
    });

    console.log('\n--- 일간 요약 ---');
    console.log(`침초진: ${chimChoJin}명`);
    console.log(`자보초진: ${jaboChoJin}명`);
    console.log(`약초진: ${yakChoJin}명`);
    console.log(`기타: ${etcChoJin}명`);
    console.log(`합계: ${chimChoJin + jaboChoJin + yakChoJin + etcChoJin}명`);

    // 월간 통계
    console.log('\n=== 2025년 12월 신규 등록 환자 분류 (월간) ===\n');

    const monthlyStats = await sql.query`
      SELECT
        c.Customer_PK,
        c.reg_date,
        ISNULL(r.CheongGu_Money, 0) as CheongGu_Money,
        ISNULL(r.General_Money, 0) as General_Money,
        (SELECT COUNT(*) FROM Detail d
         WHERE d.Customer_PK = c.Customer_PK
         AND CAST(d.TxDate AS DATE) = CAST(c.reg_date AS DATE)
         AND d.TxItem LIKE '%자동차보험%') as jabo_count
      FROM Customer c
      LEFT JOIN Receipt r ON c.Customer_PK = r.Customer_PK
        AND CAST(r.TxDate AS DATE) = CAST(c.reg_date AS DATE)
      WHERE c.reg_date >= '2025-12-01' AND c.reg_date < '2026-01-01'
    `;

    let monthlyChim = 0, monthlyJabo = 0, monthlyYak = 0, monthlyEtc = 0;

    monthlyStats.recordset.forEach(r => {
      const isJabo = r.jabo_count > 0;
      if (isJabo) {
        monthlyJabo++;
      } else if (r.CheongGu_Money > 0) {
        monthlyChim++;
      } else if (r.General_Money > 0) {
        monthlyYak++;
      } else {
        monthlyEtc++;
      }
    });

    console.log('--- 월간 요약 (12월) ---');
    console.log(`침초진: ${monthlyChim}명`);
    console.log(`자보초진: ${monthlyJabo}명`);
    console.log(`약초진: ${monthlyYak}명`);
    console.log(`기타(수납없음): ${monthlyEtc}명`);
    console.log(`합계: ${monthlyChim + monthlyJabo + monthlyYak + monthlyEtc}명`);

    // 일별 상세
    console.log('\n--- 일별 상세 ---');
    const dailyBreakdown = await sql.query`
      SELECT
        CAST(c.reg_date AS DATE) as reg_day,
        SUM(CASE
          WHEN EXISTS (SELECT 1 FROM Detail d WHERE d.Customer_PK = c.Customer_PK
                       AND CAST(d.TxDate AS DATE) = CAST(c.reg_date AS DATE)
                       AND d.TxItem LIKE '%자동차보험%') THEN 1
          ELSE 0
        END) as jabo,
        SUM(CASE
          WHEN NOT EXISTS (SELECT 1 FROM Detail d WHERE d.Customer_PK = c.Customer_PK
                           AND CAST(d.TxDate AS DATE) = CAST(c.reg_date AS DATE)
                           AND d.TxItem LIKE '%자동차보험%')
               AND ISNULL(r.CheongGu_Money, 0) > 0 THEN 1
          ELSE 0
        END) as chim,
        SUM(CASE
          WHEN NOT EXISTS (SELECT 1 FROM Detail d WHERE d.Customer_PK = c.Customer_PK
                           AND CAST(d.TxDate AS DATE) = CAST(c.reg_date AS DATE)
                           AND d.TxItem LIKE '%자동차보험%')
               AND ISNULL(r.CheongGu_Money, 0) = 0
               AND ISNULL(r.General_Money, 0) > 0 THEN 1
          ELSE 0
        END) as yak,
        COUNT(*) as total
      FROM Customer c
      LEFT JOIN Receipt r ON c.Customer_PK = r.Customer_PK
        AND CAST(r.TxDate AS DATE) = CAST(c.reg_date AS DATE)
      WHERE c.reg_date >= '2025-12-01' AND c.reg_date < '2026-01-01'
      GROUP BY CAST(c.reg_date AS DATE)
      ORDER BY reg_day
    `;

    console.log('날짜       | 침초진 | 자보초진 | 약초진 | 합계');
    console.log('-----------|--------|----------|--------|------');
    dailyBreakdown.recordset.forEach(r => {
      const dateStr = r.reg_day.toISOString().split('T')[0];
      const etc = r.total - r.chim - r.jabo - r.yak;
      console.log(`${dateStr} |   ${String(r.chim).padStart(4)} |     ${String(r.jabo).padStart(4)} |   ${String(r.yak).padStart(4)} |  ${String(r.total).padStart(4)}`);
    });

    await sql.close();
    console.log('\n완료');
  } catch (err) {
    console.error('오류:', err.message);
  }
}

main();
