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

    // 1. Customer 테이블 컬럼 확인
    console.log('=== Customer 테이블 컬럼 ===');
    const customerCols = await sql.query`
      SELECT COLUMN_NAME, DATA_TYPE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'Customer'
      ORDER BY ORDINAL_POSITION
    `;
    customerCols.recordset.forEach(r => console.log(`  ${r.COLUMN_NAME} (${r.DATA_TYPE})`));

    // 2. Detail 테이블에서 "진료비" 관련 TxItem 확인
    console.log('\n=== Detail.TxItem 중 "진료" 포함 항목 ===');
    const treatmentItems = await sql.query`
      SELECT DISTINCT TxItem, COUNT(*) as cnt
      FROM Detail
      WHERE TxItem LIKE '%진료%'
      GROUP BY TxItem
      ORDER BY cnt DESC
    `;
    treatmentItems.recordset.forEach(r => console.log(`  ${r.TxItem}: ${r.cnt}건`));

    // 3. Detail 테이블에서 "진찰" 관련 TxItem 확인
    console.log('\n=== Detail.TxItem 중 "진찰" 포함 항목 ===');
    const examItems = await sql.query`
      SELECT DISTINCT TxItem, COUNT(*) as cnt
      FROM Detail
      WHERE TxItem LIKE '%진찰%'
      GROUP BY TxItem
      ORDER BY cnt DESC
    `;
    examItems.recordset.forEach(r => console.log(`  ${r.TxItem}: ${r.cnt}건`));

    // 4. Detail 테이블 상위 50개 TxItem
    console.log('\n=== Detail.TxItem 상위 50개 ===');
    const topItems = await sql.query`
      SELECT TOP 50 TxItem, COUNT(*) as cnt
      FROM Detail
      GROUP BY TxItem
      ORDER BY cnt DESC
    `;
    topItems.recordset.forEach(r => console.log(`  ${r.TxItem}: ${r.cnt}건`));

    // 5. Receipt 테이블에서 신규환자 판별 방법 확인 (sn 필드?)
    console.log('\n=== Receipt 테이블 컬럼 ===');
    const receiptCols = await sql.query`
      SELECT COLUMN_NAME, DATA_TYPE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'Receipt'
      ORDER BY ORDINAL_POSITION
    `;
    receiptCols.recordset.forEach(r => console.log(`  ${r.COLUMN_NAME} (${r.DATA_TYPE})`));

    // 6. Receipt.sn 값 분포 확인
    console.log('\n=== Receipt.sn 값 분포 (2025-12-10) ===');
    const snDist = await sql.query`
      SELECT sn, COUNT(*) as cnt
      FROM Receipt
      WHERE CAST(TxDate AS DATE) = '2025-12-10'
      GROUP BY sn
      ORDER BY sn
    `;
    snDist.recordset.forEach(r => console.log(`  sn=${r.sn}: ${r.cnt}건`));

    await sql.close();
    console.log('\n완료');
  } catch (err) {
    console.error('오류:', err.message);
  }
}

main();
