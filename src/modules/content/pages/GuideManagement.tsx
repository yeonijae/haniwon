import { useState } from 'react';
import type { GuidePage, GuideCategory, ContentStatus } from '../types';
import {
  GUIDE_CATEGORY_LABELS,
  CONTENT_STATUS_LABELS,
  CONTENT_STATUS_COLORS,
} from '../types';

// Mock 데이터
const mockGuides: GuidePage[] = [
  {
    id: '1',
    type: 'guide',
    status: 'published',
    title: '첫 방문 안내',
    slug: 'first-visit',
    content: '<p>연이재한의원 첫 방문을 환영합니다...</p>',
    excerpt: '첫 방문 시 알아두셔야 할 사항을 안내합니다.',
    category: 'visit',
    version: 3,
    targetAudience: 'new_patient',
    views: 5420,
    clicks: 234,
    conversions: 89,
    trackingEnabled: true,
    shortUrl: '/g/visit',
    createdBy: '관리자',
    createdAt: '2023-12-01T09:00:00',
    updatedAt: '2024-01-10T09:00:00',
    publishedAt: '2024-01-10T10:00:00',
  },
  {
    id: '2',
    type: 'guide',
    status: 'published',
    title: '주차 안내',
    slug: 'parking',
    content: '<p>주차 관련 안내입니다...</p>',
    excerpt: '주차장 위치 및 이용 방법을 안내합니다.',
    category: 'parking',
    version: 2,
    targetAudience: 'all',
    views: 3210,
    clicks: 156,
    conversions: 0,
    trackingEnabled: true,
    shortUrl: '/g/parking',
    createdBy: '관리자',
    createdAt: '2023-11-15T14:00:00',
    updatedAt: '2024-01-05T14:00:00',
    publishedAt: '2024-01-05T15:00:00',
  },
  {
    id: '3',
    type: 'guide',
    status: 'published',
    title: '한약 복용 안내',
    slug: 'medication-guide',
    content: '<p>한약 복용 시 주의사항...</p>',
    excerpt: '한약 복용법과 보관 방법을 안내합니다.',
    category: 'medication',
    version: 5,
    targetAudience: 'all',
    views: 8920,
    clicks: 423,
    conversions: 0,
    trackingEnabled: true,
    shortUrl: '/g/med',
    createdBy: '김원장',
    createdAt: '2023-10-01T09:00:00',
    updatedAt: '2024-01-12T11:00:00',
    publishedAt: '2024-01-12T11:30:00',
  },
  {
    id: '4',
    type: 'guide',
    status: 'published',
    title: '침 치료 후 주의사항',
    slug: 'aftercare-acupuncture',
    content: '<p>침 치료 후 주의사항입니다...</p>',
    category: 'aftercare',
    version: 2,
    targetAudience: 'all',
    views: 2150,
    clicks: 98,
    conversions: 0,
    trackingEnabled: true,
    shortUrl: '/g/after-acu',
    createdBy: '이원장',
    createdAt: '2023-12-10T10:00:00',
    updatedAt: '2024-01-08T10:00:00',
    publishedAt: '2024-01-08T10:30:00',
  },
  {
    id: '5',
    type: 'guide',
    status: 'draft',
    title: '보험 청구 안내 (작성중)',
    slug: 'insurance-claim',
    content: '<p>보험 청구 방법...</p>',
    category: 'insurance',
    version: 1,
    views: 0,
    clicks: 0,
    conversions: 0,
    trackingEnabled: true,
    createdBy: '관리자',
    createdAt: '2024-01-15T14:00:00',
    updatedAt: '2024-01-15T14:00:00',
  },
];

function GuideManagement() {
  const [guides] = useState<GuidePage[]>(mockGuides);
  const [filterStatus, setFilterStatus] = useState<ContentStatus | ''>('');
  const [filterCategory, setFilterCategory] = useState<GuideCategory | ''>('');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredGuides = guides.filter((guide) => {
    if (filterStatus && guide.status !== filterStatus) return false;
    if (filterCategory && guide.category !== filterCategory) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      if (!guide.title.toLowerCase().includes(term)) return false;
    }
    return true;
  });

  const stats = {
    total: guides.length,
    published: guides.filter((g) => g.status === 'published').length,
    totalViews: guides.reduce((sum, g) => sum + g.views, 0),
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
          <h2 className="text-2xl font-bold text-gray-900">안내페이지 관리</h2>
          <p className="text-gray-600 mt-1">
            방문안내, 복약안내, 주차안내 등 환자용 안내 페이지를 관리합니다.
          </p>
        </div>
        <button className="px-4 py-2 bg-rose-500 text-white rounded-lg hover:bg-rose-600 transition-colors">
          <i className="fa-solid fa-plus mr-2"></i>
          새 안내페이지
        </button>
      </div>

      {/* 통계 */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg border p-4">
          <p className="text-sm text-gray-500">전체 페이지</p>
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <p className="text-sm text-gray-500">활성 페이지</p>
          <p className="text-2xl font-bold text-green-600">{stats.published}</p>
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
              onChange={(e) => setFilterCategory(e.target.value as GuideCategory)}
              className="w-full border rounded px-3 py-2 text-sm"
            >
              <option value="">전체</option>
              {Object.entries(GUIDE_CATEGORY_LABELS).map(([key, label]) => (
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
              placeholder="제목으로 검색"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>
        </div>
      </div>

      {/* 안내페이지 목록 */}
      <div className="bg-white rounded-lg border">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">제목</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">카테고리</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">버전</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">상태</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">조회수</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">단축URL</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">수정일</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredGuides.map((guide) => (
              <tr key={guide.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900">{guide.title}</div>
                  {guide.excerpt && (
                    <div className="text-xs text-gray-500 mt-0.5 truncate max-w-xs">
                      {guide.excerpt}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-sm">
                  {GUIDE_CATEGORY_LABELS[guide.category]}
                </td>
                <td className="px-4 py-3 text-sm">
                  <span className="text-gray-600">v{guide.version}</span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block px-2 py-1 text-xs rounded ${CONTENT_STATUS_COLORS[guide.status]}`}
                  >
                    {CONTENT_STATUS_LABELS[guide.status]}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm">
                  {guide.views > 0 ? (
                    <span className="text-rose-600 font-medium">{guide.views.toLocaleString()}</span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm">
                  {guide.shortUrl ? (
                    <code className="px-1.5 py-0.5 bg-gray-100 text-gray-700 text-xs rounded">
                      {guide.shortUrl}
                    </code>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {formatDate(guide.updatedAt)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button className="px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded">
                      수정
                    </button>
                    {guide.status === 'published' && (
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
        {filteredGuides.length === 0 && (
          <div className="p-8 text-center text-gray-500">안내페이지가 없습니다.</div>
        )}
      </div>
    </div>
  );
}

export default GuideManagement;
