-- Migration 6: diagnosis_code_map 테이블 생성
-- DxName → KCD 코드 매핑 테이블

CREATE TABLE IF NOT EXISTS diagnosis_code_map (
    id            bigserial       PRIMARY KEY,
    dx_name_raw   text            NOT NULL,
    dx_name_norm  text            NOT NULL,
    kcd_code      varchar(20)     NULL,
    kcd_name      text            NULL,
    source        varchar(20)     NOT NULL DEFAULT 'seed',
    confidence    numeric(4,3)    NOT NULL DEFAULT 0.800,
    is_active     boolean         NOT NULL DEFAULT true,
    created_at    timestamptz     DEFAULT now(),
    updated_at    timestamptz     DEFAULT now(),

    CONSTRAINT uq_diagnosis_code_map_dx_name_raw UNIQUE (dx_name_raw)
);

CREATE INDEX IF NOT EXISTS idx_diagnosis_code_map_dx_name_norm ON diagnosis_code_map (dx_name_norm);
CREATE INDEX IF NOT EXISTS idx_diagnosis_code_map_kcd_code ON diagnosis_code_map (kcd_code);

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION trg_set_updated_at()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_diagnosis_code_map_updated_at ON diagnosis_code_map;
CREATE TRIGGER trg_diagnosis_code_map_updated_at
    BEFORE UPDATE ON diagnosis_code_map
    FOR EACH ROW
    EXECUTE FUNCTION trg_set_updated_at();
