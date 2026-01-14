import React, { useState, useEffect, useCallback } from 'react';
import { query, execute, escapeString, insert, getCurrentDate } from '@shared/lib/postgres';
import { addReceiptMemo, createYakchimUsageRecord, updateYakchimUsageRecord, updateMedicineUsage, deleteMedicineUsage, createTreatmentPackage, updateTreatmentPackage, deleteTreatmentPackage, createMembership, updateMembership, deleteMembership, getPackageTypes, getMembershipTypes, type PackageType } from '../lib/api';
import type { MedicineUsage, YakchimUsageRecord, TreatmentPackage, Membership as MembershipType } from '../types';

interface MemoInputPanelProps {
  patientId: number;
  patientName: string;
  chartNumber: string;
  receiptId: number;
  receiptDate: string;
  itemName: string;
  itemType: 'yakchim' | 'medicine' | 'herbal' | 'other' | 'package-register' | 'package-edit' | 'membership-register' | 'membership-edit';
  amount?: number;
  detailId?: number;         // MSSQL Detail_PK (비급여 항목 연결)
  editData?: MedicineUsage;  // 상비약 수정 모드용
  yakchimEditData?: YakchimUsageRecord;  // 약침 수정 모드용
  packageEditData?: TreatmentPackage;    // 패키지 수정 모드용
  membershipEditData?: MembershipType;   // 멤버십 수정 모드용
  onClose: () => void;
  onSuccess: () => void;
}

// 멤버십 타입
interface Membership {
  id: number;
  membership_type: string;
  quantity: number;
  expire_date: string;
  status: string;
}

// 패키지 타입
interface Package {
  id: number;
  package_name: string;
  total_count: number;
  used_count: number;
  remaining_count: number;
  expire_date?: string;
  status: string;
}

// 상비약 재고 타입
interface MedicineStock {
  id: number;
  prescription_id: number;
  name: string;
  category: string;
  current_stock: number;
}

// 한약 패키지 타입
interface HerbalPackage {
  id: number;
  package_type: string;
  herbal_name?: string;
  total_count: number;
  used_count: number;
  remaining_count: number;
  status: string;
}

