const sql = require('mssql');

const config = {
  server: '192.168.0.173',
  port: 1433,
  database: 'HTEMP',
  user: 'sa',
  password: 'lhsp!2345',
  options: {
    encrypt: false,
    trustServerCertificate: true
  }
};

async function main() {
  try {
    await sql.connect(config);

    // Receipt 테이블 컬럼 조회
    const result = await sql.query`
      SELECT COLUMN_NAME, DATA_TYPE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'Receipt'
      ORDER BY ORDINAL_POSITION
    `;

    console.log('Receipt 테이블 컬럼:');
    result.recordset.forEach(col => {
      console.log(`  ${col.COLUMN_NAME} (${col.DATA_TYPE})`);
    });

    // 특히 Money 관련 컬럼 찾기
    console.log('\n수납 방법 관련 컬럼 (Money 포함):');
    result.recordset.filter(col => col.COLUMN_NAME.toLowerCase().includes('money'))
      .forEach(col => {
        console.log(`  ${col.COLUMN_NAME} (${col.DATA_TYPE})`);
      });

    await sql.close();
  } catch (err) {
    console.error('Error:', err.message);
  }
}

main();
