import React, { useState } from 'react';
import { ConsultationItem, ConsultationSubItem } from '../types';

interface ConsultationItemsManagementProps {
    consultationItems: ConsultationItem[];
    addConsultationItem: (name: string) => void;
    updateConsultationItem: (id: number, name: string) => void;
    deleteConsultationItem: (id: number) => void;
    reorderConsultationItems: (items: ConsultationItem[]) => void;
    addSubItem: (parentId: number, name: string) => void;
    updateSubItem: (parentId: number, subItemId: number, name: string) => void;
    deleteSubItem: (parentId: number, subItemId: number) => void;
    reorderSubItems: (parentId: number, subItems: ConsultationSubItem[]) => void;
}

const ConsultationItemsManagement: React.FC<ConsultationItemsManagementProps> = ({
    consultationItems,
    addConsultationItem,
    updateConsultationItem,
    deleteConsultationItem,
    reorderConsultationItems,
    addSubItem,
    updateSubItem,
    deleteSubItem,
    reorderSubItems,
}) => {
    const [showAddModal, setShowAddModal] = useState(false);
    const [showAddSubModal, setShowAddSubModal] = useState<number | null>(null);
    const [editingItem, setEditingItem] = useState<ConsultationItem | null>(null);
    const [editingSubItem, setEditingSubItem] = useState<{ parentId: number; subItem: ConsultationSubItem } | null>(null);
    const [formName, setFormName] = useState('');
    const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
    const [draggedSubIndex, setDraggedSubIndex] = useState<{ parentId: number; index: number } | null>(null);

    const toggleExpand = (itemId: number) => {
        setExpandedItems(prev => {
            const newSet = new Set(prev);
            if (newSet.has(itemId)) {
                newSet.delete(itemId);
            } else {
                newSet.add(itemId);
            }
            return newSet;
        });
    };

    const handleAddItem = () => {
        if (!formName.trim()) {
            alert('진료항목 이름을 입력해주세요.');
            return;
        }
        addConsultationItem(formName.trim());
        setFormName('');
        setShowAddModal(false);
    };

    const handleEditItem = () => {
        if (!editingItem || !formName.trim()) {
            alert('진료항목 이름을 입력해주세요.');
            return;
        }
        updateConsultationItem(editingItem.id, formName.trim());
        setEditingItem(null);
        setFormName('');
    };

    const handleDeleteItem = (id: number) => {
        if (window.confirm('이 진료항목과 모든 세부항목을 삭제하시겠습니까?')) {
            deleteConsultationItem(id);
        }
    };

    const handleAddSubItem = (parentId: number) => {
        if (!formName.trim()) {
            alert('세부항목 이름을 입력해주세요.');
            return;
        }
        addSubItem(parentId, formName.trim());
        setFormName('');
        setShowAddSubModal(null);
        // 자동으로 펼치기
        setExpandedItems(prev => new Set(prev).add(parentId));
    };

    const handleEditSubItem = () => {
        if (!editingSubItem || !formName.trim()) {
            alert('세부항목 이름을 입력해주세요.');
            return;
        }
        updateSubItem(editingSubItem.parentId, editingSubItem.subItem.id, formName.trim());
        setEditingSubItem(null);
        setFormName('');
    };

    const handleDeleteSubItem = (parentId: number, subItemId: number) => {
        if (window.confirm('이 세부항목을 삭제하시겠습니까?')) {
            deleteSubItem(parentId, subItemId);
        }
    };

    // 진료항목 드래그앤드롭
    const handleDragStart = (index: number) => {
        setDraggedIndex(index);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const handleDrop = (e: React.DragEvent, dropIndex: number) => {
        e.preventDefault();
        if (draggedIndex === null || draggedIndex === dropIndex) {
            setDraggedIndex(null);
            return;
        }

        const reordered = [...consultationItems];
        const [draggedItem] = reordered.splice(draggedIndex, 1);
        reordered.splice(dropIndex, 0, draggedItem);

        reorderConsultationItems(reordered);
        setDraggedIndex(null);
    };

    const handleDragEnd = () => {
        setDraggedIndex(null);
    };

    // 세부항목 드래그앤드롭
    const handleSubDragStart = (parentId: number, index: number) => {
        setDraggedSubIndex({ parentId, index });
    };

    const handleSubDrop = (e: React.DragEvent, parentId: number, dropIndex: number) => {
        e.preventDefault();
        if (!draggedSubIndex || draggedSubIndex.parentId !== parentId || draggedSubIndex.index === dropIndex) {
            setDraggedSubIndex(null);
            return;
        }

        const parent = consultationItems.find(i => i.id === parentId);
        if (!parent) {
            setDraggedSubIndex(null);
            return;
        }

        const reordered = [...parent.subItems];
        const [draggedItem] = reordered.splice(draggedSubIndex.index, 1);
        reordered.splice(dropIndex, 0, draggedItem);

        reorderSubItems(parentId, reordered);
        setDraggedSubIndex(null);
    };

    const handleSubDragEnd = () => {
        setDraggedSubIndex(null);
    };

    const closeModal = () => {
        setShowAddModal(false);
        setShowAddSubModal(null);
        setEditingItem(null);
        setEditingSubItem(null);
        setFormName('');
    };

    const openEditItemModal = (item: ConsultationItem) => {
        setEditingItem(item);
        setFormName(item.name);
    };

    const openEditSubItemModal = (parentId: number, subItem: ConsultationSubItem) => {
        setEditingSubItem({ parentId, subItem });
        setFormName(subItem.name);
    };

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold mb-2">진료항목 관리</h3>
                <p className="text-sm text-gray-600 mb-4">
                    환자 접수 시 선택할 수 있는 진료항목과 세부항목을 관리합니다.
                </p>

                <button
                    onClick={() => setShowAddModal(true)}
                    className="mb-4 px-4 py-2 bg-clinic-primary text-white rounded-md hover:bg-opacity-90 transition-colors"
                >
                    <i className="fa-solid fa-plus mr-2"></i>
                    진료항목 추가
                </button>

                <div className="space-y-2">
                    {consultationItems.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            등록된 진료항목이 없습니다.
                        </div>
                    ) : (
                        consultationItems.map((item, index) => (
                            <div
                                key={item.id}
                                draggable
                                onDragStart={() => handleDragStart(index)}
                                onDragOver={handleDragOver}
                                onDrop={(e) => handleDrop(e, index)}
                                onDragEnd={handleDragEnd}
                                className={`border rounded-lg ${
                                    draggedIndex === index ? 'opacity-50 bg-gray-100' : 'bg-white'
                                }`}
                            >
                                {/* 진료항목 헤더 */}
                                <div className="flex items-center justify-between p-3 cursor-move">
                                    <div className="flex items-center gap-3">
                                        <i className="fa-solid fa-grip-vertical text-gray-400"></i>
                                        <button
                                            onClick={() => toggleExpand(item.id)}
                                            className="text-gray-500 hover:text-gray-700"
                                        >
                                            <i className={`fa-solid ${expandedItems.has(item.id) ? 'fa-chevron-down' : 'fa-chevron-right'}`}></i>
                                        </button>
                                        <span className="font-medium text-gray-900">{item.name}</span>
                                        {item.subItems.length > 0 && (
                                            <span className="text-sm text-gray-500">
                                                ({item.subItems.length}개 세부항목)
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setShowAddSubModal(item.id);
                                            }}
                                            className="px-2 py-1 text-sm text-clinic-accent hover:bg-green-50 rounded"
                                            title="세부항목 추가"
                                        >
                                            <i className="fa-solid fa-plus mr-1"></i>세부
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                openEditItemModal(item);
                                            }}
                                            className="px-2 py-1 text-sm text-clinic-secondary hover:bg-blue-50 rounded"
                                        >
                                            <i className="fa-solid fa-edit"></i>
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteItem(item.id);
                                            }}
                                            className="px-2 py-1 text-sm text-red-600 hover:bg-red-50 rounded"
                                        >
                                            <i className="fa-solid fa-trash"></i>
                                        </button>
                                    </div>
                                </div>

                                {/* 세부항목 목록 */}
                                {expandedItems.has(item.id) && (
                                    <div className="border-t bg-gray-50 p-3">
                                        {item.subItems.length === 0 ? (
                                            <div className="text-sm text-gray-500 text-center py-2">
                                                세부항목이 없습니다.
                                            </div>
                                        ) : (
                                            <div className="space-y-1">
                                                {item.subItems.map((subItem, subIndex) => (
                                                    <div
                                                        key={subItem.id}
                                                        draggable
                                                        onDragStart={() => handleSubDragStart(item.id, subIndex)}
                                                        onDragOver={handleDragOver}
                                                        onDrop={(e) => handleSubDrop(e, item.id, subIndex)}
                                                        onDragEnd={handleSubDragEnd}
                                                        className={`flex items-center justify-between py-2 px-3 rounded cursor-move ${
                                                            draggedSubIndex?.parentId === item.id && draggedSubIndex?.index === subIndex
                                                                ? 'opacity-50 bg-gray-200'
                                                                : 'bg-white hover:bg-gray-100'
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <i className="fa-solid fa-grip-vertical text-gray-300 text-sm"></i>
                                                            <span className="text-sm text-gray-700">{subItem.name}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            <button
                                                                onClick={() => openEditSubItemModal(item.id, subItem)}
                                                                className="p-1 text-xs text-clinic-secondary hover:bg-blue-50 rounded"
                                                            >
                                                                <i className="fa-solid fa-edit"></i>
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteSubItem(item.id, subItem.id)}
                                                                className="p-1 text-xs text-red-600 hover:bg-red-50 rounded"
                                                            >
                                                                <i className="fa-solid fa-trash"></i>
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* 진료항목 추가 모달 */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
                        <h3 className="text-xl font-semibold mb-4">진료항목 추가</h3>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                진료항목명
                            </label>
                            <input
                                type="text"
                                value={formName}
                                onChange={(e) => setFormName(e.target.value)}
                                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-clinic-secondary focus:border-clinic-secondary"
                                placeholder="예: 침치료, 한약상담"
                                autoFocus
                                onKeyDown={(e) => e.key === 'Enter' && handleAddItem()}
                            />
                        </div>
                        <div className="flex justify-end space-x-2 mt-6">
                            <button
                                onClick={closeModal}
                                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
                            >
                                취소
                            </button>
                            <button
                                onClick={handleAddItem}
                                className="px-4 py-2 bg-clinic-primary text-white rounded-md hover:bg-opacity-90 transition-colors"
                            >
                                추가
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 진료항목 수정 모달 */}
            {editingItem && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
                        <h3 className="text-xl font-semibold mb-4">진료항목 수정</h3>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                진료항목명
                            </label>
                            <input
                                type="text"
                                value={formName}
                                onChange={(e) => setFormName(e.target.value)}
                                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-clinic-secondary focus:border-clinic-secondary"
                                autoFocus
                                onKeyDown={(e) => e.key === 'Enter' && handleEditItem()}
                            />
                        </div>
                        <div className="flex justify-end space-x-2 mt-6">
                            <button
                                onClick={closeModal}
                                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
                            >
                                취소
                            </button>
                            <button
                                onClick={handleEditItem}
                                className="px-4 py-2 bg-clinic-primary text-white rounded-md hover:bg-opacity-90 transition-colors"
                            >
                                수정
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 세부항목 추가 모달 */}
            {showAddSubModal !== null && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
                        <h3 className="text-xl font-semibold mb-4">
                            세부항목 추가
                            <span className="text-sm font-normal text-gray-500 ml-2">
                                ({consultationItems.find(i => i.id === showAddSubModal)?.name})
                            </span>
                        </h3>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                세부항목명
                            </label>
                            <input
                                type="text"
                                value={formName}
                                onChange={(e) => setFormName(e.target.value)}
                                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-clinic-secondary focus:border-clinic-secondary"
                                placeholder="예: 침, 약침, 물치"
                                autoFocus
                                onKeyDown={(e) => e.key === 'Enter' && handleAddSubItem(showAddSubModal)}
                            />
                        </div>
                        <div className="flex justify-end space-x-2 mt-6">
                            <button
                                onClick={closeModal}
                                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
                            >
                                취소
                            </button>
                            <button
                                onClick={() => handleAddSubItem(showAddSubModal)}
                                className="px-4 py-2 bg-clinic-primary text-white rounded-md hover:bg-opacity-90 transition-colors"
                            >
                                추가
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 세부항목 수정 모달 */}
            {editingSubItem && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
                        <h3 className="text-xl font-semibold mb-4">세부항목 수정</h3>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                세부항목명
                            </label>
                            <input
                                type="text"
                                value={formName}
                                onChange={(e) => setFormName(e.target.value)}
                                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-clinic-secondary focus:border-clinic-secondary"
                                autoFocus
                                onKeyDown={(e) => e.key === 'Enter' && handleEditSubItem()}
                            />
                        </div>
                        <div className="flex justify-end space-x-2 mt-6">
                            <button
                                onClick={closeModal}
                                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
                            >
                                취소
                            </button>
                            <button
                                onClick={handleEditSubItem}
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

export default ConsultationItemsManagement;
