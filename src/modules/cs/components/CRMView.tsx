import React, { useState, useCallback, useEffect } from 'react';
import type { PortalUser } from '@shared/types';
import type { PatientNote, PackageStatusSummary, StaffRole } from '../types/crm';
import {
  getPatientNotes,
  getPatientPackageStatus,
  getPatientNoteStats,
} from '../lib/patientCrmApi';
import PatientNoteTimeline from './PatientNoteTimeline';
import PatientNoteInput from './PatientNoteInput';
import PatientPackageStatus from './PatientPackageStatus';
import PatientHappyCallHistory from './PatientHappyCallHistory';
import { OutboundCallCenter } from './call-center';
import { CRM_TAB_LABELS, type CRMTabType } from '../types/crm';

// CRM 모드: 환자관리 또는 콜센터
type CRMMode = 'patient' | 'callcenter';

const MSSQL_API_BASE = import.meta.env.VITE_MSSQL_API_URL || 'http://192.168.0.173:3100';

interface CRMViewProps {
  user: PortalUser;
}

interface PatientSearchResult {
  id: number;
  name: string;
  chart_no: string;
  birth?: string | null;
  sex?: 'M' | 'F';
  phone?: string | null;
  last_visit?: string | null;
}

const CRMView: React.FC<CRMViewProps> = ({ user }) => {
  // CRM 모드 상태
  const [crmMode, setCrmMode] = useState<CRMMode>('callcenter');

  // 환자 검색 상태
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<PatientSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // 선택된 환자
  const [selectedPatient, setSelectedPatient] = useState<PatientSearchResult | null>(null);

  // CRM 데이터
  const [activeTab, setActiveTab] = useState<CRMTabType>('overview');
  const [notes, setNotes] = useState<PatientNote[]>([]);
  const [packageStatus, setPackageStatus] = useState<PackageStatusSummary | null>(null);
  const [noteStats, setNoteStats] = useState<{ total: number; activeComplaints: number }>({ total: 0, activeComplaints: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [editingNote, setEditingNote] = useState<PatientNote | null>(null);

  // 스태프 역할 결정 (user.role 기반)
  const staffRole: StaffRole = user.role === 'medical_staff'
    ? 'doctor'
    : user.role === 'treatment'
    ? 'treatment'
    : 'desk';

  // 환자 검색
  const handleSearch = useCallback(async () => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(`${MSSQL_API_BASE}/api/patients/search?q=${encodeURIComponent(searchTerm)}`);
      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.slice(0, 20)); // 최대 20개만 표시
      }
    } catch (error) {
      console.error('환자 검색 오류:', error);
    } finally {
      setIsSearching(false);
    }
  }, [searchTerm]);

  // 엔터 키로 검색
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  // 환자 선택 시 CRM 데이터 로드
  const loadCRMData = useCallback(async (patientId: number) => {
    setIsLoading(true);
    try {
      const [notesData, statusData, statsData] = await Promise.all([
        getPatientNotes(patientId),
        getPatientPackageStatus(patientId),
        getPatientNoteStats(patientId),
      ]);

      setNotes(notesData);
      setPackageStatus(statusData);
      setNoteStats({
        total: statsData.total,
        activeComplaints: statsData.activeComplaints,
      });
    } catch (error) {
      console.error('CRM 데이터 로드 오류:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 환자 선택
  const handleSelectPatient = (patient: PatientSearchResult) => {
    setSelectedPatient(patient);
    setActiveTab('overview');
    setShowNoteInput(false);
    setEditingNote(null);
    loadCRMData(patient.id);
  };

  // 메모 새로고침
  const handleRefresh = useCallback(() => {
    if (selectedPatient) {
      loadCRMData(selectedPatient.id);
    }
    setShowNoteInput(false);
    setEditingNote(null);
  }, [selectedPatient, loadCRMData]);

  // 메모 수정
  const handleEditNote = useCallback((note: PatientNote) => {
    setEditingNote(note);
    setShowNoteInput(true);
  }, []);

  // 환자 목록으로 돌아가기
  const handleBackToSearch = () => {
    setSelectedPatient(null);
    setNotes([]);
    setPackageStatus(null);
    setNoteStats({ total: 0, activeComplaints: 0 });
  };

  return (
    <div className="crm-view">
      {/* 모드 전환 탭 */}
      <div className="crm-mode-tabs">
        <button
          className={`crm-mode-tab ${crmMode === 'callcenter' ? 'active' : ''}`}
          onClick={() => setCrmMode('callcenter')}
        >
          <i className="fa-solid fa-phone-volume"></i>
          아웃바운드 콜센터
        </button>
        <button
          className={`crm-mode-tab ${crmMode === 'patient' ? 'active' : ''}`}
          onClick={() => setCrmMode('patient')}
        >
          <i className="fa-solid fa-user"></i>
          환자별 관리
        </button>
      </div>

      {/* 콜센터 모드 */}
      {crmMode === 'callcenter' && (
        <OutboundCallCenter user={user} />
      )}

      {/* 환자관리 모드 */}
      {crmMode === 'patient' && !selectedPatient && (
        // 환자 검색 화면
        <div className="crm-search-panel">
          <div className="crm-search-header">
            <h2>환자별 CRM</h2>
            <p>환자를 검색하여 통합 관리 화면을 확인하세요</p>
          </div>

          <div className="crm-search-box">
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="환자명 또는 차트번호 검색..."
              autoFocus
            />
            <button onClick={handleSearch} disabled={isSearching}>
              {isSearching ? '검색중...' : '검색'}
            </button>
          </div>

          {searchResults.length > 0 && (
            <div className="crm-search-results">
              <table>
                <thead>
                  <tr>
                    <th>차트번호</th>
                    <th>환자명</th>
                    <th>성별/나이</th>
                    <th>최근방문</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {searchResults.map(patient => (
                    <tr key={patient.id}>
                      <td>{patient.chart_no?.replace(/^0+/, '')}</td>
                      <td className="patient-name">{patient.name}</td>
                      <td>
                        {patient.sex === 'M' ? '남' : patient.sex === 'F' ? '여' : '-'}
                        {patient.birth ? `/${new Date().getFullYear() - parseInt(patient.birth.substring(0, 4))}세` : ''}
                      </td>
                      <td>{patient.last_visit || '-'}</td>
                      <td>
                        <button
                          className="btn-select"
                          onClick={() => handleSelectPatient(patient)}
                        >
                          선택
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {searchTerm && searchResults.length === 0 && !isSearching && (
            <div className="crm-no-results">
              <p>검색 결과가 없습니다.</p>
            </div>
          )}
        </div>
      )}

      {/* CRM 상세 화면 */}
      {crmMode === 'patient' && selectedPatient && (
        <div className="crm-detail-panel">
          {/* 헤더 */}
          <div className="crm-detail-header">
            <button className="btn-back" onClick={handleBackToSearch}>
              <i className="fa-solid fa-arrow-left"></i> 돌아가기
            </button>
            <div className="crm-patient-info">
              <span className="patient-name">{selectedPatient.name}</span>
              <span className="patient-chart">({selectedPatient.chart_no?.replace(/^0+/, '')})</span>
              {selectedPatient.sex && (
                <span className="patient-gender-age">
                  {selectedPatient.sex === 'M' ? '남' : '여'}
                  {selectedPatient.birth ? `/${new Date().getFullYear() - parseInt(selectedPatient.birth.substring(0, 4))}세` : ''}
                </span>
              )}
              {noteStats.activeComplaints > 0 && (
                <span className="complaint-badge">
                  컴플레인 {noteStats.activeComplaints}
                </span>
              )}
            </div>
          </div>

          {/* 탭 */}
          <div className="crm-tabs">
            {(['overview', 'notes', 'history', 'happycall'] as CRMTabType[]).map(tab => (
              <button
                key={tab}
                className={`crm-tab ${activeTab === tab ? 'active' : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                {CRM_TAB_LABELS[tab]}
              </button>
            ))}
          </div>

          {/* 본문 */}
          <div className="crm-detail-body">
            {isLoading ? (
              <div className="crm-loading">
                <span>로딩 중...</span>
              </div>
            ) : (
              <>
                {/* 종합현황 탭 */}
                {activeTab === 'overview' && (
                  <div className="crm-overview">
                    <div className="crm-overview-left">
                      <h4>패키지 현황</h4>
                      {packageStatus && (
                        <PatientPackageStatus status={packageStatus} />
                      )}
                    </div>
                    <div className="crm-overview-right">
                      <div className="crm-section-header">
                        <h4>최근 메모</h4>
                        <button
                          className="btn-add-note"
                          onClick={() => setShowNoteInput(!showNoteInput)}
                        >
                          + 메모 추가
                        </button>
                      </div>
                      {showNoteInput && (
                        <PatientNoteInput
                          patientId={selectedPatient.id}
                          chartNumber={selectedPatient.chart_no}
                          patientName={selectedPatient.name}
                          staffName={user.name}
                          staffRole={staffRole}
                          editNote={editingNote || undefined}
                          onSuccess={handleRefresh}
                          onCancel={() => {
                            setShowNoteInput(false);
                            setEditingNote(null);
                          }}
                        />
                      )}
                      <PatientNoteTimeline
                        notes={notes.slice(0, 5)}
                        onRefresh={handleRefresh}
                        onEdit={handleEditNote}
                      />
                      {notes.length > 5 && (
                        <button
                          className="btn-view-all"
                          onClick={() => setActiveTab('notes')}
                        >
                          전체 메모 보기 ({notes.length}개)
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* 메모/문의 탭 */}
                {activeTab === 'notes' && (
                  <div className="crm-notes">
                    <div className="crm-section-header">
                      <h4>메모/문의 기록</h4>
                      <button
                        className="btn-add-note"
                        onClick={() => setShowNoteInput(!showNoteInput)}
                      >
                        + 새 메모
                      </button>
                    </div>
                    {showNoteInput && (
                      <PatientNoteInput
                        patientId={selectedPatient.id}
                        chartNumber={selectedPatient.chart_no}
                        patientName={selectedPatient.name}
                        staffName={user.name}
                        staffRole={staffRole}
                        editNote={editingNote || undefined}
                        onSuccess={handleRefresh}
                        onCancel={() => {
                          setShowNoteInput(false);
                          setEditingNote(null);
                        }}
                      />
                    )}
                    <PatientNoteTimeline
                      notes={notes}
                      onRefresh={handleRefresh}
                      onEdit={handleEditNote}
                    />
                  </div>
                )}

                {/* 수납이력 탭 */}
                {activeTab === 'history' && (
                  <div className="crm-history">
                    <p className="crm-placeholder">
                      수납 이력은 수납관리 화면에서 환자를 선택하여 확인하세요.
                    </p>
                  </div>
                )}

                {/* 해피콜 탭 */}
                {activeTab === 'happycall' && (
                  <div className="crm-happycall">
                    <PatientHappyCallHistory
                      patientId={selectedPatient.id}
                      chartNumber={selectedPatient.chart_no}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CRMView;
