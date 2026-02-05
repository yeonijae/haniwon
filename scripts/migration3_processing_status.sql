-- 마이그레이션: medical_transcripts 테이블에 서버 사이드 처리 상태 컬럼 추가
-- 실행: PostgreSQL API 콘솔에서 실행하거나 psql로 실행

-- processing_status: 서버 사이드 처리 상태
-- - uploading: 업로드 완료, 처리 대기
-- - transcribing: Whisper 음성 변환 중
-- - processing: SOAP 및 화자 분리 중
-- - completed: 처리 완료
-- - failed: 처리 실패

DO $$
BEGIN
    -- processing_status 컬럼 추가
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'medical_transcripts' AND column_name = 'processing_status'
    ) THEN
        ALTER TABLE medical_transcripts
        ADD COLUMN processing_status VARCHAR(20) DEFAULT NULL;

        RAISE NOTICE 'processing_status 컬럼 추가 완료';
    ELSE
        RAISE NOTICE 'processing_status 컬럼이 이미 존재합니다';
    END IF;

    -- processing_message 컬럼 추가
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'medical_transcripts' AND column_name = 'processing_message'
    ) THEN
        ALTER TABLE medical_transcripts
        ADD COLUMN processing_message TEXT DEFAULT NULL;

        RAISE NOTICE 'processing_message 컬럼 추가 완료';
    ELSE
        RAISE NOTICE 'processing_message 컬럼이 이미 존재합니다';
    END IF;

    -- recording_date 컬럼 추가 (서버 사이드 처리용)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'medical_transcripts' AND column_name = 'recording_date'
    ) THEN
        ALTER TABLE medical_transcripts
        ADD COLUMN recording_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

        RAISE NOTICE 'recording_date 컬럼 추가 완료';
    ELSE
        RAISE NOTICE 'recording_date 컬럼이 이미 존재합니다';
    END IF;
END $$;

-- 인덱스 추가 (처리 중인 항목 조회 최적화)
CREATE INDEX IF NOT EXISTS idx_medical_transcripts_processing_status
ON medical_transcripts(processing_status)
WHERE processing_status IS NOT NULL AND processing_status != 'completed';

-- 기존 레코드의 processing_status를 completed로 설정 (SOAP 완료된 경우)
UPDATE medical_transcripts
SET processing_status = 'completed'
WHERE soap_status = 'completed' AND processing_status IS NULL;

-- 완료 메시지
SELECT 'Migration 완료: processing_status, processing_message 컬럼이 추가되었습니다.' as message;
