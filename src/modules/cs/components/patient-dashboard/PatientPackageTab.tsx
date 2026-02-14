/**
 * 환자 대시보드 - 패키지 관리 탭
 * 한약/녹용 선결제 CRUD + 탕전일정/배송방법 설정 + 수납 연결
 */

import React, { useState, useEffect, useCallback } from 'react';
import type { HerbalPackage, NokryongPackage, DeliveryMethod } from '../../types';
import type { ReceiptDetailItem } from '../../lib/api';
import {
  PACKAGE_TYPE_LABELS,
  DELIVERY_METHOD_LABELS,
} from '../../types';
import {
  getHerbalPackages,
  createHerbalPackage,
  updateHerbalPackage,
  deleteHerbalPackage,
  useHerbalPackage,
  getUnlinkedHerbalPackages,
  linkPackageToReceipt,
  getNokryongPackages,
  createNokryongPackage,
  updateNokryongPackage,
  deleteNokryongPackage,
  useNokryongPackage,
  getUnlinkedNokryongPackages,
  linkNokryongToReceipt,
  fetchReceiptDetails,
} from '../../lib/api';

interface PatientPackageTabProps {
  patientId: number;
  chartNumber: string;
  patientName: string;
  mssqlPatientId?: number | null;
}

// 수납 연결 매칭 결과
interface LinkMatch {
  receiptItem: ReceiptDetailItem;
  packageType: 'herbal' | 'nokryong';
  packageId: number;
  packageName: string;
  confidence: 'auto' | 'manual';
}

