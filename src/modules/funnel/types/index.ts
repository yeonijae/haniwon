/**
 * 퍼널 관리 시스템 타입 정의
 */

// 리드 채널
export type LeadChannel =
  | 'phone'           // 전화
  | 'website'         // 홈페이지
  | 'kakao'           // 카카오톡
  | 'naver_talk'      // 네이버톡톡
  | 'naver_booking'   // 네이버예약
  | 'daangn'          // 당근
  | 'referral'        // 소개
  | 'walk_in'         // 직접 방문
  | 'other';          // 기타

// 리드 상태
export type LeadStatus =
  | 'new'             // 신규 문의
  | 'contacted'       // 연락 완료
  | 'consulting'      // 상담 중
  | 'reserved'        // 예약 완료
  | 'visited'         // 방문 완료
  | 'converted'       // 진료 전환
  | 'lost'            // 이탈
  | 'pending';        // 보류

// 리드 유입 소스 (어떤 콘텐츠/캠페인을 통해)
export interface LeadSource {
  type: 'content' | 'campaign' | 'referral' | 'direct' | 'unknown';
  id?: string;        // 콘텐츠 ID 또는 캠페인 ID
  name?: string;      // 소스 이름
  url?: string;       // 유입 URL
}

// 리드 (잠재 환자)
export interface Lead {
  id: string;
  name: string;
  phone: string;
  email?: string;

  // 유입 정보
  channel: LeadChannel;
  source?: LeadSource;

  // 상태
  status: LeadStatus;

  // 관심 분야
  interests: string[];  // 예: ['다이어트', '산후조리']

  // 상담 이력
  consultations: Consultation[];

  // 팔로업
  nextFollowUp?: string;  // ISO date
  followUpNote?: string;

  // 메타
  createdAt: string;
  updatedAt: string;
  assignedTo?: string;  // 담당자

  // 전환 정보
  convertedPatientId?: number;  // 환자로 전환 시 환자 ID
  convertedAt?: string;
}

// 상담 이력
export interface Consultation {
  id: string;
  leadId: string;
  date: string;
  type: 'phone' | 'chat' | 'visit' | 'message';
  summary: string;
  outcome: 'positive' | 'neutral' | 'negative' | 'no_answer';
  nextAction?: string;
  createdBy: string;
  createdAt: string;
}

// 컨텐츠 유형
export type ContentType =
  | 'blog'            // 블로그/칼럼
  | 'landing'         // 랜딩 페이지
  | 'message'         // 문자/카톡 메시지
  | 'guide'           // 안내 페이지 (오시는 길, 준비사항 등)
  | 'casebook'        // 케이스북/치료사례
  | 'faq'             // FAQ
  | 'medication'      // 복약 안내
  | 'consent'         // 동의서/설명서
  | 'promotion'       // 프로모션/이벤트
  | 'other';

// 컨텐츠 상태
export type ContentStatus =
  | 'draft'           // 초안
  | 'review'          // 검수 중
  | 'approved'        // 승인됨
  | 'published'       // 발행됨
  | 'archived';       // 보관됨

// 퍼널 단계 (컨텐츠가 사용되는 단계)
export type FunnelStage =
  | 'awareness'       // 1. 인지
  | 'interest'        // 2. 관심
  | 'reservation'     // 3. 예약
  | 'visit'           // 4. 방문
  | 'waiting'         // 5. 대기
  | 'diagnosis'       // 6. 진단
  | 'consultation'    // 7. 상담
  | 'treatment'       // 8. 진료
  | 'management'      // 9. 관리
  | 'referral';       // 10. 소개

// 컨텐츠
export interface Content {
  id: string;
  title: string;
  type: ContentType;
  status: ContentStatus;

  // 퍼널 단계
  funnelStages: FunnelStage[];

  // 본문
  body: string;
  excerpt?: string;   // 요약

  // 미디어
  thumbnail?: string;
  attachments?: string[];

  // 링크
  shortUrl?: string;
  originalUrl?: string;

  // 태그/카테고리
  tags: string[];
  category?: string;

  // 성과
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

// 리타겟팅 규칙
export interface RetargetingRule {
  id: string;
  name: string;
  description?: string;

