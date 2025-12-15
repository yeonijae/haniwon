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

    // 소개로 온 환자들의 CustURL에서 차트번호 추출 테스트
    const charts = ['3860', '14739', '201330', '20133', '19119', '10346', '419', '16005'];

    console.log('=== 소개자 차트번호 조회 ===\n');

    for (const chart of charts) {
        const result = await sql.query`
            SELECT sn, NAME, MAINDOCTOR
            FROM Customer
            WHERE sn = ${chart}
        `;

        if (result.recordset.length > 0) {
            const r = result.recordset[0];
            console.log(`[${chart}] → ${r.NAME} | 담당: ${r.MAINDOCTOR || '없음'}`);
        } else {
            console.log(`[${chart}] → 찾을 수 없음`);
        }
    }

    await sql.close();
}

run().catch(console.error);