const PatientPackageTab: React.FC<PatientPackageTabProps> = ({
  patientId,
  chartNumber,
  patientName,
  mssqlPatientId,
}) => {
  // 패키지 데이터
  const [herbalPackages, setHerbalPackages] = useState<HerbalPackage[]>([]);
  const [nokryongPackages, setNokryongPackages] = useState<NokryongPackage[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 등록 폼 토글
  const [showHerbalForm, setShowHerbalForm] = useState(false);
  const [showNokryongForm, setShowNokryongForm] = useState(false);

  // 한약 등록 폼
  const [herbalForm, setHerbalForm] = useState({
    herbal_name: '',
    package_type: '1month' as HerbalPackage['package_type'],
    total_count: 2,
    decoction_date: '',
    delivery_method: 'pickup' as DeliveryMethod,
    doctor_name: '',
    memo: '',
  });

  // 녹용 등록 폼
  const [nokryongForm, setNokryongForm] = useState({
    package_name: '',
    total_months: 3,
    start_date: new Date().toISOString().slice(0, 10),
    memo: '',
  });

  // 수정 모드
  const [editingHerbalId, setEditingHerbalId] = useState<number | null>(null);
  const [editingNokryongId, setEditingNokryongId] = useState<number | null>(null);
  const [editHerbalForm, setEditHerbalForm] = useState<Partial<HerbalPackage>>({});
  const [editNokryongForm, setEditNokryongForm] = useState<Partial<NokryongPackage>>({});

  // 수납 연결
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [receiptItems, setReceiptItems] = useState<ReceiptDetailItem[]>([]);
  const [linkMatches, setLinkMatches] = useState<LinkMatch[]>([]);
  const [manualSelections, setManualSelections] = useState<Record<number, { type: string; id: number }>>({});
  const [isLinking, setIsLinking] = useState(false);

  // 데이터 로드
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [herbals, nokryongs] = await Promise.all([
        getHerbalPackages(patientId),
        getNokryongPackages(patientId),
      ]);
      setHerbalPackages(herbals);
      setNokryongPackages(nokryongs);
    } catch (error) {
      console.error('패키지 데이터 로드 오류:', error);
    } finally {
      setIsLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ========== 한약 CRUD ==========

  const handleCreateHerbal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!herbalForm.herbal_name.trim()) return;

    try {
      await createHerbalPackage({
        patient_id: patientId,
        chart_number: chartNumber,
        patient_name: patientName,
        herbal_name: herbalForm.herbal_name,
        package_type: herbalForm.package_type,
        total_count: herbalForm.total_count,
        used_count: 0,
        remaining_count: herbalForm.total_count,
        start_date: new Date().toISOString().slice(0, 10),
        status: 'active',
        decoction_date: herbalForm.decoction_date || undefined,
        delivery_method: herbalForm.delivery_method,
        doctor_name: herbalForm.doctor_name || undefined,
        memo: herbalForm.memo || undefined,
      });
      setHerbalForm({ herbal_name: '', package_type: '1month', total_count: 2, decoction_date: '', delivery_method: 'pickup', doctor_name: '', memo: '' });
      setShowHerbalForm(false);
      await loadData();
    } catch (error) {
      console.error('한약 패키지 등록 오류:', error);
      alert('등록 중 오류가 발생했습니다.');
    }
  };

  const handleUpdateHerbal = async (id: number) => {
    try {
      await updateHerbalPackage(id, editHerbalForm);
      setEditingHerbalId(null);
      setEditHerbalForm({});
      await loadData();
    } catch (error) {
      console.error('한약 패키지 수정 오류:', error);
    }
  };

  const handleDeleteHerbal = async (id: number, name: string) => {
    if (!confirm(`"${name}" 패키지를 삭제하시겠습니까?`)) return;
    try {
      await deleteHerbalPackage(id);
      await loadData();
    } catch (error) {
      console.error('한약 패키지 삭제 오류:', error);
    }
  };

  const handleUseHerbal = async (id: number) => {
    try {
      await useHerbalPackage(id);
      await loadData();
    } catch (error) {
      console.error('한약 패키지 차감 오류:', error);
    }
  };

  // ========== 녹용 CRUD ==========

  const handleCreateNokryong = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nokryongForm.package_name.trim()) return;

    try {
      await createNokryongPackage({
        patient_id: patientId,
        chart_number: chartNumber,
        patient_name: patientName,
        package_name: nokryongForm.package_name,
        total_months: nokryongForm.total_months,
        remaining_months: nokryongForm.total_months,
        start_date: nokryongForm.start_date,
        status: 'active',
        memo: nokryongForm.memo || undefined,
      });
      setNokryongForm({ package_name: '', total_months: 3, start_date: new Date().toISOString().slice(0, 10), memo: '' });
      setShowNokryongForm(false);
      await loadData();
    } catch (error) {
      console.error('녹용 패키지 등록 오류:', error);
      alert('등록 중 오류가 발생했습니다.');
    }
  };

  const handleUpdateNokryong = async (id: number) => {
    try {
      await updateNokryongPackage(id, editNokryongForm);
      setEditingNokryongId(null);
      setEditNokryongForm({});
      await loadData();
    } catch (error) {
      console.error('녹용 패키지 수정 오류:', error);
    }
  };

  const handleDeleteNokryong = async (id: number, name: string) => {
    if (!confirm(`"${name}" 패키지를 삭제하시겠습니까?`)) return;
    try {
      await deleteNokryongPackage(id);
      await loadData();
    } catch (error) {
      console.error('녹용 패키지 삭제 오류:', error);
    }
  };

  const handleUseNokryong = async (id: number) => {
    try {
      await useNokryongPackage(id);
      await loadData();
    } catch (error) {
      console.error('녹용 패키지 차감 오류:', error);
    }
  };

  // ========== 수납 연결 ==========

  const handleOpenLinkModal = async () => {
    if (!mssqlPatientId) {
      alert('MSSQL 환자 정보가 없어 수납 조회가 불가합니다.');
      return;
    }

    setShowLinkModal(true);
    setIsLinking(true);

    try {
      const today = new Date().toISOString().slice(0, 10);
      const [details, unlinkedHerbals, unlinkedNokryongs] = await Promise.all([
        fetchReceiptDetails(mssqlPatientId, today),
        getUnlinkedHerbalPackages(patientId),
        getUnlinkedNokryongPackages(patientId),
      ]);

      // 비급여 항목만 필터
      const uncoveredItems = details.filter(d => !d.is_insurance);
      setReceiptItems(uncoveredItems);

      // 자동 매칭
      const matches: LinkMatch[] = [];
      const herbalKeywords = ['한약', '보약', '탕', '선결', '환약'];
      const nokryongKeywords = ['녹용'];

      for (const item of uncoveredItems) {
        const name = item.item_name || '';

        // 한약 매칭
        if (herbalKeywords.some(kw => name.includes(kw)) && unlinkedHerbals.length > 0) {
          matches.push({
            receiptItem: item,
            packageType: 'herbal',
            packageId: unlinkedHerbals[0].id!,
            packageName: unlinkedHerbals[0].herbal_name,
            confidence: unlinkedHerbals.length === 1 ? 'auto' : 'manual',
          });
        }

        // 녹용 매칭
        if (nokryongKeywords.some(kw => name.includes(kw)) && unlinkedNokryongs.length > 0) {
          matches.push({
            receiptItem: item,
            packageType: 'nokryong',
            packageId: unlinkedNokryongs[0].id!,
            packageName: unlinkedNokryongs[0].package_name,
            confidence: unlinkedNokryongs.length === 1 ? 'auto' : 'manual',
          });
        }
      }

      setLinkMatches(matches);
    } catch (error) {
      console.error('수납 연결 조회 오류:', error);
    } finally {
      setIsLinking(false);
    }
  };

  const handleExecuteLink = async (match: LinkMatch) => {
    try {
      if (match.packageType === 'herbal') {
        await linkPackageToReceipt(match.packageId, match.receiptItem.detail_id);
      } else {
        await linkNokryongToReceipt(match.packageId, match.receiptItem.detail_id);
      }
      // 매칭 리스트에서 제거
      setLinkMatches(prev => prev.filter(m => m.receiptItem.detail_id !== match.receiptItem.detail_id));
      await loadData();
    } catch (error) {
      console.error('수납 연결 오류:', error);
      alert('연결 중 오류가 발생했습니다.');
    }
  };

  const handleManualLink = async (detailId: number) => {
    const selection = manualSelections[detailId];
    if (!selection) return;

    try {
      if (selection.type === 'herbal') {
        await linkPackageToReceipt(selection.id, detailId);
      } else {
        await linkNokryongToReceipt(selection.id, detailId);
      }
      setManualSelections(prev => {
        const next = { ...prev };
        delete next[detailId];
        return next;
      });
      // 비급여 항목에서 제거
      setReceiptItems(prev => prev.filter(r => r.detail_id !== detailId));
      setLinkMatches(prev => prev.filter(m => m.receiptItem.detail_id !== detailId));
      await loadData();
    } catch (error) {
      console.error('수동 연결 오류:', error);
    }
  };

  // 활성 패키지만 필터
  const activeHerbals = herbalPackages.filter(p => p.status === 'active');
  const activeNokryongs = nokryongPackages.filter(p => p.status === 'active');
  const completedHerbals = herbalPackages.filter(p => p.status === 'completed');
  const completedNokryongs = nokryongPackages.filter(p => p.status !== 'active');

  // 미연결 패키지 수
  const unlinkedCount = [...activeHerbals, ...activeNokryongs].filter(p => !p.mssql_detail_id).length;

  if (isLoading) {
    return <div className="section-loading">로딩 중...</div>;
  }

  return (
    <div className="pkg-tab">
      {/* 상단 액션 바 */}
      <div className="pkg-tab-actions">
        <button className="pkg-btn-refresh" onClick={loadData}>
          <i className="fa-solid fa-refresh"></i> 새로고침
        </button>
        {unlinkedCount > 0 && mssqlPatientId && (
          <button className="pkg-btn-link" onClick={handleOpenLinkModal}>
            <i className="fa-solid fa-link"></i> 수납 연결
            <span className="pkg-unlinked-count">{unlinkedCount}</span>
          </button>
        )}
      </div>

      {/* ========== 한약 섹션 ========== */}
      <div className="pkg-tab-section">
        <div className="pkg-tab-header">
          <h4><i className="fa-solid fa-leaf"></i> 한약 선결제</h4>
          <button className="pkg-btn-add" onClick={() => setShowHerbalForm(!showHerbalForm)}>
            <i className={`fa-solid ${showHerbalForm ? 'fa-minus' : 'fa-plus'}`}></i>
            {showHerbalForm ? '취소' : '추가'}
          </button>
        </div>

        {/* 한약 등록 폼 */}
        {showHerbalForm && (
          <form className="pkg-add-form" onSubmit={handleCreateHerbal}>
            <div className="pkg-form-row">
              <label>약명</label>
              <input
                type="text"
                value={herbalForm.herbal_name}
                onChange={e => setHerbalForm(f => ({ ...f, herbal_name: e.target.value }))}
                placeholder="예: 시함마농, 궁귀교애탕"
                required
              />
            </div>
            <div className="pkg-form-row pkg-form-row-split">
              <div>
                <label>기간</label>
                <select
                  value={herbalForm.package_type}
                  onChange={e => setHerbalForm(f => ({ ...f, package_type: e.target.value as HerbalPackage['package_type'] }))}
                >
                  <option value="0.5month">0.5개월</option>
                  <option value="1month">1개월</option>
                  <option value="2month">2개월</option>
                  <option value="3month">3개월</option>
                  <option value="6month">6개월</option>
                </select>
              </div>
              <div>
                <label>총 회차</label>
                <input
                  type="number"
                  min={1}
                  value={herbalForm.total_count}
                  onChange={e => setHerbalForm(f => ({ ...f, total_count: parseInt(e.target.value) || 1 }))}
                />
              </div>
            </div>
            <div className="pkg-form-row pkg-form-row-split">
              <div>
                <label>탕전 예정일</label>
                <input
                  type="date"
                  value={herbalForm.decoction_date}
                  onChange={e => setHerbalForm(f => ({ ...f, decoction_date: e.target.value }))}
                />
              </div>
              <div>
                <label>수령방법</label>
                <select
                  value={herbalForm.delivery_method}
                  onChange={e => setHerbalForm(f => ({ ...f, delivery_method: e.target.value as DeliveryMethod }))}
                >
                  {Object.entries(DELIVERY_METHOD_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="pkg-form-row">
              <label>담당 원장</label>
              <input
                type="text"
                value={herbalForm.doctor_name}
                onChange={e => setHerbalForm(f => ({ ...f, doctor_name: e.target.value }))}
                placeholder="원장명"
              />
            </div>
            <div className="pkg-form-row">
              <label>메모</label>
              <input
                type="text"
                value={herbalForm.memo}
                onChange={e => setHerbalForm(f => ({ ...f, memo: e.target.value }))}
                placeholder="메모 (선택)"
              />
            </div>
            <button type="submit" className="pkg-btn-submit">등록</button>
          </form>
        )}

        {/* 한약 패키지 카드 리스트 */}
        {activeHerbals.length === 0 && !showHerbalForm && (
          <p className="pkg-empty">활성 한약 패키지가 없습니다.</p>
        )}
        {activeHerbals.map(pkg => (
          <div key={pkg.id} className="pkg-card">
            {editingHerbalId === pkg.id ? (
              // 수정 모드
              <div className="pkg-edit-form">
                <div className="pkg-form-row pkg-form-row-split">
                  <div>
                    <label>탕전일</label>
                    <input
                      type="date"
                      value={editHerbalForm.decoction_date ?? pkg.decoction_date ?? ''}
                      onChange={e => setEditHerbalForm(f => ({ ...f, decoction_date: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label>수령방법</label>
                    <select
                      value={editHerbalForm.delivery_method ?? pkg.delivery_method ?? 'pickup'}
                      onChange={e => setEditHerbalForm(f => ({ ...f, delivery_method: e.target.value as DeliveryMethod }))}
                    >
                      {Object.entries(DELIVERY_METHOD_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="pkg-form-row">
                  <label>메모</label>
                  <input
                    type="text"
                    value={editHerbalForm.memo ?? pkg.memo ?? ''}
                    onChange={e => setEditHerbalForm(f => ({ ...f, memo: e.target.value }))}
                  />
                </div>
                <div className="pkg-edit-actions">
                  <button className="pkg-btn-save" onClick={() => handleUpdateHerbal(pkg.id!)}>저장</button>
                  <button className="pkg-btn-cancel" onClick={() => { setEditingHerbalId(null); setEditHerbalForm({}); }}>취소</button>
                </div>
              </div>
            ) : (
              // 표시 모드
              <>
                <div className="pkg-card-header">
                  <span className="pkg-card-name">{pkg.herbal_name}</span>
                  <span className="pkg-type-badge">{PACKAGE_TYPE_LABELS[pkg.package_type] || pkg.package_type}</span>
                  {pkg.mssql_detail_id ? (
                    <span className="pkg-link-badge linked">연결됨</span>
                  ) : (
                    <span className="pkg-link-badge unlinked">미연결</span>
                  )}
                </div>
                <div className="pkg-card-progress">
                  <div className="pkg-progress-bar">
                    <div
                      className="pkg-progress-fill herbal"
                      style={{ width: `${(pkg.remaining_count / pkg.total_count) * 100}%` }}
                    />
                  </div>
                  <span className="pkg-progress-text">
                    잔여 {pkg.remaining_count}/{pkg.total_count}회
                  </span>
                </div>
                <div className="pkg-card-details">
                  {pkg.decoction_date && (
                    <span className="pkg-detail-item">
                      <i className="fa-solid fa-fire"></i> 탕전: {pkg.decoction_date}
                    </span>
                  )}
                  {pkg.delivery_method && (
                    <span className="pkg-detail-item">
                      <i className="fa-solid fa-truck"></i> {DELIVERY_METHOD_LABELS[pkg.delivery_method]}
                    </span>
                  )}
                  {pkg.doctor_name && (
                    <span className="pkg-detail-item">
                      <i className="fa-solid fa-user-doctor"></i> {pkg.doctor_name}
                    </span>
                  )}
                  {pkg.memo && (
                    <span className="pkg-detail-item pkg-memo">
                      <i className="fa-solid fa-comment"></i> {pkg.memo}
                    </span>
                  )}
                </div>
                <div className="pkg-card-actions">
                  <button className="pkg-action-btn use" onClick={() => handleUseHerbal(pkg.id!)} disabled={pkg.remaining_count <= 0}>
                    <i className="fa-solid fa-minus"></i> 차감
                  </button>
                  <button className="pkg-action-btn edit" onClick={() => { setEditingHerbalId(pkg.id!); setEditHerbalForm({}); }}>
                    <i className="fa-solid fa-pen"></i> 수정
                  </button>
                  <button className="pkg-action-btn delete" onClick={() => handleDeleteHerbal(pkg.id!, pkg.herbal_name)}>
                    <i className="fa-solid fa-trash"></i>
                  </button>
                </div>
              </>
            )}
          </div>
        ))}

        {/* 완료 패키지 접기 */}
        {completedHerbals.length > 0 && (
          <details className="pkg-completed-section">
            <summary>완료된 한약 패키지 ({completedHerbals.length})</summary>
            {completedHerbals.map(pkg => (
              <div key={pkg.id} className="pkg-card completed">
                <div className="pkg-card-header">
                  <span className="pkg-card-name">{pkg.herbal_name}</span>
                  <span className="pkg-type-badge">{PACKAGE_TYPE_LABELS[pkg.package_type] || pkg.package_type}</span>
                  <span className="pkg-status-badge completed">완료</span>
                </div>
              </div>
            ))}
          </details>
        )}
      </div>

      {/* ========== 녹용 섹션 ========== */}
      <div className="pkg-tab-section">
        <div className="pkg-tab-header">
          <h4><i className="fa-solid fa-mortar-pestle"></i> 녹용 선결제</h4>
          <button className="pkg-btn-add" onClick={() => setShowNokryongForm(!showNokryongForm)}>
            <i className={`fa-solid ${showNokryongForm ? 'fa-minus' : 'fa-plus'}`}></i>
            {showNokryongForm ? '취소' : '추가'}
          </button>
        </div>

        {/* 녹용 등록 폼 */}
        {showNokryongForm && (
          <form className="pkg-add-form" onSubmit={handleCreateNokryong}>
            <div className="pkg-form-row">
              <label>패키지명</label>
              <input
                type="text"
                value={nokryongForm.package_name}
                onChange={e => setNokryongForm(f => ({ ...f, package_name: e.target.value }))}
                placeholder="예: 녹용(원대) 30회분"
                required
              />
            </div>
            <div className="pkg-form-row pkg-form-row-split">
              <div>
                <label>총 회분</label>
                <input
                  type="number"
                  min={1}
                  value={nokryongForm.total_months}
                  onChange={e => setNokryongForm(f => ({ ...f, total_months: parseInt(e.target.value) || 1 }))}
                />
              </div>
              <div>
                <label>시작일</label>
                <input
                  type="date"
                  value={nokryongForm.start_date}
                  onChange={e => setNokryongForm(f => ({ ...f, start_date: e.target.value }))}
                />
              </div>
            </div>
            <div className="pkg-form-row">
              <label>메모</label>
              <input
                type="text"
                value={nokryongForm.memo}
                onChange={e => setNokryongForm(f => ({ ...f, memo: e.target.value }))}
                placeholder="메모 (선택)"
              />
            </div>
            <button type="submit" className="pkg-btn-submit">등록</button>
          </form>
        )}

        {/* 녹용 패키지 카드 리스트 */}
        {activeNokryongs.length === 0 && !showNokryongForm && (
          <p className="pkg-empty">활성 녹용 패키지가 없습니다.</p>
        )}
        {activeNokryongs.map(pkg => (
          <div key={pkg.id} className="pkg-card">
            {editingNokryongId === pkg.id ? (
              <div className="pkg-edit-form">
                <div className="pkg-form-row">
                  <label>패키지명</label>
                  <input
                    type="text"
                    value={editNokryongForm.package_name ?? pkg.package_name}
                    onChange={e => setEditNokryongForm(f => ({ ...f, package_name: e.target.value }))}
                  />
                </div>
                <div className="pkg-form-row">
                  <label>메모</label>
                  <input
                    type="text"
                    value={editNokryongForm.memo ?? pkg.memo ?? ''}
                    onChange={e => setEditNokryongForm(f => ({ ...f, memo: e.target.value }))}
                  />
                </div>
                <div className="pkg-edit-actions">
                  <button className="pkg-btn-save" onClick={() => handleUpdateNokryong(pkg.id!)}>저장</button>
                  <button className="pkg-btn-cancel" onClick={() => { setEditingNokryongId(null); setEditNokryongForm({}); }}>취소</button>
                </div>
              </div>
            ) : (
              <>
                <div className="pkg-card-header">
                  <span className="pkg-card-name">{pkg.package_name}</span>
                  {pkg.mssql_detail_id ? (
                    <span className="pkg-link-badge linked">연결됨</span>
                  ) : (
                    <span className="pkg-link-badge unlinked">미연결</span>
                  )}
                </div>
                <div className="pkg-card-progress">
                  <div className="pkg-progress-bar">
                    <div
                      className="pkg-progress-fill nokryong"
                      style={{ width: `${(pkg.remaining_months / pkg.total_months) * 100}%` }}
                    />
                  </div>
                  <span className="pkg-progress-text">
                    잔여 {pkg.remaining_months}/{pkg.total_months}회분
                  </span>
                </div>
                <div className="pkg-card-details">
                  <span className="pkg-detail-item">
                    <i className="fa-solid fa-calendar"></i> 시작: {pkg.start_date}
                  </span>
                  {pkg.expire_date && (
                    <span className="pkg-detail-item">
                      <i className="fa-solid fa-clock"></i> 만료: {pkg.expire_date}
                    </span>
                  )}
                  {pkg.memo && (
                    <span className="pkg-detail-item pkg-memo">
                      <i className="fa-solid fa-comment"></i> {pkg.memo}
                    </span>
                  )}
                </div>
                <div className="pkg-card-actions">
                  <button className="pkg-action-btn use" onClick={() => handleUseNokryong(pkg.id!)} disabled={pkg.remaining_months <= 0}>
                    <i className="fa-solid fa-minus"></i> 차감
                  </button>
                  <button className="pkg-action-btn edit" onClick={() => { setEditingNokryongId(pkg.id!); setEditNokryongForm({}); }}>
                    <i className="fa-solid fa-pen"></i> 수정
                  </button>
                  <button className="pkg-action-btn delete" onClick={() => handleDeleteNokryong(pkg.id!, pkg.package_name)}>
                    <i className="fa-solid fa-trash"></i>
                  </button>
                </div>
              </>
            )}
          </div>
        ))}

        {/* 완료 녹용 */}
        {completedNokryongs.length > 0 && (
          <details className="pkg-completed-section">
            <summary>완료된 녹용 패키지 ({completedNokryongs.length})</summary>
            {completedNokryongs.map(pkg => (
              <div key={pkg.id} className="pkg-card completed">
                <div className="pkg-card-header">
                  <span className="pkg-card-name">{pkg.package_name}</span>
                  <span className="pkg-status-badge completed">완료</span>
                </div>
              </div>
            ))}
          </details>
        )}
      </div>

      {/* ========== 수납 연결 모달 ========== */}
      {showLinkModal && (
        <div className="pkg-link-modal-overlay" onClick={() => setShowLinkModal(false)}>
          <div className="pkg-link-modal" onClick={e => e.stopPropagation()}>
            <div className="pkg-link-modal-header">
              <h4>수납 비급여 항목 연결</h4>
              <button className="pkg-modal-close" onClick={() => setShowLinkModal(false)}>
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            {isLinking ? (
              <div className="pkg-link-loading">수납 정보를 조회 중...</div>
            ) : receiptItems.length === 0 && linkMatches.length === 0 ? (
              <div className="pkg-link-empty">오늘 연결 가능한 비급여 항목이 없습니다.</div>
            ) : (
              <div className="pkg-link-modal-body">
                {/* 자동 매칭 제안 */}
                {linkMatches.length > 0 && (
                  <div className="pkg-link-section">
                    <h5>자동 매칭 제안</h5>
                    {linkMatches.map((match, idx) => (
                      <div key={idx} className="pkg-match-row">
                        <div className="pkg-match-info">
                          <span className="pkg-match-receipt">{match.receiptItem.item_name}</span>
                          <i className="fa-solid fa-arrow-right"></i>
                          <span className="pkg-match-package">
                            {match.packageType === 'herbal' ? '한약' : '녹용'}: {match.packageName}
                          </span>
                          {match.confidence === 'auto' && <span className="pkg-match-auto">자동</span>}
                        </div>
                        <button className="pkg-btn-connect" onClick={() => handleExecuteLink(match)}>
                          연결
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* 수동 연결 (매칭되지 않은 비급여 항목) */}
                {receiptItems.filter(r => !linkMatches.some(m => m.receiptItem.detail_id === r.detail_id)).length > 0 && (
                  <div className="pkg-link-section">
                    <h5>수동 연결</h5>
                    {receiptItems
                      .filter(r => !linkMatches.some(m => m.receiptItem.detail_id === r.detail_id))
                      .map(item => (
                        <div key={item.detail_id} className="pkg-match-row">
                          <div className="pkg-match-info">
                            <span className="pkg-match-receipt">
                              {item.item_name} ({item.amount?.toLocaleString()}원)
                            </span>
                          </div>
                          <div className="pkg-manual-select">
                            <select
                              value={manualSelections[item.detail_id] ? `${manualSelections[item.detail_id].type}-${manualSelections[item.detail_id].id}` : ''}
                              onChange={e => {
                                const val = e.target.value;
                                if (!val) {
                                  setManualSelections(prev => {
                                    const next = { ...prev };
                                    delete next[item.detail_id];
                                    return next;
                                  });
                                  return;
                                }
                                const [type, id] = val.split('-');
                                setManualSelections(prev => ({ ...prev, [item.detail_id]: { type, id: parseInt(id) } }));
                              }}
                            >
                              <option value="">패키지 선택...</option>
                              {activeHerbals.filter(p => !p.mssql_detail_id).map(p => (
                                <option key={`herbal-${p.id}`} value={`herbal-${p.id}`}>
                                  한약: {p.herbal_name}
                                </option>
                              ))}
                              {activeNokryongs.filter(p => !p.mssql_detail_id).map(p => (
                                <option key={`nokryong-${p.id}`} value={`nokryong-${p.id}`}>
                                  녹용: {p.package_name}
                                </option>
                              ))}
                            </select>
                            {manualSelections[item.detail_id] && (
                              <button className="pkg-btn-connect" onClick={() => handleManualLink(item.detail_id)}>
                                연결
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PatientPackageTab;
