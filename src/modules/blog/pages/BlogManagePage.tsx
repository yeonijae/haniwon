/**
 * 블로그 관리 페이지 (관리자용)
 * - 포스트 목록
 * - 포스트 작성/수정
 * - 발행 관리
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  getAllPosts,
  publishPost,
  unpublishPost,
  deletePost,
  getDashboardStats,
} from '@/lib/supabase';
import {
  BlogCategory,
  BlogPostStatus,
  BlogPostSummary,
  BLOG_CATEGORY_LABELS,
  BLOG_CATEGORY_COLORS,
} from '../types';

interface DashboardStats {
  totalPosts: number;
  publishedPosts: number;
  draftPosts: number;
  totalViews: number;
  weeklyViews: number;
  totalSubscribers: number;
  activeSubscribers: number;
}

interface BlogManagePageProps {
  embedded?: boolean; // 컨텐츠 관리 내에서 사용될 때 true
}

export default function BlogManagePage({ embedded = false }: BlogManagePageProps) {
  // 경로 접두사 - embedded면 /content, 아니면 /blog/manage
  const basePath = embedded ? '/content/blog' : '/blog/manage';
  const [posts, setPosts] = useState<BlogPostSummary[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | BlogPostStatus>('all');
  const [categoryFilter, setCategoryFilter] = useState<BlogCategory | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [postsData, statsData] = await Promise.all([
        getAllPosts(),
        getDashboardStats(),
      ]);
      setPosts(postsData);
      setStats(statsData);
    } catch (error) {
      console.error('Failed to load data:', error);
      alert('데이터를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async (id: string) => {
    if (!confirm('이 글을 발행하시겠습니까?')) return;
    try {
      await publishPost(id);
      await loadData();
    } catch (error) {
      console.error('Publish failed:', error);
      alert('발행에 실패했습니다.');
    }
  };

  const handleUnpublish = async (id: string) => {
    if (!confirm('발행을 취소하시겠습니까?')) return;
    try {
      await unpublishPost(id);
      await loadData();
    } catch (error) {
      console.error('Unpublish failed:', error);
      alert('발행 취소에 실패했습니다.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까? 이 작업은 취소할 수 없습니다.')) return;
    try {
      await deletePost(id);
      await loadData();
    } catch (error) {
      console.error('Delete failed:', error);
      alert('삭제에 실패했습니다.');
    }
  };

  const filteredPosts = posts.filter((post) => {
    if (filter !== 'all' && post.status !== filter) return false;
    if (categoryFilter !== 'all' && post.category !== categoryFilter) return false;
    if (searchTerm && !post.title.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusBadge = (status: BlogPostStatus) => {
    switch (status) {
      case 'published':
        return <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">발행됨</span>;
      case 'draft':
        return <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">임시저장</span>;
      case 'archived':
        return <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">보관됨</span>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">블로그 관리</h1>
          <p className="text-gray-500">블로그 글 작성 및 관리</p>
        </div>
        <Link
          to={`${basePath}/new`}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
        >
          <i className="fa-solid fa-plus"></i>
          새 글 작성
        </Link>
      </div>

      {/* 통계 카드 */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <i className="fa-solid fa-file-lines text-blue-600"></i>
              </div>
              <div>
                <p className="text-sm text-gray-500">전체 글</p>
                <p className="text-xl font-bold text-gray-800">{stats.totalPosts}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <i className="fa-solid fa-check text-green-600"></i>
              </div>
              <div>
                <p className="text-sm text-gray-500">발행됨</p>
                <p className="text-xl font-bold text-gray-800">{stats.publishedPosts}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <i className="fa-solid fa-eye text-purple-600"></i>
              </div>
              <div>
                <p className="text-sm text-gray-500">총 조회수</p>
                <p className="text-xl font-bold text-gray-800">{stats.totalViews.toLocaleString()}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                <i className="fa-solid fa-bell text-yellow-600"></i>
              </div>
              <div>
                <p className="text-sm text-gray-500">구독자</p>
                <p className="text-xl font-bold text-gray-800">{stats.totalSubscribers}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 필터 */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-center">
          {/* 검색 */}
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <i className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
              <input
                type="text"
                placeholder="제목으로 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>

          {/* 상태 필터 */}
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as 'all' | BlogPostStatus)}
            className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="all">모든 상태</option>
            <option value="published">발행됨</option>
            <option value="draft">임시저장</option>
            <option value="archived">보관됨</option>
          </select>

          {/* 카테고리 필터 */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as BlogCategory | 'all')}
            className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="all">모든 카테고리</option>
            {Object.entries(BLOG_CATEGORY_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 포스트 목록 */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {filteredPosts.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <i className="fa-solid fa-inbox text-4xl mb-4"></i>
            <p>글이 없습니다.</p>
            <Link
              to={`${basePath}/new`}
              className="inline-block mt-4 text-green-600 hover:text-green-700"
            >
              첫 글을 작성해보세요
            </Link>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">제목</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 hidden md:table-cell">카테고리</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">상태</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-gray-600 hidden md:table-cell">조회</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-gray-600 hidden lg:table-cell">발행일</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredPosts.map((post) => (
                <tr key={post.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div>
                      <Link
                        to={`${basePath}/edit/${post.id}`}
                        className="font-medium text-gray-800 hover:text-green-600 line-clamp-1"
                      >
                        {post.title}
                      </Link>
                      <p className="text-sm text-gray-500 line-clamp-1 mt-1">{post.excerpt}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${BLOG_CATEGORY_COLORS[post.category]}`}>
                      {BLOG_CATEGORY_LABELS[post.category]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {getStatusBadge(post.status)}
                  </td>
                  <td className="px-4 py-3 text-center text-sm text-gray-600 hidden md:table-cell">
                    {post.viewCount.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-center text-sm text-gray-600 hidden lg:table-cell">
                    {formatDate(post.publishedAt)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <Link
                        to={`${basePath}/edit/${post.id}`}
                        className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="수정"
                      >
                        <i className="fa-solid fa-pen-to-square"></i>
                      </Link>
                      {post.status === 'draft' ? (
                        <button
                          onClick={() => handlePublish(post.id)}
                          className="p-2 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                          title="발행"
                        >
                          <i className="fa-solid fa-paper-plane"></i>
                        </button>
                      ) : post.status === 'published' ? (
                        <button
                          onClick={() => handleUnpublish(post.id)}
                          className="p-2 text-gray-500 hover:text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors"
                          title="발행 취소"
                        >
                          <i className="fa-solid fa-rotate-left"></i>
                        </button>
                      ) : null}
                      <button
                        onClick={() => handleDelete(post.id)}
                        className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="삭제"
                      >
                        <i className="fa-solid fa-trash"></i>
                      </button>
                      {post.status === 'published' && (
                        <a
                          href={`https://blog.yeonijae.com/post/${post.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                          title="블로그에서 보기"
                        >
                          <i className="fa-solid fa-external-link"></i>
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
