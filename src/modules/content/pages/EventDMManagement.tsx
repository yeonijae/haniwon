import { useState } from 'react';
import type { EventDM, EventType, ContentStatus } from '../types';
import {
  EVENT_TYPE_LABELS,
  EVENT_TYPE_COLORS,
  CONTENT_STATUS_LABELS,
  CONTENT_STATUS_COLORS,
} from '../types';

// Mock 데이터
const mockEvents: EventDM[] = [
  {
    id: '1',
    type: 'event_dm',
    status: 'published',
    title: '2024 새해 건강 이벤트',
    slug: 'new-year-2024',
    content: '<p>새해를 맞아 건강 상담 할인 이벤트...</p>',
    eventType: 'seasonal',
    eventName: '새해 건강 이벤트',
    eventDescription: '신규 환자 대상 첫 상담 30% 할인',
    eventStartDate: '2024-01-01',
    eventEndDate: '2024-01-31',
    benefitSummary: '첫 상담 30% 할인',
    benefitDetails: ['첫 상담 30% 할인', '한약 10% 추가 할인'],
    discountRate: 30,
    targetPatients: 'new',
    dmTemplate: {
      channel: 'kakao_friendtalk',
      messageContent: '#{고객명}님, 새해 복 많이 받으세요! 연이재한의원에서 새해 건강 이벤트를 진행합니다.',
      buttons: [
        { name: '이벤트 보기', link: '/event/new-year-2024' },
        { name: '상담 예약', link: '/reservation' },
      ],
    },
    sentCount: 1250,
    deliveredCount: 1180,
    clickedCount: 324,
    convertedCount: 45,
    views: 892,
    clicks: 324,
    conversions: 45,
    trackingEnabled: true,
    shortUrl: '/e/ny2024',
    createdBy: '마케팅팀',
    createdAt: '2023-12-20T09:00:00',
    updatedAt: '2024-01-05T14:00:00',
    publishedAt: '2024-01-01T00:00:00',
  },
  {
    id: '2',
    type: 'event_dm',
    status: 'published',
    title: '친구 추천 이벤트',
    slug: 'referral-event',
    content: '<p>친구를 추천하면 모두에게 혜택을...</p>',
    eventType: 'referral',
    eventName: '친구 추천 이벤트',
    eventDescription: '친구 추천 시 양쪽 모두 1만원 할인',
    eventStartDate: '2024-01-01',
    eventEndDate: '2024-12-31',
    benefitSummary: '추천인/피추천인 각 1만원 할인',
    discountAmount: 10000,
    targetPatients: 'existing',
    dmTemplate: {
      channel: 'kakao_alimtalk',
      messageContent: '#{고객명}님, 연이재한의원 친구 추천 이벤트! 친구 추천 시 1만원 할인 혜택을 드립니다.',
      buttons: [
        { name: '추천하기', link: '/referral' },
      ],
    },
    sentCount: 2340,
    deliveredCount: 2250,
    clickedCount: 156,
    convertedCount: 23,
    views: 445,
    clicks: 156,
    conversions: 23,
    trackingEnabled: true,
    shortUrl: '/e/refer',
    createdBy: '마케팅팀',
    createdAt: '2023-12-01T09:00:00',
    updatedAt: '2024-01-10T11:00:00',
    publishedAt: '2024-01-01T00:00:00',
  },
  {
    id: '3',
    type: 'event_dm',
    status: 'draft',
    title: '설 연휴 건강 챙기기',
    slug: 'lunar-new-year-2024',
    content: '<p>설 연휴 건강 관리...</p>',
    eventType: 'seasonal',
    eventName: '설 연휴 이벤트',
    eventStartDate: '2024-02-05',
    eventEndDate: '2024-02-20',
    benefitSummary: '한약 15% 할인',
    discountRate: 15,
    targetPatients: 'all',
    views: 0,
    clicks: 0,
    conversions: 0,
    trackingEnabled: true,
    createdBy: '마케팅팀',
    createdAt: '2024-01-15T09:00:00',
    updatedAt: '2024-01-15T09:00:00',
  },
  {
    id: '4',
    type: 'event_dm',
    status: 'archived',
    title: '2023 연말 감사 이벤트',
    slug: 'yearend-thanks-2023',
    content: '<p>한 해 감사 이벤트...</p>',
    eventType: 'seasonal',
    eventName: '연말 감사 이벤트',
    eventStartDate: '2023-12-01',
    eventEndDate: '2023-12-31',
    benefitSummary: '전 품목 10% 할인',
    discountRate: 10,
    targetPatients: 'all',
    sentCount: 3200,
    deliveredCount: 3050,
    clickedCount: 412,
    convertedCount: 67,
    views: 1230,
    clicks: 412,
    conversions: 67,
    trackingEnabled: true,
    shortUrl: '/e/ye2023',
    createdBy: '마케팅팀',
    createdAt: '2023-11-20T09:00:00',
    updatedAt: '2024-01-02T09:00:00',
    publishedAt: '2023-12-01T00:00:00',
  },
];