  // 조건
  triggerStatus: LeadStatus;  // 어떤 상태에서
  daysSinceTrigger: number;   // 며칠 후

  // 액션
  actionType: 'message' | 'call' | 'email';
  messageTemplate?: string;

  // 활성화 여부
  isActive: boolean;

  createdAt: string;
  updatedAt: string;
}

// 퍼널 통계
export interface FunnelStats {
  period: {
    start: string;
    end: string;
  };

  // 단계별 수치
  stages: {
    stage: FunnelStage;
    count: number;
    conversionRate: number;  // 다음 단계로의 전환율
  }[];

  // 채널별 유입
  channelBreakdown: {
    channel: LeadChannel;
    count: number;
    percentage: number;
  }[];

  // 전환율
  overallConversionRate: number;  // 문의 → 진료 전체 전환율

  // 병목 구간
  bottleneck?: {
    fromStage: FunnelStage;
    toStage: FunnelStage;
    dropRate: number;
  };
}

// 채널 라벨
export const CHANNEL_LABELS: Record<LeadChannel, string> = {
  phone: '전화',
  website: '홈페이지',
  kakao: '카카오톡',
  naver_talk: '네이버톡톡',
  naver_booking: '네이버예약',
  daangn: '당근',
  referral: '소개',
  walk_in: '직접방문',
  other: '기타',
};

// 상태 라벨
export const STATUS_LABELS: Record<LeadStatus, string> = {
  new: '신규',
  contacted: '연락완료',
  consulting: '상담중',
  reserved: '예약완료',
  visited: '방문완료',
  converted: '진료전환',
  lost: '이탈',
  pending: '보류',
};

// 상태 색상
export const STATUS_COLORS: Record<LeadStatus, string> = {
  new: 'bg-blue-100 text-blue-800',
  contacted: 'bg-yellow-100 text-yellow-800',
  consulting: 'bg-orange-100 text-orange-800',
  reserved: 'bg-purple-100 text-purple-800',
  visited: 'bg-indigo-100 text-indigo-800',
  converted: 'bg-green-100 text-green-800',
  lost: 'bg-red-100 text-red-800',
  pending: 'bg-gray-100 text-gray-800',
};

// 컨텐츠 유형 라벨
export const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  blog: '블로그/칼럼',
  landing: '랜딩페이지',
  message: '문자/메시지',
  guide: '안내페이지',
  casebook: '케이스북',
  faq: 'FAQ',
  medication: '복약안내',
  consent: '동의서/설명서',
  promotion: '프로모션',
  other: '기타',
};

// 퍼널 단계 라벨
export const FUNNEL_STAGE_LABELS: Record<FunnelStage, string> = {
  awareness: '1. 인지',
  interest: '2. 관심',
  reservation: '3. 예약',
  visit: '4. 방문',
  waiting: '5. 대기',
  diagnosis: '6. 진단',
  consultation: '7. 상담',
  treatment: '8. 진료',
  management: '9. 관리',
  referral: '10. 소개',
};

// ============================================
// 아웃바운드(DM발송) 관리 타입
// ============================================

// 발송 채널
export type OutboundChannel =
  | 'sms'           // 문자
  | 'lms'           // 장문 문자
  | 'mms'           // 멀티미디어 문자
  | 'kakao_alimtalk'    // 카카오 알림톡
  | 'kakao_friendtalk'  // 카카오 친구톡
  | 'email';        // 이메일

// ============================================
// 카카오 알림톡/친구톡 버튼 타입
// ============================================

// 카카오 버튼 타입
export type KakaoButtonType =
  | 'WL'    // 웹 링크
  | 'AL'    // 앱 링크
  | 'BK'    // 봇 키워드 (챗봇 연결)
  | 'MD'    // 메시지 전달
  | 'BC'    // 상담톡 전환
  | 'BT'    // 봇 전환
  | 'AC';   // 채널 추가

// 카카오 버튼
export interface KakaoButton {
  type: KakaoButtonType;
  name: string;               // 버튼 텍스트 (최대 14자)

