-- =====================================================
-- Phase 2: 의료진 할일 (Tasks) 테이블
-- Supabase SQL Editor에서 실행
-- =====================================================

-- 1. 할일 메인 테이블
CREATE TABLE IF NOT EXISTS tasks (
  id SERIAL PRIMARY KEY,

  -- 진료내역 연결
  treatment_record_id INTEGER REFERENCES treatment_records(id) ON DELETE SET NULL,

  -- 환자 정보
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,

  -- 할일 정보
  task_type VARCHAR(50) NOT NULL,
  -- write_initial_chart: 초진차트 작성
  -- write_progress_note: 경과기록 작성
  -- write_prescription: 처방전 작성
  -- write_dosage_instruction: 복용법 작성
  -- order_herbal_medicine: 한약 주문
  -- patient_callback: 환자 콜백
  -- review_test_result: 검사결과 확인
  -- other: 기타

  title VARCHAR(200) NOT NULL,
  description TEXT,

  -- 담당
  assigned_to VARCHAR(50),           -- 담당자 (의사명)
  assigned_role VARCHAR(20),         -- doctor, desk, treatment

  -- 상태
  status VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending, in_progress, completed, canceled
  priority VARCHAR(10) NOT NULL DEFAULT 'normal', -- low, normal, high, urgent

  -- 일정
  due_date DATE,                     -- 마감일
  completed_at TIMESTAMPTZ,          -- 완료 시간
  completed_by VARCHAR(50),          -- 완료한 사람

  -- 트리거 정보
  trigger_service VARCHAR(30),       -- 어떤 서비스로 인해 생성되었는지

  -- 타임스탬프
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 할일 템플릿 테이블 (서비스별 자동 생성 규칙)
CREATE TABLE IF NOT EXISTS task_templates (
  id SERIAL PRIMARY KEY,

  -- 트리거 조건
  trigger_service VARCHAR(30) NOT NULL,  -- initial_consult, medication_consult, herbal_medicine, etc.

  -- 생성할 할일 정보
  task_type VARCHAR(50) NOT NULL,
  title_template VARCHAR(200) NOT NULL,  -- {patient_name} 등의 변수 포함 가능
  description_template TEXT,

  -- 기본 설정
  default_assigned_role VARCHAR(20) DEFAULT 'doctor',
  default_priority VARCHAR(10) DEFAULT 'normal',
  due_days_offset INTEGER DEFAULT 0,     -- 생성일로부터 며칠 후 마감

  -- 순서
  display_order INTEGER DEFAULT 0,

  -- 활성화 여부
  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_tasks_patient_id ON tasks(patient_id);
CREATE INDEX IF NOT EXISTS idx_tasks_treatment_record_id ON tasks(treatment_record_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at);

CREATE INDEX IF NOT EXISTS idx_task_templates_trigger ON task_templates(trigger_service);

-- 4. updated_at 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_tasks_updated_at ON tasks;
CREATE TRIGGER trigger_tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_tasks_updated_at();

-- 5. RLS 정책
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all access for authenticated users" ON tasks
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Enable all access for authenticated users" ON task_templates
  FOR ALL USING (true) WITH CHECK (true);

-- 6. 기본 템플릿 데이터 삽입
INSERT INTO task_templates (trigger_service, task_type, title_template, description_template, default_priority, due_days_offset, display_order) VALUES
  -- 초진
  ('initial_consult', 'write_initial_chart', '{patient_name} 초진차트 작성', '초진 환자의 차트를 작성해주세요.', 'high', 0, 1),

  -- 약상담
  ('medication_consult', 'write_progress_note', '{patient_name} 경과기록 작성', '약상담 내용을 경과기록에 작성해주세요.', 'normal', 0, 1),
  ('medication_consult', 'write_prescription', '{patient_name} 처방전 작성', '처방전을 작성해주세요.', 'high', 0, 2),
  ('medication_consult', 'write_dosage_instruction', '{patient_name} 복용법 작성', '한약 복용법을 작성해주세요.', 'normal', 0, 3),

  -- 한약 처방
  ('herbal_medicine', 'write_prescription', '{patient_name} 처방전 작성', '한약 처방전을 작성해주세요.', 'high', 0, 1),
  ('herbal_medicine', 'order_herbal_medicine', '{patient_name} 한약 주문', '탕전실에 한약을 주문해주세요.', 'high', 0, 2),
  ('herbal_medicine', 'write_dosage_instruction', '{patient_name} 복용법 작성', '한약 복용법을 작성해주세요.', 'normal', 0, 3),

  -- 일반 진료
  ('consultation', 'write_progress_note', '{patient_name} 경과기록 작성', '진료 내용을 경과기록에 작성해주세요.', 'normal', 0, 1),

  -- 초음파
  ('ultrasound', 'write_progress_note', '{patient_name} 초음파 소견 작성', '초음파 검사 소견을 경과기록에 작성해주세요.', 'normal', 0, 1)
ON CONFLICT DO NOTHING;

-- 7. 오늘의 할일 뷰
CREATE OR REPLACE VIEW today_tasks AS
SELECT
  t.*,
  p.name as patient_name,
  p.chart_number as patient_chart_number,
  tr.treatment_date,
  tr.doctor_name as treatment_doctor
FROM tasks t
JOIN patients p ON t.patient_id = p.id
LEFT JOIN treatment_records tr ON t.treatment_record_id = tr.id
WHERE t.status IN ('pending', 'in_progress')
  AND (t.due_date IS NULL OR t.due_date <= CURRENT_DATE)
ORDER BY
  CASE t.priority
    WHEN 'urgent' THEN 1
    WHEN 'high' THEN 2
    WHEN 'normal' THEN 3
    WHEN 'low' THEN 4
  END,
  t.created_at;

-- =====================================================
-- 실행 완료 메시지
-- =====================================================
SELECT 'Phase 2 테이블 생성 완료: tasks, task_templates' as message;
