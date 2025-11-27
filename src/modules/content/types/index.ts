/**
 * 컨텐츠 관리 시스템 타입 정의
 */

// 컨텐츠 타입
export type ContentType =
  | 'blog'          // 블로그/칼럼
  | 'guide'         // 안내페이지 (방문안내, 복약안내 등)
  | 'landing'       // 랜딩페이지 (캠페인용)
  | 'event_dm'      // 이벤트 DM
  | 'youtube';      // 유튜브 (롱폼/숏폼)

// 유튜브 영상 타입
export type YouTubeVideoType =
  | 'long'          // 롱폼 (일반 영상)
  | 'short';        // 숏폼 (Shorts)

// 유튜브 카테고리
export type YouTubeCategory =
  | 'health_info'       // 건강정보
  | 'treatment_guide'   // 치료안내
  | 'daily_tip'         // 일상건강팁
  | 'case_study'        // 치료사례
  | 'qa'                // Q&A
  | 'behind'            // 비하인드/일상
  | 'interview';        // 환자인터뷰

// 컨텐츠 상태
export type ContentStatus =
  | 'draft'         // 초안
  | 'review'        // 검수 중
  | 'approved'      // 승인됨
  | 'published'     // 발행됨
  | 'archived';     // 보관됨

// 블로그 카테고리
export type BlogCategory =
  | 'health_info'       // 건강정보
  | 'treatment_guide'   // 치료안내
  | 'clinic_news'       // 한의원 소식
  | 'lifestyle'         // 생활건강
  | 'case_study'        // 치료사례
  | 'faq';              // FAQ

// 안내페이지 카테고리
export type GuideCategory =
  | 'visit'             // 방문 안내
  | 'parking'           // 주차 안내
  | 'medication'        // 복약 안내
  | 'preparation'       // 진료 준비사항
  | 'aftercare'         // 치료 후 관리
  | 'consent'           // 동의서/설명서
  | 'insurance';        // 보험 안내

// 이벤트 유형
export type EventType =
  | 'seasonal'          // 시즌 이벤트 (설, 추석 등)
  | 'promotion'         // 프로모션
  | 'opening'           // 오픈 기념
  | 'anniversary'       // 기념일
  | 'referral'          // 추천 이벤트
  | 'new_patient';      // 신규 환자

// 기본 컨텐츠 인터페이스
export interface ContentBase {
  id: string;
  type: ContentType;
  status: ContentStatus;

  // 기본 정보
  title: string;
  slug: string;             // URL용 슬러그

  // 본문
  content: string;          // HTML 또는 마크다운
  excerpt?: string;         // 요약 (미리보기용)

  // 미디어
  thumbnail?: string;
  images?: string[];
  attachments?: ContentAttachment[];

  // SEO
  metaTitle?: string;
  metaDescription?: string;
  keywords?: string[];

  // 추적
  trackingEnabled: boolean;
  shortUrl?: string;

  // 통계
  views: number;
  clicks: number;
  conversions: number;

  // 메타
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;

  // 검수
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNote?: string;
}

// 첨부파일
export interface ContentAttachment {
  id: string;
  name: string;
  url: string;
  type: 'pdf' | 'image' | 'video' | 'other';
  size: number;           // bytes
}

// 블로그 포스트
export interface BlogPost extends ContentBase {
  type: 'blog';
  category: BlogCategory;

  // 블로그 전용
  author: string;
  authorProfile?: string;
  readingTime?: number;     // 예상 읽기 시간 (분)
  tags: string[];

  // 시리즈
  seriesId?: string;
  seriesOrder?: number;

  // 관련 글
  relatedPosts?: string[];
}

// 안내 페이지
export interface GuidePage extends ContentBase {
  type: 'guide';
  category: GuideCategory;

  // 안내페이지 전용
  targetAudience?: 'all' | 'new_patient' | 'returning';
  validFrom?: string;       // 유효 시작일
  validUntil?: string;      // 유효 종료일

  // 버전 관리
  version: number;
  previousVersionId?: string;

  // 필수 확인 여부
  requiresAcknowledgment?: boolean;
}

// 랜딩 페이지
export interface LandingPage extends ContentBase {
  type: 'landing';

  // 랜딩페이지 전용
  campaignId?: string;
  campaignName?: string;

  // 타겟팅
  targetKeywords?: string[];
  targetAudience?: string;

  // CTA
  ctaText?: string;
  ctaLink?: string;
  ctaPhone?: string;

  // A/B 테스트
  variantId?: string;
  variantName?: string;

  // 유효 기간
  startDate?: string;
  endDate?: string;
}

// 이벤트 DM
export interface EventDM extends ContentBase {
  type: 'event_dm';
  eventType: EventType;

  // 이벤트 정보
  eventName: string;
  eventDescription?: string;

  // 기간
  eventStartDate: string;
  eventEndDate: string;

  // 혜택
  benefitSummary?: string;
  benefitDetails?: string[];
  discountRate?: number;
  discountAmount?: number;

  // 대상
  targetPatients?: 'all' | 'new' | 'existing' | 'dormant';
  targetConditions?: string[];

  // 발송 설정
  dmTemplate?: {
    channel: 'kakao_alimtalk' | 'kakao_friendtalk' | 'sms' | 'lms';
    messageContent: string;
    buttons?: {
      name: string;
      link: string;
    }[];
  };

  // 발송 통계
  sentCount?: number;
  deliveredCount?: number;
  clickedCount?: number;
  convertedCount?: number;
}

