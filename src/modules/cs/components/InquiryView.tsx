import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { PortalUser } from '@shared/types';
import { useInquiries } from '../hooks/useInquiries';
import { searchLocalPatients, type LocalPatient } from '../lib/patientSync';
import { getHandlers, type CsHandler } from '../lib/api';
import type { Inquiry, CreateInquiryRequest, InquiryChannel, InquiryType, InquiryStatus } from '../types';
import { CHANNEL_LABELS, CHANNEL_ICONS, INQUIRY_TYPE_LABELS, STATUS_LABELS, STATUS_COLORS } from '../types';

interface InquiryViewProps {
  user: PortalUser;
}

// 상대시간 포맷
function formatRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return '방금';
  if (diffMin < 60) return `${diffMin}분 전`;
  if (diffHour < 24) return `${diffHour}시간 전`;
  if (diffDay === 1) return '어제';
  if (diffDay < 7) return `${diffDay}일 전`;
  return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}

function InquiryView({ user }: InquiryViewProps) {
  const {
    inquiries,
    isLoading,
    error,
    selectedDate,
    setSelectedDate,
    dateViewMode,
    setDateViewMode,
    loadInquiries,
    createInquiry,
    updateInquiry,
    updateStatus,
    deleteInquiry,
    matchPatient,
  } = useInquiries();

  const [showForm, setShowForm] = useState(false);
  const [editingInquiry, setEditingInquiry] = useState<Inquiry | null>(null);
  const [channelFilter, setChannelFilter] = useState<InquiryChannel | null>(null);
  const [handlers, setHandlers] = useState<CsHandler[]>([]);

  useEffect(() => {
    const loadHandlers = async () => {
      try {
        const list = await getHandlers(true);
        setHandlers(list);
      } catch (err) {
        console.error('담당자 목록 로드 실패:', err);
      }
    };
    loadHandlers();
  }, []);

  // 환자 매칭 팝업 상태
  const [matchingInquiryId, setMatchingInquiryId] = useState<number | null>(null);
  const [matchSearch, setMatchSearch] = useState('');
  const [matchResults, setMatchResults] = useState<LocalPatient[]>([]);
  const [isMatchSearching, setIsMatchSearching] = useState(false);
  const matchPopupRef = useRef<HTMLDivElement>(null);
  const matchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 환자 매칭 검색 (디바운스)
  const handleMatchSearch = useCallback((term: string) => {
    setMatchSearch(term);
    if (matchDebounceRef.current) clearTimeout(matchDebounceRef.current);
    if (term.trim().length < 2) {
      setMatchResults([]);
      return;
    }
    matchDebounceRef.current = setTimeout(async () => {
      setIsMatchSearching(true);
      try {
        const results = await searchLocalPatients(term.trim());
        setMatchResults(results);
      } catch { setMatchResults([]); }
      finally { setIsMatchSearching(false); }
    }, 300);
  }, []);

  // 환자 선택으로 매칭 완료
  const handleMatchSelect = async (patient: LocalPatient) => {
    if (matchingInquiryId === null) return;
    try {
      await matchPatient(matchingInquiryId, patient.id);
    } catch { alert('환자 매칭에 실패했습니다.'); }
    closeMatchPopup();
  };

  // 매칭 해제
  const handleUnmatch = async (inquiryId: number) => {
    try {
      await matchPatient(inquiryId, null);
    } catch { alert('매칭 해제에 실패했습니다.'); }
  };

  const closeMatchPopup = () => {
    setMatchingInquiryId(null);
    setMatchSearch('');
    setMatchResults([]);
  };

  // 팝업 외부 클릭으로 닫기
  useEffect(() => {
    if (matchingInquiryId === null) return;
    const handleClick = (e: MouseEvent) => {
      if (matchPopupRef.current && !matchPopupRef.current.contains(e.target as Node)) {
        closeMatchPopup();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [matchingInquiryId]);

  // 폼 상태
  const [formData, setFormData] = useState<CreateInquiryRequest>({
    channel: 'phone',
    inquiry_type: 'new_patient',
    content: '',
    patient_name: '',
    contact: '',
    response: '',
    staff_name: user.name,
    handler_name: '',
  });

  const getInitialFormData = (): CreateInquiryRequest => ({
    channel: 'phone',
    inquiry_type: 'new_patient',
    content: '',
    patient_name: '',
    contact: '',
    response: '',
    staff_name: user.name,
    handler_name: '',
  });

  const resetForm = () => {
    setFormData(getInitialFormData());
    setEditingInquiry(null);
  };

  const closeForm = () => {
    setShowForm(false);
    resetForm();
  };

  const validateForm = (): boolean => {
    if (!formData.content.trim()) {
      alert('문의 내용을 입력해주세요.');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    try {
      if (editingInquiry) {
        await updateInquiry(editingInquiry.id, formData);
      } else {
        await createInquiry(formData);
      }
      closeForm();
    } catch (err) {
      alert(editingInquiry ? '문의 수정에 실패했습니다.' : '문의 등록에 실패했습니다.');
    }
  };

  const handleEdit = (inquiry: Inquiry) => {
    setEditingInquiry(inquiry);
    setFormData({
      channel: inquiry.channel,
      inquiry_type: inquiry.inquiry_type,
      content: inquiry.content,
      patient_name: inquiry.patient_name || '',
      contact: inquiry.contact || '',
      response: inquiry.response || '',
      staff_name: inquiry.staff_name || user.name,
      handler_name: inquiry.handler_name || '',
    });
    setShowForm(true);
  };

  const handleStatusChange = async (id: number, status: InquiryStatus) => {
    try {
      await updateStatus(id, status);
    } catch (err) {
      alert('상태 변경에 실패했습니다.');
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('이 문의를 삭제하시겠습니까?')) return;
    try {
      await deleteInquiry(id);
    } catch (err) {
      alert('삭제에 실패했습니다.');
    }
  };

  // 채널 필터 적용
  const filtered = channelFilter
    ? inquiries.filter(inq => inq.channel === channelFilter)
    : inquiries;

  // 컬럼별 분류
  const pendingItems = filtered.filter(inq => inq.status === 'pending');
  const inProgressItems = filtered.filter(inq => inq.status === 'in_progress');
  const doneItems = filtered.filter(inq => inq.status === 'completed' || inq.status === 'converted');

  const CHANNELS: InquiryChannel[] = ['phone', 'kakao', 'visit', 'naver'];

  // 칸반 카드 렌더링
  const renderCard = (inquiry: Inquiry) => (
    <div key={inquiry.id} className="kanban-card">
      <div className="kanban-card-top">
        <span className="channel-badge">
          {CHANNEL_ICONS[inquiry.channel]} {CHANNEL_LABELS[inquiry.channel]}
        </span>
        <span className="type-badge">
          {INQUIRY_TYPE_LABELS[inquiry.inquiry_type]}
        </span>
        <span className="kanban-card-time">{formatRelativeTime(inquiry.created_at)}</span>
        {(inquiry.status === 'completed' || inquiry.status === 'converted') && inquiry.completed_at && (
          <span className="kanban-card-completed">
            완료 {new Date(inquiry.completed_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
          </span>
        )}
      </div>

      {/* 환자 매칭 배지 */}
      {inquiry.matched_patient_name && (
        <div className="inquiry-matched-badge">
          <span className="matched-icon">👤</span>
          <span className="matched-name">{inquiry.matched_patient_name}</span>
          {inquiry.matched_chart_number && (
            <span className="matched-chart">{inquiry.matched_chart_number}</span>
          )}
          <button
            className="matched-unlink"
            onClick={() => handleUnmatch(inquiry.id)}
            title="매칭 해제"
          >
            &times;
          </button>
        </div>
      )}

      {/* 발신자 */}
      {inquiry.patient_name && (
        <div className="kanban-card-sender">
          <strong>{inquiry.patient_name}</strong>
          {inquiry.contact && <span>{inquiry.contact}</span>}
        </div>
      )}

      {/* 내용 미리보기 */}
      <p className="kanban-card-content">{inquiry.content}</p>

      {/* 응대 내용 */}
      {inquiry.response && (
        <p className="kanban-card-response">
          <span>응대:</span> {inquiry.response}
        </p>
      )}

      {/* 하단: 담당자 + 액션 */}
      <div className="kanban-card-footer">
        <span className="staff-name">{inquiry.handler_name || inquiry.staff_name || '-'}</span>
        <div className="kanban-card-actions">
          {/* 환자 매칭 */}
          {!inquiry.patient_id && (
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <button
                className="action-btn match"
                onClick={() => setMatchingInquiryId(inquiry.id)}
              >
                매칭
              </button>
              {matchingInquiryId === inquiry.id && (
                <div className="match-popup" ref={matchPopupRef}>
                  <input
                    type="text"
                    className="match-popup-input"
                    placeholder="환자 검색 (이름/차트번호/전화번호)"
                    value={matchSearch}
                    onChange={(e) => handleMatchSearch(e.target.value)}
                    autoFocus
                  />
                  <div className="match-popup-results">
                    {isMatchSearching && (
                      <div className="match-popup-empty">검색 중...</div>
                    )}
                    {!isMatchSearching && matchSearch.length >= 2 && matchResults.length === 0 && (
                      <div className="match-popup-empty">검색 결과 없음</div>
                    )}
                    {matchResults.map((p) => (
                      <div
                        key={p.id}
                        className="match-popup-item"
                        onClick={() => handleMatchSelect(p)}
                      >
                        <span className="match-item-name">{p.name}</span>
                        <span className="match-item-chart">{p.chart_number || '-'}</span>
                        <span className="match-item-phone">{p.phone || ''}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 상태 전이 버튼 */}
          {inquiry.status === 'pending' && (
            <button
              className="action-btn in-progress"
              onClick={() => handleStatusChange(inquiry.id, 'in_progress')}
            >
              응대시작
            </button>
          )}
          {inquiry.status === 'in_progress' && (
            <>
              <button
                className="action-btn complete"
                onClick={() => handleStatusChange(inquiry.id, 'completed')}
              >
                완료
              </button>
              <button
                className="action-btn convert"
                onClick={() => handleStatusChange(inquiry.id, 'converted')}
              >
                예약전환
              </button>
            </>
          )}
          {(inquiry.status === 'completed' || inquiry.status === 'converted') && (
            <button
              className="action-btn revert"
              onClick={() => handleStatusChange(inquiry.id, 'pending')}
            >
              되돌리기
            </button>
          )}
          <button className="action-btn edit" onClick={() => handleEdit(inquiry)}>
            수정
          </button>
          <button className="action-btn delete" onClick={() => handleDelete(inquiry.id)}>
            삭제
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="inquiry-view inbound-kanban-layout">
      {/* 헤더 */}
      <div className="inbound-header">
        <div className="header-left">
          <h2>인바운드 문의</h2>
          <div className="header-stats">
            <span className="stat-item pending">
              <i className="fa-solid fa-clock"></i>
              접수 {pendingItems.length}
            </span>
            <span className="stat-item in-progress">
              <i className="fa-solid fa-headset"></i>
              응대중 {inProgressItems.length}
            </span>
            <span className="stat-item completed">
              <i className="fa-solid fa-check"></i>
              완료 {doneItems.length}
            </span>
          </div>
        </div>
        <div className="header-center">
          <button
            className="date-nav-btn"
            onClick={() => {
              const d = new Date(selectedDate);
              d.setDate(d.getDate() - 1);
              setSelectedDate(d.toISOString().split('T')[0]);
            }}
          >
            <i className="fa-solid fa-chevron-left"></i>
          </button>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="date-picker"
          />
          <button
            className="date-nav-btn"
            onClick={() => {
              const d = new Date(selectedDate);
              d.setDate(d.getDate() + 1);
              setSelectedDate(d.toISOString().split('T')[0]);
            }}
          >
            <i className="fa-solid fa-chevron-right"></i>
          </button>
          <button
            className="date-today-btn"
            onClick={() => {
              const now = new Date();
              setSelectedDate(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`);
            }}
          >
            오늘
          </button>
          <div className="date-view-toggle">
            <button
              className={`toggle-btn ${dateViewMode === 'created' ? 'active' : ''}`}
              onClick={() => setDateViewMode('created')}
            >
              발생일
            </button>
            <button
              className={`toggle-btn ${dateViewMode === 'completed' ? 'active' : ''}`}
              onClick={() => setDateViewMode('completed')}
            >
              완료일
            </button>
          </div>
        </div>
        <div className="header-right">
          <button className="btn-refresh" onClick={loadInquiries} disabled={isLoading}>
            <i className="fa-solid fa-refresh"></i>
            새로고침
          </button>
          <button className="btn-add" onClick={() => setShowForm(true)}>
            <i className="fa-solid fa-plus"></i>
            문의 등록
          </button>
        </div>
      </div>

      {/* 채널 필터 */}
      <div className="call-type-filter">
        <button
          className={`filter-btn ${channelFilter === null ? 'active' : ''}`}
          onClick={() => setChannelFilter(null)}
        >
          전체
        </button>
        {CHANNELS.map(ch => (
          <button
            key={ch}
            className={`filter-btn ${channelFilter === ch ? 'active' : ''}`}
            onClick={() => setChannelFilter(ch)}
          >
            {CHANNEL_ICONS[ch]} {CHANNEL_LABELS[ch]}
            <span className="filter-count">
              {inquiries.filter(inq => inq.channel === ch).length}
            </span>
          </button>
        ))}
      </div>

      {/* 문의 등록/수정 모달 */}
      {showForm && (
        <div className="inq-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) closeForm(); }}>
          <div className="inq-modal">
            <div className="inq-modal-header">
              <h3 className="inq-modal-title">{editingInquiry ? '문의 수정' : '문의 등록'}</h3>
              <button className="inq-modal-close" onClick={closeForm}>&times;</button>
            </div>
            <form className="inq-modal-form" onSubmit={handleSubmit}>
              <div className="inq-modal-field">
                <label className="inq-modal-label">채널</label>
                <div className="inq-modal-chips">
                  {(Object.keys(CHANNEL_LABELS) as InquiryChannel[]).map((ch) => (
                    <button
                      key={ch}
                      type="button"
                      className={`inq-modal-chip ${formData.channel === ch ? 'active' : ''}`}
                      onClick={() => setFormData({ ...formData, channel: ch })}
                    >
                      {CHANNEL_ICONS[ch]} {CHANNEL_LABELS[ch]}
                    </button>
                  ))}
                </div>
              </div>
              <div className="inq-modal-field">
                <label className="inq-modal-label">유형</label>
                <div className="inq-modal-chips">
                  {(Object.keys(INQUIRY_TYPE_LABELS) as InquiryType[]).map((type) => (
                    <button
                      key={type}
                      type="button"
                      className={`inq-modal-chip ${formData.inquiry_type === type ? 'active' : ''}`}
                      onClick={() => setFormData({ ...formData, inquiry_type: type })}
                    >
                      {INQUIRY_TYPE_LABELS[type]}
                    </button>
                  ))}
                </div>
              </div>
              <div className="inq-modal-field">
                <label className="inq-modal-label">발신자</label>
                <div className="inq-modal-row">
                  <input
                    type="text"
                    className="inq-modal-input"
                    value={formData.patient_name || ''}
                    onChange={(e) => setFormData({ ...formData, patient_name: e.target.value })}
                    placeholder="이름"
                  />
                  <input
                    type="text"
                    className="inq-modal-input"
                    value={formData.contact || ''}
                    onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                    placeholder="전화번호"
                  />
                </div>
              </div>
              <div className="inq-modal-field">
                <label className="inq-modal-label">내용 *</label>
                <textarea
                  className="inq-modal-textarea"
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  placeholder="문의 내용을 입력하세요..."
                  rows={3}
                />
              </div>
              <div className="inq-modal-field">
                <label className="inq-modal-label">응대 내용</label>
                <textarea
                  className="inq-modal-textarea"
                  value={formData.response || ''}
                  onChange={(e) => setFormData({ ...formData, response: e.target.value })}
                  placeholder="응대 내용을 입력하세요..."
                  rows={2}
                />
              </div>
              <div className="inq-modal-field">
                <label className="inq-modal-label">담당자</label>
                <select
                  className="inq-modal-input"
                  value={formData.handler_name || ''}
                  onChange={(e) => setFormData({ ...formData, handler_name: e.target.value || undefined })}
                >
                  <option value="">선택안함</option>
                  {handlers.map(h => (
                    <option key={h.id} value={h.name}>{h.name}</option>
                  ))}
                </select>
              </div>
              <div className="inq-modal-footer">
                <button type="button" className="inq-modal-cancel" onClick={closeForm}>취소</button>
                <button type="submit" className="inq-modal-submit">{editingInquiry ? '수정' : '등록'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 칸반 보드 */}
      <div className="kanban-board">
        {isLoading ? (
          <div className="loading-state" style={{ width: '100%' }}>
            <i className="fa-solid fa-spinner fa-spin"></i>
            <span>로딩 중...</span>
          </div>
        ) : error ? (
          <div className="empty-state" style={{ width: '100%' }}>
            <i className="fa-solid fa-exclamation-triangle"></i>
            <span>{error}</span>
          </div>
        ) : (
          <>
            {/* 접수 컬럼 */}
            <div className="kanban-column pending">
              <div className="column-header">
                <span className="column-title">접수</span>
                <span className="column-count">{pendingItems.length}</span>
              </div>
              <div className="column-body">
                {pendingItems.length === 0 ? (
                  <div className="column-empty">대기 중인 문의 없음</div>
                ) : (
                  pendingItems.map(renderCard)
                )}
              </div>
            </div>

            {/* 응대중 컬럼 */}
            <div className="kanban-column in-progress">
              <div className="column-header">
                <span className="column-title">응대중</span>
                <span className="column-count">{inProgressItems.length}</span>
              </div>
              <div className="column-body">
                {inProgressItems.length === 0 ? (
                  <div className="column-empty">응대 중인 문의 없음</div>
                ) : (
                  inProgressItems.map(renderCard)
                )}
              </div>
            </div>

            {/* 완료 컬럼 */}
            <div className="kanban-column done">
              <div className="column-header">
                <span className="column-title">완료</span>
                <span className="column-count">{doneItems.length}</span>
              </div>
              <div className="column-body">
                {doneItems.length === 0 ? (
                  <div className="column-empty">완료된 문의 없음</div>
                ) : (
                  doneItems.map(renderCard)
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default InquiryView;
