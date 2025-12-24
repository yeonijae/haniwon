-- =====================================================
-- Chart Module SQLite Schema
-- 진료관리 모듈용 테이블
-- 생성일: 2024-12-24
-- =====================================================

-- =====================================================
-- 1. 초진 차트 (Initial Charts)
-- =====================================================
CREATE TABLE IF NOT EXISTS initial_charts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL,
  chart_date TEXT NOT NULL DEFAULT (date('now')),
  notes TEXT,                    -- 전체 차트 내용 (섹션별 텍스트)
  is_auto_saved INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_initial_charts_patient ON initial_charts(patient_id);
CREATE INDEX IF NOT EXISTS idx_initial_charts_date ON initial_charts(chart_date);

-- =====================================================
-- 2. 진단 기록 (Diagnoses)
-- =====================================================
CREATE TABLE IF NOT EXISTS diagnoses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL,
  diagnosis_name TEXT NOT NULL,
  icd_code TEXT,
  diagnosis_date TEXT NOT NULL DEFAULT (date('now')),
  status TEXT DEFAULT 'active',     -- active, resolved, chronic, ruled-out
  severity TEXT DEFAULT 'moderate', -- mild, moderate, severe
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_diagnoses_patient ON diagnoses(patient_id);
CREATE INDEX IF NOT EXISTS idx_diagnoses_status ON diagnoses(status);

-- =====================================================
-- 3. 경과 기록 (Progress Notes) - SOAP 형식 확장
-- =====================================================
-- 기존 progress_notes 테이블이 있으면 삭제 후 재생성
DROP TABLE IF EXISTS progress_notes;

CREATE TABLE IF NOT EXISTS progress_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL,
  note_date TEXT NOT NULL DEFAULT (datetime('now')),
  subjective TEXT,      -- S: 주관적 증상
  objective TEXT,       -- O: 객관적 소견
  assessment TEXT,      -- A: 평가
  plan TEXT,            -- P: 계획
  follow_up_plan TEXT,  -- 추적 계획
  notes TEXT,           -- 기타 메모
  doctor_id INTEGER,
  doctor_name TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_progress_notes_patient ON progress_notes(patient_id);
CREATE INDEX IF NOT EXISTS idx_progress_notes_date ON progress_notes(note_date);

-- =====================================================
-- 4. 처방전 (Prescriptions)
-- =====================================================
CREATE TABLE IF NOT EXISTS prescriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL,
  patient_name TEXT,
  patient_age INTEGER,
  patient_gender TEXT,
  chart_number TEXT,

  -- 처방 내용
  formula TEXT,                    -- 처방명/방명
  merged_herbs TEXT,               -- JSON: 합방된 약재 목록
  final_herbs TEXT,                -- JSON: 최종 약재 목록 [{name, amount, unit}]
  days INTEGER DEFAULT 15,         -- 복용일수
  packs INTEGER,                   -- 팩수
  total_amount REAL,               -- 총 금액

  -- 출처 정보
  source_type TEXT,                -- initial_chart, progress_note
  source_id INTEGER,

  -- 상태
  status TEXT DEFAULT 'draft',     -- draft, submitted, issued, completed
  issued_at TEXT,
  completed_at TEXT,

  -- 복용법
  dosage_instruction_created INTEGER DEFAULT 0,
  dosage_instruction_created_at TEXT,
  dosage_instruction_data TEXT,    -- JSON: 복용법 전체 데이터

  -- 발송/배송
  prescription_issued INTEGER DEFAULT 0,
  prescription_issued_at TEXT,

  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_prescriptions_patient ON prescriptions(patient_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_status ON prescriptions(status);
CREATE INDEX IF NOT EXISTS idx_prescriptions_issued ON prescriptions(issued_at);

-- =====================================================
-- 5. 처방 정의 (Prescription Definitions) - 확장
-- =====================================================
-- 기존 테이블에 컬럼 추가 (ALTER TABLE 사용)
-- SQLite는 ADD COLUMN만 지원하므로 새 테이블로 재생성

DROP TABLE IF EXISTS prescription_definitions;

CREATE TABLE IF NOT EXISTS prescription_definitions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  alias TEXT,                      -- 별칭
  category TEXT,
  source TEXT,                     -- 출처
  composition TEXT,                -- 구성: herb1:amount1/herb2:amount2/...
  description TEXT,
  is_active INTEGER DEFAULT 1,
  created_by TEXT DEFAULT '관리자',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_prescription_definitions_category ON prescription_definitions(category);
CREATE INDEX IF NOT EXISTS idx_prescription_definitions_name ON prescription_definitions(name);

-- =====================================================
-- 6. 처방 카테고리 (Prescription Categories)
-- =====================================================
CREATE TABLE IF NOT EXISTS prescription_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- =====================================================
-- 7. 복용법 템플릿 (Dosage Instructions)
-- =====================================================
CREATE TABLE IF NOT EXISTS dosage_instructions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL,          -- 대분류
  subcategory TEXT,                -- 소분류
  disease_name TEXT NOT NULL,      -- 질환명
  condition_detail TEXT,           -- 세부 상태
  description TEXT,                -- 설명
  dosage_method TEXT,              -- 복용방법
  precautions TEXT,                -- 주의사항
  keywords TEXT,                   -- JSON: 검색 키워드 배열
  full_text TEXT,                  -- 전체 텍스트 (검색용)
  source_filename TEXT,            -- 원본 파일명
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_dosage_instructions_category ON dosage_instructions(category);
CREATE INDEX IF NOT EXISTS idx_dosage_instructions_disease ON dosage_instructions(disease_name);

-- =====================================================
-- 8. 주의사항 프리셋 (Precaution Presets)
-- =====================================================
CREATE TABLE IF NOT EXISTS precaution_presets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  items TEXT,                      -- JSON: 항목 배열
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- =====================================================
-- 9. 사후관리 통화 기록 (Aftercare Calls)
-- =====================================================
CREATE TABLE IF NOT EXISTS aftercare_calls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL,
  prescription_id INTEGER NOT NULL,
  call_date TEXT NOT NULL,
  call_result TEXT NOT NULL,       -- connected, no_answer, callback, completed
  notes TEXT,
  next_action TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_aftercare_calls_patient ON aftercare_calls(patient_id);
CREATE INDEX IF NOT EXISTS idx_aftercare_calls_prescription ON aftercare_calls(prescription_id);

-- =====================================================
-- 10. 약재 테이블 확장 (herbs 테이블이 이미 있으면 무시)
-- =====================================================
-- herbs 테이블은 이미 init-sqlite-schema.sql에 있음

-- =====================================================
-- 완료
-- =====================================================