// 유튜브 영상
export interface YouTubeVideo extends ContentBase {
  type: 'youtube';
  videoType: YouTubeVideoType;
  category: YouTubeCategory;

  // 유튜브 정보
  videoId: string;              // YouTube Video ID
  channelId?: string;
  channelName?: string;

  // 영상 정보
  duration: number;             // 초 단위
  thumbnailUrl?: string;
  embedUrl?: string;

  // 유튜브 통계 (API에서 가져옴)
  youtubeViews: number;
  youtubeLikes: number;
  youtubeComments: number;
  youtubeShares?: number;

  // 구독자 전환
  subscriberGain?: number;      // 이 영상으로 인한 구독자 증가

  // 태그
  tags: string[];
  hashtags?: string[];

  // 촬영/편집 정보
  recordedAt?: string;          // 촬영일
  editedBy?: string;            // 편집자

  // 시리즈
  seriesId?: string;
  seriesName?: string;
  seriesOrder?: number;

  // 관련 블로그 포스트 연결
  linkedBlogPostId?: string;

  // 업로드 상태
  uploadStatus: 'draft' | 'uploading' | 'processing' | 'published' | 'private' | 'unlisted';
  scheduledPublishAt?: string;  // 예약 공개
}

// 유니온 타입
export type Content = BlogPost | GuidePage | LandingPage | EventDM | YouTubeVideo;

// 컨텐츠 타입 라벨
export const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  blog: '블로그',
  guide: '안내페이지',
  landing: '랜딩페이지',
  event_dm: '이벤트DM',
  youtube: '유튜브',
};

// 컨텐츠 상태 라벨
export const CONTENT_STATUS_LABELS: Record<ContentStatus, string> = {
  draft: '초안',
  review: '검수중',
  approved: '승인됨',
  published: '발행됨',
  archived: '보관됨',
};

// 컨텐츠 상태 색상
export const CONTENT_STATUS_COLORS: Record<ContentStatus, string> = {
  draft: 'bg-gray-100 text-gray-800',
  review: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-blue-100 text-blue-800',
  published: 'bg-green-100 text-green-800',
  archived: 'bg-gray-100 text-gray-500',
};

// 블로그 카테고리 라벨
export const BLOG_CATEGORY_LABELS: Record<BlogCategory, string> = {
  health_info: '건강정보',
  treatment_guide: '치료안내',
  clinic_news: '한의원소식',
  lifestyle: '생활건강',
  case_study: '치료사례',
  faq: 'FAQ',
};

// 안내페이지 카테고리 라벨
export const GUIDE_CATEGORY_LABELS: Record<GuideCategory, string> = {
  visit: '방문안내',
  parking: '주차안내',
  medication: '복약안내',
  preparation: '진료준비사항',
  aftercare: '치료후관리',
  consent: '동의서/설명서',
  insurance: '보험안내',
};

// 이벤트 유형 라벨
export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  seasonal: '시즌이벤트',
  promotion: '프로모션',
  opening: '오픈기념',
  anniversary: '기념일',
  referral: '추천이벤트',
  new_patient: '신규환자',
};

// 이벤트 유형 색상
export const EVENT_TYPE_COLORS: Record<EventType, string> = {
  seasonal: 'bg-orange-100 text-orange-800',
  promotion: 'bg-pink-100 text-pink-800',
  opening: 'bg-purple-100 text-purple-800',
  anniversary: 'bg-blue-100 text-blue-800',
  referral: 'bg-green-100 text-green-800',
  new_patient: 'bg-cyan-100 text-cyan-800',
};

// 유튜브 영상 타입 라벨
export const YOUTUBE_VIDEO_TYPE_LABELS: Record<YouTubeVideoType, string> = {
  long: '롱폼',
  short: '숏폼',
};

// 유튜브 카테고리 라벨
export const YOUTUBE_CATEGORY_LABELS: Record<YouTubeCategory, string> = {
  health_info: '건강정보',
  treatment_guide: '치료안내',
  daily_tip: '일상건강팁',
  case_study: '치료사례',
  qa: 'Q&A',
  behind: '비하인드',
  interview: '환자인터뷰',
};

// 유튜브 카테고리 색상
export const YOUTUBE_CATEGORY_COLORS: Record<YouTubeCategory, string> = {
  health_info: 'bg-blue-100 text-blue-800',
  treatment_guide: 'bg-green-100 text-green-800',
  daily_tip: 'bg-yellow-100 text-yellow-800',
  case_study: 'bg-purple-100 text-purple-800',
  qa: 'bg-orange-100 text-orange-800',
  behind: 'bg-pink-100 text-pink-800',
  interview: 'bg-cyan-100 text-cyan-800',
};

// 유튜브 업로드 상태 라벨
export const YOUTUBE_UPLOAD_STATUS_LABELS: Record<YouTubeVideo['uploadStatus'], string> = {
  draft: '초안',
  uploading: '업로드중',
  processing: '처리중',
  published: '공개',
  private: '비공개',
  unlisted: '일부공개',
};

// 유튜브 업로드 상태 색상
export const YOUTUBE_UPLOAD_STATUS_COLORS: Record<YouTubeVideo['uploadStatus'], string> = {
  draft: 'bg-gray-100 text-gray-800',
  uploading: 'bg-yellow-100 text-yellow-800',
  processing: 'bg-blue-100 text-blue-800',
  published: 'bg-green-100 text-green-800',
  private: 'bg-red-100 text-red-800',
  unlisted: 'bg-orange-100 text-orange-800',
};
