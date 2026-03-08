-- 상담코칭 API 사용 메타/예상비용 저장 컬럼 추가

ALTER TABLE medical_transcripts
ADD COLUMN IF NOT EXISTS coaching_input_tokens INTEGER;

ALTER TABLE medical_transcripts
ADD COLUMN IF NOT EXISTS coaching_output_tokens INTEGER;

ALTER TABLE medical_transcripts
ADD COLUMN IF NOT EXISTS coaching_total_tokens INTEGER;

ALTER TABLE medical_transcripts
ADD COLUMN IF NOT EXISTS coaching_elapsed_ms INTEGER;

ALTER TABLE medical_transcripts
ADD COLUMN IF NOT EXISTS coaching_estimated_cost_usd NUMERIC(12,8);

ALTER TABLE medical_transcripts
ADD COLUMN IF NOT EXISTS coaching_estimated_cost_krw NUMERIC(12,2);
