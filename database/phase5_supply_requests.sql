-- =============================================
-- Phase 5: 구입 요청 테이블
-- =============================================

-- 구입 요청 테이블
CREATE TABLE IF NOT EXISTS supply_requests (
  id SERIAL PRIMARY KEY,
  item_name TEXT NOT NULL,
  quantity TEXT,
  requested_by TEXT NOT NULL DEFAULT '관리자',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_supply_requests_status ON supply_requests(status);
CREATE INDEX IF NOT EXISTS idx_supply_requests_created_at ON supply_requests(created_at DESC);

-- RLS 정책
ALTER TABLE supply_requests ENABLE ROW LEVEL SECURITY;

-- 모든 사용자 접근 허용 (인증된 사용자)
CREATE POLICY "Allow all operations on supply_requests" ON supply_requests
  FOR ALL USING (true) WITH CHECK (true);

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_supply_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_supply_requests_updated_at
  BEFORE UPDATE ON supply_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_supply_requests_updated_at();

-- 샘플 데이터 (선택사항)
-- INSERT INTO supply_requests (item_name, requested_by) VALUES
--   ('경근약침/현10바이알/11월27일(금)까지', '관리자'),
--   ('A4용지/10박스/12월1일까지', '관리자');
