-- 미디어 카테고리 테이블
CREATE TABLE IF NOT EXISTS media_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#6b7280',
  icon TEXT DEFAULT 'fa-folder',
  sort_order INTEGER DEFAULT 0,
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 기본 카테고리 추가
INSERT INTO media_categories (slug, name, icon, color, sort_order, is_system) VALUES
  ('uncategorized', '미분류', 'fa-folder', '#6b7280', 0, true),
  ('blog', '블로그', 'fa-pen-fancy', '#3b82f6', 1, true),
  ('guide', '안내페이지', 'fa-book-open', '#10b981', 2, true),
  ('landing', '랜딩페이지', 'fa-rocket', '#8b5cf6', 3, true),
  ('event', '이벤트', 'fa-gift', '#f59e0b', 4, true),
  ('product', '제품/치료', 'fa-pills', '#ec4899', 5, true),
  ('clinic', '한의원', 'fa-hospital', '#06b6d4', 6, true),
  ('icon', '아이콘/로고', 'fa-icons', '#6366f1', 7, true)
ON CONFLICT (slug) DO NOTHING;

-- RLS 정책
ALTER TABLE media_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "media_categories_select" ON media_categories FOR SELECT USING (true);
CREATE POLICY "media_categories_insert" ON media_categories FOR INSERT WITH CHECK (true);
CREATE POLICY "media_categories_update" ON media_categories FOR UPDATE USING (true);
CREATE POLICY "media_categories_delete" ON media_categories FOR DELETE USING (is_system = false);

-- updated_at 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_media_categories_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_media_categories_updated_at
  BEFORE UPDATE ON media_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_media_categories_updated_at();

-- =====================================================
-- 미디어 파일 메타데이터 테이블
CREATE TABLE IF NOT EXISTS media_files (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- 파일 정보
  file_name TEXT NOT NULL,
  original_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER DEFAULT 0,
  mime_type TEXT,

  -- 카테고리
  category TEXT NOT NULL DEFAULT 'uncategorized',

  -- 메타데이터
  alt_text TEXT,
  description TEXT,
  tags TEXT[],

  -- 이미지 크기 (선택)
  width INTEGER,
  height INTEGER,

  -- 사용 추적
  usage_count INTEGER DEFAULT 0,

  -- 타임스탬프
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by TEXT
);

-- 카테고리별 조회를 위한 인덱스
CREATE INDEX IF NOT EXISTS idx_media_files_category ON media_files(category);

-- 생성일 기준 정렬 인덱스
CREATE INDEX IF NOT EXISTS idx_media_files_created_at ON media_files(created_at DESC);

-- RLS 정책
ALTER TABLE media_files ENABLE ROW LEVEL SECURITY;

-- 모든 사용자 읽기 허용
CREATE POLICY "media_files_select" ON media_files
  FOR SELECT USING (true);

-- 인증된 사용자 삽입 허용
CREATE POLICY "media_files_insert" ON media_files
  FOR INSERT WITH CHECK (true);

-- 인증된 사용자 업데이트 허용
CREATE POLICY "media_files_update" ON media_files
  FOR UPDATE USING (true);

-- 인증된 사용자 삭제 허용
CREATE POLICY "media_files_delete" ON media_files
  FOR DELETE USING (true);

-- updated_at 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_media_files_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_media_files_updated_at
  BEFORE UPDATE ON media_files
  FOR EACH ROW
  EXECUTE FUNCTION update_media_files_updated_at();

-- 카테고리 예시 (참고용 - 앱에서 정의)
-- 'uncategorized' - 미분류
-- 'blog' - 블로그
-- 'guide' - 안내페이지
-- 'landing' - 랜딩페이지
-- 'event' - 이벤트
-- 'product' - 제품/치료
-- 'clinic' - 한의원 사진
-- 'icon' - 아이콘/로고
