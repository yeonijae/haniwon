-- =====================================================
-- Haniwon SQLite Schema
-- Supabase에서 SQLite로 마이그레이션
-- 생성일: 2024-12-10
-- =====================================================

-- =====================================================
-- 1. 인증 (Authentication)
-- =====================================================

-- 포털 사용자
CREATE TABLE IF NOT EXISTS portal_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  login_id TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'desk',  -- super_admin, medical_staff, desk, counseling, treatment, decoction
  permissions TEXT,  -- JSON: ["manage", "chart", "inventory", ...]
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- 포털 세션
CREATE TABLE IF NOT EXISTS portal_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES portal_users(id) ON DELETE CASCADE,
  session_token TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_portal_sessions_token ON portal_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_portal_sessions_user ON portal_sessions(user_id);

-- =====================================================
-- 2. 액팅 관리 (Acting Management)
-- =====================================================

-- 액팅 종류 마스터
CREATE TABLE IF NOT EXISTS acting_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  category TEXT,  -- basic, consult, etc
  standard_min INTEGER DEFAULT 5,
  slot_usage INTEGER DEFAULT 1,
  display_order INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

-- 기본 액팅 종류 삽입
INSERT OR IGNORE INTO acting_types (name, category, standard_min, slot_usage, display_order) VALUES
  ('침', 'basic', 5, 1, 1),
  ('추나', 'basic', 8, 1, 2),
  ('초음파', 'basic', 10, 1, 3),
  ('향기', 'basic', 5, 1, 4),
  ('약초진', 'consult', 30, 6, 5),
  ('약재진', 'consult', 15, 3, 6),
  ('대기', 'etc', 5, 1, 7),
  ('상비약', 'etc', 5, 1, 8);

-- 액팅 대기열
CREATE TABLE IF NOT EXISTS acting_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL,
  patient_name TEXT NOT NULL,
  chart_no TEXT,
  doctor_id INTEGER NOT NULL,
  doctor_name TEXT NOT NULL,
  acting_type TEXT NOT NULL,
  order_num INTEGER NOT NULL DEFAULT 0,
  status TEXT DEFAULT 'waiting',  -- waiting, in_progress, completed, cancelled
  source TEXT DEFAULT 'manual',  -- reservation, manual
  source_id INTEGER,
  memo TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  started_at TEXT,
  completed_at TEXT,
  duration_sec INTEGER,
  work_date TEXT DEFAULT (date('now'))
);

CREATE INDEX IF NOT EXISTS idx_acting_queue_doctor_date ON acting_queue(doctor_id, work_date);
CREATE INDEX IF NOT EXISTS idx_acting_queue_status ON acting_queue(status);
CREATE INDEX IF NOT EXISTS idx_acting_queue_work_date ON acting_queue(work_date);

-- 원장 상태
CREATE TABLE IF NOT EXISTS doctor_status (
  doctor_id INTEGER PRIMARY KEY,
  doctor_name TEXT NOT NULL,
  status TEXT DEFAULT 'office',  -- in_progress, waiting, office, away
  current_acting_id INTEGER REFERENCES acting_queue(id) ON DELETE SET NULL,
  status_updated_at TEXT DEFAULT (datetime('now')),
  created_at TEXT DEFAULT (datetime('now'))
);

-- 액팅 기록 (완료된 액팅)
CREATE TABLE IF NOT EXISTS acting_records (
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
);

CREATE INDEX IF NOT EXISTS idx_acting_records_doctor_date ON acting_records(doctor_id, work_date);
CREATE INDEX IF NOT EXISTS idx_acting_records_type_date ON acting_records(acting_type, work_date);

-- =====================================================
-- 3. 치료실 관리 (Treatment Room)
-- =====================================================

-- 환자 기본 정보 (로컬 캐시)
CREATE TABLE IF NOT EXISTS patients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mssql_id INTEGER UNIQUE,  -- MSSQL Customer_PK
  name TEXT NOT NULL,
  chart_number TEXT,
  phone TEXT,
  birth_date TEXT,
  gender TEXT,  -- male, female
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- 환자별 기본 치료 항목
CREATE TABLE IF NOT EXISTS patient_default_treatments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL,
  treatment_name TEXT NOT NULL,
  duration INTEGER DEFAULT 10,
  display_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_patient_default_treatments_patient ON patient_default_treatments(patient_id);

