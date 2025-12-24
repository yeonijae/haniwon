import React, { useState, useEffect } from 'react';
import { createMembership, updateMembership, deleteMembership } from '../lib/api';
import type { Membership } from '../types';

interface MembershipAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  patientId: number;
  patientName: string;
  chartNo: string;
  editData?: Membership; // 수정 모드일 때 기존 데이터
}

// 멤버십 프리셋
const MEMBERSHIP_PRESETS = [
  { value: '경근멤버십', label: '경근멤버십' },
  { value: 'custom', label: '직접입력' },
];

export function MembershipAddModal({
  isOpen,
  onClose,
  onSuccess,
  patientId,
  patientName,
  chartNo,
  editData,
}: MembershipAddModalProps) {
  const isEditMode = !!editData;
  const today = new Date().toISOString().split('T')[0];

  // 폼 상태
  const [membershipType, setMembershipType] = useState('경근멤버십');
  const [customTypeName, setCustomTypeName] = useState('');
  const [remainingCount, setRemainingCount] = useState(10);
  const [startDate, setStartDate] = useState(today);
  const [expireDate, setExpireDate] = useState('');
  const [memo, setMemo] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 수정 모드일 때 데이터 로드
  useEffect(() => {
    if (editData) {
      const preset = MEMBERSHIP_PRESETS.find(p => p.value === editData.membership_type);
      if (preset && preset.value !== 'custom') {
        setMembershipType(editData.membership_type);
        setCustomTypeName('');
      } else {
        setMembershipType('custom');
        setCustomTypeName(editData.membership_type);
      }
      setRemainingCount(editData.remaining_count);
      setStartDate(editData.start_date);
      setExpireDate(editData.expire_date);
      setMemo(editData.memo || '');
    }
  }, [editData]);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    const typeName = membershipType === 'custom' ? customTypeName : membershipType;

    if (!typeName.trim()) {
      alert('멤버십 종류를 입력해주세요.');
      return;
    }

    if (!expireDate) {
      alert('만료일을 선택해주세요.');
      return;
    }

    if (remainingCount <= 0) {
      alert('잔여 횟수는 1 이상이어야 합니다.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (isEditMode && editData?.id) {
        // 수정 모드
        await updateMembership(editData.id, {
          membership_type: typeName,
          remaining_count: remainingCount,
          start_date: startDate,
          expire_date: expireDate,
          memo: memo || undefined,
          status: remainingCount <= 0 ? 'expired' : 'active',
        });
      } else {
        // 추가 모드
        await createMembership({
          patient_id: patientId,
          chart_number: chartNo,
          patient_name: patientName,
          membership_type: typeName,
          remaining_count: remainingCount,
          start_date: startDate,
          expire_date: expireDate,
          memo: memo || undefined,
          status: 'active',
        });
      }

      onSuccess();
      handleClose();
    } catch (err) {
      console.error('멤버십 저장 실패:', err);
      alert('멤버십 저장에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!editData?.id) return;

    if (!confirm('이 멤버십을 삭제하시겠습니까?')) return;

    setIsSubmitting(true);
    try {
      await deleteMembership(editData.id);
      onSuccess();
      handleClose();
    } catch (err) {
      console.error('멤버십 삭제 실패:', err);
      alert('멤버십 삭제에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    // 폼 초기화
    setMembershipType('경근멤버십');
    setCustomTypeName('');
    setRemainingCount(10);
    setStartDate(today);
    setExpireDate('');
    setMemo('');
    onClose();
  };

  // 만료일 기본값 설정 (시작일 + 1년)
  const handleStartDateChange = (date: string) => {
    setStartDate(date);
    if (!expireDate && date) {
      const d = new Date(date);
      d.setFullYear(d.getFullYear() + 1);
      setExpireDate(d.toISOString().split('T')[0]);
    }
  };

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content membership-add-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{isEditMode ? '멤버십 수정' : '멤버십 추가'}</h3>
          <button className="modal-close-btn" onClick={handleClose}>
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div className="modal-body">
          <div className="patient-info-bar">
            <span className="patient-name">{patientName}</span>
            <span className="patient-chart">({chartNo.replace(/^0+/, '')})</span>
          </div>

          <div className="form-group">
            <label>멤버십 종류 *</label>
            <div className="package-select-row">
              <select
                value={membershipType}
                onChange={(e) => setMembershipType(e.target.value)}
              >
                {MEMBERSHIP_PRESETS.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
              {membershipType === 'custom' && (
                <input
                  type="text"
                  value={customTypeName}
                  onChange={(e) => setCustomTypeName(e.target.value)}
                  placeholder="멤버십명 입력"
                  className="custom-input"
                />
              )}
            </div>
          </div>

          <div className="form-group">
            <label>잔여 횟수 *</label>
            <input
              type="number"
              value={remainingCount}
              onChange={(e) => setRemainingCount(Number(e.target.value))}
              min={1}
            />
          </div>

          <div className="form-row">
            <div className="form-group half">
              <label>시작일 *</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => handleStartDateChange(e.target.value)}
              />
            </div>
            <div className="form-group half">
              <label>만료일 *</label>
              <input
                type="date"
                value={expireDate}
                onChange={(e) => setExpireDate(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label>메모</label>
            <input
              type="text"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="메모 입력"
            />
          </div>
        </div>

        <div className="modal-footer">
          {isEditMode && (
            <button
              className="btn-delete"
              onClick={handleDelete}
              disabled={isSubmitting}
            >
              삭제
            </button>
          )}
          <div className="footer-right">
            <button className="btn-cancel" onClick={handleClose}>취소</button>
            <button
              className="btn-submit"
              onClick={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? '저장 중...' : isEditMode ? '수정' : '추가'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
