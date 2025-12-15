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

  const startDate = '2025-12-01';
  const endDate = '2025-12-14';

  // 매출 현황 - CTE로 자보 여부 먼저 계산
  const result = await sql.query`
    WITH JaboReceipts AS (
      SELECT DISTINCT r.Receipt_PK, r.Customer_PK, CAST(r.TxDate AS DATE) as TxDate
      FROM Receipt r
      WHERE EXISTS (
        SELECT 1 FROM Detail d
        WHERE d.Customer_PK = r.Customer_PK
        AND CAST(d.TxDate AS DATE) = CAST(r.TxDate AS DATE)
        AND d.TxItem LIKE '%자동차보험%'
      )
    )
    SELECT
      SUM(CASE WHEN jr.Receipt_PK IS NULL THEN ISNULL(r.Bonin_Money, 0) + ISNULL(r.CheongGu_Money, 0) ELSE 0 END) as insurance_revenue,
      SUM(CASE WHEN jr.Receipt_PK IS NOT NULL THEN ISNULL(r.Bonin_Money, 0) + ISNULL(r.CheongGu_Money, 0) + ISNULL(r.General_Money, 0) ELSE 0 END) as jabo_revenue,
      SUM(CASE WHEN jr.Receipt_PK IS NULL THEN ISNULL(r.General_Money, 0) ELSE 0 END) as uncovered_revenue
    FROM Receipt r
    LEFT JOIN JaboReceipts jr ON r.Receipt_PK = jr.Receipt_PK
    WHERE CAST(r.TxDate AS DATE) BETWEEN ${startDate} AND ${endDate}
  `;

  console.log('=== 매출 현황 (12월) ===');
  console.log('급여매출:', Number(result.recordset[0].insurance_revenue || 0).toLocaleString() + '원');
  console.log('자보매출:', Number(result.recordset[0].jabo_revenue || 0).toLocaleString() + '원');
  console.log('비급여매출:', Number(result.recordset[0].uncovered_revenue || 0).toLocaleString() + '원');

  const total = Number(result.recordset[0].insurance_revenue || 0) +
                Number(result.recordset[0].jabo_revenue || 0) +
                Number(result.recordset[0].uncovered_revenue || 0);
  console.log('총 매출:', total.toLocaleString() + '원');

  await sql.close();
}
run().catch(e => { console.error(e); sql.close(); });
