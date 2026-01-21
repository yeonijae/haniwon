const sql = require('mssql');

const config = {
    server: '192.168.0.173',
    port: 55555,
    user: 'members',
    password: 'msp1234',
    database: 'MasterDB',
    options: {
        encrypt: false,
        trustServerCertificate: true
    }
};

async function test() {
    try {
        await sql.connect(config);
        console.log('Connected to MasterDB');

        const start_date = '2025-12-14';
        const end_date = '2025-12-14';

        // 1-1. 침초진 쿼리 테스트
        console.log('\n=== 침초진 쿼리 테스트 ===');
        const result = await sql.query`
            SELECT COUNT(DISTINCT c.Customer_PK) as cnt
            FROM Customer c
            JOIN Receipt r ON c.Customer_PK = r.Customer_PK
            WHERE CAST(c.reg_date AS DATE) BETWEEN ${start_date} AND ${end_date}
              AND CAST(r.TxDate AS DATE) = CAST(c.reg_date AS DATE)
              AND ISNULL(r.CheongGu_Money, 0) > 0
              AND NOT EXISTS (
                SELECT 1 FROM Detail d
                WHERE d.Customer_PK = c.Customer_PK
                AND CAST(d.TxDate AS DATE) = CAST(c.reg_date AS DATE)
                AND d.TxItem LIKE '%자동차보험%'
              )
        `;
        console.log('침초진:', result.recordset[0].cnt);

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await sql.close();
    }
}

test();
