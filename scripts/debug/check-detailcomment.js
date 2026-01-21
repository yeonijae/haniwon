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

async function checkDetailComment() {
  const pool = await sql.connect(config);

  // DetailComment 테이블 구조 확인
  console.log('=== MasterDB.DetailComment 테이블 구조 ===');
  const cols = await pool.request().query(`
    SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
    FROM MasterDB.INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'DetailComment'
    ORDER BY ORDINAL_POSITION
  `);
  cols.recordset.forEach(c => console.log(`  ${c.COLUMN_NAME} (${c.DATA_TYPE}${c.CHARACTER_MAXIMUM_LENGTH ? ', max=' + c.CHARACTER_MAXIMUM_LENGTH : ''})`));

  // 샘플 데이터 확인
  console.log('\n=== DetailComment 샘플 데이터 (TOP 3) ===');
  const sample = await pool.request().query('SELECT TOP 3 * FROM MasterDB.dbo.DetailComment');
  sample.recordset.forEach((r, i) => console.log(`[${i+1}]`, JSON.stringify(r, null, 2)));

  await pool.close();
}

checkDetailComment().catch(console.error);
