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

    // 2025년 12월 약초진 환자 이원희(020345)의 Detail 확인
    console.log('=== 이원희(020345) Detail 항목 ===');
    const detail1 = await sql.query`
        SELECT CONVERT(varchar, TxDate, 23) as TxDate, TxItem, IsDrug, InsuYes, IsYakChim, TxMoney, TxDoctor
        FROM Detail
        WHERE Customer_PK = 24308
        ORDER BY TxDate
    `;
    detail1.recordset.forEach(d => {
        console.log(`${d.TxDate} | ${d.TxItem} | IsDrug:${d.IsDrug} | InsuYes:${d.InsuYes} | 약침:${d.IsYakChim} | ${d.TxMoney}원`);
    });

    // 이지형(020318) Detail 확인
    console.log('\n=== 이지형(020318) Detail 항목 ===');
    const detail2 = await sql.query`
        SELECT CONVERT(varchar, TxDate, 23) as TxDate, TxItem, IsDrug, InsuYes, IsYakChim, TxMoney, TxDoctor
        FROM Detail
        WHERE Customer_PK = 24280
        ORDER BY TxDate
    `;
    detail2.recordset.forEach(d => {
        console.log(`${d.TxDate} | ${d.TxItem} | IsDrug:${d.IsDrug} | InsuYes:${d.InsuYes} | 약침:${d.IsYakChim} | ${d.TxMoney}원`);
    });

    // IsDrug 값 분포 확인
    console.log('\n=== IsDrug 값 분포 (2025년 12월) ===');
    const drugDist = await sql.query`
        SELECT IsDrug, COUNT(*) as cnt
        FROM Detail
        WHERE TxDate >= '2025-12-01'
        GROUP BY IsDrug
        ORDER BY IsDrug
    `;
    drugDist.recordset.forEach(d => {
        console.log(`IsDrug=${d.IsDrug}: ${d.cnt}건`);
    });

    // IsDrug=1인 샘플 항목들 확인
    console.log('\n=== IsDrug=1 샘플 항목 ===');
    const drugSample = await sql.query`
        SELECT TOP 20 TxItem, COUNT(*) as cnt
        FROM Detail
        WHERE TxDate >= '2025-12-01' AND IsDrug = 1
        GROUP BY TxItem
        ORDER BY cnt DESC
    `;
    drugSample.recordset.forEach(d => {
        console.log(`${d.TxItem}: ${d.cnt}건`);
    });

    // InsuYes=0 (비급여) 샘플 항목들 확인
    console.log('\n=== InsuYes=0 (비급여) 샘플 항목 ===');
    const nonInsuSample = await sql.query`
        SELECT TOP 20 TxItem, IsDrug, COUNT(*) as cnt
        FROM Detail
        WHERE TxDate >= '2025-12-01' AND InsuYes = 0
        GROUP BY TxItem, IsDrug
        ORDER BY cnt DESC
    `;
    nonInsuSample.recordset.forEach(d => {
        console.log(`${d.TxItem} (IsDrug:${d.IsDrug}): ${d.cnt}건`);
    });

    await sql.close();
}
run().catch(console.error);
