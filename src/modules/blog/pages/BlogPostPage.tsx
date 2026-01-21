/**
 * 블로그 상세 페이지 (공개)
 * - SEO 최적화
 * - 페이지 추적
 * - 관련 글
 * - 구독 CTA
 */

import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { SEOHead, generatePostSEO } from '../components/SEOHead';
import { usePageTracking } from '../hooks/usePageTracking';
import type { BlogPost, BlogPostSummary } from '../types';
import {
  BLOG_CATEGORY_LABELS,
  BLOG_CATEGORY_COLORS,
} from '../types';

// 목업 데이터
const mockPost: BlogPost = {
  id: '1',
  title: '목디스크 초기 증상 5가지, 놓치면 안 되는 신호들',
  slug: 'neck-disc-early-symptoms',
  excerpt: '목디스크는 초기에 발견하면 비수술 치료로 충분히 호전될 수 있습니다. 이 글에서는 목디스크의 초기 증상 5가지와 자가진단 방법을 알려드립니다.',
  content: `
## 목디스크란?

목디스크(경추 추간판 탈출증)는 목 부위의 디스크가 밀려나와 신경을 압박하는 질환입니다. 현대인의 잘못된 자세 습관으로 인해 점점 더 많은 분들이 목디스크로 고통받고 있습니다.

## 초기 증상 5가지

### 1. 목 뒤쪽 뻣뻣함

가장 흔한 초기 증상입니다. 아침에 일어났을 때 목이 뻣뻣하고, 고개를 돌리기 어려운 느낌이 듭니다.

### 2. 어깨와 등 통증

목디스크가 있으면 어깨와 등까지 통증이 퍼질 수 있습니다. 특히 한쪽 어깨가 유독 아프다면 목디스크를 의심해봐야 합니다.

### 3. 팔 저림 및 손가락 저림

디스크가 신경을 압박하면 팔이나 손가락에 저린 느낌이 생깁니다. 새끼손가락이나 약지가 저리는 경우가 많습니다.

### 4. 두통

목디스크로 인한 근육 긴장은 긴장성 두통을 유발할 수 있습니다. 뒷머리부터 시작해서 관자놀이까지 퍼지는 두통이 특징입니다.

### 5. 손 힘 빠짐

물건을 자주 떨어뜨리거나, 손아귀 힘이 예전 같지 않다면 신경 압박으로 인한 증상일 수 있습니다.

## 자가진단 방법

1. **스펄링 테스트**: 고개를 아픈 쪽으로 기울이고 위에서 살짝 눌렀을 때 팔로 통증이 뻗어나가면 양성입니다.

2. **고개 젖히기 테스트**: 고개를 뒤로 젖혔을 때 팔로 저림이 생기면 의심해볼 수 있습니다.

> ⚠️ **주의**: 자가진단은 참고용일 뿐입니다. 정확한 진단을 위해서는 반드시 전문의 상담이 필요합니다.

## 초기 치료의 중요성

목디스크는 초기에 발견하면 비수술적 방법으로 충분히 치료할 수 있습니다.

- **추나요법**: 틀어진 척추를 바로잡아 신경 압박을 완화
- **침 치료**: 근육 긴장 완화 및 혈액순환 개선
- **약침 치료**: 염증 완화 및 조직 재생 촉진
- **물리치료**: 근력 강화 및 자세 교정

## 예방을 위한 생활 습관

1. 스마트폰 볼 때 눈높이로 들어서 보기
2. 컴퓨터 모니터 높이 조절
3. 30분마다 목 스트레칭
4. 베개 높이 적절하게 유지
5. 평소 바른 자세 유지

---

목 통증이 2주 이상 지속된다면 전문의 상담을 받아보시길 권장드립니다.
  `,
  contentFormat: 'markdown',
  category: 'health_info',
  status: 'published',
  tags: ['목디스크', '경추', '자가진단', '초기증상', '비수술치료'],
  authorName: '김원장',
  authorProfile: '연이재한의원 대표원장. 경희대학교 한의과대학 졸업. 척추질환 전문.',
  thumbnailUrl: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=800',
  metaTitle: '목디스크 초기 증상 5가지 - 자가진단 방법 | 연이재한의원',
  metaDescription: '목디스크 초기 증상 5가지와 자가진단 방법을 알아보세요. 초기 발견 시 비수술 치료로 호전 가능합니다.',
  viewCount: 15420,
  likeCount: 342,
  commentCount: 28,
  readingTime: 5,
  createdAt: '2024-01-19T09:00:00Z',
  publishedAt: '2024-01-20T09:00:00Z',
  relatedPosts: [
    {
      id: '2',
      title: '허리디스크에 좋은 스트레칭 7가지',
      slug: 'lumbar-disc-stretching',
      excerpt: '집에서 쉽게 따라할 수 있는 허리디스크 예방 및 완화 스트레칭',
      category: 'lifestyle',
      status: 'published',
      tags: ['허리디스크', '스트레칭'],
      thumbnailUrl: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400',
      authorName: '이원장',
      viewCount: 28930,
      likeCount: 512,
      commentCount: 45,
      readingTime: 7,
      createdAt: '2024-01-17T10:00:00Z',
      publishedAt: '2024-01-18T10:00:00Z',
      updatedAt: '2024-01-18T10:00:00Z',
    },
    {
      id: '3',
      title: '추나요법이란? 효과, 비용, 치료 과정 총정리',
      slug: 'chuna-therapy-guide',
      excerpt: '추나요법의 원리부터 치료 과정, 보험 적용 여부까지',
      category: 'treatment_guide',
      status: 'published',
      tags: ['추나요법', '한방치료'],
      thumbnailUrl: 'https://images.unsplash.com/photo-1519824145371-296894a0daa9?w=400',
      authorName: '김원장',
      viewCount: 12850,
      likeCount: 198,
      commentCount: 15,
      readingTime: 8,
      createdAt: '2024-01-14T11:00:00Z',
      publishedAt: '2024-01-15T11:00:00Z',
      updatedAt: '2024-01-15T11:00:00Z',
    },
  ],
};

