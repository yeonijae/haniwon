import { useState, useEffect, useCallback } from 'react';
import { query, insert, execute, escapeString } from '@shared/lib/sqlite';

// 타입 정의
interface ProgramCategory {
  id: number;
  name: string;
  icon: string;
  default_unit_name: string;
  is_active: number;
  sort_order: number;
}

interface ProgramGrade {
  id: number;
  category_id: number;
  name: string;
  description: string;
  price_modifier: number;
  is_active: number;
  sort_order: number;
}

interface ProgramAddon {
  id: number;
  category_id: number | null;
  name: string;
  price: number;
  is_active: number;
  sort_order: number;
}

interface TreatmentProgramAdminProps {
  onClose?: () => void;
}

function TreatmentProgramAdmin({ onClose }: TreatmentProgramAdminProps) {
  const [activeTab, setActiveTab] = useState<'categories' | 'grades' | 'addons'>('categories');
  const [categories, setCategories] = useState<ProgramCategory[]>([]);
  const [grades, setGrades] = useState<ProgramGrade[]>([]);
  const [addons, setAddons] = useState<ProgramAddon[]>([]);
  const [loading, setLoading] = useState(true);

  // 새 항목 입력 상태
  const [newCategory, setNewCategory] = useState({ name: '', icon: '💊', unit: '제' });
  const [newGrade, setNewGrade] = useState({ categoryId: 0, name: '', description: '', modifier: 1.0 });
  const [newAddon, setNewAddon] = useState({ categoryId: 0, name: '', price: 0 });

  // 데이터 로드
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [cats, grds, adds] = await Promise.all([
        query<ProgramCategory>('SELECT * FROM treatment_program_categories ORDER BY sort_order'),
        query<ProgramGrade>('SELECT * FROM treatment_program_grades ORDER BY category_id, sort_order'),
        query<ProgramAddon>('SELECT * FROM treatment_program_addons ORDER BY category_id, sort_order'),
      ]);
      setCategories(cats);
      setGrades(grds);
      setAddons(adds);
    } catch (error) {
      console.error('데이터 로드 오류:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 카테고리 추가
  const handleAddCategory = async () => {
    if (!newCategory.name.trim()) return;
    try {
      const maxOrder = Math.max(0, ...categories.map(c => c.sort_order)) + 1;
      await insert(`
        INSERT INTO treatment_program_categories (name, icon, default_unit_name, sort_order)
        VALUES (${escapeString(newCategory.name)}, ${escapeString(newCategory.icon)}, ${escapeString(newCategory.unit)}, ${maxOrder})
      `);
      setNewCategory({ name: '', icon: '💊', unit: '제' });
      loadData();
    } catch (error) {
      console.error('카테고리 추가 오류:', error);
    }
  };

  // 카테고리 삭제
  const handleDeleteCategory = async (id: number) => {
    if (!confirm('이 카테고리를 삭제하시겠습니까?\n관련된 등급과 추가옵션도 함께 삭제됩니다.')) return;
    try {
      await execute(`DELETE FROM treatment_program_grades WHERE category_id = ${id}`);
      await execute(`DELETE FROM treatment_program_addons WHERE category_id = ${id}`);
      await execute(`DELETE FROM treatment_program_categories WHERE id = ${id}`);
      loadData();
    } catch (error) {
      console.error('카테고리 삭제 오류:', error);
    }
  };

  // 등급 추가
  const handleAddGrade = async () => {
    if (!newGrade.name.trim() || !newGrade.categoryId) return;
    try {
      const catGrades = grades.filter(g => g.category_id === newGrade.categoryId);
      const maxOrder = Math.max(0, ...catGrades.map(g => g.sort_order)) + 1;
      await insert(`
        INSERT INTO treatment_program_grades (category_id, name, description, price_modifier, sort_order)
        VALUES (${newGrade.categoryId}, ${escapeString(newGrade.name)}, ${escapeString(newGrade.description)}, ${newGrade.modifier}, ${maxOrder})
      `);
      setNewGrade({ categoryId: newGrade.categoryId, name: '', description: '', modifier: 1.0 });
      loadData();
    } catch (error) {
      console.error('등급 추가 오류:', error);
    }
  };

  // 등급 삭제
  const handleDeleteGrade = async (id: number) => {
    if (!confirm('이 등급을 삭제하시겠습니까?')) return;
    try {
      await execute(`DELETE FROM treatment_program_grades WHERE id = ${id}`);
      loadData();
    } catch (error) {
      console.error('등급 삭제 오류:', error);
    }
  };

  // 추가옵션 추가
  const handleAddAddon = async () => {
    if (!newAddon.name.trim()) return;
    try {
      const catAddons = addons.filter(a => a.category_id === (newAddon.categoryId || null));
      const maxOrder = Math.max(0, ...catAddons.map(a => a.sort_order)) + 1;
      await insert(`
        INSERT INTO treatment_program_addons (category_id, name, price, sort_order)
        VALUES (${newAddon.categoryId || 'NULL'}, ${escapeString(newAddon.name)}, ${newAddon.price}, ${maxOrder})
      `);
      setNewAddon({ categoryId: newAddon.categoryId, name: '', price: 0 });
      loadData();
    } catch (error) {
      console.error('추가옵션 추가 오류:', error);
    }
  };

  // 추가옵션 삭제
  const handleDeleteAddon = async (id: number) => {
    if (!confirm('이 추가옵션을 삭제하시겠습니까?')) return;
    try {
      await execute(`DELETE FROM treatment_program_addons WHERE id = ${id}`);
      loadData();
    } catch (error) {
      console.error('추가옵션 삭제 오류:', error);
    }
  };

  // 카테고리 이름 가져오기
  const getCategoryName = (categoryId: number | null) => {
    if (!categoryId) return '전체';
    const cat = categories.find(c => c.id === categoryId);
    return cat ? `${cat.icon} ${cat.name}` : '알 수 없음';
  };

  if (loading) {
    return <div className="treatment-admin-loading">로딩 중...</div>;
  }

  return (
    <div className="treatment-admin">
      <div className="treatment-admin-header">
        <h2>치료 프로그램 설정</h2>
        {onClose && (
          <button className="treatment-admin-close" onClick={onClose}>×</button>
        )}
      </div>

      {/* 탭 */}
      <div className="treatment-admin-tabs">
        <button
          className={`treatment-admin-tab ${activeTab === 'categories' ? 'active' : ''}`}
          onClick={() => setActiveTab('categories')}
        >
          카테고리 ({categories.length})
        </button>
        <button
          className={`treatment-admin-tab ${activeTab === 'grades' ? 'active' : ''}`}
          onClick={() => setActiveTab('grades')}
        >
          등급 ({grades.length})
        </button>
        <button
          className={`treatment-admin-tab ${activeTab === 'addons' ? 'active' : ''}`}
          onClick={() => setActiveTab('addons')}
        >
          추가옵션 ({addons.length})
        </button>
      </div>

      <div className="treatment-admin-content">
        {/* 카테고리 탭 */}
        {activeTab === 'categories' && (
          <div className="treatment-admin-section">
            <div className="treatment-admin-form">
              <input
                type="text"
                placeholder="카테고리명 (예: 맞춤한약)"
                value={newCategory.name}
                onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
              />
              <input
                type="text"
                placeholder="아이콘"
                value={newCategory.icon}
                onChange={(e) => setNewCategory({ ...newCategory, icon: e.target.value })}
                style={{ width: '60px' }}
              />
              <input
                type="text"
                placeholder="단위 (제/회)"
                value={newCategory.unit}
                onChange={(e) => setNewCategory({ ...newCategory, unit: e.target.value })}
                style={{ width: '80px' }}
              />
              <button onClick={handleAddCategory}>추가</button>
            </div>
            <ul className="treatment-admin-list">
              {categories.map((cat) => (
                <li key={cat.id} className="treatment-admin-item">
                  <span className="item-icon">{cat.icon}</span>
                  <span className="item-name">{cat.name}</span>
                  <span className="item-meta">단위: {cat.default_unit_name}</span>
                  <button className="item-delete" onClick={() => handleDeleteCategory(cat.id)}>삭제</button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 등급 탭 */}
        {activeTab === 'grades' && (
          <div className="treatment-admin-section">
            <div className="treatment-admin-form">
              <select
                value={newGrade.categoryId}
                onChange={(e) => setNewGrade({ ...newGrade, categoryId: Number(e.target.value) })}
              >
                <option value={0}>카테고리 선택</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
                ))}
              </select>
              <input
                type="text"
                placeholder="등급명 (예: A등급)"
                value={newGrade.name}
                onChange={(e) => setNewGrade({ ...newGrade, name: e.target.value })}
              />
              <input
                type="text"
                placeholder="설명"
                value={newGrade.description}
                onChange={(e) => setNewGrade({ ...newGrade, description: e.target.value })}
              />
              <input
                type="number"
                placeholder="배율"
                value={newGrade.modifier}
                onChange={(e) => setNewGrade({ ...newGrade, modifier: parseFloat(e.target.value) || 1.0 })}
                step="0.1"
                style={{ width: '80px' }}
              />
              <button onClick={handleAddGrade}>추가</button>
            </div>
            <ul className="treatment-admin-list">
              {grades.map((grade) => (
                <li key={grade.id} className="treatment-admin-item">
                  <span className="item-category">{getCategoryName(grade.category_id)}</span>
                  <span className="item-name">{grade.name}</span>
                  <span className="item-meta">{grade.description} (x{grade.price_modifier})</span>
                  <button className="item-delete" onClick={() => handleDeleteGrade(grade.id)}>삭제</button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 추가옵션 탭 */}
        {activeTab === 'addons' && (
          <div className="treatment-admin-section">
            <div className="treatment-admin-form">
              <select
                value={newAddon.categoryId}
                onChange={(e) => setNewAddon({ ...newAddon, categoryId: Number(e.target.value) })}
              >
                <option value={0}>전체 적용</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
                ))}
              </select>
              <input
                type="text"
                placeholder="옵션명 (예: 녹용)"
                value={newAddon.name}
                onChange={(e) => setNewAddon({ ...newAddon, name: e.target.value })}
              />
              <input
                type="number"
                placeholder="가격"
                value={newAddon.price}
                onChange={(e) => setNewAddon({ ...newAddon, price: parseInt(e.target.value) || 0 })}
                style={{ width: '100px' }}
              />
              <button onClick={handleAddAddon}>추가</button>
            </div>
            <ul className="treatment-admin-list">
              {addons.map((addon) => (
                <li key={addon.id} className="treatment-admin-item">
                  <span className="item-category">{getCategoryName(addon.category_id)}</span>
                  <span className="item-name">{addon.name}</span>
                  <span className="item-meta">{addon.price.toLocaleString()}원</span>
                  <button className="item-delete" onClick={() => handleDeleteAddon(addon.id)}>삭제</button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

export default TreatmentProgramAdmin;
