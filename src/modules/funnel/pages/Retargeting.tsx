/**
 * 리타겟팅 관리 페이지
 * 이탈 리드 관리, 자동 팔로업, 리타겟팅 캠페인
 */

import React, { useState, useMemo } from 'react';
import {
  STATUS_LABELS,
  STATUS_COLORS,
  CHANNEL_LABELS,
  type Lead,
  type LeadStatus,
  type RetargetingRule,
} from '../types';
import { getCurrentDate } from '@shared/lib/postgres';

// 임시 이탈 리드 데이터
const MOCK_LOST_LEADS: Lead[] = [
  {
    id: '1',
    name: '정다혜',
    phone: '010-5678-9012',
    channel: 'website',
    status: 'lost',
    interests: ['다이어트'],
    consultations: [
      {
        id: 'c1',
        leadId: '1',
        date: '2024-11-20',
        type: 'phone',
        summary: '가격 부담으로 보류. 타 한의원과 비교 중이라고 함.',
        outcome: 'negative',
        createdBy: '김상담',
        createdAt: '2024-11-20T15:00:00',
      },
    ],
    createdAt: '2024-11-19T16:00:00',
    updatedAt: '2024-11-20T15:00:00',
  },
  {
    id: '2',
    name: '김태영',
    phone: '010-1111-2222',
    channel: 'kakao',
    status: 'lost',
    interests: ['ADHD', '소아'],
    consultations: [
      {
        id: 'c2',
        leadId: '2',
        date: '2024-11-15',
        type: 'chat',
        summary: '아이 진료 문의 후 연락 두절. 2회 콜백했으나 부재중.',
        outcome: 'no_answer',
        createdBy: '박상담',
        createdAt: '2024-11-15T14:00:00',
      },
    ],
    createdAt: '2024-11-10T10:00:00',
    updatedAt: '2024-11-15T14:00:00',
  },
  {
    id: '3',
    name: '이민수',
    phone: '010-3333-4444',
    channel: 'naver_booking',
    status: 'lost',
    interests: ['허리통증'],
    consultations: [
      {
        id: 'c3',
        leadId: '3',
        date: '2024-11-18',
        type: 'phone',
        summary: '예약 후 노쇼. 연락 시 일정 조율 어렵다고 함.',
        outcome: 'negative',
        createdBy: '김상담',
        createdAt: '2024-11-18T10:00:00',
      },
    ],
    createdAt: '2024-11-16T09:00:00',
    updatedAt: '2024-11-18T10:00:00',
  },
];

// 팔로업 대기 리드
const MOCK_PENDING_FOLLOWUP: Lead[] = [
  {
    id: '4',
    name: '김미영',
    phone: '010-1234-5678',
    channel: 'naver_talk',
    status: 'consulting',
    interests: ['다이어트', '산후조리'],
    consultations: [],
    nextFollowUp: '2024-11-28',
    followUpNote: '가격 검토 후 연락 주기로 함',
    createdAt: '2024-11-25T10:00:00',
    updatedAt: '2024-11-25T10:30:00',
  },
  {
    id: '5',
    name: '박서연',
    phone: '010-5555-6666',
    channel: 'phone',
    status: 'contacted',
    interests: ['부인과'],
    consultations: [],
    nextFollowUp: '2024-11-27',
    followUpNote: '남편과 상의 후 결정하겠다고 함',
    createdAt: '2024-11-24T14:00:00',
    updatedAt: '2024-11-24T14:00:00',
  },
];

