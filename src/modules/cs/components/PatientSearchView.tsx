import React, { useState } from 'react';
import type { PortalUser } from '@shared/types';

// MSSQL 서버 URL
const MSSQL_API_URL = import.meta.env.VITE_MSSQL_API_URL || 'http://192.168.0.173:3100';

interface PatientSearchViewProps {
  user: PortalUser;
}

interface Patient {
  id: number;
  chartNo: string;
  name: string;
  phone?: string;
  birthday?: string;
  gender?: string;
  address?: string;
  memo?: string;
  lastVisit?: string;
}

function PatientSearchView({ user }: PatientSearchViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 환자 검색
  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      setPatients([]);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${MSSQL_API_URL}/api/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sql: `
            SELECT TOP 50
              Id as id,
              ChartNo as chartNo,
              Name as name,
              HP as phone,
              Birthday as birthday,
              Sex as gender,
              Address as address,
              CONVERT(VARCHAR, RecentDate, 23) as lastVisit
            FROM Client
            WHERE Name LIKE '%${searchTerm}%'
               OR ChartNo LIKE '%${searchTerm}%'
               OR HP LIKE '%${searchTerm}%'
            ORDER BY RecentDate DESC
          `
        })
      });

      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }

      setPatients(data.recordset || []);
    } catch (err: any) {
      console.error('환자 검색 실패:', err);
      setError('검색에 실패했습니다.');
      setPatients([]);
    } finally {
      setIsLoading(false);
    }
  };

  // 엔터키 검색
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  // 환자 선택
  const handlePatientClick = (patient: Patient) => {
    setSelectedPatient(patient);
  };

  // 예약으로 이동
  const handleReservation = () => {
    if (!selectedPatient) return;
    const params = new URLSearchParams({
      patientId: String(selectedPatient.id),
      chartNo: selectedPatient.chartNo,
      patientName: selectedPatient.name,
      phone: selectedPatient.phone || '',
    });
    window.open(`/reservation?${params.toString()}`, '_blank');
  };

  // 생년월일 포맷
  const formatBirthday = (birthday?: string) => {
    if (!birthday) return '-';
    // YYYYMMDD 또는 YYYY-MM-DD 형식 처리
    const clean = birthday.replace(/-/g, '');
    if (clean.length === 8) {
      return `${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}`;
    }
    return birthday;
  };

  // 성별 표시
  const formatGender = (gender?: string) => {
    if (!gender) return '-';
    if (gender === '1' || gender === 'M' || gender === '남') return '남';
    if (gender === '2' || gender === 'F' || gender === '여') return '여';
    return gender;
  };

  return (
    <div className="patient-search-view">
      {/* 검색 바 */}
      <div className="patient-search-bar">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="환자명, 차트번호 또는 연락처로 검색..."
          className="search-input"
          autoFocus
        />
        <button onClick={handleSearch} className="search-btn" disabled={isLoading}>
          {isLoading ? '검색 중...' : '🔍 검색'}
        </button>
      </div>

      {/* 에러 */}
      {error && (
        <div className="search-error">{error}</div>
      )}

      {/* 검색 결과 */}
      <div className="patient-search-content">
        {/* 환자 목록 */}
        <div className="patient-list-panel">
          {patients.length === 0 && !isLoading && (
            <div className="patient-empty">
              {searchTerm ? '검색 결과가 없습니다.' : '환자명, 차트번호 또는 연락처를 입력하세요.'}
            </div>
          )}
          {patients.map((patient) => (
            <div
              key={patient.id}
              className={`patient-list-item ${selectedPatient?.id === patient.id ? 'selected' : ''}`}
              onClick={() => handlePatientClick(patient)}
            >
              <div className="patient-list-main">
                <span className="patient-chart">{patient.chartNo}</span>
                <span className="patient-name">{patient.name}</span>
                <span className="patient-gender">{formatGender(patient.gender)}</span>
              </div>
              <div className="patient-list-sub">
                <span className="patient-phone">{patient.phone || '-'}</span>
                <span className="patient-last-visit">
                  {patient.lastVisit ? `최근: ${patient.lastVisit}` : ''}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* 환자 상세 */}
        {selectedPatient && (
          <div className="patient-detail-panel">
            <div className="patient-detail-header">
              <h3>{selectedPatient.name}</h3>
              <span className="patient-detail-chart">{selectedPatient.chartNo}</span>
            </div>

            <div className="patient-detail-grid">
              <div className="detail-item">
                <label>연락처</label>
                <span>{selectedPatient.phone || '-'}</span>
              </div>
              <div className="detail-item">
                <label>생년월일</label>
                <span>{formatBirthday(selectedPatient.birthday)}</span>
              </div>
              <div className="detail-item">
                <label>성별</label>
                <span>{formatGender(selectedPatient.gender)}</span>
              </div>
              <div className="detail-item">
                <label>최근 내원</label>
                <span>{selectedPatient.lastVisit || '-'}</span>
              </div>
              <div className="detail-item full-width">
                <label>주소</label>
                <span>{selectedPatient.address || '-'}</span>
              </div>
            </div>

            <div className="patient-detail-actions">
              <button onClick={handleReservation} className="action-btn reservation">
                📅 예약 등록
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default PatientSearchView;
