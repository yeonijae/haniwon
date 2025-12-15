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

    // 1. "초진" 키워드가 있는 모든 테이블 찾기
    console.log('=== "초진" 키워드가 있는 테이블/컬럼 검색 ===');

    // 2. 청구 관련 테이블 확인
    console.log('\n=== 청구 관련 테이블 목록 ===');
    const tables = await sql.query`
      SELECT TABLE_NAME
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_TYPE = 'BASE TABLE'
      AND (TABLE_NAME LIKE '%청구%' OR TABLE_NAME LIKE '%Claim%'
           OR TABLE_NAME LIKE '%Bill%' OR TABLE_NAME LIKE '%Detail%'
           OR TABLE_NAME LIKE '%EDI%' OR TABLE_NAME LIKE '%Insu%')
      ORDER BY TABLE_NAME
    `;
    tables.recordset.forEach(r => console.log(`  ${r.TABLE_NAME}`));

    // 3. Detail 테이블에서 TxItem 외에 다른 컬럼 확인
    console.log('\n=== Detail 테이블 전체 컬럼 ===');
    const detailCols = await sql.query`
      SELECT COLUMN_NAME, DATA_TYPE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'Detail'
      ORDER BY ORDINAL_POSITION
    `;
    detailCols.recordset.forEach(r => console.log(`  ${r.COLUMN_NAME} (${r.DATA_TYPE})`));

    // 4. Detail 테이블의 샘플 데이터 (자보환자)
    console.log('\n=== 2025-12-10 자보환자 Detail 샘플 ===');
    const detailSample = await sql.query`
      SELECT TOP 5 *
      FROM Detail
      WHERE CAST(TxDate AS DATE) = '2025-12-10'
      AND TxItem LIKE '%자동차보험%'
    `;
    if (detailSample.recordset.length > 0) {
      console.log('컬럼:', Object.keys(detailSample.recordset[0]).join(', '));
      detailSample.recordset.forEach(r => {
        console.log(`\n  Customer_PK: ${r.Customer_PK}`);
        Object.entries(r).forEach(([k, v]) => {
          if (v !== null && v !== '' && k !== 'Customer_PK') {
            console.log(`    ${k}: ${v}`);
          }
        });
      });
    }

    // 5. InsuPx 데이터베이스에서 초진 관련 검색
    console.log('\n=== InsuPx DB 테이블 검색 ===');
    await sql.query`USE InsuPx`;
    const insuTables = await sql.query`
      SELECT TABLE_NAME
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_NAME
    `;
    console.log('InsuPx 테이블 수:', insuTables.recordset.length);
    insuTables.recordset.slice(0, 20).forEach(r => console.log(`  ${r.TABLE_NAME}`));

    // MasterDB로 돌아가기
    await sql.query`USE MasterDB`;

    // 6. RecData 데이터베이스 확인
    console.log('\n=== RecData DB 테이블 검색 ===');
    await sql.query`USE RecData`;
    const recTables = await sql.query`
      SELECT TABLE_NAME
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_NAME
    `;
    console.log('RecData 테이블 수:', recTables.recordset.length);
    recTables.recordset.slice(0, 20).forEach(r => console.log(`  ${r.TABLE_NAME}`));

    // MasterDB로 돌아가기
    await sql.query`USE MasterDB`;

    // 7. 전체 DB에서 "초진" 문자열 검색
    console.log('\n=== MasterDB 모든 테이블에서 "초진" 검색 ===');
    const allTables = await sql.query`
      SELECT TABLE_NAME
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_TYPE = 'BASE TABLE'
    `;

    for (const table of allTables.recordset.slice(0, 30)) {
      try {
        const cols = await sql.query(`
          SELECT COLUMN_NAME
          FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_NAME = '${table.TABLE_NAME}'
          AND DATA_TYPE IN ('nvarchar', 'varchar', 'ntext', 'text')
        `);

        for (const col of cols.recordset) {
          try {
            const result = await sql.query(`
              SELECT TOP 1 [${col.COLUMN_NAME}]
              FROM [${table.TABLE_NAME}]
              WHERE [${col.COLUMN_NAME}] LIKE '%초진%'
            `);
            if (result.recordset.length > 0) {
              console.log(`  ${table.TABLE_NAME}.${col.COLUMN_NAME}: "${result.recordset[0][col.COLUMN_NAME]?.substring(0, 50)}..."`);
            }
          } catch (e) {
            // 검색 실패 무시
          }
        }
      } catch (e) {
        // 테이블 접근 실패 무시
      }
    }

    await sql.close();
    console.log('\n완료');
  } catch (err) {
    console.error('오류:', err.message);
  }
}

main();
