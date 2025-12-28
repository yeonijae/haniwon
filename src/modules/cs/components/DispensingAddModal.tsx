import React, { useState, useEffect } from 'react';
import { useEscapeKey } from '@shared/hooks/useEscapeKey';
import {
  createHerbalDispensing,
  updateHerbalDispensing,
  deleteHerbalDispensing,
  createGiftDispensing,
  updateGiftDispensing,
  deleteGiftDispensing,
} from '../lib/api';
import type { HerbalDispensing, GiftDispensing } from '../types';

interface DispensingAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  patientId: number;
  patientName: string;
  chartNo: string;
  receiptId?: number;
  selectedDate: string;
  editHerbalData?: HerbalDispensing; // 한약 출납 수정 모드
  editGiftData?: GiftDispensing;     // 증정품 출납 수정 모드
}

type TabType = 'herbal' | 'gift';

// 한약 프리셋
const HERBAL_PRESETS = [
  '시함마농',
  '궁귀교애탕',
  '보중익기탕',
  '쌍화탕',
  '육군자탕',
  '반하사심탕',
];

// 출납유형
const DISPENSING_TYPES = [
  { value: 'sale', label: '판매' },
  { value: 'gift', label: '증정' },
  { value: 'package', label: '패키지' },
];

// 배송방법
const DELIVERY_METHODS = [
  { value: 'pickup', label: '내원' },
  { value: 'local', label: '시내' },
  { value: 'express', label: '시외' },
];

// 증정품 프리셋
const GIFT_PRESETS = [
  '핫팩',
  '비염고',
  '육미지황',
  '소화제',
  '진통제',
];

