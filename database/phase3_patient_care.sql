-- =====================================================
-- Phase 3: 환자관리 (Patient Care) 테이블
-- Supabase SQL Editor에서 실행
-- =====================================================

-- 1. 환자 관리 항목 테이블
CREATE TABLE IF NOT EXISTS patient_care_items (
  id SERIAL PRIMARY KEY,

  -- 환자 정보
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,

  -- 진료내역 연결 (선택)
  treatment_record_id INTEGER REFERENCES treatment_records(id) ON DELETE SET NULL,

  -- 관리 유형
  care_type VARCHAR(30) NOT NULL,
  -- happy_call_delivery: 배송 후 해피콜
  -- happy_call_medication: 복약 중 해피콜
  -- treatment_followup: 치료 후 follow-up
  -- treatment_closure: 치료 종결 확인
  -- periodic_message: 정기 관리 메시지
  -- reservation_reminder: 예약 리마인더
  -- custom: 수동 등록

  -- 내용
  title VARCHAR(200) NOT NULL,
  description TEXT,

  -- 상태
  status VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending, scheduled, completed, skipped

  -- 일정
  scheduled_date DATE,           -- 예정일
  completed_date TIMESTAMPTZ,    -- 완료 일시
  completed_by VARCHAR(50),      -- 완료한 사람

  -- 결과
  result TEXT,                   -- 수행 결과 (통화 내용 등)

  -- 트리거 정보
  trigger_type VARCHAR(10) NOT NULL DEFAULT 'manual',  -- auto, manual
  trigger_source VARCHAR(50),    -- herbal_delivery, treatment_end, etc.

  -- 타임스탬프
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 환자 치료 상태 테이블
CREATE TABLE IF NOT EXISTS patient_treatment_status (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER NOT NULL UNIQUE REFERENCES patients(id) ON DELETE CASCADE,

  -- 치료 상태
  status VARCHAR(20) NOT NULL DEFAULT 'active',  -- active, paused, completed, lost

  -- 기간
  start_date DATE,               -- 치료 시작일
  end_date DATE,                 -- 치료 종결일

  -- 통계
  total_visits INTEGER DEFAULT 0,          -- 총 내원 횟수
  last_visit_date DATE,                    -- 마지막 내원일
  next_scheduled_date DATE,                -- 다음 예약일

  -- 종결 정보
  closure_reason TEXT,           -- 종결 사유
  closure_type VARCHAR(20),      -- natural, planned, patient_request, lost_contact

  -- 메모
  notes TEXT,

  -- 타임스탬프
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 환자관리 자동 생성 규칙 테이블
CREATE TABLE IF NOT EXISTS patient_care_rules (
  id SERIAL PRIMARY KEY,

  -- 규칙 이름
  name VARCHAR(100) NOT NULL,
  description TEXT,

  -- 트리거 조건
  trigger_event VARCHAR(50) NOT NULL,  -- herbal_delivery, visit_count_10, days_since_last_visit_30, etc.

  -- 생성할 관리 항목
  care_type VARCHAR(30) NOT NULL,
  title_template VARCHAR(200) NOT NULL,
  description_template TEXT,

  -- 일정
  days_offset INTEGER DEFAULT 0,  -- 트리거 기준 며칠 후 예정

  -- 활성화
  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_patient_care_items_patient_id ON patient_care_items(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_care_items_status ON patient_care_items(status);
CREATE INDEX IF NOT EXISTS idx_patient_care_items_scheduled_date ON patient_care_items(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_patient_care_items_care_type ON patient_care_items(care_type);

CREATE INDEX IF NOT EXISTS idx_patient_treatment_status_patient_id ON patient_treatment_status(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_treatment_status_status ON patient_treatment_status(status);
CREATE INDEX IF NOT EXISTS idx_patient_treatment_status_last_visit ON patient_treatment_status(last_visit_date);

-- 5. updated_at 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_patient_care_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_patient_care_items_updated_at ON patient_care_items;
CREATE TRIGGER trigger_patient_care_items_updated_at
  BEFORE UPDATE ON patient_care_items
  FOR EACH ROW
  EXECUTE FUNCTION update_patient_care_updated_at();

DROP TRIGGER IF EXISTS trigger_patient_treatment_status_updated_at ON patient_treatment_status;
CREATE TRIGGER trigger_patient_treatment_status_updated_at
  BEFORE UPDATE ON patient_treatment_status
  FOR EACH ROW
  EXECUTE FUNCTION update_patient_care_updated_at();

-- 6. RLS 정책
ALTER TABLE patient_care_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_treatment_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_care_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all access for authenticated users" ON patient_care_items
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Enable all access for authenticated users" ON patient_treatment_status
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Enable all access for authenticated users" ON patient_care_rules
  FOR ALL USING (true) WITH CHECK (true);

-- 7. 기본 규칙 데이터 삽입
INSERT INTO patient_care_rules (name, trigger_event, care_type, title_template, description_template, days_offset) VALUES
  ('한약 배송 후 해피콜', 'herbal_delivery', 'happy_call_delivery', '{patient_name} 한약 배송 해피콜', '한약이 잘 도착했는지, 복용법을 이해하셨는지 확인해주세요.', 1),
  ('복약 7일차 해피콜', 'herbal_start', 'happy_call_medication', '{patient_name} 복약 7일차 해피콜', '복약 중 불편한 점이 없는지 확인해주세요.', 7),
  ('10회 치료 후 종결 확인', 'visit_count_10', 'treatment_closure', '{patient_name} 치료 종결 상담', '치료 경과를 확인하고 종결 여부를 상담해주세요.', 0),
  ('30일 미방문 관리', 'days_since_last_visit_30', 'periodic_message', '{patient_name} 안부 연락', '오랜만에 연락드려 안부를 여쭤보세요.', 0),
  ('예약 전일 리마인더', 'reservation_d_minus_1', 'reservation_reminder', '{patient_name} 예약 리마인더', '내일 예약이 있습니다. 확인 전화를 해주세요.', 0)
ON CONFLICT DO NOTHING;

-- 8. 오늘의 환자관리 뷰
CREATE OR REPLACE VIEW today_patient_care AS
SELECT
  pci.*,
  p.name as patient_name,
  p.chart_number as patient_chart_number,
  p.phone as patient_phone,
  pts.status as treatment_status,
  pts.total_visits,
  pts.last_visit_date
FROM patient_care_items pci
JOIN patients p ON pci.patient_id = p.id
LEFT JOIN patient_treatment_status pts ON pci.patient_id = pts.patient_id
WHERE pci.status IN ('pending', 'scheduled')
  AND (pci.scheduled_date IS NULL OR pci.scheduled_date <= CURRENT_DATE)
ORDER BY
  pci.scheduled_date NULLS LAST,
  pci.created_at;

-- 9. 관리 필요 환자 뷰 (30일 이상 미방문)
CREATE OR REPLACE VIEW patients_need_followup AS
SELECT
  p.id,
  p.name,
  p.chart_number,
  p.phone,
  pts.status as treatment_status,
  pts.total_visits,
  pts.last_visit_date,
  CURRENT_DATE - pts.last_visit_date as days_since_last_visit,
  pts.next_scheduled_date
FROM patients p
LEFT JOIN patient_treatment_status pts ON p.id = pts.patient_id
WHERE p.deletion_date IS NULL
  AND (pts.status IS NULL OR pts.status = 'active')
  AND (pts.last_visit_date IS NULL OR pts.last_visit_date < CURRENT_DATE - INTERVAL '30 days')
ORDER BY pts.last_visit_date NULLS FIRST;

-- =====================================================
-- 실행 완료 메시지
-- =====================================================
SELECT 'Phase 3 테이블 생성 완료: patient_care_items, patient_treatment_status, patient_care_rules' as message;
