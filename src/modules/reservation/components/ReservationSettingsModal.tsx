import React, { useState, useEffect } from 'react';
import type { TreatmentItem, ReservationSettings } from '../types';

interface ReservationSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: ReservationSettings;
  onSave: (settings: ReservationSettings) => Promise<void>;
}

// 기본 설정값
const DEFAULT_SETTINGS: ReservationSettings = {
  treatmentItems: [
    // 기본진료
    { id: 'acup', name: '침', slots: 1, slotsInCompound: 1, category: '기본진료', isActive: true, sortOrder: 1 },
    { id: 'chuna', name: '추나', slots: 1, slotsInCompound: 1, category: '기본진료', isActive: true, sortOrder: 2 },
    { id: 'cup', name: '부항', slots: 1, slotsInCompound: 1, category: '기본진료', isActive: true, sortOrder: 3 },
    { id: 'moxa', name: '뜸', slots: 1, slotsInCompound: 1, category: '기본진료', isActive: true, sortOrder: 4 },
    { id: 'yakchim', name: '약침', slots: 1, slotsInCompound: 1, category: '기본진료', isActive: true, sortOrder: 5 },
    // 재초진
    { id: 'jaecho', name: '재초진', slots: 2, slotsInCompound: 1, category: '재초진', isActive: true, sortOrder: 10 },
    // 약상담
    { id: 'yakjaejin-visit', name: '약재진(내원)', slots: 3, slotsInCompound: 3, category: '약상담', isActive: true, sortOrder: 20 },
    { id: 'yakjaejin-phone', name: '약재진(전화)', slots: 1, slotsInCompound: 1, category: '약상담', isActive: true, sortOrder: 21 },
    { id: 'new-consult', name: '신규약상담', slots: 6, slotsInCompound: 6, category: '약상담', isActive: true, sortOrder: 22 },
    { id: 'yakchojin', name: '약초진', slots: 6, slotsInCompound: 6, category: '약상담', isActive: true, sortOrder: 23 },
  ],
  categories: ['기본진료', '재초진', '약상담', '특수진료'],
  maxSlotsPerReservation: 6,
  slotDurationMinutes: 10,
};