// 날짜 포맷
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// 조회수 포맷
function formatViews(count: number): string {
  if (count >= 10000) return `${(count / 10000).toFixed(1)}만`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}천`;
  return count.toLocaleString();
}

// 마크다운 -> HTML 변환 (간단 버전)
function markdownToHtml(markdown: string): string {
  return markdown
    // 헤딩
    .replace(/^### (.*$)/gm, '<h3 class="text-xl font-bold mt-8 mb-4">$1</h3>')
    .replace(/^## (.*$)/gm, '<h2 class="text-2xl font-bold mt-10 mb-4 text-gray-800">$1</h2>')
    .replace(/^# (.*$)/gm, '<h1 class="text-3xl font-bold mt-12 mb-6">$1</h1>')
    // 볼드
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    // 이탤릭
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    // 블록쿼트
    .replace(/^> (.*$)/gm, '<blockquote class="border-l-4 border-green-500 pl-4 py-2 my-4 bg-green-50 text-gray-700">$1</blockquote>')
    // 리스트
    .replace(/^- (.*$)/gm, '<li class="ml-4">$1</li>')
    .replace(/^(\d+)\. (.*$)/gm, '<li class="ml-4">$2</li>')
    // 구분선
    .replace(/^---$/gm, '<hr class="my-8 border-gray-200">')
    // 단락
    .replace(/\n\n/g, '</p><p class="mb-4 text-gray-700 leading-relaxed">')
    // 줄바꿈
    .replace(/\n/g, '<br>');
}

const BlogPostPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 포스트 로드
  useEffect(() => {
    // 실제로는 API 호출
    setPost(mockPost);
    setIsLoading(false);
  }, [slug]);

  // 페이지 추적
  const { trackConversion } = usePageTracking({
    postId: post?.id || '',
    contentSelector: '.blog-content',
    onPageView: (event) => {
      console.log('Page View:', event);
      // API 호출로 저장
    },
    onPageExit: (event) => {
      console.log('Page Exit:', event);
      // API 호출로 저장
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <i className="fa-solid fa-file-circle-question text-6xl text-gray-300 mb-4"></i>
          <p className="text-gray-500">글을 찾을 수 없습니다.</p>
          <Link to="/blog" className="text-green-600 hover:underline mt-4 inline-block">
            목록으로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  // SEO 메타데이터
  const seoMetadata = generatePostSEO(post, window.location.origin);

  return (
    <div className="min-h-screen bg-white">
      <SEOHead metadata={seoMetadata} />

      {/* 헤더 */}
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link to="/blog" className="flex items-center gap-3">
              <span className="text-2xl">🏥</span>
              <div>
                <h1 className="text-lg font-bold text-gray-800">연이재한의원</h1>
                <p className="text-xs text-gray-500">건강정보 블로그</p>
              </div>
            </Link>

            <nav className="flex items-center gap-3">
              <Link
                to="/blog"
                className="text-gray-600 hover:text-green-600 transition-colors flex items-center gap-1"
              >
                <i className="fa-solid fa-arrow-left"></i>
                목록
              </Link>
              <button
                onClick={() => trackConversion('reservation')}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                예약 상담
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* 썸네일 */}
      {post.thumbnailUrl && (
        <div className="w-full h-64 md:h-96 bg-gray-100">
          <img
            src={post.thumbnailUrl}
            alt={post.title}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* 본문 */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* 카테고리 */}
        <span
          className={`inline-block px-3 py-1 rounded-full text-sm font-medium mb-4 ${BLOG_CATEGORY_COLORS[post.category]}`}
        >
          {BLOG_CATEGORY_LABELS[post.category]}
        </span>

        {/* 제목 */}
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
          {post.title}
        </h1>

        {/* 메타 정보 */}
        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 mb-8 pb-8 border-b">
          <span className="flex items-center gap-1">
            <i className="fa-solid fa-user"></i>
            {post.authorName}
          </span>
          <span className="flex items-center gap-1">
            <i className="fa-solid fa-calendar"></i>
            {formatDate(post.publishedAt || post.createdAt)}
          </span>
          <span className="flex items-center gap-1">
            <i className="fa-solid fa-eye"></i>
            {formatViews(post.viewCount)}
          </span>
          <span className="flex items-center gap-1">
            <i className="fa-solid fa-clock"></i>
            {post.readingTime}분 읽기
          </span>
        </div>

        {/* 본문 내용 */}
        <article
          className="blog-content prose prose-lg max-w-none"
          dangerouslySetInnerHTML={{
            __html: `<p class="mb-4 text-gray-700 leading-relaxed">${markdownToHtml(post.content)}</p>`,
          }}
        />

        {/* 태그 */}
        <div className="flex flex-wrap gap-2 mt-8 pt-8 border-t">
          {post.tags.map((tag) => (
            <Link
              key={tag}
              to={`/blog?q=${encodeURIComponent(tag)}`}
              className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm hover:bg-gray-200"
            >
              #{tag}
            </Link>
          ))}
        </div>

        {/* 작성자 정보 */}
        {post.authorProfile && (
          <div className="bg-gray-50 rounded-xl p-6 mt-8">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center text-2xl">
                👨‍⚕️
              </div>
              <div>
                <h4 className="font-bold text-gray-800">{post.authorName}</h4>
                <p className="text-sm text-gray-600 mt-1">{post.authorProfile}</p>
              </div>
            </div>
          </div>
        )}

        {/* CTA */}
        <div className="bg-green-50 rounded-xl p-8 mt-8 text-center">
          <h3 className="text-xl font-bold text-gray-800 mb-2">
            통증으로 고민 중이신가요?
          </h3>
          <p className="text-gray-600 mb-4">
            연이재한의원에서 정확한 진단과 맞춤 치료를 받아보세요.
          </p>
          <button
            onClick={() => trackConversion('inquiry')}
            className="px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
          >
            무료 상담 신청하기
          </button>
        </div>

        {/* 관련 글 */}
        {post.relatedPosts && post.relatedPosts.length > 0 && (
          <section className="mt-12">
            <h3 className="text-xl font-bold text-gray-800 mb-6">관련 글</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {post.relatedPosts.map((related) => (
                <Link
                  key={related.id}
                  to={`/blog/${related.slug}`}
                  className="flex gap-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  {related.thumbnailUrl && (
                    <img
                      src={related.thumbnailUrl}
                      alt={related.title}
                      className="w-24 h-24 object-cover rounded"
                    />
                  )}
                  <div className="flex-1">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-xs ${BLOG_CATEGORY_COLORS[related.category]}`}
                    >
                      {BLOG_CATEGORY_LABELS[related.category]}
                    </span>
                    <h4 className="font-medium text-gray-800 mt-1 line-clamp-2">
                      {related.title}
                    </h4>
                    <p className="text-xs text-gray-500 mt-1">
                      {related.readingTime}분 읽기
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* 구독 CTA (하단 고정) */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg py-4 px-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <p className="font-medium text-gray-800">새 글 알림 받기</p>
            <p className="text-sm text-gray-500">카카오톡으로 건강정보를 받아보세요</p>
          </div>
          <button
            onClick={() => trackConversion('subscription')}
            className="px-4 py-2 bg-yellow-400 text-gray-900 rounded-lg font-medium hover:bg-yellow-500 transition-colors flex items-center gap-2"
          >
            <i className="fa-solid fa-bell"></i>
            구독하기
          </button>
        </div>
      </div>

      {/* 하단 여백 (고정 CTA 때문에) */}
      <div className="h-24"></div>

      {/* 푸터 */}
      <footer className="bg-gray-800 text-gray-300 py-8">
        <div className="max-w-4xl mx-auto px-4 text-center text-sm">
          <p>&copy; 2024 연이재한의원. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default BlogPostPage;
