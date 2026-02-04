/**
 * 로컬 환자 등록 모달
 * MSSQL(EMR) 없이 PostgreSQL에만 환자 등록
 * 차트번호: L-00001 형식
 */

import React, { useState } from 'react';
import { createLocalPatient, type CreateLocalPatientParams } from '../lib/patientSync';

interface LocalPatientRegisterModalProps {
  onClose: () => void;
  onSuccess: (patientId: number, chartNumber: string, patientName: string) => void;
}

function LocalPatientRegisterModal({ onClose, onSuccess }: LocalPatientRegisterModalProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<CreateLocalPatientParams>({
    name: '',
    phone: '',
    birth_date: '',
    gender: undefined,
    address: '',
    memo: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      alert('환자 이름을 입력해주세요.');
      return;
    }

    setIsSaving(true);
    try {
      const patient = await createLocalPatient(formData);
      if (patient) {
        alert(`환자 등록 완료\n차트번호: ${patient.chart_number}`);
        onSuccess(patient.id, patient.chart_number || '', patient.name);
        onClose();
      } else {
        alert('환자 등록에 실패했습니다.');
      }
    } catch (err) {
      console.error('환자 등록 오류:', err);
      alert('환자 등록 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
        <div className="modal-header">
          <h3>
            <i className="fa-solid fa-user-plus" style={{ marginRight: '8px', color: '#6366f1' }}></i>
            로컬 환자 등록
          </h3>
          <button className="btn-close" onClick={onClose}>
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ padding: '20px' }}>
            <div style={{
              background: '#f0f9ff',
              border: '1px solid #bae6fd',
              borderRadius: '8px',
              padding: '12px',
              marginBottom: '20px',
              fontSize: '13px',
              color: '#0369a1'
            }}>
              <i className="fa-solid fa-info-circle" style={{ marginRight: '6px' }}></i>
              EMR(MSSQL) 연동 없이 로컬에서만 관리되는 환자입니다.
              <br />
              차트번호는 <strong>L-00001</strong> 형식으로 자동 생성됩니다.
            </div>

            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600' }}>
                환자 이름 <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder="홍길동"
                required
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
              />
            </div>

            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600' }}>연락처</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                placeholder="010-0000-0000"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600' }}>생년월일</label>
                <input
                  type="date"
                  value={formData.birth_date}
                  onChange={e => setFormData({ ...formData, birth_date: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                />
              </div>

              <div className="form-group" style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600' }}>성별</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, gender: '남' })}
                    style={{
                      flex: 1,
                      padding: '10px',
                      border: formData.gender === '남' ? '2px solid #3b82f6' : '1px solid #d1d5db',
                      borderRadius: '6px',
                      background: formData.gender === '남' ? '#eff6ff' : 'white',
                      color: formData.gender === '남' ? '#1d4ed8' : '#374151',
                      fontWeight: formData.gender === '남' ? '600' : '400',
                      cursor: 'pointer'
                    }}
                  >
                    남
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, gender: '여' })}
                    style={{
                      flex: 1,
                      padding: '10px',
                      border: formData.gender === '여' ? '2px solid #ec4899' : '1px solid #d1d5db',
                      borderRadius: '6px',
                      background: formData.gender === '여' ? '#fdf2f8' : 'white',
                      color: formData.gender === '여' ? '#be185d' : '#374151',
                      fontWeight: formData.gender === '여' ? '600' : '400',
                      cursor: 'pointer'
                    }}
                  >
                    여
                  </button>
                </div>
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600' }}>주소</label>
              <input
                type="text"
                value={formData.address}
                onChange={e => setFormData({ ...formData, address: e.target.value })}
                placeholder="주소 입력"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
              />
            </div>

            <div className="form-group">
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600' }}>메모</label>
              <textarea
                value={formData.memo}
                onChange={e => setFormData({ ...formData, memo: e.target.value })}
                placeholder="환자 관련 메모"
                rows={3}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                  resize: 'vertical'
                }}
              />
            </div>
          </div>

          <div className="modal-footer" style={{
            padding: '16px 20px',
            borderTop: '1px solid #e5e7eb',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '8px'
          }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '10px 20px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                background: 'white',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isSaving}
              style={{
                padding: '10px 20px',
                border: 'none',
                borderRadius: '6px',
                background: '#6366f1',
                color: 'white',
                cursor: isSaving ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: '600',
                opacity: isSaving ? 0.7 : 1
              }}
            >
              {isSaving ? (
                <>
                  <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: '6px' }}></i>
                  등록 중...
                </>
              ) : (
                <>
                  <i className="fa-solid fa-check" style={{ marginRight: '6px' }}></i>
                  환자 등록
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default LocalPatientRegisterModal;
