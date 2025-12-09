/**
 * SQLite 스키마 초기화 스크립트
 * 사용법: node scripts/init-sqlite.js
 */

const SQLITE_API_URL = process.env.SQLITE_API_URL || 'http://192.168.0.173:33333';

async function executeSql(sql) {
  try {
    const res = await fetch(`${SQLITE_API_URL}/api/sqlite/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql })
    });
    const data = await res.json();
    if (data.error) {
      console.error('Error:', data.error);
      return false;
    }
    return true;
  } catch (error) {
    console.error('Fetch error:', error.message);
    return false;
  }
}

const statements = [
  // 1. 인증
  `CREATE TABLE IF NOT EXISTS portal_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    login_id TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'desk',
    permissions TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`,

  `CREATE TABLE IF NOT EXISTS portal_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    session_token TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  )`,

  `CREATE INDEX IF NOT EXISTS idx_portal_sessions_token ON portal_sessions(session_token)`,

  // 2. 액팅
  `CREATE TABLE IF NOT EXISTS acting_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    category TEXT,
    standard_min INTEGER DEFAULT 5,
    slot_usage INTEGER DEFAULT 1,
    display_order INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  )`,

  `CREATE TABLE IF NOT EXISTS acting_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER NOT NULL,
    patient_name TEXT NOT NULL,
    chart_no TEXT,
    doctor_id INTEGER NOT NULL,
    doctor_name TEXT NOT NULL,
    acting_type TEXT NOT NULL,
    order_num INTEGER NOT NULL DEFAULT 0,
    status TEXT DEFAULT 'waiting',
    source TEXT DEFAULT 'manual',
    source_id INTEGER,
    memo TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    started_at TEXT,
    completed_at TEXT,
    duration_sec INTEGER,
    work_date TEXT DEFAULT (date('now'))
  )`,

  `CREATE INDEX IF NOT EXISTS idx_acting_queue_doctor_date ON acting_queue(doctor_id, work_date)`,
  `CREATE INDEX IF NOT EXISTS idx_acting_queue_status ON acting_queue(status)`,

  `CREATE TABLE IF NOT EXISTS doctor_status (
    doctor_id INTEGER PRIMARY KEY,
    doctor_name TEXT NOT NULL,
    status TEXT DEFAULT 'office',
    current_acting_id INTEGER,
    status_updated_at TEXT DEFAULT (datetime('now')),
    created_at TEXT DEFAULT (datetime('now'))
  )`,

  `CREATE TABLE IF NOT EXISTS acting_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER NOT NULL,
    patient_name TEXT,
    chart_no TEXT,
    doctor_id INTEGER NOT NULL,
    doctor_name TEXT,
    acting_type TEXT NOT NULL,
    started_at TEXT NOT NULL,
    completed_at TEXT NOT NULL,
    duration_sec INTEGER NOT NULL,
    work_date TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  )`,

  // 3. 치료실
  `CREATE TABLE IF NOT EXISTS patients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mssql_id INTEGER UNIQUE,
    name TEXT NOT NULL,
    chart_number TEXT,
    phone TEXT,
    birth_date TEXT,
    gender TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`,

  `CREATE TABLE IF NOT EXISTS patient_default_treatments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER NOT NULL,
    treatment_name TEXT NOT NULL,
    duration INTEGER DEFAULT 10,
    display_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  )`,

  `CREATE TABLE IF NOT EXISTS treatment_rooms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    room_type TEXT DEFAULT 'bed',
    display_order INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    patient_id INTEGER,
    patient_name TEXT,
    in_time TEXT,
    status TEXT DEFAULT 'empty',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`,

  `CREATE TABLE IF NOT EXISTS session_treatments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id INTEGER NOT NULL,
    treatment_name TEXT NOT NULL,
    duration INTEGER DEFAULT 10,
    status TEXT DEFAULT 'pending',
    started_at TEXT,
    completed_at TEXT,
    display_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  )`,

  `CREATE TABLE IF NOT EXISTS waiting_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER NOT NULL,
    queue_type TEXT NOT NULL,
    details TEXT,
    position INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  )`,

  // 4. 환자관리
  `CREATE TABLE IF NOT EXISTS patient_care_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER NOT NULL,
    patient_name TEXT,
    chart_no TEXT,
    care_type TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    scheduled_date TEXT,
    completed_date TEXT,
    assigned_to TEXT,
    notes TEXT,
    priority INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`,

  `CREATE TABLE IF NOT EXISTS patient_care_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rule_name TEXT NOT NULL,
    care_type TEXT NOT NULL,
    trigger_condition TEXT,
    action_config TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  )`,

  `CREATE TABLE IF NOT EXISTS patient_treatment_status (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER NOT NULL UNIQUE,
    treatment_phase TEXT,
    last_visit_date TEXT,
    next_visit_date TEXT,
    total_visits INTEGER DEFAULT 0,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`,

  // 5. 진료기록
  `CREATE TABLE IF NOT EXISTS treatment_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER NOT NULL,
    record_date TEXT NOT NULL,
    record_type TEXT NOT NULL,
    content TEXT,
    doctor_id INTEGER,
    doctor_name TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`,

  `CREATE TABLE IF NOT EXISTS treatment_timeline_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER NOT NULL,
    event_type TEXT NOT NULL,
    event_time TEXT DEFAULT (datetime('now')),
    details TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`,

  `CREATE TABLE IF NOT EXISTS progress_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER NOT NULL,
    note_date TEXT NOT NULL,
    content TEXT,
    doctor_id INTEGER,
    doctor_name TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`,

  // 6. 처방
  `CREATE TABLE IF NOT EXISTS herbs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    category TEXT,
    unit TEXT DEFAULT 'g',
    default_amount REAL,
    price_per_unit REAL,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  )`,

  `CREATE TABLE IF NOT EXISTS prescription_definitions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT,
    description TEXT,
    ingredients TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`,

  // 7. 작업
  `CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    task_type TEXT,
    status TEXT DEFAULT 'pending',
    priority INTEGER DEFAULT 0,
    assigned_to TEXT,
    due_date TEXT,
    completed_at TEXT,
    patient_id INTEGER,
    related_id INTEGER,
    related_type TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`,

  `CREATE TABLE IF NOT EXISTS task_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    task_type TEXT,
    default_priority INTEGER DEFAULT 0,
    default_assigned_to TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  )`,

  // 8. 블로그
  `CREATE TABLE IF NOT EXISTS blog_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    slug TEXT UNIQUE,
    excerpt TEXT,
    content TEXT,
    category TEXT,
    status TEXT DEFAULT 'draft',
    thumbnail_url TEXT,
    author_id INTEGER,
    author_name TEXT,
    published_at TEXT,
    view_count INTEGER DEFAULT 0,
    like_count INTEGER DEFAULT 0,
    comment_count INTEGER DEFAULT 0,
    tags TEXT,
    meta_title TEXT,
    meta_description TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`,

  `CREATE TABLE IF NOT EXISTS blog_subscribers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    name TEXT,
    is_active INTEGER DEFAULT 1,
    subscribed_at TEXT DEFAULT (datetime('now')),
    unsubscribed_at TEXT
  )`,

  `CREATE TABLE IF NOT EXISTS blog_page_views (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER,
    viewed_at TEXT DEFAULT (datetime('now')),
    ip_address TEXT,
    user_agent TEXT
  )`,

  // 9. 치료항목
  `CREATE TABLE IF NOT EXISTS treatment_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT,
    default_duration INTEGER DEFAULT 10,
    display_order INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  )`,

  // 기본 데이터
  `INSERT OR IGNORE INTO acting_types (name, category, standard_min, slot_usage, display_order) VALUES ('침', 'basic', 5, 1, 1)`,
  `INSERT OR IGNORE INTO acting_types (name, category, standard_min, slot_usage, display_order) VALUES ('추나', 'basic', 8, 1, 2)`,
  `INSERT OR IGNORE INTO acting_types (name, category, standard_min, slot_usage, display_order) VALUES ('초음파', 'basic', 10, 1, 3)`,
  `INSERT OR IGNORE INTO acting_types (name, category, standard_min, slot_usage, display_order) VALUES ('향기', 'basic', 5, 1, 4)`,
  `INSERT OR IGNORE INTO acting_types (name, category, standard_min, slot_usage, display_order) VALUES ('약초진', 'consult', 30, 6, 5)`,
  `INSERT OR IGNORE INTO acting_types (name, category, standard_min, slot_usage, display_order) VALUES ('약재진', 'consult', 15, 3, 6)`,
  `INSERT OR IGNORE INTO acting_types (name, category, standard_min, slot_usage, display_order) VALUES ('대기', 'etc', 5, 1, 7)`,
  `INSERT OR IGNORE INTO acting_types (name, category, standard_min, slot_usage, display_order) VALUES ('상비약', 'etc', 5, 1, 8)`,

  `INSERT OR IGNORE INTO portal_users (name, login_id, password_hash, role, permissions) VALUES ('관리자', 'admin', 'admin123', 'super_admin', '["manage","chart","inventory","treatment","patient_care","funnel","content","reservation","doctor_pad"]')`,

  `INSERT OR IGNORE INTO doctor_status (doctor_id, doctor_name, status) VALUES (1, '김대현', 'office')`,
  `INSERT OR IGNORE INTO doctor_status (doctor_id, doctor_name, status) VALUES (2, '강희종', 'office')`,
  `INSERT OR IGNORE INTO doctor_status (doctor_id, doctor_name, status) VALUES (3, '임세열', 'office')`,
  `INSERT OR IGNORE INTO doctor_status (doctor_id, doctor_name, status) VALUES (4, '전인태', 'office')`,

  `INSERT OR IGNORE INTO treatment_rooms (name, room_type, display_order, is_active) VALUES ('침구실 1', 'bed', 1, 1)`,
  `INSERT OR IGNORE INTO treatment_rooms (name, room_type, display_order, is_active) VALUES ('침구실 2', 'bed', 2, 1)`,
  `INSERT OR IGNORE INTO treatment_rooms (name, room_type, display_order, is_active) VALUES ('침구실 3', 'bed', 3, 1)`,
  `INSERT OR IGNORE INTO treatment_rooms (name, room_type, display_order, is_active) VALUES ('침구실 4', 'bed', 4, 1)`,
  `INSERT OR IGNORE INTO treatment_rooms (name, room_type, display_order, is_active) VALUES ('침구실 5', 'bed', 5, 1)`,
  `INSERT OR IGNORE INTO treatment_rooms (name, room_type, display_order, is_active) VALUES ('침구실 6', 'bed', 6, 1)`,
  `INSERT OR IGNORE INTO treatment_rooms (name, room_type, display_order, is_active) VALUES ('침구실 7', 'bed', 7, 1)`,
  `INSERT OR IGNORE INTO treatment_rooms (name, room_type, display_order, is_active) VALUES ('침구실 8', 'bed', 8, 1)`,

  `INSERT OR IGNORE INTO treatment_items (name, category, default_duration, display_order) VALUES ('침', 'acupuncture', 20, 1)`,
  `INSERT OR IGNORE INTO treatment_items (name, category, default_duration, display_order) VALUES ('추나', 'manual', 10, 2)`,
  `INSERT OR IGNORE INTO treatment_items (name, category, default_duration, display_order) VALUES ('부항', 'cupping', 10, 3)`,
  `INSERT OR IGNORE INTO treatment_items (name, category, default_duration, display_order) VALUES ('뜸', 'moxibustion', 15, 4)`,
  `INSERT OR IGNORE INTO treatment_items (name, category, default_duration, display_order) VALUES ('약침', 'acupuncture', 5, 5)`,
  `INSERT OR IGNORE INTO treatment_items (name, category, default_duration, display_order) VALUES ('초음파', 'physical', 10, 6)`,
  `INSERT OR IGNORE INTO treatment_items (name, category, default_duration, display_order) VALUES ('향기요법', 'aroma', 10, 7)`,
  `INSERT OR IGNORE INTO treatment_items (name, category, default_duration, display_order) VALUES ('습부항', 'cupping', 10, 8)`,
];

async function main() {
  console.log('SQLite 스키마 초기화 시작...');
  console.log(`API URL: ${SQLITE_API_URL}`);

  let success = 0;
  let failed = 0;

  for (let i = 0; i < statements.length; i++) {
    const sql = statements[i];
    const shortSql = sql.substring(0, 60).replace(/\n/g, ' ') + '...';
    process.stdout.write(`[${i + 1}/${statements.length}] ${shortSql} `);

    const result = await executeSql(sql);
    if (result) {
      console.log('✓');
      success++;
    } else {
      console.log('✗');
      failed++;
    }
  }

  console.log(`\n완료: ${success} 성공, ${failed} 실패`);
}

main();
