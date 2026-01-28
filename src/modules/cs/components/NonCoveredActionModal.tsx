import React, { useState, useEffect } from 'react';
import type { PortalUser } from '@shared/types';
import type {
  NonCoveredActionType,
  NonCoveredModalData,
  PackageStatusSummary,
  StaffRole,
  CreatePatientNoteRequest,
} from '../types/crm';
import { NON_COVERED_ACTION_LABELS } from '../types/crm';
import { getPatientPackageStatusByChartNumber, createPatientNote } from '../lib/patientCrmApi';
import {
  useTreatmentPackage,
  useNokryongPackage,
  getActiveTreatmentPackages,
  getActiveNokryongPackages,
} from '../lib/api';
import type { TreatmentPackage, NokryongPackage } from '../types';
import PatientPackageStatus from './PatientPackageStatus';
import { useDraggableModal } from '../hooks/useDraggableModal';
import { useEscapeKey } from '@shared/hooks/useEscapeKey';

interface NonCoveredActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: NonCoveredModalData;
  user: PortalUser;
  onSuccess?: () => void;
}

type Step = 'select' | 'deduct' | 'register' | 'memo';

const NonCoveredActionModal: React.FC<NonCoveredActionModalProps> = ({
  isOpen,
  onClose,
  data,
  user,
  onSuccess,
}) => {
  const [step, setStep] = useState<Step>('select');
  const [selectedAction, setSelectedAction] = useState<NonCoveredActionType | null>(null);
  const [packageStatus, setPackageStatus] = useState<PackageStatusSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [memo, setMemo] = useState('');
  const [selectedPackageType, setSelectedPackageType] = useState<'tongma' | 'herbal' | 'nokryong' | null>(null);

  const { modalRef, modalStyle, modalClassName, handleMouseDown } = useDraggableModal({ isOpen });
  useEscapeKey(onClose, isOpen);

  // 스태프 역할 결정 (user.role 기반)
  const staffRole: StaffRole = user.role === 'medical_staff'
    ? 'doctor'
    : user.role === 'treatment'
    ? 'treatment'
    : 'desk';

  // 패키지 현황 로드
  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      setStep('select');
      setSelectedAction(null);
      setMemo('');
      setSelectedPackageType(null);

      getPatientPackageStatusByChartNumber(data.chartNumber)
        .then(status => {
          setPackageStatus(status);
        })
        .catch(error => {
          console.error('패키지 현황 로드 오류:', error);
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [isOpen, data.chartNumber]);

  // 액션 선택
  const handleActionSelect = (action: NonCoveredActionType) => {
    setSelectedAction(action);

    switch (action) {
      case 'package_deduct':
        setStep('deduct');
        break;
      case 'package_register':
        setStep('register');
        break;
      case 'memo_only':
        setStep('memo');
        break;
    }
  };

  // 패키지 차감 처리
  const handlePackageDeduct = async () => {
    if (!selectedPackageType) {
      alert('차감할 패키지를 선택해주세요.');
      return;
    }

    setIsSubmitting(true);
    try {
      // 패키지 타입에 따라 차감 처리
      if (selectedPackageType === 'tongma' && packageStatus?.tongma) {
        // 통마 패키지 조회 후 차감
        const tongmaPackages = await getActiveTreatmentPackages(data.patientId);
        const tongmaPackage = tongmaPackages.find(p =>
          (p.package_name.includes('통증마일리지') || p.package_name.includes('통마'))
        );
        if (tongmaPackage?.id) {
          await useTreatmentPackage(tongmaPackage.id);
        }
      } else if (selectedPackageType === 'nokryong' && packageStatus?.nokryong) {
        // 녹용 패키지 조회 후 차감
        const nokryongPackages = await getActiveNokryongPackages(data.patientId);
        const nokryongPackage = nokryongPackages[0];
        if (nokryongPackage?.id) {
          await useNokryongPackage(nokryongPackage.id);
        }
      }

      // 메모 저장 (선택적)
      if (memo.trim()) {
        const noteData: CreatePatientNoteRequest = {
          patient_id: data.patientId,
          chart_number: data.chartNumber,
          patient_name: data.patientName,
          note_type: 'memo',
          content: `[${data.itemName}] ${memo.trim()}`,
          mssql_receipt_id: data.mssqlReceiptId,
          mssql_detail_id: data.mssqlDetailId,
          staff_name: user.name,
          staff_role: staffRole,
        };
        await createPatientNote(noteData);
      }

      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('패키지 차감 오류:', error);
      alert('패키지 차감 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 메모만 저장
  const handleMemoOnly = async () => {
    if (!memo.trim()) {
      alert('메모 내용을 입력해주세요.');
      return;
    }

    setIsSubmitting(true);
    try {
      const noteData: CreatePatientNoteRequest = {
        patient_id: data.patientId,
        chart_number: data.chartNumber,
        patient_name: data.patientName,
        note_type: 'memo',
        content: `[${data.itemName}] ${memo.trim()}`,
        mssql_receipt_id: data.mssqlReceiptId,
        mssql_detail_id: data.mssqlDetailId,
        staff_name: user.name,
        staff_role: staffRole,
      };
      await createPatientNote(noteData);

      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('메모 저장 오류:', error);
      alert('메모 저장 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        ref={modalRef}
        className={`modal-content noncovered-action-modal ${modalClassName}`}
        style={modalStyle}
        onClick={e => e.stopPropagation()}
        onMouseDown={handleMouseDown}
      >
        {/* 헤더 */}
        <div className="modal-header">
          <h3>비급여 기록</h3>
          <button className="modal-close-btn" onClick={onClose}>×</button>
        </div>

        {/* 본문 */}
        <div className="modal-body">
          {/* 항목 정보 */}
          <div className="noncovered-item-info">
            <span className="item-name">{data.itemName}</span>
            <span className="item-amount">{data.amount.toLocaleString()}원</span>
          </div>

          {isLoading ? (
            <div className="loading">로딩 중...</div>
          ) : (
            <>
              {/* 패키지 현황 */}
              {packageStatus && (
                <div className="package-status-section">
                  <h4>패키지 현황</h4>
                  <PatientPackageStatus
                    status={packageStatus}
                    onPackageClick={type => {
                      if (step === 'deduct' && type !== 'membership') {
                        setSelectedPackageType(type);
                      }
                    }}
                  />
                </div>
              )}

              {/* Step: 선택 */}
              {step === 'select' && (
                <div className="action-selection">
                  <div className="action-options">
                    {/* 패키지 차감 (패키지가 있는 경우에만) */}
                    {(packageStatus?.tongma || packageStatus?.nokryong) && (
                      <button
                        className={`action-option ${selectedAction === 'package_deduct' ? 'selected' : ''}`}
                        onClick={() => handleActionSelect('package_deduct')}
                      >
                        <span className="option-icon">📦</span>
                        <span className="option-label">{NON_COVERED_ACTION_LABELS.package_deduct}</span>
                      </button>
                    )}

                    {/* 새 패키지 등록 */}
                    <button
                      className={`action-option ${selectedAction === 'package_register' ? 'selected' : ''}`}
                      onClick={() => handleActionSelect('package_register')}
                    >
                      <span className="option-icon">➕</span>
                      <span className="option-label">{NON_COVERED_ACTION_LABELS.package_register}</span>
                    </button>

                    {/* 메모만 */}
                    <button
                      className={`action-option ${selectedAction === 'memo_only' ? 'selected' : ''}`}
                      onClick={() => handleActionSelect('memo_only')}
                    >
                      <span className="option-icon">📝</span>
                      <span className="option-label">{NON_COVERED_ACTION_LABELS.memo_only}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Step: 패키지 차감 */}
              {step === 'deduct' && (
                <div className="deduct-step">
                  <h4>차감할 패키지 선택</h4>
                  <div className="package-select-options">
                    {packageStatus?.tongma && (
                      <button
                        className={`package-select-btn ${selectedPackageType === 'tongma' ? 'selected' : ''}`}
                        onClick={() => setSelectedPackageType('tongma')}
                      >
                        통마 [{packageStatus.tongma.remainingCount}/{packageStatus.tongma.totalCount}]
                      </button>
                    )}
                    {packageStatus?.nokryong && (
                      <button
                        className={`package-select-btn ${selectedPackageType === 'nokryong' ? 'selected' : ''}`}
                        onClick={() => setSelectedPackageType('nokryong')}
                      >
                        녹용 [{packageStatus.nokryong.remainingMonths}/{packageStatus.nokryong.totalMonths}]
                      </button>
                    )}
                  </div>
                  <div className="memo-input">
                    <label>메모 (선택)</label>
                    <textarea
                      value={memo}
                      onChange={e => setMemo(e.target.value)}
                      placeholder="추가 메모 (선택)"
                      rows={2}
                    />
                  </div>
                </div>
              )}

              {/* Step: 패키지 등록 안내 */}
              {step === 'register' && (
                <div className="register-step">
                  <p>비급여관리 화면에서 패키지를 등록해주세요.</p>
                </div>
              )}

              {/* Step: 메모만 */}
              {step === 'memo' && (
                <div className="memo-step">
                  <div className="memo-input">
                    <label>메모 내용</label>
                    <textarea
                      value={memo}
                      onChange={e => setMemo(e.target.value)}
                      placeholder="메모 내용을 입력하세요"
                      rows={3}
                      autoFocus
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* 푸터 */}
        <div className="modal-footer">
          {step !== 'select' && (
            <button
              className="btn-back"
              onClick={() => {
                setStep('select');
                setSelectedAction(null);
                setSelectedPackageType(null);
              }}
            >
              뒤로
            </button>
          )}
          <button className="btn-cancel" onClick={onClose}>
            취소
          </button>
          {step === 'deduct' && (
            <button
              className="btn-submit"
              onClick={handlePackageDeduct}
              disabled={isSubmitting || !selectedPackageType}
            >
              {isSubmitting ? '처리중...' : '차감'}
            </button>
          )}
          {step === 'memo' && (
            <button
              className="btn-submit"
              onClick={handleMemoOnly}
              disabled={isSubmitting || !memo.trim()}
            >
              {isSubmitting ? '저장중...' : '저장'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default NonCoveredActionModal;