  // WL (웹 링크) 타입
  linkMobile?: string;        // 모바일 웹 URL
  linkPc?: string;            // PC 웹 URL

  // AL (앱 링크) 타입
  schemeIos?: string;         // iOS 앱 스킴
  schemeAndroid?: string;     // 안드로이드 앱 스킴
}

// 카카오 알림톡 템플릿
export interface KakaoAlimtalkTemplate {
  id: string;
  templateCode: string;       // 카카오에 등록된 템플릿 코드
  name: string;

  // 템플릿 내용
  content: string;            // 본문 (변수: #{이름}, #{예약일시} 등)

  // 버튼 (최대 5개)
  buttons: KakaoButton[];

  // 이미지 (선택)
  imageUrl?: string;

  // 템플릿 상태
  status: 'pending' | 'approved' | 'rejected';
  rejectedReason?: string;

  // 카테고리
  category: OutboundCategory;

  // 메타
  createdAt: string;
  updatedAt: string;
}

// 카카오 친구톡 메시지 타입
export type KakaoFriendtalkType =
  | 'text'      // 텍스트
  | 'image'     // 이미지
  | 'wide'      // 와이드 이미지
  | 'list';     // 리스트

// 카카오 친구톡 캐러셀 아이템
export interface KakaoCarouselItem {
  imageUrl: string;
  title: string;
  description?: string;
  buttons?: KakaoButton[];
  linkUrl?: string;           // 이미지/제목 클릭 시 이동 URL
}

// 카카오 친구톡 메시지
export interface KakaoFriendtalkMessage {
  type: KakaoFriendtalkType;

  // 텍스트
  content?: string;

  // 이미지
  imageUrl?: string;
  imageLink?: string;         // 이미지 클릭 시 이동 URL

  // 와이드 이미지
  wideImageUrl?: string;

  // 버튼 (최대 5개)
  buttons?: KakaoButton[];

  // 캐러셀 (리스트 타입)
  carousel?: KakaoCarouselItem[];

  // 광고 문구 (친구톡은 필수)
  adFlag: boolean;            // 광고 여부 (친구톡은 true)
}

// 카카오 메시지 발송 옵션 (OutboundMessage 확장용)
export interface KakaoMessageOptions {
  // 알림톡
  alimtalkTemplateCode?: string;
  alimtalkButtons?: KakaoButton[];

  // 친구톡
  friendtalkMessage?: KakaoFriendtalkMessage;

  // 대체 발송 (카카오 실패 시)
  fallbackType?: 'sms' | 'lms' | 'mms' | 'none';
  fallbackContent?: string;

  // 발신 프로필
  senderKey?: string;         // 카카오 채널 발신 프로필 키
}

// 발송 모듈 (어느 모듈에서 발송했는지)
export type OutboundSourceModule =
  | 'manage'        // 운영관리
  | 'chart'         // 진료관리
  | 'patient_care'  // 환자관리
  | 'funnel'        // 퍼널관리
  | 'inventory'     // 재고관리
  | 'treatment'     // 치료관리
  | 'system';       // 시스템 자동

// 발송 상태 (내부 추적 방식)
export type OutboundStatus =
  | 'pending'       // 대기
  | 'scheduled'     // 예약됨
  | 'sending'       // 발송 중
  | 'sent'          // 발송 완료
  | 'clicked'       // 링크 클릭됨 (내부 추적)
  | 'engaged'       // 충분히 읽음 (체류시간 기준 충족)
  | 'converted'     // 전환 완료 (예약, 문의 등 목표 달성)
  | 'failed'        // 실패
  | 'cancelled';    // 취소됨

// 발송 목적/카테고리
export type OutboundCategory =
  | 'reservation_confirm'   // 예약 확인
  | 'reservation_remind'    // 예약 리마인드
  | 'visit_guide'           // 방문 안내
  | 'treatment_guide'       // 치료 안내
  | 'medication_guide'      // 복약 안내
  | 'follow_up'             // 팔로업
  | 'happy_call'            // 해피콜
  | 'campaign'              // 캠페인/마케팅
  | 'retargeting'           // 리타겟팅
  | 'notification'          // 일반 알림
  | 'other';                // 기타

