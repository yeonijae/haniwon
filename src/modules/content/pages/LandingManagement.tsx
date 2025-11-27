import { useState } from 'react';
import type { LandingPage, ContentStatus } from '../types';
import {
  CONTENT_STATUS_LABELS,
  CONTENT_STATUS_COLORS,
} from '../types';

// Mock 데이터
const mockLandings: LandingPage[] = [
  {
    id: '1',
    type: 'landing',
    status: 'published',
    title: '다이어트 한방 프로그램',
    slug: 'diet-program',
    content: '<p>건강한 다이어트를 위한 한방 프로그램...</p>',
    excerpt: '체질에 맞는 맞춤형 다이어트 프로그램',
    thumbnail: '/images/landing/diet.jpg',
    campaignName: '2024 신년 다이어트',
    targetKeywords: ['다이어트 한의원', '한방 다이어트', '체중감량'],
    ctaText: '무료 상담 신청',
    ctaLink: '/reservation?campaign=diet2024',
    ctaPhone: '02-1234-5678',
    views: 4520,
    clicks: 312,
    conversions: 45,
    trackingEnabled: true,
    shortUrl: '/l/diet',
    startDate: '2024-01-01',
    endDate: '2024-03-31',
    createdBy: '마케팅팀',
    createdAt: '2023-12-20T09:00:00',
    updatedAt: '2024-01-05T14:00:00',
    publishedAt: '2024-01-01T00:00:00',
  },
  {
    id: '2',
    type: 'landing',
    status: 'published',
    title: '산후조리 한방 케어',
    slug: 'postpartum-care',
    content: '<p>산모를 위한 전문 한방 케어 프로그램...</p>',
    campaignName: '산후조리 상시',
    targetKeywords: ['산후조리 한의원', '산후 한방', '산모 건강'],
    ctaText: '상담 예약하기',
    ctaLink: '/reservation?campaign=postpartum',
    views: 2890,
    clicks: 198,
    conversions: 28,
    trackingEnabled: true,
    shortUrl: '/l/postpartum',
    createdBy: '마케팅팀',
    createdAt: '2023-11-15T10:00:00',
    updatedAt: '2024-01-10T11:00:00',
    publishedAt: '2023-11-20T00:00:00',
  },
  {
    id: '3',
    type: 'landing',
    status: 'draft',
    title: '봄맞이 면역력 강화 캠페인',
    slug: 'spring-immunity',
    content: '<p>봄철 면역력 관리...</p>',
    campaignName: '2024 봄 캠페인',
    targetKeywords: ['면역력 강화', '봄철 건강'],
    ctaText: '지금 상담받기',
    views: 0,
    clicks: 0,
    conversions: 0,
    trackingEnabled: true,
    startDate: '2024-03-01',
    endDate: '2024-05-31',
    createdBy: '마케팅팀',
    createdAt: '2024-01-15T09:00:00',
    updatedAt: '2024-01-15T09:00:00',
  },
  {
    id: '4',
    type: 'landing',
    status: 'archived',
    title: '2023 연말 건강검진 이벤트',
    slug: 'yearend-checkup-2023',
    content: '<p>연말 건강검진 이벤트...</p>',
    campaignName: '2023 연말 이벤트',
    views: 1230,
    clicks: 89,
    conversions: 15,
    trackingEnabled: true,
    shortUrl: '/l/yearend23',
    startDate: '2023-11-01',
    endDate: '2023-12-31',
    createdBy: '마케팅팀',
    createdAt: '2023-10-20T09:00:00',
    updatedAt: '2024-01-02T09:00:00',
    publishedAt: '2023-11-01T00:00:00',
  },
];

