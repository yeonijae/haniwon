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

async function checkColumns() {
    try {
        await sql.connect(config);
        console.log('Connected to MasterDB');

        // Customer 테이블 컬럼 확인
        console.log('\n=== Customer 테이블 컬럼 ===');
        const customerCols = await sql.query`
            SELECT COLUMN_NAME, DATA_TYPE
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = 'Customer'
            ORDER BY ORDINAL_POSITION
        `;
        customerCols.recordset.forEach(c => {
            console.log(`  ${c.COLUMN_NAME} (${c.DATA_TYPE})`);
        });

        // Receipt 테이블 컬럼 확인
        console.log('\n=== Receipt 테이블 컬럼 ===');
        const receiptCols = await sql.query`
            SELECT COLUMN_NAME, DATA_TYPE
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = 'Receipt'
            ORDER BY ORDINAL_POSITION
        `;
        receiptCols.recordset.forEach(c => {
            console.log(`  ${c.COLUMN_NAME} (${c.DATA_TYPE})`);
        });

        // Detail 테이블 컬럼 확인
        console.log('\n=== Detail 테이블 컬럼 ===');
        const detailCols = await sql.query`
            SELECT COLUMN_NAME, DATA_TYPE
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = 'Detail'
            ORDER BY ORDINAL_POSITION
        `;
        detailCols.recordset.forEach(c => {
            console.log(`  ${c.COLUMN_NAME} (${c.DATA_TYPE})`);
        });

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await sql.close();
    }
}

checkColumns();
