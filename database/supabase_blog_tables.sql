-- =====================================================
-- Supabase 블로그 시스템 테이블
-- Supabase Dashboard > SQL Editor에서 실행
-- =====================================================

-- UUID 확장 활성화
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. 블로그 포스트 테이블
-- =====================================================
CREATE TABLE IF NOT EXISTS blog_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- 기본 정보
  title VARCHAR(200) NOT NULL,
  slug VARCHAR(200) UNIQUE NOT NULL,
  excerpt TEXT,
  content TEXT NOT NULL,

  -- 분류
  category VARCHAR(50) NOT NULL CHECK (category IN (
    'health_info', 'treatment_guide', 'clinic_news',
    'lifestyle', 'case_study', 'faq'
  )),
  tags TEXT[] DEFAULT '{}',

  -- 상태
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'published', 'archived'
  )),

  -- 미디어
  thumbnail_url TEXT,
  og_image TEXT,

  -- 작성자
  author_name VARCHAR(100) NOT NULL DEFAULT '연이재한의원',
  author_title VARCHAR(100) DEFAULT '한의사',

  -- SEO
  meta_title VARCHAR(200),
  meta_description TEXT,
  reading_time INTEGER DEFAULT 5,

  -- 통계
  view_count INTEGER DEFAULT 0,
  like_count INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,

  -- 타임스탬프
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_blog_posts_status ON blog_posts(status);
CREATE INDEX IF NOT EXISTS idx_blog_posts_category ON blog_posts(category);
CREATE INDEX IF NOT EXISTS idx_blog_posts_published_at ON blog_posts(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_blog_posts_slug ON blog_posts(slug);

-- =====================================================
-- 2. 블로그 구독자 테이블
-- =====================================================
CREATE TABLE IF NOT EXISTS blog_subscribers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- 연락처 (둘 중 하나는 필수)
  name VARCHAR(100),
  phone VARCHAR(20),
  email VARCHAR(255),

  -- 구독 방식
  subscribe_type VARCHAR(10) NOT NULL CHECK (subscribe_type IN ('kakao', 'email', 'both')),

  -- 관심 카테고리 (빈 배열이면 전체)
  categories TEXT[] DEFAULT '{}',

  -- 동의
  marketing_consent BOOLEAN DEFAULT true,

  -- 상태
  is_active BOOLEAN DEFAULT true,

  -- 타임스탬프
  subscribed_at TIMESTAMPTZ DEFAULT NOW(),
  unsubscribed_at TIMESTAMPTZ,

  -- 제약조건: phone 또는 email 중 하나는 필수
  CONSTRAINT phone_or_email_required CHECK (phone IS NOT NULL OR email IS NOT NULL)
);

-- 유니크 인덱스 (중복 구독 방지)
CREATE UNIQUE INDEX IF NOT EXISTS idx_blog_subscribers_phone
  ON blog_subscribers(phone) WHERE phone IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_blog_subscribers_email
  ON blog_subscribers(email) WHERE email IS NOT NULL;

