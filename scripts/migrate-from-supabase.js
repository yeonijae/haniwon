/**
 * Supabase에서 처방 데이터를 가져와서 SQLite로 마이그레이션
 * 사용법: node scripts/migrate-from-supabase.js
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
  console.log('Supabase에서 처방 데이터 가져오는 중...');

  try {
    // 1. Supabase에서 처방 정의 가져오기
    const prescriptions = await fetchFromSupabase('prescription_definitions');
    console.log(`Supabase에서 ${prescriptions.length}개 처방 로드됨`);

    // 2. SQLite로 마이그레이션
    console.log('SQLite로 마이그레이션 중...');
    let success = 0;
    let failed = 0;

    for (const p of prescriptions) {
      // 먼저 UPDATE 시도
      const updateSql = `UPDATE prescription_definitions SET
        alias = ${escapeStr(p.alias)},
        category = ${escapeStr(p.category)},
        source = ${escapeStr(p.source)},
        composition = ${escapeStr(p.composition)},
        description = ${escapeStr(p.description)},
        is_active = ${p.is_active ? 1 : 0}
      WHERE name = ${escapeStr(p.name)}`;

      await executeSql(updateSql);

      // INSERT OR IGNORE로 새 항목 추가
      const insertSql = `INSERT OR IGNORE INTO prescription_definitions
        (name, alias, category, source, composition, description, is_active)
      VALUES (
        ${escapeStr(p.name)},
        ${escapeStr(p.alias)},
        ${escapeStr(p.category)},
        ${escapeStr(p.source)},
        ${escapeStr(p.composition)},
        ${escapeStr(p.description)},
        ${p.is_active ? 1 : 0}
      )`;

      const result = await executeSql(insertSql);
      if (result) {
        success++;
        process.stdout.write(`\r처리 중: ${success}/${prescriptions.length}`);
      } else {
        failed++;
      }
    }

    console.log(`\n\n마이그레이션 완료!`);
    console.log(`- 성공: ${success}개`);
    console.log(`- 실패: ${failed}개`);

    // 3. 카테고리도 가져오기
    console.log('\n카테고리 마이그레이션 중...');
    try {
      const categories = await fetchFromSupabase('prescription_categories');
      console.log(`Supabase에서 ${categories.length}개 카테고리 로드됨`);

      for (const c of categories) {
        const insertCatSql = `INSERT OR IGNORE INTO prescription_categories (name, sort_order)
          VALUES (${escapeStr(c.name)}, ${c.sort_order || 0})`;
        await executeSql(insertCatSql);
      }
      console.log('카테고리 마이그레이션 완료!');
    } catch (e) {
      console.log('카테고리 테이블이 없거나 접근 불가:', e.message);
    }

  } catch (error) {
    console.error('마이그레이션 실패:', error.message);
  }
}

main();
