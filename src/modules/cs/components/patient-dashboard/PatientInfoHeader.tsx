/**
 * 환자 정보 헤더 컴포넌트
 */

import React from 'react';
import type { LocalPatient, MssqlPatient } from '../../lib/patientSync';

interface PatientInfoHeaderProps {
  patient: LocalPatient;
  mssqlData?: MssqlPatient | null;
  onReservation?: () => void;
  onClose: () => void;
}

const PatientInfoHeader: React.FC<PatientInfoHeaderProps> = ({
  patient,
  mssqlData,
  onReservation,
  onClose,
}) => {
  // 나이 계산
  const calculateAge = (birthDate: string | null): number | null => {
    if (!birthDate) return null;
    const birth = new Date(birthDate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  const age = calculateAge(patient.birth_date);
  const genderIcon = patient.gender === '남' ? 'fa-mars' : patient.gender === '여' ? 'fa-venus' : '';

  // 소개경로 표시
  const referralInfo = mssqlData?.referral_type
    ? `${mssqlData.referral_type}${mssqlData.referral_detail ? ` - ${mssqlData.referral_detail}` : ''}`
    : null;

  return (
    <div className="patient-info-header">
      <div className="patient-main-info">
        <div className="patient-identity">
          <span className="patient-name">{patient.name}</span>
          <span className="patient-chart">({patient.chart_number})</span>
          {patient.gender && (
            <span className={`patient-gender ${patient.gender === '남' ? 'male' : 'female'}`}>
              <i className={`fa-solid ${genderIcon}`}></i>
              {patient.gender}
            </span>
          )}
          {age !== null && <span className="patient-age">{age}세</span>}
        </div>

        <div className="patient-contact">
          {patient.phone && (
            <a href={`tel:${patient.phone}`} className="patient-phone">
              <i className="fa-solid fa-phone"></i>
              {patient.phone}
            </a>
          )}
        </div>
      </div>

      <div className="patient-meta-info">
        {patient.first_visit_date && (
          <span className="meta-item">
            <i className="fa-solid fa-calendar-check"></i>
            초진: {patient.first_visit_date}
          </span>
        )}
        {patient.last_visit_date && (
          <span className="meta-item">
            <i className="fa-solid fa-clock-rotate-left"></i>
            최근: {patient.last_visit_date}
          </span>
        )}
        {mssqlData?.main_doctor && (
          <span className="meta-item">
            <i className="fa-solid fa-user-doctor"></i>
            담당: {mssqlData.main_doctor}
          </span>
        )}
        {referralInfo && (
          <span className="meta-item referral">
            <i className="fa-solid fa-share-nodes"></i>
            {referralInfo}
          </span>
        )}
      </div>

      <div className="header-actions">
        {onReservation && (
          <button className="btn-header-action reservation" onClick={onReservation}>
            <i className="fa-solid fa-calendar-plus"></i>
            예약
          </button>
        )}
        <button className="btn-header-close" onClick={onClose}>
          <i className="fa-solid fa-xmark"></i>
        </button>
      </div>
    </div>
  );
};

export default PatientInfoHeader;
