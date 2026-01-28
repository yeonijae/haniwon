-- Migration: Add treatment_plans table (PostgreSQL)
-- Created: 2024-01-28
-- Description: 진료 계획 테이블 추가

-- =====================================================
-- 진료 계획 (Treatment Plans)
-- =====================================================
CREATE TABLE IF NOT EXISTS treatment_plans (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER NOT NULL,
  initial_chart_id INTEGER,           -- 연결된 초진차트
  disease_name VARCHAR(200),          -- 질환명 (선택적)
  planned_duration_weeks INTEGER,     -- 예상 치료기간 (주)
  planned_visits INTEGER,             -- 예상 내원횟수
  visit_frequency VARCHAR(50),        -- 내원 빈도 (예: "주 2회")
  estimated_cost_per_visit INTEGER,   -- 1회 예상 비용
  estimated_total_cost INTEGER,       -- 총 예상 비용
  selected_programs JSONB DEFAULT '[]', -- 선택된 치료 프로그램들
  notes TEXT,                         -- 비고
  status VARCHAR(20) DEFAULT 'active', -- active, completed, cancelled
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_treatment_plans_patient ON treatment_plans(patient_id);
CREATE INDEX IF NOT EXISTS idx_treatment_plans_status ON treatment_plans(status);