// 발송 메시지
export interface OutboundMessage {
  id: string;

  // 수신자 정보
  recipientId: string;        // 환자 ID 또는 리드 ID
  recipientType: 'patient' | 'lead';
  recipientName: string;
  recipientPhone: string;

  // 발송 정보
  channel: OutboundChannel;
  category: OutboundCategory;

  // 내용
  title?: string;             // 제목 (이메일, MMS 등)
  content: string;
  templateId?: string;        // 사용된 템플릿 ID

  // 카카오 알림톡/친구톡 옵션
  kakaoOptions?: KakaoMessageOptions;

  // 상태
  status: OutboundStatus;
  statusMessage?: string;     // 실패 사유 등

  // 출처 추적
  sourceModule: OutboundSourceModule;
  sourcePage?: string;        // 발송한 페이지 (예: 'reservation_list', 'lead_detail')
  sourceAction?: string;      // 발송 계기 (예: 'manual', 'bulk', 'auto')

  // 퍼널 단계 (리드인 경우)
  funnelStage?: FunnelStage;

  // 발송 시간
  scheduledAt?: string;       // 예약 발송 시간
  sentAt?: string;            // 실제 발송 시간

  // 내부 추적 (링크 트래킹)
  trackingId?: string;        // 고유 추적 ID (단축 URL용)
  trackingUrl?: string;       // 추적 링크 (예: /t/abc123)
  targetUrl?: string;         // 최종 목적지 URL

  // 클릭 추적
  clickedAt?: string;         // 링크 클릭 시간
  clickCount: number;         // 클릭 횟수

  // 페이지 체류 추적
  pageViews: PageViewTracking[];  // 페이지 조회 기록
  totalDwellTime: number;     // 총 체류 시간 (초)
  engagedAt?: string;         // engaged 상태 달성 시간

  // 전환 추적
  convertedAt?: string;       // 전환 완료 시간
  conversionType?: 'reservation' | 'inquiry' | 'signup' | 'purchase' | 'other';
  conversionValue?: string;   // 전환 상세 (예: 예약ID)

  // 메타
  createdBy: string;
  createdAt: string;

  // 관련 컨텐츠
  relatedContentId?: string;  // 연결된 컨텐츠 ID
}

// 페이지 조회 추적
export interface PageViewTracking {
  pageUrl: string;            // 조회한 페이지
  pageTitle?: string;         // 페이지 제목
  viewedAt: string;           // 조회 시작 시간
  dwellTime: number;          // 체류 시간 (초)
  scrollDepth?: number;       // 스크롤 깊이 (0-100%)
  interactions?: string[];    // 상호작용 (버튼 클릭 등)
}

// 반복 발송 규칙 (자동화)
export type ScheduleRepeatType =
  | 'once'          // 1회
  | 'daily'         // 매일
  | 'weekly'        // 매주
  | 'monthly'       // 매월
  | 'trigger';      // 트리거 기반

// 트리거 조건
export interface OutboundTrigger {
  event: 'reservation_created' | 'reservation_day' | 'visit_completed' | 'treatment_completed' | 'lead_status_changed' | 'custom';
  daysOffset: number;         // 이벤트로부터 +/- 며칠
  timeOfDay?: string;         // 발송 시각 (HH:mm)
  conditions?: {              // 추가 조건
    field: string;
    operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than';
    value: string | number;
  }[];
}

// 자동화 규칙
export interface OutboundAutomation {
  id: string;
  name: string;
  description?: string;

  // 발송 대상
  targetType: 'patient' | 'lead' | 'both';
  targetFilter?: {            // 대상 필터
    funnelStages?: FunnelStage[];
    leadStatuses?: LeadStatus[];
    patientTags?: string[];
  };

  // 발송 내용
  channel: OutboundChannel;
  category: OutboundCategory;
  templateId: string;

  // 스케줄
  repeatType: ScheduleRepeatType;
  trigger?: OutboundTrigger;  // trigger 타입인 경우
  cronExpression?: string;    // 반복 스케줄인 경우

  // 상태
  isActive: boolean;
  lastRunAt?: string;
  nextRunAt?: string;

