/**
 * 블로그 목록 페이지 (공개)
 * - SEO 최적화
 * - 카테고리 필터
 * - 검색 기능
 * - 구독 CTA
 */

import React, { useState, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { SEOHead, generateListSEO } from '../components/SEOHead';
import type { BlogPostSummary, BlogCategory } from '../types';
import {
  BLOG_CATEGORY_LABELS,
  BLOG_CATEGORY_COLORS,
  BLOG_CATEGORY_ICONS,
} from '../types';

// 목업 데이터
const mockPosts: BlogPostSummary[] = [
  {
    id: '1',
    title: '목디스크 초기 증상 5가지, 놓치면 안 되는 신호들',
    slug: 'neck-disc-early-symptoms',
    excerpt: '목디스크는 초기에 발견하면 비수술 치료로 충분히 호전될 수 있습니다. 이 글에서는 목디스크의 초기 증상 5가지와 자가진단 방법을 알려드립니다.',
    category: 'health_info',
    status: 'published',
    tags: ['목디스크', '경추', '자가진단', '초기증상'],
    thumbnailUrl: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=400',
    authorName: '김원장',
    viewCount: 15420,
    likeCount: 342,
    commentCount: 28,
    readingTime: 5,
    createdAt: '2024-01-19T09:00:00Z',
    publishedAt: '2024-01-20T09:00:00Z',
    updatedAt: '2024-01-20T09:00:00Z',
  },
  {
    id: '2',
    title: '허리디스크에 좋은 스트레칭 7가지',
    slug: 'lumbar-disc-stretching',
    excerpt: '집에서 쉽게 따라할 수 있는 허리디스크 예방 및 완화 스트레칭을 소개합니다. 하루 10분 투자로 허리 건강을 지키세요.',
    category: 'lifestyle',
    status: 'published',
    tags: ['허리디스크', '스트레칭', '홈트레이닝', '허리건강'],
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
    excerpt: '추나요법의 원리부터 치료 과정, 보험 적용 여부까지 추나요법에 대한 모든 것을 알려드립니다.',
    category: 'treatment_guide',
    status: 'published',
    tags: ['추나요법', '한방치료', '보험적용', '치료안내'],
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
  {
    id: '4',
    title: '40대 직장인 허리디스크 치료 후기 - 3개월의 기록',
    slug: 'lumbar-disc-treatment-review',
    excerpt: '사무직 특성상 오래 앉아있어 허리디스크가 심해졌던 40대 환자분의 3개월 치료 후기입니다.',
    category: 'case_study',
    status: 'published',
    tags: ['치료후기', '허리디스크', '직장인', '비수술치료'],
    thumbnailUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400',
    authorName: '연이재한의원',
    viewCount: 8920,
    likeCount: 156,
    commentCount: 22,
    readingTime: 6,
    createdAt: '2024-01-11T14:00:00Z',
    publishedAt: '2024-01-12T14:00:00Z',
    updatedAt: '2024-01-12T14:00:00Z',
  },
  {
    id: '5',
    title: '침 치료 자주 묻는 질문 TOP 10',
    slug: 'acupuncture-faq',
    excerpt: '침 맞으면 아픈가요? 얼마나 자주 맞아야 하나요? 침 치료에 대한 궁금증을 모두 해결해드립니다.',
    category: 'faq',
    status: 'published',
    tags: ['침치료', 'FAQ', '한방치료', '질문답변'],
    thumbnailUrl: 'https://images.unsplash.com/photo-1512290923902-8a9f81dc236c?w=400',
    authorName: '이원장',
    viewCount: 21340,
    likeCount: 287,
    commentCount: 56,
    readingTime: 4,
    createdAt: '2024-01-09T09:00:00Z',
    publishedAt: '2024-01-10T09:00:00Z',
    updatedAt: '2024-01-10T09:00:00Z',
  },
  {
    id: '6',
    title: '연이재한의원 2024년 새해 진료 안내',
    slug: 'new-year-2024-notice',
    excerpt: '2024년 새해 복 많이 받으세요! 설 연휴 진료 일정과 새해 이벤트를 안내드립니다.',
    category: 'clinic_news',
    status: 'published',
    tags: ['공지사항', '진료안내', '설연휴', '이벤트'],
    thumbnailUrl: 'https://images.unsplash.com/photo-1467810563316-b5476525c0f9?w=400',
    authorName: '연이재한의원',
    viewCount: 3240,
    likeCount: 45,
    commentCount: 8,
    readingTime: 2,
    createdAt: '2024-01-04T10:00:00Z',
    publishedAt: '2024-01-05T10:00:00Z',
    updatedAt: '2024-01-05T10:00:00Z',
  },
];

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

const BlogListPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryParam = searchParams.get('category') as BlogCategory | null;
  const searchQuery = searchParams.get('q') || '';

  const [localSearch, setLocalSearch] = useState(searchQuery);

  // 카테고리 필터링
  const filteredPosts = useMemo(() => {
    let posts = mockPosts;

    if (categoryParam) {
      posts = posts.filter((p) => p.category === categoryParam);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      posts = posts.filter(
        (p) =>
          p.title.toLowerCase().includes(query) ||
          p.excerpt.toLowerCase().includes(query) ||
          p.tags.some((t) => t.toLowerCase().includes(query))
      );
    }

    return posts;
  }, [categoryParam, searchQuery]);

  // SEO 메타데이터
  const seoMetadata = generateListSEO(
    categoryParam || undefined,
    undefined,
    window.location.origin
  );

  // 검색 실행
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (localSearch.trim()) {
      searchParams.set('q', localSearch.trim());
    } else {
      searchParams.delete('q');
    }
    setSearchParams(searchParams);
  };

  // 카테고리 선택
  const handleCategoryClick = (category: BlogCategory | null) => {
    if (category) {
      searchParams.set('category', category);
    } else {
      searchParams.delete('category');
    }
    searchParams.delete('q');
    setLocalSearch('');
    setSearchParams(searchParams);
  };

  const categories = Object.keys(BLOG_CATEGORY_LABELS) as BlogCategory[];

  return (
    <div className="min-h-screen bg-gray-50">
      <SEOHead metadata={seoMetadata} />

      {/* 헤더 */}
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link to="/blog" className="flex items-center gap-3">
              <span className="text-3xl">🏥</span>
              <div>
                <h1 className="text-xl font-bold text-gray-800">연이재한의원</h1>
                <p className="text-xs text-gray-500">건강정보 블로그</p>
              </div>
            </Link>

            <nav className="flex items-center gap-4">
              <Link
                to="/"
                className="text-gray-600 hover:text-green-600 transition-colors"
              >
                홈페이지
              </Link>
              <a
                href="tel:02-XXX-XXXX"
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                예약 상담
              </a>
            </nav>
          </div>
        </div>
      </header>

      {/* 히어로 섹션 */}
      <section className="bg-gradient-to-br from-green-600 to-green-700 text-white py-16">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            건강한 삶을 위한 정보
          </h2>
          <p className="text-green-100 mb-8 max-w-2xl mx-auto">
            연이재한의원의 전문의가 알려드리는 건강 정보와 치료 꿀팁을 만나보세요.
          </p>

          {/* 검색 */}
          <form onSubmit={handleSearch} className="max-w-xl mx-auto">
            <div className="relative">
              <input
                type="text"
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                placeholder="궁금한 건강정보를 검색하세요..."
                className="w-full px-5 py-4 pl-12 rounded-xl text-gray-800 focus:outline-none focus:ring-4 focus:ring-green-300"
              />
              <i className="fa-solid fa-search absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"></i>
              <button
                type="submit"
                className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                검색
              </button>
            </div>
          </form>
        </div>
      </section>

      {/* 카테고리 탭 */}
      <section className="bg-white border-b sticky top-[72px] z-40">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-center gap-2 overflow-x-auto py-4 scrollbar-hide">
            <button
              onClick={() => handleCategoryClick(null)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                !categoryParam
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              전체
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => handleCategoryClick(cat)}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-2 ${
                  categoryParam === cat
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <i className={BLOG_CATEGORY_ICONS[cat]}></i>
                {BLOG_CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* 포스트 목록 */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {searchQuery && (
          <p className="text-gray-600 mb-6">
            "<span className="font-medium">{searchQuery}</span>" 검색 결과{' '}
            <span className="text-green-600 font-medium">{filteredPosts.length}</span>건
          </p>
        )}

        {filteredPosts.length === 0 ? (
          <div className="text-center py-16">
            <i className="fa-solid fa-search text-4xl text-gray-300 mb-4"></i>
            <p className="text-gray-500">검색 결과가 없습니다.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPosts.map((post) => (
              <Link
                key={post.id}
                to={`/blog/${post.slug}`}
                className="bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-lg transition-shadow group"
              >
                {/* 썸네일 */}
                <div className="aspect-video bg-gray-100 overflow-hidden">
                  {post.thumbnailUrl ? (
                    <img
                      src={post.thumbnailUrl}
                      alt={post.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300">
                      <i className="fa-solid fa-image text-4xl"></i>
                    </div>
                  )}
                </div>

                {/* 내용 */}
                <div className="p-5">
                  {/* 카테고리 */}
                  <span
                    className={`inline-block px-2 py-1 rounded text-xs font-medium mb-3 ${BLOG_CATEGORY_COLORS[post.category]}`}
                  >
                    {BLOG_CATEGORY_LABELS[post.category]}
                  </span>

                  {/* 제목 */}
                  <h3 className="font-bold text-gray-800 mb-2 line-clamp-2 group-hover:text-green-600 transition-colors">
                    {post.title}
                  </h3>

                  {/* 요약 */}
                  <p className="text-sm text-gray-500 line-clamp-2 mb-4">{post.excerpt}</p>

                  {/* 메타 정보 */}
                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <span>{formatDate(post.publishedAt || post.createdAt)}</span>
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <i className="fa-solid fa-eye"></i>
                        {formatViews(post.viewCount)}
                      </span>
                      <span className="flex items-center gap-1">
                        <i className="fa-solid fa-clock"></i>
                        {post.readingTime ?? 5}분
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>

      {/* 구독 CTA */}
      <section className="bg-green-50 py-16">
        <div className="max-w-2xl mx-auto px-4 text-center">
          <h3 className="text-2xl font-bold text-gray-800 mb-4">
            새 글 알림 받기
          </h3>
          <p className="text-gray-600 mb-6">
            카카오톡으로 새로운 건강정보를 가장 먼저 받아보세요!
          </p>
          <Link
            to="/blog/subscribe"
            className="inline-flex items-center gap-2 px-6 py-3 bg-yellow-400 text-gray-900 rounded-lg font-medium hover:bg-yellow-500 transition-colors"
          >
            <i className="fa-solid fa-bell"></i>
            구독하기
          </Link>
        </div>
      </section>

      {/* 푸터 */}
      <footer className="bg-gray-800 text-gray-300 py-12">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <h4 className="font-bold text-white mb-4">연이재한의원</h4>
              <p className="text-sm">
                건강한 삶을 위한 한의학 정보를 제공합니다.
              </p>
            </div>
            <div>
              <h4 className="font-bold text-white mb-4">진료 안내</h4>
              <p className="text-sm">평일: 09:00 - 18:00</p>
              <p className="text-sm">토요일: 09:00 - 13:00</p>
              <p className="text-sm">일요일/공휴일 휴진</p>
            </div>
            <div>
              <h4 className="font-bold text-white mb-4">연락처</h4>
              <p className="text-sm">전화: 02-XXX-XXXX</p>
              <p className="text-sm">주소: 서울시 OO구 OO동</p>
            </div>
          </div>
          <div className="border-t border-gray-700 mt-8 pt-8 text-center text-sm">
            <p>&copy; 2024 연이재한의원. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default BlogListPage;