function LandingManagement() {
  const [landings] = useState<LandingPage[]>(mockLandings);
  const [filterStatus, setFilterStatus] = useState<ContentStatus | ''>('');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredLandings = landings.filter((landing) => {
    if (filterStatus && landing.status !== filterStatus) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      if (
        !landing.title.toLowerCase().includes(term) &&
        !landing.campaignName?.toLowerCase().includes(term)
      ) {
        return false;
      }
    }
    return true;
  });

  const stats = {
    total: landings.length,
    active: landings.filter((l) => l.status === 'published').length,
    totalViews: landings.reduce((sum, l) => sum + l.views, 0),
    totalConversions: landings.reduce((sum, l) => sum + l.conversions, 0),
  };

  function formatDate(dateStr: string) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  function getConversionRate(landing: LandingPage) {
    if (landing.views === 0) return '-';
    return ((landing.conversions / landing.views) * 100).toFixed(1) + '%';
  }

  function getCampaignStatus(landing: LandingPage) {
    if (!landing.startDate || !landing.endDate) return null;
    const now = new Date();
    const start = new Date(landing.startDate);
    const end = new Date(landing.endDate);

    if (now < start) return { label: '예정', color: 'bg-blue-100 text-blue-800' };
    if (now > end) return { label: '종료', color: 'bg-gray-100 text-gray-500' };
    return { label: '진행중', color: 'bg-green-100 text-green-800' };
  }

  return (
    <div className="p-6">
      {/* 헤더 */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">랜딩페이지 관리</h2>
          <p className="text-gray-600 mt-1">
            마케팅 캠페인용 랜딩페이지를 관리하고 성과를 추적합니다.
          </p>
        </div>
        <button className="px-4 py-2 bg-rose-500 text-white rounded-lg hover:bg-rose-600 transition-colors">
          <i className="fa-solid fa-plus mr-2"></i>
          새 랜딩페이지
        </button>
      </div>

      {/* 통계 */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg border p-4">
          <p className="text-sm text-gray-500">전체 페이지</p>
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <p className="text-sm text-gray-500">활성 캠페인</p>
          <p className="text-2xl font-bold text-green-600">{stats.active}</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <p className="text-sm text-gray-500">총 조회수</p>
          <p className="text-2xl font-bold text-rose-600">{stats.totalViews.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <p className="text-sm text-gray-500">총 전환</p>
          <p className="text-2xl font-bold text-purple-600">{stats.totalConversions}</p>
        </div>
      </div>

      {/* 필터 */}
      <div className="bg-white rounded-lg border p-4 mb-4">
        <div className="grid grid-cols-3 gap-4">
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
          <div className="col-span-2">
            <label className="block text-xs text-gray-500 mb-1">검색</label>
            <input
              type="text"
              placeholder="제목, 캠페인명으로 검색"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>
        </div>
      </div>

      {/* 랜딩페이지 목록 */}
      <div className="bg-white rounded-lg border">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">제목</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">캠페인</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">상태</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">기간</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">조회</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">전환</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">전환율</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredLandings.map((landing) => {
              const campaignStatus = getCampaignStatus(landing);
              return (
                <tr key={landing.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{landing.title}</div>
                    {landing.shortUrl && (
                      <code className="text-xs text-gray-500">{landing.shortUrl}</code>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {landing.campaignName || '-'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <span
                        className={`inline-block px-2 py-0.5 text-xs rounded ${CONTENT_STATUS_COLORS[landing.status]}`}
                      >
                        {CONTENT_STATUS_LABELS[landing.status]}
                      </span>
                      {campaignStatus && (
                        <span
                          className={`inline-block px-2 py-0.5 text-xs rounded ${campaignStatus.color}`}
                        >
                          {campaignStatus.label}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {landing.startDate && landing.endDate ? (
                      <>
                        {formatDate(landing.startDate)}
                        <br />~ {formatDate(landing.endDate)}
                      </>
                    ) : (
                      '상시'
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {landing.views > 0 ? (
                      <span className="font-medium">{landing.views.toLocaleString()}</span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {landing.conversions > 0 ? (
                      <span className="font-medium text-purple-600">{landing.conversions}</span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className="font-medium text-rose-600">
                      {getConversionRate(landing)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button className="px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded">
                        수정
                      </button>
                      {landing.status === 'published' && (
                        <button className="px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded">
                          보기
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filteredLandings.length === 0 && (
          <div className="p-8 text-center text-gray-500">랜딩페이지가 없습니다.</div>
        )}
      </div>
    </div>
  );
}

export default LandingManagement;
