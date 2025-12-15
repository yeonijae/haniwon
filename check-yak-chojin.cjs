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

    const startDate = '2025-11-01';
    const endDate = '2025-11-30';

    console.log(`\n=== 25년 11월 약초진 Raw Data ===\n`);

    // 1. 약초진 (신규등록 + 청구금0 + 비급여 > 0)
    console.log('--- [약초진] 신규환자 약 구입 ---');
    const newYak = await sql.query`
        SELECT
            c.Customer_PK,
            c.sn as chart_no,
            c.NAME as patient_name,
            c.MAINDOCTOR as main_doctor,
            c.SUGGEST as suggest,
            c.CustURL as cust_url,
            CONVERT(varchar, c.reg_date, 23) as reg_date,
            d.TxDoctor as tx_doctor
        FROM Customer c
        INNER JOIN Receipt r ON c.Customer_PK = r.Customer_PK
            AND CAST(r.TxDate AS DATE) = CAST(c.reg_date AS DATE)
        INNER JOIN Detail d ON c.Customer_PK = d.Customer_PK
            AND CAST(d.TxDate AS DATE) = CAST(c.reg_date AS DATE)
        WHERE c.reg_date >= ${startDate} AND c.reg_date < DATEADD(DAY, 1, ${endDate})
          AND r.CheongGu_Money = 0
          AND r.General_Money > 0
          AND d.TxItem NOT LIKE '%자동차보험%'
          AND d.TxDoctor IS NOT NULL AND d.TxDoctor != ''
        GROUP BY c.Customer_PK, c.sn, c.NAME, c.MAINDOCTOR, c.SUGGEST, c.CustURL, c.reg_date, d.TxDoctor
        ORDER BY c.reg_date, c.sn
    `;

    console.log(`총 ${newYak.recordset.length}건\n`);
    newYak.recordset.forEach((r, i) => {
        const suggest = (r.suggest || '').trim();
        const custUrl = (r.cust_url || '').trim();
        const isReferral = suggest.includes('소개');

        // 분류 판단
        let category = '';
        if (!isReferral) {
            category = '약생초';
        } else {
            const chartMatch = custUrl.match(/(\d{4,})/);
            category = chartMatch ? `소개(차트:${chartMatch[1]})` : '소개(차트없음)';
        }

        console.log(`${i+1}. [${r.chart_no}] ${r.patient_name} | 진료:${r.tx_doctor} | 등록일:${r.reg_date}`);
        console.log(`   SUGGEST: "${suggest}" | CustURL: "${custUrl}"`);
        console.log(`   → 분류: ${category}\n`);
    });

    // 2. 약재초진 (기존환자가 한약 처음 구입)
    console.log('\n--- [약재초진] 기존환자 첫 약 구입 ---');
    const existingYak = await sql.query`
        SELECT
            c.Customer_PK,
            c.sn as chart_no,
            c.NAME as patient_name,
            c.MAINDOCTOR as main_doctor,
            d.TxDoctor as tx_doctor,
            CONVERT(varchar, r.TxDate, 23) as tx_date
        FROM Customer c
        INNER JOIN Receipt r ON c.Customer_PK = r.Customer_PK
        INNER JOIN Detail d ON c.Customer_PK = d.Customer_PK
            AND CAST(d.TxDate AS DATE) = CAST(r.TxDate AS DATE)
        WHERE CAST(r.TxDate AS DATE) >= ${startDate} AND CAST(r.TxDate AS DATE) < DATEADD(DAY, 1, ${endDate})
          AND CAST(c.reg_date AS DATE) < ${startDate}
          AND r.CheongGu_Money = 0
          AND r.General_Money > 0
          AND d.TxItem NOT LIKE '%자동차보험%'
          AND d.TxDoctor IS NOT NULL AND d.TxDoctor != ''
          AND NOT EXISTS (
            SELECT 1 FROM Receipt r2
            WHERE r2.Customer_PK = c.Customer_PK
              AND CAST(r2.TxDate AS DATE) < ${startDate}
              AND r2.CheongGu_Money = 0
              AND r2.General_Money > 0
          )
        GROUP BY c.Customer_PK, c.sn, c.NAME, c.MAINDOCTOR, d.TxDoctor, r.TxDate
        ORDER BY r.TxDate, c.sn
    `;

    console.log(`총 ${existingYak.recordset.length}건\n`);
    existingYak.recordset.forEach((r, i) => {
        const mainDoc = r.main_doctor || '';
        const category = mainDoc === r.tx_doctor ? '기존-담당' : '기존-다른';

        console.log(`${i+1}. [${r.chart_no}] ${r.patient_name} | 담당:${mainDoc} | 진료:${r.tx_doctor} | 진료일:${r.tx_date}`);
        console.log(`   → 분류: ${category}\n`);
    });

    // 3. 소개자 차트번호 조회 (신규환자 중 소개로 온 환자의 소개자)
    // CustURL 형식: "이름님(차트번호)관계"
    const referrerCharts = new Set();
    newYak.recordset.forEach(r => {
        const suggest = (r.suggest || '').trim();
        const custUrl = (r.cust_url || '').trim();
        if (suggest.includes('소개')) {
            // 괄호 안의 숫자 추출 (1~6자리)
            const chartMatch = custUrl.match(/\((\d{1,6})\)/);
            if (chartMatch) {
                // 6자리 0패딩
                referrerCharts.add(chartMatch[1].padStart(6, '0'));
            }
        }
    });

    if (referrerCharts.size > 0) {
        console.log('\n--- 소개자 정보 조회 ---');
        const chartsArray = Array.from(referrerCharts);
        const chartsIn = chartsArray.map(c => `'${c}'`).join(',');

        const referrers = await sql.query(`
            SELECT sn, NAME, MAINDOCTOR
            FROM Customer
            WHERE sn IN (${chartsIn})
        `);

        console.log(`소개자 ${referrers.recordset.length}명 찾음:\n`);
        referrers.recordset.forEach(r => {
            console.log(`  차트:${r.sn} | 이름:${r.NAME} | 담당:${r.MAINDOCTOR || '없음'}`);
        });
    }

    await sql.close();
}

run().catch(console.error);