-- 치료실 정보
CREATE TABLE IF NOT EXISTS treatment_rooms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  room_type TEXT DEFAULT 'bed',  -- bed, chair, etc
  display_order INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  patient_id INTEGER,
  patient_name TEXT,
  in_time TEXT,
  status TEXT DEFAULT 'empty',  -- empty, occupied, reserved
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- 세션별 치료 항목
CREATE TABLE IF NOT EXISTS session_treatments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id INTEGER NOT NULL REFERENCES treatment_rooms(id) ON DELETE CASCADE,
  treatment_name TEXT NOT NULL,
  duration INTEGER DEFAULT 10,
  status TEXT DEFAULT 'pending',  -- pending, in_progress, completed
  started_at TEXT,
  completed_at TEXT,
  display_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_session_treatments_room ON session_treatments(room_id);

-- 대기열 (치료/상담/수납)
CREATE TABLE IF NOT EXISTS waiting_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL,
  queue_type TEXT NOT NULL,  -- treatment, consultation, payment
  details TEXT,
  position INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_waiting_queue_type ON waiting_queue(queue_type);

-- =====================================================
-- 4. 환자 관리 (Patient Care)
-- =====================================================

-- 환자 관리 항목
CREATE TABLE IF NOT EXISTS patient_care_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL,
  patient_name TEXT,
  chart_no TEXT,
  care_type TEXT NOT NULL,  -- after_call, visit_call, delivery_call, medication
  status TEXT DEFAULT 'pending',  -- pending, in_progress, completed, cancelled
  scheduled_date TEXT,
  completed_date TEXT,
  assigned_to TEXT,
  notes TEXT,
  priority INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_patient_care_items_type ON patient_care_items(care_type);
CREATE INDEX IF NOT EXISTS idx_patient_care_items_status ON patient_care_items(status);
CREATE INDEX IF NOT EXISTS idx_patient_care_items_patient ON patient_care_items(patient_id);

-- 환자 관리 규칙
CREATE TABLE IF NOT EXISTS patient_care_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rule_name TEXT NOT NULL,
  care_type TEXT NOT NULL,
  trigger_condition TEXT,  -- JSON
  action_config TEXT,  -- JSON
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

-- 환자 치료 상태
CREATE TABLE IF NOT EXISTS patient_treatment_status (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL UNIQUE,
  treatment_phase TEXT,  -- initial, ongoing, maintenance, completed
  last_visit_date TEXT,
  next_visit_date TEXT,
  total_visits INTEGER DEFAULT 0,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- =====================================================
-- 5. 진료 기록 (Treatment Records)
-- =====================================================

-- 진료 기록
CREATE TABLE IF NOT EXISTS treatment_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL,
  record_date TEXT NOT NULL,
  record_type TEXT NOT NULL,  -- consultation, treatment, prescription
  content TEXT,  -- JSON
  doctor_id INTEGER,
  doctor_name TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_treatment_records_patient ON treatment_records(patient_id);
CREATE INDEX IF NOT EXISTS idx_treatment_records_date ON treatment_records(record_date);

-- 진료 타임라인 이벤트
CREATE TABLE IF NOT EXISTS treatment_timeline_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  event_time TEXT DEFAULT (datetime('now')),
  details TEXT,  -- JSON
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_timeline_events_patient ON treatment_timeline_events(patient_id);

-- 경과 기록
CREATE TABLE IF NOT EXISTS progress_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL,
  note_date TEXT NOT NULL,
  content TEXT,
  doctor_id INTEGER,
  doctor_name TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_progress_notes_patient ON progress_notes(patient_id);

-- =====================================================
-- 6. 처방 관리 (Prescription)
-- =====================================================

-- 약재
CREATE TABLE IF NOT EXISTS herbs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  category TEXT,
  unit TEXT DEFAULT 'g',
  default_amount REAL,
  price_per_unit REAL,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

-- 처방 정의
CREATE TABLE IF NOT EXISTS prescription_definitions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT,
  description TEXT,
  ingredients TEXT,  -- JSON: [{herb_id, amount}, ...]
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- =====================================================
-- 7. 작업 관리 (Tasks)
-- =====================================================

-- 작업
CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  task_type TEXT,
  status TEXT DEFAULT 'pending',  -- pending, in_progress, completed, cancelled
  priority INTEGER DEFAULT 0,
  assigned_to TEXT,
  due_date TEXT,
  completed_at TEXT,
  patient_id INTEGER,
  related_id INTEGER,
  related_type TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);

