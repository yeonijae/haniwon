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

    // 1. 초진 관련 TxItem 패턴 확인
    console.log('=== 1. 초진 관련 TxItem 패턴 ===');
    const choJinItems = await sql.query`
      SELECT DISTINCT TxItem, COUNT(*) as cnt
      FROM Detail
      WHERE TxItem LIKE '%초진%'
      GROUP BY TxItem
      ORDER BY cnt DESC
    `;
    choJinItems.recordset.forEach(r => console.log(`  ${r.TxItem}: ${r.cnt}건`));

    // 2. 추나 관련 TxItem 패턴 확인
    console.log('\n=== 2. 추나 관련 TxItem 패턴 ===');
    const chunaItems = await sql.query`
      SELECT DISTINCT TxItem, COUNT(*) as cnt
      FROM Detail
      WHERE TxItem LIKE '%추나%'
      GROUP BY TxItem
      ORDER BY cnt DESC
    `;
    chunaItems.recordset.forEach(r => console.log(`  ${r.TxItem}: ${r.cnt}건`));

    // 3. 자보 관련 TxItem 패턴 확인
    console.log('\n=== 3. 자보(자동차보험) 관련 TxItem 패턴 ===');
    const jaboItems = await sql.query`
      SELECT DISTINCT TxItem, COUNT(*) as cnt
      FROM Detail
      WHERE TxItem LIKE '%자동차%' OR TxItem LIKE '%자보%'
      GROUP BY TxItem
      ORDER BY cnt DESC
    `;
    jaboItems.recordset.forEach(r => console.log(`  ${r.TxItem}: ${r.cnt}건`));

    // 4. 비급여 관련 TxItem 패턴 확인 (약환자 관련)
    console.log('\n=== 4. 비급여 관련 TxItem 패턴 (상위 30개) ===');
    const uncoveredItems = await sql.query`
      SELECT TOP 30 TxItem, COUNT(*) as cnt
      FROM Detail
      WHERE TxItem LIKE '%비급여%' OR TxItem LIKE '%약%' OR TxItem LIKE '%한약%' OR TxItem LIKE '%탕%'
      GROUP BY TxItem
      ORDER BY cnt DESC
    `;
    uncoveredItems.recordset.forEach(r => console.log(`  ${r.TxItem}: ${r.cnt}건`));

    // 5. Customer 테이블의 FirstDate 확인
    console.log('\n=== 5. Customer.FirstDate 샘플 (2025년 12월) ===');
    const newPatients = await sql.query`
      SELECT TOP 10 Customer_PK, Name, ChartNo, FirstDate
      FROM Customer
      WHERE FirstDate >= '2025-12-01'
      ORDER BY FirstDate DESC
    `;
    newPatients.recordset.forEach(r =>
      console.log(`  ${r.ChartNo} ${r.Name}: FirstDate=${r.FirstDate}`)
    );

    // 6. 2025-12-10 하루 데이터로 통계 시뮬레이션
    console.log('\n=== 6. 2025-12-10 통계 시뮬레이션 ===');

    // 6-1. 해당일 전체 내원환자 수
    const totalPatients = await sql.query`
      SELECT COUNT(DISTINCT Customer_PK) as cnt
      FROM Receipt
      WHERE CAST(TxDate AS DATE) = '2025-12-10'
    `;
    console.log(`  전체 내원환자: ${totalPatients.recordset[0].cnt}명`);

    // 6-2. 침환자 (청구금 > 0 OR 자보)
    const acuPatients = await sql.query`
      SELECT COUNT(DISTINCT r.Customer_PK) as cnt
      FROM Receipt r
      WHERE CAST(r.TxDate AS DATE) = '2025-12-10'
        AND (
          ISNULL(r.CheongGu_Money, 0) > 0
          OR EXISTS (
            SELECT 1 FROM Detail d
            WHERE d.Customer_PK = r.Customer_PK
            AND CAST(d.TxDate AS DATE) = '2025-12-10'
            AND d.TxItem LIKE '%자동차보험%'
          )
        )
    `;
    console.log(`  침환자: ${acuPatients.recordset[0].cnt}명`);

    // 6-3. 자보환자
    const jaboPatients = await sql.query`
      SELECT COUNT(DISTINCT r.Customer_PK) as cnt
      FROM Receipt r
      WHERE CAST(r.TxDate AS DATE) = '2025-12-10'
        AND EXISTS (
          SELECT 1 FROM Detail d
          WHERE d.Customer_PK = r.Customer_PK
          AND CAST(d.TxDate AS DATE) = '2025-12-10'
          AND d.TxItem LIKE '%자동차보험%'
        )
    `;
    console.log(`  자보환자: ${jaboPatients.recordset[0].cnt}명`);

    // 6-4. 초진(신규)환자 - FirstDate가 해당일인 환자
    const newPatientsToday = await sql.query`
      SELECT COUNT(DISTINCT r.Customer_PK) as cnt
      FROM Receipt r
      INNER JOIN Customer c ON r.Customer_PK = c.Customer_PK
      WHERE CAST(r.TxDate AS DATE) = '2025-12-10'
        AND CAST(c.FirstDate AS DATE) = '2025-12-10'
    `;
    console.log(`  초진(신규)환자: ${newPatientsToday.recordset[0].cnt}명`);

    // 6-5. 재초진환자 - 기존환자인데 초진료가 있는 환자
    const reChoJin = await sql.query`
      SELECT COUNT(DISTINCT r.Customer_PK) as cnt
      FROM Receipt r
      INNER JOIN Customer c ON r.Customer_PK = c.Customer_PK
      WHERE CAST(r.TxDate AS DATE) = '2025-12-10'
        AND CAST(c.FirstDate AS DATE) < '2025-12-10'
        AND EXISTS (
          SELECT 1 FROM Detail d
          WHERE d.Customer_PK = r.Customer_PK
          AND CAST(d.TxDate AS DATE) = '2025-12-10'
          AND d.TxItem LIKE '%초진%'
        )
    `;
    console.log(`  재초진환자: ${reChoJin.recordset[0].cnt}명`);

    // 6-6. 추나 횟수
    const chunaCount = await sql.query`
      SELECT
        SUM(CASE WHEN TxItem LIKE '%단순추나%' AND TxItem NOT LIKE '%자동차%' THEN 1 ELSE 0 END) as simple_covered,
        SUM(CASE WHEN TxItem LIKE '%복잡추나%' AND TxItem NOT LIKE '%자동차%' THEN 1 ELSE 0 END) as complex_covered,
        SUM(CASE WHEN TxItem LIKE '%추나%' AND TxItem LIKE '%자동차%' THEN 1 ELSE 0 END) as jabo_chuna,
        SUM(CASE WHEN TxItem LIKE '%비급여%' AND TxItem LIKE '%추나%' THEN 1 ELSE 0 END) as uncovered_chuna,
        COUNT(*) as total
      FROM Detail
      WHERE CAST(TxDate AS DATE) = '2025-12-10'
        AND TxItem LIKE '%추나%'
    `;
    const c = chunaCount.recordset[0];
    console.log(`  추나 횟수: 건보단순=${c.simple_covered}, 건보복잡=${c.complex_covered}, 자보=${c.jabo_chuna}, 비급여=${c.uncovered_chuna}, 전체=${c.total}`);

    // 6-7. 매출
    const revenue = await sql.query`
      SELECT
        SUM(ISNULL(Bonin_Money, 0)) as bonin,
        SUM(ISNULL(CheongGu_Money, 0)) as cheonggu,
        SUM(ISNULL(General_Money, 0)) as general
      FROM Receipt
      WHERE CAST(TxDate AS DATE) = '2025-12-10'
    `;
    const rev = revenue.recordset[0];
    console.log(`  매출: 본인부담=${rev.bonin}, 청구금=${rev.cheonggu}, 비급여=${rev.general}`);
    console.log(`  급여매출(본인+청구): ${rev.bonin + rev.cheonggu}`);

    await sql.close();
    console.log('\n완료');
  } catch (err) {
    console.error('오류:', err);
  }
}

main();
