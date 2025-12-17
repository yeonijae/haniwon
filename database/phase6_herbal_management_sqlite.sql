-- =====================================================
-- Phase 6: 한약 복약관리 (Herbal Management) 테이블
-- SQLite 버전
-- =====================================================

-- =====================================================
-- 1. 이벤트 테이블 (공진단/경옥고 등) - 먼저 생성
-- =====================================================
CREATE TABLE IF NOT EXISTS herbal_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  herbal_types TEXT,  -- JSON array: '["hwan", "go"]'
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  benefit_message TEXT,
  status TEXT DEFAULT 'active',  -- active / ended / benefit_sent
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- =====================================================
-- 2. 한약 구매/복약관리 테이블
-- =====================================================
CREATE TABLE IF NOT EXISTS herbal_purchases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  -- 오케이차트 연동 (중복 방지)
  receipt_pk INTEGER,
  customer_pk INTEGER,
  okc_tx_date TEXT,
  okc_tx_money INTEGER,

  -- 환자 정보
  patient_id INTEGER,
  patient_chart_number TEXT,
  patient_name TEXT,
  patient_phone TEXT,

  -- 한약 정보
  herbal_type TEXT NOT NULL,  -- tang(탕약) / hwan(환제) / go(고제)
  herbal_name TEXT,
  sequence_code TEXT,  -- 차수 (6차, 7차 등)

  -- 수량 관리
  total_count INTEGER DEFAULT 1,
  remaining_count INTEGER DEFAULT 1,
  dose_per_day INTEGER DEFAULT 3,

  -- 수령/복약 일정
  delivery_method TEXT,  -- pickup(내원) / delivery(택배)
  delivery_date TEXT,
  start_date TEXT,
  expected_end_date TEXT,
  actual_end_date TEXT,

  -- 이벤트 연동 (공진단/경옥고)
  event_id INTEGER REFERENCES herbal_events(id),
  event_benefit_sent INTEGER DEFAULT 0,
  event_benefit_sent_at TEXT,

  -- 상태
  status TEXT DEFAULT 'active',  -- active / paused / completed
  memo TEXT,

  -- 타임스탬프
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- 중복 방지 인덱스
CREATE UNIQUE INDEX IF NOT EXISTS idx_herbal_purchases_receipt
  ON herbal_purchases(receipt_pk) WHERE receipt_pk IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_herbal_purchases_patient ON herbal_purchases(patient_id);
CREATE INDEX IF NOT EXISTS idx_herbal_purchases_status ON herbal_purchases(status);
CREATE INDEX IF NOT EXISTS idx_herbal_purchases_chart ON herbal_purchases(patient_chart_number);

-- =====================================================
-- 3. 복약 콜 관리 테이블
-- =====================================================
CREATE TABLE IF NOT EXISTS herbal_calls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  -- 연결
  purchase_id INTEGER NOT NULL REFERENCES herbal_purchases(id) ON DELETE CASCADE,
  patient_id INTEGER,

  -- 콜 정보
  call_type TEXT NOT NULL,  -- chojin(초진콜) / bokyak(복약콜) / naewon(내원콜)
  scheduled_date TEXT NOT NULL,

  -- 상태
  status TEXT DEFAULT 'pending',  -- pending / completed / skipped / rescheduled

  -- 완료 정보
  completed_at TEXT,
  completed_by TEXT,
  contact_method TEXT,  -- phone / kakao / sms
  result TEXT,

  -- 재예약
  rescheduled_from INTEGER REFERENCES herbal_calls(id),
  reschedule_reason TEXT,

  -- 타임스탬프
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_herbal_calls_purchase ON herbal_calls(purchase_id);
CREATE INDEX IF NOT EXISTS idx_herbal_calls_scheduled ON herbal_calls(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_herbal_calls_status ON herbal_calls(status);

-- =====================================================
-- 4. 차감 기록 테이블
-- =====================================================
CREATE TABLE IF NOT EXISTS herbal_consumptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  purchase_id INTEGER NOT NULL REFERENCES herbal_purchases(id) ON DELETE CASCADE,

  consume_date TEXT NOT NULL DEFAULT (date('now')),
  consume_count INTEGER NOT NULL DEFAULT 1,
  consume_type TEXT NOT NULL,  -- dose(복용) / pickup(수령)

  remaining_after INTEGER NOT NULL,

  staff_name TEXT,
  memo TEXT,

  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_herbal_consumptions_purchase ON herbal_consumptions(purchase_id);

-- =====================================================
-- 5. 휴약 기간 테이블
-- =====================================================
CREATE TABLE IF NOT EXISTS herbal_pauses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  purchase_id INTEGER NOT NULL REFERENCES herbal_purchases(id) ON DELETE CASCADE,

  pause_start TEXT NOT NULL,
  pause_end TEXT,
  reason TEXT,
  remaining_at_pause INTEGER,

  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_herbal_pauses_purchase ON herbal_pauses(purchase_id);

-- =====================================================
-- 완료
-- =====================================================
