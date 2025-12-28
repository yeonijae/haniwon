import { useState, useEffect, useCallback } from 'react';
import { useEscapeKey } from '@shared/hooks/useEscapeKey';
import type { PortalUser } from '@shared/types';
import { query, execute, escapeString } from '@shared/lib/sqlite';

interface ProgramManagementViewProps {
  user: PortalUser;
}

// 프로그램 타입
interface PatientProgram {
  id: number;
  patient_id: number;
  patient_name: string;
  chart_number: string;
  category_id: number;
  category_name: string;
  category_icon: string;
  grade_id: number | null;
  grade_name: string | null;
  unit_count: number;
  used_count: number;
  addons: string;
  total_price: number;
  status: 'active' | 'completed' | 'cancelled';
  doctor_id: number | null;
  doctor_name: string | null;
  consultation_type: string | null;
  memo: string | null;
  start_date: string;
  created_at: string;
}

// 사용 기록 타입
interface UsageRecord {
  id: number;
  program_id: number;
  usage_date: string;
  usage_count: number;
  doctor_id: number | null;
  doctor_name: string | null;
  memo: string | null;
  created_at: string;
}

function ProgramManagementView({ user }: ProgramManagementViewProps) {
  const [programs, setPrograms] = useState<PatientProgram[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [includeCompleted, setIncludeCompleted] = useState(false);
  const [expandedProgramId, setExpandedProgramId] = useState<number | null>(null);
  const [usageRecords, setUsageRecords] = useState<Record<number, UsageRecord[]>>({});
  const [showAddUsageModal, setShowAddUsageModal] = useState<PatientProgram | null>(null);

  // 프로그램 목록 조회
  const loadPrograms = useCallback(async () => {
    setLoading(true);
    try {
      let sql = `
        SELECT
          p.id, p.patient_id, p.patient_name, p.chart_number,
          p.category_id, c.name as category_name, c.icon as category_icon,
          p.grade_id, g.name as grade_name,
          p.unit_count,
          COALESCE((SELECT SUM(usage_count) FROM program_usage_records WHERE program_id = p.id), 0) as used_count,
          p.addons, p.total_price, p.status,
          p.doctor_id, p.doctor_name, p.consultation_type, p.memo,
          p.start_date, p.created_at
        FROM patient_treatment_programs p
        LEFT JOIN treatment_program_categories c ON p.category_id = c.id
        LEFT JOIN treatment_program_grades g ON p.grade_id = g.id
      `;

      const conditions: string[] = [];
      if (!includeCompleted) {
        conditions.push("p.status = 'active'");
      }
      if (searchTerm) {
        conditions.push(`(p.patient_name LIKE '%${searchTerm}%' OR p.chart_number LIKE '%${searchTerm}%')`);
      }

      if (conditions.length > 0) {
        sql += ' WHERE ' + conditions.join(' AND ');
      }

      sql += ' ORDER BY p.created_at DESC';

      const data = await query<PatientProgram>(sql);
      setPrograms(data);
    } catch (error) {
      console.error('프로그램 목록 조회 오류:', error);
    } finally {
      setLoading(false);
    }
  }, [includeCompleted, searchTerm]);

  useEffect(() => {
    loadPrograms();
  }, [loadPrograms]);

  // 사용 기록 조회
  const loadUsageRecords = useCallback(async (programId: number) => {
    try {
      const records = await query<UsageRecord>(`
        SELECT * FROM program_usage_records
        WHERE program_id = ${programId}
        ORDER BY usage_date DESC, created_at DESC
      `);
      setUsageRecords(prev => ({ ...prev, [programId]: records }));
    } catch (error) {
      console.error('사용 기록 조회 오류:', error);
    }
  }, []);

  // 프로그램 확장/접기
  const handleToggleExpand = useCallback(async (programId: number) => {
    if (expandedProgramId === programId) {
      setExpandedProgramId(null);
    } else {
      setExpandedProgramId(programId);
      if (!usageRecords[programId]) {
        await loadUsageRecords(programId);
      }
    }
  }, [expandedProgramId, usageRecords, loadUsageRecords]);

  // 프로그램 완료 처리
  const handleCompleteProgram = useCallback(async (program: PatientProgram) => {
    if (!confirm(`${program.patient_name}님의 프로그램을 완료 처리하시겠습니까?`)) {
      return;
    }
    try {
      await execute(`UPDATE patient_treatment_programs SET status = 'completed' WHERE id = ${program.id}`);
      loadPrograms();
    } catch (error) {
      console.error('프로그램 완료 처리 오류:', error);
      alert('완료 처리에 실패했습니다.');
    }
  }, [loadPrograms]);

  // 진행률 계산
  const getProgress = (program: PatientProgram): number => {
    if (program.unit_count === 0) return 0;
    return Math.round((program.used_count / program.unit_count) * 100);
  };

  // 추가옵션 파싱
  const parseAddons = (addonsJson: string): { name: string; price: number }[] => {
    try {
      return JSON.parse(addonsJson || '[]');
    } catch {
      return [];
    }
  };

  return (
    <div className="program-management">
      {/* 헤더 */}
      <div className="program-header">
        <div className="program-header-left">
          <h2>프로그램 관리</h2>
          <span className="program-count">총 {programs.length}건</span>
        </div>
        <div className="program-header-right">
          <input
            type="text"
            className="program-search"
            placeholder="환자명 또는 차트번호 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <label className="program-filter-checkbox">
            <input
              type="checkbox"
              checked={includeCompleted}
              onChange={(e) => setIncludeCompleted(e.target.checked)}
            />
            완료 포함
          </label>
          <button className="program-refresh-btn" onClick={loadPrograms} disabled={loading}>
            <i className={`fas fa-sync-alt ${loading ? 'fa-spin' : ''}`}></i>
          </button>
        </div>
      </div>

      {/* 프로그램 목록 */}
      <div className="program-list">
        {loading ? (
          <div className="program-loading">
            <i className="fas fa-spinner fa-spin"></i> 로딩 중...
          </div>
        ) : programs.length === 0 ? (
          <div className="program-empty">
            <i className="fas fa-box-open"></i>
            <p>등록된 프로그램이 없습니다</p>
          </div>
        ) : (
          programs.map((program) => (
            <div
              key={program.id}
              className={`program-card ${program.status === 'completed' ? 'completed' : ''}`}
            >
              {/* 카드 헤더 */}
              <div
                className="program-card-header"
                onClick={() => handleToggleExpand(program.id)}
              >
                <div className="program-card-info">
                  <div className="program-patient">
                    <span className="program-patient-name">{program.patient_name}</span>
                    <span className="program-chart-no">({program.chart_number})</span>
                  </div>
                  <div className="program-category">
                    <span className="program-category-icon">{program.category_icon}</span>
                    <span className="program-category-name">{program.category_name}</span>
                    {program.grade_name && (
                      <span className="program-grade">{program.grade_name}</span>
                    )}
                  </div>
                </div>

                <div className="program-card-meta">
                  <div className="program-progress">
                    <div className="program-progress-bar">
                      <div
                        className="program-progress-fill"
                        style={{ width: `${getProgress(program)}%` }}
                      />
                    </div>
                    <span className="program-progress-text">
                      {program.used_count}/{program.unit_count}
                    </span>
                  </div>
                </div>

                <div className="program-card-dates">
                  <div className="program-date-item">
                    <span className="program-date-label">시작일</span>
                    <span className="program-date-value">{program.start_date}</span>
                  </div>
                  {program.doctor_name && (
                    <div className="program-date-item">
                      <span className="program-date-label">담당</span>
                      <span className="program-date-value">{program.doctor_name}</span>
                    </div>
                  )}
                </div>

                <div className="program-card-actions">
                  {program.status === 'active' && program.used_count < program.unit_count && (
                    <button
                      className="program-action-btn use"
                      onClick={(e) => { e.stopPropagation(); setShowAddUsageModal(program); }}
                      title="사용 기록 추가"
                    >
                      <i className="fas fa-plus"></i>
                    </button>
                  )}
                  {program.status === 'active' && (
                    <button
                      className="program-action-btn complete"
                      onClick={(e) => { e.stopPropagation(); handleCompleteProgram(program); }}
                      title="완료 처리"
                    >
                      <i className="fas fa-check"></i>
                    </button>
                  )}
                  <button className="program-expand-btn">
                    <i className={`fas fa-chevron-${expandedProgramId === program.id ? 'up' : 'down'}`}></i>
                  </button>
                </div>
              </div>

              {/* 상세 정보 */}
              {expandedProgramId === program.id && (
                <div className="program-card-detail">
                  {/* 추가옵션 */}
                  {parseAddons(program.addons).length > 0 && (
                    <div className="program-addons">
                      <span className="program-addons-label">추가옵션:</span>
                      {parseAddons(program.addons).map((addon, idx) => (
                        <span key={idx} className="program-addon-badge">
                          {addon.name} (+{addon.price.toLocaleString()}원)
                        </span>
                      ))}
                    </div>
                  )}

                  {/* 메모 */}
                  {program.memo && (
                    <div className="program-memo">
                      <i className="fas fa-sticky-note"></i> {program.memo}
                    </div>
                  )}

                  {/* 사용 기록 */}
                  <div className="program-usage-section">
                    <div className="program-usage-header">
                      <span>사용 기록</span>
                      {program.status === 'active' && program.used_count < program.unit_count && (
                        <button
                          className="program-add-usage-btn"
                          onClick={() => setShowAddUsageModal(program)}
                        >
                          <i className="fas fa-plus"></i> 사용 기록 추가
                        </button>
                      )}
                    </div>
                    <div className="program-usage-list">
                      {(usageRecords[program.id] || []).length === 0 ? (
                        <div className="program-usage-empty">사용 기록이 없습니다</div>
                      ) : (
                        (usageRecords[program.id] || []).map((record) => (
                          <div key={record.id} className="program-usage-item">
                            <span className="usage-date">{record.usage_date}</span>
                            <span className="usage-count">{record.usage_count}회 사용</span>
                            {record.doctor_name && (
                              <span className="usage-doctor">{record.doctor_name}</span>
                            )}
                            {record.memo && (
                              <span className="usage-memo">{record.memo}</span>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* 사용 기록 추가 모달 */}
      {showAddUsageModal && (
        <AddUsageModal
          program={showAddUsageModal}
          onClose={() => setShowAddUsageModal(null)}
          onSuccess={() => {
            setShowAddUsageModal(null);
            loadPrograms();
            if (expandedProgramId === showAddUsageModal.id) {
              loadUsageRecords(showAddUsageModal.id);
            }
          }}
        />
      )}
    </div>
  );
}

// 사용 기록 추가 모달
interface AddUsageModalProps {
  program: PatientProgram;
  onClose: () => void;
  onSuccess: () => void;
}

function AddUsageModal({ program, onClose, onSuccess }: AddUsageModalProps) {
  const [form, setForm] = useState({
    usage_date: new Date().toISOString().split('T')[0],
    usage_count: 1,
    doctor_name: program.doctor_name || '',
    memo: '',
  });
  const [saving, setSaving] = useState(false);

  const remainingCount = program.unit_count - program.used_count;

  // ESC 키로 모달 닫기
  useEscapeKey(onClose);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.usage_count > remainingCount) {
      alert(`남은 횟수(${remainingCount})보다 많이 사용할 수 없습니다.`);
      return;
    }

    setSaving(true);
    try {
      await execute(`
        INSERT INTO program_usage_records (program_id, usage_date, usage_count, doctor_name, memo)
        VALUES (${program.id}, ${escapeString(form.usage_date)}, ${form.usage_count},
                ${form.doctor_name ? escapeString(form.doctor_name) : 'NULL'},
                ${form.memo ? escapeString(form.memo) : 'NULL'})
      `);
      console.log(`✅ ${program.patient_name} 프로그램 사용 기록 추가 (${form.usage_count}회)`);
      onSuccess();
    } catch (error) {
      console.error('사용 기록 추가 오류:', error);
      alert('사용 기록 추가에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content program-usage-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>사용 기록 추가</h3>
          <button className="modal-close-btn" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit} className="modal-body">
          <div className="patient-info-bar">
            <span className="patient-name">{program.patient_name}</span>
            <span className="patient-chart">({program.chart_number})</span>
            <span className="program-info">
              {program.category_icon} {program.category_name}
              <span className="remaining">남은 횟수: {remainingCount}</span>
            </span>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>사용일</label>
              <input
                type="date"
                value={form.usage_date}
                onChange={(e) => setForm({ ...form, usage_date: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>사용 횟수</label>
              <input
                type="number"
                min="1"
                max={remainingCount}
                value={form.usage_count}
                onChange={(e) => setForm({ ...form, usage_count: parseInt(e.target.value) || 1 })}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label>담당의</label>
            <input
              type="text"
              value={form.doctor_name}
              onChange={(e) => setForm({ ...form, doctor_name: e.target.value })}
              placeholder="담당의 이름"
            />
          </div>

          <div className="form-group">
            <label>메모</label>
            <textarea
              value={form.memo}
              onChange={(e) => setForm({ ...form, memo: e.target.value })}
              placeholder="메모 입력"
              rows={2}
            />
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-cancel" onClick={onClose}>취소</button>
            <button type="submit" className="btn-submit" disabled={saving}>
              {saving ? '저장 중...' : '사용 기록 추가'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ProgramManagementView;