-- =====================================================
-- 3. 페이지뷰 기록 테이블
-- =====================================================
CREATE TABLE IF NOT EXISTS blog_page_views (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- 연결
  post_id UUID REFERENCES blog_posts(id) ON DELETE CASCADE,

  -- 방문자 정보
  visitor_id VARCHAR(100),
  session_id VARCHAR(100),

  -- 추적 정보
  referrer TEXT,
  user_agent TEXT,

  -- 체류 시간 (초)
  dwell_time INTEGER,
  scroll_depth INTEGER,

  -- 타임스탬프
  viewed_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_blog_page_views_post_id ON blog_page_views(post_id);
CREATE INDEX IF NOT EXISTS idx_blog_page_views_viewed_at ON blog_page_views(viewed_at DESC);

-- =====================================================
-- 4. 조회수 증가 함수
-- =====================================================
CREATE OR REPLACE FUNCTION increment_view_count(post_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE blog_posts
  SET view_count = view_count + 1
  WHERE id = post_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 5. RLS (Row Level Security) 정책
-- =====================================================

-- blog_posts: 발행된 글만 공개 읽기 허용
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Published posts are viewable by everyone"
  ON blog_posts FOR SELECT
  USING (status = 'published');

CREATE POLICY "All posts viewable by authenticated users"
  ON blog_posts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert posts"
  ON blog_posts FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update posts"
  ON blog_posts FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete posts"
  ON blog_posts FOR DELETE
  TO authenticated
  USING (true);

-- blog_subscribers: 구독 신청은 누구나 가능, 조회는 인증된 사용자만
ALTER TABLE blog_subscribers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can subscribe"
  ON blog_subscribers FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Authenticated users can view subscribers"
  ON blog_subscribers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can update subscribers"
  ON blog_subscribers FOR UPDATE
  TO authenticated
  USING (true);

-- blog_page_views: 누구나 기록 가능, 조회는 인증된 사용자만
ALTER TABLE blog_page_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can record page views"
  ON blog_page_views FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Authenticated users can view page views"
  ON blog_page_views FOR SELECT
  TO authenticated
  USING (true);

-- =====================================================
-- 6. 샘플 데이터 (선택사항)
-- =====================================================
INSERT INTO blog_posts (title, slug, excerpt, content, category, tags, status, author_name, published_at) VALUES
(
  '봄철 알레르기 비염, 한방으로 근본 치료하기',
  'spring-allergy-rhinitis-treatment',
  '봄만 되면 시작되는 알레르기 비염, 단순 증상 완화가 아닌 체질 개선을 통한 근본 치료법을 알아봅니다.',
  '# 봄철 알레르기 비염이란?

봄철이 되면 많은 분들이 알레르기 비염으로 고생합니다. 꽃가루, 황사, 미세먼지 등이 원인이 되어 콧물, 재채기, 코막힘 등의 증상이 나타납니다.

## 한의학적 관점

한의학에서는 알레르기 비염을 **폐기허약(肺氣虛弱)**과 관련지어 봅니다. 폐의 기운이 약해지면 외부 사기(邪氣)에 대한 저항력이 떨어져 알레르기 반응이 쉽게 나타나게 됩니다.

## 치료 방법

1. **침 치료**: 코 주변 경혈을 자극하여 증상 완화
2. **한약 치료**: 체질에 맞는 한약으로 면역력 강화
3. **생활 관리**: 충분한 수면, 스트레스 관리

## 예방법

- 외출 시 마스크 착용
- 귀가 후 손씻기와 세안
- 실내 습도 유지 (50-60%)',
  'health_info',
  ARRAY['알레르기', '비염', '봄철건강', '한방치료'],
  'published',
  '김한의 원장',
  NOW() - INTERVAL '3 days'
),
(
  '직장인 만성 피로, 한의원에서 해결하세요',
  'chronic-fatigue-treatment',
  '항상 피곤하고 무기력한 직장인을 위한 한방 피로 회복 프로그램을 소개합니다.',
  '# 만성 피로 증후군

현대 직장인들의 가장 흔한 증상 중 하나가 바로 만성 피로입니다. 충분히 자도 피곤하고, 커피를 마셔도 잠깐 뿐이라면 단순한 피로가 아닐 수 있습니다.

## 원인

- 과도한 업무 스트레스
- 불규칙한 식습관
- 수면의 질 저하
- 운동 부족

## 한방 치료법

### 1. 공진단
왕실에서 사용하던 보약으로, 기력 회복에 탁월합니다.

### 2. 침 치료
족삼리, 합곡 등의 혈자리를 자극하여 기혈 순환을 촉진합니다.

### 3. 약침 치료
피로 회복에 효과적인 한약 성분을 직접 혈위에 주입합니다.',
  'treatment_guide',
  ARRAY['피로', '직장인건강', '보약', '공진단'],
  'published',
  '김한의 원장',
  NOW() - INTERVAL '1 week'
),
(
  '소화불량과 위장 건강, 한방으로 관리하기',
  'digestive-health-korean-medicine',
  '반복되는 소화불량, 더부룩함을 한의학적으로 해결하는 방법을 알아봅니다.',
  '# 소화불량의 한의학적 이해

식후 더부룩함, 속쓰림, 복부 팽만감... 현대인의 60% 이상이 경험하는 소화불량은 단순히 "많이 먹어서"가 아닐 수 있습니다.

## 비위(脾胃)의 중요성

한의학에서 비위는 모든 건강의 근본입니다. 음식을 소화시키고 영양분을 전신에 공급하는 역할을 합니다.

## 체질별 소화불량

- **소음인**: 위장이 차가워 소화가 안 됨
- **소양인**: 스트레스로 인한 위산 과다
- **태음인**: 과식으로 인한 위장 부담
- **태양인**: 드물지만 급체가 잦음

## 권장 한약재

1. 산사: 육류 소화 촉진
2. 맥아: 탄수화물 소화 도움
3. 진피: 기 순환 촉진',
  'health_info',
  ARRAY['소화불량', '위장건강', '비위', '한약'],
  'published',
  '연이재한의원',
  NOW() - INTERVAL '2 weeks'
);

-- =====================================================
-- 완료 메시지
-- =====================================================
SELECT 'Blog tables created successfully!' AS message;
