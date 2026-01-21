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

    // 1. 자보환자의 Detail 항목 확인 (초진 관련 키워드 찾기)
    console.log('=== 자보환자 Detail.TxItem 패턴 분석 ===');
    const jaboItems = await sql.query`
      SELECT DISTINCT d.TxItem, COUNT(*) as cnt
      FROM Detail d
      WHERE EXISTS (
        SELECT 1 FROM Detail d2
        WHERE d2.Customer_PK = d.Customer_PK
        AND CAST(d2.TxDate AS DATE) = CAST(d.TxDate AS DATE)
        AND d2.TxItem LIKE '%자동차보험%'
      )
      GROUP BY d.TxItem
      ORDER BY cnt DESC
    `;
    jaboItems.recordset.forEach(r => console.log(`  ${r.TxItem}: ${r.cnt}건`));

    // 2. "진료" 관련 항목 중 자보와 함께 나오는 것
    console.log('\n=== 자보환자 중 "진료" 포함 항목 ===');
    const jaboTreatItems = await sql.query`
      SELECT DISTINCT d.TxItem, COUNT(*) as cnt
      FROM Detail d
      WHERE d.TxItem LIKE '%진료%'
      AND EXISTS (
        SELECT 1 FROM Detail d2
        WHERE d2.Customer_PK = d.Customer_PK
        AND CAST(d2.TxDate AS DATE) = CAST(d.TxDate AS DATE)
        AND d2.TxItem LIKE '%자동차보험%'
      )
      GROUP BY d.TxItem
      ORDER BY cnt DESC
    `;
    jaboTreatItems.recordset.forEach(r => console.log(`  ${r.TxItem}: ${r.cnt}건`));

    // 3. SubDetail 테이블에서 초진 관련 확인
    console.log('\n=== SubDetail에서 "초진" 관련 항목 ===');
    const subDetailChojin = await sql.query`
      SELECT DISTINCT ItemName, COUNT(*) as cnt
      FROM SubDetail
      WHERE ItemName LIKE '%초진%' OR ItemName LIKE '%진찰%'
      GROUP BY ItemName
      ORDER BY cnt DESC
    `;
    subDetailChojin.recordset.forEach(r => console.log(`  ${r.ItemName}: ${r.cnt}건`));

    // 4. 자보환자의 SubDetail 항목
    console.log('\n=== 자보환자의 SubDetail 항목 (상위 30개) ===');
    const jaboSubDetail = await sql.query`
      SELECT TOP 30 sd.ItemName, COUNT(*) as cnt
      FROM SubDetail sd
      INNER JOIN Detail d ON sd.Customer_PK = d.Customer_PK AND sd.TxDate = d.TxDate
      WHERE d.TxItem LIKE '%자동차보험%'
      GROUP BY sd.ItemName
      ORDER BY cnt DESC
    `;
    jaboSubDetail.recordset.forEach(r => console.log(`  ${r.ItemName}: ${r.cnt}건`));

    // 5. 2025-12-10 자보환자 상세 확인
    console.log('\n=== 2025-12-10 자보환자 상세 ===');
    const jaboPatients = await sql.query`
      SELECT DISTINCT
        c.sn, c.name, c.reg_date,
        CASE WHEN CAST(c.reg_date AS DATE) = '2025-12-10' THEN '신규' ELSE '기존' END as patient_type
      FROM Receipt r
      INNER JOIN Customer c ON r.Customer_PK = c.Customer_PK
      WHERE CAST(r.TxDate AS DATE) = '2025-12-10'
      AND EXISTS (
        SELECT 1 FROM Detail d
        WHERE d.Customer_PK = r.Customer_PK
        AND CAST(d.TxDate AS DATE) = '2025-12-10'
        AND d.TxItem LIKE '%자동차보험%'
      )
    `;
    console.log(`자보환자 수: ${jaboPatients.recordset.length}명`);
    jaboPatients.recordset.forEach(r => {
      const regDate = r.reg_date ? r.reg_date.toISOString().split('T')[0] : 'N/A';
      console.log(`  ${r.sn} ${r.name}: 등록일=${regDate}, ${r.patient_type}`);
    });

    // 6. 기존 환자 중 자보로 온 환자의 SubDetail 확인 (초진료 찾기)
    console.log('\n=== 기존환자+자보의 SubDetail (초진료 확인) ===');
    const existingJaboSubDetail = await sql.query`
      SELECT sd.Customer_PK, c.sn, c.name, sd.ItemName, sd.TxDate
      FROM SubDetail sd
      INNER JOIN Customer c ON sd.Customer_PK = c.Customer_PK
      WHERE CAST(sd.TxDate AS DATE) = '2025-12-10'
      AND CAST(c.reg_date AS DATE) < '2025-12-10'
      AND EXISTS (
        SELECT 1 FROM Detail d
        WHERE d.Customer_PK = sd.Customer_PK
        AND CAST(d.TxDate AS DATE) = '2025-12-10'
        AND d.TxItem LIKE '%자동차보험%'
      )
      AND (sd.ItemName LIKE '%초진%' OR sd.ItemName LIKE '%진찰%')
    `;
    console.log(`기존환자+자보+초진료: ${existingJaboSubDetail.recordset.length}건`);
    existingJaboSubDetail.recordset.forEach(r => {
      console.log(`  ${r.sn} ${r.name}: ${r.ItemName}`);
    });

    await sql.close();
    console.log('\n완료');
  } catch (err) {
    console.error('오류:', err.message);
  }
}

main();
