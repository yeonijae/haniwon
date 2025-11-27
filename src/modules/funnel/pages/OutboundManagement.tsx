import { useState } from 'react';
import type {
  OutboundMessage,
  OutboundAutomation,
  ScheduledOutbound,
  OutboundChannel,
  OutboundCategory,
  OutboundSourceModule,
  OutboundStatus,
  PageViewTracking,
} from '../types';
import {
  OUTBOUND_CHANNEL_LABELS,
  OUTBOUND_CATEGORY_LABELS,
  OUTBOUND_MODULE_LABELS,
  OUTBOUND_STATUS_LABELS,
  OUTBOUND_STATUS_COLORS,
  FUNNEL_STAGE_LABELS,
  CONVERSION_TYPE_LABELS,
  ENGAGED_THRESHOLD_SECONDS,
} from '../types';

type TabType = 'history' | 'scheduled' | 'automation';

// Mock 데이터 - 발송 이력 (내부 추적 방식)
const mockHistory: OutboundMessage[] = [
  {
    id: '1',
    recipientId: 'p1',
    recipientType: 'patient',
    recipientName: '김영희',
    recipientPhone: '010-1234-5678',
    channel: 'kakao_alimtalk',
    category: 'reservation_confirm',
    content: '안녕하세요 김영희님, 내일 오전 10시 예약이 확인되었습니다. 자세한 안내는 링크를 확인해주세요.',
    status: 'converted',
    sourceModule: 'manage',
    sourcePage: 'reservation_list',
    sourceAction: 'manual',
    sentAt: '2024-01-15T09:30:00',
    trackingId: 'abc123',
    trackingUrl: '/t/abc123',
    targetUrl: '/guide/visit',
    clickedAt: '2024-01-15T09:35:00',
    clickCount: 2,
    pageViews: [
      { pageUrl: '/guide/visit', pageTitle: '방문 안내', viewedAt: '2024-01-15T09:35:00', dwellTime: 45, scrollDepth: 80 },
      { pageUrl: '/guide/parking', pageTitle: '주차 안내', viewedAt: '2024-01-15T09:36:00', dwellTime: 20, scrollDepth: 100 },
    ],
    totalDwellTime: 65,
    engagedAt: '2024-01-15T09:35:45',
    convertedAt: '2024-01-15T10:00:00',
    conversionType: 'reservation',
    conversionValue: 'RES-2024-0115-001',
    createdBy: '데스크1',
    createdAt: '2024-01-15T09:30:00',
  },
  {
    id: '2',
    recipientId: 'l1',
    recipientType: 'lead',
    recipientName: '박철수',
    recipientPhone: '010-9876-5432',
    channel: 'sms',
    category: 'retargeting',
    content: '다이어트 한방 치료에 관심 있으셨죠? 이번 달 특별 상담 이벤트가 있습니다. [링크]',
    status: 'engaged',
    sourceModule: 'funnel',
    sourcePage: 'retargeting',
    sourceAction: 'auto',
    funnelStage: 'interest',
    sentAt: '2024-01-14T14:00:00',
    trackingId: 'def456',
    trackingUrl: '/t/def456',
    targetUrl: '/content/diet-event',
    clickedAt: '2024-01-14T15:23:00',
    clickCount: 1,
    pageViews: [
      { pageUrl: '/content/diet-event', pageTitle: '다이어트 이벤트', viewedAt: '2024-01-14T15:23:00', dwellTime: 52, scrollDepth: 65 },
    ],
    totalDwellTime: 52,
    engagedAt: '2024-01-14T15:23:52',
    createdBy: '시스템',
    createdAt: '2024-01-14T14:00:00',
  },
  {
    id: '3',
    recipientId: 'p2',
    recipientType: 'patient',
    recipientName: '이민수',
    recipientPhone: '010-5555-1234',
    channel: 'lms',
    category: 'medication_guide',
    content: '이민수님, 처방하신 한약 복용 안내입니다. 자세한 복용법은 링크를 확인해주세요.',
    status: 'clicked',
    sourceModule: 'chart',
    sourcePage: 'prescription',
    sourceAction: 'manual',
    sentAt: '2024-01-14T11:00:00',
    trackingId: 'ghi789',
    trackingUrl: '/t/ghi789',
    targetUrl: '/guide/medication/12345',
    clickedAt: '2024-01-14T11:30:00',
    clickCount: 1,
    pageViews: [
      { pageUrl: '/guide/medication/12345', pageTitle: '복약 안내', viewedAt: '2024-01-14T11:30:00', dwellTime: 15, scrollDepth: 30 },
    ],
    totalDwellTime: 15,
    createdBy: '원장A',
    createdAt: '2024-01-14T11:00:00',
  },
  {
    id: '4',
    recipientId: 'p3',
    recipientType: 'patient',
    recipientName: '정미영',
    recipientPhone: '010-3333-7777',
    channel: 'kakao_alimtalk',
    category: 'happy_call',
    content: '정미영님 안녕하세요. 지난 치료는 어떠셨나요? 궁금하신 점이 있으시면 링크를 통해 문의해주세요.',
    status: 'sent',
    sourceModule: 'patient_care',
    sourcePage: 'happy_call',
    sourceAction: 'bulk',
    sentAt: '2024-01-13T10:00:00',
    trackingId: 'jkl012',
    trackingUrl: '/t/jkl012',
    targetUrl: '/inquiry',
    clickCount: 0,
    pageViews: [],
    totalDwellTime: 0,
    createdBy: '상담1',
    createdAt: '2024-01-13T10:00:00',
  },
  {
    id: '5',
    recipientId: 'l2',
    recipientType: 'lead',
    recipientName: '최지영',
    recipientPhone: '010-8888-2222',
    channel: 'kakao_friendtalk',
    category: 'campaign',
    content: '연이재한의원에서 새해 건강 이벤트를 진행합니다! 자세한 내용은 링크에서 확인하세요.',
    status: 'converted',
    sourceModule: 'funnel',
    sourcePage: 'content_hub',
    sourceAction: 'bulk',
    funnelStage: 'awareness',
    sentAt: '2024-01-12T09:00:00',
    trackingId: 'mno345',
    trackingUrl: '/t/mno345',
    targetUrl: '/content/new-year-event',
    clickedAt: '2024-01-12T10:15:00',
    clickCount: 3,
    pageViews: [
      { pageUrl: '/content/new-year-event', pageTitle: '새해 이벤트', viewedAt: '2024-01-12T10:15:00', dwellTime: 120, scrollDepth: 100 },
      { pageUrl: '/reservation', pageTitle: '예약하기', viewedAt: '2024-01-12T10:17:00', dwellTime: 45, scrollDepth: 100 },
    ],
    totalDwellTime: 165,
    engagedAt: '2024-01-12T10:15:30',
    convertedAt: '2024-01-12T10:18:00',
    conversionType: 'reservation',
    createdBy: '마케팅1',
    createdAt: '2024-01-12T09:00:00',
  },
  {
    id: '6',
    recipientId: 'p4',
    recipientType: 'patient',
    recipientName: '홍길동',
    recipientPhone: '010-1111-9999',
    channel: 'sms',
    category: 'reservation_remind',
    content: '홍길동님, 내일 오후 3시 예약 리마인드입니다.',
    status: 'failed',
    statusMessage: '번호오류',
    sourceModule: 'system',
    sourcePage: 'auto_reminder',
    sourceAction: 'auto',
    sentAt: '2024-01-11T09:00:00',
    clickCount: 0,
    pageViews: [],
    totalDwellTime: 0,
    createdBy: '시스템',
    createdAt: '2024-01-11T09:00:00',
  },
];

