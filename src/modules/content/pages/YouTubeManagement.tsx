/**
 * 유튜브 관리 페이지
 * 롱폼/숏폼 영상 관리
 */

import React, { useState } from 'react';
import type {
  YouTubeVideo,
  YouTubeVideoType,
  YouTubeCategory,
} from '../types';
import {
  YOUTUBE_VIDEO_TYPE_LABELS,
  YOUTUBE_CATEGORY_LABELS,
  YOUTUBE_CATEGORY_COLORS,
  YOUTUBE_UPLOAD_STATUS_LABELS,
  YOUTUBE_UPLOAD_STATUS_COLORS,
} from '../types';

type TabType = 'all' | 'long' | 'short';

// 목업 데이터
const mockVideos: YouTubeVideo[] = [
  {
    id: 'yt-1',
    type: 'youtube',
    videoType: 'long',
    category: 'health_info',
    status: 'published',
    title: '목디스크 초기 증상과 자가진단법',
    slug: 'neck-disc-symptoms',
    content: '',
    videoId: 'abc123xyz',
    channelName: '연이재한의원',
    duration: 612,
    thumbnailUrl: 'https://img.youtube.com/vi/abc123xyz/maxresdefault.jpg',
    youtubeViews: 15420,
    youtubeLikes: 342,
    youtubeComments: 28,
    subscriberGain: 45,
    tags: ['목디스크', '경추', '자가진단'],
    hashtags: ['#목디스크', '#한의원', '#자가진단'],
    trackingEnabled: true,
    views: 1200,
    clicks: 89,
    conversions: 12,
    createdBy: '홍길동',
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-20T14:30:00Z',
    publishedAt: '2024-01-16T09:00:00Z',
    uploadStatus: 'published',
  },
  {
    id: 'yt-2',
    type: 'youtube',
    videoType: 'short',
    category: 'daily_tip',
    status: 'published',
    title: '아침에 일어나면 허리가 아픈 이유 #shorts',
    slug: 'morning-back-pain',
    content: '',
    videoId: 'def456uvw',
    channelName: '연이재한의원',
    duration: 58,
    thumbnailUrl: 'https://img.youtube.com/vi/def456uvw/maxresdefault.jpg',
    youtubeViews: 45200,
    youtubeLikes: 2100,
    youtubeComments: 156,
    subscriberGain: 320,
    tags: ['허리통증', '아침', '건강팁'],
    hashtags: ['#shorts', '#허리통증', '#건강팁'],
    trackingEnabled: true,
    views: 3500,
    clicks: 210,
    conversions: 28,
    createdBy: '김영희',
    createdAt: '2024-01-18T11:00:00Z',
    updatedAt: '2024-01-18T15:00:00Z',
    publishedAt: '2024-01-18T18:00:00Z',
    uploadStatus: 'published',
  },
  {
    id: 'yt-3',
    type: 'youtube',
    videoType: 'long',
    category: 'case_study',
    status: 'published',
    title: '허리디스크 치료 3개월 후기 - 40대 직장인 김OO님',
    slug: 'disc-treatment-review',
    content: '',
    videoId: 'ghi789rst',
    channelName: '연이재한의원',
    duration: 845,
    thumbnailUrl: 'https://img.youtube.com/vi/ghi789rst/maxresdefault.jpg',
    youtubeViews: 8900,
    youtubeLikes: 198,
    youtubeComments: 42,
    subscriberGain: 28,
    tags: ['허리디스크', '치료후기', '한방치료'],
    trackingEnabled: true,
    views: 650,
    clicks: 45,
    conversions: 8,
    createdBy: '홍길동',
    createdAt: '2024-01-10T09:00:00Z',
    updatedAt: '2024-01-12T16:00:00Z',
    publishedAt: '2024-01-12T09:00:00Z',
    uploadStatus: 'published',
  },
  {
    id: 'yt-4',
    type: 'youtube',
    videoType: 'short',
    category: 'qa',
    status: 'published',
    title: '침 맞으면 진짜 아파요? #shorts',
    slug: 'acupuncture-pain-qa',
    content: '',
    videoId: 'jkl012mno',
    channelName: '연이재한의원',
    duration: 45,
    thumbnailUrl: 'https://img.youtube.com/vi/jkl012mno/maxresdefault.jpg',
    youtubeViews: 128500,
    youtubeLikes: 8900,
    youtubeComments: 620,
    subscriberGain: 1200,
    tags: ['침', 'Q&A', '한의원'],
    hashtags: ['#shorts', '#침맞기', '#한의원'],
    trackingEnabled: true,
    views: 8200,
    clicks: 520,
    conversions: 45,
    createdBy: '김영희',
    createdAt: '2024-01-20T14:00:00Z',
    updatedAt: '2024-01-20T16:00:00Z',
    publishedAt: '2024-01-20T19:00:00Z',
    uploadStatus: 'published',
  },
  {
    id: 'yt-5',
    type: 'youtube',
    videoType: 'long',
    category: 'treatment_guide',
    status: 'draft',
    title: '추나요법 완벽 가이드 - 효과, 비용, 주의사항',
    slug: 'chuna-therapy-guide',
    content: '',
    videoId: '',
    channelName: '연이재한의원',
    duration: 0,
    youtubeViews: 0,
    youtubeLikes: 0,
    youtubeComments: 0,
    tags: ['추나요법', '치료안내'],
    trackingEnabled: true,
    views: 0,
    clicks: 0,
    conversions: 0,
    createdBy: '홍길동',
    createdAt: '2024-01-22T10:00:00Z',
    updatedAt: '2024-01-22T10:00:00Z',
    uploadStatus: 'draft',
  },
  {
    id: 'yt-6',
    type: 'youtube',
    videoType: 'short',
    category: 'behind',
    status: 'review',
    title: '한의원 브이로그 - 바쁜 오전 진료 #shorts',
    slug: 'clinic-vlog',
    content: '',
    videoId: 'pqr345stu',
    channelName: '연이재한의원',
    duration: 55,
    thumbnailUrl: 'https://img.youtube.com/vi/pqr345stu/maxresdefault.jpg',
    youtubeViews: 0,
    youtubeLikes: 0,
    youtubeComments: 0,
    tags: ['브이로그', '한의원일상'],
    hashtags: ['#shorts', '#브이로그', '#한의원'],
    trackingEnabled: true,
    views: 0,
    clicks: 0,
    conversions: 0,
    createdBy: '김영희',
    createdAt: '2024-01-23T11:00:00Z',
    updatedAt: '2024-01-23T14:00:00Z',
    uploadStatus: 'private',
    scheduledPublishAt: '2024-01-25T18:00:00Z',
  },
];

