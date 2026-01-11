import React, { useState, useEffect, useCallback } from 'react';
import { query, execute, escapeString, insert, getCurrentDate } from '@shared/lib/postgres';
import { addReceiptMemo, createYakchimUsageRecord } from '../lib/api';

interface MemoInputPanelProps {
  patientId: number;
  patientName: string;
  chartNumber: string;
  receiptId: number;
  receiptDate: string;
  itemName: string;
  itemType: 'yakchim' | 'medicine' | 'herbal' | 'other';
  amount?: number;
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
  onClose,
  onSuccess,
}) => {
  // 공통 상태
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [sqlitePatientId, setSqlitePatientId] = useState<number | null>(null);

  // 약침 상태
  const [yakchimTab, setYakchimTab] = useState<'onetime' | 'package' | 'membership'>('onetime');
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);

  // 상비약 상태
  const [medicineStocks, setMedicineStocks] = useState<MedicineStock[]>([]);
  const [selectedMedicine, setSelectedMedicine] = useState<MedicineStock | null>(null);
  const [medicineQty, setMedicineQty] = useState(1);

  // 한약 상태
  const [herbalPackages, setHerbalPackages] = useState<HerbalPackage[]>([]);
  const [herbalAction, setHerbalAction] = useState<'dispense' | 'pickup'>('dispense');
  const [selectedHerbal, setSelectedHerbal] = useState<HerbalPackage | null>(null);
  const [herbalQty, setHerbalQty] = useState(1);

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
        // 멤버십 조회
        const membershipData = await query<Membership>(`
          SELECT id, membership_type, quantity, expire_date, status
          FROM cs_memberships
          WHERE patient_id = ${pid} AND status = 'active'
          ORDER BY expire_date ASC
        `);
        setMemberships(membershipData);

        // 패키지 조회
        const packageData = await query<Package>(`
          SELECT id, package_name, total_count, used_count, remaining_count, expire_date, status
          FROM cs_treatment_packages
          WHERE patient_id = ${pid} AND status = 'active' AND remaining_count > 0
          ORDER BY created_at DESC
        `);
        setPackages(packageData);

      } else if (itemType === 'medicine') {
        // 상비약 재고 조회 (검색어로 필터링)
        const searchKeyword = itemName.includes('공진단') ? '공진단'
          : itemName.includes('경옥고') ? '경옥고'
          : '';

        const medicineData = await query<MedicineStock>(`
          SELECT id, prescription_id, name, category, current_stock
          FROM cs_medicine_inventory
          WHERE current_stock > 0
          ${searchKeyword ? `AND name ILIKE ${escapeString('%' + searchKeyword + '%')}` : ''}
          ORDER BY name ASC
          LIMIT 20
        `);
        setMedicineStocks(medicineData);

      } else if (itemType === 'herbal') {
        // 한약 패키지 조회
        const herbalData = await query<HerbalPackage>(`
          SELECT id, package_type, herbal_name, total_count, used_count, remaining_count, status
          FROM cs_herbal_packages
          WHERE patient_id = ${pid} AND status = 'active' AND remaining_count > 0
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

  // 약침 일회성 저장
  const handleYakchimOnetime = async () => {
    setIsSaving(true);
    try {
      console.log('약침 일회성 저장 시작:', {
        patientId,
        chartNumber,
        patientName,
        receiptId,
        receiptDate,
        itemName,
      });

      // 약침 사용 기록 테이블에 저장 (일반 메모 덮어쓰지 않음)
      const result = await createYakchimUsageRecord({
        patient_id: patientId,
        source_type: 'one-time',
        source_id: 0,
        source_name: '일회성',
        usage_date: receiptDate,
        item_name: itemName,
        remaining_after: 0,
        receipt_id: receiptId,
        memo: `${itemName} 일회성`,
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
    if (pkg.remaining_count <= 0) {
      alert('잔여 횟수가 없습니다.');
      return;
    }

    setIsSaving(true);
    try {
      const newRemaining = pkg.remaining_count - 1;
      const newUsed = pkg.used_count + 1;
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

      // 사용 기록 추가
      await execute(`
        INSERT INTO cs_yakchim_usage_records
        (patient_id, source_type, source_id, source_name, usage_date, item_name, remaining_after, receipt_id)
        VALUES (
          ${sqlitePatientId},
          'package',
          ${pkg.id},
          ${escapeString(pkg.package_name)},
          ${escapeString(receiptDate)},
          ${escapeString(itemName)},
          ${newRemaining},
          ${receiptId}
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
      // 사용 기록 추가 (차감 없음)
      await execute(`
        INSERT INTO cs_yakchim_usage_records
        (patient_id, source_type, source_id, source_name, usage_date, item_name, remaining_after, receipt_id)
        VALUES (
          ${sqlitePatientId},
          'membership',
          ${mem.id},
          ${escapeString(mem.membership_type)},
          ${escapeString(receiptDate)},
          ${escapeString(itemName)},
          ${mem.quantity},
          ${receiptId}
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
        INSERT INTO cs_medicine_usages
        (patient_id, chart_number, patient_name, inventory_id, medicine_name, quantity, usage_date, receipt_id, created_at)
        VALUES (
          ${sqlitePatientId},
          ${escapeString(chartNumber)},
          ${escapeString(patientName)},
          ${selectedMedicine.id},
          ${escapeString(selectedMedicine.name)},
          ${medicineQty},
          ${escapeString(receiptDate)},
          ${receiptId},
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

      // 처리 기록 추가
      await insert(`
        INSERT INTO cs_herbal_dispensings
        (patient_id, chart_number, patient_name, package_id, package_name, packs, dispensing_type, dispensing_date, receipt_id, created_at)
        VALUES (
          ${sqlitePatientId},
          ${escapeString(chartNumber)},
          ${escapeString(patientName)},
          ${selectedHerbal.id},
          ${escapeString(selectedHerbal.package_type)},
          ${herbalQty},
          ${escapeString(herbalAction)},
          ${escapeString(receiptDate)},
          ${receiptId},
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
        {/* 약침 입력 */}
        {itemType === 'yakchim' && (
          <>
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
                  <p className="onetime-desc">"{itemName} 일회성"으로 메모에 기록합니다.</p>
                  <button
                    className="btn-save"
                    onClick={handleYakchimOnetime}
                    disabled={isSaving}
                  >
                    {isSaving ? '저장 중...' : '일회성 기록'}
                  </button>
                </div>
              )}

              {yakchimTab === 'package' && (
                <div className="package-section">
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
                            disabled={isSaving}
                          >
                            차감
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
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

        {/* 상비약 입력 */}
        {itemType === 'medicine' && (
          <div className="medicine-section">
            {medicineStocks.length === 0 ? (
              <p className="empty-msg">해당하는 재고가 없습니다.</p>
            ) : (
              <>
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
                {selectedMedicine && (
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
                      {isSaving ? '처리 중...' : '차감'}
                    </button>
                  </div>
                )}
              </>
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