function EventDMManagement() {
  const [events] = useState<EventDM[]>(mockEvents);
  const [filterStatus, setFilterStatus] = useState<ContentStatus | ''>('');
  const [filterEventType, setFilterEventType] = useState<EventType | ''>('');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredEvents = events.filter((event) => {
    if (filterStatus && event.status !== filterStatus) return false;
    if (filterEventType && event.eventType !== filterEventType) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      if (
        !event.title.toLowerCase().includes(term) &&
        !event.eventName.toLowerCase().includes(term)
      ) {
        return false;
      }
    }
    return true;
  });

  const stats = {
    total: events.length,
    active: events.filter((e) => e.status === 'published').length,
    totalSent: events.reduce((sum, e) => sum + (e.sentCount || 0), 0),
    totalConversions: events.reduce((sum, e) => sum + e.conversions, 0),
  };

  function formatDate(dateStr: string) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ko-KR', {
      month: 'short',
      day: 'numeric',
    });
  }

  function getEventStatus(event: EventDM) {
    const now = new Date();
    const start = new Date(event.eventStartDate);
    const end = new Date(event.eventEndDate);

    if (now < start) return { label: '예정', color: 'bg-blue-100 text-blue-800' };
    if (now > end) return { label: '종료', color: 'bg-gray-100 text-gray-500' };
    return { label: '진행중', color: 'bg-green-100 text-green-800' };
  }

  function getDMStats(event: EventDM) {
    if (!event.sentCount) return null;
    const clickRate = event.sentCount > 0 ? ((event.clickedCount || 0) / event.sentCount * 100).toFixed(1) : '0';
    const convRate = event.clickedCount && event.clickedCount > 0
      ? ((event.convertedCount || 0) / event.clickedCount * 100).toFixed(1)
      : '0';
    return { clickRate, convRate };
  }

  return (
    <div className="p-6">
      {/* 헤더 */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">이벤트 DM 관리</h2>
          <p className="text-gray-600 mt-1">
            시즌 이벤트, 프로모션 등 이벤트 DM을 관리하고 발송 성과를 추적합니다.
          </p>
        </div>
        <button className="px-4 py-2 bg-rose-500 text-white rounded-lg hover:bg-rose-600 transition-colors">
          <i className="fa-solid fa-plus mr-2"></i>
          새 이벤트
        </button>
      </div>

      {/* 통계 */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg border p-4">
          <p className="text-sm text-gray-500">전체 이벤트</p>
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <p className="text-sm text-gray-500">진행중</p>
          <p className="text-2xl font-bold text-green-600">{stats.active}</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <p className="text-sm text-gray-500">총 발송</p>
          <p className="text-2xl font-bold text-blue-600">{stats.totalSent.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <p className="text-sm text-gray-500">총 전환</p>
          <p className="text-2xl font-bold text-purple-600">{stats.totalConversions}</p>
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
            <label className="block text-xs text-gray-500 mb-1">이벤트 유형</label>
            <select
              value={filterEventType}
              onChange={(e) => setFilterEventType(e.target.value as EventType)}
              className="w-full border rounded px-3 py-2 text-sm"
            >
              <option value="">전체</option>
              {Object.entries(EVENT_TYPE_LABELS).map(([key, label]) => (
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
              placeholder="제목, 이벤트명으로 검색"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>
        </div>
      </div>

      {/* 이벤트 목록 */}
      <div className="space-y-4">
        {filteredEvents.map((event) => {
          const eventStatus = getEventStatus(event);
          const dmStats = getDMStats(event);

          return (
            <div key={event.id} className="bg-white rounded-lg border p-4">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 text-xs rounded ${EVENT_TYPE_COLORS[event.eventType]}`}>
                      {EVENT_TYPE_LABELS[event.eventType]}
                    </span>
                    <span className={`px-2 py-0.5 text-xs rounded ${CONTENT_STATUS_COLORS[event.status]}`}>
                      {CONTENT_STATUS_LABELS[event.status]}
                    </span>
                    <span className={`px-2 py-0.5 text-xs rounded ${eventStatus.color}`}>
                      {eventStatus.label}
                    </span>
                  </div>
                  <h3 className="font-medium text-gray-900 text-lg">{event.title}</h3>
                  <p className="text-sm text-gray-600 mt-1">{event.eventDescription}</p>

                  <div className="flex gap-4 mt-2 text-sm">
                    <span className="text-gray-500">
                      기간: {formatDate(event.eventStartDate)} ~ {formatDate(event.eventEndDate)}
                    </span>
                    {event.benefitSummary && (
                      <span className="text-rose-600 font-medium">
                        {event.benefitSummary}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded">
                    수정
                  </button>
                  {event.status === 'published' && (
                    <button className="px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded">
                      DM 발송
                    </button>
                  )}
                </div>
              </div>

              {/* DM 발송 통계 */}
              {dmStats && (
                <div className="mt-4 pt-4 border-t grid grid-cols-6 gap-4">
                  <div>
                    <p className="text-xs text-gray-500">발송</p>
                    <p className="font-medium">{event.sentCount?.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">전달</p>
                    <p className="font-medium text-green-600">{event.deliveredCount?.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">클릭</p>
                    <p className="font-medium text-cyan-600">{event.clickedCount?.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">전환</p>
                    <p className="font-medium text-purple-600">{event.convertedCount}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">클릭률</p>
                    <p className="font-medium">{dmStats.clickRate}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">전환율</p>
                    <p className="font-medium text-rose-600">{dmStats.convRate}%</p>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {filteredEvents.length === 0 && (
          <div className="bg-white rounded-lg border p-8 text-center text-gray-500">
            이벤트가 없습니다.
          </div>
        )}
      </div>
    </div>
  );
}

export default EventDMManagement;
