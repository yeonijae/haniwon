import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  createHerbalPackage,
  createNokryongPackage,
  createTreatmentPackage,
  createMembership,
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
  type PackageType,
  HERBAL_PACKAGE_ROUNDS,
} from '../types';
import './PackageQuickAddModal.css';

interface UncoveredItem {
  detailId: number;
  itemName: string;
  amount: number;
}

interface PackageQuickAddModalProps {
  packageType: PackageType;
  patientId: number;
  patientName: string;
  chartNumber: string;
  receiptId: number;
  receiptDate: string;
  uncoveredItems: UncoveredItem[];
  onClose: () => void;
  onSuccess: () => void;
}

const PACKAGE_TITLES: Record<PackageType, string> = {
  herbal: '한약 등록',
  nokryong: '녹용 등록',
  treatment: '통마 등록',
  membership: '멤버십 등록',
};

const PACKAGE_COLORS: Record<PackageType, string> = {
  herbal: 'herbal',
  nokryong: 'nokryong',
  treatment: 'treatment',
  membership: 'membership',
};

function PackageQuickAddModal({
  packageType,
  patientId,
  patientName,
  chartNumber,
  receiptId,
  receiptDate,
  uncoveredItems,
  onClose,
  onSuccess,
}: PackageQuickAddModalProps) {
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
    if ((e.target as HTMLElement).closest('.quick-modal-header')) {
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

  // 공통 상태
  const [isSaving, setIsSaving] = useState(false);
  const [selectedDetailId, setSelectedDetailId] = useState<number | null>(null);
  const [memo, setMemo] = useState('');

  // 한약 폼 상태
  const [herbalPurposes, setHerbalPurposes] = useState<string[]>([]);
  const [selectedHerbalPurpose, setSelectedHerbalPurpose] = useState('');
  const [herbalPackageType, setHerbalPackageType] = useState<'0.5month' | '1month' | '2month' | '3month' | '6month'>('1month');
  const [herbalDiseaseTags, setHerbalDiseaseTags] = useState<{ id?: number; name: string }[]>([]);
  const [availableDiseaseTags, setAvailableDiseaseTags] = useState<{ id: number; name: string }[]>([]);
  const [diseaseInput, setDiseaseInput] = useState('');

  // 녹용 폼 상태
  const [nokryongTypes, setNokryongTypes] = useState<string[]>([]);
  const [selectedNokryongType, setSelectedNokryongType] = useState('');
  const [nokryongDoses, setNokryongDoses] = useState(1);

  // 통증마일리지 폼 상태
  const [packageTypes, setPackageTypes] = useState<TreatmentPackageOption[]>([]);
  const [selectedPackageTypeName, setSelectedPackageTypeName] = useState('');
  const [packageCount, setPackageCount] = useState(10);

  // 멤버십 폼 상태
  const [membershipTypes, setMembershipTypes] = useState<string[]>([]);
  const [selectedMembershipType, setSelectedMembershipType] = useState('');
  const [membershipPeriod, setMembershipPeriod] = useState(1);

  // 데이터 로드
  useEffect(() => {
    const loadData = async () => {
      switch (packageType) {
        case 'herbal': {
          const [purposes, tags] = await Promise.all([
            getHerbalPurposes(),
            getHerbalDiseaseTags(),
          ]);
          setHerbalPurposes(purposes);
          setAvailableDiseaseTags(tags);
          if (purposes.length > 0) setSelectedHerbalPurpose(purposes[0]);
          break;
        }
        case 'nokryong': {
          const types = await getNokryongTypes();
          setNokryongTypes(types);
          if (types.length > 0) setSelectedNokryongType(types[0]);
          break;
        }
        case 'treatment': {
          const types = await getPackageTypes();
          setPackageTypes(types);
          if (types.length > 0) setSelectedPackageTypeName(types[0].name);
          break;
        }
        case 'membership': {
          const types = await getMembershipTypes();
          setMembershipTypes(types);
          if (types.length > 0) setSelectedMembershipType(types[0]);
          break;
        }
      }
    };
    loadData();
  }, [packageType]);

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

  // 저장 핸들러
  const handleSubmit = async () => {
    setIsSaving(true);
    try {
      switch (packageType) {
        case 'herbal': {
          if (!selectedHerbalPurpose) {
            alert('치료목적을 선택해주세요.');
            return;
          }
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
          break;
        }

        case 'nokryong': {
          if (!selectedNokryongType) {
            alert('녹용 종류를 선택해주세요.');
            return;
          }
          const packageName = `녹용(${selectedNokryongType}) ${nokryongDoses}회분`;
          const packageId = await createNokryongPackage({
            patient_id: patientId,
            chart_number: chartNumber,
            patient_name: patientName,
            package_name: packageName,
            nokryong_type: selectedNokryongType,
            total_doses: nokryongDoses,
            used_doses: 0,
            total_months: nokryongDoses,
            remaining_months: nokryongDoses,
            start_date: receiptDate,
            status: 'active',
            mssql_detail_id: selectedDetailId || undefined,
          });

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
          break;
        }

        case 'treatment': {
          if (!selectedPackageTypeName) {
            alert('패키지 종류를 선택해주세요.');
            return;
          }
          const packageId = await createTreatmentPackage({
            patient_id: patientId,
            chart_number: chartNumber,
            patient_name: patientName,
            package_name: selectedPackageTypeName,
            total_count: packageCount,
            used_count: 0,
            remaining_count: packageCount,
            start_date: receiptDate,
            memo: memo || undefined,
            mssql_detail_id: selectedDetailId || undefined,
            status: 'active',
          });

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
          break;
        }

        case 'membership': {
          if (!selectedMembershipType) {
            alert('멤버십 종류를 선택해주세요.');
            return;
          }
          const startDate = new Date(receiptDate);
          const expireDate = new Date(startDate);
          expireDate.setMonth(expireDate.getMonth() + membershipPeriod);
          expireDate.setDate(expireDate.getDate() - 1);
          const expireDateStr = expireDate.toISOString().split('T')[0];

          const membershipId = await createMembership({
            patient_id: patientId,
            chart_number: chartNumber,
            patient_name: patientName,
            membership_type: selectedMembershipType,
            period_months: membershipPeriod,
            quantity: 1,
            start_date: receiptDate,
            end_date: expireDateStr,
            expire_date: expireDateStr,
            memo: memo || undefined,
            mssql_detail_id: selectedDetailId || undefined,
            status: 'active',
          });

          await addPackageUsage({
            package_type: 'membership',
            package_id: membershipId,
            patient_id: patientId,
            chart_number: chartNumber,
            patient_name: patientName,
            usage_date: receiptDate,
            usage_type: 'add',
            count: membershipPeriod,
            mssql_detail_id: selectedDetailId || undefined,
            mssql_receipt_id: receiptId,
            memo: `${membershipPeriod}개월`,
          });
          break;
        }
      }

      await onSuccess();
      onClose();
    } catch (err) {
      console.error('패키지 등록 오류:', err);
      alert('등록에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="quick-modal-overlay"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <div
        ref={modalRef}
        className={`quick-modal ${PACKAGE_COLORS[packageType]} ${isDragging ? 'dragging' : ''}`}
        style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
        onMouseDown={handleMouseDown}
      >
        <div className="quick-modal-header">
          <h3>{PACKAGE_TITLES[packageType]}</h3>
          <button className="btn-close" onClick={onClose}>
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div className="quick-modal-body">
          {/* 비급여 항목 연결 */}
          <div className="form-group">
            <label>비급여 항목 연결</label>
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

          {/* 한약 폼 */}
          {packageType === 'herbal' && (
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
                  {(['0.5month', '1month', '2month', '3month', '6month'] as const).map(period => (
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
                  {herbalDiseaseTags.length > 0 && (
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
                  )}
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

          {/* 녹용 폼 */}
          {packageType === 'nokryong' && (
            <>
              <div className="form-group">
                <label>녹용 종류</label>
                <div className="type-buttons">
                  {nokryongTypes.map(t => (
                    <button
                      key={t}
                      type="button"
                      className={`type-btn ${selectedNokryongType === t ? 'active' : ''}`}
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
                      className={`dose-btn ${nokryongDoses === dose ? 'active' : ''}`}
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

          {/* 통증마일리지 폼 */}
          {packageType === 'treatment' && (
            <>
              <div className="form-group">
                <label>패키지 종류</label>
                <select value={selectedPackageTypeName} onChange={e => setSelectedPackageTypeName(e.target.value)}>
                  {packageTypes.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>총 횟수</label>
                <div className="count-row">
                  {[5, 10, 15, 20].map(n => (
                    <button
                      key={n}
                      type="button"
                      className={`count-btn ${packageCount === n ? 'active' : ''}`}
                      onClick={() => setPackageCount(n)}
                    >
                      {n}회
                    </button>
                  ))}
                  <input
                    type="number"
                    min="1"
                    value={packageCount}
                    onChange={e => setPackageCount(Number(e.target.value))}
                    className="count-input"
                  />
                </div>
              </div>
            </>
          )}

          {/* 멤버십 폼 */}
          {packageType === 'membership' && (
            <>
              <div className="form-group">
                <label>멤버십 종류</label>
                <select value={selectedMembershipType} onChange={e => setSelectedMembershipType(e.target.value)}>
                  {membershipTypes.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>기간</label>
                <div className="period-buttons membership">
                  {[
                    { value: 1, label: '1개월' },
                    { value: 3, label: '3개월' },
                    { value: 6, label: '6개월' },
                    { value: 12, label: '1년' },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      className={`period-btn ${membershipPeriod === opt.value ? 'active' : ''}`}
                      onClick={() => setMembershipPeriod(opt.value)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
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
            {isSaving ? '등록 중...' : '등록'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default PackageQuickAddModal;