// 리타겟팅 규칙
const MOCK_RULES: RetargetingRule[] = [
  {
    id: '1',
    name: '이탈 3일 후 리마인드',
    description: '이탈 상태로 변경 후 3일 후 할인 안내 문자 발송',
    triggerStatus: 'lost',
    daysSinceTrigger: 3,
    actionType: 'message',
    messageTemplate: '[연이재한의원] {name}님, 지난번 문의 감사했습니다. 혹시 추가 궁금하신 점이 있으시면 편하게 연락주세요. 이번 달 신규 환자 혜택도 준비되어 있습니다.',
    isActive: true,
    createdAt: '2024-10-01T10:00:00',
    updatedAt: '2024-10-01T10:00:00',
  },
  {
    id: '2',
    name: '예약 노쇼 팔로업',
    description: '예약 후 방문하지 않은 환자에게 재예약 안내',
    triggerStatus: 'reserved',
    daysSinceTrigger: 1,
    actionType: 'call',
    isActive: true,
    createdAt: '2024-10-01T10:00:00',
    updatedAt: '2024-10-01T10:00:00',
  },
  {
    id: '3',
    name: '상담 후 미결정 7일',
    description: '상담 후 7일간 결정하지 않은 리드에게 팔로업',
    triggerStatus: 'consulting',
    daysSinceTrigger: 7,
    actionType: 'message',
    messageTemplate: '[연이재한의원] {name}님, 지난 상담은 도움이 되셨나요? 궁금하신 점이 있으시면 언제든 연락주세요.',
    isActive: false,
    createdAt: '2024-10-15T10:00:00',
    updatedAt: '2024-10-15T10:00:00',
  },
];