export const ReservationSettingsModal: React.FC<ReservationSettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSave,
}) => {
  const [localSettings, setLocalSettings] = useState<ReservationSettings>(settings);
  const [activeTab, setActiveTab] = useState<'items' | 'general'>('items');
  const [editingItem, setEditingItem] = useState<TreatmentItem | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [newCategory, setNewCategory] = useState('');

  useEffect(() => {
    if (isOpen) {
      setLocalSettings(settings);
    }
  }, [isOpen, settings]);

  if (!isOpen) return null;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(localSettings);
      onClose();
    } catch (err: any) {
      alert('저장 실패: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddItem = () => {
    const newItem: TreatmentItem = {
      id: `custom-${Date.now()}`,
      name: '',
      slots: 1,
      slotsInCompound: 1,
      category: localSettings.categories[0] || '기본진료',
      isActive: true,
      sortOrder: localSettings.treatmentItems.length + 1,
    };
    setEditingItem(newItem);
    setIsAddingNew(true);
  };

  const handleSaveItem = (item: TreatmentItem) => {
    if (!item.name.trim()) {
      alert('항목 이름을 입력해주세요.');
      return;
    }

    setLocalSettings(prev => {
      if (isAddingNew) {
        return {
          ...prev,
          treatmentItems: [...prev.treatmentItems, item],
        };
      } else {
        return {
          ...prev,
          treatmentItems: prev.treatmentItems.map(i =>
            i.id === item.id ? item : i
          ),
        };
      }
    });
    setEditingItem(null);
    setIsAddingNew(false);
  };

  const handleDeleteItem = (id: string) => {
    if (!confirm('이 항목을 삭제하시겠습니까?')) return;
    setLocalSettings(prev => ({
      ...prev,
      treatmentItems: prev.treatmentItems.filter(i => i.id !== id),
    }));
  };

  const handleToggleActive = (id: string) => {
    setLocalSettings(prev => ({
      ...prev,
      treatmentItems: prev.treatmentItems.map(i =>
        i.id === id ? { ...i, isActive: !i.isActive } : i
      ),
    }));
  };

  const handleAddCategory = () => {
    if (!newCategory.trim()) return;
    if (localSettings.categories.includes(newCategory.trim())) {
      alert('이미 존재하는 카테고리입니다.');
      return;
    }
    setLocalSettings(prev => ({
      ...prev,
      categories: [...prev.categories, newCategory.trim()],
    }));
    setNewCategory('');
  };

  const handleDeleteCategory = (category: string) => {
    const itemsInCategory = localSettings.treatmentItems.filter(i => i.category === category);
    if (itemsInCategory.length > 0) {
      alert(`이 카테고리에 ${itemsInCategory.length}개의 항목이 있습니다. 먼저 항목을 이동하거나 삭제해주세요.`);
      return;
    }
    setLocalSettings(prev => ({
      ...prev,
      categories: prev.categories.filter(c => c !== category),
    }));
  };

  // 카테고리별로 항목 그룹화
  const groupedItems = localSettings.categories.reduce((acc, category) => {
    acc[category] = localSettings.treatmentItems
      .filter(item => item.category === category)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    return acc;
  }, {} as Record<string, TreatmentItem[]>);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* 헤더 */}
        <div className="bg-clinic-primary text-white px-6 py-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold">
              <i className="fa-solid fa-gear mr-2"></i>
              예약 설정
            </h3>
            <p className="text-sm text-white/80">치료항목 및 시간 배정 관리</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center hover:bg-white/20 rounded-lg transition-colors"
          >
            <i className="fa-solid fa-xmark text-xl"></i>
          </button>
        </div>

        {/* 탭 */}
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab('items')}
            className={`flex-1 py-3 text-center font-medium transition-colors ${
              activeTab === 'items'
                ? 'text-clinic-primary border-b-2 border-clinic-primary bg-blue-50'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <i className="fa-solid fa-list mr-2"></i>
            치료 항목
          </button>
          <button
            onClick={() => setActiveTab('general')}
            className={`flex-1 py-3 text-center font-medium transition-colors ${
              activeTab === 'general'
                ? 'text-clinic-primary border-b-2 border-clinic-primary bg-blue-50'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <i className="fa-solid fa-sliders mr-2"></i>
            일반 설정
          </button>
        </div>

        {/* 내용 */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'items' && (
            <div className="space-y-6">
              {/* 항목 추가 버튼 */}
              <div className="flex justify-end">
                <button
                  onClick={handleAddItem}
                  className="px-4 py-2 bg-clinic-primary text-white rounded-lg hover:bg-clinic-primary/90 transition-colors"
                >
                  <i className="fa-solid fa-plus mr-2"></i>
                  새 항목 추가
                </button>
              </div>

              {/* 카테고리별 항목 목록 */}
              {localSettings.categories.map(category => (
                <div key={category} className="border rounded-lg overflow-hidden">
                  <div className="bg-gray-100 px-4 py-2 font-semibold text-gray-700 flex items-center justify-between">
                    <span>{category}</span>
                    <span className="text-sm text-gray-500">
                      {groupedItems[category]?.length || 0}개
                    </span>
                  </div>
                  <div className="divide-y">
                    {groupedItems[category]?.map(item => (
                      <div
                        key={item.id}
                        className={`px-4 py-3 flex items-center justify-between ${
                          !item.isActive ? 'bg-gray-50 opacity-60' : ''
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <button
                            onClick={() => handleToggleActive(item.id)}
                            className={`w-10 h-6 rounded-full transition-colors relative ${
                              item.isActive ? 'bg-green-500' : 'bg-gray-300'
                            }`}
                          >
                            <span
                              className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                                item.isActive ? 'right-1' : 'left-1'
                              }`}
                            />
                          </button>
                          <div>
                            <p className="font-medium">{item.name}</p>
                            <p className="text-sm text-gray-500">
                              단독: {item.slots}칸 | 복합: {item.slotsInCompound ?? item.slots}칸
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setEditingItem(item);
                              setIsAddingNew(false);
                            }}
                            className="p-2 text-gray-500 hover:text-clinic-primary hover:bg-gray-100 rounded-lg transition-colors"
                          >
                            <i className="fa-solid fa-pen"></i>
                          </button>
                          <button
                            onClick={() => handleDeleteItem(item.id)}
                            className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <i className="fa-solid fa-trash"></i>
                          </button>
                        </div>
                      </div>
                    ))}
                    {(!groupedItems[category] || groupedItems[category].length === 0) && (
                      <div className="px-4 py-6 text-center text-gray-400">
                        이 카테고리에 항목이 없습니다
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'general' && (
            <div className="space-y-6">
              {/* 카테고리 관리 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  카테고리 관리
                </label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {localSettings.categories.map(category => (
                    <span
                      key={category}
                      className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-full text-sm"
                    >
                      {category}
                      <button
                        onClick={() => handleDeleteCategory(category)}
                        className="text-gray-400 hover:text-red-500"
                      >
                        <i className="fa-solid fa-xmark"></i>
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    placeholder="새 카테고리 이름"
                    className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-clinic-primary focus:border-transparent"
                    onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
                  />
                  <button
                    onClick={handleAddCategory}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    추가
                  </button>
                </div>
              </div>

              {/* 최대 슬롯 수 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  예약 당 최대 슬롯 수
                </label>
                <input
                  type="number"
                  min="1"
                  max="12"
                  value={localSettings.maxSlotsPerReservation}
                  onChange={(e) => setLocalSettings(prev => ({
                    ...prev,
                    maxSlotsPerReservation: parseInt(e.target.value) || 6,
                  }))}
                  className="w-32 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-clinic-primary focus:border-transparent"
                />
                <p className="mt-1 text-sm text-gray-500">
                  하나의 예약이 차지할 수 있는 최대 슬롯 수입니다.
                </p>
              </div>

              {/* 슬롯 시간 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  슬롯 당 시간 (분)
                </label>
                <select
                  value={localSettings.slotDurationMinutes}
                  onChange={(e) => setLocalSettings(prev => ({
                    ...prev,
                    slotDurationMinutes: parseInt(e.target.value),
                  }))}
                  className="w-32 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-clinic-primary focus:border-transparent"
                >
                  <option value="5">5분</option>
                  <option value="10">10분</option>
                  <option value="15">15분</option>
                  <option value="20">20분</option>
                  <option value="30">30분</option>
                </select>
                <p className="mt-1 text-sm text-gray-500">
                  캘린더의 한 슬롯이 나타내는 시간입니다.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="border-t px-6 py-4 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-300 transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-6 py-2 bg-clinic-primary text-white font-medium rounded-lg hover:bg-clinic-primary/90 transition-colors disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <i className="fa-solid fa-spinner fa-spin mr-2"></i>
                저장 중...
              </>
            ) : (
              <>
                <i className="fa-solid fa-check mr-2"></i>
                저장
              </>
            )}
          </button>
        </div>
      </div>

      {/* 항목 편집 모달 */}
      {editingItem && (
        <ItemEditModal
          item={editingItem}
          categories={localSettings.categories}
          onSave={handleSaveItem}
          onClose={() => {
            setEditingItem(null);
            setIsAddingNew(false);
          }}
          isNew={isAddingNew}
        />
      )}
    </div>
  );
};

// 항목 편집 모달
const ItemEditModal: React.FC<{
  item: TreatmentItem;
  categories: string[];
  onSave: (item: TreatmentItem) => void;
  onClose: () => void;
  isNew: boolean;
}> = ({ item, categories, onSave, onClose, isNew }) => {
  const [localItem, setLocalItem] = useState(item);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="border-b px-6 py-4">
          <h4 className="text-lg font-bold">
            {isNew ? '새 치료 항목 추가' : '치료 항목 수정'}
          </h4>
        </div>
        <div className="p-6 space-y-4">
          {/* 이름 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              항목 이름 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={localItem.name}
              onChange={(e) => setLocalItem(prev => ({ ...prev, name: e.target.value }))}
              placeholder="예: 린다스페셜"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-clinic-primary focus:border-transparent"
              autoFocus
            />
          </div>

          {/* 카테고리 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              카테고리
            </label>
            <select
              value={localItem.category}
              onChange={(e) => setLocalItem(prev => ({ ...prev, category: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-clinic-primary focus:border-transparent"
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* 슬롯 수 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                단독 슬롯 수
              </label>
              <input
                type="number"
                min="1"
                max="12"
                value={localItem.slots}
                onChange={(e) => setLocalItem(prev => ({ ...prev, slots: parseInt(e.target.value) || 1 }))}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-clinic-primary focus:border-transparent"
              />
              <p className="mt-1 text-xs text-gray-500">이 항목만 선택했을 때</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                복합 슬롯 수
              </label>
              <input
                type="number"
                min="1"
                max="12"
                value={localItem.slotsInCompound ?? localItem.slots}
                onChange={(e) => setLocalItem(prev => ({ ...prev, slotsInCompound: parseInt(e.target.value) || 1 }))}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-clinic-primary focus:border-transparent"
              />
              <p className="mt-1 text-xs text-gray-500">다른 항목과 함께 선택 시</p>
            </div>
          </div>

          {/* 정렬 순서 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              정렬 순서
            </label>
            <input
              type="number"
              min="1"
              value={localItem.sortOrder}
              onChange={(e) => setLocalItem(prev => ({ ...prev, sortOrder: parseInt(e.target.value) || 1 }))}
              className="w-32 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-clinic-primary focus:border-transparent"
            />
          </div>
        </div>
        <div className="border-t px-6 py-4 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
          >
            취소
          </button>
          <button
            onClick={() => onSave(localItem)}
            className="px-4 py-2 bg-clinic-primary text-white rounded-lg hover:bg-clinic-primary/90 transition-colors"
          >
            {isNew ? '추가' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReservationSettingsModal;

// 기본 설정 export
export { DEFAULT_SETTINGS };
