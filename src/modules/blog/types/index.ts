/**
 * 공개 블로그 시스템 타입 정의
 * - SEO 최적화
 * - 구독 시스템
 * - 페이지 추적
 */

// 블로그 카테고리
export type BlogCategory =
  | 'health_info'       // 건강정보
  | 'treatment_guide'   // 치료안내
  | 'clinic_news'       // 한의원 소식
  | 'lifestyle'         // 생활건강
  | 'case_study'        // 치료사례
  | 'faq';              // FAQ

// 블로그 상태
export type BlogStatus = 'draft' | 'review' | 'published' | 'archived';
export type BlogPostStatus = 'draft' | 'published' | 'archived';

// 블로그 포스트 (공개용)
export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  contentFormat: 'markdown' | 'html';

  // 카테고리 & 태그
  category: BlogCategory;
  tags: string[];

  // 작성자
  authorName: string;
  authorProfile?: string;

  // 미디어
  thumbnailUrl?: string;
  images?: string[];

  // SEO
  metaTitle?: string;
  metaDescription?: string;
  metaKeywords?: string[];
  canonicalUrl?: string;
  ogImage?: string;

  // 시리즈
  series?: {
    id: string;
    title: string;
    currentOrder: number;
    totalPosts: number;
    prevPost?: { slug: string; title: string };
    nextPost?: { slug: string; title: string };
  };

  // 관련 글
  relatedPosts?: BlogPostSummary[];

  // 통계 (공개용)
  viewCount: number;
  likeCount: number;
  commentCount: number;
  readingTime: number;        // 분 단위

  // 날짜
  publishedAt: string;
  updatedAt?: string;
}

// 블로그 요약 (목록용)
export interface BlogPostSummary {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  category: BlogCategory;
  tags: string[];
  thumbnailUrl?: string;
  authorName: string;
  viewCount: number;
  readingTime: number;
  publishedAt: string;
}

// 블로그 시리즈
export interface BlogSeries {
  id: string;
  title: string;
  slug: string;
  description?: string;
  thumbnailUrl?: string;
  postCount: number;
  posts: BlogPostSummary[];
}

// SEO 메타데이터
export interface SEOMetadata {
  title: string;
  description: string;
  keywords?: string[];
  canonicalUrl?: string;
  ogType?: 'website' | 'article';
  ogImage?: string;
  ogTitle?: string;
  ogDescription?: string;
  twitterCard?: 'summary' | 'summary_large_image';
  jsonLd?: Record<string, unknown>;  // 구조화된 데이터
}

// 구독 타입
export type SubscribeType = 'kakao' | 'email' | 'both';

// 구독자
export interface BlogSubscriber {
  id: string;
  name?: string;
  phone?: string;
  email?: string;
  subscribeType: SubscribeType;
  subscribedCategories: BlogCategory[];  // 빈 배열 = 전체 구독
  status: 'active' | 'paused' | 'unsubscribed';
  subscribedAt: string;
}

// 구독 신청 폼
export interface SubscribeForm {
  name?: string;
  phone?: string;           // 카카오 알림톡용
  email?: string;           // 이메일용
  subscribeType: SubscribeType;
  categories?: BlogCategory[];
  marketingConsent: boolean;  // 마케팅 수신 동의
}

// 페이지 뷰 추적
export interface PageViewEvent {
  postId: string;
  visitorId: string;
  sessionId: string;
  referrer?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  trackingId?: string;      // DM 추적 ID
}

// 페이지 이탈 추적
export interface PageExitEvent {
  postId: string;
  visitorId: string;
  sessionId: string;
  dwellTime: number;        // 체류 시간 (초)
  scrollDepth: number;      // 스크롤 깊이 (%)
  readCompletion: number;   // 읽기 완료율 (%)
}

// 전환 이벤트
export interface ConversionEvent {
  postId: string;
  visitorId: string;
  conversionType: 'reservation' | 'inquiry' | 'subscription' | 'phone_call';
}

// 댓글
export interface BlogComment {
  id: string;
  postId: string;
  parentId?: string;
  authorName: string;
  content: string;
  createdAt: string;
  replies?: BlogComment[];
  isPinned?: boolean;
}

// 댓글 작성 폼
export interface CommentForm {
  authorName: string;
  authorPhone?: string;     // 비회원 인증용
  content: string;
  parentId?: string;
}

// 라벨
export const BLOG_CATEGORY_LABELS: Record<BlogCategory, string> = {
  health_info: '건강정보',
  treatment_guide: '치료안내',
  clinic_news: '한의원소식',
  lifestyle: '생활건강',
  case_study: '치료사례',
  faq: 'FAQ',
};

export const BLOG_CATEGORY_COLORS: Record<BlogCategory, string> = {
  health_info: 'bg-blue-100 text-blue-800',
  treatment_guide: 'bg-green-100 text-green-800',
  clinic_news: 'bg-purple-100 text-purple-800',
  lifestyle: 'bg-yellow-100 text-yellow-800',
  case_study: 'bg-pink-100 text-pink-800',
  faq: 'bg-gray-100 text-gray-800',
};

export const BLOG_CATEGORY_ICONS: Record<BlogCategory, string> = {
  health_info: 'fa-solid fa-heart-pulse',
  treatment_guide: 'fa-solid fa-stethoscope',
  clinic_news: 'fa-solid fa-newspaper',
  lifestyle: 'fa-solid fa-leaf',
  case_study: 'fa-solid fa-user-check',
  faq: 'fa-solid fa-circle-question',
};
