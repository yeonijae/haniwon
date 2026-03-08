-- 상담 코칭 결과 영속 저장 컬럼 추가
-- 적용 대상: PostgreSQL medical_transcripts

ALTER TABLE medical_transcripts
ADD COLUMN IF NOT EXISTS coaching_text TEXT;

ALTER TABLE medical_transcripts
ADD COLUMN IF NOT EXISTS coaching_prompt_version VARCHAR(20);

ALTER TABLE medical_transcripts
ADD COLUMN IF NOT EXISTS coaching_model VARCHAR(50);