// Mock 데이터 - 예정 발송
const mockScheduled: ScheduledOutbound[] = [
  {
    id: 's1',
    messageId: 'm1',
    scheduledAt: '2024-01-16T09:00:00',
    recipientName: '김철호',
    recipientPhone: '010-1111-2222',
    channel: 'kakao_alimtalk',
    contentPreview: '안녕하세요 김철호님, 내일 오후 2시 예약 리마인드 드립니다...',
    status: 'pending',
    createdAt: '2024-01-15T10:00:00',
  },
  {
    id: 's2',
    messageId: 'm2',
    automationId: 'a1',
    scheduledAt: '2024-01-16T10:00:00',
    recipientName: '박영수',
    recipientPhone: '010-3333-4444',
    channel: 'sms',
    contentPreview: '박영수님, 3일 전 진료에 대한 경과가 궁금합니다...',
    status: 'pending',
    createdAt: '2024-01-15T08:00:00',
  },
  {
    id: 's3',
    messageId: 'm3',
    scheduledAt: '2024-01-16T14:00:00',
    recipientName: '이수진',
    recipientPhone: '010-5555-6666',
    channel: 'kakao_friendtalk',
    contentPreview: '이수진님, 산후조리 프로그램 안내 드립니다...',
    status: 'pending',
    createdAt: '2024-01-15T11:00:00',
  },
];

