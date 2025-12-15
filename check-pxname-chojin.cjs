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

    // 1. PxName에서 "초진" 또는 "진찰" 관련 항목 검색
    console.log('=== Detail.PxName 중 "초진" 또는 "진찰" 포함 ===');
    const pxNames = await sql.query`
      SELECT DISTINCT PxName, COUNT(*) as cnt
      FROM Detail
      WHERE PxName LIKE '%초진%' OR PxName LIKE '%진찰%'
      GROUP BY PxName
      ORDER BY cnt DESC
    `;
    pxNames.recordset.forEach(r => console.log(`  ${r.PxName}: ${r.cnt}건`));

    // 2. 자보환자의 PxName 확인
    console.log('\n=== 자보환자의 PxName (상위 30개) ===');
    const jaboPxNames = await sql.query`
      SELECT TOP 30 PxName, COUNT(*) as cnt
      FROM Detail
      WHERE TxItem LIKE '%자동차보험%'
      GROUP BY PxName
      ORDER BY cnt DESC
    `;
    jaboPxNames.recordset.forEach(r => console.log(`  ${r.PxName}: ${r.cnt}건`));

    // 3. 2025-12-10 자보환자 중 초진진찰료가 있는 환자
    console.log('\n=== 2025-12-10 자보환자 초진진찰료 확인 ===');
    const jaboChojin = await sql.query`
      SELECT DISTINCT c.sn, c.name, c.reg_date, d.PxName
      FROM Detail d
      INNER JOIN Customer c ON d.Customer_PK = c.Customer_PK
      WHERE CAST(d.TxDate AS DATE) = '2025-12-10'
      AND d.TxItem LIKE '%자동차보험%'
      AND (d.PxName LIKE '%초진%' OR d.PxName LIKE '%진찰%')
    `;
    console.log(`자보+초진진찰료 환자 수: ${jaboChojin.recordset.length}명`);
    jaboChojin.recordset.forEach(r => {
      const regDate = r.reg_date ? r.reg_date.toISOString().split('T')[0] : 'N/A';
      const isNew = regDate === '2025-12-10' ? '신규' : '기존';
      console.log(`  ${r.sn} ${r.name}: 등록일=${regDate} (${isNew}), PxName=${r.PxName}`);
    });

    // 4. 2025-12월 자보초진 통계 (PxName 기준)
    console.log('\n=== 2025-12월 자보초진 통계 ===');

    // 신규 자보환자 (reg_date = TxDate)
    const newJabo = await sql.query`
      SELECT COUNT(DISTINCT c.Customer_PK) as cnt
      FROM Detail d
      INNER JOIN Customer c ON d.Customer_PK = c.Customer_PK
      WHERE d.TxItem LIKE '%자동차보험%'
      AND d.TxDate >= '2025-12-01' AND d.TxDate < '2026-01-01'
      AND CAST(c.reg_date AS DATE) = CAST(d.TxDate AS DATE)
    `;
    console.log(`자보초진(신규환자): ${newJabo.recordset[0].cnt}명`);

    // 기존환자 + 자보 + 초진진찰료
    const existingJaboChojin = await sql.query`
      SELECT COUNT(DISTINCT c.Customer_PK) as cnt
      FROM Detail d
      INNER JOIN Customer c ON d.Customer_PK = c.Customer_PK
      WHERE d.TxItem LIKE '%자동차보험%'
      AND d.TxDate >= '2025-12-01' AND d.TxDate < '2026-01-01'
      AND CAST(c.reg_date AS DATE) < CAST(d.TxDate AS DATE)
      AND EXISTS (
        SELECT 1 FROM Detail d2
        WHERE d2.Customer_PK = d.Customer_PK
        AND CAST(d2.TxDate AS DATE) = CAST(d.TxDate AS DATE)
        AND d2.TxItem LIKE '%자동차보험%'
        AND d2.PxName LIKE '%초진%'
      )
    `;
    console.log(`자보초진(기존환자+초진진찰료): ${existingJaboChojin.recordset[0].cnt}명`);

    const total = newJabo.recordset[0].cnt + existingJaboChojin.recordset[0].cnt;
    console.log(`자보초진 합계: ${total}명`);

    await sql.close();
    console.log('\n완료');
  } catch (err) {
    console.error('오류:', err.message);
  }
}

main();
