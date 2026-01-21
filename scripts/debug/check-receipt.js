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

async function checkReceipt() {
  const pool = await sql.connect(config);

  console.log('=== MasterDB.Receipt 컬럼 구조 ===');
  const cols = await pool.request().query(`
    SELECT COLUMN_NAME, DATA_TYPE
    FROM MasterDB.INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'Receipt'
    ORDER BY ORDINAL_POSITION
  `);
  cols.recordset.forEach(c => console.log(`  ${c.COLUMN_NAME} (${c.DATA_TYPE})`));

  console.log('\n=== 샘플 데이터 ===');
  const sample = await pool.request().query('SELECT TOP 1 * FROM MasterDB.dbo.Receipt');
  console.log(JSON.stringify(sample.recordset[0], null, 2));

  await pool.close();
}

checkReceipt().catch(console.error);
