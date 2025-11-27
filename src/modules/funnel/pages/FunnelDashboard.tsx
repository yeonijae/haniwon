/**
 * 퍼널 대시보드
 * 전환율 현황, 리드 요약, 팔로업 필요 목록 등
 */

import React, { useState, useMemo } from 'react';
import {
  FUNNEL_STAGE_LABELS,
  CHANNEL_LABELS,
  STATUS_LABELS,
  STATUS_COLORS,
  type FunnelStage,
  type LeadChannel,
  type LeadStatus,
  type Lead,
} from '../types';

// 임시 데이터
const MOCK_LEADS: Lead[] = [
  {
    id: '1',
    name: '김미영',
    phone: '010-1234-5678',
    channel: 'naver_talk',
    status: 'consulting',
    interests: ['다이어트', '산후조리'],
    consultations: [
      {
        id: 'c1',
        leadId: '1',
        date: '2024-11-25',
        type: 'chat',
        summary: '산후 다이어트 관심, 가격 문의',
        outcome: 'positive',
        createdBy: '김상담',
        createdAt: '2024-11-25T10:30:00',
      },
    ],
    nextFollowUp: '2024-11-28',
    followUpNote: '가격 검토 후 연락 주기로 함',
    createdAt: '2024-11-25T10:00:00',
    updatedAt: '2024-11-25T10:30:00',
  },
  {
    id: '2',
    name: '이수진',
    phone: '010-2345-6789',
    channel: 'phone',
    status: 'reserved',
    interests: ['ADHD', '소아'],
    consultations: [
      {
        id: 'c2',
        leadId: '2',
        date: '2024-11-26',
        type: 'phone',
        summary: '아이 ADHD 상담 원함, 11/30 예약 완료',
        outcome: 'positive',
        createdBy: '박상담',
        createdAt: '2024-11-26T14:00:00',
      },
    ],
    createdAt: '2024-11-26T13:30:00',
    updatedAt: '2024-11-26T14:00:00',
  },
  {
    id: '3',
    name: '박지훈',
    phone: '010-3456-7890',
    channel: 'kakao',
    status: 'new',
    interests: ['통증'],
    consultations: [],
    createdAt: '2024-11-27T09:00:00',
    updatedAt: '2024-11-27T09:00:00',
  },
  {
    id: '4',
    name: '최은경',
    phone: '010-4567-8901',
    channel: 'referral',
    status: 'visited',
    interests: ['부인과', '생리통'],
    consultations: [
      {
        id: 'c4',
        leadId: '4',
        date: '2024-11-24',
        type: 'visit',
        summary: '친구 소개로 방문, 진료 상담 진행',
        outcome: 'positive',
        createdBy: '원장',
        createdAt: '2024-11-24T11:00:00',
      },
    ],
    createdAt: '2024-11-24T10:00:00',
    updatedAt: '2024-11-24T11:00:00',
  },
  {
    id: '5',
    name: '정다혜',
    phone: '010-5678-9012',
    channel: 'website',
    status: 'lost',
    interests: ['다이어트'],
    consultations: [
      {
        id: 'c5',
        leadId: '5',
        date: '2024-11-20',
        type: 'phone',
        summary: '가격 부담으로 보류',
        outcome: 'negative',
        createdBy: '김상담',
        createdAt: '2024-11-20T15:00:00',
      },
    ],
    createdAt: '2024-11-19T16:00:00',
    updatedAt: '2024-11-20T15:00:00',
  },
];

// 퍼널 단계 데이터
const FUNNEL_DATA = [
  { stage: 'awareness' as FunnelStage, label: '문의 유입', count: 120, color: 'bg-blue-500' },
  { stage: 'interest' as FunnelStage, label: '관심/상담', count: 95, color: 'bg-cyan-500' },
  { stage: 'reservation' as FunnelStage, label: '예약 전환', count: 72, color: 'bg-purple-500' },
  { stage: 'visit' as FunnelStage, label: '실제 방문', count: 65, color: 'bg-indigo-500' },
  { stage: 'consultation' as FunnelStage, label: '상담 완료', count: 58, color: 'bg-violet-500' },
  { stage: 'treatment' as FunnelStage, label: '진료 전환', count: 52, color: 'bg-green-500' },
  { stage: 'referral' as FunnelStage, label: '소개 발생', count: 15, color: 'bg-amber-500' },
];

