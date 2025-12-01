import sql from 'mssql';
import * as fs from 'fs';
import * as path from 'path';

// MSSQL 연결 설정
const config: sql.config = {
  user: 'your_username',        // Read-only 계정명
  password: 'your_password',    // 비밀번호
  server: '192.168.0.100',      // MSSQL 서버 IP
  database: 'YourDatabase',     // 데이터베이스명
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
  port: 1433,
};

async function exportReceiptToCSV() {
  let pool: sql.ConnectionPool | null = null;

  try {
    console.log('MSSQL 연결 중...');
    pool = await sql.connect(config);
    console.log('연결 성공!');

    // 최근 100개 데이터 조회 (테이블명과 컬럼명은 실제 EMR에 맞게 수정)
    const result = await pool.request().query(`
      SELECT TOP 100 *
      FROM receipt
      ORDER BY receipt_date DESC
    `);

    if (result.recordset.length === 0) {
      console.log('데이터가 없습니다.');
      return;
    }

    console.log(`${result.recordset.length}건 조회됨`);

    // CSV 변환
    const records = result.recordset;
    const headers = Object.keys(records[0]);

    // CSV 헤더
    let csv = headers.join(',') + '\n';

    // CSV 데이터
    for (const row of records) {
      const values = headers.map(header => {
        let value = row[header];

        // null 처리
        if (value === null || value === undefined) {
          return '';
        }

        // 날짜 처리
        if (value instanceof Date) {
          value = value.toISOString();
        }

        // 문자열 변환 및 이스케이프
        const strValue = String(value);

        // 쉼표, 줄바꿈, 따옴표가 있으면 따옴표로 감싸기
        if (strValue.includes(',') || strValue.includes('\n') || strValue.includes('"')) {
          return `"${strValue.replace(/"/g, '""')}"`;
        }

        return strValue;
      });

      csv += values.join(',') + '\n';
    }

    // 파일 저장
    const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const filename = `receipt_${timestamp}.csv`;
    const filepath = path.join(__dirname, '..', 'exports', filename);

    // exports 폴더 생성
    const exportsDir = path.join(__dirname, '..', 'exports');
    if (!fs.existsSync(exportsDir)) {
      fs.mkdirSync(exportsDir, { recursive: true });
    }

    // UTF-8 BOM 추가 (엑셀에서 한글 깨짐 방지)
    const BOM = '\uFEFF';
    fs.writeFileSync(filepath, BOM + csv, 'utf-8');

    console.log(`CSV 저장 완료: ${filepath}`);

  } catch (err) {
    console.error('오류 발생:', err);
  } finally {
    if (pool) {
      await pool.close();
      console.log('연결 종료');
    }
  }
}

// 실행
exportReceiptToCSV();
