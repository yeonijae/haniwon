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

    // sn 컬럼 타입 확인
    console.log('=== sn 컬럼 샘플 조회 ===\n');
    const sample = await sql.query`SELECT TOP 5 sn, NAME FROM Customer ORDER BY Customer_PK DESC`;
    sample.recordset.forEach(r => {
        console.log(`sn: "${r.sn}" (type: ${typeof r.sn}) | ${r.NAME}`);
    });

    // 이름으로 직접 조회해서 sn 확인
    console.log('\n=== 이름으로 소개자 찾기 ===\n');
    const names = ['김미영', '성노권', '윤영순', '김시현', '김영단', '장상훈', '황충실'];

    for (const name of names) {
        const result = await sql.query`
            SELECT sn, NAME, MAINDOCTOR
            FROM Customer
            WHERE NAME LIKE ${'%' + name + '%'}
            ORDER BY reg_date DESC
        `;
        console.log(`"${name}" 검색결과: ${result.recordset.length}건`);
        result.recordset.slice(0, 3).forEach(r => {
            console.log(`  [${r.sn}] ${r.NAME} | 담당: ${r.MAINDOCTOR || '없음'}`);
        });
    }

    await sql.close();
}

run().catch(console.error);
