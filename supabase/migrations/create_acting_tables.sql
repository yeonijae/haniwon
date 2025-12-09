-- 액팅 관리 시스템 테이블
-- 생성일: 2024-12-08

-- 1. 액팅 종류 마스터 테이블
CREATE TABLE IF NOT EXISTS acting_types (
  id              SERIAL PRIMARY KEY,
  name            VARCHAR(50) NOT NULL UNIQUE,  -- 침, 추나, 부항, 뜸, 약침, 초음파, 상담, 재초진 등
  category        VARCHAR(20),                   -- basic(기본진료), consult(상담), etc
  standard_min    INTEGER DEFAULT 5,             -- 표준 소요시간 (분)
  slot_usage      INTEGER DEFAULT 1,             -- 예약 슬롯 사용량
  display_order   INTEGER DEFAULT 0,             -- 표시 순서
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 기본 액팅 종류 삽입
INSERT INTO acting_types (name, category, standard_min, slot_usage, display_order) VALUES
  ('침', 'basic', 5, 1, 1),
  ('추나', 'basic', 8, 1, 2),
  ('부항', 'basic', 5, 1, 3),
  ('뜸', 'basic', 5, 1, 4),
  ('약침', 'basic', 5, 1, 5),
  ('초음파', 'basic', 10, 1, 6),
  ('상담', 'consult', 15, 2, 7),
  ('재초진', 'consult', 10, 2, 8),
  ('신규약상담', 'consult', 30, 6, 9),
  ('약재진', 'consult', 15, 3, 10)
ON CONFLICT (name) DO NOTHING;

-- 2. 액팅 대기열 테이블
CREATE TABLE IF NOT EXISTS acting_queue (
  id              SERIAL PRIMARY KEY,
  patient_id      INTEGER NOT NULL,              -- 환자 ID (MSSQL Customer_PK)
  patient_name    VARCHAR(50) NOT NULL,          -- 환자 이름 (조회 편의)
  chart_no        VARCHAR(20),                   -- 차트번호
  doctor_id       INTEGER NOT NULL,              -- 담당 의료진 ID
  doctor_name     VARCHAR(50) NOT NULL,          -- 의료진 이름 (조회 편의)
  acting_type     VARCHAR(50) NOT NULL,          -- 액팅 종류
  order_num       INTEGER NOT NULL DEFAULT 0,    -- 대기열 순서
  status          VARCHAR(20) DEFAULT 'waiting', -- waiting, in_progress, completed, cancelled
  source          VARCHAR(20) DEFAULT 'manual',  -- reservation(예약연동), manual(수동추가)
  source_id       INTEGER,                       -- 원본 예약 ID (있는 경우)
  memo            TEXT,                          -- 메모
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  started_at      TIMESTAMP WITH TIME ZONE,      -- 시작 시간
  completed_at    TIMESTAMP WITH TIME ZONE,      -- 완료 시간
  duration_sec    INTEGER,                       -- 소요시간 (초)
  work_date       DATE DEFAULT CURRENT_DATE      -- 작업 날짜 (인덱싱용)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_acting_queue_doctor_date
  ON acting_queue(doctor_id, work_date);
CREATE INDEX IF NOT EXISTS idx_acting_queue_status
  ON acting_queue(status) WHERE status IN ('waiting', 'in_progress');
CREATE INDEX IF NOT EXISTS idx_acting_queue_work_date
  ON acting_queue(work_date);

-- 3. 원장 상태 테이블
CREATE TABLE IF NOT EXISTS doctor_status (
  doctor_id       INTEGER PRIMARY KEY,
  doctor_name     VARCHAR(50) NOT NULL,
  status          VARCHAR(20) DEFAULT 'office',  -- in_progress(진료중), waiting(대기중), office(원장실), away(부재)
  current_acting_id INTEGER REFERENCES acting_queue(id) ON DELETE SET NULL,
  status_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. 액팅 기록 테이블 (완료된 액팅 통계용)
CREATE TABLE IF NOT EXISTS acting_records (
  id              SERIAL PRIMARY KEY,
  patient_id      INTEGER NOT NULL,
  patient_name    VARCHAR(50),
  chart_no        VARCHAR(20),
  doctor_id       INTEGER NOT NULL,
  doctor_name     VARCHAR(50),
  acting_type     VARCHAR(50) NOT NULL,
  started_at      TIMESTAMP WITH TIME ZONE NOT NULL,
  completed_at    TIMESTAMP WITH TIME ZONE NOT NULL,
  duration_sec    INTEGER NOT NULL,
  work_date       DATE NOT NULL,
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_acting_records_doctor_date
  ON acting_records(doctor_id, work_date);
CREATE INDEX IF NOT EXISTS idx_acting_records_type_date
  ON acting_records(acting_type, work_date);

-- 5. 원장별 평균 시간 집계 뷰
CREATE OR REPLACE VIEW doctor_acting_stats AS
SELECT
  doctor_id,
  doctor_name,
  acting_type,
  COUNT(*) as total_count,
  ROUND(AVG(duration_sec)) as avg_duration_sec,
  ROUND(AVG(duration_sec) / 60.0, 1) as avg_duration_min,
  MIN(duration_sec) as min_duration_sec,
  MAX(duration_sec) as max_duration_sec
FROM acting_records
WHERE work_date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY doctor_id, doctor_name, acting_type;

-- 6. 일별 통계 뷰
CREATE OR REPLACE VIEW daily_acting_stats AS
SELECT
  work_date,
  doctor_id,
  doctor_name,
  COUNT(*) as total_count,
  SUM(duration_sec) as total_duration_sec,
  ROUND(SUM(duration_sec) / 60.0) as total_duration_min,
  ROUND(AVG(duration_sec)) as avg_duration_sec
FROM acting_records
GROUP BY work_date, doctor_id, doctor_name
ORDER BY work_date DESC, doctor_name;

-- RLS (Row Level Security) 정책
ALTER TABLE acting_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE acting_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctor_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE acting_types ENABLE ROW LEVEL SECURITY;

-- 모든 인증된 사용자에게 읽기/쓰기 허용
CREATE POLICY "Allow all for authenticated users" ON acting_queue
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for authenticated users" ON acting_records
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for authenticated users" ON doctor_status
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for authenticated users" ON acting_types
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- anon 사용자에게도 허용 (개발 편의)
CREATE POLICY "Allow all for anon users" ON acting_queue
  FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for anon users" ON acting_records
  FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for anon users" ON doctor_status
  FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for anon users" ON acting_types
  FOR ALL TO anon USING (true) WITH CHECK (true);