-- 작업 템플릿
CREATE TABLE IF NOT EXISTS task_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  task_type TEXT,
  default_priority INTEGER DEFAULT 0,
  default_assigned_to TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

-- =====================================================
-- 8. 블로그 (Blog)
-- =====================================================

-- 블로그 게시물
CREATE TABLE IF NOT EXISTS blog_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  slug TEXT UNIQUE,
  excerpt TEXT,
  content TEXT,
  category TEXT,
  status TEXT DEFAULT 'draft',  -- draft, published, archived
  thumbnail_url TEXT,
  author_id INTEGER,
  author_name TEXT,
  published_at TEXT,
  view_count INTEGER DEFAULT 0,
  like_count INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  tags TEXT,  -- JSON array
  meta_title TEXT,
  meta_description TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_blog_posts_slug ON blog_posts(slug);
CREATE INDEX IF NOT EXISTS idx_blog_posts_status ON blog_posts(status);

-- 블로그 구독자
CREATE TABLE IF NOT EXISTS blog_subscribers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  is_active INTEGER DEFAULT 1,
  subscribed_at TEXT DEFAULT (datetime('now')),
  unsubscribed_at TEXT
);

-- 블로그 페이지 조회
CREATE TABLE IF NOT EXISTS blog_page_views (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER REFERENCES blog_posts(id) ON DELETE CASCADE,
  viewed_at TEXT DEFAULT (datetime('now')),
  ip_address TEXT,
  user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_blog_page_views_post ON blog_page_views(post_id);

-- =====================================================
-- 9. 치료 항목 마스터 (Treatment Items)
-- =====================================================

CREATE TABLE IF NOT EXISTS treatment_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT,
  default_duration INTEGER DEFAULT 10,
  display_order INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

-- 기본 치료 항목 삽입
INSERT OR IGNORE INTO treatment_items (name, category, default_duration, display_order) VALUES
  ('침', 'acupuncture', 20, 1),
  ('추나', 'manual', 10, 2),
  ('부항', 'cupping', 10, 3),
  ('뜸', 'moxibustion', 15, 4),
  ('약침', 'acupuncture', 5, 5),
  ('초음파', 'physical', 10, 6),
  ('향기요법', 'aroma', 10, 7),
  ('습부항', 'cupping', 10, 8);

-- =====================================================
-- 10. 기본 데이터 삽입
-- =====================================================

-- 기본 관리자 계정 (password: 7582)
INSERT OR IGNORE INTO portal_users (name, login_id, password_hash, role, permissions)
VALUES ('관리자', 'admin', '7582', 'super_admin', '["manage","chart","inventory","treatment","patient_care","funnel","content","reservation","doctor_pad"]');

-- 기본 원장 상태
INSERT OR IGNORE INTO doctor_status (doctor_id, doctor_name, status) VALUES
  (1, '김대현', 'office'),
  (2, '강희종', 'office'),
  (3, '임세열', 'office'),
  (4, '전인태', 'office');

-- 기본 치료실
INSERT OR IGNORE INTO treatment_rooms (name, room_type, display_order, is_active) VALUES
  ('침구실 1', 'bed', 1, 1),
  ('침구실 2', 'bed', 2, 1),
  ('침구실 3', 'bed', 3, 1),
  ('침구실 4', 'bed', 4, 1),
  ('침구실 5', 'bed', 5, 1),
  ('침구실 6', 'bed', 6, 1),
  ('침구실 7', 'bed', 7, 1),
  ('침구실 8', 'bed', 8, 1);

-- =====================================================
-- 11. 액팅 치료 항목 설정 (Acting Treatment Items Config)
-- =====================================================

-- 액팅별 치료 항목 설정
CREATE TABLE IF NOT EXISTS acting_treatment_config (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  acting_type TEXT NOT NULL,           -- 침, 추나, 초음파, 약상담
  item_name TEXT NOT NULL,
  item_type TEXT DEFAULT 'toggle',     -- toggle (토글), cycle (탭사이클 0~5)
  item_group TEXT DEFAULT 'default',   -- default, yakchim (약침)
  max_value INTEGER DEFAULT 1,         -- toggle=1, cycle=5
  display_order INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_acting_treatment_config_type ON acting_treatment_config(acting_type);

-- 기본 자침 항목
INSERT OR IGNORE INTO acting_treatment_config (acting_type, item_name, item_type, item_group, max_value, display_order) VALUES
  ('침', '투자', 'toggle', 'default', 1, 1),
  ('침', '관절', 'toggle', 'default', 1, 2),
  ('침', '척추', 'toggle', 'default', 1, 3),
  ('침', '복강', 'toggle', 'default', 1, 4),
  ('침', '자락', 'toggle', 'default', 1, 5),
  ('침', '유관', 'toggle', 'default', 1, 6),
  ('침', '습부', 'toggle', 'default', 1, 7),
  ('침', '습부2', 'toggle', 'default', 1, 8),
  ('침', '전침', 'toggle', 'default', 1, 9),
  ('침', 'IR', 'toggle', 'default', 1, 10),
  -- 약침 (탭사이클)
  ('침', '경근', 'cycle', 'yakchim', 5, 11),
  ('침', '녹용', 'cycle', 'yakchim', 5, 12),
  ('침', '태반', 'cycle', 'yakchim', 5, 13),
  ('침', '라인', 'cycle', 'yakchim', 5, 14),
  ('침', '화타', 'cycle', 'yakchim', 5, 15),
  ('침', '초음파', 'cycle', 'yakchim', 5, 16);

-- 기본 추나 항목
INSERT OR IGNORE INTO acting_treatment_config (acting_type, item_name, item_type, item_group, max_value, display_order) VALUES
  ('추나', '단추', 'toggle', 'default', 1, 1),
  ('추나', '복추', 'toggle', 'default', 1, 2),
  ('추나', '충격파', 'toggle', 'default', 1, 3),
  ('추나', '경추', 'toggle', 'default', 1, 4),
  ('추나', '흉추', 'toggle', 'default', 1, 5),
  ('추나', '요추', 'toggle', 'default', 1, 6),
  ('추나', '골반', 'toggle', 'default', 1, 7);

-- 기본 초음파 항목
INSERT OR IGNORE INTO acting_treatment_config (acting_type, item_name, item_type, item_group, max_value, display_order) VALUES
  ('초음파', '부위1', 'toggle', 'default', 1, 1),
  ('초음파', '부위2', 'toggle', 'default', 1, 2),
  ('초음파', '부위3', 'toggle', 'default', 1, 3),
  ('초음파', '부위4', 'toggle', 'default', 1, 4),
  ('초음파', '부위5', 'toggle', 'default', 1, 5);

-- 기본 약상담 항목
INSERT OR IGNORE INTO acting_treatment_config (acting_type, item_name, item_type, item_group, max_value, display_order) VALUES
  ('약상담', '1개월', 'toggle', 'default', 1, 1),
  ('약상담', '3개월', 'toggle', 'default', 1, 2),
  ('약상담', '6개월', 'toggle', 'default', 1, 3),
  ('약상담', '1년', 'toggle', 'default', 1, 4),
  ('약상담', '녹용추가', 'toggle', 'default', 1, 5);

-- 액팅 치료 기록 (완료된 치료 상세)
CREATE TABLE IF NOT EXISTS acting_treatment_details (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  acting_record_id INTEGER REFERENCES acting_records(id) ON DELETE CASCADE,
  patient_id INTEGER NOT NULL,
  doctor_id INTEGER NOT NULL,
  acting_type TEXT NOT NULL,
  treatment_items TEXT,     -- JSON: {"투자": 1, "관절": 1, "경근": 2, "녹용": 1}
  work_date TEXT NOT NULL,
  started_at TEXT,
  completed_at TEXT,
  duration_sec INTEGER,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_acting_treatment_details_patient ON acting_treatment_details(patient_id);
CREATE INDEX IF NOT EXISTS idx_acting_treatment_details_date ON acting_treatment_details(work_date);
CREATE INDEX IF NOT EXISTS idx_acting_treatment_details_doctor ON acting_treatment_details(doctor_id);
