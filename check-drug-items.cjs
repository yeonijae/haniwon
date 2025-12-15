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

    // IsDrug=1이면서 InsuYes=0 (비급여)인 항목들의 PxName, DxName 확인
    console.log('=== IsDrug=1 & InsuYes=0 항목 상세 (2025년 12월) ===');
    const drugItems = await sql.query`
        SELECT TOP 30 TxItem, PxName, DxName, TxMoney, COUNT(*) as cnt
        FROM Detail
        WHERE TxDate >= '2025-12-01' AND IsDrug = 1 AND InsuYes = 0
        GROUP BY TxItem, PxName, DxName, TxMoney
        ORDER BY cnt DESC
    `;
    drugItems.recordset.forEach(d => {
        console.log(`${d.TxItem} | Px:${d.PxName || '-'} | Dx:${d.DxName || '-'} | ${d.TxMoney}원 (${d.cnt}건)`);
    });

    // 이원희 등록일(2025-12-08)의 Detail 상세
    console.log('\n=== 이원희(020345) 등록일 2025-12-08 Detail 상세 ===');
    const wonhee = await sql.query`
        SELECT TxItem, PxCode, PxName, DxName, IsDrug, InsuYes, TxMoney
        FROM Detail
        WHERE Customer_PK = 24308 AND CONVERT(varchar, TxDate, 23) = '2025-12-08'
    `;
    wonhee.recordset.forEach(d => {
        console.log(`${d.TxItem} | PxCode:${d.PxCode} | Px:${d.PxName || '-'} | Dx:${d.DxName || '-'} | IsDrug:${d.IsDrug} | ${d.TxMoney}원`);
    });

    // 이지형 등록일(2025-12-03)의 Detail 상세
    console.log('\n=== 이지형(020318) 등록일 2025-12-03 Detail 상세 ===');
    const jihyung = await sql.query`
        SELECT TxItem, PxCode, PxName, DxName, IsDrug, InsuYes, TxMoney
        FROM Detail
        WHERE Customer_PK = 24280 AND CONVERT(varchar, TxDate, 23) = '2025-12-03'
    `;
    jihyung.recordset.forEach(d => {
        console.log(`${d.TxItem} | PxCode:${d.PxCode} | Px:${d.PxName || '-'} | Dx:${d.DxName || '-'} | IsDrug:${d.IsDrug} | ${d.TxMoney}원`);
    });

    await sql.close();
}
run().catch(console.error);