const MemoInputPanel: React.FC<MemoInputPanelProps> = ({
  patientId,
  patientName,
  chartNumber,
  receiptId,
  receiptDate,
  itemName,
  itemType,
  amount = 0,
  detailId,
  editData,
  yakchimEditData,
  packageEditData,
  membershipEditData,
  onClose,
  onSuccess,
}) => {
  const isEditMode = !!editData;
  const isYakchimEditMode = !!yakchimEditData;
  const isMembershipEditMode = !!membershipEditData;
  const isPackageEditMode = !!packageEditData;

  // 포인트 패키지 여부 (비급여 항목명에 "포인트" 포함 시)
  const isPointPackage = itemType === 'package-register' && itemName.includes('포인트');

  // 공통 상태
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [sqlitePatientId, setSqlitePatientId] = useState<number | null>(null);

  // 약침 상태
  const [yakchimTab, setYakchimTab] = useState<'onetime' | 'package' | 'membership'>('onetime');
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);

  // 약침 일회성 상태
  const [yakchimTypeOptions, setYakchimTypeOptions] = useState<PackageType[]>([]);
  // 다중 선택 구조: { typeId, typeName, deductionCount, qty }
  const [selectedYakchims, setSelectedYakchims] = useState<Array<{
    typeId: number;
    typeName: string;
    deductionCount: number;
    qty: number;
  }>>([]);

  // 약침 수정 상태
  const [editYakchimItemName, setEditYakchimItemName] = useState('');
  const [editYakchimQty, setEditYakchimQty] = useState(1);
  const [editYakchimMemo, setEditYakchimMemo] = useState('');
  const [isYakchimEditing, setIsYakchimEditing] = useState(false);

  // 멤버십 수정 상태
  const [editMembershipMemo, setEditMembershipMemo] = useState('');

  // 상비약 상태
  const [medicineStocks, setMedicineStocks] = useState<MedicineStock[]>([]);
  const [selectedMedicine, setSelectedMedicine] = useState<MedicineStock | null>(null);
  const [medicineQty, setMedicineQty] = useState(editData?.quantity || 1);
  const [medicineSearch, setMedicineSearch] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [medicinePurpose, setMedicinePurpose] = useState(editData?.purpose || '상비약');
  const [purposeOptions, setPurposeOptions] = useState<string[]>(['감기약', '상비약', '보완처방', '증정', '치료약']);

  // 수정 모드에서 editData 값 반영
  useEffect(() => {
    if (isEditMode && editData) {
      if (editData.purpose) {
        setMedicinePurpose(editData.purpose);
      }
      if (editData.quantity) {
        setMedicineQty(editData.quantity);
      }
    }
  }, [isEditMode, editData]);

  // 패키지 수정 모드에서 초기값 반영
  useEffect(() => {
    if (isPackageEditMode && packageEditData) {
      setEditPackageCount(packageEditData.total_count);
    }
  }, [isPackageEditMode, packageEditData]);

  // 약침 수정 모드에서 초기값 반영
  useEffect(() => {
    if (isYakchimEditMode && yakchimEditData) {
      setEditYakchimItemName(yakchimEditData.item_name || '');
      setEditYakchimQty(yakchimEditData.quantity || 1);
      setEditYakchimMemo(yakchimEditData.memo || '');
      setIsYakchimEditing(false);
    }
  }, [isYakchimEditMode, yakchimEditData]);

  // 멤버십 수정 모드에서 초기값 반영
  useEffect(() => {
    if (isMembershipEditMode && membershipEditData) {
      setEditMembershipMemo(membershipEditData.memo || '');
    }
  }, [isMembershipEditMode, membershipEditData]);

  // 한약 상태
  const [herbalPackages, setHerbalPackages] = useState<HerbalPackage[]>([]);
  const [herbalAction, setHerbalAction] = useState<'dispense' | 'pickup'>('dispense');
  const [selectedHerbal, setSelectedHerbal] = useState<HerbalPackage | null>(null);
  const [herbalQty, setHerbalQty] = useState(1);

  // 패키지 등록 상태
  const [packageCount, setPackageCount] = useState(10);  // 기본 10회
  const [packageMemo, setPackageMemo] = useState('');
  const [packageTypeOptions, setPackageTypeOptions] = useState<PackageType[]>([]);
  const [selectedPackageType, setSelectedPackageType] = useState('');

  // 패키지 수정 상태
  const [editPackageCount, setEditPackageCount] = useState(0);

  // 멤버십 등록 상태
  const [membershipType, setMembershipType] = useState('');
  const [membershipPeriod, setMembershipPeriod] = useState(1);  // 기본 1개월
  const [membershipMemo, setMembershipMemo] = useState('');
  const [membershipTypeOptions, setMembershipTypeOptions] = useState<string[]>(['녹용']);
  const periodOptions = [
    { value: 1, label: '1개월' },
    { value: 3, label: '3개월' },
    { value: 6, label: '6개월' },
    { value: 12, label: '1년' },
  ];

  // 멤버십 종류 로드
  useEffect(() => {
    const loadMembershipTypes = async () => {
      try {
        const types = await getMembershipTypes();
        setMembershipTypeOptions(types);
        if (types.length > 0 && !membershipType) {
          setMembershipType(types[0]);
        }
      } catch (err) {
        console.error('멤버십 종류 로드 실패:', err);
      }
    };
    if (itemType === 'membership-register') {
      loadMembershipTypes();
    }
  }, [itemType]);

  // 패키지 종류 로드 (차감형만)
  useEffect(() => {
    const loadPackageTypes = async () => {
      try {
        const allTypes = await getPackageTypes();
        const deductionTypes = allTypes.filter(t => t.type === 'deduction');
        setPackageTypeOptions(deductionTypes);
        if (deductionTypes.length > 0 && !selectedPackageType) {
          setSelectedPackageType(deductionTypes[0].name);
        }
      } catch (err) {
        console.error('패키지 종류 로드 실패:', err);
      }
    };
    if (itemType === 'package-register') {
      loadPackageTypes();
    }
  }, [itemType]);

  // 약침/요법 종류 로드 (itemName에 따라 yakchim 또는 yobup 타입)
  useEffect(() => {
    const loadYakchimTypes = async () => {
      try {
        const allTypes = await getPackageTypes();
        // 요법이 포함된 항목이면 yobup 타입, 아니면 yakchim 타입
        const filterType = itemName.includes('요법') ? 'yobup' : 'yakchim';
        const filteredTypes = allTypes.filter(t => t.type === filterType);
        setYakchimTypeOptions(filteredTypes);
        // 다중 선택이므로 자동 선택 제거
        setSelectedYakchims([]);
      } catch (err) {
        console.error('약침/요법 종류 로드 실패:', err);
      }
    };
    if (itemType === 'yakchim') {
      loadYakchimTypes();
    }
  }, [itemType, itemName]);

  // 일반 메모 상태
  const [generalMemo, setGeneralMemo] = useState('');

  // PostgreSQL patient_id 조회/생성
  const getOrCreatePatient = useCallback(async (): Promise<number | null> => {
    try {
      const result = await query<{ id: number }>(`
        SELECT id FROM patients
        WHERE chart_number = ${escapeString(chartNumber)}
           OR mssql_id = ${patientId}
        LIMIT 1
      `);

      if (result[0]) {
        return result[0].id;
      }

      await execute(`
        INSERT INTO patients (name, chart_number, mssql_id)
        VALUES (${escapeString(patientName)}, ${escapeString(chartNumber)}, ${patientId})
      `);

      const newResult = await query<{ id: number }>(`
        SELECT id FROM patients WHERE chart_number = ${escapeString(chartNumber)}
      `);
      return newResult[0]?.id || null;
    } catch (err) {
      console.error('환자 조회/생성 오류:', err);
      return null;
    }
  }, [patientId, patientName, chartNumber]);

  // 데이터 로드
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const pid = await getOrCreatePatient();
      setSqlitePatientId(pid);

      if (!pid) return;

      if (itemType === 'yakchim') {
        // 멤버십 조회 (MSSQL patient_id 사용)
        const membershipData = await query<Membership>(`
          SELECT id, membership_type, quantity, expire_date, status
          FROM cs_memberships
          WHERE patient_id = ${patientId} AND status = 'active'
          ORDER BY expire_date ASC
        `);
        setMemberships(membershipData);

        // 패키지 조회 (MSSQL patient_id 사용)
        const packageData = await query<Package>(`
          SELECT id, package_name, total_count, used_count, remaining_count, expire_date, status
          FROM cs_treatment_packages
          WHERE patient_id = ${patientId} AND status = 'active' AND remaining_count > 0
          ORDER BY created_at DESC
        `);
        setPackages(packageData);

      } else if (itemType === 'medicine') {
        // 상비약: 초기 검색어 설정
        const initialSearch = itemName.includes('공진단') ? '공진단'
          : itemName.includes('경옥고') ? '경옥고'
          : '';
        setMedicineSearch(initialSearch);

        // 사용목적 설정 로드
        try {
          const purposeSettings = await query<{ value: string }>(`
            SELECT value FROM cs_settings WHERE key = 'medicine_purposes'
          `);
          if (purposeSettings.length > 0 && purposeSettings[0].value) {
            const purposes = JSON.parse(purposeSettings[0].value);
            if (Array.isArray(purposes) && purposes.length > 0) {
              setPurposeOptions(purposes);
            }
          }
        } catch {
          // 설정이 없으면 기본값 사용
        }

        // 비급여 항목명에 따른 기본 사용목적 설정 (신규 등록 시에만)
        if (!isEditMode) {
          if (itemName.includes('감기약')) {
            setMedicinePurpose('감기약');
          } else if (itemName.includes('치료약')) {
            setMedicinePurpose('치료약');
          } else if (itemName.includes('보완처방')) {
            setMedicinePurpose('보완처방');
          } else if (itemName.includes('증정')) {
            setMedicinePurpose('증정');
          } else {
            setMedicinePurpose('상비약');
          }
        }

        // 초기 데이터 로드
        const medicineData = await query<MedicineStock>(`
          SELECT id, prescription_id, name, category, current_stock
          FROM cs_medicine_inventory
          WHERE current_stock > 0
          ${initialSearch ? `AND name ILIKE ${escapeString('%' + initialSearch + '%')}` : ''}
          ORDER BY name ASC
          LIMIT 30
        `);
        setMedicineStocks(medicineData);

      } else if (itemType === 'herbal') {
        // 한약 패키지 조회 (MSSQL patient_id 사용)
        const herbalData = await query<HerbalPackage>(`
          SELECT id, package_type, herbal_name, total_count, used_count, remaining_count, status
          FROM cs_herbal_packages
          WHERE patient_id = ${patientId} AND status = 'active' AND remaining_count > 0
          ORDER BY created_at DESC
        `);
        setHerbalPackages(herbalData);
      }
    } catch (err) {
      console.error('데이터 로드 오류:', err);
    } finally {
      setIsLoading(false);
    }
  }, [getOrCreatePatient, itemType, itemName]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 상비약 검색
  const searchMedicines = useCallback(async (searchTerm: string) => {
    try {
      const medicineData = await query<MedicineStock>(`
        SELECT id, prescription_id, name, category, current_stock
        FROM cs_medicine_inventory
        WHERE current_stock > 0
        ${searchTerm.trim() ? `AND name ILIKE ${escapeString('%' + searchTerm.trim() + '%')}` : ''}
        ORDER BY name ASC
        LIMIT 30
      `);
      setMedicineStocks(medicineData);
      setSelectedMedicine(null);
    } catch (err) {
      console.error('상비약 검색 오류:', err);
    }
  }, []);

  // 검색어 변경 시 디바운스 처리
  useEffect(() => {
    if (itemType !== 'medicine') return;

    const timer = setTimeout(() => {
      searchMedicines(medicineSearch);
    }, 300);

    return () => clearTimeout(timer);
  }, [medicineSearch, itemType, searchMedicines]);

  // 약침 일회성 저장
  const handleYakchimOnetime = async () => {
    if (selectedYakchims.length === 0) {
      alert('약침 종류를 선택해주세요.');
      return;
    }
    // 갯수가 0인 항목이 있는지 확인
    const invalidItem = selectedYakchims.find(y => y.qty <= 0);
    if (invalidItem) {
      alert(`${invalidItem.typeName}의 갯수를 1개 이상 입력해주세요.`);
      return;
    }

    setIsSaving(true);
    try {
      // 선택된 모든 약침 정보를 문자열로 만들기
      const yakchimInfoParts = selectedYakchims.map(y => `${y.typeName} ${y.qty}개`);
      const yakchimInfo = yakchimInfoParts.join(', ');
      const totalQty = selectedYakchims.reduce((sum, y) => sum + y.qty, 0);

      console.log('약침 일회성 저장 시작:', {
        patientId,
        chartNumber,
        patientName,
        receiptId,
        receiptDate,
        itemName,
        selectedYakchims,
      });

      // 약침 사용 기록 테이블에 저장 (일반 메모 덮어쓰지 않음)
      const result = await createYakchimUsageRecord({
        patient_id: patientId,
        source_type: 'one-time',
        source_id: 0,
        source_name: yakchimInfo,  // 약침 종류와 갯수 저장
        usage_date: receiptDate,
        item_name: selectedYakchims.map(y => y.typeName).join(', '),  // 약침 종류들
        remaining_after: 0,
        receipt_id: receiptId,
        mssql_detail_id: detailId,
        memo: `${itemName} - ${yakchimInfo}`,
        quantity: totalQty,  // 총 갯수
      });

      console.log('약침 일회성 저장 완료, 결과:', result);

      onSuccess();
      onClose();
    } catch (err) {
      console.error('일회성 저장 오류:', err);
      alert('저장에 실패했습니다: ' + (err as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  // 약침 패키지 차감
  const handleYakchimPackage = async (pkg: Package) => {
    if (selectedYakchims.length === 0) {
      alert('약침 종류를 선택해주세요.');
      return;
    }

    // 총 차감 포인트 계산: Σ(deductionCount × qty)
    const totalDeductPoints = selectedYakchims.reduce(
      (sum, y) => sum + (y.deductionCount * y.qty), 0
    );

    if (pkg.remaining_count < totalDeductPoints) {
      alert(`잔여 횟수(${pkg.remaining_count})가 총 차감 포인트(${totalDeductPoints}p)보다 적습니다.`);
      return;
    }

    setIsSaving(true);
    try {
      const newRemaining = pkg.remaining_count - totalDeductPoints;
      const newUsed = pkg.used_count + totalDeductPoints;
      const newStatus = newRemaining <= 0 ? 'completed' : 'active';

      // 패키지 차감
      await execute(`
        UPDATE cs_treatment_packages
        SET remaining_count = ${newRemaining},
            used_count = ${newUsed},
            status = ${escapeString(newStatus)},
            updated_at = NOW()
        WHERE id = ${pkg.id}
      `);

      // 사용 기록 추가 (MSSQL patient_id 사용 - 다른 메모 테이블과 일관성)
      const yakchimInfoParts = selectedYakchims.map(y => `${y.typeName} ${y.qty}개`);
      const yakchimInfo = yakchimInfoParts.join(', ');
      const totalQty = selectedYakchims.reduce((sum, y) => sum + y.qty, 0);
      const itemNames = selectedYakchims.map(y => y.typeName).join(', ');

      await execute(`
        INSERT INTO cs_yakchim_usage_records
        (patient_id, source_type, source_id, source_name, usage_date, item_name, remaining_after, receipt_id, mssql_detail_id, memo, quantity)
        VALUES (
          ${patientId},
          'package',
          ${pkg.id},
          ${escapeString(pkg.package_name)},
          ${escapeString(receiptDate)},
          ${escapeString(itemNames || itemName)},
          ${newRemaining},
          ${receiptId},
          ${detailId || 'NULL'},
          ${escapeString(`${itemName} - ${yakchimInfo} (총 ${totalDeductPoints}p 차감)`)},
          ${totalQty}
        )
      `);

      onSuccess();
      onClose();
    } catch (err) {
      console.error('패키지 차감 오류:', err);
      alert('차감에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  // 약침 멤버십 사용
  const handleYakchimMembership = async (mem: Membership) => {
    setIsSaving(true);
    try {
      // 사용 기록 추가 (차감 없음) - MSSQL patient_id 사용
      await execute(`
        INSERT INTO cs_yakchim_usage_records
        (patient_id, source_type, source_id, source_name, usage_date, item_name, remaining_after, receipt_id, mssql_detail_id)
        VALUES (
          ${patientId},
          'membership',
          ${mem.id},
          ${escapeString(mem.membership_type)},
          ${escapeString(receiptDate)},
          ${escapeString(itemName)},
          ${mem.quantity},
          ${receiptId},
          ${detailId || 'NULL'}
        )
      `);

      onSuccess();
      onClose();
    } catch (err) {
      console.error('멤버십 사용 오류:', err);
      alert('저장에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  // 상비약 차감
  const handleMedicineDeduct = async () => {
    if (!selectedMedicine) {
      alert('약품을 선택해주세요.');
      return;
    }
    if (medicineQty <= 0 || medicineQty > selectedMedicine.current_stock) {
      alert('올바른 수량을 입력해주세요.');
      return;
    }

    setIsSaving(true);
    try {
      // 재고 차감
      await execute(`
        UPDATE cs_medicine_inventory
        SET current_stock = current_stock - ${medicineQty},
            updated_at = NOW()
        WHERE id = ${selectedMedicine.id}
      `);

      // 사용 기록 추가
      await insert(`
        INSERT INTO cs_medicine_usage
        (patient_id, chart_number, patient_name, inventory_id, medicine_name, quantity, usage_date, receipt_id, mssql_detail_id, purpose, created_at)
        VALUES (
          ${patientId},
          ${escapeString(chartNumber)},
          ${escapeString(patientName)},
          ${selectedMedicine.id},
          ${escapeString(selectedMedicine.name)},
          ${medicineQty},
          ${escapeString(receiptDate)},
          ${receiptId},
          ${detailId || 'NULL'},
          ${escapeString(medicinePurpose)},
          NOW()
        )
      `);

      onSuccess();
      onClose();
    } catch (err) {
      console.error('상비약 차감 오류:', err);
      alert('차감에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  // 상비약 수정
  const handleMedicineUpdate = async () => {
    if (!editData?.id) return;
    if (!selectedMedicine && !editData.medicine_name) {
      alert('약품을 선택해주세요.');
      return;
    }
    if (medicineQty <= 0) {
      alert('올바른 수량을 입력해주세요.');
      return;
    }

    setIsSaving(true);
    try {
      // api.ts의 updateMedicineUsage가 재고 조정을 처리함
      // newInventoryId: 약품 변경 시 새 약품 ID (api.ts에서 재고 복원/차감 처리)
      // quantity: 수량 변경 시 차이만큼 재고 조정 (api.ts에서 처리)
      await updateMedicineUsage(editData.id, {
        medicine_name: selectedMedicine?.name || editData.medicine_name,
        quantity: medicineQty,
        purpose: medicinePurpose,
        newInventoryId: selectedMedicine?.id,  // 약품 변경 시에만 설정
      });

      onSuccess();
      onClose();
    } catch (err) {
      console.error('상비약 수정 오류:', err);
      alert('수정에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  // 상비약 삭제
  const handleMedicineDelete = async () => {
    if (!editData?.id) return;
    if (!confirm('이 상비약 사용 기록을 삭제하시겠습니까?')) return;

    setIsDeleting(true);
    try {
      // api.ts의 deleteMedicineUsage가 재고 복원을 처리함
      await deleteMedicineUsage(editData.id);
      onSuccess();
      onClose();
    } catch (err) {
      console.error('상비약 삭제 오류:', err);
      alert('삭제에 실패했습니다.');
    } finally {
      setIsDeleting(false);
    }
  };

  // 약침 사용 기록 삭제 (패키지인 경우 잔여 수량 복원)
  // 약침 사용 기록 수정
  const handleYakchimUpdate = async () => {
    if (!yakchimEditData?.id) return;

    setIsSaving(true);
    try {
      const success = await updateYakchimUsageRecord(yakchimEditData.id, {
        item_name: editYakchimItemName,
        quantity: editYakchimQty,
        memo: editYakchimMemo,
      });

      if (success) {
        onSuccess();
        onClose();
      } else {
        alert('수정에 실패했습니다.');
      }
    } catch (err) {
      console.error('약침 수정 오류:', err);
      alert('수정에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleYakchimDelete = async () => {
    if (!yakchimEditData?.id) return;
    if (!confirm('이 약침 사용 기록을 삭제하시겠습니까?\n패키지/멤버십 사용의 경우 사용 내역이 취소됩니다.')) return;

    setIsDeleting(true);
    try {
      // 패키지인 경우 잔여 수량 복원
      if (yakchimEditData.source_type === 'package' && yakchimEditData.source_id) {
        await execute(`
          UPDATE cs_treatment_packages
          SET used_count = used_count - 1,
              remaining_count = remaining_count + 1,
              status = CASE WHEN remaining_count + 1 > 0 THEN 'active' ELSE status END,
              updated_at = NOW()
          WHERE id = ${yakchimEditData.source_id}
        `);
      }

      // 사용 기록 삭제
      await execute(`DELETE FROM cs_yakchim_usage_records WHERE id = ${yakchimEditData.id}`);

      onSuccess();
      onClose();
    } catch (err) {
      console.error('약침 삭제 오류:', err);
      alert('삭제에 실패했습니다.');
    } finally {
      setIsDeleting(false);
    }
  };

  // 패키지 등록
  const handlePackageRegister = async () => {
    // 포인트 패키지가 아닐 때만 패키지 종류 필수 체크
    if (!isPointPackage && !selectedPackageType) {
      alert('패키지 종류를 선택해주세요.');
      return;
    }
    if (packageCount <= 0) {
      alert('올바른 횟수를 입력해주세요.');
      return;
    }

    // 포인트 패키지면 비급여 항목명을 그대로 사용, 아니면 선택된 패키지 종류 사용
    const packageName = isPointPackage ? itemName : selectedPackageType;

    setIsSaving(true);
    try {
      await createTreatmentPackage({
        patient_id: patientId,  // MSSQL patient_id 사용 (다른 메모 테이블과 일관성)
        chart_number: chartNumber,
        patient_name: patientName,
        package_name: packageName,
        total_count: packageCount,
        used_count: 0,
        remaining_count: packageCount,
        includes: undefined,
        start_date: receiptDate,
        expire_date: undefined,
        memo: packageMemo || undefined,
        mssql_detail_id: detailId,  // 비급여 항목 연결
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
      // 만료일 계산 (시작일 + N개월 - 1일)
      const startDate = new Date(receiptDate);
      const expireDate = new Date(startDate);
      expireDate.setMonth(expireDate.getMonth() + membershipPeriod);
      expireDate.setDate(expireDate.getDate() - 1);
      const expireDateStr = expireDate.toISOString().split('T')[0];

      await createMembership({
        patient_id: patientId,  // MSSQL patient_id 사용
        chart_number: chartNumber,
        patient_name: patientName,
        membership_type: membershipType,
        quantity: 1,  // 하루 1회 사용 제한
        start_date: receiptDate,
        expire_date: expireDateStr,
        memo: membershipMemo || undefined,
        mssql_detail_id: detailId,  // 비급여 항목 연결
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

  // 만료일 계산 헬퍼
  const calculateExpireDate = (startDate: string, months: number): string => {
    const start = new Date(startDate);
    const expire = new Date(start);
    expire.setMonth(expire.getMonth() + months);
    expire.setDate(expire.getDate() - 1);
    return expire.toISOString().split('T')[0];
  };

  // 패키지 수정 (총 횟수 변경)
  const handlePackageUpdate = async () => {
    if (!packageEditData?.id) return;
    if (editPackageCount <= 0) {
      alert('올바른 횟수를 입력해주세요.');
      return;
    }
    // 이미 사용한 횟수보다 적게 설정 불가
    if (editPackageCount < packageEditData.used_count) {
      alert(`이미 ${packageEditData.used_count}회 사용했습니다. ${packageEditData.used_count}회 이상으로 설정해주세요.`);
      return;
    }

    setIsSaving(true);
    try {
      const newRemaining = editPackageCount - packageEditData.used_count;
      const newStatus = newRemaining <= 0 ? 'completed' : 'active';

      await updateTreatmentPackage(packageEditData.id, {
        total_count: editPackageCount,
        remaining_count: newRemaining,
        status: newStatus,
      });

      onSuccess();
      onClose();
    } catch (err) {
      console.error('패키지 수정 오류:', err);
      alert('수정에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  // 패키지 삭제
  const handlePackageDelete = async () => {
    if (!packageEditData?.id) return;
    if (!confirm('이 패키지를 삭제하시겠습니까?\n사용 기록이 있는 경우 복원되지 않습니다.')) return;

    setIsDeleting(true);
    try {
      await deleteTreatmentPackage(packageEditData.id);
      onSuccess();
      onClose();
    } catch (err) {
      console.error('패키지 삭제 오류:', err);
      alert('삭제에 실패했습니다.');
    } finally {
      setIsDeleting(false);
    }
  };

  // 멤버십 수정
  const handleMembershipUpdate = async () => {
    if (!membershipEditData?.id) return;

    setIsSaving(true);
    try {
      await updateMembership(membershipEditData.id, {
        memo: editMembershipMemo || undefined,
      });
      onSuccess();
      onClose();
    } catch (err) {
      console.error('멤버십 수정 오류:', err);
      alert('수정에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  // 멤버십 삭제
  const handleMembershipDelete = async () => {
    if (!membershipEditData?.id) return;
    if (!confirm('이 멤버십을 삭제하시겠습니까?\n삭제된 멤버십은 복구할 수 없습니다.')) return;

    setIsDeleting(true);
    try {
      await deleteMembership(membershipEditData.id);
      onSuccess();
      onClose();
    } catch (err) {
      console.error('멤버십 삭제 오류:', err);
      alert('삭제에 실패했습니다.');
    } finally {
      setIsDeleting(false);
    }
  };

  // 한약 처리
  const handleHerbalProcess = async () => {
    if (!selectedHerbal) {
      alert('한약 패키지를 선택해주세요.');
      return;
    }
    if (herbalQty <= 0 || herbalQty > selectedHerbal.remaining_count) {
      alert('올바른 수량을 입력해주세요.');
      return;
    }

    setIsSaving(true);
    try {
      const newRemaining = selectedHerbal.remaining_count - herbalQty;
      const newUsed = selectedHerbal.used_count + herbalQty;
      const newStatus = newRemaining <= 0 ? 'completed' : 'active';

      // 패키지 업데이트
      await execute(`
        UPDATE cs_herbal_packages
        SET used_count = ${newUsed},
            remaining_count = ${newRemaining},
            status = ${escapeString(newStatus)},
            updated_at = NOW()
        WHERE id = ${selectedHerbal.id}
      `);

      // 처리 기록 추가 (MSSQL patient_id 사용 - 다른 메모 테이블과 일관성)
      await insert(`
        INSERT INTO cs_herbal_dispensings
        (patient_id, chart_number, patient_name, package_id, package_name, packs, dispensing_type, dispensing_date, receipt_id, mssql_detail_id, created_at)
        VALUES (
          ${patientId},
          ${escapeString(chartNumber)},
          ${escapeString(patientName)},
          ${selectedHerbal.id},
          ${escapeString(selectedHerbal.package_type)},
          ${herbalQty},
          ${escapeString(herbalAction)},
          ${escapeString(receiptDate)},
          ${receiptId},
          ${detailId || 'NULL'},
          NOW()
        )
      `);

      onSuccess();
      onClose();
    } catch (err) {
      console.error('한약 처리 오류:', err);
      alert('처리에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  // 일반 메모 저장
  const handleGeneralMemo = async () => {
    if (!generalMemo.trim()) {
      alert('메모를 입력해주세요.');
      return;
    }

    setIsSaving(true);
    try {
      await addReceiptMemo({
        patient_id: patientId,
        chart_number: chartNumber,
        patient_name: patientName,
        mssql_receipt_id: receiptId,
        receipt_date: receiptDate,
        memo: itemName === '일반메모' ? generalMemo : `${itemName}: ${generalMemo}`,
      });

      onSuccess();
      onClose();
    } catch (err) {
      console.error('메모 저장 오류:', err);
      alert('저장에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="memo-input-panel loading">
        <i className="fa-solid fa-spinner fa-spin"></i> 로딩 중...
      </div>
    );
  }

  return (
    <div className="memo-input-panel">
      <div className="memo-input-header">
        <span className="memo-input-title">
          <i className="fa-solid fa-edit"></i> {itemName}
          {amount > 0 && <span className="memo-input-amount">({amount.toLocaleString()}원)</span>}
        </span>
        <button className="memo-input-close" onClick={onClose}>
          <i className="fa-solid fa-times"></i>
        </button>
      </div>

      <div className="memo-input-body">
        {/* 약침 수정 */}
        {itemType === 'yakchim' && isYakchimEditMode && yakchimEditData && (
          <div className="yakchim-edit-section">
            <div className="yakchim-edit-info">
              <div className="info-row">
                <span className="label">유형:</span>
                <span className="value">
                  {yakchimEditData.source_type === 'membership' ? '멤버십' :
                   yakchimEditData.source_type === 'package' ? '패키지' : '일회성'}
                </span>
              </div>
              <div className="info-row">
                <span className="label">출처:</span>
                <span className="value">{yakchimEditData.source_name || '-'}</span>
              </div>
              <div className="info-row">
                <span className="label">사용일:</span>
                <span className="value">{yakchimEditData.usage_date}</span>
              </div>
              {yakchimEditData.source_type === 'package' && (
                <div className="info-row">
                  <span className="label">사용 후 잔여:</span>
                  <span className="value">{yakchimEditData.remaining_after}회</span>
                </div>
              )}
            </div>

            {/* 수정 폼 */}
            <div className="yakchim-edit-form">
              <div className="form-row">
                <label>항목:</label>
                <input
                  type="text"
                  value={editYakchimItemName}
                  onChange={(e) => setEditYakchimItemName(e.target.value)}
                  placeholder="약침 종류"
                />
              </div>
              <div className="form-row">
                <label>갯수:</label>
                <div className="qty-input-wrap">
                  <button
                    type="button"
                    className="qty-btn"
                    onClick={() => setEditYakchimQty(Math.max(1, editYakchimQty - 1))}
                  >
                    -
                  </button>
                  <input
                    type="number"
                    value={editYakchimQty}
                    onChange={(e) => setEditYakchimQty(Math.max(1, parseInt(e.target.value) || 1))}
                    min={1}
                    className="qty-input"
                  />
                  <button
                    type="button"
                    className="qty-btn"
                    onClick={() => setEditYakchimQty(editYakchimQty + 1)}
                  >
                    +
                  </button>
                  <span className="qty-unit">개</span>
                </div>
              </div>
              <div className="form-row">
                <label>메모:</label>
                <input
                  type="text"
                  value={editYakchimMemo}
                  onChange={(e) => setEditYakchimMemo(e.target.value)}
                  placeholder="메모 (선택)"
                />
              </div>
            </div>

            <div className="yakchim-edit-actions">
              <button
                className="btn-update"
                onClick={handleYakchimUpdate}
                disabled={isSaving || isDeleting}
              >
                {isSaving ? '저장 중...' : '수정 저장'}
              </button>
              <button
                className="btn-delete"
                onClick={handleYakchimDelete}
                disabled={isSaving || isDeleting}
              >
                {isDeleting ? '삭제 중...' : '사용 취소'}
              </button>
            </div>
          </div>
        )}

        {/* 패키지 등록 */}
        {itemType === 'package-register' && (
          <div className="package-register-section">
            <div className="register-info">
              <div className="info-label">결제금액</div>
              <div className="info-value">{(amount || 0).toLocaleString()}원</div>
            </div>

            <div className="register-form">
              {/* 포인트 패키지가 아닐 때만 패키지 종류 선택 표시 */}
              {!isPointPackage && (
                <div className="form-row">
                  <label>패키지 종류</label>
                  <div className="package-type-buttons">
                    {packageTypeOptions.map((type) => (
                      <button
                        key={type.id}
                        type="button"
                        className={`type-btn ${selectedPackageType === type.name ? 'active' : ''}`}
                        onClick={() => setSelectedPackageType(type.name)}
                      >
                        {type.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="form-row">
                <label>횟수</label>
                <div className="count-input-wrap">
                  <button
                    type="button"
                    className="count-btn"
                    onClick={() => setPackageCount(Math.max(1, packageCount - 1))}
                  >
                    -
                  </button>
                  <input
                    type="number"
                    className="count-input"
                    value={packageCount}
                    onChange={(e) => setPackageCount(Math.max(1, parseInt(e.target.value) || 1))}
                    min={1}
                  />
                  <button
                    type="button"
                    className="count-btn"
                    onClick={() => setPackageCount(packageCount + 1)}
                  >
                    +
                  </button>
                  <span className="count-unit">회</span>
                </div>
              </div>

              <div className="form-row">
                <label>메모 (선택)</label>
                <input
                  type="text"
                  className="memo-input"
                  value={packageMemo}
                  onChange={(e) => setPackageMemo(e.target.value)}
                  placeholder="메모를 입력하세요"
                />
              </div>
            </div>

            <div className="register-action">
              <button
                className="btn-register"
                onClick={handlePackageRegister}
                disabled={isSaving || packageCount <= 0 || (!isPointPackage && !selectedPackageType)}
              >
                {isSaving ? '등록 중...' : `${isPointPackage ? itemName : (selectedPackageType || '패키지')} 등록`}
              </button>
            </div>
          </div>
        )}

        {/* 멤버십 등록 */}
        {itemType === 'membership-register' && (
          <div className="membership-register-section">
            <div className="register-info">
              <div className="info-label">결제금액</div>
              <div className="info-value">{(amount || 0).toLocaleString()}원</div>
            </div>

            <div className="register-form">
              <div className="form-row">
                <label>멤버십 종류</label>
                <div className="membership-type-buttons">
                  {membershipTypeOptions.map((type) => (
                    <button
                      key={type}
                      type="button"
                      className={`type-btn ${membershipType === type ? 'active' : ''}`}
                      onClick={() => setMembershipType(type)}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-row">
                <label>기간</label>
                <div className="period-buttons">
                  {periodOptions.map((opt) => (
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

              <div className="form-row">
                <label>시작일</label>
                <div className="date-display">{receiptDate}</div>
              </div>

              <div className="form-row">
                <label>만료일</label>
                <div className="date-display expire">{calculateExpireDate(receiptDate, membershipPeriod)}</div>
              </div>

              <div className="form-row">
                <label>메모 (선택)</label>
                <input
                  type="text"
                  className="memo-input"
                  value={membershipMemo}
                  onChange={(e) => setMembershipMemo(e.target.value)}
                  placeholder="메모를 입력하세요"
                />
              </div>
            </div>

            <div className="register-action">
              <button
                className="btn-register membership"
                onClick={handleMembershipRegister}
                disabled={isSaving || !membershipType}
              >
                {isSaving ? '등록 중...' : `${membershipType || '멤버십'} 등록`}
              </button>
            </div>
          </div>
        )}

        {/* 멤버십 수정 */}
        {itemType === 'membership-edit' && isMembershipEditMode && membershipEditData && (
          <div className="membership-edit-section">
            <div className="membership-edit-info">
              <div className="info-row">
                <span className="label">멤버십:</span>
                <span className="value">{membershipEditData.membership_type}</span>
              </div>
              <div className="info-row">
                <span className="label">시작일:</span>
                <span className="value">{membershipEditData.start_date}</span>
              </div>
              <div className="info-row">
                <span className="label">만료일:</span>
                <span className="value expire">{membershipEditData.expire_date}</span>
              </div>
              <div className="info-row">
                <span className="label">상태:</span>
                <span className={`value status-${membershipEditData.status}`}>
                  {membershipEditData.status === 'active' ? '활성' : '만료'}
                </span>
              </div>
            </div>

            {/* 수정 폼 */}
            <div className="membership-edit-form">
              <div className="form-row">
                <label>메모:</label>
                <input
                  type="text"
                  value={editMembershipMemo}
                  onChange={(e) => setEditMembershipMemo(e.target.value)}
                  placeholder="메모 (선택)"
                />
              </div>
            </div>

            <div className="membership-edit-actions">
              <button
                className="btn-update"
                onClick={handleMembershipUpdate}
                disabled={isSaving || isDeleting}
              >
                {isSaving ? '저장 중...' : '수정 저장'}
              </button>
              <button
                className="btn-delete"
                onClick={handleMembershipDelete}
                disabled={isSaving || isDeleting}
              >
                {isDeleting ? '삭제 중...' : '멤버십 삭제'}
              </button>
            </div>
          </div>
        )}

        {/* 패키지 수정 */}
        {itemType === 'package-edit' && isPackageEditMode && packageEditData && (
          <div className="package-edit-section">
            <div className="package-edit-info">
              <div className="info-row">
                <span className="label">패키지명:</span>
                <span className="value">{packageEditData.package_name}</span>
              </div>
              <div className="info-row editable">
                <span className="label">총 횟수:</span>
                <div className="count-edit-wrap">
                  <button
                    type="button"
                    className="count-btn"
                    onClick={() => setEditPackageCount(Math.max(packageEditData.used_count, editPackageCount - 1))}
                    disabled={editPackageCount <= packageEditData.used_count}
                  >
                    -
                  </button>
                  <input
                    type="number"
                    className="count-input"
                    value={editPackageCount}
                    onChange={(e) => setEditPackageCount(Math.max(packageEditData.used_count, parseInt(e.target.value) || packageEditData.used_count))}
                    min={packageEditData.used_count}
                  />
                  <button
                    type="button"
                    className="count-btn"
                    onClick={() => setEditPackageCount(editPackageCount + 1)}
                  >
                    +
                  </button>
                  <span className="count-unit">회</span>
                </div>
              </div>
              <div className="info-row">
                <span className="label">사용:</span>
                <span className="value">{packageEditData.used_count}회</span>
              </div>
              <div className="info-row">
                <span className="label">잔여:</span>
                <span className="value highlight">
                  {editPackageCount - packageEditData.used_count}회
                  {editPackageCount !== packageEditData.total_count && (
                    <span className="change-indicator">
                      ({packageEditData.remaining_count} → {editPackageCount - packageEditData.used_count})
                    </span>
                  )}
                </span>
              </div>
              <div className="info-row">
                <span className="label">시작일:</span>
                <span className="value">{packageEditData.start_date}</span>
              </div>
              {packageEditData.memo && (
                <div className="info-row">
                  <span className="label">메모:</span>
                  <span className="value">{packageEditData.memo}</span>
                </div>
              )}
              <div className="info-row">
                <span className="label">상태:</span>
                <span className={`value status-${packageEditData.status}`}>
                  {packageEditData.status === 'active' ? '진행중' :
                   packageEditData.status === 'completed' ? '완료' : '만료'}
                </span>
              </div>
            </div>
            <div className="package-edit-actions">
              {editPackageCount !== packageEditData.total_count && (
                <button
                  className="btn-update"
                  onClick={handlePackageUpdate}
                  disabled={isSaving || isDeleting}
                >
                  {isSaving ? '저장 중...' : '횟수 변경 저장'}
                </button>
              )}
              <button
                className="btn-delete"
                onClick={handlePackageDelete}
                disabled={isSaving || isDeleting}
              >
                {isDeleting ? '삭제 중...' : '패키지 삭제'}
              </button>
            </div>
          </div>
        )}

        {/* 약침 입력 */}
        {itemType === 'yakchim' && !isYakchimEditMode && (
          <>
            {/* 약침/요법 종류 선택 (다중 선택) */}
            <div className="yakchim-type-selector">
              <label>{itemName.includes('요법') ? '요법 종류 (다중 선택 가능)' : '약침 종류 (다중 선택 가능)'}</label>
              {yakchimTypeOptions.length === 0 ? (
                <p className="empty-hint">설정에서 {itemName.includes('요법') ? '요법' : '약침'} 종류를 먼저 등록해주세요.</p>
              ) : (
                <div className="yakchim-type-buttons">
                  {yakchimTypeOptions.map((type) => {
                    const isSelected = selectedYakchims.some(y => y.typeId === type.id);
                    return (
                      <button
                        key={type.id}
                        type="button"
                        className={`type-btn ${isSelected ? 'active' : ''}`}
                        onClick={() => {
                          if (isSelected) {
                            // 선택 해제
                            setSelectedYakchims(prev => prev.filter(y => y.typeId !== type.id));
                          } else {
                            // 선택 추가
                            setSelectedYakchims(prev => [...prev, {
                              typeId: type.id,
                              typeName: type.name,
                              deductionCount: type.deduction_count || 1,
                              qty: 1
                            }]);
                          }
                        }}
                        title={`${type.deduction_count || 1}p 차감`}
                      >
                        {type.name}
                        <span className="deduct-badge">{type.deduction_count || 1}p</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 선택된 약침 목록 및 갯수 입력 */}
            {selectedYakchims.length > 0 && (
              <div className="selected-yakchims">
                <label>선택된 항목</label>
                <div className="selected-list">
                  {selectedYakchims.map((item) => (
                    <div key={item.typeId} className="selected-item">
                      <span className="item-name">{item.typeName}</span>
                      <span className="item-point">{item.deductionCount}p</span>
                      <div className="item-qty-wrap">
                        <button
                          type="button"
                          className="qty-btn"
                          onClick={() => {
                            setSelectedYakchims(prev => prev.map(y =>
                              y.typeId === item.typeId
                                ? { ...y, qty: Math.max(1, y.qty - 1) }
                                : y
                            ));
                          }}
                        >
                          -
                        </button>
                        <input
                          type="number"
                          className="qty-input"
                          value={item.qty}
                          onChange={(e) => {
                            const newQty = Math.max(1, parseInt(e.target.value) || 1);
                            setSelectedYakchims(prev => prev.map(y =>
                              y.typeId === item.typeId ? { ...y, qty: newQty } : y
                            ));
                          }}
                          min={1}
                        />
                        <button
                          type="button"
                          className="qty-btn"
                          onClick={() => {
                            setSelectedYakchims(prev => prev.map(y =>
                              y.typeId === item.typeId ? { ...y, qty: y.qty + 1 } : y
                            ));
                          }}
                        >
                          +
                        </button>
                        <span className="qty-unit">개</span>
                      </div>
                      <span className="item-subtotal">= {item.deductionCount * item.qty}p</span>
                      <button
                        type="button"
                        className="btn-remove"
                        onClick={() => setSelectedYakchims(prev => prev.filter(y => y.typeId !== item.typeId))}
                        title="제거"
                      >
                        <i className="fa-solid fa-times"></i>
                      </button>
                    </div>
                  ))}
                </div>
                {/* 합계 표시 */}
                <div className="selected-total">
                  <span className="total-label">총 차감 포인트:</span>
                  <span className="total-value">
                    {selectedYakchims.reduce((sum, y) => sum + (y.deductionCount * y.qty), 0)}p
                  </span>
                </div>
              </div>
            )}

            <div className="memo-input-tabs">
              <button
                className={`tab-btn ${yakchimTab === 'onetime' ? 'active' : ''}`}
                onClick={() => setYakchimTab('onetime')}
              >
                일회성
              </button>
              <button
                className={`tab-btn ${yakchimTab === 'package' ? 'active' : ''}`}
                onClick={() => setYakchimTab('package')}
              >
                패키지 ({packages.length})
              </button>
              <button
                className={`tab-btn ${yakchimTab === 'membership' ? 'active' : ''}`}
                onClick={() => setYakchimTab('membership')}
              >
                멤버십 ({memberships.length})
              </button>
            </div>

            <div className="memo-input-content">
              {yakchimTab === 'onetime' && (
                <div className="onetime-section">
                  <div className="onetime-summary">
                    {selectedYakchims.length > 0 && (
                      <p className="summary-text">
                        {selectedYakchims.map(y => `${y.typeName} ${y.qty}개`).join(', ')}로 기록합니다.
                      </p>
                    )}
                  </div>

                  <button
                    className="btn-save"
                    onClick={handleYakchimOnetime}
                    disabled={isSaving || selectedYakchims.length === 0}
                  >
                    {isSaving ? '저장 중...' : '일회성 기록'}
                  </button>
                </div>
              )}

              {yakchimTab === 'package' && (
                <div className="package-section">
                  {(() => {
                    const totalDeductPoints = selectedYakchims.reduce(
                      (sum, y) => sum + (y.deductionCount * y.qty), 0
                    );
                    return (
                      <>
                        {selectedYakchims.length > 0 && (
                          <div className="deduction-info">
                            <i className="fa-solid fa-info-circle"></i>
                            패키지에서 총 <strong>{totalDeductPoints}p</strong> 차감됩니다.
                          </div>
                        )}
                        {packages.length === 0 ? (
                          <p className="empty-msg">등록된 패키지가 없습니다.</p>
                        ) : (
                          <div className="package-list">
                            {packages.map(pkg => (
                              <div key={pkg.id} className="package-item">
                                <span className="pkg-name">{pkg.package_name}</span>
                                <span className="pkg-count">{pkg.remaining_count}/{pkg.total_count}회</span>
                                <button
                                  className="btn-deduct"
                                  onClick={() => handleYakchimPackage(pkg)}
                                  disabled={isSaving || selectedYakchims.length === 0 || pkg.remaining_count < totalDeductPoints}
                                  title={selectedYakchims.length === 0 ? '약침 종류를 선택하세요' : ''}
                                >
                                  {totalDeductPoints > 0 ? `${totalDeductPoints}p 차감` : '차감'}
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}

              {yakchimTab === 'membership' && (
                <div className="membership-section">
                  {memberships.length === 0 ? (
                    <p className="empty-msg">등록된 멤버십이 없습니다.</p>
                  ) : (
                    <div className="membership-list">
                      {memberships.map(mem => (
                        <div key={mem.id} className="membership-item">
                          <span className="mem-type">{mem.membership_type}</span>
                          <span className="mem-expire">~{mem.expire_date}</span>
                          <button
                            className="btn-use"
                            onClick={() => handleYakchimMembership(mem)}
                            disabled={isSaving}
                          >
                            사용
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {/* 상비약 입력/수정 */}
        {itemType === 'medicine' && (
          <div className="medicine-section">
            {/* 수정 모드: 현재 선택된 약품 표시 */}
            {isEditMode && editData && (
              <div className="edit-current-info">
                <span className="current-label">현재:</span>
                <span className="current-value">{editData.medicine_name} × {editData.quantity}개</span>
              </div>
            )}

            <div className="medicine-search">
              <i className="fa-solid fa-search"></i>
              <input
                type="text"
                value={medicineSearch}
                onChange={(e) => setMedicineSearch(e.target.value)}
                placeholder={isEditMode ? '다른 약품으로 변경...' : '상비약 검색...'}
                className="search-input"
                autoFocus={!isEditMode}
              />
              {medicineSearch && (
                <button
                  className="search-clear"
                  onClick={() => setMedicineSearch('')}
                >
                  <i className="fa-solid fa-times"></i>
                </button>
              )}
            </div>

            {medicineStocks.length === 0 && medicineSearch ? (
              <p className="empty-msg">검색 결과가 없습니다.</p>
            ) : medicineStocks.length > 0 && (
              <div className="medicine-list">
                {medicineStocks.map(med => (
                  <div
                    key={med.id}
                    className={`medicine-item ${selectedMedicine?.id === med.id ? 'selected' : ''}`}
                    onClick={() => setSelectedMedicine(med)}
                  >
                    <span className="med-name">{med.name}</span>
                    <span className="med-stock">재고: {med.current_stock}</span>
                  </div>
                ))}
              </div>
            )}

            {/* 사용목적 선택 */}
            {(selectedMedicine || isEditMode) && (
              <div className="purpose-selector">
                <label>사용목적:</label>
                <div className="purpose-buttons">
                  {purposeOptions.map((purpose) => (
                    <button
                      key={purpose}
                      type="button"
                      className={`purpose-btn ${medicinePurpose === purpose ? 'active' : ''}`}
                      onClick={() => setMedicinePurpose(purpose)}
                    >
                      {purpose}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 수정 모드: 수량 조절 + 수정/삭제 버튼 */}
            {isEditMode && (
              <div className="medicine-action edit-mode">
                <input
                  type="number"
                  value={medicineQty}
                  onChange={(e) => setMedicineQty(Number(e.target.value))}
                  min={1}
                  className="input-qty"
                />
                <span className="qty-unit">개</span>
                <button
                  className="btn-update"
                  onClick={handleMedicineUpdate}
                  disabled={isSaving || isDeleting}
                >
                  {isSaving ? '처리 중...' : '수정'}
                </button>
                <button
                  className="btn-delete"
                  onClick={handleMedicineDelete}
                  disabled={isSaving || isDeleting}
                >
                  {isDeleting ? '삭제 중...' : '삭제'}
                </button>
              </div>
            )}

            {/* 추가 모드: 선택 후 사용 버튼 */}
            {!isEditMode && selectedMedicine && (
              <div className="medicine-action">
                <input
                  type="number"
                  value={medicineQty}
                  onChange={(e) => setMedicineQty(Number(e.target.value))}
                  min={1}
                  max={selectedMedicine.current_stock}
                  className="input-qty"
                />
                <span className="qty-unit">개</span>
                <button
                  className="btn-deduct"
                  onClick={handleMedicineDeduct}
                  disabled={isSaving}
                >
                  {isSaving ? '처리 중...' : '사용'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* 한약 입력 */}
        {itemType === 'herbal' && (
          <div className="herbal-section">
            <div className="herbal-actions">
              <button
                className={`action-btn ${herbalAction === 'dispense' ? 'active' : ''}`}
                onClick={() => setHerbalAction('dispense')}
              >
                발송
              </button>
              <button
                className={`action-btn ${herbalAction === 'pickup' ? 'active' : ''}`}
                onClick={() => setHerbalAction('pickup')}
              >
                수령
              </button>
            </div>

            {herbalPackages.length === 0 ? (
              <p className="empty-msg">등록된 한약 패키지가 없습니다.</p>
            ) : (
              <>
                <div className="herbal-list">
                  {herbalPackages.map(pkg => (
                    <div
                      key={pkg.id}
                      className={`herbal-item ${selectedHerbal?.id === pkg.id ? 'selected' : ''}`}
                      onClick={() => setSelectedHerbal(pkg)}
                    >
                      <span className="herbal-name">{pkg.herbal_name || pkg.package_type}</span>
                      <span className="herbal-count">{pkg.remaining_count}/{pkg.total_count}첩</span>
                    </div>
                  ))}
                </div>
                {selectedHerbal && (
                  <div className="herbal-action">
                    <input
                      type="number"
                      value={herbalQty}
                      onChange={(e) => setHerbalQty(Number(e.target.value))}
                      min={1}
                      max={selectedHerbal.remaining_count}
                      className="input-qty"
                    />
                    <span className="qty-unit">첩</span>
                    <button
                      className="btn-process"
                      onClick={handleHerbalProcess}
                      disabled={isSaving}
                    >
                      {isSaving ? '처리 중...' : herbalAction === 'dispense' ? '발송' : '수령'}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* 일반 메모 입력 */}
        {itemType === 'other' && (
          <div className="general-section">
            <textarea
              value={generalMemo}
              onChange={(e) => setGeneralMemo(e.target.value)}
              placeholder="메모를 입력하세요..."
              className="memo-textarea"
              rows={3}
            />
            <button
              className="btn-save"
              onClick={handleGeneralMemo}
              disabled={isSaving || !generalMemo.trim()}
            >
              {isSaving ? '저장 중...' : '메모 저장'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default MemoInputPanel;
