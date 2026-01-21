const sql = require('mssql');
const config = {
    server: '192.168.0.173',
    port: 55555,
    user: 'members',
    password: 'msp1234',
    database: 'UserInfo',
    options: { encrypt: false, trustServerCertificate: true }
};

async function run() {
    await sql.connect(config);

    // UserInfo DB의 테이블 목록
    console.log('=== UserInfo DB 테이블 목록 ===');
    const tables = await sql.query`
        SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_TYPE = 'BASE TABLE'
        ORDER BY TABLE_NAME
    `;
    tables.recordset.forEach(t => console.log(t.TABLE_NAME));

    // 원장/의사 관련 테이블 찾기 (doctor, staff, employee 등)
    console.log('\n=== 원장 관련 테이블 탐색 ===');
    for (const t of tables.recordset) {
        const cols = await sql.query`
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = ${t.TABLE_NAME}
        `;
        const colNames = cols.recordset.map(c => c.COLUMN_NAME.toLowerCase()).join(',');
        // 입사일 관련 컬럼이 있는 테이블 찾기
        if (colNames.includes('date') || colNames.includes('join') || colNames.includes('start') || colNames.includes('hire') || colNames.includes('doctor') || colNames.includes('name')) {
            console.log(`\n[${t.TABLE_NAME}]`);
            cols.recordset.forEach(c => console.log(`  - ${c.COLUMN_NAME}`));
        }
    }

    await sql.close();
}
run().catch(console.error);
