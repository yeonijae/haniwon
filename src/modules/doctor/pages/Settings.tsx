/**
 * Doctor Settings Page
 * 진료관리 설정 - 치료 프로그램 관리
 */

import { useState, useEffect, useCallback } from 'react';
import { query, execute, insert, escapeString } from '@shared/lib/postgres';
import type { TreatmentProgram } from '../types';

const Settings: React.FC = () => {
  const [programs, setPrograms] = useState<TreatmentProgram[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  // 폼 상태
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    duration: 30,
    price: 0,
  });

  // 치료 프로그램 목록 로드
  const loadPrograms = useCallback(async () => {
    try {
      const data = await query<TreatmentProgram>(`
        SELECT * FROM treatment_items
        WHERE is_active = 1
        ORDER BY display_order ASC, name ASC
      `);
      setPrograms(data);
    } catch (error) {
      console.error('치료 프로그램 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPrograms();
  }, [loadPrograms]);

  // 폼 초기화
  const resetForm = () => {
    setFormData({ name: '', category: '', duration: 30, price: 0 });
    setEditingId(null);
    setShowAddForm(false);
  };

  // 프로그램 추가
  const handleAdd = async () => {
    if (!formData.name.trim()) {
      alert('프로그램명을 입력해주세요.');
      return;
    }

    try {
      const maxOrder = programs.length > 0
        ? Math.max(...programs.map(p => p.display_order)) + 1
        : 0;

      await insert(`
        INSERT INTO treatment_items (name, category, duration, price, is_active, display_order)
        VALUES (${escapeString(formData.name)}, ${escapeString(formData.category)}, ${formData.duration}, ${formData.price}, 1, ${maxOrder})
      `);

      await loadPrograms();
      resetForm();
    } catch (error) {
      console.error('프로그램 추가 실패:', error);
      alert('프로그램 추가에 실패했습니다.');
    }
  };

  // 프로그램 수정
  const handleUpdate = async () => {
    if (!editingId || !formData.name.trim()) return;

    try {
      await execute(`
        UPDATE treatment_items
        SET name = ${escapeString(formData.name)},
            category = ${escapeString(formData.category)},
            duration = ${formData.duration},
            price = ${formData.price},
            updated_at = NOW()
        WHERE id = ${editingId}
      `);

      await loadPrograms();
      resetForm();
    } catch (error) {
      console.error('프로그램 수정 실패:', error);
      alert('프로그램 수정에 실패했습니다.');
    }
  };

  // 프로그램 삭제 (soft delete)
  const handleDelete = async (id: number) => {
    if (!confirm('이 치료 프로그램을 삭제하시겠습니까?')) return;

    try {
      await execute(`
        UPDATE treatment_items
        SET is_active = 0, updated_at = NOW()
        WHERE id = ${id}
      `);

      await loadPrograms();
    } catch (error) {
      console.error('프로그램 삭제 실패:', error);
      alert('프로그램 삭제에 실패했습니다.');
    }
  };

  // 수정 모드 시작
  const startEdit = (program: TreatmentProgram) => {
    setEditingId(program.id);
    setFormData({
      name: program.name,
      category: program.category || '',
      duration: program.duration,
      price: program.price,
    });
    setShowAddForm(false);
  };

  // 순서 변경
  const handleMoveOrder = async (id: number, direction: 'up' | 'down') => {
    const currentIndex = programs.findIndex(p => p.id === id);
    if (currentIndex === -1) return;

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= programs.length) return;

    const current = programs[currentIndex];
    const target = programs[targetIndex];

    try {
      await execute(`
        UPDATE treatment_items SET display_order = ${target.display_order} WHERE id = ${current.id}
      `);
      await execute(`
        UPDATE treatment_items SET display_order = ${current.display_order} WHERE id = ${target.id}
      `);

      await loadPrograms();
    } catch (error) {
      console.error('순서 변경 실패:', error);
    }
  };

  // 금액 포맷
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('ko-KR').format(price);
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="border-4 border-gray-200 border-t-clinic-primary rounded-full w-12 h-12 animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500">설정을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* 헤더 */}
      <div className="flex-shrink-0 bg-white border-b px-6 py-4">
        <h1 className="text-xl font-bold text-gray-800">설정</h1>
        <p className="text-sm text-gray-500 mt-1">진료관리 시스템 설정</p>
      </div>

      {/* 컨텐츠 */}
      <div className="flex-1 overflow-auto p-6">
        {/* 치료 프로그램 관리 섹션 */}
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="px-6 py-4 border-b flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-800">치료 프로그램 관리</h2>
              <p className="text-sm text-gray-500 mt-0.5">새 진료 시작 시 선택할 수 있는 치료 프로그램을 관리합니다.</p>
            </div>
            <button
              onClick={() => {
                resetForm();
                setShowAddForm(true);
              }}
              className="px-4 py-2 bg-clinic-primary text-white rounded-lg hover:bg-clinic-primary/90 transition-colors flex items-center gap-2"
            >
              <i className="fas fa-plus"></i>
              프로그램 추가
            </button>
          </div>

          {/* 추가/수정 폼 */}
          {(showAddForm || editingId) && (
            <div className="px-6 py-4 bg-blue-50 border-b">
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    프로그램명 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-clinic-primary focus:border-clinic-primary"
                    placeholder="예: 침"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">분류</label>
                  <input
                    type="text"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-clinic-primary focus:border-clinic-primary"
                    placeholder="예: 한방치료"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">소요시간 (분)</label>
                  <input
                    type="number"
                    value={formData.duration}
                    onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-clinic-primary focus:border-clinic-primary"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">가격 (원)</label>
                  <input
                    type="number"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-clinic-primary focus:border-clinic-primary"
                    min="0"
                    step="1000"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button
                  onClick={resetForm}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={editingId ? handleUpdate : handleAdd}
                  className="px-4 py-2 bg-clinic-primary text-white rounded-lg hover:bg-clinic-primary/90 transition-colors"
                >
                  {editingId ? '수정' : '추가'}
                </button>
              </div>
            </div>
          )}

          {/* 프로그램 목록 */}
          <div className="divide-y">
            {programs.length === 0 ? (
              <div className="px-6 py-12 text-center text-gray-500">
                <i className="fas fa-folder-open text-4xl mb-3 text-gray-300"></i>
                <p>등록된 치료 프로그램이 없습니다.</p>
                <p className="text-sm mt-1">위의 "프로그램 추가" 버튼을 클릭하여 추가해주세요.</p>
              </div>
            ) : (
              programs.map((program, index) => (
                <div
                  key={program.id}
                  className={`px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors ${
                    editingId === program.id ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="flex items-center gap-4">
                    {/* 순서 변경 버튼 */}
                    <div className="flex flex-col gap-0.5">
                      <button
                        onClick={() => handleMoveOrder(program.id, 'up')}
                        disabled={index === 0}
                        className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <i className="fas fa-chevron-up text-xs"></i>
                      </button>
                      <button
                        onClick={() => handleMoveOrder(program.id, 'down')}
                        disabled={index === programs.length - 1}
                        className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <i className="fas fa-chevron-down text-xs"></i>
                      </button>
                    </div>

                    {/* 프로그램 정보 */}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-800">{program.name}</span>
                        {program.category && (
                          <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                            {program.category}
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-500 mt-0.5">
                        {program.duration}분 · ₩{formatPrice(program.price)}
                      </div>
                    </div>
                  </div>

                  {/* 액션 버튼 */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => startEdit(program)}
                      className="p-2 text-gray-400 hover:text-clinic-primary hover:bg-clinic-primary/10 rounded-lg transition-colors"
                      title="수정"
                    >
                      <i className="fas fa-pen"></i>
                    </button>
                    <button
                      onClick={() => handleDelete(program.id)}
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="삭제"
                    >
                      <i className="fas fa-trash"></i>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
