-- =====================================================
-- Phase 6: 한약 복약관리 (Herbal Management) 테이블
-- Supabase SQL Editor에서 실행
-- =====================================================

-- =====================================================
-- 1. 한약 구매/복약관리 테이블
-- =====================================================
CREATE TABLE IF NOT EXISTS herbal_purchases (
  id SERIAL PRIMARY KEY,

  -- 오케이차트 연동 (중복 방지)
  receipt_pk INTEGER,              -- MSSQL Receipt PK
  detail_pk INTEGER,               -- MSSQL Detail PK
  okc_tx_date DATE,                -- 오케이차트 결제일
  okc_tx_item VARCHAR(200),        -- 원본 TxItem
  okc_tx_money INTEGER,            -- 결제 금액

  -- 환자 정보
  patient_id INTEGER REFERENCES patients(id) ON DELETE SET NULL,
  patient_chart_number VARCHAR(20),
  patient_name VARCHAR(100),

  -- 한약 정보
  herbal_type VARCHAR(20) NOT NULL,  -- tang(탕약) / hwan(환제) / go(고제)
  herbal_name VARCHAR(100),          -- 한약명
  sequence_code VARCHAR(20),         -- 차수 (6차, 7차 등)

  -- 수량 관리
  total_count INTEGER DEFAULT 1,     -- 총 개수/횟수
  remaining_count INTEGER DEFAULT 1, -- 남은 개수/횟수
  dose_per_day INTEGER DEFAULT 3,    -- 하루 복용 횟수 (탕약용)

  -- 수령/복약 일정
  delivery_method VARCHAR(20),       -- pickup(내원) / delivery(택배)
  delivery_date DATE,                -- 수령/발송일
  start_date DATE,                   -- 복용 시작일
  expected_end_date DATE,            -- 예상 종료일
  actual_end_date DATE,              -- 실제 종료일

  -- 이벤트 연동 (공진단/경옥고)
  event_id INTEGER REFERENCES herbal_events(id) ON DELETE SET NULL,
  event_benefit_sent BOOLEAN DEFAULT false,
  event_benefit_sent_at TIMESTAMPTZ,

  -- 상태
  status VARCHAR(20) DEFAULT 'active',  -- active / paused / completed
  memo TEXT,

  -- 타임스탬프
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 중복 방지 인덱스
CREATE UNIQUE INDEX IF NOT EXISTS idx_herbal_purchases_okc
  ON herbal_purchases(receipt_pk, detail_pk)
  WHERE receipt_pk IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_herbal_purchases_patient ON herbal_purchases(patient_id);
CREATE INDEX IF NOT EXISTS idx_herbal_purchases_status ON herbal_purchases(status);
CREATE INDEX IF NOT EXISTS idx_herbal_purchases_chart ON herbal_purchases(patient_chart_number);

-- =====================================================
-- 2. 복약 콜 관리 테이블
-- =====================================================
CREATE TABLE IF NOT EXISTS herbal_calls (
  id SERIAL PRIMARY KEY,

  -- 연결
  purchase_id INTEGER NOT NULL REFERENCES herbal_purchases(id) ON DELETE CASCADE,
  patient_id INTEGER REFERENCES patients(id) ON DELETE SET NULL,

  -- 콜 정보
  call_type VARCHAR(20) NOT NULL,    -- chojin(초진콜) / bokyak(복약콜) / naewon(내원콜)
  scheduled_date DATE NOT NULL,      -- 예정일

  -- 상태
  status VARCHAR(20) DEFAULT 'pending',  -- pending / completed / skipped / rescheduled

  -- 완료 정보
  completed_at TIMESTAMPTZ,
  completed_by VARCHAR(50),
  contact_method VARCHAR(20),        -- phone / kakao / sms
  result TEXT,                       -- 통화 내용/결과

  -- 재예약 (휴약 등으로 인한)
  rescheduled_from INTEGER REFERENCES herbal_calls(id),
  reschedule_reason TEXT,

  -- 타임스탬프
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_herbal_calls_purchase ON herbal_calls(purchase_id);
CREATE INDEX IF NOT EXISTS idx_herbal_calls_scheduled ON herbal_calls(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_herbal_calls_status ON herbal_calls(status);
CREATE INDEX IF NOT EXISTS idx_herbal_calls_type_status ON herbal_calls(call_type, status);

-- =====================================================
-- 3. 차감 기록 테이블
-- =====================================================
CREATE TABLE IF NOT EXISTS herbal_consumptions (
  id SERIAL PRIMARY KEY,

  purchase_id INTEGER NOT NULL REFERENCES herbal_purchases(id) ON DELETE CASCADE,

  -- 차감 정보
  consume_date DATE NOT NULL DEFAULT CURRENT_DATE,
  consume_count INTEGER NOT NULL DEFAULT 1,  -- 차감 개수
  consume_type VARCHAR(20) NOT NULL,         -- dose(복용) / pickup(수령)

  -- 잔여
  remaining_after INTEGER NOT NULL,          -- 차감 후 남은 수량

  -- 기록
  staff_name VARCHAR(50),
  memo TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_herbal_consumptions_purchase ON herbal_consumptions(purchase_id);
CREATE INDEX IF NOT EXISTS idx_herbal_consumptions_date ON herbal_consumptions(consume_date);

-- =====================================================
-- 4. 휴약 기간 테이블
-- =====================================================
CREATE TABLE IF NOT EXISTS herbal_pauses (
  id SERIAL PRIMARY KEY,

  purchase_id INTEGER NOT NULL REFERENCES herbal_purchases(id) ON DELETE CASCADE,

  pause_start DATE NOT NULL,
  pause_end DATE,                    -- NULL이면 진행 중
  reason TEXT,
  remaining_at_pause INTEGER,        -- 휴약 시점 남은 횟수

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_herbal_pauses_purchase ON herbal_pauses(purchase_id);

-- =====================================================
-- 5. 이벤트 테이블 (공진단/경옥고 등)
-- =====================================================
CREATE TABLE IF NOT EXISTS herbal_events (
  id SERIAL PRIMARY KEY,

  name VARCHAR(100) NOT NULL,        -- 이벤트명
  herbal_types TEXT[],               -- 대상 한약 종류 ['hwan', 'go']

  start_date DATE NOT NULL,
  end_date DATE NOT NULL,

  benefit_message TEXT,              -- 종료 시 발송할 혜택 문자 템플릿

  status VARCHAR(20) DEFAULT 'active',  -- active / ended / benefit_sent

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_herbal_events_status ON herbal_events(status);
CREATE INDEX IF NOT EXISTS idx_herbal_events_end_date ON herbal_events(end_date);

-- =====================================================
-- 6. RLS 정책
-- =====================================================
ALTER TABLE herbal_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE herbal_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE herbal_consumptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE herbal_pauses ENABLE ROW LEVEL SECURITY;
ALTER TABLE herbal_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all access" ON herbal_purchases FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access" ON herbal_calls FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access" ON herbal_consumptions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access" ON herbal_pauses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access" ON herbal_events FOR ALL USING (true) WITH CHECK (true);

-- =====================================================
-- 7. updated_at 트리거
-- =====================================================
CREATE TRIGGER trigger_herbal_purchases_updated_at
  BEFORE UPDATE ON herbal_purchases
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_herbal_calls_updated_at
  BEFORE UPDATE ON herbal_calls
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_herbal_pauses_updated_at
  BEFORE UPDATE ON herbal_pauses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_herbal_events_updated_at
  BEFORE UPDATE ON herbal_events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 8. 유용한 뷰
-- =====================================================

-- 현재 복약 중인 환자 현황
CREATE OR REPLACE VIEW active_herbal_patients AS
SELECT
  hp.*,
  p.phone as patient_phone,
  (SELECT COUNT(*) FROM herbal_calls hc
   WHERE hc.purchase_id = hp.id AND hc.status = 'pending') as pending_calls
FROM herbal_purchases hp
LEFT JOIN patients p ON hp.patient_id = p.id
WHERE hp.status = 'active'
ORDER BY hp.expected_end_date NULLS LAST;

-- 오늘의 콜 목록
CREATE OR REPLACE VIEW today_herbal_calls AS
SELECT
  hc.*,
  hp.herbal_name,
  hp.sequence_code,
  hp.remaining_count,
  p.phone as patient_phone
FROM herbal_calls hc
JOIN herbal_purchases hp ON hc.purchase_id = hp.id
LEFT JOIN patients p ON hc.patient_id = p.id
WHERE hc.status = 'pending'
  AND hc.scheduled_date <= CURRENT_DATE
ORDER BY
  CASE hc.call_type
    WHEN 'chojin' THEN 1
    WHEN 'bokyak' THEN 2
    WHEN 'naewon' THEN 3
  END,
  hc.scheduled_date;

-- 이벤트 혜택 발송 대상
CREATE OR REPLACE VIEW event_benefit_pending AS
SELECT
  hp.*,
  e.name as event_name,
  e.end_date as event_end_date,
  e.benefit_message,
  p.phone as patient_phone
FROM herbal_purchases hp
JOIN herbal_events e ON hp.event_id = e.id
LEFT JOIN patients p ON hp.patient_id = p.id
WHERE e.end_date < CURRENT_DATE
  AND hp.event_benefit_sent = false;

-- 사후관리 대상 (복용 완료 후 N개월 경과)
CREATE OR REPLACE VIEW herbal_followup_needed AS
SELECT
  hp.*,
  p.phone as patient_phone,
  CURRENT_DATE - hp.actual_end_date as days_since_completion
FROM herbal_purchases hp
LEFT JOIN patients p ON hp.patient_id = p.id
WHERE hp.status = 'completed'
  AND hp.actual_end_date < CURRENT_DATE - INTERVAL '90 days'
  AND NOT EXISTS (
    SELECT 1 FROM herbal_purchases hp2
    WHERE hp2.patient_id = hp.patient_id
      AND hp2.created_at > hp.created_at
  )
ORDER BY hp.actual_end_date;

-- =====================================================
-- 완료 메시지
-- =====================================================
SELECT 'Phase 6 한약 복약관리 테이블 생성 완료!' as message;