  // 통계
  totalSent: number;
  totalDelivered: number;
  totalRead: number;
  totalFailed: number;

  // 메타
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// 예정 발송 (큐)
export interface ScheduledOutbound {
  id: string;
  messageId: string;          // OutboundMessage의 ID
  automationId?: string;      // 자동화 규칙으로 생성된 경우

  scheduledAt: string;

  // 미리보기
  recipientName: string;
  recipientPhone: string;
  channel: OutboundChannel;
  contentPreview: string;     // 내용 미리보기 (50자)

  // 상태
  status: 'pending' | 'processing' | 'completed' | 'cancelled';

  createdAt: string;
}

// 채널 라벨
export const OUTBOUND_CHANNEL_LABELS: Record<OutboundChannel, string> = {
  sms: '문자(SMS)',
  lms: '장문(LMS)',
  mms: '멀티미디어(MMS)',
  kakao_alimtalk: '알림톡',
  kakao_friendtalk: '친구톡',
  email: '이메일',
};

// 카테고리 라벨
export const OUTBOUND_CATEGORY_LABELS: Record<OutboundCategory, string> = {
  reservation_confirm: '예약확인',
  reservation_remind: '예약리마인드',
  visit_guide: '방문안내',
  treatment_guide: '치료안내',
  medication_guide: '복약안내',
  follow_up: '팔로업',
  happy_call: '해피콜',
  campaign: '캠페인',
  retargeting: '리타겟팅',
  notification: '일반알림',
  other: '기타',
};

// 모듈 라벨
export const OUTBOUND_MODULE_LABELS: Record<OutboundSourceModule, string> = {
  manage: '운영관리',
  chart: '진료관리',
  patient_care: '환자관리',
  funnel: '퍼널관리',
  inventory: '재고관리',
  treatment: '치료관리',
  system: '시스템',
};

// 상태 라벨 (내부 추적 방식)
export const OUTBOUND_STATUS_LABELS: Record<OutboundStatus, string> = {
  pending: '대기',
  scheduled: '예약됨',
  sending: '발송중',
  sent: '발송완료',
  clicked: '클릭됨',
  engaged: '읽음',
  converted: '전환',
  failed: '실패',
  cancelled: '취소',
};

// 상태 색상 (내부 추적 방식)
export const OUTBOUND_STATUS_COLORS: Record<OutboundStatus, string> = {
  pending: 'bg-gray-100 text-gray-800',
  scheduled: 'bg-blue-100 text-blue-800',
  sending: 'bg-yellow-100 text-yellow-800',
  sent: 'bg-green-100 text-green-800',
  clicked: 'bg-cyan-100 text-cyan-800',
  engaged: 'bg-teal-100 text-teal-800',
  converted: 'bg-purple-100 text-purple-800',
  failed: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-500',
};

// Engaged 판정 기준 (체류시간, 초)
export const ENGAGED_THRESHOLD_SECONDS = 30;

// 전환 타입 라벨
export const CONVERSION_TYPE_LABELS: Record<string, string> = {
  reservation: '예약',
  inquiry: '문의',
  signup: '가입',
  purchase: '구매',
  other: '기타',
};

// 카카오 버튼 타입 라벨
export const KAKAO_BUTTON_TYPE_LABELS: Record<KakaoButtonType, string> = {
  WL: '웹 링크',
  AL: '앱 링크',
  BK: '봇 키워드',
  MD: '메시지 전달',
  BC: '상담톡 전환',
  BT: '봇 전환',
  AC: '채널 추가',
};

// 카카오 친구톡 메시지 타입 라벨
export const KAKAO_FRIENDTALK_TYPE_LABELS: Record<KakaoFriendtalkType, string> = {
  text: '텍스트',
  image: '이미지',
  wide: '와이드 이미지',
  list: '리스트형',
};

// 알림톡 템플릿 상태 라벨
export const KAKAO_TEMPLATE_STATUS_LABELS: Record<string, string> = {
  pending: '검수 대기',
  approved: '승인됨',
  rejected: '반려됨',
};

// 알림톡 템플릿 상태 색상
export const KAKAO_TEMPLATE_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
};