const FunnelDashboard: React.FC = () => {
  const [period, setPeriod] = useState<'week' | 'month' | 'quarter'>('month');

  // 채널별 통계
  const channelStats = useMemo(() => {
    const stats: Record<LeadChannel, number> = {
      phone: 35,
      website: 20,
      kakao: 25,
      naver_talk: 18,
      naver_booking: 12,
      daangn: 5,
      referral: 8,
      walk_in: 2,
      other: 0,
    };
    const total = Object.values(stats).reduce((a, b) => a + b, 0);
    return Object.entries(stats)
      .filter(([_, count]) => count > 0)
      .map(([channel, count]) => ({
        channel: channel as LeadChannel,
        count,
        percentage: Math.round((count / total) * 100),
      }))
      .sort((a, b) => b.count - a.count);
  }, []);

  // 팔로업 필요 리드
  const followUpLeads = useMemo(() => {
    return MOCK_LEADS.filter(lead =>
      lead.nextFollowUp &&
      new Date(lead.nextFollowUp) <= new Date() &&
      lead.status !== 'converted' &&
      lead.status !== 'lost'
    );
  }, []);

  // 신규 리드
  const newLeads = useMemo(() => {
    return MOCK_LEADS.filter(lead => lead.status === 'new');
  }, []);

  // 전체 전환율
  const overallConversionRate = Math.round((FUNNEL_DATA[5].count / FUNNEL_DATA[0].count) * 100);

  // 병목 구간 찾기
  const bottleneck = useMemo(() => {
    let maxDrop = 0;
    let bottleneckIndex = 0;
    for (let i = 0; i < FUNNEL_DATA.length - 1; i++) {
      const dropRate = 1 - (FUNNEL_DATA[i + 1].count / FUNNEL_DATA[i].count);
      if (dropRate > maxDrop) {
        maxDrop = dropRate;
        bottleneckIndex = i;
      }
    }
    return {
      from: FUNNEL_DATA[bottleneckIndex].label,
      to: FUNNEL_DATA[bottleneckIndex + 1].label,
      dropRate: Math.round(maxDrop * 100),
    };
  }, []);

  return (
    <div className="h-full overflow-auto p-6 bg-gray-50">
      {/* 상단 요약 카드 */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">이번 달 문의</p>
              <p className="text-3xl font-bold text-gray-900">{FUNNEL_DATA[0].count}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <i className="fas fa-phone-volume text-blue-600 text-xl"></i>
            </div>
          </div>
          <p className="text-xs text-green-600 mt-2">
            <i className="fas fa-arrow-up mr-1"></i>12% 증가
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">예약 전환</p>
              <p className="text-3xl font-bold text-gray-900">{FUNNEL_DATA[2].count}</p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
              <i className="fas fa-calendar-check text-purple-600 text-xl"></i>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            전환율 {Math.round((FUNNEL_DATA[2].count / FUNNEL_DATA[0].count) * 100)}%
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">진료 전환</p>
              <p className="text-3xl font-bold text-gray-900">{FUNNEL_DATA[5].count}</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <i className="fas fa-user-check text-green-600 text-xl"></i>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            전체 전환율 {overallConversionRate}%
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">소개 환자</p>
              <p className="text-3xl font-bold text-gray-900">{FUNNEL_DATA[6].count}</p>
            </div>
            <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
              <i className="fas fa-users text-amber-600 text-xl"></i>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            소개율 {Math.round((FUNNEL_DATA[6].count / FUNNEL_DATA[5].count) * 100)}%
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* 퍼널 시각화 */}
        <div className="col-span-2 bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-gray-900">퍼널 전환율 현황</h2>
            <div className="flex items-center space-x-2">
              {(['week', 'month', 'quarter'] as const).map(p => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                    period === p
                      ? 'bg-purple-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {p === 'week' ? '주간' : p === 'month' ? '월간' : '분기'}
                </button>
              ))}
            </div>
          </div>

          {/* 퍼널 바 차트 */}
          <div className="space-y-3">
            {FUNNEL_DATA.map((item, index) => {
              const widthPercent = (item.count / FUNNEL_DATA[0].count) * 100;
              const prevCount = index > 0 ? FUNNEL_DATA[index - 1].count : item.count;
              const conversionRate = Math.round((item.count / prevCount) * 100);

              return (
                <div key={item.stage} className="flex items-center gap-4">
                  <div className="w-24 text-sm text-gray-600 text-right">{item.label}</div>
                  <div className="flex-1 relative">
                    <div className="h-8 bg-gray-100 rounded-lg overflow-hidden">
                      <div
                        className={`h-full ${item.color} rounded-lg transition-all duration-500`}
                        style={{ width: `${widthPercent}%` }}
                      />
                    </div>
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-sm font-medium text-white">
                      {item.count}명
                    </span>
                  </div>
                  <div className="w-16 text-sm text-gray-500">
                    {index > 0 && (
                      <span className={conversionRate < 80 ? 'text-red-500' : 'text-green-600'}>
                        {conversionRate}%
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* 병목 구간 알림 */}
          {bottleneck.dropRate > 15 && (
            <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start gap-3">
                <i className="fas fa-exclamation-triangle text-red-500 mt-0.5"></i>
                <div>
                  <p className="font-medium text-red-800">병목 구간 발견</p>
                  <p className="text-sm text-red-600 mt-1">
                    <strong>{bottleneck.from}</strong> → <strong>{bottleneck.to}</strong> 단계에서
                    <strong> {bottleneck.dropRate}%</strong>가 이탈하고 있습니다.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 채널별 유입 */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">채널별 유입</h2>
          <div className="space-y-3">
            {channelStats.map(({ channel, count, percentage }) => (
              <div key={channel} className="flex items-center gap-3">
                <div className="w-20 text-sm text-gray-600">{CHANNEL_LABELS[channel]}</div>
                <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-purple-400 rounded-full"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <div className="w-12 text-sm text-gray-600 text-right">{count}명</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 하단 섹션 */}
      <div className="grid grid-cols-2 gap-6 mt-6">
        {/* 신규 리드 */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">신규 문의</h2>
            <span className="px-2 py-1 bg-blue-100 text-blue-700 text-sm rounded-full">
              {newLeads.length}건
            </span>
          </div>
          {newLeads.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <i className="fas fa-inbox text-4xl mb-2"></i>
              <p>신규 문의가 없습니다</p>
            </div>
          ) : (
            <div className="space-y-3">
              {newLeads.map(lead => (
                <div
                  key={lead.id}
                  className="flex items-center justify-between p-3 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors cursor-pointer"
                >
                  <div>
                    <p className="font-medium text-gray-900">{lead.name}</p>
                    <p className="text-sm text-gray-500">
                      {CHANNEL_LABELS[lead.channel]} · {lead.interests.join(', ')}
                    </p>
                  </div>
                  <button className="px-3 py-1 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600">
                    상담하기
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 팔로업 필요 */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">팔로업 필요</h2>
            <span className="px-2 py-1 bg-orange-100 text-orange-700 text-sm rounded-full">
              {followUpLeads.length}건
            </span>
          </div>
          {followUpLeads.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <i className="fas fa-check-circle text-4xl mb-2"></i>
              <p>모든 팔로업이 완료되었습니다</p>
            </div>
          ) : (
            <div className="space-y-3">
              {followUpLeads.map(lead => (
                <div
                  key={lead.id}
                  className="flex items-center justify-between p-3 bg-orange-50 rounded-lg hover:bg-orange-100 transition-colors cursor-pointer"
                >
                  <div>
                    <p className="font-medium text-gray-900">{lead.name}</p>
                    <p className="text-sm text-gray-500">{lead.followUpNote}</p>
                  </div>
                  <div className="text-right">
                    <span className={`px-2 py-0.5 text-xs rounded-full ${STATUS_COLORS[lead.status]}`}>
                      {STATUS_LABELS[lead.status]}
                    </span>
                    <p className="text-xs text-orange-600 mt-1">
                      {lead.nextFollowUp && new Date(lead.nextFollowUp).toLocaleDateString('ko-KR')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FunnelDashboard;
