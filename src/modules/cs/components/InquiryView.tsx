import React, { useState } from 'react';
import type { PortalUser } from '@shared/types';
import { useInquiries } from '../hooks/useInquiries';
import type { Inquiry, CreateInquiryRequest, InquiryChannel, InquiryType, InquiryStatus } from '../types';
import { CHANNEL_LABELS, CHANNEL_ICONS, INQUIRY_TYPE_LABELS, STATUS_LABELS, STATUS_COLORS } from '../types';

interface InquiryViewProps {
  user: PortalUser;
}

function InquiryView({ user }: InquiryViewProps) {
  const {
    inquiries,
    isLoading,
    error,
    filter,
    setFilter,
    loadInquiries,
    createInquiry,
    updateStatus,
    deleteInquiry,
  } = useInquiries();

  const [showForm, setShowForm] = useState(false);
  const [editingInquiry, setEditingInquiry] = useState<Inquiry | null>(null);

  // 폼 상태
  const [formData, setFormData] = useState<CreateInquiryRequest>({
    channel: 'phone',
    inquiry_type: 'new_patient',
    content: '',
    patient_name: '',
    contact: '',
    response: '',
    staff_name: user.name,
  });

  const resetForm = () => {
    setFormData({
      channel: 'phone',
      inquiry_type: 'new_patient',
      content: '',
      patient_name: '',
      contact: '',
      response: '',
      staff_name: user.name,
    });
    setEditingInquiry(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.content.trim()) {
      alert('문의 내용을 입력해주세요.');
      return;
    }

    try {
      await createInquiry(formData);
      setShowForm(false);
      resetForm();
    } catch (err) {
      alert('문의 등록에 실패했습니다.');
    }
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

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('ko-KR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="inquiry-view">
      {/* 상단 툴바 */}
      <div className="inquiry-toolbar">
        <div className="inquiry-filters">
          <button
            className={`filter-btn ${filter === 'today' ? 'active' : ''}`}
            onClick={() => setFilter('today')}
          >
            오늘
          </button>
          <button
            className={`filter-btn ${filter === 'pending' ? 'active' : ''}`}
            onClick={() => setFilter('pending')}
          >
            미처리
          </button>
          <button
            className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            전체
          </button>
        </div>
        <div className="inquiry-actions">
          <button className="refresh-btn" onClick={loadInquiries}>
            🔄 새로고침
          </button>
          <button className="add-btn" onClick={() => setShowForm(true)}>
            ➕ 문의 등록
          </button>
        </div>
      </div>

      {/* 문의 등록 폼 */}
      {showForm && (
        <div className="inquiry-form-overlay">
          <div className="inquiry-form-modal">
            <div className="form-header">
              <h3>문의 등록</h3>
              <button onClick={() => { setShowForm(false); resetForm(); }}>✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <label>채널</label>
                <div className="channel-buttons">
                  {(Object.keys(CHANNEL_LABELS) as InquiryChannel[]).map((ch) => (
                    <button
                      key={ch}
                      type="button"
                      className={`channel-btn ${formData.channel === ch ? 'active' : ''}`}
                      onClick={() => setFormData({ ...formData, channel: ch })}
                    >
                      {CHANNEL_ICONS[ch]} {CHANNEL_LABELS[ch]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-row">
                <label>문의 유형</label>
                <select
                  value={formData.inquiry_type}
                  onChange={(e) => setFormData({ ...formData, inquiry_type: e.target.value as InquiryType })}
                >
                  {(Object.keys(INQUIRY_TYPE_LABELS) as InquiryType[]).map((type) => (
                    <option key={type} value={type}>{INQUIRY_TYPE_LABELS[type]}</option>
                  ))}
                </select>
              </div>

              <div className="form-row two-cols">
                <div>
                  <label>환자명</label>
                  <input
                    type="text"
                    value={formData.patient_name || ''}
                    onChange={(e) => setFormData({ ...formData, patient_name: e.target.value })}
                    placeholder="이름"
                  />
                </div>
                <div>
                  <label>연락처</label>
                  <input
                    type="text"
                    value={formData.contact || ''}
                    onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                    placeholder="010-0000-0000"
                  />
                </div>
              </div>

              <div className="form-row">
                <label>문의 내용 *</label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  placeholder="문의 내용을 입력하세요..."
                  rows={3}
                  required
                />
              </div>

              <div className="form-row">
                <label>응대 내용</label>
                <textarea
                  value={formData.response || ''}
                  onChange={(e) => setFormData({ ...formData, response: e.target.value })}
                  placeholder="응대 내용을 입력하세요..."
                  rows={2}
                />
              </div>

              <div className="form-actions">
                <button type="button" onClick={() => { setShowForm(false); resetForm(); }}>
                  취소
                </button>
                <button type="submit" className="submit-btn">
                  등록
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 로딩 상태 */}
      {isLoading && (
        <div className="inquiry-loading">
          <span>로딩 중...</span>
        </div>
      )}

      {/* 에러 */}
      {error && (
        <div className="inquiry-error">
          {error}
        </div>
      )}

      {/* 문의 목록 */}
      {!isLoading && !error && (
        <div className="inquiry-list">
          {inquiries.length === 0 ? (
            <div className="inquiry-empty">
              <p>문의 내역이 없습니다.</p>
            </div>
          ) : (
            inquiries.map((inquiry) => (
              <div key={inquiry.id} className="inquiry-card">
                <div className="inquiry-card-header">
                  <div className="inquiry-meta">
                    <span className="channel-badge">
                      {CHANNEL_ICONS[inquiry.channel]} {CHANNEL_LABELS[inquiry.channel]}
                    </span>
                    <span className="type-badge">
                      {INQUIRY_TYPE_LABELS[inquiry.inquiry_type]}
                    </span>
                    <span
                      className="status-badge"
                      style={{ backgroundColor: STATUS_COLORS[inquiry.status] }}
                    >
                      {STATUS_LABELS[inquiry.status]}
                    </span>
                  </div>
                  <span className="inquiry-time">{formatDate(inquiry.created_at)}</span>
                </div>

                <div className="inquiry-card-body">
                  {inquiry.patient_name && (
                    <div className="inquiry-patient">
                      <strong>{inquiry.patient_name}</strong>
                      {inquiry.contact && <span>{inquiry.contact}</span>}
                    </div>
                  )}
                  <p className="inquiry-content">{inquiry.content}</p>
                  {inquiry.response && (
                    <p className="inquiry-response">
                      <span>응대:</span> {inquiry.response}
                    </p>
                  )}
                </div>

                <div className="inquiry-card-footer">
                  <span className="staff-name">{inquiry.staff_name || '-'}</span>
                  <div className="inquiry-card-actions">
                    {inquiry.status === 'pending' && (
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
                    <button
                      className="action-btn delete"
                      onClick={() => handleDelete(inquiry.id)}
                    >
                      삭제
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default InquiryView;
