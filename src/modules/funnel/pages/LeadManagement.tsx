/**
 * 리드 관리 페이지
 * 문의 채널 통합, 리드 상태 관리, 상담 이력 등
 */

import React, { useState, useMemo } from 'react';
import {
  CHANNEL_LABELS,
  STATUS_LABELS,
  STATUS_COLORS,
  type Lead,
  type LeadChannel,
  type LeadStatus,
  type Consultation,
} from '../types';

// 임시 데이터
const MOCK_LEADS: Lead[] = [
  {
    id: '1',
    name: '김미영',
    phone: '010-1234-5678',
    email: 'kim@example.com',
    channel: 'naver_talk',
    status: 'consulting',
    interests: ['다이어트', '산후조리'],
    consultations: [
      {
        id: 'c1',
        leadId: '1',
        date: '2024-11-25',
        type: 'chat',
        summary: '산후 다이어트 관심, 가격 문의. 출산 후 3개월 경과.',
        outcome: 'positive',
        nextAction: '가격표 발송 후 연락',
        createdBy: '김상담',
        createdAt: '2024-11-25T10:30:00',
      },
    ],
    nextFollowUp: '2024-11-28',
    followUpNote: '가격 검토 후 연락 주기로 함',
    createdAt: '2024-11-25T10:00:00',
    updatedAt: '2024-11-25T10:30:00',
    assignedTo: '김상담',
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
        summary: '아이 ADHD 상담 원함. 초등 2학년 남아. 11/30 오후 2시 예약 완료.',
        outcome: 'positive',
        createdBy: '박상담',
        createdAt: '2024-11-26T14:00:00',
      },
    ],
    createdAt: '2024-11-26T13:30:00',
    updatedAt: '2024-11-26T14:00:00',
    assignedTo: '박상담',
  },
  {
    id: '3',
    name: '박지훈',
    phone: '010-3456-7890',
    channel: 'kakao',
    status: 'new',
    interests: ['허리통증', '디스크'],
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
        summary: '친구(이OO) 소개로 방문. 생리불순 + 심한 생리통. 진료 상담 후 치료 결정.',
        outcome: 'positive',
        createdBy: '원장',
        createdAt: '2024-11-24T11:00:00',
      },
    ],
    createdAt: '2024-11-24T10:00:00',
    updatedAt: '2024-11-24T11:00:00',
    assignedTo: '원장',
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
        summary: '홈페이지 문의 후 콜백. 가격 부담으로 보류. 타 한의원과 비교 중.',
        outcome: 'negative',
        createdBy: '김상담',
        createdAt: '2024-11-20T15:00:00',
      },
    ],
    createdAt: '2024-11-19T16:00:00',
    updatedAt: '2024-11-20T15:00:00',
    assignedTo: '김상담',
  },
  {
    id: '6',
    name: '한승우',
    phone: '010-6789-0123',
    channel: 'naver_booking',
    status: 'converted',
    interests: ['교통사고', '목통증'],
    consultations: [
      {
        id: 'c6',
        leadId: '6',
        date: '2024-11-22',
        type: 'phone',
        summary: '네이버 예약 확인 전화. 교통사고 후 목 통증.',
        outcome: 'positive',
        createdBy: '박상담',
        createdAt: '2024-11-22T09:30:00',
      },
      {
        id: 'c6-2',
        leadId: '6',
        date: '2024-11-23',
        type: 'visit',
        summary: '첫 방문 후 치료 시작. 주 2회 내원 예정.',
        outcome: 'positive',
        createdBy: '원장',
        createdAt: '2024-11-23T14:00:00',
      },
    ],
    createdAt: '2024-11-22T09:00:00',
    updatedAt: '2024-11-23T14:00:00',
    convertedPatientId: 12345,
    convertedAt: '2024-11-23T14:00:00',
    assignedTo: '박상담',
  },
];

