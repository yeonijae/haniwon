-- =============================================
-- Phase 4: 자체 블로그 시스템 + SEO + 구독
-- =============================================

-- 1. 블로그 포스트 테이블
CREATE TABLE blog_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- 기본 정보
    title VARCHAR(200) NOT NULL,
    slug VARCHAR(200) NOT NULL UNIQUE,          -- URL용 슬러그 (SEO)
    excerpt TEXT,                                -- 요약 (미리보기, 메타 설명용)
    content TEXT NOT NULL,                       -- 본문 (HTML 또는 Markdown)
    content_format VARCHAR(20) DEFAULT 'markdown', -- 'markdown' | 'html'

    -- 카테고리 & 태그
    category VARCHAR(50) NOT NULL,              -- health_info, treatment_guide, clinic_news, lifestyle, case_study, faq
    tags TEXT[],                                -- 태그 배열

    -- 작성자
    author_id UUID REFERENCES portal_users(id),
    author_name VARCHAR(100),
    author_profile TEXT,                        -- 작성자 소개

    -- 미디어
    thumbnail_url TEXT,                         -- 대표 이미지
    images TEXT[],                              -- 본문 이미지들

    -- SEO 메타데이터
    meta_title VARCHAR(70),                     -- SEO 타이틀 (60-70자 권장)
    meta_description VARCHAR(160),              -- 메타 설명 (150-160자 권장)
    meta_keywords TEXT[],                       -- 메타 키워드
    canonical_url TEXT,                         -- 정규 URL
    og_image TEXT,                              -- Open Graph 이미지

    -- 발행 상태
    status VARCHAR(20) DEFAULT 'draft',         -- draft, review, published, archived
    published_at TIMESTAMPTZ,
    scheduled_at TIMESTAMPTZ,                   -- 예약 발행

    -- 시리즈
    series_id UUID,
    series_order INT,

    -- 관련 글
    related_post_ids UUID[],

    -- 통계
    view_count INT DEFAULT 0,
    unique_visitor_count INT DEFAULT 0,
    avg_read_time INT DEFAULT 0,                -- 평균 읽기 시간 (초)
    like_count INT DEFAULT 0,
    share_count INT DEFAULT 0,
    comment_count INT DEFAULT 0,

    -- 구독 알림 발송 여부
    notification_sent BOOLEAN DEFAULT FALSE,
    notification_sent_at TIMESTAMPTZ,

    -- 예상 읽기 시간 (분)
    reading_time INT,

    -- 메타
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES portal_users(id),
    updated_by UUID REFERENCES portal_users(id)
);

-- 2. 블로그 시리즈 테이블
CREATE TABLE blog_series (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(200) NOT NULL,
    slug VARCHAR(200) NOT NULL UNIQUE,
    description TEXT,
    thumbnail_url TEXT,
    post_count INT DEFAULT 0,
    status VARCHAR(20) DEFAULT 'active',        -- active, completed, archived
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 블로그 조회 기록 (상세 분석용)
CREATE TABLE blog_page_views (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID REFERENCES blog_posts(id) ON DELETE CASCADE,

    -- 방문자 정보
    visitor_id VARCHAR(100),                    -- 익명 방문자 ID (쿠키/localStorage)
    session_id VARCHAR(100),
    ip_address INET,
    user_agent TEXT,

    -- 유입 경로
    referrer TEXT,
    utm_source VARCHAR(100),
    utm_medium VARCHAR(100),
    utm_campaign VARCHAR(100),
    tracking_id VARCHAR(50),                    -- DM 추적 ID

    -- 행동 데이터
    entered_at TIMESTAMPTZ DEFAULT NOW(),
    exited_at TIMESTAMPTZ,
    dwell_time INT,                             -- 체류 시간 (초)
    scroll_depth INT,                           -- 스크롤 깊이 (%)
    read_completion INT,                        -- 읽기 완료율 (%)

    -- 전환 여부
    converted BOOLEAN DEFAULT FALSE,
    conversion_type VARCHAR(50),                -- reservation, inquiry, subscription
    converted_at TIMESTAMPTZ
);

-- 4. 구독자 테이블
CREATE TABLE blog_subscribers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- 구독자 정보
    name VARCHAR(100),
    phone VARCHAR(20),                          -- 카카오 알림톡용
    email VARCHAR(255),                         -- 이메일 구독용

    -- 환자 연결 (선택)
    patient_id UUID,                            -- 기존 환자와 연결 시

    -- 구독 설정
    subscribe_type VARCHAR(20) DEFAULT 'kakao', -- kakao, email, both
    subscribed_categories TEXT[],               -- 구독 카테고리 (빈 배열 = 전체)

    -- 상태
    status VARCHAR(20) DEFAULT 'active',        -- active, paused, unsubscribed
    subscribed_at TIMESTAMPTZ DEFAULT NOW(),
    unsubscribed_at TIMESTAMPTZ,
    unsubscribe_reason TEXT,

    -- 카카오 발송 정보
    kakao_user_id VARCHAR(100),                 -- 카카오 사용자 ID (친구톡용)
    kakao_opt_in BOOLEAN DEFAULT FALSE,         -- 마케팅 수신 동의

    -- 통계
    total_notifications INT DEFAULT 0,          -- 받은 알림 수
    opened_notifications INT DEFAULT 0,         -- 열어본 알림 수
    last_opened_at TIMESTAMPTZ,

    -- 메타
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(phone),
    UNIQUE(email)
);