// 시간 포맷
function formatDuration(seconds: number): string {
  if (seconds === 0) return '-';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins >= 60) {
    const hours = Math.floor(mins / 60);
    const remainMins = mins % 60;
    return `${hours}:${remainMins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// 숫자 포맷
function formatNumber(num: number): string {
  if (num >= 10000) {
    return (num / 10000).toFixed(1) + '만';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + '천';
  }
  return num.toLocaleString();
}

// 날짜 포맷
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

const YouTubeManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [selectedCategory, setSelectedCategory] = useState<YouTubeCategory | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedVideo, setSelectedVideo] = useState<YouTubeVideo | null>(null);

  // 필터링
  const filteredVideos = mockVideos.filter((video) => {
    const matchesTab = activeTab === 'all' || video.videoType === activeTab;
    const matchesCategory = selectedCategory === 'all' || video.category === selectedCategory;
    const matchesSearch =
      searchTerm === '' ||
      video.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      video.tags.some((tag) => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesTab && matchesCategory && matchesSearch;
  });

  // 통계 계산
  const stats = {
    total: mockVideos.length,
    long: mockVideos.filter((v) => v.videoType === 'long').length,
    short: mockVideos.filter((v) => v.videoType === 'short').length,
    totalViews: mockVideos.reduce((sum, v) => sum + v.youtubeViews, 0),
    totalLikes: mockVideos.reduce((sum, v) => sum + v.youtubeLikes, 0),
    totalSubscribers: mockVideos.reduce((sum, v) => sum + (v.subscriberGain || 0), 0),
  };

  const tabs = [
    { id: 'all' as TabType, label: '전체', count: stats.total },
    { id: 'long' as TabType, label: '롱폼', count: stats.long, icon: 'fa-solid fa-film' },
    { id: 'short' as TabType, label: '숏폼', count: stats.short, icon: 'fa-solid fa-bolt' },
  ];

  return (
    <div className="p-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">유튜브 관리</h2>
          <p className="text-sm text-gray-500 mt-1">롱폼/숏폼 영상 컨텐츠 관리</p>
        </div>
        <button className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2">
          <i className="fa-brands fa-youtube"></i>
          새 영상 등록
        </button>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-6 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">총 영상</p>
              <p className="text-2xl font-bold text-gray-800">{stats.total}</p>
            </div>
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
              <i className="fa-brands fa-youtube text-red-600 text-xl"></i>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">롱폼</p>
              <p className="text-2xl font-bold text-blue-600">{stats.long}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <i className="fa-solid fa-film text-blue-600 text-xl"></i>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">숏폼</p>
              <p className="text-2xl font-bold text-orange-600">{stats.short}</p>
            </div>
            <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
              <i className="fa-solid fa-bolt text-orange-600 text-xl"></i>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">총 조회수</p>
              <p className="text-2xl font-bold text-gray-800">{formatNumber(stats.totalViews)}</p>
            </div>
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
              <i className="fa-solid fa-eye text-gray-600 text-xl"></i>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">총 좋아요</p>
              <p className="text-2xl font-bold text-pink-600">{formatNumber(stats.totalLikes)}</p>
            </div>
            <div className="w-12 h-12 bg-pink-100 rounded-full flex items-center justify-center">
              <i className="fa-solid fa-heart text-pink-600 text-xl"></i>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">구독자 증가</p>
              <p className="text-2xl font-bold text-green-600">+{formatNumber(stats.totalSubscribers)}</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <i className="fa-solid fa-user-plus text-green-600 text-xl"></i>
            </div>
          </div>
        </div>
      </div>

      {/* 탭 & 필터 */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="border-b border-gray-200 px-4">
          <div className="flex items-center justify-between">
            <div className="flex">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-red-500 text-red-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab.icon && <i className={`${tab.icon} mr-2`}></i>}
                  {tab.label}
                  <span className="ml-1 text-xs bg-gray-100 px-2 py-0.5 rounded-full">
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3 py-2">
              {/* 카테고리 필터 */}
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value as YouTubeCategory | 'all')}
                className="px-3 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                <option value="all">전체 카테고리</option>
                {Object.entries(YOUTUBE_CATEGORY_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>

              {/* 검색 */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="제목, 태그 검색..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 pr-4 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 w-60"
                />
                <i className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
              </div>
            </div>
          </div>
        </div>

        {/* 영상 목록 */}
        <div className="p-4">
          {filteredVideos.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <i className="fa-brands fa-youtube text-4xl mb-3"></i>
              <p>등록된 영상이 없습니다.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredVideos.map((video) => (
                <div
                  key={video.id}
                  className="bg-gray-50 rounded-lg overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => setSelectedVideo(video)}
                >
                  {/* 썸네일 */}
                  <div className="relative aspect-video bg-gray-200">
                    {video.thumbnailUrl ? (
                      <img
                        src={video.thumbnailUrl}
                        alt={video.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        <i className="fa-solid fa-image text-4xl"></i>
                      </div>
                    )}
                    {/* 영상 길이 */}
                    <span className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-2 py-0.5 rounded">
                      {formatDuration(video.duration)}
                    </span>
                    {/* 영상 타입 배지 */}
                    <span
                      className={`absolute top-2 left-2 text-xs px-2 py-0.5 rounded font-medium ${
                        video.videoType === 'short'
                          ? 'bg-orange-500 text-white'
                          : 'bg-blue-500 text-white'
                      }`}
                    >
                      {YOUTUBE_VIDEO_TYPE_LABELS[video.videoType]}
                    </span>
                  </div>

                  {/* 정보 */}
                  <div className="p-3">
                    <h3 className="font-medium text-gray-800 line-clamp-2 mb-2">{video.title}</h3>

                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-xs px-2 py-0.5 rounded ${YOUTUBE_CATEGORY_COLORS[video.category]}`}>
                        {YOUTUBE_CATEGORY_LABELS[video.category]}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded ${YOUTUBE_UPLOAD_STATUS_COLORS[video.uploadStatus]}`}>
                        {YOUTUBE_UPLOAD_STATUS_LABELS[video.uploadStatus]}
                      </span>
                    </div>

                    {/* 통계 */}
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <i className="fa-solid fa-eye"></i>
                        {formatNumber(video.youtubeViews)}
                      </span>
                      <span className="flex items-center gap-1">
                        <i className="fa-solid fa-heart"></i>
                        {formatNumber(video.youtubeLikes)}
                      </span>
                      <span className="flex items-center gap-1">
                        <i className="fa-solid fa-comment"></i>
                        {formatNumber(video.youtubeComments)}
                      </span>
                    </div>

                    {/* 날짜 */}
                    <p className="text-xs text-gray-400 mt-2">
                      {video.publishedAt ? formatDate(video.publishedAt) : '미발행'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 상세 모달 */}
      {selectedVideo && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-bold text-gray-800">영상 상세</h3>
              <button
                onClick={() => setSelectedVideo(null)}
                className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center"
              >
                <i className="fa-solid fa-xmark text-gray-500"></i>
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(90vh-60px)]">
              <div className="grid grid-cols-2 gap-6">
                {/* 왼쪽: 영상 정보 */}
                <div>
                  {/* 썸네일 */}
                  <div className="relative aspect-video bg-gray-200 rounded-lg overflow-hidden mb-4">
                    {selectedVideo.thumbnailUrl ? (
                      <img
                        src={selectedVideo.thumbnailUrl}
                        alt={selectedVideo.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        <i className="fa-solid fa-image text-4xl"></i>
                      </div>
                    )}
                    {selectedVideo.videoId && (
                      <a
                        href={`https://www.youtube.com/watch?v=${selectedVideo.videoId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 hover:opacity-100 transition-opacity"
                      >
                        <i className="fa-solid fa-play text-white text-4xl"></i>
                      </a>
                    )}
                  </div>

                  <h4 className="text-xl font-bold text-gray-800 mb-3">{selectedVideo.title}</h4>

                  <div className="flex items-center gap-2 mb-4">
                    <span
                      className={`px-2 py-1 rounded text-sm font-medium ${
                        selectedVideo.videoType === 'short'
                          ? 'bg-orange-100 text-orange-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {YOUTUBE_VIDEO_TYPE_LABELS[selectedVideo.videoType]}
                    </span>
                    <span className={`px-2 py-1 rounded text-sm ${YOUTUBE_CATEGORY_COLORS[selectedVideo.category]}`}>
                      {YOUTUBE_CATEGORY_LABELS[selectedVideo.category]}
                    </span>
                    <span className={`px-2 py-1 rounded text-sm ${YOUTUBE_UPLOAD_STATUS_COLORS[selectedVideo.uploadStatus]}`}>
                      {YOUTUBE_UPLOAD_STATUS_LABELS[selectedVideo.uploadStatus]}
                    </span>
                  </div>

                  {/* 태그 */}
                  {selectedVideo.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-4">
                      {selectedVideo.tags.map((tag, idx) => (
                        <span key={idx} className="text-sm bg-gray-100 text-gray-600 px-2 py-1 rounded">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* 메타 정보 */}
                  <div className="space-y-2 text-sm text-gray-600">
                    <p>
                      <span className="text-gray-400">영상 길이:</span> {formatDuration(selectedVideo.duration)}
                    </p>
                    <p>
                      <span className="text-gray-400">작성자:</span> {selectedVideo.createdBy}
                    </p>
                    <p>
                      <span className="text-gray-400">등록일:</span> {formatDate(selectedVideo.createdAt)}
                    </p>
                    {selectedVideo.publishedAt && (
                      <p>
                        <span className="text-gray-400">발행일:</span> {formatDate(selectedVideo.publishedAt)}
                      </p>
                    )}
                    {selectedVideo.scheduledPublishAt && (
                      <p>
                        <span className="text-gray-400">예약 공개:</span> {formatDate(selectedVideo.scheduledPublishAt)}
                      </p>
                    )}
                  </div>
                </div>

                {/* 오른쪽: 통계 */}
                <div>
                  <h5 className="font-bold text-gray-800 mb-4">유튜브 통계</h5>

                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-gray-50 rounded-lg p-4 text-center">
                      <p className="text-3xl font-bold text-gray-800">{formatNumber(selectedVideo.youtubeViews)}</p>
                      <p className="text-sm text-gray-500">조회수</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4 text-center">
                      <p className="text-3xl font-bold text-pink-600">{formatNumber(selectedVideo.youtubeLikes)}</p>
                      <p className="text-sm text-gray-500">좋아요</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4 text-center">
                      <p className="text-3xl font-bold text-blue-600">{formatNumber(selectedVideo.youtubeComments)}</p>
                      <p className="text-sm text-gray-500">댓글</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4 text-center">
                      <p className="text-3xl font-bold text-green-600">+{formatNumber(selectedVideo.subscriberGain || 0)}</p>
                      <p className="text-sm text-gray-500">구독자 증가</p>
                    </div>
                  </div>

                  <h5 className="font-bold text-gray-800 mb-4">내부 추적 통계</h5>

                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="bg-rose-50 rounded-lg p-4 text-center">
                      <p className="text-2xl font-bold text-rose-600">{selectedVideo.views}</p>
                      <p className="text-xs text-gray-500">내부 조회</p>
                    </div>
                    <div className="bg-rose-50 rounded-lg p-4 text-center">
                      <p className="text-2xl font-bold text-rose-600">{selectedVideo.clicks}</p>
                      <p className="text-xs text-gray-500">링크 클릭</p>
                    </div>
                    <div className="bg-rose-50 rounded-lg p-4 text-center">
                      <p className="text-2xl font-bold text-rose-600">{selectedVideo.conversions}</p>
                      <p className="text-xs text-gray-500">전환</p>
                    </div>
                  </div>

                  {/* 참여율 계산 */}
                  {selectedVideo.youtubeViews > 0 && (
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h6 className="text-sm font-medium text-gray-700 mb-3">참여율 분석</h6>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-500">좋아요율</span>
                          <span className="font-medium">
                            {((selectedVideo.youtubeLikes / selectedVideo.youtubeViews) * 100).toFixed(2)}%
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-500">댓글율</span>
                          <span className="font-medium">
                            {((selectedVideo.youtubeComments / selectedVideo.youtubeViews) * 100).toFixed(3)}%
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-500">전환율 (내부)</span>
                          <span className="font-medium text-green-600">
                            {selectedVideo.clicks > 0
                              ? ((selectedVideo.conversions / selectedVideo.clicks) * 100).toFixed(1)
                              : 0}
                            %
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-4 border-t bg-gray-50">
              {selectedVideo.videoId && (
                <a
                  href={`https://www.youtube.com/watch?v=${selectedVideo.videoId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
                >
                  <i className="fa-brands fa-youtube"></i>
                  유튜브에서 보기
                </a>
              )}
              <button className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors">
                수정
              </button>
              <button
                onClick={() => setSelectedVideo(null)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default YouTubeManagement;
