import React, { useState, useEffect, useCallback } from 'react';
import {
  addHerbalConsultation,
  updateHerbalConsultation,
  getHerbalPurposes,
  getNokryongTypes,
  getHerbalDiseaseTags,
  type HerbalConsultation,
  type HerbalDiseaseTag,
} from '../../lib/api';

const DOCTORS = ['강희종', '김대현', '임세열', '전인태'];

const CONSULT_TYPES = ['약초진', '연복', '재초진', '점검', '마무리'];

const TREATMENT_PERIODS = ['15일', '1개월', '3개월', '6개월', '1년', '1년이상'];

const VISIT_PATTERNS = ['15일', '30일'];

const NOKRYONG_RECOMMENDATIONS = ['녹용필수', '녹용권유', '녹용배제', '언급없음'];

const HERBAL_PAYMENTS = ['15일분', '1개월분', '2개월분', '3개월분', '6개월분', '결제실패'];

const NOKRYONG_PAYMENT_TYPES = ['매번결제', '함께결제'];

interface Props {
  patientId: number;
  chartNumber: string;
  patientName: string;
  mainDoctor?: string;
  editData?: HerbalConsultation;
  onClose: () => void;
  onSuccess: () => void;
}

function getCurrentDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function HerbalConsultationModal({
  patientId, chartNumber, patientName, mainDoctor, editData, onClose, onSuccess
}: Props) {
  const isEdit = !!editData;

  // 상담 정보
  const [consultDate, setConsultDate] = useState(editData?.consult_date || getCurrentDate());
  const [doctor, setDoctor] = useState(editData?.doctor || mainDoctor || '');
  const [consultType, setConsultType] = useState(editData?.consult_type || '약초진');
  const [purpose, setPurpose] = useState(editData?.purpose || '');
  const [diseaseTags, setDiseaseTags] = useState<string[]>(() => {
    try { return editData?.disease_tags ? JSON.parse(editData.disease_tags) : []; } catch { return []; }
  });
  const [diseaseInput, setDiseaseInput] = useState('');
  const [treatmentPeriod, setTreatmentPeriod] = useState<string[]>(() => {
    if (!editData?.treatment_period) return [];
    return editData.treatment_period.includes('~')
      ? editData.treatment_period.split('~').map(s => s.trim())
      : [editData.treatment_period];
  });
  const [visitPattern, setVisitPattern] = useState(editData?.visit_pattern || '');
  const [nokryongRec, setNokryongRec] = useState(editData?.nokryong_recommendation || '언급없음');

  // 후상담
  const [followUpStaff, setFollowUpStaff] = useState(editData?.follow_up_staff || '');
  const [herbalPayment, setHerbalPayment] = useState(editData?.herbal_payment || '');
  const [nokryongType, setNokryongType] = useState(editData?.nokryong_type || '');
  const [nokryongPayment, setNokryongPayment] = useState(editData?.nokryong_payment || '');
  const [followUpMemo, setFollowUpMemo] = useState(editData?.follow_up_memo || '');

  // DB 데이터
  const [purposes, setPurposes] = useState<string[]>([]);
  const [nokryongTypes, setNokryongTypes] = useState<string[]>([]);
  const [allDiseaseTags, setAllDiseaseTags] = useState<HerbalDiseaseTag[]>([]);

  const [isSaving, setIsSaving] = useState(false);

  const isDirty = !!purpose || diseaseTags.length > 0 || treatmentPeriod.length > 0 || !!followUpMemo;

  const handleClose = useCallback(() => {
    if (isDirty && !isEdit) {
      if (!window.confirm('저장하지 않고 닫으시겠습니까?')) return;
    }
    onClose();
  }, [isDirty, isEdit, onClose]);

  useEffect(() => {
    (async () => {
      const [p, n, d] = await Promise.all([getHerbalPurposes(), getNokryongTypes(), getHerbalDiseaseTags()]);
      setPurposes(p);
      setNokryongTypes(n);
      setAllDiseaseTags(d);
      if (!editData && p.length > 0 && !purpose) setPurpose(p[0]);
    })();
  }, []);

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

  const filteredTags = allDiseaseTags.filter(
    t => t.name.toLowerCase().includes(diseaseInput.toLowerCase()) && !diseaseTags.includes(t.name)
  );

  const toggleTreatmentPeriod = (p: string) => {
    setTreatmentPeriod(prev => {
      if (prev.includes(p)) return prev.filter(x => x !== p);
      if (prev.length >= 2) return [prev[1], p];
      return [...prev, p];
    });
  };

  const treatmentPeriodDisplay = treatmentPeriod.length === 2
    ? `${treatmentPeriod[0]}~${treatmentPeriod[1]}`
    : treatmentPeriod[0] || '';

  const handleSave = async () => {
    if (!consultDate || !doctor || !consultType) {
      alert('진료일, 담당의, 상담유형을 입력해주세요.');
      return;
    }
    setIsSaving(true);
    try {
      const payload = {
        patient_id: patientId,
        chart_number: chartNumber,
        patient_name: patientName,
        consult_date: consultDate,
        doctor,
        consult_type: consultType,
        purpose,
        disease_tags: JSON.stringify(diseaseTags),
        treatment_period: treatmentPeriodDisplay,
        visit_pattern: visitPattern,
        nokryong_recommendation: nokryongRec,
        follow_up_staff: followUpStaff,
        herbal_payment: herbalPayment,
        nokryong_type: nokryongType,
        nokryong_payment: nokryongPayment,
        follow_up_memo: followUpMemo,
      };

      if (isEdit && editData?.id) {
        await updateHerbalConsultation(editData.id, payload);
      } else {
        await addHerbalConsultation(payload);
      }
      onSuccess();
      onClose();
    } catch (err) {
      console.error('약상담 저장 오류:', err);
      alert('저장 실패');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="pkg-modal-overlay herbal-draft-overlay">
      <div className="herbal-consult-modal">
        <div className="hcm-header">
          <h3>{isEdit ? '약상담 수정' : '약상담 등록'}</h3>
          <span className="hcm-patient">{patientName} ({chartNumber.replace(/^0+/, '')})</span>
          <button className="btn-close" onClick={handleClose}><i className="fa-solid fa-xmark" /></button>
        </div>

        <div className="hcm-body">
          {/* 상담 정보 섹션 */}
          <div className="hcm-section">
            <h4>상담 정보</h4>

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
              <label>상담유형</label>
              <div className="hcm-btn-group">
                {CONSULT_TYPES.map(t => (
                  <button key={t} className={`hcm-btn ${consultType === t ? 'active' : ''}`} onClick={() => setConsultType(t)}>{t}</button>
                ))}
              </div>
            </div>

            <div className="hcm-row">
              <label>치료목적</label>
              <select value={purpose} onChange={e => setPurpose(e.target.value)}>
                {purposes.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            <div className="hcm-row">
              <label>질환명</label>
              <div className="hcm-tags-area">
                {diseaseTags.map(tag => (
                  <span key={tag} className="hcm-tag">
                    {tag}
                    <button onClick={() => setDiseaseTags(prev => prev.filter(t => t !== tag))}><i className="fa-solid fa-xmark" /></button>
                  </span>
                ))}
                <div className="hcm-tag-input-wrap">
                  <input
                    value={diseaseInput}
                    onChange={e => setDiseaseInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && diseaseInput.trim()) {
                        e.preventDefault();
                        if (!diseaseTags.includes(diseaseInput.trim())) {
                          setDiseaseTags(prev => [...prev, diseaseInput.trim()]);
                        }
                        setDiseaseInput('');
                      }
                    }}
                    placeholder="질환명 입력 (Enter)"
                  />
                  {diseaseInput && filteredTags.length > 0 && (
                    <div className="hcm-tag-suggestions">
                      {filteredTags.slice(0, 5).map(t => (
                        <div key={t.id} className="hcm-suggestion" onClick={() => {
                          setDiseaseTags(prev => [...prev, t.name]);
                          setDiseaseInput('');
                        }}>{t.name}</div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="hcm-row">
              <label>치료기간</label>
              <div className="hcm-btn-group">
                {TREATMENT_PERIODS.map(p => (
                  <button key={p} className={`hcm-btn ${treatmentPeriod.includes(p) ? 'active' : ''}`} onClick={() => toggleTreatmentPeriod(p)}>{p}</button>
                ))}
              </div>
              {treatmentPeriod.length === 2 && (
                <span className="hcm-period-display">{treatmentPeriodDisplay}</span>
              )}
            </div>

            <div className="hcm-row">
              <label>내원패턴</label>
              <div className="hcm-btn-group">
                {VISIT_PATTERNS.map(p => (
                  <button key={p} className={`hcm-btn ${visitPattern === p ? 'active' : ''}`} onClick={() => setVisitPattern(visitPattern === p ? '' : p)}>{p}</button>
                ))}
              </div>
            </div>

            <div className="hcm-row">
              <label>녹용권유</label>
              <div className="hcm-btn-group">
                {NOKRYONG_RECOMMENDATIONS.map(r => (
                  <button key={r} className={`hcm-btn ${nokryongRec === r ? 'active' : ''}`} onClick={() => setNokryongRec(r)}>{r}</button>
                ))}
              </div>
            </div>
          </div>

          {/* 후상담 섹션 */}
          <div className="hcm-section">
            <h4>후상담 및 결제</h4>

            <div className="hcm-row">
              <label>후상담 담당</label>
              <input type="text" value={followUpStaff} onChange={e => setFollowUpStaff(e.target.value)} placeholder="담당자" />
            </div>

            <div className="hcm-row">
              <label>맞춤한약 결제</label>
              <div className="hcm-btn-group wrap">
                {HERBAL_PAYMENTS.map(p => (
                  <button key={p} className={`hcm-btn ${herbalPayment === p ? 'active' : ''} ${p === '결제실패' ? 'fail' : ''}`} onClick={() => setHerbalPayment(herbalPayment === p ? '' : p)}>{p}</button>
                ))}
              </div>
            </div>

            <div className="hcm-row">
              <label>녹용 종류</label>
              <div className="hcm-btn-group">
                <button className={`hcm-btn ${nokryongType === '' ? 'active' : ''}`} onClick={() => setNokryongType('')}>선택안함</button>
                {nokryongTypes.map(t => (
                  <button key={t} className={`hcm-btn ${nokryongType === t ? 'active' : ''}`} onClick={() => setNokryongType(t)}>{t}</button>
                ))}
              </div>
            </div>

            {nokryongType && (
              <div className="hcm-row">
                <label>녹용 결제</label>
                <div className="hcm-btn-group">
                  {NOKRYONG_PAYMENT_TYPES.map(p => (
                    <button key={p} className={`hcm-btn ${nokryongPayment === p ? 'active' : ''}`} onClick={() => setNokryongPayment(nokryongPayment === p ? '' : p)}>{p}</button>
                  ))}
                </div>
              </div>
            )}

            <div className="hcm-row">
              <label>후상담 메모</label>
              <textarea
                value={followUpMemo}
                onChange={e => setFollowUpMemo(e.target.value)}
                placeholder="후상담 회고 내용"
                rows={3}
              />
            </div>
          </div>
        </div>

        <div className="hcm-footer">
          <button className="hcm-cancel" onClick={handleClose}>취소</button>
          <button className="hcm-save" onClick={handleSave} disabled={isSaving}>
            {isSaving ? '저장중...' : isEdit ? '수정' : '등록'}
          </button>
        </div>
      </div>
    </div>
  );
}