-- 5. 구독 알림 발송 기록
CREATE TABLE blog_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID REFERENCES blog_posts(id),

    -- 발송 정보
    channel VARCHAR(20) NOT NULL,               -- kakao_alimtalk, kakao_friendtalk, email
    template_code VARCHAR(50),                  -- 알림톡 템플릿 코드

    -- 발송 대상
    total_recipients INT DEFAULT 0,
    sent_count INT DEFAULT 0,
    delivered_count INT DEFAULT 0,
    failed_count INT DEFAULT 0,
    opened_count INT DEFAULT 0,
    clicked_count INT DEFAULT 0,

    -- 상태
    status VARCHAR(20) DEFAULT 'pending',       -- pending, sending, completed, failed
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,

    -- 메타
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES portal_users(id)
);

-- 6. 개별 알림 발송 상세
CREATE TABLE blog_notification_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_id UUID REFERENCES blog_notifications(id) ON DELETE CASCADE,
    subscriber_id UUID REFERENCES blog_subscribers(id),

    -- 발송 결과
    status VARCHAR(20) DEFAULT 'pending',       -- pending, sent, delivered, failed, opened, clicked
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    opened_at TIMESTAMPTZ,
    clicked_at TIMESTAMPTZ,

    -- 에러 정보
    error_code VARCHAR(50),
    error_message TEXT,

    -- 추적
    tracking_id VARCHAR(50),                    -- 클릭 추적용 ID

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. 블로그 댓글 (선택적)
CREATE TABLE blog_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID REFERENCES blog_posts(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES blog_comments(id), -- 대댓글용

    -- 작성자
    author_name VARCHAR(100) NOT NULL,
    author_phone VARCHAR(20),                   -- 비회원 댓글용
    patient_id UUID,                            -- 환자 연결 시

    -- 내용
    content TEXT NOT NULL,

    -- 상태
    status VARCHAR(20) DEFAULT 'pending',       -- pending, approved, hidden, deleted
    is_pinned BOOLEAN DEFAULT FALSE,

    -- 메타
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    approved_at TIMESTAMPTZ,
    approved_by UUID REFERENCES portal_users(id)
);

-- 인덱스
CREATE INDEX idx_blog_posts_slug ON blog_posts(slug);
CREATE INDEX idx_blog_posts_status ON blog_posts(status);
CREATE INDEX idx_blog_posts_category ON blog_posts(category);
CREATE INDEX idx_blog_posts_published_at ON blog_posts(published_at DESC);
CREATE INDEX idx_blog_posts_series ON blog_posts(series_id, series_order);

CREATE INDEX idx_blog_page_views_post ON blog_page_views(post_id);
CREATE INDEX idx_blog_page_views_visitor ON blog_page_views(visitor_id);
CREATE INDEX idx_blog_page_views_tracking ON blog_page_views(tracking_id);
CREATE INDEX idx_blog_page_views_date ON blog_page_views(entered_at DESC);

CREATE INDEX idx_blog_subscribers_status ON blog_subscribers(status);
CREATE INDEX idx_blog_subscribers_phone ON blog_subscribers(phone);
CREATE INDEX idx_blog_subscribers_email ON blog_subscribers(email);

CREATE INDEX idx_blog_comments_post ON blog_comments(post_id);
CREATE INDEX idx_blog_comments_status ON blog_comments(status);

-- 조회수 업데이트 함수
CREATE OR REPLACE FUNCTION update_blog_post_stats()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE blog_posts
    SET
        view_count = (SELECT COUNT(*) FROM blog_page_views WHERE post_id = NEW.post_id),
        unique_visitor_count = (SELECT COUNT(DISTINCT visitor_id) FROM blog_page_views WHERE post_id = NEW.post_id),
        avg_read_time = (SELECT COALESCE(AVG(dwell_time), 0) FROM blog_page_views WHERE post_id = NEW.post_id AND dwell_time IS NOT NULL)
    WHERE id = NEW.post_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_blog_stats
AFTER INSERT ON blog_page_views
FOR EACH ROW
EXECUTE FUNCTION update_blog_post_stats();

-- 댓글 수 업데이트 트리거
CREATE OR REPLACE FUNCTION update_blog_comment_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE blog_posts SET comment_count = comment_count + 1 WHERE id = NEW.post_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE blog_posts SET comment_count = comment_count - 1 WHERE id = OLD.post_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_comment_count
AFTER INSERT OR DELETE ON blog_comments
FOR EACH ROW
EXECUTE FUNCTION update_blog_comment_count();
