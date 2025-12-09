import sql from 'mssql';

const config = {
  server: '192.168.0.173',
  user: 'members',
  password: 'msp1234',
  port: 55555,
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true,
    connectTimeout: 15000,
  }
};

async function checkTreatCurrentDB() {
  const pool = await sql.connect(config);

  // TreatCurrent 데이터베이스 확인
  await pool.request().query('USE TreatCurrent');

  console.log('=== TreatCurrent DB의 테이블 목록 ===');
  const tables = await pool.request().query(`
    SELECT TABLE_NAME
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_TYPE = 'BASE TABLE'
    ORDER BY TABLE_NAME
  `);
  tables.recordset.forEach(t => console.log(t.TABLE_NAME));

  // 각 테이블 구조 확인
  for (const t of tables.recordset) {
    console.log('\n=== ' + t.TABLE_NAME + ' 테이블 구조 ===');
    const cols = await pool.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = '${t.TABLE_NAME}'
      ORDER BY ORDINAL_POSITION
    `);
    cols.recordset.forEach(c => console.log('  ' + c.COLUMN_NAME + ' (' + c.DATA_TYPE + ')'));

    // 데이터 샘플 확인
    try {
      const sample = await pool.request().query(`SELECT TOP 5 * FROM [${t.TABLE_NAME}]`);
      if (sample.recordset.length > 0) {
        console.log('  --- 샘플 데이터 ---');
        sample.recordset.forEach((r, i) => console.log('  [' + (i+1) + '] ' + JSON.stringify(r)));
      }
    } catch (e) {
      console.log('  (데이터 조회 실패)');
    }
  }

  await pool.close();
}

checkTreatCurrentDB();
