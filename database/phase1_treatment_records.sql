-- =====================================================
-- Phase 1: 진료내역 (Treatment Records) 테이블
-- Supabase SQL Editor에서 실행
-- =====================================================

-- 1. 진료내역 메인 테이블
CREATE TABLE IF NOT EXISTS treatment_records (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  treatment_date DATE NOT NULL DEFAULT CURRENT_DATE,

  -- 진료 정보
  doctor_name VARCHAR(50),
  treatment_room VARCHAR(20),

  -- 진료 유형
  visit_type VARCHAR(20) NOT NULL DEFAULT 'follow_up',  -- initial, follow_up, medication, treatment_only
  services TEXT[] DEFAULT '{}',  -- consultation, initial_consult, medication_consult, acupuncture, chuna, etc.

  -- 치료 항목 (JSON)
  treatment_items JSONB DEFAULT '[]',  -- [{name, duration}]

  -- 연결
  reservation_id VARCHAR(100),
  payment_id INTEGER,

  -- 상태
  status VARCHAR(20) NOT NULL DEFAULT 'in_progress',  -- in_progress, completed, canceled
  memo TEXT,

  -- 타임스탬프
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 타임라인 이벤트 테이블
CREATE TABLE IF NOT EXISTS treatment_timeline_events (
  id SERIAL PRIMARY KEY,
  treatment_record_id INTEGER NOT NULL REFERENCES treatment_records(id) ON DELETE CASCADE,

  -- 이벤트 정보
  event_type VARCHAR(30) NOT NULL,
  -- check_in, waiting_consultation, consultation_start, consultation_end,
  -- waiting_treatment, treatment_start, treatment_end,
  -- waiting_payment, payment_complete, check_out

  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  location VARCHAR(50),       -- 진료실, 치료실 등
  staff_name VARCHAR(50),     -- 담당자
  memo TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_treatment_records_patient_id ON treatment_records(patient_id);
CREATE INDEX IF NOT EXISTS idx_treatment_records_treatment_date ON treatment_records(treatment_date);
CREATE INDEX IF NOT EXISTS idx_treatment_records_status ON treatment_records(status);
CREATE INDEX IF NOT EXISTS idx_treatment_records_doctor ON treatment_records(doctor_name);

CREATE INDEX IF NOT EXISTS idx_timeline_events_record_id ON treatment_timeline_events(treatment_record_id);
CREATE INDEX IF NOT EXISTS idx_timeline_events_type ON treatment_timeline_events(event_type);
CREATE INDEX IF NOT EXISTS idx_timeline_events_timestamp ON treatment_timeline_events(timestamp);

-- 4. updated_at 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_treatment_records_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_treatment_records_updated_at ON treatment_records;
CREATE TRIGGER trigger_treatment_records_updated_at
  BEFORE UPDATE ON treatment_records
  FOR EACH ROW
  EXECUTE FUNCTION update_treatment_records_updated_at();

-- 5. RLS (Row Level Security) 정책
ALTER TABLE treatment_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE treatment_timeline_events ENABLE ROW LEVEL SECURITY;

-- 모든 인증된 사용자가 읽기/쓰기 가능 (필요시 조정)
CREATE POLICY "Enable all access for authenticated users" ON treatment_records
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Enable all access for authenticated users" ON treatment_timeline_events
  FOR ALL USING (true) WITH CHECK (true);

-- 6. 진료 통계 뷰 (선택사항)
CREATE OR REPLACE VIEW treatment_statistics AS
SELECT
  tr.id,
  tr.patient_id,
  p.name as patient_name,
  p.chart_number,
  tr.treatment_date,
  tr.doctor_name,
  tr.visit_type,
  tr.status,

  -- 체크인 시간
  (SELECT timestamp FROM treatment_timeline_events
   WHERE treatment_record_id = tr.id AND event_type = 'check_in'
   ORDER BY timestamp LIMIT 1) as check_in_time,

  -- 체크아웃 시간
  (SELECT timestamp FROM treatment_timeline_events
   WHERE treatment_record_id = tr.id AND event_type = 'check_out'
   ORDER BY timestamp DESC LIMIT 1) as check_out_time,

  -- 총 체류시간 (분)
  EXTRACT(EPOCH FROM (
    (SELECT timestamp FROM treatment_timeline_events
     WHERE treatment_record_id = tr.id AND event_type = 'check_out'
     ORDER BY timestamp DESC LIMIT 1)
    -
    (SELECT timestamp FROM treatment_timeline_events
     WHERE treatment_record_id = tr.id AND event_type = 'check_in'
     ORDER BY timestamp LIMIT 1)
  )) / 60 as total_duration_minutes

FROM treatment_records tr
JOIN patients p ON tr.patient_id = p.id;

-- =====================================================
-- 실행 완료 메시지
-- =====================================================
SELECT 'Phase 1 테이블 생성 완료: treatment_records, treatment_timeline_events' as message;
