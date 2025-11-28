/**
 * 미디어 카테고리 관리 모달
 * - 카테고리 추가/수정/삭제
 * - 색상, 아이콘 설정
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export interface MediaCategory {
  id: string;
  slug: string;
  name: string;
  description?: string;
  color: string;
  icon: string;
  sort_order: number;
  is_system: boolean;
}

// 기본 카테고리 (DB 없을 때 fallback)
export const DEFAULT_CATEGORIES: MediaCategory[] = [
  { id: '1', slug: 'uncategorized', name: '미분류', color: '#6b7280', icon: 'fa-folder', sort_order: 0, is_system: true },
  { id: '2', slug: 'blog', name: '블로그', color: '#3b82f6', icon: 'fa-pen-fancy', sort_order: 1, is_system: true },
  { id: '3', slug: 'guide', name: '안내페이지', color: '#10b981', icon: 'fa-book-open', sort_order: 2, is_system: true },
  { id: '4', slug: 'landing', name: '랜딩페이지', color: '#8b5cf6', icon: 'fa-rocket', sort_order: 3, is_system: true },
  { id: '5', slug: 'event', name: '이벤트', color: '#f59e0b', icon: 'fa-gift', sort_order: 4, is_system: true },
  { id: '6', slug: 'product', name: '제품/치료', color: '#ec4899', icon: 'fa-pills', sort_order: 5, is_system: true },
  { id: '7', slug: 'clinic', name: '한의원', color: '#06b6d4', icon: 'fa-hospital', sort_order: 6, is_system: true },
  { id: '8', slug: 'icon', name: '아이콘/로고', color: '#6366f1', icon: 'fa-icons', sort_order: 7, is_system: true },
];

// 사용 가능한 아이콘 목록
const AVAILABLE_ICONS = [
  'fa-folder', 'fa-pen-fancy', 'fa-book-open', 'fa-rocket', 'fa-gift',
  'fa-pills', 'fa-hospital', 'fa-icons', 'fa-image', 'fa-camera',
  'fa-video', 'fa-file-image', 'fa-star', 'fa-heart', 'fa-tag',
  'fa-bookmark', 'fa-flag', 'fa-bell', 'fa-calendar', 'fa-users',
];

// 사용 가능한 색상 목록
const AVAILABLE_COLORS = [
  '#6b7280', '#ef4444', '#f97316', '#f59e0b', '#eab308',
  '#84cc16', '#22c55e', '#10b981', '#14b8a6', '#06b6d4',
  '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7',
  '#d946ef', '#ec4899', '#f43f5e',
];

interface MediaCategoryManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onCategoriesChange?: () => void;
}

export default function MediaCategoryManager({
  isOpen,
  onClose,
  onCategoriesChange,
}: MediaCategoryManagerProps) {
  const [categories, setCategories] = useState<MediaCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCategory, setEditingCategory] = useState<MediaCategory | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [saving, setSaving] = useState(false);

  // 폼 상태
  const [formName, setFormName] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [formColor, setFormColor] = useState('#6b7280');
  const [formIcon, setFormIcon] = useState('fa-folder');
  const [formDescription, setFormDescription] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadCategories();
    }
  }, [isOpen]);

  async function loadCategories() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('media_categories')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) {
        console.warn('카테고리 로드 실패, 기본값 사용:', error);
        setCategories(DEFAULT_CATEGORIES);
      } else {
        setCategories(data || DEFAULT_CATEGORIES);
      }
    } catch (error) {
      console.error('Failed to load categories:', error);
      setCategories(DEFAULT_CATEGORIES);
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setFormName('');
    setFormSlug('');
    setFormColor('#6b7280');
    setFormIcon('fa-folder');
    setFormDescription('');
    setEditingCategory(null);
    setIsCreating(false);
  }

  function handleCreate() {
    resetForm();
    setIsCreating(true);
  }

  function handleEdit(category: MediaCategory) {
    setFormName(category.name);
    setFormSlug(category.slug);
    setFormColor(category.color);
    setFormIcon(category.icon);
    setFormDescription(category.description || '');
    setEditingCategory(category);
    setIsCreating(false);
  }

  async function handleSave() {
    if (!formName.trim()) {
      alert('카테고리 이름을 입력해주세요.');
      return;
    }

    const slug = formSlug.trim() || formName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

    setSaving(true);
    try {
      if (isCreating) {
        // 새 카테고리 추가
        const maxOrder = Math.max(...categories.map((c) => c.sort_order), 0);
        const { error } = await supabase.from('media_categories').insert({
          slug,
          name: formName.trim(),
          color: formColor,
          icon: formIcon,
          description: formDescription.trim() || null,
          sort_order: maxOrder + 1,
          is_system: false,
        });

        if (error) throw error;
      } else if (editingCategory) {
        // 기존 카테고리 수정
        const { error } = await supabase
          .from('media_categories')
          .update({
            name: formName.trim(),
            color: formColor,
            icon: formIcon,
            description: formDescription.trim() || null,
          })
          .eq('id', editingCategory.id);

        if (error) throw error;
      }

      await loadCategories();
      resetForm();
      onCategoriesChange?.();
    } catch (error) {
      console.error('Save failed:', error);
      alert('저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(category: MediaCategory) {
    if (category.is_system) {
      alert('시스템 카테고리는 삭제할 수 없습니다.');
      return;
    }

    if (!confirm(`"${category.name}" 카테고리를 삭제하시겠습니까?\n이 카테고리의 이미지들은 "미분류"로 이동됩니다.`)) {
      return;
    }

    try {
      // 해당 카테고리의 이미지들을 미분류로 이동
      await supabase
        .from('media_files')
        .update({ category: 'uncategorized' })
        .eq('category', category.slug);

      // 카테고리 삭제
      const { error } = await supabase
        .from('media_categories')
        .delete()
        .eq('id', category.id);

      if (error) throw error;

      await loadCategories();
      resetForm();
      onCategoriesChange?.();
    } catch (error) {
      console.error('Delete failed:', error);
      alert('삭제에 실패했습니다.');
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative bg-white rounded-xl shadow-2xl w-[700px] max-h-[80vh] flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-xl font-bold text-gray-800">카테고리 관리</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <i className="fa-solid fa-xmark text-xl"></i>
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* 카테고리 목록 */}
          <div className="w-1/2 border-r overflow-y-auto">
            <div className="p-4">
              <button
                onClick={handleCreate}
                className="w-full px-4 py-2 bg-rose-500 text-white rounded-lg hover:bg-rose-600 transition-colors mb-4"
              >
                <i className="fa-solid fa-plus mr-2"></i>
                새 카테고리
              </button>

              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-rose-500"></div>
                </div>
              ) : (
                <div className="space-y-2">
                  {categories.map((category) => (
                    <div
                      key={category.id}
                      onClick={() => handleEdit(category)}
                      className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                        editingCategory?.id === category.id
                          ? 'bg-rose-50 border border-rose-200'
                          : 'hover:bg-gray-50 border border-transparent'
                      }`}
                    >
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: category.color + '20', color: category.color }}
                      >
                        <i className={`fa-solid ${category.icon}`}></i>
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-800">{category.name}</p>
                        <p className="text-xs text-gray-400">{category.slug}</p>
                      </div>
                      {category.is_system && (
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded">
                          시스템
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 편집 폼 */}
          <div className="w-1/2 p-4 overflow-y-auto">
            {isCreating || editingCategory ? (
              <div className="space-y-4">
                <h3 className="font-semibold text-gray-800">
                  {isCreating ? '새 카테고리' : '카테고리 수정'}
                </h3>

                {/* 이름 */}
                <div>
                  <label className="block text-sm text-gray-600 mb-1">이름 *</label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="카테고리 이름"
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>

                {/* 슬러그 (새로 만들 때만) */}
                {isCreating && (
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">
                      슬러그 <span className="text-gray-400">(자동 생성)</span>
                    </label>
                    <input
                      type="text"
                      value={formSlug}
                      onChange={(e) => setFormSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                      placeholder="category-slug"
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 font-mono text-sm"
                    />
                  </div>
                )}

                {/* 설명 */}
                <div>
                  <label className="block text-sm text-gray-600 mb-1">설명</label>
                  <input
                    type="text"
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="카테고리 설명 (선택사항)"
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>

                {/* 색상 */}
                <div>
                  <label className="block text-sm text-gray-600 mb-2">색상</label>
                  <div className="grid grid-cols-9 gap-2">
                    {AVAILABLE_COLORS.map((color) => (
                      <button
                        key={color}
                        onClick={() => setFormColor(color)}
                        className={`w-7 h-7 rounded-lg transition-transform ${
                          formColor === color ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : ''
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>

                {/* 아이콘 */}
                <div>
                  <label className="block text-sm text-gray-600 mb-2">아이콘</label>
                  <div className="grid grid-cols-10 gap-2">
                    {AVAILABLE_ICONS.map((icon) => (
                      <button
                        key={icon}
                        onClick={() => setFormIcon(icon)}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                          formIcon === icon
                            ? 'bg-rose-100 text-rose-600'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        <i className={`fa-solid ${icon}`}></i>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 미리보기 */}
                <div className="pt-4 border-t">
                  <label className="block text-sm text-gray-600 mb-2">미리보기</label>
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: formColor + '20', color: formColor }}
                    >
                      <i className={`fa-solid ${formIcon} text-lg`}></i>
                    </div>
                    <div>
                      <p className="font-medium text-gray-800">{formName || '카테고리 이름'}</p>
                      <p className="text-xs text-gray-400">
                        {formSlug || formName?.toLowerCase().replace(/\s+/g, '-') || 'slug'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 버튼 */}
                <div className="flex gap-2 pt-4">
                  <button
                    onClick={resetForm}
                    className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    취소
                  </button>
                  {editingCategory && !editingCategory.is_system && (
                    <button
                      onClick={() => handleDelete(editingCategory)}
                      className="px-4 py-2 text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                    >
                      삭제
                    </button>
                  )}
                  <button
                    onClick={handleSave}
                    disabled={saving || !formName.trim()}
                    className="flex-1 px-4 py-2 bg-rose-500 text-white rounded-lg hover:bg-rose-600 transition-colors disabled:opacity-50"
                  >
                    {saving ? '저장 중...' : '저장'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-gray-400">
                <i className="fa-solid fa-tag text-3xl mb-2"></i>
                <p className="text-sm">카테고리를 선택하거나</p>
                <p className="text-sm">새로 만드세요</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
