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

    // 이지형(020318) 환자 정보 조회
    console.log('=== 이지형(020318) 환자 정보 ===\n');
    const patient = await sql.query`
        SELECT sn, NAME, MAINDOCTOR, SUGGEST, CustURL, reg_date
        FROM Customer
        WHERE sn = '020318'
    `;

    if (patient.recordset.length > 0) {
        const p = patient.recordset[0];
        console.log(`차트: ${p.sn}`);
        console.log(`이름: ${p.NAME}`);
        console.log(`담당: ${p.MAINDOCTOR}`);
        console.log(`SUGGEST: "${p.SUGGEST}"`);
        console.log(`CustURL: "${p.CustURL}"`);
        console.log(`등록일: ${p.reg_date}`);
    }

    // 소개자 조한애(014846) 정보 조회
    console.log('\n=== 조한애(014846) 소개자 정보 ===\n');
    const referrer = await sql.query`
        SELECT sn, NAME, MAINDOCTOR
        FROM Customer
        WHERE sn = '014846'
    `;

    if (referrer.recordset.length > 0) {
        const r = referrer.recordset[0];
        console.log(`차트: ${r.sn}`);
        console.log(`이름: ${r.NAME}`);
        console.log(`담당: ${r.MAINDOCTOR}`);
    }

    // CustURL에서 차트번호 추출 테스트
    console.log('\n=== 차트번호 추출 테스트 ===\n');
    if (patient.recordset.length > 0) {
        const custUrl = patient.recordset[0].CustURL || '';
        console.log(`CustURL: "${custUrl}"`);

        // 괄호 안 숫자 패턴
        const match1 = custUrl.match(/\((\d{1,6})\)/);
        console.log(`\\(\\d{1,6}\\) 매칭: ${match1 ? match1[1] : '없음'}`);

        // 일반 숫자 패턴
        const match2 = custUrl.match(/(\d{4,})/);
        console.log(`\\d{4,} 매칭: ${match2 ? match2[1] : '없음'}`);
    }

    await sql.close();
}

run().catch(console.error);
