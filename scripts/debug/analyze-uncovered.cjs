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

    // SUGGEST 컬럼 값 분포 확인
    const suggest = await sql.query`
        SELECT SUGGEST, COUNT(*) as cnt
        FROM Customer
        WHERE reg_date >= DATEADD(MONTH, -6, GETDATE())
          AND SUGGEST IS NOT NULL AND SUGGEST != ''
        GROUP BY SUGGEST
        ORDER BY cnt DESC
    `;
    console.log('=== 내원경로 (SUGGEST) 분포 - 최근 6개월 ===');
    suggest.recordset.forEach(r => {
        console.log(`[${r.cnt}명] ${r.SUGGEST}`);
    });

    await sql.close();
}
run().catch(console.error);
