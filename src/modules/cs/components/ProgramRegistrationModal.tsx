import { useState, useEffect, useCallback } from 'react';
import { useEscapeKey } from '@shared/hooks/useEscapeKey';
import { query, insert, escapeString } from '@shared/lib/sqlite';
import { ConsultationPatient } from './CSSidebar';

// 타입 정의
interface ProgramCategory {
  id: number;
  name: string;
  icon: string;
  default_unit_name: string;
}

interface ProgramGrade {
  id: number;
  category_id: number;
  name: string;
  description: string;
  price_modifier: number;
}

interface ProgramAddon {
  id: number;
  category_id: number | null;
  name: string;
  price: number;
}

interface ProgramRegistrationModalProps {
  patient: ConsultationPatient;
  onClose: () => void;
  onSuccess?: () => void;
}

function ProgramRegistrationModal({ patient, onClose, onSuccess }: ProgramRegistrationModalProps) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // 프리셋 데이터
  const [categories, setCategories] = useState<ProgramCategory[]>([]);
  const [allGrades, setAllGrades] = useState<ProgramGrade[]>([]);
  const [allAddons, setAllAddons] = useState<ProgramAddon[]>([]);

  // 선택된 값들
  const [selectedCategory, setSelectedCategory] = useState<ProgramCategory | null>(null);
  const [unitCount, setUnitCount] = useState(1);
  const [selectedGrade, setSelectedGrade] = useState<ProgramGrade | null>(null);
  const [selectedAddons, setSelectedAddons] = useState<ProgramAddon[]>([]);
  const [memo, setMemo] = useState('');

  // ESC 키로 모달 닫기
  useEscapeKey(onClose);

  // 필터된 등급/추가옵션
  const filteredGrades = selectedCategory
    ? allGrades.filter(g => g.category_id === selectedCategory.id)
    : [];
  const filteredAddons = selectedCategory
    ? allAddons.filter(a => a.category_id === selectedCategory.id || a.category_id === null)
    : [];

  // 데이터 로드
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [cats, grds, adds] = await Promise.all([
        query<ProgramCategory>('SELECT * FROM treatment_program_categories WHERE is_active = 1 ORDER BY sort_order'),
        query<ProgramGrade>('SELECT * FROM treatment_program_grades WHERE is_active = 1 ORDER BY category_id, sort_order'),
        query<ProgramAddon>('SELECT * FROM treatment_program_addons WHERE is_active = 1 ORDER BY category_id, sort_order'),
      ]);
      setCategories(cats);
      setAllGrades(grds);
      setAllAddons(adds);
    } catch (error) {
      console.error('프리셋 데이터 로드 오류:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 카테고리 선택 시 등급/추가옵션 초기화
  useEffect(() => {
    setSelectedGrade(null);
    setSelectedAddons([]);
  }, [selectedCategory]);

  // 추가옵션 토글
  const toggleAddon = (addon: ProgramAddon) => {
    setSelectedAddons(prev => {
      const exists = prev.find(a => a.id === addon.id);
      if (exists) {
        return prev.filter(a => a.id !== addon.id);
      }
      return [...prev, addon];
    });
  };

  // 프로그램 등록
  const handleSubmit = async () => {
    if (!selectedCategory) {
      alert('치료 프로그램을 선택해주세요.');
      return;
    }

    setSubmitting(true);
    try {
      const chartNo = patient.chart_no?.replace(/^0+/, '') || '';
      const addonsJson = JSON.stringify(selectedAddons.map(a => ({
        addon_id: a.id,
        name: a.name,
        price: a.price,
      })));

      // 총 가격 계산 (임시 - 실제로는 더 복잡한 로직 필요)
      const addonTotal = selectedAddons.reduce((sum, a) => sum + a.price, 0);
      const totalPrice = addonTotal; // 기본 가격 로직은 추후 추가

      const today = new Date().toISOString().split('T')[0];

      await insert(`
        INSERT INTO patient_treatment_programs (
          patient_id, patient_name, chart_number,
          category_id, grade_id, unit_count, addons, total_price,
          doctor_id, doctor_name, consultation_type, memo, start_date
        ) VALUES (
          ${patient.patient_id},
          ${escapeString(patient.patient_name)},
          ${escapeString(chartNo)},
          ${selectedCategory.id},
          ${selectedGrade?.id || 'NULL'},
          ${unitCount},
          ${escapeString(addonsJson)},
          ${totalPrice},
          ${patient.acting?.doctor_id || 'NULL'},
          ${patient.acting?.doctor_name ? escapeString(patient.acting.doctor_name) : 'NULL'},
          ${patient.acting?.acting_type ? escapeString(patient.acting.acting_type) : 'NULL'},
          ${escapeString(memo)},
          ${escapeString(today)}
        )
      `);

      console.log(`✅ ${patient.patient_name} 환자 ${selectedCategory.name} ${unitCount}${selectedCategory.default_unit_name} 프로그램 등록 완료`);
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('프로그램 등록 오류:', error);
      alert('프로그램 등록 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content program-modal" onClick={e => e.stopPropagation()}>
          <div className="program-modal-loading">로딩 중...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content program-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>치료 프로그램 등록</h3>
          <button className="modal-close-btn" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {/* 환자 정보 */}
          <div className="patient-info-bar">
            <span className="patient-name">{patient.patient_name}</span>
            <span className="patient-chart">({patient.chart_no?.replace(/^0+/, '') || ''})</span>
            {patient.acting && (
              <span className="patient-acting-info">
                {patient.acting.acting_type} - {patient.acting.doctor_name}
              </span>
            )}
          </div>

          {/* 프로그램 카테고리 */}
          <div className="form-group">
            <label>프로그램 종류</label>
            <div className="program-category-grid">
              {categories.map(cat => (
                <button
                  key={cat.id}
                  className={`program-category-btn ${selectedCategory?.id === cat.id ? 'active' : ''}`}
                  onClick={() => setSelectedCategory(cat)}
                >
                  <span className="category-icon">{cat.icon}</span>
                  <span className="category-name">{cat.name}</span>
                </button>
              ))}
            </div>
          </div>

          {selectedCategory && (
            <>
              {/* 수량 */}
              <div className="form-group">
                <label>수량 ({selectedCategory.default_unit_name})</label>
                <div className="unit-count-control">
                  <button
                    className="unit-btn"
                    onClick={() => setUnitCount(Math.max(1, unitCount - 1))}
                    disabled={unitCount <= 1}
                  >
                    -
                  </button>
                  <span className="unit-value">{unitCount}</span>
                  <button
                    className="unit-btn"
                    onClick={() => setUnitCount(unitCount + 1)}
                  >
                    +
                  </button>
                  <span className="unit-label">{selectedCategory.default_unit_name}</span>
                </div>
              </div>

              {/* 등급 */}
              {filteredGrades.length > 0 && (
                <div className="form-group">
                  <label>등급</label>
                  <div className="grade-select-grid">
                    {filteredGrades.map(grade => (
                      <button
                        key={grade.id}
                        className={`grade-select-btn ${selectedGrade?.id === grade.id ? 'active' : ''}`}
                        onClick={() => setSelectedGrade(grade)}
                      >
                        <span className="grade-name">{grade.name}</span>
                        <span className="grade-desc">{grade.description}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 추가옵션 */}
              {filteredAddons.length > 0 && (
                <div className="form-group">
                  <label>추가옵션</label>
                  <div className="addon-select-grid">
                    {filteredAddons.map(addon => {
                      const isSelected = selectedAddons.some(a => a.id === addon.id);
                      return (
                        <button
                          key={addon.id}
                          className={`addon-select-btn ${isSelected ? 'active' : ''}`}
                          onClick={() => toggleAddon(addon)}
                        >
                          <span className="addon-name">{addon.name}</span>
                          <span className="addon-price">+{addon.price.toLocaleString()}원</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          {/* 메모 */}
          <div className="form-group">
            <label>메모</label>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="특이사항이나 메모를 입력하세요"
              rows={2}
            />
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-cancel" onClick={onClose}>취소</button>
          <button
            className="btn-submit"
            onClick={handleSubmit}
            disabled={!selectedCategory || submitting}
          >
            {submitting ? '등록 중...' : '프로그램 등록'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ProgramRegistrationModal;
