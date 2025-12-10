/**
 * Supabase → SQLite 데이터 마이그레이션 스크립트
 * 실행: node scripts/migrate-supabase-to-sqlite.js
 */

const SUPABASE_URL = 'https://vipyakvxzfccytwjaqet.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpcHlha3Z4emZjY3l0d2phcWV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI5NTc2MjUsImV4cCI6MjA3ODUzMzYyNX0.xuR3LxaR69t1RGB74G3FtlBIoxelfAH6fdZrnZSjHfQ';
const SQLITE_API_URL = 'http://192.168.0.173:3200';

// 딜레이 함수
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Supabase에서 데이터 가져오기
async function fetchFromSupabase(table) {
  const url = `${SUPABASE_URL}/rest/v1/${table}?select=*`;
  const response = await fetch(url, {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    },
  });

  if (!response.ok) {
    console.log(`  ⚠️ ${table}: ${response.status}`);
    return [];
  }

  return response.json();
}

// SQLite에 SQL 실행
async function executeSQL(sql) {
  const response = await fetch(`${SQLITE_API_URL}/api/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql }),
  });

  const result = await response.json();
  if (result.error) {
    throw new Error(result.error);
  }
  return result;
}

// 값을 SQL 형식으로 변환
function toSqlValue(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? '1' : '0';
  if (Array.isArray(value) || typeof value === 'object') {
    return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
  }
  return `'${String(value).replace(/'/g, "''")}'`;
}

// 테이블 마이그레이션
async function migrateTable(tableName, columnMapping) {
  console.log(`\n📦 ${tableName}`);

  try {
    const data = await fetchFromSupabase(tableName);

    if (!data || data.length === 0) {
      console.log(`  ⏭️ 데이터 없음`);
      return 0;
    }

    console.log(`  📊 ${data.length}개 행 발견`);

    // 기존 데이터 삭제 (선택적)
    // await executeSQL(`DELETE FROM ${tableName}`);

    let migrated = 0;
    let errors = 0;

    for (const row of data) {
      try {
        const columns = [];
        const values = [];

        for (const [supaCol, sqliteCol] of Object.entries(columnMapping)) {
          if (row[supaCol] !== undefined) {
            columns.push(sqliteCol);
            values.push(toSqlValue(row[supaCol]));
          }
        }

        if (columns.length > 0) {
          const sql = `INSERT OR REPLACE INTO ${tableName} (${columns.join(', ')}) VALUES (${values.join(', ')})`;
          await executeSQL(sql);
          migrated++;
        }

        // DB lock 방지를 위한 딜레이
        await delay(100);
      } catch (err) {
        errors++;
        if (errors <= 3) {
          console.log(`  ❌ ${err.message}`);
        }
      }
    }

    console.log(`  ✅ ${migrated}/${data.length}개 마이그레이션 완료`);
    return migrated;
  } catch (err) {
    console.log(`  ❌ 오류: ${err.message}`);
    return 0;
  }
}

// 메인
async function main() {
  console.log('='.repeat(50));
  console.log('🚀 Supabase → SQLite 마이그레이션');
  console.log('='.repeat(50));

  // 1. 포털 사용자
  await migrateTable('portal_users', {
    id: 'id', name: 'name', login_id: 'login_id', password_hash: 'password_hash',
    role: 'role', permissions: 'permissions', is_active: 'is_active',
    created_at: 'created_at', updated_at: 'updated_at',
  });

  // 2. 액팅 종류
  await migrateTable('acting_types', {
    id: 'id', name: 'name', category: 'category', standard_min: 'standard_min',
    slot_usage: 'slot_usage', display_order: 'display_order', is_active: 'is_active',
    created_at: 'created_at',
  });

  // 3. 원장 상태
  await migrateTable('doctor_status', {
    doctor_id: 'doctor_id', doctor_name: 'doctor_name', status: 'status',
    current_acting_id: 'current_acting_id', status_updated_at: 'status_updated_at',
    created_at: 'created_at',
  });

  // 4. 치료실
  await migrateTable('treatment_rooms', {
    id: 'id', name: 'name', room_type: 'room_type', display_order: 'display_order',
    is_active: 'is_active', patient_id: 'patient_id', patient_name: 'patient_name',
    in_time: 'in_time', status: 'status', created_at: 'created_at', updated_at: 'updated_at',
  });

  // 5. 치료 항목
  await migrateTable('treatment_items', {
    id: 'id', name: 'name', category: 'category', default_duration: 'default_duration',
    display_order: 'display_order', is_active: 'is_active', created_at: 'created_at',
  });

  // 6. 약재
  await migrateTable('herbs', {
    id: 'id', name: 'name', category: 'category', unit: 'unit',
    default_amount: 'default_amount', price_per_unit: 'price_per_unit',
    is_active: 'is_active', created_at: 'created_at',
  });

  // 7. 처방 정의
  await migrateTable('prescription_definitions', {
    id: 'id', name: 'name', category: 'category', description: 'description',
    ingredients: 'ingredients', is_active: 'is_active',
    created_at: 'created_at', updated_at: 'updated_at',
  });

  // 8. 블로그 게시물
  await migrateTable('blog_posts', {
    id: 'id', title: 'title', slug: 'slug', excerpt: 'excerpt', content: 'content',
    category: 'category', status: 'status', thumbnail_url: 'thumbnail_url',
    author_id: 'author_id', author_name: 'author_name', published_at: 'published_at',
    view_count: 'view_count', like_count: 'like_count', comment_count: 'comment_count',
    tags: 'tags', meta_title: 'meta_title', meta_description: 'meta_description',
    created_at: 'created_at', updated_at: 'updated_at',
  });

  // 9. 블로그 구독자
  await migrateTable('blog_subscribers', {
    id: 'id', email: 'email', name: 'name', is_active: 'is_active',
    subscribed_at: 'subscribed_at', unsubscribed_at: 'unsubscribed_at',
  });

  // 10. 진료 기록
  await migrateTable('treatment_records', {
    id: 'id', patient_id: 'patient_id', record_date: 'record_date',
    record_type: 'record_type', content: 'content', doctor_id: 'doctor_id',
    doctor_name: 'doctor_name', created_at: 'created_at', updated_at: 'updated_at',
  });

  // 11. 타임라인 이벤트
  await migrateTable('treatment_timeline_events', {
    id: 'id', patient_id: 'patient_id', event_type: 'event_type',
    event_time: 'event_time', details: 'details', created_at: 'created_at',
  });

  // 12. 경과 기록
  await migrateTable('progress_notes', {
    id: 'id', patient_id: 'patient_id', note_date: 'note_date',
    content: 'content', doctor_id: 'doctor_id', doctor_name: 'doctor_name',
    created_at: 'created_at', updated_at: 'updated_at',
  });

  // 13. 작업
  await migrateTable('tasks', {
    id: 'id', title: 'title', description: 'description', task_type: 'task_type',
    status: 'status', priority: 'priority', assigned_to: 'assigned_to',
    due_date: 'due_date', completed_at: 'completed_at', patient_id: 'patient_id',
    related_id: 'related_id', related_type: 'related_type',
    created_at: 'created_at', updated_at: 'updated_at',
  });

  console.log('\n' + '='.repeat(50));
  console.log('✅ 마이그레이션 완료!');
  console.log('='.repeat(50));
}

main().catch(console.error);