// Mock 데이터 - 자동화 규칙
const mockAutomations: OutboundAutomation[] = [
  {
    id: 'a1',
    name: '예약 리마인드',
    description: '예약 하루 전 오전 9시에 리마인드 메시지 발송',
    targetType: 'patient',
    channel: 'kakao_alimtalk',
    category: 'reservation_remind',
    templateId: 't1',
    repeatType: 'trigger',
    trigger: {
      event: 'reservation_day',
      daysOffset: -1,
      timeOfDay: '09:00',
    },
    isActive: true,
    lastRunAt: '2024-01-15T09:00:00',
    nextRunAt: '2024-01-16T09:00:00',
    totalSent: 156,
    totalDelivered: 152,
    totalRead: 134,
    totalFailed: 4,
    createdBy: '관리자',
    createdAt: '2024-01-01T00:00:00',
    updatedAt: '2024-01-15T09:00:00',
  },
  {
    id: 'a2',
    name: '진료 후 만족도 조사',
    description: '진료 완료 3일 후 만족도 조사 메시지 발송',
    targetType: 'patient',
    channel: 'sms',
    category: 'follow_up',
    templateId: 't2',
    repeatType: 'trigger',
    trigger: {
      event: 'treatment_completed',
      daysOffset: 3,
      timeOfDay: '10:00',
    },
    isActive: true,
    lastRunAt: '2024-01-14T10:00:00',
    nextRunAt: '2024-01-17T10:00:00',
    totalSent: 89,
    totalDelivered: 87,
    totalRead: 45,
    totalFailed: 2,
    createdBy: '관리자',
    createdAt: '2024-01-01T00:00:00',
    updatedAt: '2024-01-14T10:00:00',
  },
  {
    id: 'a3',
    name: '이탈 리드 리타겟팅',
    description: '이탈 상태로 7일 경과된 리드에게 재연락',
    targetType: 'lead',
    targetFilter: {
      leadStatuses: ['lost'],
    },
    channel: 'kakao_friendtalk',
    category: 'retargeting',
    templateId: 't3',
    repeatType: 'trigger',
    trigger: {
      event: 'lead_status_changed',
      daysOffset: 7,
      timeOfDay: '14:00',
    },
    isActive: false,
    totalSent: 23,
    totalDelivered: 21,
    totalRead: 8,
    totalFailed: 2,
    createdBy: '마케팅1',
    createdAt: '2024-01-05T00:00:00',
    updatedAt: '2024-01-10T00:00:00',
  },
];

// 상세 보기 모달용 선택 메시지
interface SelectedMessage extends OutboundMessage {}

