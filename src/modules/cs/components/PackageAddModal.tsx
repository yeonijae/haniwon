import React, { useState, useEffect } from 'react';
import { createTreatmentPackage, updateTreatmentPackage, deleteTreatmentPackage } from '../lib/api';
import type { TreatmentPackage } from '../types';

interface PackageAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  patientId: number;
  patientName: string;
  chartNo: string;
  editData?: TreatmentPackage; // 수정 모드일 때 기존 데이터
}

// 시술패키지 프리셋
const PACKAGE_PRESETS = [
  { value: '통마', label: '통마' },
  { value: '약침', label: '약침' },
  { value: '향기요법', label: '향기요법' },
  { value: '스파인엠티', label: '스파인엠티' },
  { value: 'custom', label: '직접입력' },
];

export function PackageAddModal({
  isOpen,
  onClose,
  onSuccess,
  patientId,
  patientName,
  chartNo,
  editData,
}: PackageAddModalProps) {
  const isEditMode = !!editData;

  // 폼 상태
  const [packageType, setPackageType] = useState('통마');
  const [customPackageName, setCustomPackageName] = useState('');
  const [totalCount, setTotalCount] = useState(10);
  const [usedCount, setUsedCount] = useState(0);
  const [includes, setIncludes] = useState('');
  const [expireDate, setExpireDate] = useState('');
  const [memo, setMemo] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 수정 모드일 때 데이터 로드
  useEffect(() => {
    if (editData) {
      const preset = PACKAGE_PRESETS.find(p => p.value === editData.package_name);
      if (preset && preset.value !== 'custom') {
        setPackageType(editData.package_name);
        setCustomPackageName('');
      } else {
        setPackageType('custom');
        setCustomPackageName(editData.package_name);
      }
      setTotalCount(editData.total_count);
      setUsedCount(editData.used_count);
      setIncludes(editData.includes || '');
      setExpireDate(editData.expire_date || '');
      setMemo(editData.memo || '');
    }
  }, [editData]);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    const packageName = packageType === 'custom' ? customPackageName : packageType;

    if (!packageName.trim()) {
      alert('패키지명을 입력해주세요.');
      return;
    }

    if (totalCount <= 0) {
      alert('총 횟수는 1 이상이어야 합니다.');
      return;
    }

    if (usedCount > totalCount) {
      alert('사용 횟수가 총 횟수를 초과할 수 없습니다.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (isEditMode && editData?.id) {
        // 수정 모드
        await updateTreatmentPackage(editData.id, {
          package_name: packageName,
          total_count: totalCount,
          used_count: usedCount,
          remaining_count: totalCount - usedCount,
          includes: includes || undefined,
          expire_date: expireDate || undefined,
          memo: memo || undefined,
          status: totalCount - usedCount <= 0 ? 'completed' : 'active',
        });
      } else {
        // 추가 모드
        const today = new Date().toISOString().split('T')[0];
        await createTreatmentPackage({
          patient_id: patientId,
          chart_number: chartNo,
          patient_name: patientName,
          package_name: packageName,
          total_count: totalCount,
          used_count: 0,
          remaining_count: totalCount,
          includes: includes || undefined,
          start_date: today,
          expire_date: expireDate || undefined,
          memo: memo || undefined,
          status: 'active',
        });
      }

      onSuccess();
      handleClose();
    } catch (err) {
      console.error('패키지 저장 실패:', err);
      alert('패키지 저장에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!editData?.id) return;

    if (!confirm('이 패키지를 삭제하시겠습니까?')) return;

    setIsSubmitting(true);
    try {
      await deleteTreatmentPackage(editData.id);
      onSuccess();
      handleClose();
    } catch (err) {
      console.error('패키지 삭제 실패:', err);
      alert('패키지 삭제에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    // 폼 초기화
    setPackageType('통마');
    setCustomPackageName('');
    setTotalCount(10);
    setUsedCount(0);
    setIncludes('');
    setExpireDate('');
    setMemo('');
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content package-add-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{isEditMode ? '시술패키지 수정' : '시술패키지 추가'}</h3>
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
            <label>패키지명 *</label>
            <div className="package-select-row">
              <select
                value={packageType}
                onChange={(e) => setPackageType(e.target.value)}
              >
                {PACKAGE_PRESETS.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
              {packageType === 'custom' && (
                <input
                  type="text"
                  value={customPackageName}
                  onChange={(e) => setCustomPackageName(e.target.value)}
                  placeholder="패키지명 입력"
                  className="custom-input"
                />
              )}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group half">
              <label>총 횟수 *</label>
              <input
                type="number"
                value={totalCount}
                onChange={(e) => setTotalCount(Number(e.target.value))}
                min={1}
              />
            </div>
            {isEditMode && (
              <div className="form-group half">
                <label>사용 횟수</label>
                <input
                  type="number"
                  value={usedCount}
                  onChange={(e) => setUsedCount(Number(e.target.value))}
                  min={0}
                  max={totalCount}
                />
              </div>
            )}
            {!isEditMode && (
              <div className="form-group half">
                <label>만료일</label>
                <input
                  type="date"
                  value={expireDate}
                  onChange={(e) => setExpireDate(e.target.value)}
                />
              </div>
            )}
          </div>

          {isEditMode && (
            <div className="form-row">
              <div className="form-group half">
                <label>잔여 횟수</label>
                <input
                  type="text"
                  value={totalCount - usedCount}
                  disabled
                  className="disabled-input"
                />
              </div>
              <div className="form-group half">
                <label>만료일</label>
                <input
                  type="date"
                  value={expireDate}
                  onChange={(e) => setExpireDate(e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="form-group">
            <label>포함항목</label>
            <input
              type="text"
              value={includes}
              onChange={(e) => setIncludes(e.target.value)}
              placeholder="예: 경근1, 비추"
            />
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
