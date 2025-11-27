import { useState } from 'react';
import type { BlogPost, BlogCategory, ContentStatus } from '../types';
import {
  BLOG_CATEGORY_LABELS,
  CONTENT_STATUS_LABELS,
  CONTENT_STATUS_COLORS,
} from '../types';

// Mock 데이터
const mockBlogs: BlogPost[] = [
  {
    id: '1',
    type: 'blog',
    status: 'published',
    title: '환절기 면역력 높이는 한방 건강법',
    slug: 'seasonal-immunity-tips',
    content: '<p>환절기에는 면역력 관리가 중요합니다...</p>',
    excerpt: '환절기에 면역력을 높이는 한방 건강 관리법을 알아봅니다.',
    thumbnail: '/images/blog/immunity.jpg',
    category: 'health_info',
    author: '김원장',
    tags: ['면역력', '환절기', '한방'],
    readingTime: 5,
    views: 1250,
    clicks: 89,
    conversions: 12,
    trackingEnabled: true,
    shortUrl: '/b/imm01',
    createdBy: '김원장',
    createdAt: '2024-01-10T09:00:00',
    updatedAt: '2024-01-10T09:00:00',
    publishedAt: '2024-01-10T10:00:00',
  },
  {
    id: '2',
    type: 'blog',
    status: 'published',
    title: '다이어트 한약, 어떻게 작용하나요?',
    slug: 'diet-herbal-medicine',
    content: '<p>다이어트 한약의 원리와 효과에 대해 설명합니다...</p>',
    excerpt: '다이어트 한약의 작용 원리와 효과적인 복용법을 안내합니다.',
    category: 'treatment_guide',
    author: '이원장',
    tags: ['다이어트', '한약', '체중감량'],
    readingTime: 7,
    views: 2340,
    clicks: 156,
    conversions: 28,
    trackingEnabled: true,
    shortUrl: '/b/diet01',
    createdBy: '이원장',
    createdAt: '2024-01-08T14:00:00',
    updatedAt: '2024-01-08T14:00:00',
    publishedAt: '2024-01-08T15:00:00',
  },
  {
    id: '3',
    type: 'blog',
    status: 'draft',
    title: '산후조리 한방 프로그램 안내',
    slug: 'postpartum-care',
    content: '<p>산후조리 한방 프로그램을 소개합니다...</p>',
    category: 'treatment_guide',
    author: '박원장',
    tags: ['산후조리', '여성건강'],
    views: 0,
    clicks: 0,
    conversions: 0,
    trackingEnabled: true,
    createdBy: '박원장',
    createdAt: '2024-01-15T11:00:00',
    updatedAt: '2024-01-15T11:00:00',
  },
  {
    id: '4',
    type: 'blog',
    status: 'review',
    title: '허리 통증, 한방으로 치료하기',
    slug: 'back-pain-treatment',
    content: '<p>허리 통증의 한방 치료법을 소개합니다...</p>',
    category: 'case_study',
    author: '김원장',
    tags: ['허리통증', '침치료', '한방치료'],
    readingTime: 6,
    views: 0,
    clicks: 0,
    conversions: 0,
    trackingEnabled: true,
    createdBy: '김원장',
    createdAt: '2024-01-14T10:00:00',
    updatedAt: '2024-01-14T10:00:00',
  },
];

function BlogManagement() {
  const [blogs] = useState<BlogPost[]>(mockBlogs);
  const [filterStatus, setFilterStatus] = useState<ContentStatus | ''>('');
  const [filterCategory, setFilterCategory] = useState<BlogCategory | ''>('');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredBlogs = blogs.filter((blog) => {
    if (filterStatus && blog.status !== filterStatus) return false;
    if (filterCategory && blog.category !== filterCategory) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      if (
        !blog.title.toLowerCase().includes(term) &&
        !blog.author.toLowerCase().includes(term) &&
        !blog.tags?.some((t) => t.toLowerCase().includes(term))
      ) {
        return false;
      }
    }
    return true;
  });

  const stats = {
    total: blogs.length,
    published: blogs.filter((b) => b.status === 'published').length,
    draft: blogs.filter((b) => b.status === 'draft').length,
    totalViews: blogs.reduce((sum, b) => sum + b.views, 0),
  };

  function formatDate(dateStr: string) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  return (
    <div className="p-6">
      {/* 헤더 */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">블로그 관리</h2>
          <p className="text-gray-600 mt-1">
            건강정보, 치료안내, 한의원 소식 등 블로그 컨텐츠를 관리합니다.
          </p>
        </div>
        <button className="px-4 py-2 bg-rose-500 text-white rounded-lg hover:bg-rose-600 transition-colors">
          <i className="fa-solid fa-plus mr-2"></i>
          새 글 작성
        </button>
      </div>

      {/* 통계 */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg border p-4">
          <p className="text-sm text-gray-500">전체 글</p>
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <p className="text-sm text-gray-500">발행됨</p>
          <p className="text-2xl font-bold text-green-600">{stats.published}</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <p className="text-sm text-gray-500">초안</p>
          <p className="text-2xl font-bold text-gray-600">{stats.draft}</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <p className="text-sm text-gray-500">총 조회수</p>
          <p className="text-2xl font-bold text-rose-600">{stats.totalViews.toLocaleString()}</p>
        </div>
      </div>

      {/* 필터 */}
      <div className="bg-white rounded-lg border p-4 mb-4">
        <div className="grid grid-cols-4 gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">상태</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as ContentStatus)}
              className="w-full border rounded px-3 py-2 text-sm"
            >
              <option value="">전체</option>
              {Object.entries(CONTENT_STATUS_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">카테고리</label>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value as BlogCategory)}
              className="w-full border rounded px-3 py-2 text-sm"
            >
              <option value="">전체</option>
              {Object.entries(BLOG_CATEGORY_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-gray-500 mb-1">검색</label>
            <input
              type="text"
              placeholder="제목, 작성자, 태그로 검색"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>
        </div>
      </div>

      {/* 블로그 목록 */}
      <div className="bg-white rounded-lg border">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">제목</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">카테고리</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">작성자</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">상태</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">조회수</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">작성일</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredBlogs.map((blog) => (
              <tr key={blog.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900">{blog.title}</div>
                  {blog.tags && blog.tags.length > 0 && (
                    <div className="flex gap-1 mt-1">
                      {blog.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="px-1.5 py-0.5 text-xs bg-gray-100 text-gray-600 rounded"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-sm">
                  {BLOG_CATEGORY_LABELS[blog.category]}
                </td>
                <td className="px-4 py-3 text-sm">{blog.author}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block px-2 py-1 text-xs rounded ${CONTENT_STATUS_COLORS[blog.status]}`}
                  >
                    {CONTENT_STATUS_LABELS[blog.status]}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm">
                  {blog.views > 0 ? (
                    <span className="text-rose-600 font-medium">{blog.views.toLocaleString()}</span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {formatDate(blog.createdAt)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button className="px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded">
                      수정
                    </button>
                    {blog.status === 'published' && (
                      <button className="px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded">
                        보기
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredBlogs.length === 0 && (
          <div className="p-8 text-center text-gray-500">블로그 글이 없습니다.</div>
        )}
      </div>
    </div>
  );
}

export default BlogManagement;
