/**
 * Supabase에서 복용법 템플릿을 SQLite로 마이그레이션
 * 사용법: node scripts/migrate-dosage-instructions.js
 */

const SUPABASE_URL = 'https://vipyakvxzfccytwjaqet.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpcHlha3Z4emZjY3l0d2phcWV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI5NTc2MjUsImV4cCI6MjA3ODUzMzYyNX0.xuR3LxaR69t1RGB74G3FtlBIoxelfAH6fdZrnZSjHfQ';
const SQLITE_API_URL = 'http://192.168.0.173:3200';

async function fetchFromSupabase(table, select = '*') {
  const url = `${SUPABASE_URL}/rest/v1/${table}?select=${select}`;
  const res = await fetch(url, {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
    }
  });
  if (!res.ok) {
    throw new Error(`Supabase fetch failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

async function executeSql(sql) {
  try {
    const res = await fetch(`${SQLITE_API_URL}/api/sqlite/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql })
    });
    const data = await res.json();
    return !data.error;
  } catch (error) {
    console.error('SQL Error:', error.message);
    return false;
  }
}

function escapeStr(str) {
  if (str === null || str === undefined || str === '') return 'NULL';
  return "'" + String(str).replace(/'/g, "''") + "'";
}

async function main() {
  console.log('Supabase에서 복용법 템플릿 가져오는 중...');

  try {
    // 1. Supabase에서 복용법 템플릿 가져오기
    const instructions = await fetchFromSupabase('dosage_instructions');
    console.log(`Supabase에서 ${instructions.length}개 복용법 템플릿 로드됨`);

    // 2. SQLite 테이블 확인 및 생성
    console.log('\nSQLite 테이블 확인 중...');
    await executeSql(`
      CREATE TABLE IF NOT EXISTS dosage_instructions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category TEXT NOT NULL,
        subcategory TEXT,
        disease_name TEXT NOT NULL,
        condition_detail TEXT,
        description TEXT,
        dosage_method TEXT,
        precautions TEXT,
        keywords TEXT,
        full_text TEXT,
        source_filename TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `);

    // 인덱스 생성
    await executeSql(`CREATE INDEX IF NOT EXISTS idx_dosage_instructions_category ON dosage_instructions(category)`);
    await executeSql(`CREATE INDEX IF NOT EXISTS idx_dosage_instructions_disease ON dosage_instructions(disease_name)`);

    // 3. 기존 데이터 삭제 후 새로 삽입
    console.log('기존 데이터 삭제 중...');
    await executeSql('DELETE FROM dosage_instructions');

    // 4. SQLite로 마이그레이션
    console.log('SQLite로 마이그레이션 중...');
    let success = 0;
    let failed = 0;

    for (const item of instructions) {
      // keywords 배열을 JSON 문자열로 변환
      const keywordsStr = item.keywords ? JSON.stringify(item.keywords) : null;

      const insertSql = `INSERT INTO dosage_instructions (
        category, subcategory, disease_name, condition_detail,
        description, dosage_method, precautions, keywords,
        full_text, source_filename, created_at, updated_at
      ) VALUES (
        ${escapeStr(item.category)},
        ${escapeStr(item.subcategory)},
        ${escapeStr(item.disease_name)},
        ${escapeStr(item.condition_detail)},
        ${escapeStr(item.description)},
        ${escapeStr(item.dosage_method)},
        ${escapeStr(item.precautions)},
        ${escapeStr(keywordsStr)},
        ${escapeStr(item.full_text)},
        ${escapeStr(item.source_filename)},
        ${escapeStr(item.created_at)},
        ${escapeStr(item.updated_at)}
      )`;

      const result = await executeSql(insertSql);
      if (result) {
        success++;
        process.stdout.write(`\r처리 중: ${success}/${instructions.length}`);
      } else {
        failed++;
        console.log(`\n실패: ${item.disease_name} - ${item.condition_detail}`);
      }
    }

    console.log(`\n\n마이그레이션 완료!`);
    console.log(`- 성공: ${success}개`);
    console.log(`- 실패: ${failed}개`);

  } catch (error) {
    console.error('마이그레이션 실패:', error.message);
  }
}

main();
