-- =====================================================
-- haniwon 프로젝트 전체 스키마
-- Self-hosted Supabase용 통합 SQL
-- Supabase Studio > SQL Editor에서 실행
-- =====================================================

-- =====================================================
-- 0. 기본 확장 및 설정
-- =====================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. 기초 테이블 (의존성 없음)
-- =====================================================

-- 1-1. 환자 테이블
CREATE TABLE IF NOT EXISTS patients (
  id SERIAL PRIMARY KEY,
  chart_number VARCHAR(20) UNIQUE,
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(20),
  dob DATE,
  gender VARCHAR(10),
  address TEXT,
  memo TEXT,
  deletion_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_patients_chart_number ON patients(chart_number);
CREATE INDEX IF NOT EXISTS idx_patients_name ON patients(name);
CREATE INDEX IF NOT EXISTS idx_patients_phone ON patients(phone);

-- 1-2. 포털 사용자 (블로그 작성자 등)
CREATE TABLE IF NOT EXISTS portal_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE,
  name VARCHAR(100),
  role VARCHAR(20) DEFAULT 'user',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1-3. 의료진 테이블
CREATE TABLE IF NOT EXISTS medical_staff (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  role VARCHAR(30) NOT NULL,  -- doctor, nurse, therapist
  specialization VARCHAR(100),
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1-4. 직원 테이블
CREATE TABLE IF NOT EXISTS staff (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  role VARCHAR(30) NOT NULL,  -- desk, treatment, manager
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1-5. 치료실 테이블
CREATE TABLE IF NOT EXISTS treatment_rooms (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  room_type VARCHAR(30),  -- consultation, treatment, etc.
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  current_patient_id INTEGER,
  current_patient_name VARCHAR(100),
  status VARCHAR(20) DEFAULT 'available',  -- available, occupied, reserved
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1-6. 치료 항목 테이블
CREATE TABLE IF NOT EXISTS treatment_items (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  category VARCHAR(50),
  duration INTEGER DEFAULT 30,  -- 기본 소요시간 (분)
  price INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1-7. 진료 항목 테이블
CREATE TABLE IF NOT EXISTS consultation_items (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1-8. 진료 세부 항목 테이블
CREATE TABLE IF NOT EXISTS consultation_sub_items (
  id SERIAL PRIMARY KEY,
  consultation_item_id INTEGER NOT NULL REFERENCES consultation_items(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consultation_sub_items_parent ON consultation_sub_items(consultation_item_id);

-- 1-9. 비급여 카테고리 테이블
CREATE TABLE IF NOT EXISTS uncovered_categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 2. 환자 관련 테이블
-- =====================================================

-- 2-1. 환자 기본 치료 항목
CREATE TABLE IF NOT EXISTS patient_default_treatments (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  treatment_item_id INTEGER NOT NULL REFERENCES treatment_items(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(patient_id, treatment_item_id)
);

-- 2-2. 예약 테이블
CREATE TABLE IF NOT EXISTS reservations (
  id VARCHAR(100) PRIMARY KEY,  -- UUID 또는 커스텀 ID
  patient_id INTEGER REFERENCES patients(id) ON DELETE SET NULL,
  patient_name VARCHAR(100),
  patient_chart_number VARCHAR(20),
  reservation_date DATE NOT NULL,
  reservation_time TIME NOT NULL,
  doctor_name VARCHAR(50),
  memo TEXT,
  status VARCHAR(20) DEFAULT 'confirmed',  -- confirmed, completed, canceled, no_show
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reservations_date ON reservations(reservation_date);
CREATE INDEX IF NOT EXISTS idx_reservations_patient ON reservations(patient_id);
CREATE INDEX IF NOT EXISTS idx_reservations_status ON reservations(status);

-- 2-3. 예약 치료 항목
CREATE TABLE IF NOT EXISTS reservation_treatments (
  id SERIAL PRIMARY KEY,
  reservation_id VARCHAR(100) NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  treatment_item_id INTEGER REFERENCES treatment_items(id) ON DELETE SET NULL,
  treatment_name VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reservation_treatments_reservation ON reservation_treatments(reservation_id);

-- 2-4. 대기열 테이블
CREATE TABLE IF NOT EXISTS waiting_queue (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  patient_name VARCHAR(100),
  chart_number VARCHAR(20),
  queue_type VARCHAR(30) NOT NULL,  -- consultation, treatment
  queue_order INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'waiting',  -- waiting, in_progress, completed
  details TEXT,  -- 진료 항목 정보
  memo TEXT,  -- 접수 메모 (특이사항)
  check_in_time TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_waiting_queue_type ON waiting_queue(queue_type);
CREATE INDEX IF NOT EXISTS idx_waiting_queue_patient ON waiting_queue(patient_id);
CREATE INDEX IF NOT EXISTS idx_waiting_queue_date ON waiting_queue(created_at);

-- 2-5. 수납 테이블
CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER REFERENCES patients(id) ON DELETE SET NULL,
  patient_name VARCHAR(100),
  chart_number VARCHAR(20),
  payment_date DATE DEFAULT CURRENT_DATE,
  total_amount INTEGER DEFAULT 0,
  paid_amount INTEGER DEFAULT 0,
  payment_method VARCHAR(30),  -- cash, card, transfer, mixed
  status VARCHAR(20) DEFAULT 'pending',  -- pending, completed, partial, refunded
  memo TEXT,
  items JSONB DEFAULT '[]',  -- [{name, price, quantity}]
  reservation_id VARCHAR(100),
  source_list VARCHAR(30),  -- consultation, treatment
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_payments_patient ON payments(patient_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);

-- 2-6. 진료실 세션 치료 항목
CREATE TABLE IF NOT EXISTS session_treatments (
  id SERIAL PRIMARY KEY,
  room_id INTEGER NOT NULL REFERENCES treatment_rooms(id) ON DELETE CASCADE,
  treatment_item_id INTEGER REFERENCES treatment_items(id) ON DELETE SET NULL,
  treatment_name VARCHAR(100),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  status VARCHAR(20) DEFAULT 'pending',  -- pending, in_progress, completed
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_session_treatments_room ON session_treatments(room_id);

-- 2-7. 대기실 항목 (acting queue)
CREATE TABLE IF NOT EXISTS acting_queue_items (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER REFERENCES patients(id) ON DELETE SET NULL,
  patient_name VARCHAR(100),
  chart_number VARCHAR(20),
  queue_type VARCHAR(30),
  status VARCHAR(20) DEFAULT 'waiting',
  memo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 3. 진료 기록 테이블
-- =====================================================

-- 3-1. 진료내역 메인 테이블
CREATE TABLE IF NOT EXISTS treatment_records (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  treatment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  doctor_name VARCHAR(50),
  treatment_room VARCHAR(20),
  visit_type VARCHAR(20) NOT NULL DEFAULT 'follow_up',  -- initial, follow_up, medication, treatment_only
  services TEXT[] DEFAULT '{}',
  treatment_items JSONB DEFAULT '[]',
  reservation_id VARCHAR(100),
  payment_id INTEGER,
  status VARCHAR(20) NOT NULL DEFAULT 'in_progress',  -- in_progress, completed, canceled
  memo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_treatment_records_patient_id ON treatment_records(patient_id);
CREATE INDEX IF NOT EXISTS idx_treatment_records_treatment_date ON treatment_records(treatment_date);
CREATE INDEX IF NOT EXISTS idx_treatment_records_status ON treatment_records(status);

-- 3-2. 진료 타임라인 이벤트
CREATE TABLE IF NOT EXISTS treatment_timeline_events (
  id SERIAL PRIMARY KEY,
  treatment_record_id INTEGER NOT NULL REFERENCES treatment_records(id) ON DELETE CASCADE,
  event_type VARCHAR(30) NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  location VARCHAR(50),
  staff_name VARCHAR(50),
  memo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_timeline_events_record_id ON treatment_timeline_events(treatment_record_id);

-- =====================================================
-- 4. 할일 (Tasks) 테이블
-- =====================================================

-- 4-1. 할일 메인 테이블
CREATE TABLE IF NOT EXISTS tasks (
  id SERIAL PRIMARY KEY,
  treatment_record_id INTEGER REFERENCES treatment_records(id) ON DELETE SET NULL,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  task_type VARCHAR(50) NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  assigned_to VARCHAR(50),
  assigned_role VARCHAR(20),
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  priority VARCHAR(10) NOT NULL DEFAULT 'normal',
  due_date DATE,
  completed_at TIMESTAMPTZ,
  completed_by VARCHAR(50),
  trigger_service VARCHAR(30),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_patient_id ON tasks(patient_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);

-- 4-2. 할일 템플릿
CREATE TABLE IF NOT EXISTS task_templates (
  id SERIAL PRIMARY KEY,
  trigger_service VARCHAR(30) NOT NULL,
  task_type VARCHAR(50) NOT NULL,
  title_template VARCHAR(200) NOT NULL,
  description_template TEXT,
  default_assigned_role VARCHAR(20) DEFAULT 'doctor',
  default_priority VARCHAR(10) DEFAULT 'normal',
  due_days_offset INTEGER DEFAULT 0,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 5. 환자 관리 테이블
-- =====================================================

-- 5-1. 환자 관리 항목
CREATE TABLE IF NOT EXISTS patient_care_items (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  treatment_record_id INTEGER REFERENCES treatment_records(id) ON DELETE SET NULL,
  care_type VARCHAR(30) NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  scheduled_date DATE,
  completed_date TIMESTAMPTZ,
  completed_by VARCHAR(50),
  result TEXT,
  trigger_type VARCHAR(10) NOT NULL DEFAULT 'manual',
  trigger_source VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_patient_care_items_patient_id ON patient_care_items(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_care_items_status ON patient_care_items(status);

-- 5-2. 환자 치료 상태
CREATE TABLE IF NOT EXISTS patient_treatment_status (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER NOT NULL UNIQUE REFERENCES patients(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  start_date DATE,
  end_date DATE,
  total_visits INTEGER DEFAULT 0,
  last_visit_date DATE,
  next_scheduled_date DATE,
  closure_reason TEXT,
  closure_type VARCHAR(20),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5-3. 환자관리 자동 생성 규칙
CREATE TABLE IF NOT EXISTS patient_care_rules (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  trigger_event VARCHAR(50) NOT NULL,
  care_type VARCHAR(30) NOT NULL,
  title_template VARCHAR(200) NOT NULL,
  description_template TEXT,
  days_offset INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 6. 구입 요청 테이블
-- =====================================================

CREATE TABLE IF NOT EXISTS supply_requests (
  id SERIAL PRIMARY KEY,
  item_name TEXT NOT NULL,
  quantity TEXT,
  requested_by TEXT NOT NULL DEFAULT '관리자',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_supply_requests_status ON supply_requests(status);
CREATE INDEX IF NOT EXISTS idx_supply_requests_created_at ON supply_requests(created_at DESC);

-- =====================================================
-- 7. 미디어 관리 테이블
-- =====================================================

-- 7-1. 미디어 카테고리
CREATE TABLE IF NOT EXISTS media_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#6b7280',
  icon TEXT DEFAULT 'fa-folder',
  sort_order INTEGER DEFAULT 0,
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 기본 카테고리 추가
INSERT INTO media_categories (slug, name, icon, color, sort_order, is_system) VALUES
  ('uncategorized', '미분류', 'fa-folder', '#6b7280', 0, true),
  ('blog', '블로그', 'fa-pen-fancy', '#3b82f6', 1, true),
  ('guide', '안내페이지', 'fa-book-open', '#10b981', 2, true),
  ('landing', '랜딩페이지', 'fa-rocket', '#8b5cf6', 3, true),
  ('event', '이벤트', 'fa-gift', '#f59e0b', 4, true),
  ('product', '제품/치료', 'fa-pills', '#ec4899', 5, true),
  ('clinic', '한의원', 'fa-hospital', '#06b6d4', 6, true),
  ('icon', '아이콘/로고', 'fa-icons', '#6366f1', 7, true)
ON CONFLICT (slug) DO NOTHING;

-- 7-2. 미디어 파일
CREATE TABLE IF NOT EXISTS media_files (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  file_name TEXT NOT NULL,
  original_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER DEFAULT 0,
  mime_type TEXT,
  category TEXT NOT NULL DEFAULT 'uncategorized',
  alt_text TEXT,
  description TEXT,
  tags TEXT[],
  width INTEGER,
  height INTEGER,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_media_files_category ON media_files(category);
CREATE INDEX IF NOT EXISTS idx_media_files_created_at ON media_files(created_at DESC);

-- =====================================================
-- 8. 블로그 시스템 테이블
-- =====================================================

-- 8-1. 블로그 시리즈
CREATE TABLE IF NOT EXISTS blog_series (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(200) NOT NULL,
  slug VARCHAR(200) NOT NULL UNIQUE,
  description TEXT,
  thumbnail_url TEXT,
  post_count INT DEFAULT 0,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8-2. 블로그 포스트
CREATE TABLE IF NOT EXISTS blog_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(200) NOT NULL,
  slug VARCHAR(200) NOT NULL UNIQUE,
  excerpt TEXT,
  content TEXT NOT NULL,
  content_format VARCHAR(20) DEFAULT 'markdown',
  category VARCHAR(50) NOT NULL,
  tags TEXT[],
  author_id UUID REFERENCES portal_users(id),
  author_name VARCHAR(100),
  author_profile TEXT,
  thumbnail_url TEXT,
  images TEXT[],
  meta_title VARCHAR(70),
  meta_description VARCHAR(160),
  meta_keywords TEXT[],
  canonical_url TEXT,
  og_image TEXT,
  status VARCHAR(20) DEFAULT 'draft',
  published_at TIMESTAMPTZ,
  scheduled_at TIMESTAMPTZ,
  series_id UUID REFERENCES blog_series(id),
  series_order INT,
  related_post_ids UUID[],
  view_count INT DEFAULT 0,
  unique_visitor_count INT DEFAULT 0,
  avg_read_time INT DEFAULT 0,
  like_count INT DEFAULT 0,
  share_count INT DEFAULT 0,
  comment_count INT DEFAULT 0,
  notification_sent BOOLEAN DEFAULT FALSE,
  notification_sent_at TIMESTAMPTZ,
  reading_time INT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES portal_users(id),
  updated_by UUID REFERENCES portal_users(id)
);

CREATE INDEX IF NOT EXISTS idx_blog_posts_slug ON blog_posts(slug);
CREATE INDEX IF NOT EXISTS idx_blog_posts_status ON blog_posts(status);
CREATE INDEX IF NOT EXISTS idx_blog_posts_category ON blog_posts(category);
CREATE INDEX IF NOT EXISTS idx_blog_posts_published_at ON blog_posts(published_at DESC);

-- 8-3. 블로그 조회 기록
CREATE TABLE IF NOT EXISTS blog_page_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES blog_posts(id) ON DELETE CASCADE,
  visitor_id VARCHAR(100),
  session_id VARCHAR(100),
  ip_address INET,
  user_agent TEXT,
  referrer TEXT,
  utm_source VARCHAR(100),
  utm_medium VARCHAR(100),
  utm_campaign VARCHAR(100),
  tracking_id VARCHAR(50),
  entered_at TIMESTAMPTZ DEFAULT NOW(),
  exited_at TIMESTAMPTZ,
  dwell_time INT,
  scroll_depth INT,
  read_completion INT,
  converted BOOLEAN DEFAULT FALSE,
  conversion_type VARCHAR(50),
  converted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_blog_page_views_post ON blog_page_views(post_id);
CREATE INDEX IF NOT EXISTS idx_blog_page_views_date ON blog_page_views(entered_at DESC);

-- 8-4. 블로그 구독자
CREATE TABLE IF NOT EXISTS blog_subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100),
  phone VARCHAR(20) UNIQUE,
  email VARCHAR(255) UNIQUE,
  patient_id UUID,
  subscribe_type VARCHAR(20) DEFAULT 'kakao',
  subscribed_categories TEXT[],
  status VARCHAR(20) DEFAULT 'active',
  is_active BOOLEAN DEFAULT true,
  subscribed_at TIMESTAMPTZ DEFAULT NOW(),
  unsubscribed_at TIMESTAMPTZ,
  unsubscribe_reason TEXT,
  kakao_user_id VARCHAR(100),
  kakao_opt_in BOOLEAN DEFAULT FALSE,
  total_notifications INT DEFAULT 0,
  opened_notifications INT DEFAULT 0,
  last_opened_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_blog_subscribers_status ON blog_subscribers(status);

-- 8-5. 블로그 알림 발송
CREATE TABLE IF NOT EXISTS blog_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES blog_posts(id),
  channel VARCHAR(20) NOT NULL,
  template_code VARCHAR(50),
  total_recipients INT DEFAULT 0,
  sent_count INT DEFAULT 0,
  delivered_count INT DEFAULT 0,
  failed_count INT DEFAULT 0,
  opened_count INT DEFAULT 0,
  clicked_count INT DEFAULT 0,
  status VARCHAR(20) DEFAULT 'pending',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES portal_users(id)
);

-- 8-6. 블로그 댓글
CREATE TABLE IF NOT EXISTS blog_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES blog_posts(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES blog_comments(id),
  author_name VARCHAR(100) NOT NULL,
  author_phone VARCHAR(20),
  patient_id UUID,
  content TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  is_pinned BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES portal_users(id)
);

CREATE INDEX IF NOT EXISTS idx_blog_comments_post ON blog_comments(post_id);

-- =====================================================
-- 9. RLS 정책 (Row Level Security)
-- =====================================================

-- 모든 테이블에 RLS 활성화 및 정책 설정
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE'
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);

    -- 기존 정책 삭제 (있으면)
    EXECUTE format('DROP POLICY IF EXISTS "Enable all access" ON %I', t);

    -- 모든 접근 허용 정책 생성
    EXECUTE format('CREATE POLICY "Enable all access" ON %I FOR ALL USING (true) WITH CHECK (true)', t);
  END LOOP;
END
$$;

-- =====================================================
-- 10. updated_at 자동 업데이트 함수 및 트리거
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성 (updated_at 컬럼이 있는 테이블에)
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT table_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND column_name = 'updated_at'
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trigger_updated_at ON %I', t);
    EXECUTE format('CREATE TRIGGER trigger_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()', t);
  END LOOP;
END
$$;

-- =====================================================
-- 11. 실시간 구독 활성화 (Realtime)
-- =====================================================

-- 주요 테이블 Realtime 활성화
ALTER PUBLICATION supabase_realtime ADD TABLE patients;
ALTER PUBLICATION supabase_realtime ADD TABLE reservations;
ALTER PUBLICATION supabase_realtime ADD TABLE waiting_queue;
ALTER PUBLICATION supabase_realtime ADD TABLE payments;
ALTER PUBLICATION supabase_realtime ADD TABLE treatment_rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE supply_requests;

-- =====================================================
-- 12. 기본 데이터 삽입
-- =====================================================

-- 할일 템플릿
INSERT INTO task_templates (trigger_service, task_type, title_template, description_template, default_priority, due_days_offset, display_order) VALUES
  ('initial_consult', 'write_initial_chart', '{patient_name} 초진차트 작성', '초진 환자의 차트를 작성해주세요.', 'high', 0, 1),
  ('medication_consult', 'write_progress_note', '{patient_name} 경과기록 작성', '약상담 내용을 경과기록에 작성해주세요.', 'normal', 0, 1),
  ('medication_consult', 'write_prescription', '{patient_name} 처방전 작성', '처방전을 작성해주세요.', 'high', 0, 2),
  ('herbal_medicine', 'order_herbal_medicine', '{patient_name} 한약 주문', '탕전실에 한약을 주문해주세요.', 'high', 0, 2),
  ('consultation', 'write_progress_note', '{patient_name} 경과기록 작성', '진료 내용을 경과기록에 작성해주세요.', 'normal', 0, 1)
ON CONFLICT DO NOTHING;

-- 환자관리 규칙
INSERT INTO patient_care_rules (name, trigger_event, care_type, title_template, description_template, days_offset) VALUES
  ('한약 배송 후 해피콜', 'herbal_delivery', 'happy_call_delivery', '{patient_name} 한약 배송 해피콜', '한약이 잘 도착했는지 확인해주세요.', 1),
  ('복약 7일차 해피콜', 'herbal_start', 'happy_call_medication', '{patient_name} 복약 7일차 해피콜', '복약 중 불편한 점이 없는지 확인해주세요.', 7),
  ('30일 미방문 관리', 'days_since_last_visit_30', 'periodic_message', '{patient_name} 안부 연락', '오랜만에 연락드려 안부를 여쭤보세요.', 0)
ON CONFLICT DO NOTHING;

-- =====================================================
-- 완료 메시지
-- =====================================================
SELECT 'haniwon 전체 스키마 생성 완료!' as message;
