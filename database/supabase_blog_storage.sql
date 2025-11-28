-- =====================================================
-- Supabase Storage 버킷 생성
-- Supabase Dashboard > SQL Editor에서 실행
-- =====================================================

-- 블로그 이미지 저장용 버킷 생성
INSERT INTO storage.buckets (id, name, public)
VALUES ('blog-images', 'blog-images', true)
ON CONFLICT (id) DO NOTHING;

-- 모든 사용자가 이미지 조회 가능
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'blog-images');

-- 인증된 사용자만 이미지 업로드 가능
CREATE POLICY "Authenticated users can upload images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'blog-images');

-- 인증된 사용자만 이미지 수정 가능
CREATE POLICY "Authenticated users can update images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'blog-images');

-- 인증된 사용자만 이미지 삭제 가능
CREATE POLICY "Authenticated users can delete images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'blog-images');

-- 익명 사용자도 업로드 가능하게 (개발 편의용 - 프로덕션에서는 제거 권장)
CREATE POLICY "Anyone can upload images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'blog-images');

SELECT 'Blog images storage bucket created!' AS message;
