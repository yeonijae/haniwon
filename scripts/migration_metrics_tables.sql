-- 지표관리 테이블 생성
-- 실행일: 2026-02-05

-- 1. 원장별 누적 지표
CREATE TABLE IF NOT EXISTS doctor_metrics_summary (
  id SERIAL PRIMARY KEY,
  doctor_id VARCHAR(20) NOT NULL,        -- doctor_3
  doctor_name VARCHAR(50) NOT NULL,
  hire_date DATE,                         -- 입사일

  -- 누적 초진 (입사일부터)
  total_chim_new INT DEFAULT 0,           -- 침 신규초진
  total_chim_re INT DEFAULT 0,            -- 침 재초진
  total_jabo_new INT DEFAULT 0,           -- 자보 신규초진
  total_jabo_re INT DEFAULT 0,            -- 자보 재초진
  total_yak_new INT DEFAULT 0,            -- 약 신규초진
  total_yak_re INT DEFAULT 0,             -- 약 재초진

  -- 누적 재진율/삼진율/이탈율 (추적 완료된 것만)
  total_rejin_count INT DEFAULT 0,        -- 재진 달성 수
  total_samjin_count INT DEFAULT 0,       -- 삼진 달성 수
  total_ital_count INT DEFAULT 0,         -- 이탈 수
  total_tracked_choojin INT DEFAULT 0,    -- 추적 완료된 총 초진 수

  -- 매출 누적
  total_insurance_revenue BIGINT DEFAULT 0,
  total_jabo_revenue BIGINT DEFAULT 0,
  total_uncovered_revenue BIGINT DEFAULT 0,

  -- 환자수 누적 (객단가 계산용)
  total_insurance_patients INT DEFAULT 0,
  total_jabo_patients INT DEFAULT 0,
  total_uncovered_patients INT DEFAULT 0,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(doctor_id)
);

-- 2. 주차별 지표 히스토리
CREATE TABLE IF NOT EXISTS doctor_metrics_weekly (
  id SERIAL PRIMARY KEY,
  year INT NOT NULL,
  week INT NOT NULL,                      -- ISO 주차 (1-53)
  week_start_date DATE,                   -- 주 시작일
  week_end_date DATE,                     -- 주 종료일
  doctor_id VARCHAR(20) NOT NULL,
  doctor_name VARCHAR(50),

  -- 초진 수
  chim_new INT DEFAULT 0,                 -- 침 신규초진
  chim_re INT DEFAULT 0,                  -- 침 재초진
  jabo_new INT DEFAULT 0,                 -- 자보 신규초진
  jabo_re INT DEFAULT 0,                  -- 자보 재초진
  yak_new INT DEFAULT 0,                  -- 약 신규초진
  yak_re INT DEFAULT 0,                   -- 약 재초진

  -- 재진율/삼진율/이탈율 (해당 주 초진 기준, +3주 후 계산)
  total_choojin INT DEFAULT 0,            -- 해당 주 총 초진
  rejin_count INT DEFAULT 0,              -- 재진 달성 수
  samjin_count INT DEFAULT 0,             -- 삼진 달성 수
  ital_count INT DEFAULT 0,               -- 이탈 수
  rejin_rate DECIMAL(5,2),                -- 재진율 %
  samjin_rate DECIMAL(5,2),               -- 삼진율 %
  ital_rate DECIMAL(5,2),                 -- 이탈율 %
  tracking_end_date DATE,                 -- 추적 종료일 (주 시작일 + 21일)
  tracking_completed BOOLEAN DEFAULT FALSE,

  -- 매출
  insurance_revenue BIGINT DEFAULT 0,
  jabo_revenue BIGINT DEFAULT 0,
  uncovered_revenue BIGINT DEFAULT 0,

  -- 환자수 (객단가 계산용)
  insurance_patients INT DEFAULT 0,
  jabo_patients INT DEFAULT 0,
  uncovered_patients INT DEFAULT 0,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(year, week, doctor_id)
);

-- 3. 초진 환자 방문 추적
CREATE TABLE IF NOT EXISTS choojin_visit_tracking (
  id SERIAL PRIMARY KEY,
  customer_pk INT NOT NULL,               -- MSSQL Customer_PK
  chart_no VARCHAR(20),
  patient_name VARCHAR(50),
  choojin_date DATE NOT NULL,             -- 초진일
  choojin_year INT,                       -- 초진 연도
  choojin_week INT,                       -- 초진 주차
  choojin_type VARCHAR(10),               -- chim/jabo/yak
  choojin_sub_type VARCHAR(10),           -- new/re (신규/재초진)
  doctor_id VARCHAR(20),
  doctor_name VARCHAR(50),
  insurance_type VARCHAR(20),             -- 건보/1종/2종/차상위/산정특례/임산부/자보

  -- 추적 결과 (+21일 후 계산)
  visit_count INT DEFAULT 1,              -- 추적 기간 내 총 방문 횟수
  visit_dates TEXT,                       -- 방문일 목록 (JSON)
  last_visit_date DATE,
  is_rejin BOOLEAN,                       -- 2회 이상 방문
  is_samjin BOOLEAN,                      -- 3회 이상 방문
  is_ital BOOLEAN,                        -- 1회만 방문
  tracking_end_date DATE,                 -- 추적 종료일 (초진일 + 21일)
  tracking_completed BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(customer_pk, choojin_date)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_metrics_weekly_year_week ON doctor_metrics_weekly(year, week);
CREATE INDEX IF NOT EXISTS idx_metrics_weekly_doctor ON doctor_metrics_weekly(doctor_id);
CREATE INDEX IF NOT EXISTS idx_choojin_tracking_date ON choojin_visit_tracking(choojin_date);
CREATE INDEX IF NOT EXISTS idx_choojin_tracking_doctor ON choojin_visit_tracking(doctor_id);
CREATE INDEX IF NOT EXISTS idx_choojin_tracking_week ON choojin_visit_tracking(choojin_year, choojin_week);
CREATE INDEX IF NOT EXISTS idx_choojin_tracking_completed ON choojin_visit_tracking(tracking_completed);

-- 코멘트
COMMENT ON TABLE doctor_metrics_summary IS '원장별 누적 지표 (입사일부터 현재까지)';
COMMENT ON TABLE doctor_metrics_weekly IS '주차별 지표 히스토리';
COMMENT ON TABLE choojin_visit_tracking IS '초진 환자 방문 추적 (재진율/삼진율/이탈율 계산용)';
