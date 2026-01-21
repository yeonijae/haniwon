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

    // 임춘란(12782) 환자 기본 정보
    console.log('=== 임춘란(12782) 기본 정보 ===');
    const customer = await sql.query`
        SELECT Customer_PK, sn, NAME, MAINDOCTOR, SUGGEST, suggcustPK, suggcustnamesn, CustURL, regFamily,
               CONVERT(varchar, reg_date, 23) as reg_date
        FROM Customer
        WHERE sn = '012782'
    `;
    console.log(customer.recordset[0]);

    const custPK = customer.recordset[0]?.Customer_PK;

    if (custPK) {
        // 2025년 10월 강희종 원장의 약 처방 내역
        console.log('\n=== 2025년 10월 강희종 원장 약 처방 ===');
        const drugDetails = await sql.query`
            SELECT CONVERT(varchar, TxDate, 23) as tx_date, TxDoctor, PxName, TxMoney, InsuYes
            FROM Detail
            WHERE Customer_PK = ${custPK}
              AND TxDate >= '2025-10-01' AND TxDate < '2025-11-01'
              AND TxDoctor = '강희종'
              AND InsuYes = 0
            ORDER BY TxDate
        `;
        drugDetails.recordset.forEach(d => {
            console.log(`${d.tx_date} | ${d.TxDoctor} | ${d.PxName} | ${d.TxMoney}원`);
        });

        // 강희종 원장에게 첫 진료 날짜
        console.log('\n=== 강희종 원장 첫 진료일 ===');
        const firstVisit = await sql.query`
            SELECT MIN(CAST(TxDate AS DATE)) as first_visit
            FROM Detail
            WHERE Customer_PK = ${custPK} AND TxDoctor = '강희종'
        `;
        console.log('첫 진료일:', firstVisit.recordset[0]?.first_visit);

        // 2025년 10월 강희종 약 처방 첫 날짜
        console.log('\n=== 2025년 10월 강희종 약 처방 첫 날짜 ===');
        const firstDrug = await sql.query`
            SELECT MIN(CAST(TxDate AS DATE)) as first_drug
            FROM Detail
            WHERE Customer_PK = ${custPK}
              AND TxDate >= '2025-10-01' AND TxDate < '2025-11-01'
              AND TxDoctor = '강희종'
              AND InsuYes = 0
              AND (
                  PxName LIKE '한약%'
                  OR PxName LIKE '공진단%'
                  OR PxName LIKE '경옥고%'
                  OR PxName LIKE '녹용추가%'
                  OR PxName LIKE '린다%'
                  OR PxName LIKE '슬림환%'
                  OR PxName LIKE '%치료약%'
                  OR PxName LIKE '%종합진료비%'
                  OR PxName = '재처방'
                  OR PxName = '내원상담'
              )
        `;
        console.log('약 처방 첫 날짜:', firstDrug.recordset[0]?.first_drug);

        // 최근 6개월(2025-04 ~ 2025-09) 약 이력 확인
        console.log('\n=== 최근 6개월 약 이력 (2025-04 ~ 2025-09) ===');
        const recentDrug = await sql.query`
            SELECT CONVERT(varchar, TxDate, 23) as tx_date, TxDoctor, PxName, TxMoney
            FROM Detail
            WHERE Customer_PK = ${custPK}
              AND TxDate >= '2025-04-01' AND TxDate < '2025-10-01'
              AND InsuYes = 0
              AND (
                  PxName LIKE '한약%'
                  OR PxName LIKE '공진단%'
                  OR PxName LIKE '경옥고%'
                  OR PxName LIKE '녹용추가%'
                  OR PxName LIKE '린다%'
                  OR PxName LIKE '슬림환%'
                  OR PxName LIKE '%치료약%'
                  OR PxName LIKE '%종합진료비%'
                  OR PxName = '재처방'
                  OR PxName = '내원상담'
              )
            ORDER BY TxDate
        `;
        if (recentDrug.recordset.length > 0) {
            recentDrug.recordset.forEach(d => {
                console.log(`${d.tx_date} | ${d.TxDoctor} | ${d.PxName} | ${d.TxMoney}원`);
            });
        } else {
            console.log('없음');
        }

        // 전체 진료 이력 (강희종 이전)
        console.log('\n=== 강희종 원장 약 처방 전 전체 진료 이력 ===');
        const allHistory = await sql.query`
            SELECT CONVERT(varchar, TxDate, 23) as tx_date, TxDoctor, TxItem, PxName
            FROM Detail
            WHERE Customer_PK = ${custPK}
              AND TxDate < '2025-10-01'
            ORDER BY TxDate DESC
        `;
        console.log(`총 ${allHistory.recordset.length}건`);
        allHistory.recordset.slice(0, 20).forEach(d => {
            console.log(`${d.tx_date} | ${d.TxDoctor} | ${d.TxItem} | ${d.PxName}`);
        });
    }

    await sql.close();
}
run().catch(console.error);