const Retargeting: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'lost' | 'followup' | 'rules'>('lost');
  const [lostLeads] = useState<Lead[]>(MOCK_LOST_LEADS);
  const [pendingFollowup] = useState<Lead[]>(MOCK_PENDING_FOLLOWUP);
  const [rules, setRules] = useState<RetargetingRule[]>(MOCK_RULES);
  const [showRuleEditor, setShowRuleEditor] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  // 오늘 팔로업 필요 수
  const todayFollowupCount = useMemo(() => {
    const today = getCurrentDate();
    return pendingFollowup.filter(lead =>
      lead.nextFollowUp && lead.nextFollowUp <= today
    ).length;
  }, [pendingFollowup]);

  // 이탈 원인 분석
  const lostReasons = useMemo(() => {
    return {
      price: lostLeads.filter(l => l.consultations.some(c => c.summary.includes('가격') || c.summary.includes('비용'))).length,
      noAnswer: lostLeads.filter(l => l.consultations.some(c => c.outcome === 'no_answer')).length,
      competitor: lostLeads.filter(l => l.consultations.some(c => c.summary.includes('타') || c.summary.includes('비교'))).length,
      schedule: lostLeads.filter(l => l.consultations.some(c => c.summary.includes('일정') || c.summary.includes('시간'))).length,
    };
  }, [lostLeads]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ko-KR', {
      month: 'short',
      day: 'numeric',
    });
  };

  const daysSince = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* 상단 통계 */}
      <div className="p-4 bg-white border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                <i className="fas fa-user-xmark text-red-600"></i>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{lostLeads.length}</p>
                <p className="text-xs text-gray-500">이탈 리드</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                <i className="fas fa-bell text-orange-600"></i>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{todayFollowupCount}</p>
                <p className="text-xs text-gray-500">오늘 팔로업</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <i className="fas fa-robot text-purple-600"></i>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{rules.filter(r => r.isActive).length}</p>
                <p className="text-xs text-gray-500">활성 규칙</p>
              </div>
            </div>
          </div>

          {/* 이탈 원인 분석 */}
          <div className="flex items-center gap-4 px-4 py-2 bg-gray-50 rounded-lg">
            <span className="text-sm text-gray-500">이탈 원인:</span>
            <div className="flex items-center gap-3 text-sm">
              <span className="text-red-600">가격 {lostReasons.price}</span>
              <span className="text-orange-600">부재중 {lostReasons.noAnswer}</span>
              <span className="text-blue-600">경쟁사 {lostReasons.competitor}</span>
              <span className="text-gray-600">일정 {lostReasons.schedule}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 탭 네비게이션 */}
      <div className="bg-white border-b">
        <div className="flex">
          <button
            onClick={() => setActiveTab('lost')}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'lost'
                ? 'text-purple-600 border-purple-600'
                : 'text-gray-500 border-transparent hover:text-gray-700'
            }`}
          >
            <i className="fas fa-user-xmark mr-2"></i>
            이탈 리드 ({lostLeads.length})
          </button>
          <button
            onClick={() => setActiveTab('followup')}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'followup'
                ? 'text-purple-600 border-purple-600'
                : 'text-gray-500 border-transparent hover:text-gray-700'
            }`}
          >
            <i className="fas fa-clock mr-2"></i>
            팔로업 대기 ({pendingFollowup.length})
          </button>
          <button
            onClick={() => setActiveTab('rules')}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'rules'
                ? 'text-purple-600 border-purple-600'
                : 'text-gray-500 border-transparent hover:text-gray-700'
            }`}
          >
            <i className="fas fa-gears mr-2"></i>
            자동화 규칙 ({rules.length})
          </button>
        </div>
      </div>

      {/* 컨텐츠 */}
      <div className="flex-1 overflow-auto p-4">
        {activeTab === 'lost' && (
          <div className="grid grid-cols-3 gap-4">
            {lostLeads.map(lead => (
              <div
                key={lead.id}
                className="bg-white rounded-xl shadow-sm p-5 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-gray-900">{lead.name}</h3>
                    <p className="text-sm text-gray-500">{lead.phone}</p>
                  </div>
                  <span className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
                    {daysSince(lead.updatedAt)}일 전 이탈
                  </span>
                </div>

                <div className="flex flex-wrap gap-2 mb-4">
                  <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                    {CHANNEL_LABELS[lead.channel]}
                  </span>
                  {lead.interests.map(interest => (
                    <span key={interest} className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded">
                      {interest}
                    </span>
                  ))}
                </div>

                {lead.consultations[0] && (
                  <div className="bg-gray-50 rounded-lg p-3 mb-4">
                    <p className="text-sm text-gray-700 line-clamp-2">{lead.consultations[0].summary}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {formatDate(lead.consultations[0].createdAt)} · {lead.consultations[0].createdBy}
                    </p>
                  </div>
                )}

                <div className="flex gap-2">
                  <button className="flex-1 py-2 bg-purple-500 text-white text-sm rounded-lg hover:bg-purple-600">
                    <i className="fas fa-phone mr-1"></i>연락하기
                  </button>
                  <button className="flex-1 py-2 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600">
                    <i className="fas fa-message mr-1"></i>문자
                  </button>
                  <button className="px-3 py-2 bg-gray-100 text-gray-600 text-sm rounded-lg hover:bg-gray-200">
                    <i className="fas fa-rotate"></i>
                  </button>
                </div>
              </div>
            ))}

            {lostLeads.length === 0 && (
              <div className="col-span-3 text-center py-12 text-gray-400">
                <i className="fas fa-check-circle text-5xl mb-4"></i>
                <p className="text-lg">이탈 리드가 없습니다</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'followup' && (
          <div className="space-y-4">
            {/* 오늘 팔로업 */}
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                <i className="fas fa-bell text-orange-500"></i>
                오늘 팔로업 필요
              </h3>
              <div className="grid grid-cols-2 gap-4">
                {pendingFollowup
                  .filter(lead => lead.nextFollowUp && lead.nextFollowUp <= getCurrentDate())
                  .map(lead => (
                    <div
                      key={lead.id}
                      className="bg-orange-50 border border-orange-200 rounded-xl p-4"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-medium text-gray-900">{lead.name}</h4>
                          <p className="text-sm text-gray-500">{lead.phone}</p>
                        </div>
                        <span className={`px-2 py-0.5 text-xs rounded-full ${STATUS_COLORS[lead.status]}`}>
                          {STATUS_LABELS[lead.status]}
                        </span>
                      </div>
                      <p className="text-sm text-orange-700 mt-3 bg-orange-100 p-2 rounded">
                        <i className="fas fa-note-sticky mr-1"></i>
                        {lead.followUpNote}
                      </p>
                      <div className="flex gap-2 mt-3">
                        <button className="flex-1 py-2 bg-orange-500 text-white text-sm rounded-lg hover:bg-orange-600">
                          <i className="fas fa-phone mr-1"></i>지금 연락
                        </button>
                        <button className="px-3 py-2 bg-gray-100 text-gray-600 text-sm rounded-lg hover:bg-gray-200">
                          미루기
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* 예정된 팔로업 */}
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                <i className="fas fa-calendar text-blue-500"></i>
                예정된 팔로업
              </h3>
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">이름</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">연락처</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">상태</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">메모</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">예정일</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">액션</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {pendingFollowup
                      .filter(lead => lead.nextFollowUp && lead.nextFollowUp > getCurrentDate())
                      .map(lead => (
                        <tr key={lead.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-900">{lead.name}</td>
                          <td className="px-4 py-3 text-gray-600">{lead.phone}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 text-xs rounded-full ${STATUS_COLORS[lead.status]}`}>
                              {STATUS_LABELS[lead.status]}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">{lead.followUpNote}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{formatDate(lead.nextFollowUp!)}</td>
                          <td className="px-4 py-3">
                            <button className="text-purple-600 hover:text-purple-800 text-sm">
                              <i className="fas fa-phone mr-1"></i>연락
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'rules' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">자동화 규칙</h3>
              <button
                onClick={() => setShowRuleEditor(true)}
                className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600"
              >
                <i className="fas fa-plus mr-2"></i>새 규칙 추가
              </button>
            </div>

            <div className="space-y-4">
              {rules.map(rule => (
                <div
                  key={rule.id}
                  className={`bg-white rounded-xl shadow-sm p-5 border-l-4 ${
                    rule.isActive ? 'border-green-500' : 'border-gray-300'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-3">
                        <h4 className="font-bold text-gray-900">{rule.name}</h4>
                        <span className={`px-2 py-0.5 text-xs rounded-full ${
                          rule.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {rule.isActive ? '활성' : '비활성'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">{rule.description}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setRules(prev => prev.map(r =>
                            r.id === rule.id ? { ...r, isActive: !r.isActive } : r
                          ));
                        }}
                        className={`relative w-12 h-6 rounded-full transition-colors ${
                          rule.isActive ? 'bg-green-500' : 'bg-gray-300'
                        }`}
                      >
                        <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                          rule.isActive ? 'left-7' : 'left-1'
                        }`} />
                      </button>
                      <button className="p-2 text-gray-400 hover:text-gray-600">
                        <i className="fas fa-ellipsis-vertical"></i>
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center gap-6 text-sm">
                    <div className="flex items-center gap-2">
                      <i className="fas fa-trigger text-gray-400"></i>
                      <span className="text-gray-600">트리거:</span>
                      <span className={`px-2 py-0.5 rounded ${STATUS_COLORS[rule.triggerStatus]}`}>
                        {STATUS_LABELS[rule.triggerStatus]}
                      </span>
                      <span className="text-gray-600">상태 후 {rule.daysSinceTrigger}일</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <i className="fas fa-bolt text-gray-400"></i>
                      <span className="text-gray-600">액션:</span>
                      <span className={`px-2 py-0.5 rounded ${
                        rule.actionType === 'message' ? 'bg-blue-100 text-blue-700' :
                        rule.actionType === 'call' ? 'bg-green-100 text-green-700' :
                        'bg-purple-100 text-purple-700'
                      }`}>
                        {rule.actionType === 'message' ? '문자 발송' :
                         rule.actionType === 'call' ? '전화 알림' : '이메일'}
                      </span>
                    </div>
                  </div>

                  {rule.messageTemplate && (
                    <div className="mt-4 bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500 mb-1">메시지 템플릿</p>
                      <p className="text-sm text-gray-700">{rule.messageTemplate}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 규칙 에디터 모달 */}
      {showRuleEditor && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-[600px] max-h-[90vh] overflow-auto">
            <div className="p-6 border-b">
              <h3 className="text-xl font-bold">새 자동화 규칙</h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">규칙 이름 *</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500"
                  placeholder="예: 이탈 3일 후 리마인드"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">설명</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500"
                  placeholder="규칙에 대한 간단한 설명"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">트리거 상태 *</label>
                  <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500">
                    {Object.entries(STATUS_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">경과 일수 *</label>
                  <input
                    type="number"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500"
                    placeholder="3"
                    min={1}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">액션 유형 *</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="actionType" value="message" className="text-purple-500" defaultChecked />
                    <span>문자 발송</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="actionType" value="call" className="text-purple-500" />
                    <span>전화 알림</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="actionType" value="email" className="text-purple-500" />
                    <span>이메일</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">메시지 템플릿</label>
                <textarea
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500"
                  rows={4}
                  placeholder="[연이재한의원] {name}님, ..."
                />
                <p className="text-xs text-gray-500 mt-1">
                  사용 가능한 변수: {'{name}'}, {'{phone}'}, {'{interest}'}
                </p>
              </div>
            </div>
            <div className="p-6 border-t flex justify-end gap-2">
              <button
                onClick={() => setShowRuleEditor(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                취소
              </button>
              <button
                onClick={() => setShowRuleEditor(false)}
                className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600"
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Retargeting;
