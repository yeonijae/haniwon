/**
 * Supabase → SQL 파일 내보내기 스크립트
 * 실행: node scripts/export-supabase-to-sql.js > migration.sql
 */

const SUPABASE_URL = 'https://vipyakvxzfccytwjaqet.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpcHlha3Z4emZjY3l0d2phcWV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI5NTc2MjUsImV4cCI6MjA3ODUzMzYyNX0.xuR3LxaR69t1RGB74G3FtlBIoxelfAH6fdZrnZSjHfQ';

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
    return [];
  }

  return response.json();
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

// 테이블 SQL 생성
async function generateTableSQL(tableName, columnMapping, defaults = {}) {
  const data = await fetchFromSupabase(tableName);

  if (!data || data.length === 0) {
    console.log(`-- ${tableName}: 데이터 없음`);
    return;
  }

  console.log(`-- ============================================`);
  console.log(`-- ${tableName} (${data.length}개 행)`);
  console.log(`-- ============================================`);

  for (const row of data) {
    const columns = [];
    const values = [];

    for (const [supaCol, sqliteCol] of Object.entries(columnMapping)) {
      columns.push(sqliteCol);
      if (row[supaCol] !== undefined && row[supaCol] !== null) {
        values.push(toSqlValue(row[supaCol]));
      } else if (defaults[sqliteCol] !== undefined) {
        // 기본값이 있으면 사용
        values.push(toSqlValue(defaults[sqliteCol]));
      } else {
        values.push('NULL');
      }
    }

    if (columns.length > 0) {
      console.log(`INSERT OR REPLACE INTO ${tableName} (${columns.join(', ')}) VALUES (${values.join(', ')});`);
    }
  }
  console.log('');
}

// 메인
async function main() {
  console.log('-- Supabase → SQLite 마이그레이션 SQL');
  console.log('-- 생성일: ' + new Date().toISOString());
  console.log('');

  // 1. 포털 사용자 (login_id, password_hash가 NOT NULL이므로 기본값 필요)
  await generateTableSQL('portal_users', {
    id: 'id', name: 'name', login_id: 'login_id', password_hash: 'password_hash',
    role: 'role', permissions: 'permissions', is_active: 'is_active',
    created_at: 'created_at', updated_at: 'updated_at',
  }, {
    login_id: 'migrated_user',
    password_hash: '$2b$10$placeholder_hash_for_migration'
  });

  // 2. 액팅 종류
  await generateTableSQL('acting_types', {
    id: 'id', name: 'name', category: 'category', standard_min: 'standard_min',
    slot_usage: 'slot_usage', display_order: 'display_order', is_active: 'is_active',
    created_at: 'created_at',
  });

  // 3. 원장 상태
  await generateTableSQL('doctor_status', {
    doctor_id: 'doctor_id', doctor_name: 'doctor_name', status: 'status',
    current_acting_id: 'current_acting_id', status_updated_at: 'status_updated_at',
    created_at: 'created_at',
  });

  // 4. 치료실
  await generateTableSQL('treatment_rooms', {
    id: 'id', name: 'name', room_type: 'room_type', display_order: 'display_order',
    is_active: 'is_active', patient_id: 'patient_id', patient_name: 'patient_name',
    in_time: 'in_time', status: 'status', created_at: 'created_at', updated_at: 'updated_at',
  });

  // 5. 치료 항목
  await generateTableSQL('treatment_items', {
    id: 'id', name: 'name', category: 'category', default_duration: 'default_duration',
    display_order: 'display_order', is_active: 'is_active', created_at: 'created_at',
  });

  // 6. 약재
  await generateTableSQL('herbs', {
    id: 'id', name: 'name', category: 'category', unit: 'unit',
    default_amount: 'default_amount', price_per_unit: 'price_per_unit',
    is_active: 'is_active', created_at: 'created_at',
  });

  // 7. 처방 정의
  await generateTableSQL('prescription_definitions', {
    id: 'id', name: 'name', category: 'category', description: 'description',
    ingredients: 'ingredients', is_active: 'is_active',
    created_at: 'created_at', updated_at: 'updated_at',
  });

  // 8. 블로그 게시물
  await generateTableSQL('blog_posts', {
    id: 'id', title: 'title', slug: 'slug', excerpt: 'excerpt', content: 'content',
    category: 'category', status: 'status', thumbnail_url: 'thumbnail_url',
    author_id: 'author_id', author_name: 'author_name', published_at: 'published_at',
    view_count: 'view_count', like_count: 'like_count', comment_count: 'comment_count',
    tags: 'tags', meta_title: 'meta_title', meta_description: 'meta_description',
    created_at: 'created_at', updated_at: 'updated_at',
  });

  // 9. 블로그 구독자
  await generateTableSQL('blog_subscribers', {
    id: 'id', email: 'email', name: 'name', is_active: 'is_active',
    subscribed_at: 'subscribed_at', unsubscribed_at: 'unsubscribed_at',
  });

  // 10. 진료 기록
  await generateTableSQL('treatment_records', {
    id: 'id', patient_id: 'patient_id', record_date: 'record_date',
    record_type: 'record_type', content: 'content', doctor_id: 'doctor_id',
    doctor_name: 'doctor_name', created_at: 'created_at', updated_at: 'updated_at',
  });

  // 11. 타임라인 이벤트 (patient_id가 NOT NULL이므로 기본값 필요)
  await generateTableSQL('treatment_timeline_events', {
    id: 'id', patient_id: 'patient_id', event_type: 'event_type',
    event_time: 'event_time', details: 'details', created_at: 'created_at',
  }, {
    patient_id: 0
  });

  // 12. 경과 기록
  await generateTableSQL('progress_notes', {
    id: 'id', patient_id: 'patient_id', note_date: 'note_date',
    content: 'content', doctor_id: 'doctor_id', doctor_name: 'doctor_name',
    created_at: 'created_at', updated_at: 'updated_at',
  });

  // 13. 작업
  await generateTableSQL('tasks', {
    id: 'id', title: 'title', description: 'description', task_type: 'task_type',
    status: 'status', priority: 'priority', assigned_to: 'assigned_to',
    due_date: 'due_date', completed_at: 'completed_at', patient_id: 'patient_id',
    related_id: 'related_id', related_type: 'related_type',
    created_at: 'created_at', updated_at: 'updated_at',
  });

  console.log('-- 마이그레이션 SQL 생성 완료');
}

main().catch(console.error);
