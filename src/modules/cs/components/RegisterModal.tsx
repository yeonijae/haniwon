import React, { useState, useEffect } from 'react';
import {
  createTreatmentPackage,
  createMembership,
  createHerbalPackage,
  createNokryongPackage,
  updateHerbalPackage,
  updateNokryongPackage,
  deleteNokryongPackage,
  getPackageTypes,
  getMembershipTypes,
  getHerbalPurposes,
  getNokryongTypes,
  getHerbalDiseaseTags,
  getPackageDiseaseTags,
  getActiveHerbalPackages,
  getActiveNokryongPackages,
  findOrCreateDiseaseTag,
  setPackageDiseaseTags,
  addReceiptMemo,
  updateReceiptMemoById,
  deleteReceiptMemoById,
  type PackageType,
  type HerbalDiseaseTag,
} from '../lib/api';
import { getAvailableSlots, reserveSlot } from '../lib/decoctionApi';
import { fetchPatientMainDoctor } from '@modules/acting/api';
import {
  HERBAL_PACKAGE_ROUNDS,
  type HerbalPackage,
  type NokryongPackage,
  type DecoctionSlot,
  type DeliveryMethod,
  DELIVERY_METHOD_LABELS,
} from '../types';

// 원장 목록 (하드코딩 - 추후 DB화 가능)
const DOCTOR_LIST = [
  { id: 1, name: '강희종' },
  { id: 3, name: '김대현' },
  { id: 13, name: '임세열' },
  { id: 15, name: '전인태' },
];

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
  editHerbalPackage?: HerbalPackage;  // 수정 모드: 기존 한약 패키지 데이터
  editNokryongPackage?: NokryongPackage;  // 수정 모드: 기존 녹용 패키지 데이터
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
  editNokryongPackage,
  editMemoId,
  defaultTab,
  onClose,
  onSuccess,
}: RegisterModalProps) {
  const isHerbalEditMode = !!editHerbalPackage;
  const isNokryongEditMode = !!editNokryongPackage;
  const isEditMode = isHerbalEditMode || isNokryongEditMode;
  const [isSaving, setIsSaving] = useState(false);
  const [selectedDetailId, setSelectedDetailId] = useState<number | null>(
    editHerbalPackage?.mssql_detail_id || editNokryongPackage?.mssql_detail_id || null
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

  // 탕전/배송 관련 상태
  const [availableDecoctionSlots, setAvailableDecoctionSlots] = useState<DecoctionSlot[]>([]);
  const [selectedDecoctionDate, setSelectedDecoctionDate] = useState<string>(
    editHerbalPackage?.decoction_date || ''
  );
  const [selectedDeliveryMethod, setSelectedDeliveryMethod] = useState<DeliveryMethod>(
    editHerbalPackage?.delivery_method || 'pickup'
  );
  const [selectedDoctorId, setSelectedDoctorId] = useState<number | null>(
    editHerbalPackage?.doctor_id || null
  );
  const [selectedDoctorName, setSelectedDoctorName] = useState<string>(
    editHerbalPackage?.doctor_name || ''
  );

  // 질환명 태그
  const [availableDiseaseTags, setAvailableDiseaseTags] = useState<HerbalDiseaseTag[]>([]);
  const [selectedDiseaseTags, setSelectedDiseaseTags] = useState<{ id?: number; name: string }[]>([]);
  const [diseaseInput, setDiseaseInput] = useState('');
  const [showDiseaseSuggestions, setShowDiseaseSuggestions] = useState(false);
  // 녹용 등록 상태
  const [nokryongTypeOptions, setNokryongTypeOptions] = useState<string[]>([]);
  // 수정 모드: package_name에서 녹용 종류 추출 ("녹용(원대) 6회분" → "원대")
  const parseNokryongType = (packageName?: string) => {
    if (!packageName) return '';
    const match = packageName.match(/녹용\(([^)]+)\)/);
    return match ? match[1] : '';
  };
  const [selectedNokryongType, setSelectedNokryongType] = useState(
    parseNokryongType(editNokryongPackage?.package_name) || ''
  );
  const [newNokryongDoses, setNewNokryongDoses] = useState(
    editNokryongPackage?.total_months || 1
  ); // 회분
  // 한약 탭: 'herbal' | 'nokryong'
  const [herbalTab, setHerbalTab] = useState<'herbal' | 'nokryong'>(defaultTab || 'herbal');

  // 패키지 현황 상태
  const [activeHerbalPackages, setActiveHerbalPackages] = useState<(HerbalPackage & { diseaseTags?: string[] })[]>([]);
  const [activeNokryongPackages, setActiveNokryongPackages] = useState<NokryongPackage[]>([]);

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
        const [purposes, tags, nokryongTypes, herbalPkgs, nokryongPkgs, slots, mainDoctor] = await Promise.all([
          getHerbalPurposes(),
          getHerbalDiseaseTags(),
          getNokryongTypes(),
          getActiveHerbalPackages(patientId),
          getActiveNokryongPackages(patientId),
          getAvailableSlots(21), // 다음 3주간 예약 가능 슬롯
          fetchPatientMainDoctor(patientId).catch(() => null),
        ]);
        setHerbalPurposes(purposes);
        setAvailableDiseaseTags(tags);
        setNokryongTypeOptions(nokryongTypes);
        setActiveNokryongPackages(nokryongPkgs);
        setAvailableDecoctionSlots(slots);

        // 담당 원장 기본값 설정
        if (mainDoctor && !isEditMode) {
          setSelectedDoctorId(mainDoctor.doctorId);
          setSelectedDoctorName(mainDoctor.doctorName);
        }

        // 한약 패키지에 질환명 태그 추가
        const herbalPkgsWithTags = await Promise.all(
          herbalPkgs.map(async (pkg) => {
            if (pkg.id) {
              const diseaseTags = await getPackageDiseaseTags(pkg.id);
              return { ...pkg, diseaseTags: diseaseTags.map(t => t.name) };
            }
            return { ...pkg, diseaseTags: [] };
          })
        );
        setActiveHerbalPackages(herbalPkgsWithTags);

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
    if (isNokryongEditMode) {
      return '녹용 패키지 수정';
    }
    if (isHerbalEditMode) {
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
          // 탕전/배송 관련
          decoction_date: selectedDecoctionDate || undefined,
          delivery_method: selectedDeliveryMethod,
          doctor_id: selectedDoctorId || undefined,
          doctor_name: selectedDoctorName || undefined,
          prescription_due_date: selectedDecoctionDate || undefined, // 탕전일 = 처방 기한
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
        // 탕전 슬롯 예약
        if (selectedDecoctionDate) {
          await reserveSlot(selectedDecoctionDate);
        }

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
          // 탕전/배송 관련
          decoction_date: selectedDecoctionDate || undefined,
          delivery_method: selectedDeliveryMethod,
          doctor_id: selectedDoctorId || undefined,
          doctor_name: selectedDoctorName || undefined,
          prescription_due_date: selectedDecoctionDate || undefined,
          prescription_status: 'pending',
          decoction_status: 'pending',
          delivery_status: 'pending',
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

  // 녹용 등록/수정
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
      const memoText = `녹용(${selectedNokryongType}) ${newNokryongDoses}회분`;

      if (isNokryongEditMode && editNokryongPackage?.id) {
        // 수정 모드: 패키지 업데이트
        const usedMonths = editNokryongPackage.total_months - editNokryongPackage.remaining_months;
        await updateNokryongPackage(editNokryongPackage.id, {
          package_name: memoText,
          total_months: newNokryongDoses,
          remaining_months: Math.max(0, newNokryongDoses - usedMonths),
          mssql_detail_id: selectedDetailId || undefined,
        });

        // 메모 수정
        if (editMemoId) {
          await updateReceiptMemoById(editMemoId, memoText);
        }
      } else {
        // 신규 등록 모드
        const packageId = await createNokryongPackage({
          patient_id: patientId,
          chart_number: chartNumber,
          patient_name: patientName,
          package_name: memoText,
          total_months: newNokryongDoses,
          remaining_months: newNokryongDoses,
          start_date: receiptDate,
          status: 'active',
          mssql_detail_id: selectedDetailId || undefined,
        });

        // 메모 생성 (nokryong_package_id + mssql_detail_id 연결)
        await addReceiptMemo({
          patient_id: patientId,
          chart_number: chartNumber,
          patient_name: patientName,
          mssql_receipt_id: receiptId,
          mssql_detail_id: selectedDetailId || undefined,
          receipt_date: receiptDate,
          memo: memoText,
          nokryong_package_id: packageId,
        });
      }

      onSuccess();
      onClose();
    } catch (err) {
      console.error('녹용 등록/수정 오류:', err);
      alert(isNokryongEditMode ? '수정에 실패했습니다.' : '등록에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  // 녹용 삭제
  const handleNokryongDelete = async () => {
    if (!isNokryongEditMode || !editNokryongPackage?.id) return;

    if (!confirm('이 녹용 패키지를 삭제하시겠습니까?')) return;

    setIsSaving(true);
    try {
      // 패키지 삭제
      await deleteNokryongPackage(editNokryongPackage.id);

      // 연결된 메모도 삭제
      if (editMemoId) {
        await deleteReceiptMemoById(editMemoId);
      }

      onSuccess();
      onClose();
    } catch (err) {
      console.error('녹용 삭제 오류:', err);
      alert('삭제에 실패했습니다.');
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
              {/* 패키지 현황 (수정 모드가 아닐 때만 표시) */}
              {!isEditMode && (activeHerbalPackages.length > 0 || activeNokryongPackages.length > 0) && (
                <div className="package-status-section">
                  {/* 한약 패키지: 같은 종류(herbal_name + 첫번째 질환태그) 합산 */}
                  {(() => {
                    const herbalGrouped = activeHerbalPackages.reduce((acc, pkg) => {
                      const diseaseLabel = pkg.diseaseTags?.length ? pkg.diseaseTags[0] : '';
                      const key = diseaseLabel ? `${pkg.herbal_name}-${diseaseLabel}` : pkg.herbal_name;
                      if (!acc[key]) {
                        acc[key] = { label: key, remaining: 0 };
                      }
                      acc[key].remaining += pkg.remaining_count || 0;
                      return acc;
                    }, {} as Record<string, { label: string; remaining: number }>);

                    return Object.values(herbalGrouped).map((group, idx) => (
                      <div key={`herbal-${idx}`} className="package-status-item package-status-item--herbal">
                        <span className="package-status-type">한약선결제</span>
                        <span className="package-status-name">{group.label}</span>
                        <span className="package-status-remaining">{group.remaining}회 남음</span>
                      </div>
                    ));
                  })()}
                  {/* 녹용 패키지: 같은 종류(녹용 타입) 합산 */}
                  {(() => {
                    const nokryongGrouped = activeNokryongPackages.reduce((acc, pkg) => {
                      const match = pkg.package_name.match(/녹용\(([^)]+)\)/);
                      const typeName = match ? match[1] : pkg.package_name;
                      if (!acc[typeName]) {
                        acc[typeName] = { label: typeName, remaining: 0 };
                      }
                      acc[typeName].remaining += pkg.remaining_months || 0;
                      return acc;
                    }, {} as Record<string, { label: string; remaining: number }>);

                    return Object.values(nokryongGrouped).map((group, idx) => (
                      <div key={`nokryong-${idx}`} className="package-status-item package-status-item--nokryong">
                        <span className="package-status-type">녹용선결제</span>
                        <span className="package-status-name">{group.label}</span>
                        <span className="package-status-remaining">{group.remaining}회 남음</span>
                      </div>
                    ));
                  })()}
                </div>
              )}

              <div className="herbal-tabs">
                <button
                  className={`herbal-tab ${herbalTab === 'herbal' ? 'active' : ''}`}
                  onClick={() => setHerbalTab('herbal')}
                >
                  <i className="fa-solid fa-leaf"></i> 한약선결제 추가
                </button>
                <button
                  className={`herbal-tab ${herbalTab === 'nokryong' ? 'active' : ''}`}
                  onClick={() => setHerbalTab('nokryong')}
                >
                  <i className="fa-solid fa-deer"></i> 녹용선결제 추가
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

                  {/* 탕전일 선택 */}
                  <div className="form-group">
                    <label>탕전 예정일</label>
                    <select
                      value={selectedDecoctionDate}
                      onChange={e => setSelectedDecoctionDate(e.target.value)}
                      className="decoction-date-select"
                    >
                      <option value="">선택 안함</option>
                      {availableDecoctionSlots.map(slot => {
                        const date = new Date(slot.slot_date);
                        const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
                        const dayName = dayNames[date.getDay()];
                        const available = slot.total_capacity - slot.reserved_capacity;
                        return (
                          <option key={slot.slot_date} value={slot.slot_date}>
                            {slot.slot_date} ({dayName}) - 잔여 {available}건
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {/* 수령방식 선택 */}
                  <div className="form-group">
                    <label>수령 방식</label>
                    <div className="delivery-method-buttons">
                      {(['pickup', 'local', 'express'] as DeliveryMethod[]).map(method => (
                        <button
                          key={method}
                          type="button"
                          className={`delivery-method-btn ${selectedDeliveryMethod === method ? 'active' : ''}`}
                          onClick={() => setSelectedDeliveryMethod(method)}
                        >
                          {DELIVERY_METHOD_LABELS[method]}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 담당 원장 선택 */}
                  <div className="form-group">
                    <label>담당 원장</label>
                    <select
                      value={selectedDoctorId || ''}
                      onChange={e => {
                        const id = e.target.value ? Number(e.target.value) : null;
                        setSelectedDoctorId(id);
                        const doc = DOCTOR_LIST.find(d => d.id === id);
                        setSelectedDoctorName(doc?.name || '');
                      }}
                    >
                      <option value="">선택 안함</option>
                      {DOCTOR_LIST.map(doc => (
                        <option key={doc.id} value={doc.id}>{doc.name}</option>
                      ))}
                    </select>
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
          {isNokryongEditMode && (
            <button
              className="btn-delete"
              onClick={handleNokryongDelete}
              disabled={isSaving}
              style={{ marginRight: 'auto', background: '#ef4444', color: 'white' }}
            >
              삭제
            </button>
          )}
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
