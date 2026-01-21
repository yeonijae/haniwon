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

    // 1. 2025-12-10 신규환자 확인 (reg_date 기준)
    console.log('=== 2025-12-10 신규 환자 (reg_date = 진료일) ===');
    const newPatients = await sql.query`
      SELECT c.Customer_PK, c.sn, c.name, c.reg_date, r.TxDate
      FROM Receipt r
      INNER JOIN Customer c ON r.Customer_PK = c.Customer_PK
      WHERE CAST(r.TxDate AS DATE) = '2025-12-10'
        AND CAST(c.reg_date AS DATE) = '2025-12-10'
    `;
    console.log(`신규환자 수: ${newPatients.recordset.length}명`);
    newPatients.recordset.forEach(r =>
      console.log(`  ${r.sn} ${r.name}: reg_date=${r.reg_date}`)
    );

    // 2. "일반진료관리" 항목 분석 - 신규환자와 기존환자 비교
    console.log('\n=== 일반진료관리 항목 분석 (2025-12-10) ===');
    const generalTreat = await sql.query`
      SELECT d.Customer_PK, c.sn, c.name, c.reg_date, d.TxDate, d.TxItem, d.General
      FROM Detail d
      INNER JOIN Customer c ON d.Customer_PK = c.Customer_PK
      WHERE CAST(d.TxDate AS DATE) = '2025-12-10'
        AND d.TxItem = '일반진료관리'
    `;
    console.log(`일반진료관리 건수: ${generalTreat.recordset.length}건`);
    generalTreat.recordset.forEach(r => {
      const isNew = new Date(r.reg_date).toDateString() === new Date(r.TxDate).toDateString();
      console.log(`  ${r.sn} ${r.name}: reg_date=${r.reg_date?.toISOString().split('T')[0]}, ${isNew ? '신규' : '기존'}, 금액=${r.General}`);
    });

    // 3. "보험치료" 항목이 있는 환자 중 신규/기존 분류
    console.log('\n=== 2025-12-10 보험치료 환자 분류 ===');
    const insuranceTreat = await sql.query`
      SELECT
        COUNT(DISTINCT CASE WHEN CAST(c.reg_date AS DATE) = '2025-12-10' THEN r.Customer_PK END) as new_patients,
        COUNT(DISTINCT CASE WHEN CAST(c.reg_date AS DATE) < '2025-12-10' THEN r.Customer_PK END) as existing_patients
      FROM Receipt r
      INNER JOIN Customer c ON r.Customer_PK = c.Customer_PK
      WHERE CAST(r.TxDate AS DATE) = '2025-12-10'
        AND EXISTS (
          SELECT 1 FROM Detail d
          WHERE d.Customer_PK = r.Customer_PK
          AND CAST(d.TxDate AS DATE) = '2025-12-10'
          AND d.TxItem = '보험치료'
        )
    `;
    console.log(`신규환자(초진): ${insuranceTreat.recordset[0].new_patients}명`);
    console.log(`기존환자: ${insuranceTreat.recordset[0].existing_patients}명`);

    // 4. 재초진 판별 - 기존환자 + 일반진료관리 있음
    console.log('\n=== 재초진 환자 (기존환자 + 일반진료관리) ===');
    const reChoJin = await sql.query`
      SELECT COUNT(DISTINCT r.Customer_PK) as cnt
      FROM Receipt r
      INNER JOIN Customer c ON r.Customer_PK = c.Customer_PK
      WHERE CAST(r.TxDate AS DATE) = '2025-12-10'
        AND CAST(c.reg_date AS DATE) < '2025-12-10'
        AND EXISTS (
          SELECT 1 FROM Detail d
          WHERE d.Customer_PK = r.Customer_PK
          AND CAST(d.TxDate AS DATE) = '2025-12-10'
          AND d.TxItem = '일반진료관리'
        )
    `;
    console.log(`재초진 환자 수: ${reChoJin.recordset[0].cnt}명`);

    // 5. SubDetail 테이블 확인 (추나 상세 정보가 여기 있을 수 있음)
    console.log('\n=== SubDetail 테이블 구조 ===');
    const subDetailCols = await sql.query`
      SELECT COLUMN_NAME, DATA_TYPE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'SubDetail'
      ORDER BY ORDINAL_POSITION
    `;
    subDetailCols.recordset.forEach(r => console.log(`  ${r.COLUMN_NAME} (${r.DATA_TYPE})`));

    // 6. SubDetail에서 추나 관련 데이터
    console.log('\n=== SubDetail 추나 관련 ItemName ===');
    const chunaSubDetail = await sql.query`
      SELECT DISTINCT ItemName, COUNT(*) as cnt
      FROM SubDetail
      WHERE ItemName LIKE '%추나%'
      GROUP BY ItemName
      ORDER BY cnt DESC
    `;
    chunaSubDetail.recordset.forEach(r => console.log(`  ${r.ItemName}: ${r.cnt}건`));

    await sql.close();
    console.log('\n완료');
  } catch (err) {
    console.error('오류:', err.message);
  }
}

main();
