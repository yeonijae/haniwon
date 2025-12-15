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

    // 1. SubDetail 테이블 컬럼 확인
    console.log('=== SubDetail 테이블 컬럼 ===');
    const cols = await sql.query`
      SELECT COLUMN_NAME, DATA_TYPE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'SubDetail'
      ORDER BY ORDINAL_POSITION
    `;
    cols.recordset.forEach(r => console.log(`  ${r.COLUMN_NAME} (${r.DATA_TYPE})`));

    // 2. "일반진료관리"가 초진료인지 확인
    // - 신규환자(reg_date = TxDate)와 기존환자 비교
    console.log('\n=== "일반진료관리" 분석 ===');
    const generalMgmt = await sql.query`
      SELECT
        SUM(CASE WHEN CAST(c.reg_date AS DATE) = CAST(d.TxDate AS DATE) THEN 1 ELSE 0 END) as new_patient,
        SUM(CASE WHEN CAST(c.reg_date AS DATE) < CAST(d.TxDate AS DATE) THEN 1 ELSE 0 END) as existing_patient
      FROM Detail d
      INNER JOIN Customer c ON d.Customer_PK = c.Customer_PK
      WHERE d.TxItem = '일반진료관리'
    `;
    console.log(`일반진료관리 - 신규환자: ${generalMgmt.recordset[0].new_patient}건`);
    console.log(`일반진료관리 - 기존환자: ${generalMgmt.recordset[0].existing_patient}건`);

    // 3. 자보환자 중 "일반진료관리" (자보초진 후보)
    console.log('\n=== 자보 + 일반진료관리 (자보초진 후보) ===');
    const jaboGeneral = await sql.query`
      SELECT
        SUM(CASE WHEN CAST(c.reg_date AS DATE) = CAST(d.TxDate AS DATE) THEN 1 ELSE 0 END) as new_jabo,
        SUM(CASE WHEN CAST(c.reg_date AS DATE) < CAST(d.TxDate AS DATE) THEN 1 ELSE 0 END) as existing_jabo_chojin
      FROM Detail d
      INNER JOIN Customer c ON d.Customer_PK = c.Customer_PK
      WHERE d.TxItem = '일반진료관리'
      AND EXISTS (
        SELECT 1 FROM Detail d2
        WHERE d2.Customer_PK = d.Customer_PK
        AND CAST(d2.TxDate AS DATE) = CAST(d.TxDate AS DATE)
        AND d2.TxItem LIKE '%자동차보험%'
      )
    `;
    console.log(`자보+일반진료관리 - 신규환자: ${jaboGeneral.recordset[0].new_jabo}건 (자보초진-신규)`);
    console.log(`자보+일반진료관리 - 기존환자: ${jaboGeneral.recordset[0].existing_jabo_chojin}건 (자보초진-재초진)`);

    // 4. 2025-12-10 자보초진 상세
    console.log('\n=== 2025-12-10 자보초진 상세 ===');
    const jaboChojinToday = await sql.query`
      SELECT DISTINCT
        c.sn, c.name, c.reg_date,
        CASE WHEN CAST(c.reg_date AS DATE) = '2025-12-10' THEN '신규' ELSE '기존(재초진)' END as type,
        CASE WHEN EXISTS (
          SELECT 1 FROM Detail d2
          WHERE d2.Customer_PK = c.Customer_PK
          AND CAST(d2.TxDate AS DATE) = '2025-12-10'
          AND d2.TxItem = '일반진료관리'
        ) THEN 'O' ELSE 'X' END as has_chojinryo
      FROM Customer c
      INNER JOIN Detail d ON c.Customer_PK = d.Customer_PK
      WHERE CAST(d.TxDate AS DATE) = '2025-12-10'
      AND d.TxItem LIKE '%자동차보험%'
    `;
    console.log(`자보환자 수: ${jaboChojinToday.recordset.length}명`);
    jaboChojinToday.recordset.forEach(r => {
      const regDate = r.reg_date ? r.reg_date.toISOString().split('T')[0] : 'N/A';
      console.log(`  ${r.sn} ${r.name}: 등록일=${regDate}, ${r.type}, 초진료=${r.has_chojinryo}`);
    });

    // 5. 2025-12월 자보초진 통계
    console.log('\n=== 2025-12월 자보초진 통계 ===');
    const monthlyJaboChojin = await sql.query`
      SELECT
        -- 신규 자보환자 (reg_date = TxDate)
        COUNT(DISTINCT CASE
          WHEN CAST(c.reg_date AS DATE) = CAST(d.TxDate AS DATE)
          THEN c.Customer_PK
        END) as new_jabo,
        -- 기존 환자 + 자보 + 일반진료관리(초진료)
        COUNT(DISTINCT CASE
          WHEN CAST(c.reg_date AS DATE) < CAST(d.TxDate AS DATE)
          AND EXISTS (
            SELECT 1 FROM Detail d2
            WHERE d2.Customer_PK = d.Customer_PK
            AND CAST(d2.TxDate AS DATE) = CAST(d.TxDate AS DATE)
            AND d2.TxItem = '일반진료관리'
          )
          THEN c.Customer_PK
        END) as existing_jabo_rechojin
      FROM Detail d
      INNER JOIN Customer c ON d.Customer_PK = c.Customer_PK
      WHERE d.TxItem LIKE '%자동차보험%'
      AND d.TxDate >= '2025-12-01' AND d.TxDate < '2026-01-01'
    `;
    const jabo = monthlyJaboChojin.recordset[0];
    console.log(`자보초진(신규): ${jabo.new_jabo}명`);
    console.log(`자보초진(재초진-기존환자): ${jabo.existing_jabo_rechojin}명`);
    console.log(`자보초진 합계: ${jabo.new_jabo + jabo.existing_jabo_rechojin}명`);

    await sql.close();
    console.log('\n완료');
  } catch (err) {
    console.error('오류:', err.message);
  }
}

main();