function OutboundManagement() {
  const [activeTab, setActiveTab] = useState<TabType>('history');
  const [selectedMessage, setSelectedMessage] = useState<SelectedMessage | null>(null);

  // 필터 상태 - 발송 이력
  const [historyFilters, setHistoryFilters] = useState({
    channel: '' as OutboundChannel | '',
    category: '' as OutboundCategory | '',
    sourceModule: '' as OutboundSourceModule | '',
    status: '' as OutboundStatus | '',
    dateRange: 'week' as 'today' | 'week' | 'month' | 'all',
    searchTerm: '',
  });

  // 필터된 데이터
  const filteredHistory = mockHistory.filter((msg) => {
    if (historyFilters.channel && msg.channel !== historyFilters.channel) return false;
    if (historyFilters.category && msg.category !== historyFilters.category) return false;
    if (historyFilters.sourceModule && msg.sourceModule !== historyFilters.sourceModule) return false;
    if (historyFilters.status && msg.status !== historyFilters.status) return false;
    if (historyFilters.searchTerm) {
      const term = historyFilters.searchTerm.toLowerCase();
      if (
        !msg.recipientName.toLowerCase().includes(term) &&
        !msg.recipientPhone.includes(term) &&
        !msg.content.toLowerCase().includes(term)
      ) {
        return false;
      }
    }
    return true;
  });

  // 통계 계산
  const stats = {
    totalSent: mockHistory.filter((m) => m.status !== 'pending' && m.status !== 'scheduled' && m.status !== 'cancelled').length,
    clicked: mockHistory.filter((m) => m.clickCount > 0).length,
    engaged: mockHistory.filter((m) => m.status === 'engaged' || m.status === 'converted').length,
    converted: mockHistory.filter((m) => m.status === 'converted').length,
    failed: mockHistory.filter((m) => m.status === 'failed').length,
  };

  const clickRate = stats.totalSent > 0 ? ((stats.clicked / stats.totalSent) * 100).toFixed(1) : '0';
  const engageRate = stats.clicked > 0 ? ((stats.engaged / stats.clicked) * 100).toFixed(1) : '0';
  const conversionRate = stats.totalSent > 0 ? ((stats.converted / stats.totalSent) * 100).toFixed(1) : '0';

  const tabs = [
    { id: 'history' as TabType, label: '발송 이력', count: mockHistory.length },
    { id: 'scheduled' as TabType, label: '예정 발송', count: mockScheduled.length },
    { id: 'automation' as TabType, label: '자동화 규칙', count: mockAutomations.filter((a) => a.isActive).length },
  ];

  function formatDate(dateStr: string) {
    const date = new Date(dateStr);
    return date.toLocaleString('ko-KR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function formatDateFull(dateStr: string) {
    const date = new Date(dateStr);
    return date.toLocaleString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function formatDwellTime(seconds: number): string {
    if (seconds < 60) return `${seconds}초`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return secs > 0 ? `${mins}분 ${secs}초` : `${mins}분`;
  }

  return (
    <div className="p-6">
      {/* 헤더 */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">DM발송관리</h2>
        <p className="text-gray-600 mt-1">
          모든 모듈에서 발송된 메시지를 통합 관리하고, 내부 링크 추적으로 성과를 측정합니다.
        </p>
      </div>

      {/* 통계 요약 - 내부 추적 지표 */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        <div className="bg-white rounded-lg border p-4">
          <p className="text-sm text-gray-500">총 발송</p>
          <p className="text-2xl font-bold text-gray-900">{stats.totalSent}</p>
          <p className="text-xs text-gray-500">최근 7일</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <p className="text-sm text-gray-500">클릭률</p>
          <p className="text-2xl font-bold text-cyan-600">{clickRate}%</p>
          <p className="text-xs text-gray-500">{stats.clicked}명 클릭</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <p className="text-sm text-gray-500">읽음률</p>
          <p className="text-2xl font-bold text-teal-600">{engageRate}%</p>
          <p className="text-xs text-gray-500">{ENGAGED_THRESHOLD_SECONDS}초 이상 체류</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <p className="text-sm text-gray-500">전환율</p>
          <p className="text-2xl font-bold text-purple-600">{conversionRate}%</p>
          <p className="text-xs text-gray-500">{stats.converted}건 전환</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <p className="text-sm text-gray-500">예정 발송</p>
          <p className="text-2xl font-bold text-blue-600">{mockScheduled.length}</p>
          <p className="text-xs text-gray-500">대기 중</p>
        </div>
      </div>

      {/* 탭 */}
      <div className="border-b mb-4">
        <div className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 font-medium rounded-t-lg transition-colors ${
                activeTab === tab.id
                  ? 'bg-purple-100 text-purple-700 border-b-2 border-purple-600'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {tab.label}
              <span
                className={`ml-2 px-2 py-0.5 text-xs rounded-full ${
                  activeTab === tab.id ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-600'
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* 발송 이력 탭 */}
      {activeTab === 'history' && (
        <div>
          {/* 필터 */}
          <div className="bg-white rounded-lg border p-4 mb-4">
            <div className="grid grid-cols-6 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">기간</label>
                <select
                  value={historyFilters.dateRange}
                  onChange={(e) =>
                    setHistoryFilters({ ...historyFilters, dateRange: e.target.value as any })
                  }
                  className="w-full border rounded px-2 py-1.5 text-sm"
                >
                  <option value="today">오늘</option>
                  <option value="week">최근 7일</option>
                  <option value="month">최근 30일</option>
                  <option value="all">전체</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">발송 모듈</label>
                <select
                  value={historyFilters.sourceModule}
                  onChange={(e) =>
                    setHistoryFilters({
                      ...historyFilters,
                      sourceModule: e.target.value as OutboundSourceModule,
                    })
                  }
                  className="w-full border rounded px-2 py-1.5 text-sm"
                >
                  <option value="">전체</option>
                  {Object.entries(OUTBOUND_MODULE_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">채널</label>
                <select
                  value={historyFilters.channel}
                  onChange={(e) =>
                    setHistoryFilters({
                      ...historyFilters,
                      channel: e.target.value as OutboundChannel,
                    })
                  }
                  className="w-full border rounded px-2 py-1.5 text-sm"
                >
                  <option value="">전체</option>
                  {Object.entries(OUTBOUND_CHANNEL_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">카테고리</label>
                <select
                  value={historyFilters.category}
                  onChange={(e) =>
                    setHistoryFilters({
                      ...historyFilters,
                      category: e.target.value as OutboundCategory,
                    })
                  }
                  className="w-full border rounded px-2 py-1.5 text-sm"
                >
                  <option value="">전체</option>
                  {Object.entries(OUTBOUND_CATEGORY_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">상태</label>
                <select
                  value={historyFilters.status}
                  onChange={(e) =>
                    setHistoryFilters({
                      ...historyFilters,
                      status: e.target.value as OutboundStatus,
                    })
                  }
                  className="w-full border rounded px-2 py-1.5 text-sm"
                >
                  <option value="">전체</option>
                  {Object.entries(OUTBOUND_STATUS_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">검색</label>
                <input
                  type="text"
                  placeholder="이름, 전화번호, 내용"
                  value={historyFilters.searchTerm}
                  onChange={(e) =>
                    setHistoryFilters({ ...historyFilters, searchTerm: e.target.value })
                  }
                  className="w-full border rounded px-2 py-1.5 text-sm"
                />
              </div>
            </div>
          </div>

          {/* 발송 이력 목록 */}
          <div className="bg-white rounded-lg border">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">수신자</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">채널/카테고리</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">발송 모듈</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">상태</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">클릭</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">체류시간</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">발송일시</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredHistory.map((msg) => (
                  <tr key={msg.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{msg.recipientName}</div>
                      <div className="text-xs text-gray-500">{msg.recipientPhone}</div>
                      {msg.recipientType === 'lead' && (
                        <span className="inline-block mt-1 px-1.5 py-0.5 text-xs bg-purple-100 text-purple-700 rounded">
                          리드
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div>{OUTBOUND_CHANNEL_LABELS[msg.channel]}</div>
                      <div className="text-xs text-gray-500">{OUTBOUND_CATEGORY_LABELS[msg.category]}</div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div>{OUTBOUND_MODULE_LABELS[msg.sourceModule]}</div>
                      <div className="text-xs text-gray-500">{msg.createdBy}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2 py-1 text-xs rounded ${OUTBOUND_STATUS_COLORS[msg.status]}`}
                      >
                        {OUTBOUND_STATUS_LABELS[msg.status]}
                      </span>
                      {msg.conversionType && (
                        <div className="text-xs text-purple-600 mt-0.5">
                          {CONVERSION_TYPE_LABELS[msg.conversionType]}
                        </div>
                      )}
                      {msg.statusMessage && (
                        <div className="text-xs text-red-500 mt-0.5">{msg.statusMessage}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {msg.clickCount > 0 ? (
                        <div>
                          <span className="font-medium text-cyan-600">{msg.clickCount}회</span>
                          {msg.clickedAt && (
                            <div className="text-xs text-gray-500">{formatDate(msg.clickedAt)}</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {msg.totalDwellTime > 0 ? (
                        <div>
                          <span className={`font-medium ${msg.totalDwellTime >= ENGAGED_THRESHOLD_SECONDS ? 'text-teal-600' : 'text-gray-600'}`}>
                            {formatDwellTime(msg.totalDwellTime)}
                          </span>
                          <div className="text-xs text-gray-500">
                            {msg.pageViews.length}페이지
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {msg.sentAt && formatDate(msg.sentAt)}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setSelectedMessage(msg)}
                        className="text-purple-600 hover:text-purple-800 text-sm"
                      >
                        상세
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredHistory.length === 0 && (
              <div className="p-8 text-center text-gray-500">
                조건에 맞는 발송 이력이 없습니다.
              </div>
            )}
          </div>
        </div>
      )}

      {/* 예정 발송 탭 */}
      {activeTab === 'scheduled' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <p className="text-sm text-gray-600">
              오늘부터 예정된 발송 메시지입니다. 발송 전 취소하거나 즉시 발송할 수 있습니다.
            </p>
          </div>

          <div className="bg-white rounded-lg border">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">예정 시각</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">수신자</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">채널</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">내용 미리보기</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">생성 방식</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">작업</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {mockScheduled.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{formatDateFull(item.scheduledAt)}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{item.recipientName}</div>
                      <div className="text-xs text-gray-500">{item.recipientPhone}</div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {OUTBOUND_CHANNEL_LABELS[item.channel]}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-700 max-w-md truncate">
                        {item.contentPreview}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {item.automationId ? (
                        <span className="inline-block px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs">
                          자동화
                        </span>
                      ) : (
                        <span className="inline-block px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                          수동
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button className="px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded">
                          즉시 발송
                        </button>
                        <button className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded">
                          취소
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {mockScheduled.length === 0 && (
              <div className="p-8 text-center text-gray-500">예정된 발송이 없습니다.</div>
            )}
          </div>
        </div>
      )}

      {/* 자동화 규칙 탭 */}
      {activeTab === 'automation' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <p className="text-sm text-gray-600">
              트리거 조건에 따라 자동으로 메시지를 발송하는 규칙을 관리합니다.
            </p>
            <button className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
              + 새 규칙 만들기
            </button>
          </div>

          <div className="space-y-4">
            {mockAutomations.map((rule) => (
              <div key={rule.id} className="bg-white rounded-lg border p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-medium text-gray-900">{rule.name}</h3>
                      <span
                        className={`px-2 py-0.5 text-xs rounded ${
                          rule.isActive
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {rule.isActive ? '활성' : '비활성'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{rule.description}</p>

                    <div className="flex gap-6 mt-3 text-sm">
                      <div>
                        <span className="text-gray-500">대상:</span>{' '}
                        <span className="text-gray-900">
                          {rule.targetType === 'patient' ? '환자' : rule.targetType === 'lead' ? '리드' : '환자+리드'}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">채널:</span>{' '}
                        <span className="text-gray-900">{OUTBOUND_CHANNEL_LABELS[rule.channel]}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">카테고리:</span>{' '}
                        <span className="text-gray-900">{OUTBOUND_CATEGORY_LABELS[rule.category]}</span>
                      </div>
                    </div>

                    {rule.trigger && (
                      <div className="mt-2 text-sm text-gray-600">
                        <span className="text-gray-500">트리거:</span>{' '}
                        {rule.trigger.event === 'reservation_day' && '예약일'}
                        {rule.trigger.event === 'treatment_completed' && '진료완료'}
                        {rule.trigger.event === 'lead_status_changed' && '리드상태변경'}
                        {rule.trigger.daysOffset !== 0 && (
                          <span>
                            {' '}
                            {rule.trigger.daysOffset > 0 ? `+${rule.trigger.daysOffset}` : rule.trigger.daysOffset}일
                          </span>
                        )}
                        {rule.trigger.timeOfDay && <span> {rule.trigger.timeOfDay}</span>}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded">
                      편집
                    </button>
                    <button
                      className={`px-3 py-1.5 text-sm rounded ${
                        rule.isActive
                          ? 'text-red-600 hover:bg-red-50'
                          : 'text-green-600 hover:bg-green-50'
                      }`}
                    >
                      {rule.isActive ? '비활성화' : '활성화'}
                    </button>
                  </div>
                </div>

                {/* 통계 */}
                <div className="mt-4 pt-4 border-t grid grid-cols-5 gap-4">
                  <div>
                    <p className="text-xs text-gray-500">총 발송</p>
                    <p className="font-medium">{rule.totalSent.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">클릭</p>
                    <p className="font-medium text-cyan-600">{rule.totalDelivered.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">읽음</p>
                    <p className="font-medium text-teal-600">{rule.totalRead.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">실패</p>
                    <p className="font-medium text-red-600">{rule.totalFailed.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">클릭률</p>
                    <p className="font-medium">
                      {rule.totalSent > 0
                        ? ((rule.totalDelivered / rule.totalSent) * 100).toFixed(1)
                        : 0}
                      %
                    </p>
                  </div>
                </div>

                {rule.isActive && rule.nextRunAt && (
                  <div className="mt-3 text-xs text-gray-500">
                    다음 실행: {formatDateFull(rule.nextRunAt)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 상세 보기 모달 */}
      {selectedMessage && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-lg font-bold text-gray-900">발송 상세</h3>
                <button
                  onClick={() => setSelectedMessage(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <i className="fa-solid fa-xmark text-xl"></i>
                </button>
              </div>

              {/* 기본 정보 */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <p className="text-xs text-gray-500">수신자</p>
                  <p className="font-medium">{selectedMessage.recipientName}</p>
                  <p className="text-sm text-gray-600">{selectedMessage.recipientPhone}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">상태</p>
                  <span className={`inline-block px-2 py-1 text-xs rounded ${OUTBOUND_STATUS_COLORS[selectedMessage.status]}`}>
                    {OUTBOUND_STATUS_LABELS[selectedMessage.status]}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-gray-500">채널</p>
                  <p>{OUTBOUND_CHANNEL_LABELS[selectedMessage.channel]}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">카테고리</p>
                  <p>{OUTBOUND_CATEGORY_LABELS[selectedMessage.category]}</p>
                </div>
              </div>

              {/* 메시지 내용 */}
              <div className="mb-6">
                <p className="text-xs text-gray-500 mb-1">메시지 내용</p>
                <div className="bg-gray-50 rounded p-3 text-sm">{selectedMessage.content}</div>
              </div>

              {/* 추적 링크 */}
              {selectedMessage.trackingUrl && (
                <div className="mb-6">
                  <p className="text-xs text-gray-500 mb-1">추적 링크</p>
                  <div className="bg-gray-50 rounded p-3 text-sm font-mono">
                    {selectedMessage.trackingUrl} → {selectedMessage.targetUrl}
                  </div>
                </div>
              )}

              {/* 페이지 조회 기록 */}
              {selectedMessage.pageViews.length > 0 && (
                <div className="mb-6">
                  <p className="text-xs text-gray-500 mb-2">페이지 조회 기록</p>
                  <div className="space-y-2">
                    {selectedMessage.pageViews.map((pv, idx) => (
                      <div key={idx} className="bg-gray-50 rounded p-3 text-sm">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium">{pv.pageTitle || pv.pageUrl}</p>
                            <p className="text-xs text-gray-500">{pv.pageUrl}</p>
                          </div>
                          <div className="text-right">
                            <p className={`font-medium ${pv.dwellTime >= ENGAGED_THRESHOLD_SECONDS ? 'text-teal-600' : 'text-gray-600'}`}>
                              {formatDwellTime(pv.dwellTime)}
                            </p>
                            {pv.scrollDepth !== undefined && (
                              <p className="text-xs text-gray-500">스크롤 {pv.scrollDepth}%</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 text-right">
                    <span className="text-sm text-gray-500">총 체류시간: </span>
                    <span className="font-medium text-teal-600">{formatDwellTime(selectedMessage.totalDwellTime)}</span>
                  </div>
                </div>
              )}

              {/* 전환 정보 */}
              {selectedMessage.convertedAt && (
                <div className="mb-6 bg-purple-50 rounded p-4">
                  <p className="text-xs text-purple-600 font-medium mb-1">전환 완료</p>
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium text-purple-800">
                        {selectedMessage.conversionType && CONVERSION_TYPE_LABELS[selectedMessage.conversionType]}
                      </p>
                      {selectedMessage.conversionValue && (
                        <p className="text-sm text-purple-600">{selectedMessage.conversionValue}</p>
                      )}
                    </div>
                    <p className="text-sm text-purple-600">{formatDate(selectedMessage.convertedAt)}</p>
                  </div>
                </div>
              )}

              {/* 타임라인 */}
              <div>
                <p className="text-xs text-gray-500 mb-2">타임라인</p>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-gray-400"></span>
                    <span className="text-gray-600">발송: {selectedMessage.sentAt && formatDate(selectedMessage.sentAt)}</span>
                  </div>
                  {selectedMessage.clickedAt && (
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-cyan-500"></span>
                      <span className="text-gray-600">클릭: {formatDate(selectedMessage.clickedAt)}</span>
                    </div>
                  )}
                  {selectedMessage.engagedAt && (
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-teal-500"></span>
                      <span className="text-gray-600">읽음: {formatDate(selectedMessage.engagedAt)}</span>
                    </div>
                  )}
                  {selectedMessage.convertedAt && (
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                      <span className="text-gray-600">전환: {formatDate(selectedMessage.convertedAt)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default OutboundManagement;
