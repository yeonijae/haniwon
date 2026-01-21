import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  getAllActivePackages,
  getPackageDiseaseTags,
  createHerbalPackage,
  createNokryongPackage,
  createTreatmentPackage,
  createMembership,
  deductPackage,
  applyMembership,
  addPackageUsage,
  getHerbalPurposes,
  getNokryongTypes,
  getPackageTypes,
  getMembershipTypes,
  getHerbalDiseaseTags,
  findOrCreateDiseaseTag,
  setPackageDiseaseTags,
  type PackageType as TreatmentPackageOption,
} from '../lib/api';
import {
  type HerbalPackage,
  type NokryongPackage,
  type TreatmentPackage,
  type Membership,
  type PackageType,
  HERBAL_PACKAGE_ROUNDS,
  PACKAGE_CATEGORY_LABELS,
} from '../types';
import './PackageManageModal.css';

interface UncoveredItem {
  detailId: number;
  itemName: string;
  amount: number;
}

interface PackageManageModalProps {
  patientId: number;
  patientName: string;
  chartNumber: string;
  receiptId: number;
  receiptDate: string;
  uncoveredItems: UncoveredItem[];
  onClose: () => void;
  onSuccess: () => void;
}

// 패키지 그룹 (합산용)
interface PackageGroup {
  type: PackageType;
  name: string;           // 표시 이름 (한약: 보약-피로감, 녹용: 베이직, 치료: 도수10회)
  totalRemaining: number; // 합산된 잔여 횟수
  packages: Array<{
    id: number;
    remaining: number;
    expireDate?: string;
  }>;
}

// 액션 타입
type ActionType = 'add' | 'deduct' | 'apply';

interface SelectedAction {
  type: ActionType;
  packageType: PackageType;
  packageGroup?: PackageGroup;
}

