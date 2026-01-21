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

    // IsDrug=1 & InsuYes=0인 모든 PxName 패턴 확인
    console.log('=== IsDrug=1 & InsuYes=0 전체 PxName (2025년) ===');
    const allPx = await sql.query`
        SELECT PxName, COUNT(*) as cnt, SUM(TxMoney) as total_money
        FROM Detail
        WHERE TxDate >= '2025-01-01' AND IsDrug = 1 AND InsuYes = 0
        GROUP BY PxName
        ORDER BY cnt DESC
    `;
    allPx.recordset.forEach(d => {
        console.log(`${d.PxName}: ${d.cnt}건, ${(d.total_money/10000).toFixed(0)}만원`);
    });

    await sql.close();
}
run().catch(console.error);