const LeadManagement: React.FC = () => {
  const [leads, setLeads] = useState<Lead[]>(MOCK_LEADS);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [filterChannel, setFilterChannel] = useState<LeadChannel | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<LeadStatus | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showConsultationModal, setShowConsultationModal] = useState(false);

  // 필터링된 리드
  const filteredLeads = useMemo(() => {
    return leads.filter(lead => {
      const matchChannel = filterChannel === 'all' || lead.channel === filterChannel;
      const matchStatus = filterStatus === 'all' || lead.status === filterStatus;
      const matchSearch = searchTerm === '' ||
        lead.name.includes(searchTerm) ||
        lead.phone.includes(searchTerm) ||
        lead.interests.some(i => i.includes(searchTerm));
      return matchChannel && matchStatus && matchSearch;
    });
  }, [leads, filterChannel, filterStatus, searchTerm]);

  // 상태별 카운트
  const statusCounts = useMemo(() => {
    const counts: Record<LeadStatus | 'all', number> = {
      all: leads.length,
      new: 0,
      contacted: 0,
      consulting: 0,
      reserved: 0,
      visited: 0,
      converted: 0,
      lost: 0,
      pending: 0,
    };
    leads.forEach(lead => {
      counts[lead.status]++;
    });
    return counts;
  }, [leads]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ko-KR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getChannelIcon = (channel: LeadChannel) => {
    const icons: Record<LeadChannel, string> = {
      phone: 'fa-phone',
      website: 'fa-globe',
      kakao: 'fa-comment',
      naver_talk: 'fa-n',
      naver_booking: 'fa-calendar',
      daangn: 'fa-carrot',
      referral: 'fa-user-group',
      walk_in: 'fa-door-open',
      other: 'fa-circle-question',
    };
    return icons[channel];
  };

  return (
    <div className="h-full flex">
      {/* 좌측: 리드 목록 */}
      <div className="w-[450px] border-r bg-white flex flex-col">
        {/* 검색 및 필터 */}
        <div className="p-4 border-b space-y-3">
          {/* 검색 */}
          <div className="relative">
            <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
            <input
              type="text"
              placeholder="이름, 전화번호, 관심분야 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500"
            />
          </div>

          {/* 필터 */}
          <div className="flex gap-2">
            <select
              value={filterChannel}
              onChange={(e) => setFilterChannel(e.target.value as LeadChannel | 'all')}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-purple-500"
            >
              <option value="all">전체 채널</option>
              {Object.entries(CHANNEL_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as LeadStatus | 'all')}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-purple-500"
            >
              <option value="all">전체 상태 ({statusCounts.all})</option>
              {Object.entries(STATUS_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label} ({statusCounts[key as LeadStatus]})
                </option>
              ))}
            </select>
          </div>

          {/* 리드 추가 버튼 */}
          <button
            onClick={() => setShowAddModal(true)}
            className="w-full py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors flex items-center justify-center gap-2"
          >
            <i className="fas fa-plus"></i>
            <span>새 리드 등록</span>
          </button>
        </div>

        {/* 리드 목록 */}
        <div className="flex-1 overflow-auto">
          {filteredLeads.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              <i className="fas fa-user-slash text-4xl mb-4"></i>
              <p>조건에 맞는 리드가 없습니다</p>
            </div>
          ) : (
            filteredLeads.map(lead => (
              <div
                key={lead.id}
                onClick={() => setSelectedLead(lead)}
                className={`p-4 border-b cursor-pointer transition-colors ${
                  selectedLead?.id === lead.id
                    ? 'bg-purple-50 border-l-4 border-l-purple-500'
                    : 'hover:bg-gray-50'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      lead.status === 'new' ? 'bg-blue-100 text-blue-600' :
                      lead.status === 'converted' ? 'bg-green-100 text-green-600' :
                      lead.status === 'lost' ? 'bg-red-100 text-red-600' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      <i className={`fas ${getChannelIcon(lead.channel)}`}></i>
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">{lead.name}</div>
                      <div className="text-sm text-gray-500">{lead.phone}</div>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 text-xs rounded-full ${STATUS_COLORS[lead.status]}`}>
                    {STATUS_LABELS[lead.status]}
                  </span>
                </div>

                <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                  <span className="px-2 py-0.5 bg-gray-100 rounded">{CHANNEL_LABELS[lead.channel]}</span>
                  {lead.interests.slice(0, 2).map(interest => (
                    <span key={interest} className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded">
                      {interest}
                    </span>
                  ))}
                </div>

                {lead.nextFollowUp && new Date(lead.nextFollowUp) <= new Date() && lead.status !== 'converted' && lead.status !== 'lost' && (
                  <div className="mt-2 text-xs text-orange-600 flex items-center gap-1">
                    <i className="fas fa-bell"></i>
                    <span>팔로업 필요</span>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* 우측: 상세 정보 */}
      <div className="flex-1 bg-gray-50 overflow-auto">
        {selectedLead ? (
          <div className="p-6">
            {/* 리드 정보 헤더 */}
            <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl ${
                    selectedLead.status === 'new' ? 'bg-blue-100 text-blue-600' :
                    selectedLead.status === 'converted' ? 'bg-green-100 text-green-600' :
                    selectedLead.status === 'lost' ? 'bg-red-100 text-red-600' :
                    'bg-purple-100 text-purple-600'
                  }`}>
                    <i className={`fas ${getChannelIcon(selectedLead.channel)}`}></i>
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">{selectedLead.name}</h2>
                    <div className="flex items-center gap-4 mt-1 text-gray-500">
                      <span><i className="fas fa-phone mr-1"></i>{selectedLead.phone}</span>
                      {selectedLead.email && (
                        <span><i className="fas fa-envelope mr-1"></i>{selectedLead.email}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={selectedLead.status}
                    onChange={(e) => {
                      const newStatus = e.target.value as LeadStatus;
                      setLeads(prev => prev.map(l =>
                        l.id === selectedLead.id ? { ...l, status: newStatus, updatedAt: new Date().toISOString() } : l
                      ));
                      setSelectedLead({ ...selectedLead, status: newStatus });
                    }}
                    className={`px-3 py-2 rounded-lg border-2 font-medium ${STATUS_COLORS[selectedLead.status]}`}
                  >
                    {Object.entries(STATUS_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 관심 분야 */}
              <div className="mt-4 flex items-center gap-2">
                <span className="text-sm text-gray-500">관심 분야:</span>
                {selectedLead.interests.map(interest => (
                  <span key={interest} className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm">
                    {interest}
                  </span>
                ))}
              </div>

              {/* 메타 정보 */}
              <div className="mt-4 pt-4 border-t grid grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">유입 채널</span>
                  <p className="font-medium">{CHANNEL_LABELS[selectedLead.channel]}</p>
                </div>
                <div>
                  <span className="text-gray-500">등록일</span>
                  <p className="font-medium">{formatDate(selectedLead.createdAt)}</p>
                </div>
                <div>
                  <span className="text-gray-500">담당자</span>
                  <p className="font-medium">{selectedLead.assignedTo || '-'}</p>
                </div>
                <div>
                  <span className="text-gray-500">다음 팔로업</span>
                  <p className={`font-medium ${selectedLead.nextFollowUp && new Date(selectedLead.nextFollowUp) <= new Date() ? 'text-orange-600' : ''}`}>
                    {selectedLead.nextFollowUp
                      ? new Date(selectedLead.nextFollowUp).toLocaleDateString('ko-KR')
                      : '-'}
                  </p>
                </div>
              </div>

              {/* 액션 버튼 */}
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => setShowConsultationModal(true)}
                  className="flex-1 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors flex items-center justify-center gap-2"
                >
                  <i className="fas fa-comment-dots"></i>
                  <span>상담 기록 추가</span>
                </button>
                <button className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors">
                  <i className="fas fa-phone"></i>
                </button>
                <button className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors">
                  <i className="fas fa-comment"></i>
                </button>
                <button className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors">
                  <i className="fas fa-calendar-plus"></i>
                </button>
              </div>
            </div>

            {/* 상담 이력 */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">
                상담 이력 ({selectedLead.consultations.length})
              </h3>

              {selectedLead.consultations.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <i className="fas fa-comments text-4xl mb-2"></i>
                  <p>아직 상담 기록이 없습니다</p>
                  <button
                    onClick={() => setShowConsultationModal(true)}
                    className="mt-4 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600"
                  >
                    첫 상담 기록 추가
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {selectedLead.consultations.sort((a, b) =>
                    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                  ).map(consultation => (
                    <div
                      key={consultation.id}
                      className={`p-4 rounded-lg border-l-4 ${
                        consultation.outcome === 'positive' ? 'bg-green-50 border-green-500' :
                        consultation.outcome === 'negative' ? 'bg-red-50 border-red-500' :
                        consultation.outcome === 'no_answer' ? 'bg-gray-50 border-gray-400' :
                        'bg-blue-50 border-blue-500'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <i className={`fas ${
                            consultation.type === 'phone' ? 'fa-phone' :
                            consultation.type === 'chat' ? 'fa-comment' :
                            consultation.type === 'visit' ? 'fa-door-open' :
                            'fa-envelope'
                          } text-gray-500`}></i>
                          <span className="text-sm font-medium text-gray-700">
                            {consultation.type === 'phone' ? '전화 상담' :
                             consultation.type === 'chat' ? '채팅 상담' :
                             consultation.type === 'visit' ? '방문 상담' :
                             '메시지'}
                          </span>
                          <span className={`px-2 py-0.5 text-xs rounded ${
                            consultation.outcome === 'positive' ? 'bg-green-200 text-green-800' :
                            consultation.outcome === 'negative' ? 'bg-red-200 text-red-800' :
                            consultation.outcome === 'no_answer' ? 'bg-gray-200 text-gray-800' :
                            'bg-blue-200 text-blue-800'
                          }`}>
                            {consultation.outcome === 'positive' ? '긍정적' :
                             consultation.outcome === 'negative' ? '부정적' :
                             consultation.outcome === 'no_answer' ? '부재중' :
                             '보통'}
                          </span>
                        </div>
                        <span className="text-xs text-gray-500">
                          {formatDate(consultation.createdAt)} · {consultation.createdBy}
                        </span>
                      </div>
                      <p className="text-gray-800">{consultation.summary}</p>
                      {consultation.nextAction && (
                        <p className="mt-2 text-sm text-purple-600">
                          <i className="fas fa-arrow-right mr-1"></i>
                          {consultation.nextAction}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-gray-400">
            <div className="text-center">
              <i className="fas fa-user-plus text-6xl mb-4 opacity-30"></i>
              <p className="text-lg">왼쪽에서 리드를 선택하세요</p>
              <p className="text-sm mt-2">상담 이력과 상세 정보를 확인할 수 있습니다</p>
            </div>
          </div>
        )}
      </div>

      {/* 리드 추가 모달 */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-[500px] max-h-[90vh] overflow-auto">
            <div className="p-6 border-b">
              <h3 className="text-xl font-bold">새 리드 등록</h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">이름 *</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500"
                  placeholder="홍길동"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">전화번호 *</label>
                <input
                  type="tel"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500"
                  placeholder="010-0000-0000"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">이메일</label>
                <input
                  type="email"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500"
                  placeholder="email@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">유입 채널 *</label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500">
                  {Object.entries(CHANNEL_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">관심 분야</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500"
                  placeholder="다이어트, ADHD, 통증 등 (쉼표로 구분)"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">메모</label>
                <textarea
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500"
                  rows={3}
                  placeholder="첫 상담 내용이나 특이사항..."
                />
              </div>
            </div>
            <div className="p-6 border-t flex justify-end gap-2">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                취소
              </button>
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600"
              >
                등록
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 상담 기록 추가 모달 */}
      {showConsultationModal && selectedLead && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-[500px] max-h-[90vh] overflow-auto">
            <div className="p-6 border-b">
              <h3 className="text-xl font-bold">{selectedLead.name}님 상담 기록</h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">상담 유형</label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500">
                  <option value="phone">전화 상담</option>
                  <option value="chat">채팅 상담</option>
                  <option value="visit">방문 상담</option>
                  <option value="message">메시지</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">상담 결과</label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500">
                  <option value="positive">긍정적</option>
                  <option value="neutral">보통</option>
                  <option value="negative">부정적</option>
                  <option value="no_answer">부재중</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">상담 내용 *</label>
                <textarea
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500"
                  rows={4}
                  placeholder="상담 내용을 자세히 기록해주세요..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">다음 액션</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500"
                  placeholder="예: 3일 후 재연락, 가격표 발송 등"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">팔로업 예정일</label>
                <input
                  type="date"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>
            <div className="p-6 border-t flex justify-end gap-2">
              <button
                onClick={() => setShowConsultationModal(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                취소
              </button>
              <button
                onClick={() => setShowConsultationModal(false)}
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

export default LeadManagement;