function PackageManageModal({
  patientId,
  patientName,
  chartNumber,
  receiptId,
  receiptDate,
  uncoveredItems,
  onClose,
  onSuccess,
}: PackageManageModalProps) {
  // 드래그 상태
  const modalRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // ESC 키 핸들러
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // 드래그 핸들러
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // 헤더 영역에서만 드래그 시작
    if ((e.target as HTMLElement).closest('.package-modal-header')) {
      setIsDragging(true);
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      });
    }
  }, [position]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // 패키지 목록 상태
  const [herbalPackages, setHerbalPackages] = useState<(HerbalPackage & { diseaseTags?: string[] })[]>([]);
  const [nokryongPackages, setNokryongPackages] = useState<NokryongPackage[]>([]);
  const [treatmentPackages, setTreatmentPackages] = useState<TreatmentPackage[]>([]);
  const [memberships, setMemberships] = useState<Membership[]>([]);

  // 선택된 액션
  const [selectedAction, setSelectedAction] = useState<SelectedAction | null>(null);

  // 비급여 항목 연결
  const [selectedDetailId, setSelectedDetailId] = useState<number | null>(null);

  // 공통 상태
  const [isSaving, setIsSaving] = useState(false);
  const [memo, setMemo] = useState('');

  // 한약 추가 폼 상태
  const [herbalPurposes, setHerbalPurposes] = useState<string[]>([]);
  const [selectedHerbalPurpose, setSelectedHerbalPurpose] = useState('');
  const [herbalPackageType, setHerbalPackageType] = useState<'1month' | '2month' | '3month' | '6month'>('1month');
  const [herbalDiseaseTags, setHerbalDiseaseTags] = useState<{ id?: number; name: string }[]>([]);
  const [availableDiseaseTags, setAvailableDiseaseTags] = useState<{ id: number; name: string }[]>([]);
  const [diseaseInput, setDiseaseInput] = useState('');

  // 녹용 추가 폼 상태
  const [nokryongTypes, setNokryongTypes] = useState<string[]>([]);
  const [selectedNokryongType, setSelectedNokryongType] = useState('');
  const [nokryongDoses, setNokryongDoses] = useState(1);

  // 치료패키지 추가 폼 상태
  const [packageTypes, setPackageTypes] = useState<TreatmentPackageOption[]>([]);
  const [selectedPackageType, setSelectedPackageType] = useState('');
  const [packageCount, setPackageCount] = useState(10);

  // 멤버십 추가 폼 상태
  const [membershipTypes, setMembershipTypes] = useState<string[]>([]);
  const [selectedMembershipType, setSelectedMembershipType] = useState('');
  const [membershipStartDate, setMembershipStartDate] = useState(receiptDate);
  const [membershipExpireDate, setMembershipExpireDate] = useState('');

  // 차감 폼 상태
  const [deductCount, setDeductCount] = useState(1);
  const [selectedPackageId, setSelectedPackageId] = useState<number | null>(null);

  // 데이터 로드
  useEffect(() => {
    loadPackages();
    loadFormOptions();
  }, [patientId]);

  const loadPackages = async () => {
    const { herbal, nokryong, treatment, membership } = await getAllActivePackages(patientId);

    // 한약 패키지에 질환태그 추가
    const herbalWithTags = await Promise.all(
      herbal.map(async (pkg) => {
        if (pkg.id) {
          const tags = await getPackageDiseaseTags(pkg.id);
          return { ...pkg, diseaseTags: tags.map(t => t.name) };
        }
        return { ...pkg, diseaseTags: [] };
      })
    );

    setHerbalPackages(herbalWithTags);
    setNokryongPackages(nokryong);
    setTreatmentPackages(treatment);
    setMemberships(membership);
  };

  const loadFormOptions = async () => {
    const [purposes, nTypes, pTypes, mTypes, dTags] = await Promise.all([
      getHerbalPurposes(),
      getNokryongTypes(),
      getPackageTypes(),
      getMembershipTypes(),
      getHerbalDiseaseTags(),
    ]);

    setHerbalPurposes(purposes);
    setNokryongTypes(nTypes);
    setPackageTypes(pTypes);
    setMembershipTypes(mTypes);
    setAvailableDiseaseTags(dTags);

    if (purposes.length > 0) setSelectedHerbalPurpose(purposes[0]);
    if (nTypes.length > 0) setSelectedNokryongType(nTypes[0]);
    if (pTypes.length > 0) setSelectedPackageType(pTypes[0].name);
    if (mTypes.length > 0) setSelectedMembershipType(mTypes[0]);
  };

  // 패키지 그룹화 (같은 종류 합산)
  const getHerbalGroups = (): PackageGroup[] => {
    const groups: Record<string, PackageGroup> = {};
    herbalPackages.forEach(pkg => {
      const diseaseLabel = pkg.diseaseTags?.length ? pkg.diseaseTags[0] : '';
      const name = diseaseLabel ? `${pkg.herbal_name}-${diseaseLabel}` : pkg.herbal_name || '';
      if (!groups[name]) {
        groups[name] = {
          type: 'herbal',
          name,
          totalRemaining: 0,
          packages: [],
        };
      }
      groups[name].totalRemaining += pkg.remaining_count || 0;
      groups[name].packages.push({ id: pkg.id!, remaining: pkg.remaining_count || 0 });
    });
    return Object.values(groups);
  };

  const getNokryongGroups = (): PackageGroup[] => {
    const groups: Record<string, PackageGroup> = {};
    nokryongPackages.forEach(pkg => {
      const match = pkg.package_name.match(/녹용\(([^)]+)\)/);
      const name = match ? match[1] : pkg.package_name;
      if (!groups[name]) {
        groups[name] = {
          type: 'nokryong',
          name,
          totalRemaining: 0,
          packages: [],
        };
      }
      groups[name].totalRemaining += pkg.remaining_months || 0;
      groups[name].packages.push({ id: pkg.id!, remaining: pkg.remaining_months || 0 });
    });
    return Object.values(groups);
  };

  const getTreatmentGroups = (): PackageGroup[] => {
    const groups: Record<string, PackageGroup> = {};
    treatmentPackages.forEach(pkg => {
      const name = pkg.package_name;
      if (!groups[name]) {
        groups[name] = {
          type: 'treatment',
          name,
          totalRemaining: 0,
          packages: [],
        };
      }
      groups[name].totalRemaining += pkg.remaining_count || 0;
      groups[name].packages.push({ id: pkg.id!, remaining: pkg.remaining_count || 0 });
    });
    return Object.values(groups);
  };

  const getMembershipGroups = (): PackageGroup[] => {
    return memberships.map(m => ({
      type: 'membership' as PackageType,
      name: m.membership_type,
      totalRemaining: 0, // 멤버십은 횟수가 아닌 기간
      packages: [{ id: m.id!, remaining: 0, expireDate: m.expire_date }],
    }));
  };

  // 액션 선택 핸들러
  const handleActionSelect = (type: ActionType, packageType: PackageType, group?: PackageGroup) => {
    setSelectedAction({ type, packageType, packageGroup: group });
    setMemo('');
    setDeductCount(1);
    if (group && group.packages.length > 0) {
      setSelectedPackageId(group.packages[0].id);
    }
  };

  // 질환 태그 관련
  const filteredDiseaseTags = availableDiseaseTags.filter(
    tag => tag.name.toLowerCase().includes(diseaseInput.toLowerCase()) &&
           !herbalDiseaseTags.some(s => s.name === tag.name)
  );

  const handleAddDiseaseTag = (tag: { id?: number; name: string }) => {
    setHerbalDiseaseTags([...herbalDiseaseTags, tag]);
    setDiseaseInput('');
  };

  const handleRemoveDiseaseTag = (name: string) => {
    setHerbalDiseaseTags(herbalDiseaseTags.filter(t => t.name !== name));
  };

  // 폼 초기화
  const resetForm = () => {
    setSelectedAction(null);
    setSelectedDetailId(null);
    setMemo('');
    setHerbalDiseaseTags([]);
    setDiseaseInput('');
    setNokryongDoses(1);
    setPackageCount(10);
    setMembershipStartDate(receiptDate);
    setMembershipExpireDate('');
    setDeductCount(1);
    setSelectedPackageId(null);
  };

  // 저장 핸들러들
  const handleHerbalAdd = async () => {
    if (!selectedHerbalPurpose) return;
    setIsSaving(true);
    try {
      const totalCount = HERBAL_PACKAGE_ROUNDS[herbalPackageType] || 2;
      const packageId = await createHerbalPackage({
        patient_id: patientId,
        chart_number: chartNumber,
        patient_name: patientName,
        herbal_name: selectedHerbalPurpose,
        package_type: herbalPackageType,
        total_count: totalCount,
        used_count: 0,
        remaining_count: totalCount,
        start_date: receiptDate,
        memo: memo || undefined,
        mssql_detail_id: selectedDetailId || undefined,
        status: 'active',
      });

      // 질환 태그 연결
      if (herbalDiseaseTags.length > 0) {
        const tagIds: number[] = [];
        for (const tag of herbalDiseaseTags) {
          const tagId = tag.id ?? await findOrCreateDiseaseTag(tag.name);
          tagIds.push(tagId);
        }
        await setPackageDiseaseTags(packageId, tagIds);
      }

      // 사용기록 추가
      await addPackageUsage({
        package_type: 'herbal',
        package_id: packageId,
        patient_id: patientId,
        chart_number: chartNumber,
        patient_name: patientName,
        usage_date: receiptDate,
        usage_type: 'add',
        count: totalCount,
        mssql_detail_id: selectedDetailId || undefined,
        mssql_receipt_id: receiptId,
        memo: memo || undefined,
      });

      // 목록 새로고침 & 폼 초기화
      await loadPackages();
      onSuccess();
      resetForm();
    } catch (err) {
      console.error('한약 패키지 추가 오류:', err);
      alert('등록에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleNokryongAdd = async () => {
    if (!selectedNokryongType) return;
    setIsSaving(true);
    try {
      const packageName = `녹용(${selectedNokryongType}) ${nokryongDoses}회분`;
      const packageId = await createNokryongPackage({
        patient_id: patientId,
        chart_number: chartNumber,
        patient_name: patientName,
        package_name: packageName,
        total_months: nokryongDoses,
        remaining_months: nokryongDoses,
        start_date: receiptDate,
        status: 'active',
        mssql_detail_id: selectedDetailId || undefined,
      });

      // 사용기록 추가
      await addPackageUsage({
        package_type: 'nokryong',
        package_id: packageId,
        patient_id: patientId,
        chart_number: chartNumber,
        patient_name: patientName,
        usage_date: receiptDate,
        usage_type: 'add',
        count: nokryongDoses,
        mssql_detail_id: selectedDetailId || undefined,
        mssql_receipt_id: receiptId,
        memo: memo || undefined,
      });

      // 목록 새로고침 & 폼 초기화
      await loadPackages();
      onSuccess();
      resetForm();
    } catch (err) {
      console.error('녹용 패키지 추가 오류:', err);
      alert('등록에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTreatmentAdd = async () => {
    if (!selectedPackageType) return;
    setIsSaving(true);
    try {
      const packageId = await createTreatmentPackage({
        patient_id: patientId,
        chart_number: chartNumber,
        patient_name: patientName,
        package_name: selectedPackageType,
        total_count: packageCount,
        used_count: 0,
        remaining_count: packageCount,
        start_date: receiptDate,
        memo: memo || undefined,
        mssql_detail_id: selectedDetailId || undefined,
        status: 'active',
      });

      // 사용기록 추가
      await addPackageUsage({
        package_type: 'treatment',
        package_id: packageId,
        patient_id: patientId,
        chart_number: chartNumber,
        patient_name: patientName,
        usage_date: receiptDate,
        usage_type: 'add',
        count: packageCount,
        mssql_detail_id: selectedDetailId || undefined,
        mssql_receipt_id: receiptId,
        memo: memo || undefined,
      });

      // 목록 새로고침 & 폼 초기화
      await loadPackages();
      onSuccess();
      resetForm();
    } catch (err) {
      console.error('치료패키지 추가 오류:', err);
      alert('등록에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleMembershipAdd = async () => {
    if (!selectedMembershipType) return;
    if (!membershipStartDate || !membershipExpireDate) {
      alert('시작일과 만료일을 선택해주세요.');
      return;
    }
    setIsSaving(true);
    try {
      // 기간 계산 (개월 수)
      const start = new Date(membershipStartDate);
      const expire = new Date(membershipExpireDate);
      const monthDiff = (expire.getFullYear() - start.getFullYear()) * 12 + (expire.getMonth() - start.getMonth());
      const periodMonths = Math.max(1, monthDiff);

      const membershipId = await createMembership({
        patient_id: patientId,
        chart_number: chartNumber,
        patient_name: patientName,
        membership_type: selectedMembershipType,
        quantity: 1,
        start_date: membershipStartDate,
        expire_date: membershipExpireDate,
        memo: memo || undefined,
        mssql_detail_id: selectedDetailId || undefined,
        status: 'active',
      });

      // 사용기록 추가
      await addPackageUsage({
        package_type: 'membership',
        package_id: membershipId,
        patient_id: patientId,
        chart_number: chartNumber,
        patient_name: patientName,
        usage_date: membershipStartDate,
        usage_type: 'add',
        count: periodMonths,
        mssql_detail_id: selectedDetailId || undefined,
        mssql_receipt_id: receiptId,
        memo: `${periodMonths}개월`,
      });

      // 목록 새로고침 & 폼 초기화
      await loadPackages();
      onSuccess();
      resetForm();
    } catch (err) {
      console.error('멤버십 추가 오류:', err);
      alert('등록에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeduct = async () => {
    if (!selectedAction?.packageGroup || !selectedPackageId) return;
    setIsSaving(true);
    try {
      await deductPackage({
        packageType: selectedAction.packageType,
        packageId: selectedPackageId,
        patientId,
        chartNumber,
        patientName,
        usageDate: receiptDate,
        count: deductCount,
        mssqlDetailId: selectedDetailId || undefined,
        mssqlReceiptId: receiptId,
        memo: memo || undefined,
      });

      // 목록 새로고침 & 폼 초기화
      await loadPackages();
      onSuccess();
      resetForm();
    } catch (err) {
      console.error('차감 오류:', err);
      alert('차감에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleMembershipApply = async () => {
    if (!selectedPackageId || !selectedDetailId) {
      alert('적용할 비급여 항목을 선택해주세요.');
      return;
    }
    setIsSaving(true);
    try {
      await applyMembership({
        membershipId: selectedPackageId,
        patientId,
        chartNumber,
        patientName,
        usageDate: receiptDate,
        mssqlDetailId: selectedDetailId,
        mssqlReceiptId: receiptId,
        memo: memo || undefined,
      });

      // 목록 새로고침 & 폼 초기화
      await loadPackages();
      onSuccess();
      resetForm();
    } catch (err) {
      console.error('멤버십 적용 오류:', err);
      alert('적용에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = () => {
    if (!selectedAction) return;

    if (selectedAction.type === 'add') {
      switch (selectedAction.packageType) {
        case 'herbal': handleHerbalAdd(); break;
        case 'nokryong': handleNokryongAdd(); break;
        case 'treatment': handleTreatmentAdd(); break;
        case 'membership': handleMembershipAdd(); break;
      }
    } else if (selectedAction.type === 'deduct') {
      handleDeduct();
    } else if (selectedAction.type === 'apply') {
      handleMembershipApply();
    }
  };

  // 폼 렌더링
  const renderForm = () => {
    if (!selectedAction) {
      return (
        <div className="package-form-empty">
          <i className="fa-solid fa-hand-pointer"></i>
          <p>좌측에서 [추가] 또는 [차감] 버튼을 클릭하세요</p>
        </div>
      );
    }

    const { type, packageType, packageGroup } = selectedAction;

    return (
      <div className="package-form">
        <h4 className="package-form-title">
          {PACKAGE_CATEGORY_LABELS[packageType]} {type === 'add' ? '추가' : type === 'deduct' ? '차감' : '적용'}
          {packageGroup && <span className="package-form-subtitle"> - {packageGroup.name}</span>}
        </h4>

        {/* 비급여 항목 연결 */}
        <div className="form-group">
          <label>연결할 비급여 항목</label>
          <select
            value={selectedDetailId || ''}
            onChange={e => setSelectedDetailId(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">연결 안함</option>
            {uncoveredItems.map(item => (
              <option key={item.detailId} value={item.detailId}>
                {item.itemName} - {item.amount?.toLocaleString()}원
              </option>
            ))}
          </select>
        </div>

        {/* 추가 폼 */}
        {type === 'add' && packageType === 'herbal' && (
          <>
            <div className="form-group">
              <label>치료목적</label>
              <select value={selectedHerbalPurpose} onChange={e => setSelectedHerbalPurpose(e.target.value)}>
                {herbalPurposes.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>기간</label>
              <div className="period-buttons">
                {(['1month', '2month', '3month', '6month'] as const).map(period => (
                  <button
                    key={period}
                    type="button"
                    className={`period-btn ${herbalPackageType === period ? 'active' : ''}`}
                    onClick={() => setHerbalPackageType(period)}
                  >
                    {period.replace('month', 'M')}
                    <span className="period-count">({HERBAL_PACKAGE_ROUNDS[period]}회)</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label>질환명</label>
              <div className="disease-tags-input">
                <div className="selected-tags">
                  {herbalDiseaseTags.map(tag => (
                    <span key={tag.name} className="disease-tag">
                      {tag.name}
                      <button type="button" onClick={() => handleRemoveDiseaseTag(tag.name)}>
                        <i className="fa-solid fa-xmark"></i>
                      </button>
                    </span>
                  ))}
                </div>
                <input
                  type="text"
                  value={diseaseInput}
                  onChange={e => setDiseaseInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && diseaseInput.trim()) {
                      e.preventDefault();
                      handleAddDiseaseTag({ name: diseaseInput.trim() });
                    }
                  }}
                  placeholder="질환명 입력 (Enter)"
                />
                {diseaseInput && filteredDiseaseTags.length > 0 && (
                  <div className="disease-suggestions">
                    {filteredDiseaseTags.slice(0, 5).map(tag => (
                      <div key={tag.id} className="suggestion-item" onClick={() => handleAddDiseaseTag(tag)}>
                        {tag.name}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {type === 'add' && packageType === 'nokryong' && (
          <>
            <div className="form-group">
              <label>녹용 종류</label>
              <div className="nokryong-type-buttons">
                {nokryongTypes.map(t => (
                  <button
                    key={t}
                    type="button"
                    className={`nokryong-type-btn ${selectedNokryongType === t ? 'active' : ''}`}
                    onClick={() => setSelectedNokryongType(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label>회분</label>
              <div className="doses-row">
                {[1, 2, 3, 4, 5, 6].map(dose => (
                  <button
                    key={dose}
                    type="button"
                    className={`dose-quick-btn ${nokryongDoses === dose ? 'active' : ''}`}
                    onClick={() => setNokryongDoses(dose)}
                  >
                    {dose}
                  </button>
                ))}
                <input
                  type="number"
                  min="1"
                  value={nokryongDoses}
                  onChange={e => setNokryongDoses(parseInt(e.target.value) || 1)}
                  className="doses-input"
                />
                <span className="doses-unit">회분</span>
              </div>
            </div>
          </>
        )}

        {type === 'add' && packageType === 'treatment' && (
          <>
            <div className="form-group">
              <label>패키지 종류</label>
              <select value={selectedPackageType} onChange={e => setSelectedPackageType(e.target.value)}>
                {packageTypes.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>총 횟수</label>
              <input
                type="number"
                value={packageCount}
                onChange={e => setPackageCount(Number(e.target.value))}
                min={1}
              />
            </div>
          </>
        )}

        {type === 'add' && packageType === 'membership' && (
          <>
            <div className="form-group">
              <label>멤버십 종류</label>
              <select value={selectedMembershipType} onChange={e => setSelectedMembershipType(e.target.value)}>
                {membershipTypes.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>시작일</label>
              <input
                type="date"
                value={membershipStartDate}
                onChange={e => {
                  const newStart = e.target.value;
                  setMembershipStartDate(newStart);
                  // 만료일이 없거나 시작일보다 이전이면 자동 설정 (1년 후)
                  if (!membershipExpireDate || membershipExpireDate < newStart) {
                    const d = new Date(newStart);
                    d.setFullYear(d.getFullYear() + 1);
                    d.setDate(d.getDate() - 1);
                    setMembershipExpireDate(d.toISOString().split('T')[0]);
                  }
                }}
              />
            </div>
            <div className="form-group">
              <label>만료일</label>
              <input
                type="date"
                value={membershipExpireDate}
                onChange={e => setMembershipExpireDate(e.target.value)}
                min={membershipStartDate}
              />
            </div>
            <div className="form-group">
              <label>빠른 설정</label>
              <div className="period-quick-buttons">
                {[
                  { label: '1개월', months: 1 },
                  { label: '3개월', months: 3 },
                  { label: '6개월', months: 6 },
                  { label: '1년', months: 12 },
                ].map(({ label, months }) => (
                  <button
                    key={months}
                    type="button"
                    className="period-quick-btn"
                    onClick={() => {
                      const d = new Date(membershipStartDate);
                      d.setMonth(d.getMonth() + months);
                      d.setDate(d.getDate() - 1);
                      setMembershipExpireDate(d.toISOString().split('T')[0]);
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* 차감 폼 */}
        {type === 'deduct' && packageGroup && (
          <>
            {packageGroup.packages.length > 1 && (
              <div className="form-group">
                <label>차감할 패키지 선택</label>
                <select
                  value={selectedPackageId || ''}
                  onChange={e => setSelectedPackageId(Number(e.target.value))}
                >
                  {packageGroup.packages.map((pkg, idx) => (
                    <option key={pkg.id} value={pkg.id}>
                      패키지 #{idx + 1} (잔여: {pkg.remaining}회)
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="form-group">
              <label>차감 횟수</label>
              <div className="deduct-count-row">
                {[1, 2, 3].map(n => (
                  <button
                    key={n}
                    type="button"
                    className={`deduct-btn ${deductCount === n ? 'active' : ''}`}
                    onClick={() => setDeductCount(n)}
                  >
                    {n}회
                  </button>
                ))}
                <input
                  type="number"
                  min={1}
                  value={deductCount}
                  onChange={e => setDeductCount(Number(e.target.value))}
                  className="deduct-input"
                />
              </div>
            </div>
          </>
        )}

        {/* 멤버십 적용 폼 */}
        {type === 'apply' && (
          <div className="form-group">
            <p className="apply-notice">
              선택한 비급여 항목에 멤버십을 적용합니다.
            </p>
          </div>
        )}

        {/* 메모 */}
        <div className="form-group">
          <label>메모</label>
          <input
            type="text"
            value={memo}
            onChange={e => setMemo(e.target.value)}
            placeholder="메모 (선택사항)"
          />
        </div>

        {/* 등록 버튼 */}
        <button
          className="btn-submit"
          onClick={handleSubmit}
          disabled={isSaving}
        >
          {isSaving ? '처리 중...' : type === 'add' ? '등록' : type === 'deduct' ? '차감' : '적용'}
        </button>
      </div>
    );
  };

  const herbalGroups = getHerbalGroups();
  const nokryongGroups = getNokryongGroups();
  const treatmentGroups = getTreatmentGroups();
  const membershipGroups = getMembershipGroups();

  return (
    <div
      className="package-modal-overlay"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <div
        ref={modalRef}
        className={`package-modal ${isDragging ? 'dragging' : ''}`}
        style={{
          transform: `translate(${position.x}px, ${position.y}px)`,
        }}
        onMouseDown={handleMouseDown}
      >
        <div className="package-modal-header">
          <h3>패키지 관리 - {patientName}</h3>
          <button className="btn-close" onClick={onClose}>
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div className="package-modal-body">
          {/* 좌측: 패키지 목록 */}
          <div className="package-list-panel">
            <h4>보유 패키지</h4>

            {/* 한약 */}
            <div className="package-category">
              <div className="category-header">
                <i className="fa-solid fa-leaf"></i> 한약
                <button className="btn-add-small" onClick={() => handleActionSelect('add', 'herbal')}>
                  <i className="fa-solid fa-plus"></i> 추가
                </button>
              </div>
              {herbalGroups.length === 0 ? (
                <div className="no-package">등록된 패키지 없음</div>
              ) : (
                herbalGroups.map((group, idx) => (
                  <div key={idx} className="package-item">
                    <span className="package-name">{group.name}</span>
                    <span className="package-remaining">{group.totalRemaining}회</span>
                    <button className="btn-action" onClick={() => handleActionSelect('deduct', 'herbal', group)}>
                      차감
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* 녹용 */}
            <div className="package-category">
              <div className="category-header">
                <i className="fa-solid fa-deer"></i> 녹용
                <button className="btn-add-small" onClick={() => handleActionSelect('add', 'nokryong')}>
                  <i className="fa-solid fa-plus"></i> 추가
                </button>
              </div>
              {nokryongGroups.length === 0 ? (
                <div className="no-package">등록된 패키지 없음</div>
              ) : (
                nokryongGroups.map((group, idx) => (
                  <div key={idx} className="package-item">
                    <span className="package-name">{group.name}</span>
                    <span className="package-remaining">{group.totalRemaining}회</span>
                    <button className="btn-action" onClick={() => handleActionSelect('deduct', 'nokryong', group)}>
                      차감
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* 통증마일리지 */}
            <div className="package-category">
              <div className="category-header">
                <i className="fa-solid fa-hand-holding-medical"></i> 통증마일리지
                <button className="btn-add-small" onClick={() => handleActionSelect('add', 'treatment')}>
                  <i className="fa-solid fa-plus"></i> 추가
                </button>
              </div>
              {treatmentGroups.length === 0 ? (
                <div className="no-package">등록된 패키지 없음</div>
              ) : (
                treatmentGroups.map((group, idx) => (
                  <div key={idx} className="package-item">
                    <span className="package-name">{group.name}</span>
                    <span className="package-remaining">{group.totalRemaining}회</span>
                    <button className="btn-action" onClick={() => handleActionSelect('deduct', 'treatment', group)}>
                      차감
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* 멤버십 */}
            <div className="package-category">
              <div className="category-header">
                <i className="fa-solid fa-crown"></i> 멤버십
                <button className="btn-add-small" onClick={() => handleActionSelect('add', 'membership')}>
                  <i className="fa-solid fa-plus"></i> 추가
                </button>
              </div>
              {membershipGroups.length === 0 ? (
                <div className="no-package">등록된 멤버십 없음</div>
              ) : (
                membershipGroups.map((group, idx) => (
                  <div key={idx} className="package-item">
                    <span className="package-name">{group.name}</span>
                    <span className="package-remaining">
                      ~{group.packages[0]?.expireDate?.slice(5).replace('-', '.')}
                    </span>
                    <button className="btn-action btn-apply" onClick={() => {
                      setSelectedPackageId(group.packages[0].id);
                      handleActionSelect('apply', 'membership', group);
                    }}>
                      적용
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 우측: 폼 */}
          <div className="package-form-panel">
            {renderForm()}
          </div>
        </div>
      </div>
    </div>
  );
}

export default PackageManageModal;
