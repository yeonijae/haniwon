import { useState, useEffect, useCallback } from 'react';
import { useEscapeKey } from '@shared/hooks/useEscapeKey';
import { useDraggableModal } from '../hooks/useDraggableModal';
import { query, insert, execute, escapeString, getCurrentDate } from '@shared/lib/postgres';
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

interface PatientProgram {
  id: number;
  category_id: number;
  category_name: string;
  category_icon: string;
  grade_name: string | null;
  unit_count: number;
  used_count: number;
  addons: string;
  status: string;
  doctor_name: string | null;
  start_date: string;
  memo: string | null;
}

interface UsageRecord {
  id: number;
  usage_date: string;
  usage_count: number;
  doctor_name: string | null;
  memo: string | null;
}

interface PatientProgramModalProps {
  patient: ConsultationPatient;
  onClose: () => void;
  onSuccess?: () => void;
}

type ViewMode = 'list' | 'add' | 'usage';

function PatientProgramModal({ patient, onClose, onSuccess }: PatientProgramModalProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [loading, setLoading] = useState(true);
  const [programs, setPrograms] = useState<PatientProgram[]>([]);
  const [selectedProgram, setSelectedProgram] = useState<PatientProgram | null>(null);
  const [usageRecords, setUsageRecords] = useState<UsageRecord[]>([]);

  // 드래그 기능
  const { modalRef, modalStyle, modalClassName, handleMouseDown } = useDraggableModal({ isOpen: true });

  // 프로그램 등록 폼 상태
  const [categories, setCategories] = useState<ProgramCategory[]>([]);
  const [allGrades, setAllGrades] = useState<ProgramGrade[]>([]);
  const [allAddons, setAllAddons] = useState<ProgramAddon[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<ProgramCategory | null>(null);
  const [unitCount, setUnitCount] = useState(1);
  const [selectedGrade, setSelectedGrade] = useState<ProgramGrade | null>(null);
  const [selectedAddons, setSelectedAddons] = useState<ProgramAddon[]>([]);
  const [memo, setMemo] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // 사용 기록 폼 상태
  const [usageDate, setUsageDate] = useState(getCurrentDate());
  const [usageCount, setUsageCount] = useState(1);
  const [usageMemo, setUsageMemo] = useState('');

  // ESC 키로 모달 닫기
  useEscapeKey(onClose);

  // 환자의 프로그램 목록 조회
  const loadPrograms = useCallback(async () => {
    try {
      setLoading(true);
      const chartNo = patient.chart_no?.replace(/^0+/, '') || '';

      const data = await query<PatientProgram>(`
        SELECT
          p.id, p.category_id, c.name as category_name, c.icon as category_icon,
          g.name as grade_name, p.unit_count,
          COALESCE((SELECT SUM(usage_count) FROM program_usage_records WHERE program_id = p.id), 0) as used_count,
          p.addons, p.status, p.doctor_name, p.start_date, p.memo
        FROM patient_treatment_programs p
        LEFT JOIN treatment_program_categories c ON p.category_id = c.id
        LEFT JOIN treatment_program_grades g ON p.grade_id = g.id
        WHERE p.patient_id = ${patient.patient_id}
           OR p.chart_number = ${escapeString(chartNo)}
        ORDER BY p.status = 'active' DESC, p.created_at DESC
      `);
      setPrograms(data);
    } catch (error) {
      console.error('프로그램 조회 오류:', error);
    } finally {
      setLoading(false);
    }
  }, [patient]);

  // 프로그램 등록용 프리셋 데이터 로드
  const loadPresets = useCallback(async () => {
    try {
      const [cats, grds, adds] = await Promise.all([
        query<ProgramCategory>('SELECT * FROM treatment_program_categories WHERE is_active = 1 ORDER BY sort_order'),
        query<ProgramGrade>('SELECT * FROM treatment_program_grades WHERE is_active = 1 ORDER BY category_id, sort_order'),
        query<ProgramAddon>('SELECT * FROM treatment_program_addons WHERE is_active = 1 ORDER BY category_id, sort_order'),
      ]);
      setCategories(cats);
      setAllGrades(grds);
      setAllAddons(adds);
    } catch (error) {
      console.error('프리셋 로드 오류:', error);
    }
  }, []);

  // 사용 기록 조회
  const loadUsageRecords = useCallback(async (programId: number) => {
    try {
      const records = await query<UsageRecord>(`
        SELECT id, usage_date, usage_count, doctor_name, memo
        FROM program_usage_records
        WHERE program_id = ${programId}
        ORDER BY usage_date DESC
      `);
      setUsageRecords(records);
    } catch (error) {
      console.error('사용 기록 조회 오류:', error);
    }
  }, []);

  useEffect(() => {
    loadPrograms();
    loadPresets();
  }, [loadPrograms, loadPresets]);

  // 카테고리 선택 시 초기화
  useEffect(() => {
    setSelectedGrade(null);
    setSelectedAddons([]);
  }, [selectedCategory]);

  // 프로그램 선택 시 사용 기록 조회
  useEffect(() => {
    if (selectedProgram && viewMode === 'usage') {
      loadUsageRecords(selectedProgram.id);
    }
  }, [selectedProgram, viewMode, loadUsageRecords]);

  // 필터된 등급/추가옵션
  const filteredGrades = selectedCategory
    ? allGrades.filter(g => g.category_id === selectedCategory.id)
    : [];
  const filteredAddons = selectedCategory
    ? allAddons.filter(a => a.category_id === selectedCategory.id || a.category_id === null)
    : [];

  // 추가옵션 토글
  const toggleAddon = (addon: ProgramAddon) => {
    setSelectedAddons(prev => {
      const exists = prev.find(a => a.id === addon.id);
      if (exists) return prev.filter(a => a.id !== addon.id);
      return [...prev, addon];
    });
  };

  // 새 프로그램 등록
  const handleAddProgram = async () => {
    if (!selectedCategory) {
      alert('프로그램 종류를 선택해주세요.');
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
      const addonTotal = selectedAddons.reduce((sum, a) => sum + a.price, 0);
      const today = getCurrentDate();

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
          ${addonTotal},
          ${patient.acting?.doctor_id || 'NULL'},
          ${patient.acting?.doctor_name ? escapeString(patient.acting.doctor_name) : 'NULL'},
          ${patient.acting?.acting_type ? escapeString(patient.acting.acting_type) : 'NULL'},
          ${escapeString(memo)},
          ${escapeString(today)}
        )
      `);

      console.log(`✅ ${patient.patient_name} 환자 ${selectedCategory.name} ${unitCount}${selectedCategory.default_unit_name} 프로그램 등록 완료`);

      // 초기화 후 목록으로
      setSelectedCategory(null);
      setUnitCount(1);
      setSelectedGrade(null);
      setSelectedAddons([]);
      setMemo('');
      setViewMode('list');
      loadPrograms();
      onSuccess?.();
    } catch (error) {
      console.error('프로그램 등록 오류:', error);
      alert('프로그램 등록에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  // 사용 기록 추가
  const handleAddUsage = async () => {
    if (!selectedProgram) return;

    const remaining = selectedProgram.unit_count - selectedProgram.used_count;
    if (usageCount > remaining) {
      alert(`남은 횟수(${remaining})보다 많이 사용할 수 없습니다.`);
      return;
    }

    setSubmitting(true);
    try {
      await execute(`
        INSERT INTO program_usage_records (program_id, usage_date, usage_count, doctor_name, memo)
        VALUES (${selectedProgram.id}, ${escapeString(usageDate)}, ${usageCount},
                ${patient.acting?.doctor_name ? escapeString(patient.acting.doctor_name) : 'NULL'},
                ${usageMemo ? escapeString(usageMemo) : 'NULL'})
      `);

      console.log(`✅ ${patient.patient_name} 프로그램 사용 기록 추가 (${usageCount}회)`);

      // 초기화
      setUsageCount(1);
      setUsageMemo('');
      loadUsageRecords(selectedProgram.id);
      loadPrograms();
      onSuccess?.();
    } catch (error) {
      console.error('사용 기록 추가 오류:', error);
      alert('사용 기록 추가에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  // 프로그램 완료 처리
  const handleCompleteProgram = async (program: PatientProgram) => {
    if (!confirm('이 프로그램을 완료 처리하시겠습니까?')) return;

    try {
      await execute(`UPDATE patient_treatment_programs SET status = 'completed' WHERE id = ${program.id}`);
      loadPrograms();
    } catch (error) {
      console.error('프로그램 완료 처리 오류:', error);
    }
  };

  // 추가옵션 파싱
  const parseAddons = (addonsJson: string): { name: string }[] => {
    try {
      return JSON.parse(addonsJson || '[]');
    } catch {
      return [];
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        ref={modalRef}
        className={`modal-content patient-program-modal ${modalClassName}`}
        style={modalStyle}
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header draggable" onMouseDown={handleMouseDown}>
          <h3>
            {viewMode === 'list' && '프로그램 관리'}
            {viewMode === 'add' && '새 프로그램 등록'}
            {viewMode === 'usage' && '사용 기록 관리'}
          </h3>
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

          {/* 목록 뷰 */}
          {viewMode === 'list' && (
            <div className="program-list-view">
              <div className="program-list-header">
                <span>등록된 프로그램 ({programs.filter(p => p.status === 'active').length}개 활성)</span>
                <button className="btn-add-program" onClick={() => setViewMode('add')}>
                  <i className="fas fa-plus"></i> 새 프로그램
                </button>
              </div>

              {loading ? (
                <div className="loading-text">로딩 중...</div>
              ) : programs.length === 0 ? (
                <div className="empty-text">등록된 프로그램이 없습니다</div>
              ) : (
                <div className="program-items">
                  {programs.map(program => {
                    const remaining = program.unit_count - program.used_count;
                    const progressPercent = (program.used_count / program.unit_count) * 100;
                    const addons = parseAddons(program.addons);

                    return (
                      <div
                        key={program.id}
                        className={`program-item ${program.status === 'completed' ? 'completed' : ''}`}
                      >
                        <div className="program-item-main">
                          <div className="program-item-info">
                            <span className="program-icon">{program.category_icon}</span>
                            <span className="program-name">{program.category_name}</span>
                            {program.grade_name && (
                              <span className="program-grade-badge">{program.grade_name}</span>
                            )}
                            {addons.length > 0 && (
                              <span className="program-addons-count">+{addons.length}</span>
                            )}
                          </div>
                          <div className="program-item-progress">
                            <div className="progress-bar">
                              <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
                            </div>
                            <span className="progress-text">
                              {program.used_count}/{program.unit_count}
                              {remaining > 0 && ` (남은 ${remaining})`}
                            </span>
                          </div>
                        </div>
                        <div className="program-item-actions">
                          {program.status === 'active' && remaining > 0 && (
                            <button
                              className="btn-usage"
                              onClick={() => { setSelectedProgram(program); setViewMode('usage'); }}
                              title="사용 기록"
                            >
                              <i className="fas fa-clipboard-list"></i>
                            </button>
                          )}
                          {program.status === 'active' && (
                            <button
                              className="btn-complete"
                              onClick={() => handleCompleteProgram(program)}
                              title="완료 처리"
                            >
                              <i className="fas fa-check"></i>
                            </button>
                          )}
                          {program.status === 'completed' && (
                            <span className="status-badge completed">완료</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 등록 뷰 */}
          {viewMode === 'add' && (
            <div className="program-add-view">
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
                  <div className="form-group">
                    <label>수량 ({selectedCategory.default_unit_name})</label>
                    <div className="unit-count-control">
                      <button
                        className="unit-btn"
                        onClick={() => setUnitCount(Math.max(1, unitCount - 1))}
                        disabled={unitCount <= 1}
                      >-</button>
                      <span className="unit-value">{unitCount}</span>
                      <button className="unit-btn" onClick={() => setUnitCount(unitCount + 1)}>+</button>
                      <span className="unit-label">{selectedCategory.default_unit_name}</span>
                    </div>
                  </div>

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
          )}

          {/* 사용 기록 뷰 */}
          {viewMode === 'usage' && selectedProgram && (
            <div className="program-usage-view">
              <div className="usage-program-info">
                <span className="program-icon">{selectedProgram.category_icon}</span>
                <span className="program-name">{selectedProgram.category_name}</span>
                <span className="program-remaining">
                  남은 횟수: {selectedProgram.unit_count - selectedProgram.used_count}
                </span>
              </div>

              {/* 사용 기록 추가 폼 */}
              <div className="usage-add-form">
                <div className="form-row">
                  <div className="form-group">
                    <label>사용일</label>
                    <input
                      type="date"
                      value={usageDate}
                      onChange={(e) => setUsageDate(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label>사용 횟수</label>
                    <input
                      type="number"
                      min="1"
                      max={selectedProgram.unit_count - selectedProgram.used_count}
                      value={usageCount}
                      onChange={(e) => setUsageCount(parseInt(e.target.value) || 1)}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>메모</label>
                  <input
                    type="text"
                    value={usageMemo}
                    onChange={(e) => setUsageMemo(e.target.value)}
                    placeholder="사용 관련 메모"
                  />
                </div>
                <button
                  className="btn-add-usage"
                  onClick={handleAddUsage}
                  disabled={submitting || selectedProgram.unit_count <= selectedProgram.used_count}
                >
                  {submitting ? '저장 중...' : '사용 기록 추가'}
                </button>
              </div>

              {/* 사용 기록 목록 */}
              <div className="usage-records">
                <h4>사용 기록</h4>
                {usageRecords.length === 0 ? (
                  <div className="empty-text">사용 기록이 없습니다</div>
                ) : (
                  <div className="usage-records-list">
                    {usageRecords.map(record => (
                      <div key={record.id} className="usage-record-item">
                        <span className="usage-date">{record.usage_date}</span>
                        <span className="usage-count">{record.usage_count}회</span>
                        {record.doctor_name && <span className="usage-doctor">{record.doctor_name}</span>}
                        {record.memo && <span className="usage-memo">{record.memo}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          {viewMode === 'list' && (
            <button className="btn-cancel" onClick={onClose}>닫기</button>
          )}
          {viewMode === 'add' && (
            <>
              <button className="btn-cancel" onClick={() => setViewMode('list')}>뒤로</button>
              <button
                className="btn-submit"
                onClick={handleAddProgram}
                disabled={!selectedCategory || submitting}
              >
                {submitting ? '등록 중...' : '프로그램 등록'}
              </button>
            </>
          )}
          {viewMode === 'usage' && (
            <button className="btn-cancel" onClick={() => { setViewMode('list'); setSelectedProgram(null); }}>뒤로</button>
          )}
        </div>
      </div>
    </div>
  );
}

export default PatientProgramModal;
