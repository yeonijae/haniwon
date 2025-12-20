import sql from 'mssql';

const config = {
  server: '192.168.0.173',
  user: 'members',
  password: 'msp1234',
  port: 55555,
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true,
    connectTimeout: 15000,
  }
};

async function testDetailComments() {
  const pool = await sql.connect(config);

  // DetailComment에서 날짜별 진료메모 여러건 조회
  console.log('=== DetailComment 날짜별 조회 (환자 21954) ===');
  const comments = await pool.request().query(`
    SELECT TOP 10 Customer_PK, TxDate, Comment1, Comment2
    FROM MasterDB.dbo.DetailComment
    WHERE Customer_PK = 21954
    ORDER BY TxDate DESC
  `);

  comments.recordset.forEach((r, i) => {
    const date = r.TxDate ? r.TxDate.toISOString().split('T')[0] : 'null';
    console.log(`\n[${i+1}] ${date}`);
    console.log(`  Comment1: ${(r.Comment1 || '(없음)').substring(0, 150)}...`);
    console.log(`  Comment2: ${(r.Comment2 || '(없음)').substring(0, 150)}...`);
  });

  console.log('\n\n=== 환자 기본정보 (21954) ===');
  const patient = await pool.request().query(`
    SELECT name, birth, sex, sn, MAINDISEASE, NOTEFORDOC, NOTEFORNURSE, ETCMemo
    FROM Customer
    WHERE Customer_PK = 21954
  `);

  if (patient.recordset[0]) {
    const p = patient.recordset[0];
    console.log(`이름: ${p.name}`);
    console.log(`생년월일: ${p.birth}`);
    console.log(`성별: ${p.sex ? '남' : '여'}`);
    console.log(`차트번호: ${p.sn}`);
    console.log(`주소증: ${(p.MAINDISEASE || '(없음)').substring(0, 100)}`);
    console.log(`주치의메모: ${(p.NOTEFORDOC || '(없음)').substring(0, 100)}`);
    console.log(`간호사메모: ${(p.NOTEFORNURSE || '(없음)').substring(0, 100)}`);
    console.log(`기타메모: ${(p.ETCMemo || '(없음)').substring(0, 100)}`);
  }

  await pool.close();
}

testDetailComments().catch(console.error);
