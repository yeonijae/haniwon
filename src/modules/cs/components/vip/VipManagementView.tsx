/**
 * VIP 관리 페이지
 * 연도별 VIP 목록 조회, 수동 추가/해제, 후보 자동 생성
 */
import React, { useState, useEffect, useCallback } from 'react';
import type { PortalUser } from '@shared/types';
import {
  getVipListByYear, getVipStats, removeVip, updateVipGrade,
  generateVipCandidates, addVip, batchAddVip,
  type VipRecord, type VipCandidate, type VipStats, type VipCriteriaOptions, type RevenueCriteria,
} from '../../lib/vipApi';
import { searchLocalPatients, type LocalPatient } from '../../lib/patientSync';
import PatientDashboard from '../PatientDashboard';
import { getLocalPatientById } from '../../lib/patientSync';
import './VipManagement.css';

interface Props {
  user: PortalUser;
}

type ViewTab = 'list' | 'candidates';

export default function VipManagementView({ user }: Props) {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [tab, setTab] = useState<ViewTab>('list');
  const [records, setRecords] = useState<VipRecord[]>([]);
  const [candidates, setCandidates] = useState<VipCandidate[]>([]);
  const [stats, setStats] = useState<VipStats | null>(null);
  const [loading, setLoading] = useState(false);

  // 수동 추가
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<LocalPatient[]>([]);
  const [addGrade, setAddGrade] = useState<'VVIP' | 'VIP'>('VIP');
  const [addReason, setAddReason] = useState('');

  // 후보 기준
  const [revCriteria, setRevCriteria] = useState<RevenueCriteria | null>('total');
  const [useVisits, setUseVisits] = useState(true);
  const [useLoyalty, setUseLoyalty] = useState(true);
  const [familySum, setFamilySum] = useState(false);
  const [useReferral, setUseReferral] = useState(false);
  const [maxCount, setMaxCount] = useState(30);

  // 후보 선택
  const [selectedCandidates, setSelectedCandidates] = useState<Set<number>>(new Set());
  const [candidatesLoaded, setCandidatesLoaded] = useState(false);
  const [expandedFamily, setExpandedFamily] = useState<Set<number>>(new Set());

  // 정렬
  type SortKey = 'score' | 'revenue' | 'noncovered' | 'copay' | 'visit_count' | 'referral_count' | 'referral_total_revenue' | 'referral_noncovered';
  const [sortKey, setSortKey] = useState<SortKey>('score');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortKey(key); setSortDir('desc'); }
  };
  const sortedCandidates = [...candidates].sort((a, b) => {
    const av = (a as any)[sortKey] ?? 0;
    const bv = (b as any)[sortKey] ?? 0;
    return sortDir === 'desc' ? bv - av : av - bv;
  });
  const sortIcon = (key: SortKey) => sortKey === key ? (sortDir === 'desc' ? ' ▼' : ' ▲') : '';

  // 대시보드
  const [dashboardPatient, setDashboardPatient] = useState<LocalPatient | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [list, st] = await Promise.all([getVipListByYear(year), getVipStats(year)]);
      setRecords(list);
      setStats(st);
    } catch (err) {
      console.error('VIP 로드 실패:', err);
    }
    setLoading(false);
  }, [year]);

  const selectRevCriteria = (c: RevenueCriteria) => {
    setRevCriteria(prev => prev === c ? null : c);
  };

  const hasAnyCriteria = revCriteria !== null || useVisits || useLoyalty || useReferral;

  const loadCandidates = useCallback(async () => {
    if (!hasAnyCriteria) {
      alert('최소 하나의 기준을 선택해주세요.');
      return;
    }
    setLoading(true);
    try {
      const opts: VipCriteriaOptions = {
        revenueCriteria: revCriteria ? [revCriteria] : [],
        visits: useVisits,
        loyalty: useLoyalty,
        familySum,
        referral: useReferral,
        maxCount,
      };
      const c = await generateVipCandidates(year, maxCount, opts);
      setCandidates(c);
      setSelectedCandidates(new Set());
      setCandidatesLoaded(true);
    } catch (err) {
      console.error('VIP 후보 생성 실패:', err);
    }
    setLoading(false);
  }, [year, revCriteria, useVisits, useLoyalty, useReferral, maxCount, hasAnyCriteria]);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { setCandidatesLoaded(false); setCandidates([]); }, [tab, year]);

  const handleRemove = async (record: VipRecord) => {
    if (!confirm(`${record.name} (${record.chart_number})의 ${year}년 VIP를 해제하시겠습니까?`)) return;
    await removeVip(record.patient_id, year);
    loadData();
  };

  const handleToggleGrade = async (record: VipRecord) => {
    const newGrade = record.grade === 'VVIP' ? 'VIP' : 'VVIP';
    await updateVipGrade(record.id, newGrade);
    loadData();
  };

  const handlePatientClick = async (patientId: number) => {
    const p = await getLocalPatientById(patientId);
    if (p) setDashboardPatient(p);
  };

  // 수동 추가
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    const results = await searchLocalPatients(searchQuery.trim());
    setSearchResults(results);
  };

  const handleAddVip = async (patientId: number, name: string) => {
    await addVip(patientId, year, addGrade, addReason || `수동 추가`, undefined, user?.name);
    setShowAddModal(false);
    setSearchQuery('');
    setSearchResults([]);
    setAddReason('');
    loadData();
  };

  // 일괄 선정
  const handleBatchAdd = async () => {
    const selected = candidates.filter(c => selectedCandidates.has(c.patient_id));
    if (!selected.length) { alert('선정할 후보를 선택해주세요.'); return; }
    if (!confirm(`${selected.length}명을 ${year}년 VIP로 선정하시겠습니까?`)) return;
    const count = await batchAddVip(
      selected.map(c => ({ patient_id: c.patient_id, grade: c.suggested_grade, reason: c.reason, score: c.score })),
      year,
      user?.name,
    );
    alert(`${count}명 선정 완료`);
    setTab('list');
    loadData();
  };

  const toggleCandidate = (id: number) => {
    setSelectedCandidates(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAllCandidates = () => {
    if (selectedCandidates.size === candidates.length) {
      setSelectedCandidates(new Set());
    } else {
      setSelectedCandidates(new Set(candidates.map(c => c.patient_id)));
    }
  };

  if (dashboardPatient) {
    return (
      <PatientDashboard
        patient={dashboardPatient}
        user={user}
        isOpen={true}
        onClose={() => setDashboardPatient(null)}
      />
    );
  }

  return (
    <div className="vip-management">
      {/* 헤더 */}
      <div className="vip-header">
        <div className="vip-header-left">
          <h2>VIP 관리</h2>
          <div className="vip-year-nav">
            <button onClick={() => setYear(y => y - 1)}>◀</button>
            <span className="vip-year">{year}년</span>
            <button onClick={() => setYear(y => y + 1)}>▶</button>
            {year !== currentYear && (
              <button className="vip-btn-today" onClick={() => setYear(currentYear)}>올해</button>
            )}
          </div>
          {stats && (
            <div className="vip-stats">
              <span className="vip-stat vvip">👑 VVIP {stats.vvip_count}명</span>
              <span className="vip-stat vip">⭐ VIP {stats.vip_count}명</span>
              <span className="vip-stat total">전체 {stats.total}명</span>
            </div>
          )}
        </div>
        <div className="vip-header-right">
          <button className="vip-btn primary" onClick={() => setShowAddModal(true)}>
            <i className="fa-solid fa-plus" /> 수동 추가
          </button>
        </div>
      </div>

      {/* 탭 */}
      <div className="vip-tabs">
        <button className={`vip-tab ${tab === 'list' ? 'active' : ''}`} onClick={() => setTab('list')}>
          📋 VIP 목록
        </button>
        <button className={`vip-tab ${tab === 'candidates' ? 'active' : ''}`} onClick={() => setTab('candidates')}>
          🔍 후보 생성
        </button>
      </div>

      {/* 내용 */}
      <div className="vip-content">
        {loading ? (
          <div className="vip-loading">로딩 중...</div>
        ) : tab === 'list' ? (
          /* VIP 목록 */
          records.length === 0 ? (
            <div className="vip-empty">{year}년 VIP가 없습니다.</div>
          ) : (
            <table className="vip-table">
              <thead>
                <tr>
                  <th>등급</th>
                  <th>이름</th>
                  <th>차트</th>
                  <th>VIP 이력</th>
                  <th>선정사유</th>
                  <th>점수</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {records.map(r => (
                  <tr key={r.id}>
                    <td>
                      <span className={`vip-grade-badge ${r.grade.toLowerCase()}`} onClick={() => handleToggleGrade(r)} title="클릭하여 등급 변경">
                        {r.grade === 'VVIP' ? '👑 VVIP' : '⭐ VIP'}
                      </span>
                    </td>
                    <td>
                      <span className="vip-name" onClick={() => handlePatientClick(r.patient_id)}>
                        {r.name}
                      </span>
                    </td>
                    <td className="vip-chart">{r.chart_number}</td>
                    <td className="vip-years">
                      {r.vip_years?.map(y => (
                        <span key={y} className={`vip-year-chip ${y === year ? 'current' : ''}`}>
                          '{String(y).slice(2)}
                        </span>
                      ))}
                    </td>
                    <td className="vip-reason">{r.reason || '-'}</td>
                    <td className="vip-score">{r.score ?? '-'}</td>
                    <td>
                      <button className="vip-btn-remove" onClick={() => handleRemove(r)} title="해제">
                        <i className="fa-solid fa-xmark" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : (
          /* 후보 리스트 */
          <>
            {!candidatesLoaded ? (
              <div className="vip-candidate-start">
                <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 16 }}>
                  {year}년 VIP 후보를 생성합니다. 기준을 선택하세요. (복수 선택 가능)
                </p>
                <div className="vip-criteria-group">
                  <span className="vip-criteria-label">💰 매출</span>
                  <span className={`vip-criteria-chip ${revCriteria === 'total' ? 'active' : ''}`} onClick={() => selectRevCriteria('total')}>
                    총진료비
                  </span>
                  <span className={`vip-criteria-chip ${revCriteria === 'noncovered' ? 'active' : ''}`} onClick={() => selectRevCriteria('noncovered')}>
                    비급여
                  </span>
                  <span className={`vip-criteria-chip ${revCriteria === 'copay' ? 'active' : ''}`} onClick={() => selectRevCriteria('copay')}>
                    본인부담금
                  </span>
                </div>
                <div className="vip-criteria-group">
                  <span className="vip-criteria-label">📊 기타</span>
                  <span className={`vip-criteria-chip ${useVisits ? 'active' : ''}`} onClick={() => setUseVisits(v => !v)}>
                    🏥 내원횟수
                  </span>
                  <span className={`vip-criteria-chip ${useLoyalty ? 'active' : ''}`} onClick={() => setUseLoyalty(v => !v)}>
                    🤝 충성도
                  </span>
                  <span className={`vip-criteria-chip ${familySum ? 'active' : ''}`} onClick={() => setFamilySum(v => !v)}>
                    👨‍👩‍👧 가족합산
                  </span>
                  <span className={`vip-criteria-chip ${useReferral ? 'active' : ''}`} onClick={() => setUseReferral(v => !v)}>
                    👥 소개자
                  </span>
                  <label className="vip-criteria-count">
                    최대
                    <input type="number" value={maxCount} onChange={e => setMaxCount(Math.max(1, parseInt(e.target.value) || 30))} min={1} max={200} />
                    명
                  </label>
                </div>
                <button className="vip-btn primary" onClick={loadCandidates} disabled={loading || !hasAnyCriteria} style={{ fontSize: 15, padding: '12px 28px', marginTop: 8 }}>
                  <i className="fa-solid fa-wand-magic-sparkles" /> {loading ? '분석 중...' : `${year}년 후보 생성`}
                </button>
              </div>
            ) : candidates.length === 0 ? (
              <div className="vip-empty">{year}년 후보 데이터가 없습니다.</div>
            ) : (
              <>
                <div className="vip-candidate-actions">
                  <div className="vip-candidate-actions-left">
                    <label className="vip-check-all">
                      <input type="checkbox" checked={selectedCandidates.size === candidates.length} onChange={toggleAllCandidates} />
                      전체 선택 ({selectedCandidates.size}/{candidates.length})
                    </label>
                    <span className="vip-criteria-summary">
                      기준: {[
                        revCriteria === 'total' && '총진료비',
                        revCriteria === 'noncovered' && '비급여',
                        revCriteria === 'copay' && '본인부담금',
                        useVisits && '내원',
                        useLoyalty && '충성도',
                        familySum && '가족합산',
                        useReferral && '소개자',
                      ].filter(Boolean).join(' + ')}
                    </span>
                    <button className="vip-btn-text" onClick={() => setCandidatesLoaded(false)}>
                      <i className="fa-solid fa-sliders" /> 기준 변경
                    </button>
                  </div>
                  <button className="vip-btn primary" onClick={handleBatchAdd} disabled={!selectedCandidates.size}>
                    <i className="fa-solid fa-crown" /> {selectedCandidates.size}명 일괄 선정
                  </button>
                </div>
                <table className="vip-table">
                  <thead>
                    <tr>
                      <th></th>
                      <th>추천등급</th>
                      <th>이름</th>
                      <th>차트</th>
                      {revCriteria && <th style={{ cursor: 'pointer' }} onClick={() => handleSort(revCriteria === 'total' ? 'revenue' : revCriteria === 'noncovered' ? 'noncovered' : 'copay')}>{revCriteria === 'total' ? '총진료비' : revCriteria === 'noncovered' ? '비급여' : '본인부담'}{sortIcon(revCriteria === 'total' ? 'revenue' : revCriteria === 'noncovered' ? 'noncovered' : 'copay')}</th>}
                      {useVisits && <th style={{ cursor: 'pointer' }} onClick={() => handleSort('visit_count')}>내원{sortIcon('visit_count')}</th>}
                      {useReferral && <th style={{ cursor: 'pointer' }} onClick={() => handleSort('referral_count')}>소개수{sortIcon('referral_count')}</th>}
                      {useReferral && <th style={{ cursor: 'pointer' }} onClick={() => handleSort('referral_total_revenue')}>소개총매출{sortIcon('referral_total_revenue')}</th>}
                      {useReferral && <th style={{ cursor: 'pointer' }} onClick={() => handleSort('referral_noncovered')}>소개비급여{sortIcon('referral_noncovered')}</th>}
                      <th style={{ cursor: 'pointer' }} onClick={() => handleSort('score')}>점수{sortIcon('score')}</th>
                      <th>사유</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedCandidates.map(c => {
                      const hasFamily = c.familyMembers && c.familyMembers.length > 0;
                      const isExpanded = expandedFamily.has(c.patient_id);
                      const colCount = 4 + (revCriteria ? 1 : 0) + (useVisits ? 1 : 0) + (useReferral ? 3 : 0) + 2;
                      const fmtRev = (m: { revenue: number; noncovered: number; copay: number }) =>
                        revCriteria === 'total' ? (m.revenue ? `${Math.round(m.revenue / 10000)}만` : '-') :
                        revCriteria === 'noncovered' ? (m.noncovered ? `${Math.round(m.noncovered / 10000)}만` : '-') :
                        (m.copay ? `${Math.round(m.copay / 10000)}만` : '-');
                      return (
                        <React.Fragment key={c.patient_id}>
                          <tr className={selectedCandidates.has(c.patient_id) ? 'selected' : ''}>
                            <td>
                              <input type="checkbox" checked={selectedCandidates.has(c.patient_id)} onChange={() => toggleCandidate(c.patient_id)} />
                            </td>
                            <td>
                              <span className={`vip-grade-badge ${c.suggested_grade.toLowerCase()}`}>
                                {c.suggested_grade === 'VVIP' ? '👑 VVIP' : '⭐ VIP'}
                              </span>
                            </td>
                            <td>
                              <span className="vip-name" onClick={() => handlePatientClick(c.patient_id)}>{c.name}</span>
                              {hasFamily && (
                                <button
                                  className="vip-family-toggle"
                                  onClick={() => setExpandedFamily(prev => {
                                    const next = new Set(prev);
                                    next.has(c.patient_id) ? next.delete(c.patient_id) : next.add(c.patient_id);
                                    return next;
                                  })}
                                >
                                  <i className={`fa-solid fa-chevron-${isExpanded ? 'up' : 'down'}`} />
                                </button>
                              )}
                            </td>
                            <td className="vip-chart">{c.chart_number}</td>
                            {revCriteria && <td className="vip-revenue">{fmtRev(c)}</td>}
                            {useVisits && <td className="vip-visits">{c.visit_count}회</td>}
                            {useReferral && <td className="vip-visits">{c.referral_count || '-'}</td>}
                            {useReferral && <td className="vip-revenue">{c.referral_total_revenue ? `${Math.round(c.referral_total_revenue / 10000)}만` : '-'}</td>}
                            {useReferral && <td className="vip-revenue">{c.referral_noncovered ? `${Math.round(c.referral_noncovered / 10000)}만` : '-'}</td>}
                            <td className="vip-score">{c.score}</td>
                            <td className="vip-reason">{c.reason}</td>
                          </tr>
                          {hasFamily && isExpanded && c.familyMembers!.map((fm, i) => (
                            <tr key={`${c.patient_id}-fm-${i}`} className="vip-family-row">
                              <td></td>
                              <td></td>
                              <td className="vip-family-name">┗ {fm.name}</td>
                              <td className="vip-chart">{fm.chart_number}</td>
                              {revCriteria && <td className="vip-revenue vip-family-cell">{fmtRev(fm)}</td>}
                              {useVisits && <td className="vip-visits vip-family-cell">{fm.visit_count}회</td>}
                              {useReferral && <td></td>}
                              {useReferral && <td></td>}
                              {useReferral && <td></td>}
                              <td></td>
                              <td></td>
                            </tr>
                          ))}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </>
            )}
          </>
        )}
      </div>

      {/* 수동 추가 모달 */}
      {showAddModal && (
        <div className="pkg-modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="expanded-section-modal" style={{ width: 450 }} onClick={e => e.stopPropagation()}>
            <div className="expanded-section-header">
              <h3>{year}년 VIP 수동 추가</h3>
              <button className="pkg-modal-close-btn" onClick={() => setShowAddModal(false)}><i className="fa-solid fa-xmark" /></button>
            </div>
            <div className="expanded-section-body" style={{ padding: '16px' }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <input
                  type="text"
                  placeholder="환자명 또는 차트번호"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                  style={{ flex: 1, padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13 }}
                />
                <button onClick={handleSearch} style={{ padding: '8px 16px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}>검색</button>
              </div>

              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
                  등급:
                  <select value={addGrade} onChange={e => setAddGrade(e.target.value as 'VVIP' | 'VIP')} style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #d1d5db' }}>
                    <option value="VIP">⭐ VIP</option>
                    <option value="VVIP">👑 VVIP</option>
                  </select>
                </label>
                <input
                  type="text"
                  placeholder="선정 사유"
                  value={addReason}
                  onChange={e => setAddReason(e.target.value)}
                  style={{ flex: 1, padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13 }}
                />
              </div>

              <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                {searchResults.map(p => (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderBottom: '1px solid #f3f4f6' }}>
                    <span style={{ fontSize: 13 }}>{p.name} ({p.chart_number})</span>
                    <button
                      onClick={() => handleAddVip(p.id, p.name)}
                      style={{ padding: '4px 12px', background: '#8b5cf6', color: 'white', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}
                    >
                      VIP 등록
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
