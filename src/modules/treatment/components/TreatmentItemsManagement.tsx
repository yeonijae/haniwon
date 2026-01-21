import React, { useState } from 'react';
import { TreatmentItem } from '../types';

interface TreatmentItemsManagementProps {
    treatmentItems: TreatmentItem[];
    addTreatmentItem: (item: Omit<TreatmentItem, 'id'>) => void;
    updateTreatmentItem: (id: number, item: Omit<TreatmentItem, 'id'>) => void;
    deleteTreatmentItem: (id: number) => void;
    reorderTreatmentItems: (items: TreatmentItem[]) => void;
    onNavigateBack?: () => void;
}

const TreatmentItemsManagement: React.FC<TreatmentItemsManagementProps> = ({
    treatmentItems,
    addTreatmentItem,
    updateTreatmentItem,
    deleteTreatmentItem,
    reorderTreatmentItems,
    onNavigateBack
}) => {
    const [editingItem, setEditingItem] = useState<TreatmentItem | null>(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [formData, setFormData] = useState({ name: '', defaultDuration: 30 });
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

    const handleAdd = () => {
        if (!formData.name.trim()) {
            alert('치료항목 이름을 입력해주세요.');
            return;
        }
        if (formData.defaultDuration <= 0) {
            alert('기본시간은 0보다 커야 합니다.');
            return;
        }
        addTreatmentItem({
            name: formData.name,
            defaultDuration: formData.defaultDuration,
            displayOrder: treatmentItems.length
        });
        setFormData({ name: '', defaultDuration: 30 });
        setShowAddModal(false);
    };

    const handleEdit = () => {
        if (!editingItem) return;
        if (!formData.name.trim()) {
            alert('치료항목 이름을 입력해주세요.');
            return;
        }
        if (formData.defaultDuration <= 0) {
            alert('기본시간은 0보다 커야 합니다.');
            return;
        }
        updateTreatmentItem(editingItem.id, {
            name: formData.name,
            defaultDuration: formData.defaultDuration,
            displayOrder: editingItem.displayOrder
        });
        setEditingItem(null);
        setFormData({ name: '', defaultDuration: 30 });
    };

    // 드래그앤드롭 핸들러
    const handleDragStart = (index: number) => {
        setDraggedIndex(index);
    };

    const handleDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
    };

    const handleDrop = (e: React.DragEvent, dropIndex: number) => {
        e.preventDefault();
        if (draggedIndex === null || draggedIndex === dropIndex) {
            setDraggedIndex(null);
            return;
        }

        const reorderedItems = [...treatmentItems];
        const [draggedItem] = reorderedItems.splice(draggedIndex, 1);
        reorderedItems.splice(dropIndex, 0, draggedItem);

        reorderTreatmentItems(reorderedItems);
        setDraggedIndex(null);
    };

    const handleDragEnd = () => {
        setDraggedIndex(null);
    };

    const handleDelete = (id: number) => {
        if (window.confirm('이 치료항목을 삭제하시겠습니까?')) {
            deleteTreatmentItem(id);
        }
    };

    const openEditModal = (item: TreatmentItem) => {
        setEditingItem(item);
        setFormData({ name: item.name, defaultDuration: item.defaultDuration });
    };

    const closeModal = () => {
        setEditingItem(null);
        setShowAddModal(false);
        setFormData({ name: '', defaultDuration: 30 });
    };

    return (
        <div className="flex flex-col h-full max-h-[80vh]">
            {/* 헤더 */}
            <div className="flex items-center justify-between p-4 border-b bg-gray-50">
                <div>
                    <h3 className="text-lg font-semibold">치료항목 관리</h3>
                    <p className="text-sm text-gray-600">치료 시 사용할 수 있는 치료항목과 기본시간을 설정합니다.</p>
                </div>
                {onNavigateBack && (
                    <button
                        onClick={onNavigateBack}
                        className="flex items-center justify-center w-10 h-10 rounded-lg text-gray-500 hover:bg-gray-200 transition-colors"
                        aria-label="닫기"
                    >
                        <i className="fa-solid fa-xmark text-xl"></i>
                    </button>
                )}
            </div>

            {/* 컨텐츠 */}
            <div className="flex-1 overflow-y-auto p-4">

                <button
                    onClick={() => setShowAddModal(true)}
                    className="mb-4 px-4 py-2 bg-clinic-primary text-white rounded-md hover:bg-opacity-90 transition-colors"
                >
                    <i className="fa-solid fa-plus mr-2"></i>
                    치료항목 추가
                </button>

                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-10">
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    치료항목명
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    기본시간 (분)
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    작업
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {treatmentItems.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-4 text-center text-gray-500">
                                        등록된 치료항목이 없습니다.
                                    </td>
                                </tr>
                            ) : (
                                treatmentItems.map((item, index) => (
                                    <tr
                                        key={item.id}
                                        draggable
                                        onDragStart={() => handleDragStart(index)}
                                        onDragOver={(e) => handleDragOver(e, index)}
                                        onDrop={(e) => handleDrop(e, index)}
                                        onDragEnd={handleDragEnd}
                                        className={`cursor-move transition-colors ${
                                            draggedIndex === index ? 'opacity-50 bg-gray-100' : 'hover:bg-gray-50'
                                        }`}
                                    >
                                        <td className="px-2 py-4 text-center text-gray-400">
                                            <i className="fa-solid fa-grip-vertical"></i>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                            {item.name}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {item.defaultDuration}분
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <button
                                                onClick={() => openEditModal(item)}
                                                className="text-clinic-secondary hover:text-clinic-secondary-dark mr-3"
                                            >
                                                <i className="fa-solid fa-edit"></i> 수정
                                            </button>
                                            <button
                                                onClick={() => handleDelete(item.id)}
                                                className="text-red-600 hover:text-red-900"
                                            >
                                                <i className="fa-solid fa-trash"></i> 삭제
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Add Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
                        <h3 className="text-xl font-semibold mb-4">치료항목 추가</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    치료항목명
                                </label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-clinic-secondary focus:border-clinic-secondary"
                                    placeholder="예: 침, 뜸, 부항"
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    기본시간 (분)
                                </label>
                                <input
                                    type="number"
                                    min="1"
                                    value={formData.defaultDuration}
                                    onChange={(e) => setFormData({ ...formData, defaultDuration: parseInt(e.target.value) || 0 })}
                                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-clinic-secondary focus:border-clinic-secondary"
                                />
                            </div>
                        </div>
                        <div className="flex justify-end space-x-2 mt-6">
                            <button
                                onClick={closeModal}
                                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
                            >
                                취소
                            </button>
                            <button
                                onClick={handleAdd}
                                className="px-4 py-2 bg-clinic-primary text-white rounded-md hover:bg-opacity-90 transition-colors"
                            >
                                추가
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {editingItem && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
                        <h3 className="text-xl font-semibold mb-4">치료항목 수정</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    치료항목명
                                </label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-clinic-secondary focus:border-clinic-secondary"
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    기본시간 (분)
                                </label>
                                <input
                                    type="number"
                                    min="1"
                                    value={formData.defaultDuration}
                                    onChange={(e) => setFormData({ ...formData, defaultDuration: parseInt(e.target.value) || 0 })}
                                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-clinic-secondary focus:border-clinic-secondary"
                                />
                            </div>
                        </div>
                        <div className="flex justify-end space-x-2 mt-6">
                            <button
                                onClick={closeModal}
                                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
                            >
                                취소
                            </button>
                            <button
                                onClick={handleEdit}
                                className="px-4 py-2 bg-clinic-primary text-white rounded-md hover:bg-opacity-90 transition-colors"
                            >
                                수정
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TreatmentItemsManagement;
