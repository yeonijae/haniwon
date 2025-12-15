const sql = require('mssql');

const config = {
  server: '192.168.0.173',
  port: 55555,
  database: 'MasterDB',
  user: 'members',
  password: 'msp1234',
  options: {
    encrypt: false,
    trustServerCertificate: true
  }
};

async function main() {
  try {
    await sql.connect(config);
    console.log('MasterDB 연결 성공!');

    const targetDate = '2025-12-08';

    console.log(`\n=== ${targetDate} 현장예약 분석 ===\n`);

    // 1. 내원한 전체 환자수 (Receipt 기준)
    const totalPatients = await sql.query`
      SELECT COUNT(DISTINCT Customer_PK) as cnt
      FROM Receipt
      WHERE CAST(TxDate AS DATE) = ${targetDate}
    `;
    console.log(`1. 내원한 전체 환자수: ${totalPatients.recordset[0].cnt}명`);

    // 2. 침치료 받은 환자수 (자보 + 청구금 > 0)
    const acuPatients = await sql.query`
      SELECT DISTINCT r.Customer_PK, r.Customer_name, r.CheongGu_Money,
        CASE
          WHEN EXISTS (
            SELECT 1 FROM Detail d
            WHERE d.Customer_PK = r.Customer_PK
              AND CAST(d.TxDate AS DATE) = ${targetDate}
              AND d.TxItem LIKE '%자동차보험%'
          ) THEN '자보'
          WHEN ISNULL(r.CheongGu_Money, 0) > 0 THEN '건보침치료'
          ELSE '기타'
        END as patient_type
      FROM Receipt r
      WHERE CAST(r.TxDate AS DATE) = ${targetDate}
        AND (
          EXISTS (
            SELECT 1 FROM Detail d
            WHERE d.Customer_PK = r.Customer_PK
              AND CAST(d.TxDate AS DATE) = ${targetDate}
              AND d.TxItem LIKE '%자동차보험%'
          )
          OR ISNULL(r.CheongGu_Money, 0) > 0
        )
    `;
    const acuCount = acuPatients.recordset.length;
    const jaboCount = acuPatients.recordset.filter(p => p.patient_type === '자보').length;
    const gunboCount = acuPatients.recordset.filter(p => p.patient_type === '건보침치료').length;
    console.log(`2. 침치료 받은 환자수: ${acuCount}명 (자보: ${jaboCount}명, 건보침치료: ${gunboCount}명)`);

    // 3. 내원 환자 중 해당 날짜에 미래 예약을 잡은 환자수
    const allPatientIds = await sql.query`
      SELECT DISTINCT Customer_PK FROM Receipt WHERE CAST(TxDate AS DATE) = ${targetDate}
    `;
    const patientIds = allPatientIds.recordset.map(r => r.Customer_PK);

    if (patientIds.length > 0) {
      const placeholders = patientIds.map(() => '?').join(',');
      const reservedPatients = await sql.query(
        `SELECT DISTINCT Res_Customer_PK as patient_id, Res_Date, Res_Name
         FROM Reservation_New
         WHERE CAST(Res_updatetime AS DATE) = '${targetDate}'
           AND Res_Date > '${targetDate}'
           AND Res_Canceled = 0
           AND Res_Customer_PK IN (${patientIds.join(',')})`
      );
      console.log(`3. 내원 환자 중 ${targetDate}에 예약 잡은 환자수: ${reservedPatients.recordset.length}명`);

      // 4. 침치료 환자 중 해당 날짜에 예약 잡은 환자수
      const acuPatientIds = acuPatients.recordset.map(p => p.Customer_PK);
      const acuReserved = reservedPatients.recordset.filter(r => acuPatientIds.includes(r.patient_id));
      console.log(`4. 침치료 환자 중 ${targetDate}에 예약 잡은 환자수: ${acuReserved.length}명`);

      console.log(`\n=== 현장예약율 ===`);
      console.log(`전체 기준: ${reservedPatients.recordset.length}/${totalPatients.recordset[0].cnt} = ${Math.round(reservedPatients.recordset.length / totalPatients.recordset[0].cnt * 100)}%`);
      console.log(`침치료 기준: ${acuReserved.length}/${acuCount} = ${Math.round(acuReserved.length / acuCount * 100)}%`);

      // 상세 목록
      console.log(`\n=== 침치료 환자 목록 ===`);
      acuPatients.recordset.forEach((p, i) => {
        const hasReservation = acuReserved.some(r => r.patient_id === p.Customer_PK);
        console.log(`${i+1}. ${p.Customer_name} (${p.patient_type}, 청구금: ${p.CheongGu_Money || 0}) - 예약: ${hasReservation ? 'O' : 'X'}`);
      });
    }

    await sql.close();
  } catch (err) {
    console.error('Error:', err.message);
  }
}

main();
