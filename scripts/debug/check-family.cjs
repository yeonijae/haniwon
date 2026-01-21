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

    // 이원희 환자의 regFamily 확인
    console.log('=== 이원희(020345) regFamily 확인 ===\n');
    const wonhee = await sql.query`
        SELECT Customer_PK, sn, NAME, MAINDOCTOR, regFamily, SUGGEST
        FROM Customer
        WHERE sn = '020345'
    `;
    if (wonhee.recordset.length > 0) {
        const w = wonhee.recordset[0];
        console.log(`Customer_PK: ${w.Customer_PK}`);
        console.log(`sn: ${w.sn}`);
        console.log(`NAME: ${w.NAME}`);
        console.log(`MAINDOCTOR: ${w.MAINDOCTOR}`);
        console.log(`regFamily: ${w.regFamily}`);
        console.log(`SUGGEST: ${w.SUGGEST}`);
    }

    // regFamily 값으로 연결된 환자 확인
    console.log('\n=== regFamily(2313) 로 연결된 환자 찾기 ===\n');
    const familyResult = await sql.query`
        SELECT Customer_PK, sn, NAME, MAINDOCTOR, regFamily
        FROM Customer
        WHERE regFamily = 2313 OR Customer_PK = 2313
    `;
    familyResult.recordset.forEach(r => {
        console.log(`PK:${r.Customer_PK} | sn:${r.sn} | ${r.NAME} | 담당:${r.MAINDOCTOR || '없음'} | regFamily:${r.regFamily}`);
    });

    // 이연수 Customer_PK 확인
    console.log('\n=== 이연수(020186) Customer_PK 확인 ===\n');
    const yeonsu = await sql.query`
        SELECT Customer_PK, sn, NAME, regFamily, MAINDOCTOR
        FROM Customer
        WHERE sn = '020186'
    `;
    if (yeonsu.recordset.length > 0) {
        const y = yeonsu.recordset[0];
        console.log(`Customer_PK: ${y.Customer_PK}`);
        console.log(`sn: ${y.sn}`);
        console.log(`NAME: ${y.NAME}`);
        console.log(`regFamily: ${y.regFamily}`);
        console.log(`MAINDOCTOR: ${y.MAINDOCTOR}`);
    }

    await sql.close();
}
run().catch(console.error);
