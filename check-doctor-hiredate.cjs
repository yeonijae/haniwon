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

    // UserTable 전체 조회
    console.log('=== UserTable 전체 데이터 ===');
    const all = await sql.query`
        SELECT UserID, RegNum, doctorname, usergubun, 근무기간시작, 근무기간종료, 퇴사여부
        FROM UserTable
        ORDER BY 근무기간시작 ASC
    `;
    all.recordset.forEach(d => {
        console.log(`${d.UserID} | Reg:${d.RegNum} | doctor:${d.doctorname || '-'} | 구분:${d.usergubun} | 시작:${d.근무기간시작 || '-'} | 종료:${d.근무기간종료 || '-'} | 퇴사:${d.퇴사여부}`);
    });

    // MasterDB의 Doctor 테이블도 확인
    console.log('\n=== MasterDB.Doctor 테이블 확인 ===');
    await sql.close();

    const configMaster = { ...config, database: 'MasterDB' };
    await sql.connect(configMaster);

    // Doctor 테이블 존재 여부 확인
    const tables = await sql.query`
        SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_NAME LIKE '%doctor%' OR TABLE_NAME LIKE '%Doctor%' OR TABLE_NAME LIKE '%원장%'
    `;
    console.log('Doctor 관련 테이블:');
    tables.recordset.forEach(t => console.log(`  - ${t.TABLE_NAME}`));

    await sql.close();
}
run().catch(console.error);
