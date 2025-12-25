/**
 * 검사결과 관리 테이블 생성 스크립트
 * 사용법: node scripts/init-exam-tables.js
 */

const SQLITE_API_URL = 'http://192.168.0.173:3200';

async function executeSql(sql, description) {
  try {
    const res = await fetch(`${SQLITE_API_URL}/api/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql })
    });
    const data = await res.json();
    if (data.error) {
      console.log(`❌ ${description}: ${data.error}`);
      return false;
    }
    console.log(`✅ ${description}`);
    return true;
  } catch (error) {
    console.log(`❌ ${description}: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('='.repeat(50));
  console.log('검사결과 관리 테이블 생성');
  console.log('='.repeat(50));
  console.log('');

  // 1. exam_results 테이블
  await executeSql(`
    CREATE TABLE IF NOT EXISTS exam_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER NOT NULL,
      exam_date DATE NOT NULL,
      exam_type TEXT NOT NULL,
      exam_name TEXT,
      findings TEXT,
      memo TEXT,
      doctor_name TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `, 'exam_results 테이블 생성');

  // 2. exam_attachments 테이블
  await executeSql(`
    CREATE TABLE IF NOT EXISTS exam_attachments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      exam_result_id INTEGER NOT NULL,
      file_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_size INTEGER,
      mime_type TEXT,
      thumbnail_path TEXT,
      sort_order INTEGER DEFAULT 0,
      uploaded_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(exam_result_id) REFERENCES exam_results(id) ON DELETE CASCADE
    )
  `, 'exam_attachments 테이블 생성');

  // 3. exam_values 테이블 (수치 데이터)
  await executeSql(`
    CREATE TABLE IF NOT EXISTS exam_values (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      exam_result_id INTEGER NOT NULL,
      item_name TEXT NOT NULL,
      item_value REAL,
      unit TEXT,
      reference_min REAL,
      reference_max REAL,
      FOREIGN KEY(exam_result_id) REFERENCES exam_results(id) ON DELETE CASCADE
    )
  `, 'exam_values 테이블 생성');

  console.log('');
  console.log('인덱스 생성 중...');

  // 인덱스 생성
  await executeSql(
    `CREATE INDEX IF NOT EXISTS idx_exam_results_patient ON exam_results(patient_id)`,
    'idx_exam_results_patient'
  );
  await executeSql(
    `CREATE INDEX IF NOT EXISTS idx_exam_results_date ON exam_results(exam_date)`,
    'idx_exam_results_date'
  );
  await executeSql(
    `CREATE INDEX IF NOT EXISTS idx_exam_results_type ON exam_results(exam_type)`,
    'idx_exam_results_type'
  );
  await executeSql(
    `CREATE INDEX IF NOT EXISTS idx_exam_attachments_result ON exam_attachments(exam_result_id)`,
    'idx_exam_attachments_result'
  );
  await executeSql(
    `CREATE INDEX IF NOT EXISTS idx_exam_values_result ON exam_values(exam_result_id)`,
    'idx_exam_values_result'
  );

  console.log('');
  console.log('='.repeat(50));
  console.log('테이블 생성 완료!');
  console.log('='.repeat(50));

  // 테이블 확인
  console.log('');
  console.log('생성된 테이블 확인:');

  const tablesRes = await fetch(`${SQLITE_API_URL}/api/tables`);
  const tablesData = await tablesRes.json();

  const examTables = tablesData.tables?.filter(t => t.startsWith('exam_')) || [];
  examTables.forEach(t => console.log(`  - ${t}`));
}

main().catch(console.error);
