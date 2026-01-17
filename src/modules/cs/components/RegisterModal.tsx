import React, { useState, useEffect } from 'react';
import {
  createTreatmentPackage,
  createMembership,
  createHerbalPackage,
  createNokryongPackage,
  updateHerbalPackage,
  getPackageTypes,
  getMembershipTypes,
  getHerbalPurposes,
  getNokryongTypes,
  getHerbalDiseaseTags,
  getPackageDiseaseTags,
  findOrCreateDiseaseTag,
  setPackageDiseaseTags,
  addReceiptMemo,
  updateReceiptMemoById,
  type PackageType,
  type HerbalDiseaseTag,
} from '../lib/api';
import { HERBAL_PACKAGE_ROUNDS, type HerbalPackage } from '../types';

interface UncoveredItem {
  detailId: number;
  itemName: string;
  amount: number;
}

interface RegisterModalProps {
  type: 'package' | 'membership' | 'herbal';
  patientId: number;
  patientName: string;
  chartNumber: string;
  receiptId: number;
  receiptDate: string;
  uncoveredItems: UncoveredItem[];
  editHerbalPackage?: HerbalPackage;  // 수정 모드: 기존 패키지 데이터
  editMemoId?: number;                 // 수정 모드: 연결된 메모 ID
  defaultTab?: 'herbal' | 'nokryong'; // 한약 모달 기본 탭
  onClose: () => void;
  onSuccess: () => void;
}

