import { useState, useEffect, useCallback } from 'react';
import {
  getPackageTypes,
  createPackageType,
  updatePackageType,
  deletePackageType,
  type PackageType,
} from '../lib/api';

const TYPE_LABELS: Record<string, string> = {
  deduction: '차감형',
  membership: '멤버십',
  yakchim: '약침',
  yobup: '요법',
};

function PackageTypeAdmin() {
  const [packageTypes, setPackageTypes] = useState<PackageType[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);

  // 새 항목 입력
  const [newItem, setNewItem] = useState({ name: '', type: 'deduction' as 'deduction' | 'membership' | 'yakchim' | 'yobup', deductionCount: 1 });

  // 수정 입력
  const [editItem, setEditItem] = useState({ name: '', type: 'deduction' as 'deduction' | 'membership' | 'yakchim' | 'yobup', deductionCount: 1 });

  // 데이터 로드
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const types = await getPackageTypes(true); // 비활성 포함
      setPackageTypes(types);
    } catch (error) {
      console.error('패키지 종류 로드 오류:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 추가
  const handleAdd = async () => {
    if (!newItem.name.trim()) {
      alert('이름을 입력해주세요.');
      return;
    }

    const result = await createPackageType(newItem.name, newItem.type, undefined, newItem.deductionCount);
    if (result) {
      setNewItem({ name: '', type: 'deduction', deductionCount: 1 });
      loadData();
    } else {
      alert('추가에 실패했습니다. 이미 존재하는 이름인지 확인해주세요.');
    }
  };

  // 수정 시작
  const handleEditStart = (item: PackageType) => {
    setEditingId(item.id);
    setEditItem({ name: item.name, type: item.type, deductionCount: item.deduction_count || 1 });
  };

  // 수정 취소
  const handleEditCancel = () => {
    setEditingId(null);
    setEditItem({ name: '', type: 'deduction', deductionCount: 1 });
  };

  // 수정 저장
  const handleEditSave = async (id: number) => {
    if (!editItem.name.trim()) {
      alert('이름을 입력해주세요.');
      return;
    }

    const success = await updatePackageType(id, {
      name: editItem.name,
      type: editItem.type,
      deduction_count: editItem.deductionCount,
    });

    if (success) {
      setEditingId(null);
      loadData();
    } else {
      alert('수정에 실패했습니다.');
    }
  };

  // 활성/비활성 토글
  const handleToggleActive = async (item: PackageType) => {
    const success = await updatePackageType(item.id, { is_active: !item.is_active });
    if (success) {
      loadData();
    }
  };

  // 삭제
  const handleDelete = async (id: number) => {
    if (!confirm('정말 삭제하시겠습니까?\n삭제된 항목은 복구할 수 없습니다.')) return;

    const success = await deletePackageType(id);
    if (success) {
      loadData();
    } else {
      alert('삭제에 실패했습니다.');
    }
  };

  if (loading) {
    return (
      <div className="package-type-admin">
        <div className="admin-loading">
          <i className="fa-solid fa-spinner fa-spin"></i> 로딩 중...
        </div>
      </div>
    );
  }

  return (
    <div className="package-type-admin">
      <div className="admin-header">
        <h3>
          <i className="fa-solid fa-boxes-stacked"></i>
          패키지/멤버십/약침 종류 관리
        </h3>
        <p className="admin-description">
          차감형 패키지, 멤버십, 약침 종류를 관리합니다.
        </p>
      </div>

      {/* 새 항목 추가 */}
      <div className="admin-add-form">
        <input
          type="text"
          placeholder="이름 입력"
          value={newItem.name}
          onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        />
        <select
          value={newItem.type}
          onChange={(e) => setNewItem({ ...newItem, type: e.target.value as 'deduction' | 'membership' | 'yakchim' | 'yobup' })}
        >
          <option value="deduction">차감형</option>
          <option value="membership">멤버십</option>
          <option value="yakchim">약침</option>
          <option value="yobup">요법</option>
        </select>
        {(newItem.type === 'yakchim' || newItem.type === 'yobup') && (
          <div className="deduction-count-input">
            <input
              type="number"
              min={1}
              value={newItem.deductionCount}
              onChange={(e) => setNewItem({ ...newItem, deductionCount: Math.max(1, parseInt(e.target.value) || 1) })}
            />
            <span className="unit">p 차감</span>
          </div>
        )}
        <button className="btn-add" onClick={handleAdd}>
          <i className="fa-solid fa-plus"></i> 추가
        </button>
      </div>

      {/* 목록 */}
      <div className="admin-list">
        {packageTypes.length === 0 ? (
          <div className="admin-empty">
            등록된 패키지/멤버십 종류가 없습니다.
          </div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>이름</th>
                <th>종류</th>
                <th>차감</th>
                <th>상태</th>
                <th>관리</th>
              </tr>
            </thead>
            <tbody>
              {packageTypes.map((item) => (
                <tr key={item.id} className={!item.is_active ? 'inactive' : ''}>
                  {editingId === item.id ? (
                    <>
                      <td>
                        <input
                          type="text"
                          value={editItem.name}
                          onChange={(e) => setEditItem({ ...editItem, name: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleEditSave(item.id);
                            if (e.key === 'Escape') handleEditCancel();
                          }}
                          autoFocus
                        />
                      </td>
                      <td>
                        <select
                          value={editItem.type}
                          onChange={(e) => setEditItem({ ...editItem, type: e.target.value as 'deduction' | 'membership' | 'yakchim' | 'yobup' })}
                        >
                          <option value="deduction">차감형</option>
                          <option value="membership">멤버십</option>
                          <option value="yakchim">약침</option>
                          <option value="yobup">요법</option>
                        </select>
                      </td>
                      <td>
                        {(editItem.type === 'yakchim' || editItem.type === 'yobup') ? (
                          <input
                            type="number"
                            className="deduction-input"
                            min={1}
                            value={editItem.deductionCount}
                            onChange={(e) => setEditItem({ ...editItem, deductionCount: Math.max(1, parseInt(e.target.value) || 1) })}
                          />
                        ) : '-'}
                      </td>
                      <td>-</td>
                      <td className="actions">
                        <button className="btn-save" onClick={() => handleEditSave(item.id)} title="저장">
                          <i className="fa-solid fa-check"></i>
                        </button>
                        <button className="btn-cancel" onClick={handleEditCancel} title="취소">
                          <i className="fa-solid fa-xmark"></i>
                        </button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td>{item.name}</td>
                      <td>
                        <span className={`type-badge ${item.type}`}>
                          {TYPE_LABELS[item.type]}
                        </span>
                      </td>
                      <td>
                        {(item.type === 'yakchim' || item.type === 'yobup') ? (
                          <span className="deduction-count">{item.deduction_count || 1}p</span>
                        ) : '-'}
                      </td>
                      <td>
                        <button
                          className={`btn-toggle ${item.is_active ? 'active' : 'inactive'}`}
                          onClick={() => handleToggleActive(item)}
                          title={item.is_active ? '비활성화' : '활성화'}
                        >
                          {item.is_active ? '활성' : '비활성'}
                        </button>
                      </td>
                      <td className="actions">
                        <button className="btn-edit" onClick={() => handleEditStart(item)} title="수정">
                          <i className="fa-solid fa-pen"></i>
                        </button>
                        <button className="btn-delete" onClick={() => handleDelete(item.id)} title="삭제">
                          <i className="fa-solid fa-trash"></i>
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <style>{`
        .package-type-admin {
          padding: 20px;
          max-width: 700px;
        }

        .admin-header {
          margin-bottom: 20px;
        }

        .admin-header h3 {
          margin: 0 0 8px 0;
          font-size: 16px;
          font-weight: 600;
          color: #1f2937;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .admin-header h3 i {
          color: #3b82f6;
        }

        .admin-description {
          margin: 0;
          font-size: 13px;
          color: #6b7280;
        }

        .admin-loading {
          padding: 40px;
          text-align: center;
          color: #6b7280;
        }

        .admin-add-form {
          display: flex;
          gap: 8px;
          margin-bottom: 16px;
          padding: 12px;
          background: #f9fafb;
          border-radius: 8px;
        }

        .admin-add-form input {
          flex: 1;
          padding: 8px 12px;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 13px;
        }

        .admin-add-form input:focus {
          outline: none;
          border-color: #3b82f6;
        }

        .admin-add-form select {
          padding: 8px 12px;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 13px;
          background: white;
        }

        .admin-add-form .btn-add {
          padding: 8px 16px;
          background: #3b82f6;
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 13px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .admin-add-form .btn-add:hover {
          background: #2563eb;
        }

        .deduction-count-input {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .deduction-count-input input {
          width: 60px;
          flex: none;
          padding: 8px;
          text-align: center;
        }

        .deduction-count-input .unit {
          font-size: 12px;
          color: #6b7280;
          white-space: nowrap;
        }

        .deduction-count {
          font-size: 12px;
          color: #6b7280;
        }

        .deduction-input {
          width: 60px;
          padding: 6px 8px;
          border: 1px solid #3b82f6;
          border-radius: 4px;
          font-size: 13px;
          text-align: center;
        }

        .admin-empty {
          padding: 40px;
          text-align: center;
          color: #9ca3af;
          background: #f9fafb;
          border-radius: 8px;
        }

        .admin-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }

        .admin-table th {
          padding: 10px 12px;
          text-align: left;
          background: #f3f4f6;
          font-weight: 600;
          color: #374151;
          border-bottom: 1px solid #e5e7eb;
        }

        .admin-table td {
          padding: 10px 12px;
          border-bottom: 1px solid #e5e7eb;
        }

        .admin-table tr.inactive {
          opacity: 0.5;
        }

        .admin-table tr:hover {
          background: #f9fafb;
        }

        .admin-table input {
          width: 100%;
          padding: 6px 10px;
          border: 1px solid #3b82f6;
          border-radius: 4px;
          font-size: 13px;
        }

        .admin-table select {
          padding: 6px 10px;
          border: 1px solid #3b82f6;
          border-radius: 4px;
          font-size: 13px;
          background: white;
        }

        .type-badge {
          display: inline-block;
          padding: 3px 8px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 500;
        }

        .type-badge.deduction {
          background: #dbeafe;
          color: #1d4ed8;
        }

        .type-badge.membership {
          background: #dcfce7;
          color: #166534;
        }

        .type-badge.yakchim {
          background: #fef3c7;
          color: #92400e;
        }

        .type-badge.yobup {
          background: #fce7f3;
          color: #9d174d;
        }

        .btn-toggle {
          padding: 4px 10px;
          border: none;
          border-radius: 4px;
          font-size: 11px;
          cursor: pointer;
        }

        .btn-toggle.active {
          background: #dcfce7;
          color: #166534;
        }

        .btn-toggle.inactive {
          background: #fee2e2;
          color: #dc2626;
        }

        .actions {
          display: flex;
          gap: 6px;
        }

        .actions button {
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
        }

        .btn-edit {
          background: #f3f4f6;
          color: #6b7280;
        }

        .btn-edit:hover {
          background: #e5e7eb;
          color: #374151;
        }

        .btn-delete {
          background: #fee2e2;
          color: #dc2626;
        }

        .btn-delete:hover {
          background: #fecaca;
        }

        .btn-save {
          background: #dcfce7;
          color: #166534;
        }

        .btn-save:hover {
          background: #bbf7d0;
        }

        .btn-cancel {
          background: #f3f4f6;
          color: #6b7280;
        }

        .btn-cancel:hover {
          background: #e5e7eb;
        }
      `}</style>
    </div>
  );
}

export default PackageTypeAdmin;