export function DispensingAddModal({
  isOpen,
  onClose,
  onSuccess,
  patientId,
  patientName,
  chartNo,
  receiptId,
  selectedDate,
  editHerbalData,
  editGiftData,
}: DispensingAddModalProps) {
  const isHerbalEditMode = !!editHerbalData;
  const isGiftEditMode = !!editGiftData;
  const isEditMode = isHerbalEditMode || isGiftEditMode;

  // 탭 상태
  const [activeTab, setActiveTab] = useState<TabType>(isGiftEditMode ? 'gift' : 'herbal');

  // 한약 출납 폼
  const [herbalName, setHerbalName] = useState('');
  const [herbalQuantity, setHerbalQuantity] = useState(1);
  const [dispensingType, setDispensingType] = useState<'sale' | 'gift' | 'package'>('sale');
  const [deliveryMethod, setDeliveryMethod] = useState<'pickup' | 'local' | 'express'>('pickup');
  const [herbalMemo, setHerbalMemo] = useState('');

  // 증정품 출납 폼
  const [giftName, setGiftName] = useState('');
  const [giftQuantity, setGiftQuantity] = useState(1);
  const [giftReason, setGiftReason] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);

  // ESC 키로 모달 닫기
  useEscapeKey(onClose, isOpen);

  // 수정 모드일 때 데이터 로드
  useEffect(() => {
    if (editHerbalData) {
      setActiveTab('herbal');
      setHerbalName(editHerbalData.herbal_name);
      setHerbalQuantity(editHerbalData.quantity);
      setDispensingType(editHerbalData.dispensing_type);
      setDeliveryMethod(editHerbalData.delivery_method);
      setHerbalMemo(editHerbalData.memo || '');
    }
    if (editGiftData) {
      setActiveTab('gift');
      setGiftName(editGiftData.item_name);
      setGiftQuantity(editGiftData.quantity);
      setGiftReason(editGiftData.reason || '');
    }
  }, [editHerbalData, editGiftData]);

  if (!isOpen) return null;

  const handleSubmitHerbal = async () => {
    if (!herbalName.trim()) {
      alert('약명을 입력해주세요.');
      return;
    }

    if (herbalQuantity <= 0) {
      alert('수량은 1 이상이어야 합니다.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (isHerbalEditMode && editHerbalData?.id) {
        await updateHerbalDispensing(editHerbalData.id, {
          herbal_name: herbalName,
          quantity: herbalQuantity,
          dispensing_type: dispensingType,
          delivery_method: deliveryMethod,
          memo: herbalMemo || undefined,
        });
      } else {
        await createHerbalDispensing({
          patient_id: patientId,
          chart_number: chartNo,
          patient_name: patientName,
          herbal_name: herbalName,
          quantity: herbalQuantity,
          dispensing_type: dispensingType,
          delivery_method: deliveryMethod,
          receipt_id: receiptId,
          memo: herbalMemo || undefined,
          dispensing_date: selectedDate,
        });
      }

      onSuccess();
      handleClose();
    } catch (err) {
      console.error('한약 출납 저장 실패:', err);
      alert('한약 출납 저장에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitGift = async () => {
    if (!giftName.trim()) {
      alert('품목명을 입력해주세요.');
      return;
    }

    if (giftQuantity <= 0) {
      alert('수량은 1 이상이어야 합니다.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (isGiftEditMode && editGiftData?.id) {
        await updateGiftDispensing(editGiftData.id, {
          item_name: giftName,
          quantity: giftQuantity,
          reason: giftReason || undefined,
        });
      } else {
        await createGiftDispensing({
          patient_id: patientId,
          chart_number: chartNo,
          patient_name: patientName,
          item_name: giftName,
          quantity: giftQuantity,
          reason: giftReason || undefined,
          receipt_id: receiptId,
          dispensing_date: selectedDate,
        });
      }

      onSuccess();
      handleClose();
    } catch (err) {
      console.error('증정품 출납 저장 실패:', err);
      alert('증정품 출납 저장에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (isHerbalEditMode && editHerbalData?.id) {
      if (!confirm('이 한약 출납을 삭제하시겠습니까?')) return;
      setIsSubmitting(true);
      try {
        await deleteHerbalDispensing(editHerbalData.id);
        onSuccess();
        handleClose();
      } catch (err) {
        console.error('한약 출납 삭제 실패:', err);
        alert('한약 출납 삭제에 실패했습니다.');
      } finally {
        setIsSubmitting(false);
      }
    } else if (isGiftEditMode && editGiftData?.id) {
      if (!confirm('이 증정품 출납을 삭제하시겠습니까?')) return;
      setIsSubmitting(true);
      try {
        await deleteGiftDispensing(editGiftData.id);
        onSuccess();
        handleClose();
      } catch (err) {
        console.error('증정품 출납 삭제 실패:', err);
        alert('증정품 출납 삭제에 실패했습니다.');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleClose = () => {
    // 폼 초기화
    setActiveTab('herbal');
    setHerbalName('');
    setHerbalQuantity(1);
    setDispensingType('sale');
    setDeliveryMethod('pickup');
    setHerbalMemo('');
    setGiftName('');
    setGiftQuantity(1);
    setGiftReason('');
    onClose();
  };

  const getTitle = () => {
    if (isHerbalEditMode) return '한약 출납 수정';
    if (isGiftEditMode) return '증정품 출납 수정';
    return '출납 추가';
  };

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content dispensing-add-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{getTitle()}</h3>
          <button className="modal-close-btn" onClick={handleClose}>
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        {/* 탭 (수정 모드가 아닐 때만 표시) */}
        {!isEditMode && (
          <div className="modal-tabs">
            <button
              className={`tab-btn ${activeTab === 'herbal' ? 'active' : ''}`}
              onClick={() => setActiveTab('herbal')}
            >
              한약 출납
            </button>
            <button
              className={`tab-btn ${activeTab === 'gift' ? 'active' : ''}`}
              onClick={() => setActiveTab('gift')}
            >
              증정품 출납
            </button>
          </div>
        )}

        <div className="modal-body">
          <div className="patient-info-bar">
            <span className="patient-name">{patientName}</span>
            <span className="patient-chart">({chartNo.replace(/^0+/, '')})</span>
          </div>

          {/* 한약 출납 탭 */}
          {activeTab === 'herbal' && (
            <>
              <div className="form-group">
                <label>약명 *</label>
                <div className="preset-input-row">
                  <input
                    type="text"
                    value={herbalName}
                    onChange={(e) => setHerbalName(e.target.value)}
                    placeholder="약명 입력"
                    list="herbal-presets"
                  />
                  <datalist id="herbal-presets">
                    {HERBAL_PRESETS.map((h) => (
                      <option key={h} value={h} />
                    ))}
                  </datalist>
                </div>
                <div className="preset-chips">
                  {HERBAL_PRESETS.slice(0, 4).map((h) => (
                    <button
                      key={h}
                      type="button"
                      className={`preset-chip ${herbalName === h ? 'active' : ''}`}
                      onClick={() => setHerbalName(h)}
                    >
                      {h}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-row">
                <div className="form-group half">
                  <label>수량 (봉) *</label>
                  <input
                    type="number"
                    value={herbalQuantity}
                    onChange={(e) => setHerbalQuantity(Number(e.target.value))}
                    min={1}
                  />
                </div>
                <div className="form-group half">
                  <label>출납유형 *</label>
                  <select
                    value={dispensingType}
                    onChange={(e) => setDispensingType(e.target.value as any)}
                  >
                    {DISPENSING_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>배송방법 *</label>
                <div className="radio-group">
                  {DELIVERY_METHODS.map((m) => (
                    <label key={m.value} className="radio-label">
                      <input
                        type="radio"
                        name="deliveryMethod"
                        value={m.value}
                        checked={deliveryMethod === m.value}
                        onChange={(e) => setDeliveryMethod(e.target.value as any)}
                      />
                      <span>{m.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label>메모</label>
                <input
                  type="text"
                  value={herbalMemo}
                  onChange={(e) => setHerbalMemo(e.target.value)}
                  placeholder="메모 입력"
                />
              </div>
            </>
          )}

          {/* 증정품 출납 탭 */}
          {activeTab === 'gift' && (
            <>
              <div className="form-group">
                <label>품목명 *</label>
                <div className="preset-input-row">
                  <input
                    type="text"
                    value={giftName}
                    onChange={(e) => setGiftName(e.target.value)}
                    placeholder="품목명 입력"
                    list="gift-presets"
                  />
                  <datalist id="gift-presets">
                    {GIFT_PRESETS.map((g) => (
                      <option key={g} value={g} />
                    ))}
                  </datalist>
                </div>
                <div className="preset-chips">
                  {GIFT_PRESETS.map((g) => (
                    <button
                      key={g}
                      type="button"
                      className={`preset-chip ${giftName === g ? 'active' : ''}`}
                      onClick={() => setGiftName(g)}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label>수량 *</label>
                <input
                  type="number"
                  value={giftQuantity}
                  onChange={(e) => setGiftQuantity(Number(e.target.value))}
                  min={1}
                />
              </div>

              <div className="form-group">
                <label>사유</label>
                <input
                  type="text"
                  value={giftReason}
                  onChange={(e) => setGiftReason(e.target.value)}
                  placeholder="예: 네이버 리뷰 증정"
                />
              </div>
            </>
          )}
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
              onClick={activeTab === 'herbal' ? handleSubmitHerbal : handleSubmitGift}
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