function RegisterModal({
  type,
  patientId,
  patientName,
  chartNumber,
  receiptId,
  receiptDate,
  uncoveredItems,
  editHerbalPackage,
  editMemoId,
  defaultTab,
  onClose,
  onSuccess,
}: RegisterModalProps) {
  const isEditMode = !!editHerbalPackage;
  const [isSaving, setIsSaving] = useState(false);
  const [selectedDetailId, setSelectedDetailId] = useState<number | null>(
    editHerbalPackage?.mssql_detail_id || null
  );

  // 패키지 등록 상태
  const [packageTypeOptions, setPackageTypeOptions] = useState<PackageType[]>([]);
  const [selectedPackageType, setSelectedPackageType] = useState('');
  const [packageCount, setPackageCount] = useState(10);
  const [packageMemo, setPackageMemo] = useState('');

  // 멤버십 등록 상태
  const [membershipTypeOptions, setMembershipTypeOptions] = useState<string[]>([]);
  const [membershipType, setMembershipType] = useState('');
  const [membershipPeriod, setMembershipPeriod] = useState(1);
  const [membershipMemo, setMembershipMemo] = useState('');
  const periodOptions = [
    { value: 1, label: '1개월' },
    { value: 3, label: '3개월' },
    { value: 6, label: '6개월' },
    { value: 12, label: '1년' },
  ];

  // 한약 선결제 등록 상태
  const [herbalPurposes, setHerbalPurposes] = useState<string[]>([]);
  const [selectedHerbalPurpose, setSelectedHerbalPurpose] = useState(
    editHerbalPackage?.herbal_name || ''
  );
  const [newHerbalPackageType, setNewHerbalPackageType] = useState<'1month' | '2month' | '3month' | '6month'>(
    (editHerbalPackage?.package_type as '1month' | '2month' | '3month' | '6month') || '1month'
  );
  const [newHerbalMemo, setNewHerbalMemo] = useState(editHerbalPackage?.memo || '');
  // 질환명 태그
  const [availableDiseaseTags, setAvailableDiseaseTags] = useState<HerbalDiseaseTag[]>([]);
  const [selectedDiseaseTags, setSelectedDiseaseTags] = useState<{ id?: number; name: string }[]>([]);
  const [diseaseInput, setDiseaseInput] = useState('');
  const [showDiseaseSuggestions, setShowDiseaseSuggestions] = useState(false);
  // 녹용 등록 상태
  const [nokryongTypeOptions, setNokryongTypeOptions] = useState<string[]>([]);
  const [selectedNokryongType, setSelectedNokryongType] = useState('');
  const [newNokryongDoses, setNewNokryongDoses] = useState(1); // 회분
  // 한약 탭: 'herbal' | 'nokryong'
  const [herbalTab, setHerbalTab] = useState<'herbal' | 'nokryong'>(defaultTab || 'herbal');

  // 초기 데이터 로드
  useEffect(() => {
    const loadData = async () => {
      if (type === 'package') {
        const types = await getPackageTypes();
        setPackageTypeOptions(types);
        if (types.length > 0) {
          setSelectedPackageType(types[0].name);
        }
      } else if (type === 'membership') {
        const types = await getMembershipTypes();
        setMembershipTypeOptions(types);
        if (types.length > 0) {
          setMembershipType(types[0]);
        }
      } else if (type === 'herbal') {
        const [purposes, tags, nokryongTypes] = await Promise.all([
          getHerbalPurposes(),
          getHerbalDiseaseTags(),
          getNokryongTypes(),
        ]);
        setHerbalPurposes(purposes);
        setAvailableDiseaseTags(tags);
        setNokryongTypeOptions(nokryongTypes);
        // 수정 모드가 아닐 때만 첫 번째 목적 선택
        if (!isEditMode && purposes.length > 0) {
          setSelectedHerbalPurpose(purposes[0]);
        }
        // 녹용 종류 기본값 설정
        if (nokryongTypes.length > 0) {
          setSelectedNokryongType(nokryongTypes[0]);
        }
      }
    };
    loadData();
  }, [type, isEditMode]);

  // 수정 모드: 기존 질환명 태그 로드
  useEffect(() => {
    const loadExistingTags = async () => {
      if (isEditMode && editHerbalPackage?.id) {
        const existingTags = await getPackageDiseaseTags(editHerbalPackage.id);
        setSelectedDiseaseTags(existingTags.map(t => ({ id: t.id, name: t.name })));
      }
    };
    loadExistingTags();
  }, [isEditMode, editHerbalPackage]);

  // 제목
  const getTitle = () => {
    if (isEditMode) {
      return '한약 선결제 수정';
    }
    switch (type) {
      case 'package': return '패키지 등록';
      case 'membership': return '멤버십 등록';
      case 'herbal': return '한약 선결제 등록';
    }
  };

  // 패키지 등록
  const handlePackageRegister = async () => {
    if (!selectedPackageType) {
      alert('패키지 종류를 선택해주세요.');
      return;
    }

    setIsSaving(true);
    try {
      await createTreatmentPackage({
        patient_id: patientId,
        chart_number: chartNumber,
        patient_name: patientName,
        package_name: selectedPackageType,
        total_count: packageCount,
        used_count: 0,
        remaining_count: packageCount,
        start_date: receiptDate,
        memo: packageMemo || undefined,
        mssql_detail_id: selectedDetailId || undefined,
        status: 'active',
      });

      onSuccess();
      onClose();
    } catch (err) {
      console.error('패키지 등록 오류:', err);
      alert('등록에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  // 멤버십 등록
  const handleMembershipRegister = async () => {
    if (!membershipType) {
      alert('멤버십 종류를 선택해주세요.');
      return;
    }

    setIsSaving(true);
    try {
      const startDate = new Date(receiptDate);
      const expireDate = new Date(startDate);
      expireDate.setMonth(expireDate.getMonth() + membershipPeriod);
      expireDate.setDate(expireDate.getDate() - 1);
      const expireDateStr = expireDate.toISOString().split('T')[0];

      await createMembership({
        patient_id: patientId,
        chart_number: chartNumber,
        patient_name: patientName,
        membership_type: membershipType,
        quantity: 1,
        start_date: receiptDate,
        expire_date: expireDateStr,
        memo: membershipMemo || undefined,
        mssql_detail_id: selectedDetailId || undefined,
        status: 'active',
      });

      onSuccess();
      onClose();
    } catch (err) {
      console.error('멤버십 등록 오류:', err);
      alert('등록에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  // 한약 선결제 등록/수정
  const handleHerbalRegister = async () => {
    if (!selectedHerbalPurpose) {
      alert('치료목적을 선택해주세요.');
      return;
    }

    setIsSaving(true);
    try {
      const totalCount = HERBAL_PACKAGE_ROUNDS[newHerbalPackageType] || 2;
      const monthNum = newHerbalPackageType.replace('month', '');

      if (isEditMode && editHerbalPackage?.id) {
        // 수정 모드: 패키지 업데이트
        await updateHerbalPackage(editHerbalPackage.id, {
          herbal_name: selectedHerbalPurpose,
          package_type: newHerbalPackageType,
          total_count: totalCount,
          remaining_count: totalCount - (editHerbalPackage.used_count || 0),
          memo: newHerbalMemo.trim() || undefined,
          mssql_detail_id: selectedDetailId || undefined,
        });

        // 질환명 태그 연결
        if (selectedDiseaseTags.length > 0) {
          const tagIds: number[] = [];
          for (const tag of selectedDiseaseTags) {
            const tagId = tag.id ?? await findOrCreateDiseaseTag(tag.name);
            tagIds.push(tagId);
          }
          await setPackageDiseaseTags(editHerbalPackage.id, tagIds);
        }

        // 메모 수정
        if (editMemoId) {
          await updateReceiptMemoById(editMemoId, `${monthNum}개월 선결제`);
        }
      } else {
        // 신규 등록 모드
        const packageId = await createHerbalPackage({
          patient_id: patientId,
          chart_number: chartNumber,
          patient_name: patientName,
          herbal_name: selectedHerbalPurpose,
          package_type: newHerbalPackageType,
          total_count: totalCount,
          used_count: 0,
          remaining_count: totalCount,
          start_date: receiptDate,
          memo: newHerbalMemo.trim() || undefined,
          mssql_detail_id: selectedDetailId || undefined,
          status: 'active',
        });

        // 질환명 태그 연결
        if (selectedDiseaseTags.length > 0) {
          const tagIds: number[] = [];
          for (const tag of selectedDiseaseTags) {
            const tagId = tag.id ?? await findOrCreateDiseaseTag(tag.name);
            tagIds.push(tagId);
          }
          await setPackageDiseaseTags(packageId, tagIds);
        }

        // 메모 생성: "1개월 선결제" 형식 + herbal_package_id 연결
        await addReceiptMemo({
          patient_id: patientId,
          chart_number: chartNumber,
          patient_name: patientName,
          mssql_receipt_id: receiptId,
          receipt_date: receiptDate,
          memo: `${monthNum}개월 선결제`,
          herbal_package_id: packageId,
        });
      }

      onSuccess();
      onClose();
    } catch (err) {
      console.error('선결제 등록/수정 오류:', err);
      alert(isEditMode ? '수정에 실패했습니다.' : '등록에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  // 녹용 등록
  const handleNokryongRegister = async () => {
    if (!selectedNokryongType) {
      alert('녹용 종류를 선택해주세요.');
      return;
    }
    if (!newNokryongDoses || newNokryongDoses <= 0) {
      alert('회분을 입력해주세요.');
      return;
    }
    setIsSaving(true);
    try {
      await createNokryongPackage({
        patient_id: patientId,
        chart_number: chartNumber,
        patient_name: patientName,
        package_name: `녹용(${selectedNokryongType}) ${newNokryongDoses}회분`,
        total_months: newNokryongDoses,  // 회분 수로 사용
        remaining_months: newNokryongDoses,
        start_date: receiptDate,
        status: 'active',
        mssql_detail_id: selectedDetailId || undefined,
      });

      // 메모 생성: "녹용(원대) 6회분" 형식
      await addReceiptMemo({
        patient_id: patientId,
        chart_number: chartNumber,
        patient_name: patientName,
        mssql_receipt_id: receiptId,
        receipt_date: receiptDate,
        memo: `녹용(${selectedNokryongType}) ${newNokryongDoses}회분`,
      });

      onSuccess();
      onClose();
    } catch (err) {
      console.error('녹용 등록 오류:', err);
      alert('등록에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  // 등록 핸들러
  const handleRegister = () => {
    switch (type) {
      case 'package':
        handlePackageRegister();
        break;
      case 'membership':
        handleMembershipRegister();
        break;
      case 'herbal':
        if (herbalTab === 'herbal') {
          handleHerbalRegister();
        } else {
          handleNokryongRegister();
        }
        break;
    }
  };

  // 질환명 태그 필터링
  const filteredDiseaseTags = availableDiseaseTags.filter(
    tag => tag.name.toLowerCase().includes(diseaseInput.toLowerCase()) &&
           !selectedDiseaseTags.some(s => s.name === tag.name)
  );

  // 질환명 태그 추가
  const handleAddDiseaseTag = (tag: { id?: number; name: string }) => {
    setSelectedDiseaseTags([...selectedDiseaseTags, tag]);
    setDiseaseInput('');
    setShowDiseaseSuggestions(false);
  };

  // 질환명 태그 제거
  const handleRemoveDiseaseTag = (name: string) => {
    setSelectedDiseaseTags(selectedDiseaseTags.filter(t => t.name !== name));
  };

  // 새 질환명 태그 입력
  const handleDiseaseInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && diseaseInput.trim()) {
      e.preventDefault();
      if (!selectedDiseaseTags.some(t => t.name === diseaseInput.trim())) {
        handleAddDiseaseTag({ name: diseaseInput.trim() });
      }
    }
  };

  return (
    <div className="register-modal-overlay" onClick={onClose}>
      <div className="register-modal" onClick={e => e.stopPropagation()}>
        <div className="register-modal-header">
          <h3>{getTitle()}</h3>
          <button className="btn-close" onClick={onClose}>
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div className="register-modal-body">
          {/* 비급여 항목 선택 */}
          <div className="form-group">
            <label>연결할 비급여 항목 <span className="optional">(선택사항)</span></label>
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

          <div className="form-divider"></div>

          {/* 패키지 등록 폼 */}
          {type === 'package' && (
            <>
              <div className="form-group">
                <label>패키지 종류</label>
                <select
                  value={selectedPackageType}
                  onChange={e => setSelectedPackageType(e.target.value)}
                >
                  {packageTypeOptions.map(opt => (
                    <option key={opt.name} value={opt.name}>{opt.name}</option>
                  ))}
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
              <div className="form-group">
                <label>메모</label>
                <input
                  type="text"
                  value={packageMemo}
                  onChange={e => setPackageMemo(e.target.value)}
                  placeholder="메모 (선택사항)"
                />
              </div>
            </>
          )}

          {/* 멤버십 등록 폼 */}
          {type === 'membership' && (
            <>
              <div className="form-group">
                <label>멤버십 종류</label>
                <select
                  value={membershipType}
                  onChange={e => setMembershipType(e.target.value)}
                >
                  {membershipTypeOptions.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>기간</label>
                <select
                  value={membershipPeriod}
                  onChange={e => setMembershipPeriod(Number(e.target.value))}
                >
                  {periodOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>메모</label>
                <input
                  type="text"
                  value={membershipMemo}
                  onChange={e => setMembershipMemo(e.target.value)}
                  placeholder="메모 (선택사항)"
                />
              </div>
            </>
          )}

          {/* 한약 선결제 등록 폼 */}
          {type === 'herbal' && (
            <>
              <div className="herbal-tabs">
                <button
                  className={`herbal-tab ${herbalTab === 'herbal' ? 'active' : ''}`}
                  onClick={() => setHerbalTab('herbal')}
                >
                  <i className="fa-solid fa-leaf"></i> 선결제 등록
                </button>
                <button
                  className={`herbal-tab ${herbalTab === 'nokryong' ? 'active' : ''}`}
                  onClick={() => setHerbalTab('nokryong')}
                >
                  <i className="fa-solid fa-deer"></i> 녹용 등록
                </button>
              </div>

              {herbalTab === 'herbal' ? (
                <>
                  <div className="form-group">
                    <label>치료목적</label>
                    <select
                      value={selectedHerbalPurpose}
                      onChange={e => setSelectedHerbalPurpose(e.target.value)}
                    >
                      {herbalPurposes.map(purpose => (
                        <option key={purpose} value={purpose}>{purpose}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>기간</label>
                    <div className="period-buttons">
                      {(['1month', '2month', '3month', '6month'] as const).map(period => (
                        <button
                          key={period}
                          className={`period-btn ${newHerbalPackageType === period ? 'active' : ''}`}
                          onClick={() => setNewHerbalPackageType(period)}
                        >
                          {period.replace('month', 'M')}
                          <span className="period-count">({HERBAL_PACKAGE_ROUNDS[period]}회)</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="form-group">
                    <label>질환명 태그</label>
                    <div className="disease-tags-container">
                      <div className="selected-tags">
                        {selectedDiseaseTags.map(tag => (
                          <span key={tag.name} className="disease-tag">
                            {tag.name}
                            <button onClick={() => handleRemoveDiseaseTag(tag.name)}>
                              <i className="fa-solid fa-xmark"></i>
                            </button>
                          </span>
                        ))}
                      </div>
                      <div className="disease-input-wrapper">
                        <input
                          type="text"
                          value={diseaseInput}
                          onChange={e => {
                            setDiseaseInput(e.target.value);
                            setShowDiseaseSuggestions(true);
                          }}
                          onFocus={() => setShowDiseaseSuggestions(true)}
                          onKeyDown={handleDiseaseInputKeyDown}
                          placeholder="질환명 입력 (Enter로 추가)"
                        />
                        {showDiseaseSuggestions && filteredDiseaseTags.length > 0 && (
                          <div className="disease-suggestions">
                            {filteredDiseaseTags.slice(0, 5).map(tag => (
                              <div
                                key={tag.id}
                                className="suggestion-item"
                                onClick={() => handleAddDiseaseTag(tag)}
                              >
                                {tag.name}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="form-group">
                    <label>메모</label>
                    <input
                      type="text"
                      value={newHerbalMemo}
                      onChange={e => setNewHerbalMemo(e.target.value)}
                      placeholder="메모 (선택사항)"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="form-group">
                    <label>녹용 종류</label>
                    <div className="nokryong-type-buttons">
                      {nokryongTypeOptions.map(ntype => (
                        <button
                          key={ntype}
                          className={`nokryong-type-btn ${selectedNokryongType === ntype ? 'active' : ''}`}
                          onClick={() => setSelectedNokryongType(ntype)}
                        >
                          {ntype}
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
                          className={`dose-quick-btn ${newNokryongDoses === dose ? 'active' : ''}`}
                          onClick={() => setNewNokryongDoses(dose)}
                        >
                          {dose}
                        </button>
                      ))}
                      <input
                        type="number"
                        min="7"
                        value={newNokryongDoses}
                        onChange={(e) => setNewNokryongDoses(parseInt(e.target.value) || 7)}
                        className="doses-input"
                      />
                      <span className="doses-unit">회분</span>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>

        <div className="register-modal-footer">
          <button className="btn-cancel" onClick={onClose}>
            취소
          </button>
          <button
            className="btn-register"
            onClick={handleRegister}
            disabled={isSaving}
          >
            {isSaving ? (isEditMode ? '수정 중...' : '등록 중...') : (isEditMode ? '수정' : '등록')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default RegisterModal;
