import React, { useState, useEffect, useCallback } from 'react';
import MedicineSearchSelect, { type SelectedMedicine } from '../herbal-draft/MedicineSearchSelect';
import { createMedicineUsage } from '../../lib/api';

const DOCTORS = ['강희종', '김대현', '임세열', '전인태'];
const CONSULT_METHODS = ['원장실', '침구실', '전화', '카톡'];
const PURPOSES = ['상비약', '감기약', '테스트', '보완', '증정'];
const DELIVERY_OPTIONS = ['내원', '현관', '택배', '퀵'];

interface Props {
  patientId: number;
  chartNumber: string;
  patientName: string;
  mainDoctor?: string;
  onClose: () => void;
  onSuccess: () => void;
}

function getCurrentDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function MedicineQuickModal({ patientId, chartNumber, patientName, mainDoctor, onClose, onSuccess }: Props) {
  const [consultDate, setConsultDate] = useState(getCurrentDate());
  const [doctor, setDoctor] = useState(mainDoctor || '');
  const [consultMethod, setConsultMethod] = useState('원장실');
  const [purpose, setPurpose] = useState('상비약');
  const [medicines, setMedicines] = useState<SelectedMedicine[]>([]);
  const [delivery, setDelivery] = useState('내원');
  const [memo, setMemo] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const isDirty = medicines.length > 0 || memo.trim() !== '';

  const handleClose = useCallback(() => {
    if (isDirty) {
      if (!window.confirm('저장하지 않고 닫으시겠습니까?')) return;
    }
    onClose();
  }, [isDirty, onClose]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKey, true);
    return () => window.removeEventListener('keydown', handleKey, true);
  }, [handleClose]);

  const handleSave = async () => {
    if (medicines.length === 0) {
      alert('처방을 선택해주세요.');
      return;
    }
    setIsSaving(true);
    try {
      const memoFull = [consultMethod, purpose, delivery !== '내원' ? delivery : '', memo].filter(Boolean).join(' ');
      for (const med of medicines) {
        await createMedicineUsage({
          patient_id: patientId,
          chart_number: chartNumber,
          patient_name: patientName,
          receipt_id: undefined as any,
          usage_date: consultDate,
          medicine_name: med.name,
          quantity: med.quantity,
          memo: memoFull || undefined as any,
          mssql_detail_id: undefined as any,
        });
      }
      onSuccess();
      onClose();
    } catch (err) {
      console.error('상비약 저장 오류:', err);
      alert('저장 실패');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="pkg-modal-overlay herbal-draft-overlay">
      <div className="herbal-consult-modal" style={{ width: '480px' }}>
        <div className="hcm-header">
          <h3>상비약 기록</h3>
          <span className="hcm-patient">{patientName} ({chartNumber.replace(/^0+/, '')})</span>
          <button className="btn-close" onClick={handleClose}><i className="fa-solid fa-xmark" /></button>
        </div>

        <div className="hcm-body">
          <div className="hcm-row">
            <label>진료일</label>
            <input type="date" value={consultDate} onChange={e => setConsultDate(e.target.value)} />
          </div>

          <div className="hcm-row">
            <label>담당의</label>
            <div className="hcm-btn-group">
              {DOCTORS.map(d => (
                <button key={d} className={`hcm-btn ${doctor === d ? 'active' : ''}`} onClick={() => setDoctor(d)}>{d}</button>
              ))}
            </div>
          </div>

          <div className="hcm-row">
            <label>상담방식</label>
            <div className="hcm-btn-group">
              {CONSULT_METHODS.map(m => (
                <button key={m} className={`hcm-btn ${consultMethod === m ? 'active' : ''}`} onClick={() => setConsultMethod(m)}>{m}</button>
              ))}
            </div>
          </div>

          <div className="hcm-row">
            <label>처방목적</label>
            <div className="hcm-btn-group">
              {PURPOSES.map(p => (
                <button key={p} className={`hcm-btn ${purpose === p ? 'active' : ''}`} onClick={() => setPurpose(p)}>{p}</button>
              ))}
            </div>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: '12px 0' }} />

          <div className="hcm-row" style={{ alignItems: 'flex-start' }}>
            <label>처방 선택</label>
            <div style={{ flex: 1 }}>
              <MedicineSearchSelect medicines={medicines} onChange={setMedicines} hideLabel />
            </div>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: '12px 0' }} />

          <div className="hcm-row">
            <label>수령방법</label>
            <div className="hcm-btn-group">
              {DELIVERY_OPTIONS.map(d => (
                <button key={d} className={`hcm-btn ${delivery === d ? 'active' : ''}`} onClick={() => setDelivery(d)}>{d}</button>
              ))}
            </div>
          </div>

          <div className="hcm-row">
            <label>메모</label>
            <input
              type="text"
              value={memo}
              onChange={e => setMemo(e.target.value)}
              placeholder="메모 (선택)"
              onKeyDown={e => { if (e.key === 'Enter' && medicines.length > 0) handleSave(); }}
            />
          </div>
        </div>

        <div className="hcm-footer">
          <button className="hcm-cancel" onClick={handleClose}>취소</button>
          <button className="hcm-save" onClick={handleSave} disabled={isSaving || medicines.length === 0}>
            {isSaving ? '저장중...' : `저장 (${medicines.length}건)`}
          </button>
        </div>
      </div>
    </div>
  );
}
