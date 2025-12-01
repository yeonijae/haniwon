import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@shared/lib/supabase'

interface PrescriptionDefinition {
  id: number
  name: string
  alias?: string
  category?: string
  source?: string
  composition: string
  created_at: string
  created_by: string
  is_active: boolean
}

interface PrescriptionCategory {
  id: number
  name: string
  sort_order: number
}

// API 함수들
const prescriptionDefinitionsApi = {
  getAll: async (): Promise<PrescriptionDefinition[]> => {
    const { data, error } = await supabase
      .from('prescription_definitions')
      .select('*')
      .eq('is_active', true)
      .order('name', { ascending: true })

    if (error) throw new Error(error.message)
    return data || []
  },

  create: async (data: Partial<PrescriptionDefinition>): Promise<PrescriptionDefinition> => {
    const { data: result, error } = await supabase
      .from('prescription_definitions')
      .insert({
        name: data.name,
        alias: data.alias,
        category: data.category,
        source: data.source,
        composition: data.composition,
        created_by: data.created_by || '관리자',
        is_active: true,
        created_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) throw new Error(error.message)
    return result
  },

  update: async (id: number, data: Partial<PrescriptionDefinition>): Promise<PrescriptionDefinition> => {
    const { data: result, error } = await supabase
      .from('prescription_definitions')
      .update({
        name: data.name,
        alias: data.alias,
        category: data.category,
        source: data.source,
        composition: data.composition
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw new Error(error.message)
    return result
  },

  delete: async (id: number): Promise<void> => {
    const { error } = await supabase
      .from('prescription_definitions')
      .update({ is_active: false })
      .eq('id', id)

    if (error) throw new Error(error.message)
  }
}

const categoriesApi = {
  getAll: async (): Promise<PrescriptionCategory[]> => {
    const { data, error } = await supabase
      .from('prescription_categories')
      .select('*')
      .order('sort_order', { ascending: true })

    if (error) {
      console.warn('prescription_categories 테이블이 없거나 접근 불가:', error.message)
      return []
    }
    return data || []
  },

  create: async (name: string): Promise<PrescriptionCategory> => {
    const { data: maxOrder } = await supabase
      .from('prescription_categories')
      .select('sort_order')
      .order('sort_order', { ascending: false })
      .limit(1)
      .single()

    const newOrder = (maxOrder?.sort_order || 0) + 1

    const { data, error } = await supabase
      .from('prescription_categories')
      .insert({ name, sort_order: newOrder })
      .select()
      .single()

    if (error) throw new Error(error.message)
    return data
  },

  update: async (id: number, name: string): Promise<void> => {
    const { error } = await supabase
      .from('prescription_categories')
      .update({ name })
      .eq('id', id)

    if (error) throw new Error(error.message)
  },

  delete: async (id: number): Promise<void> => {
    const { error } = await supabase
      .from('prescription_categories')
      .delete()
      .eq('id', id)

    if (error) throw new Error(error.message)
  }
}

// 약재 구성 파싱 함수
const parseComposition = (composition: string): { herb: string; amount: string }[] => {
  if (!composition) return []

  return composition.split('/').map(item => {
    const [herb, amount] = item.split(':')
    return { herb: herb?.trim() || '', amount: amount?.trim() || '' }
  }).filter(item => item.herb)
}

function PrescriptionDefinitions() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [selectedPrescription, setSelectedPrescription] = useState<PrescriptionDefinition | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [editingCategory, setEditingCategory] = useState<PrescriptionCategory | null>(null)
  const [renameCategoryName, setRenameCategoryName] = useState('')
  const [formData, setFormData] = useState({
    name: '',
    alias: '',
    category: '',
    source: '',
    composition: ''
  })

  const { data: prescriptions, isLoading } = useQuery({
    queryKey: ['prescription-definitions'],
    queryFn: prescriptionDefinitionsApi.getAll
  })

  const { data: categories = [] } = useQuery({
    queryKey: ['prescription-categories'],
    queryFn: categoriesApi.getAll
  })

  // 처방에서 추출한 카테고리 목록 (DB 카테고리 + 처방에 있는 카테고리)
  const allCategories = useMemo(() => {
    const categorySet = new Set<string>()

    // DB 카테고리 추가
    categories.forEach(c => categorySet.add(c.name))

    // 처방에서 카테고리 추출
    prescriptions?.forEach(p => {
      if (p.category) categorySet.add(p.category)
    })

    return Array.from(categorySet).sort()
  }, [prescriptions, categories])

  // 검색 및 카테고리 필터링
  const filteredPrescriptions = useMemo(() => {
    if (!prescriptions) return []

    let filtered = prescriptions

    // 카테고리 필터
    if (selectedCategory === '__uncategorized__') {
      filtered = filtered.filter(p => !p.category)
    } else if (selectedCategory) {
      filtered = filtered.filter(p => p.category === selectedCategory)
    }

    // 검색 필터
    if (search.trim()) {
      const searchLower = search.toLowerCase()
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(searchLower) ||
        p.alias?.toLowerCase().includes(searchLower) ||
        p.composition.toLowerCase().includes(searchLower)
      )
    }

    return filtered
  }, [prescriptions, search, selectedCategory])

  const createMutation = useMutation({
    mutationFn: prescriptionDefinitionsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prescription-definitions'] })
      setShowAddModal(false)
      resetForm()
      alert('처방이 등록되었습니다.')
    },
    onError: (error: any) => {
      alert(error.message || '처방 등록에 실패했습니다.')
    }
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<PrescriptionDefinition> }) =>
      prescriptionDefinitionsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prescription-definitions'] })
      setShowEditModal(false)
      setSelectedPrescription(null)
      resetForm()
      alert('처방이 수정되었습니다.')
    },
    onError: (error: any) => {
      alert(error.message || '처방 수정에 실패했습니다.')
    }
  })

  const deleteMutation = useMutation({
    mutationFn: prescriptionDefinitionsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prescription-definitions'] })
      setSelectedPrescription(null)
      alert('처방이 삭제되었습니다.')
    },
    onError: (error: any) => {
      alert(error.message || '처방 삭제에 실패했습니다.')
    }
  })

  const createCategoryMutation = useMutation({
    mutationFn: categoriesApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prescription-categories'] })
      setNewCategoryName('')
      alert('카테고리가 추가되었습니다.')
    },
    onError: (error: any) => {
      alert(error.message || '카테고리 추가에 실패했습니다.')
    }
  })

  const updateCategoryMutation = useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) => categoriesApi.update(id, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prescription-categories'] })
      setEditingCategory(null)
      alert('카테고리가 수정되었습니다.')
    },
    onError: (error: any) => {
      alert(error.message || '카테고리 수정에 실패했습니다.')
    }
  })

  const deleteCategoryMutation = useMutation({
    mutationFn: categoriesApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prescription-categories'] })
      alert('카테고리가 삭제되었습니다.')
    },
    onError: (error: any) => {
      alert(error.message || '카테고리 삭제에 실패했습니다.')
    }
  })

  // 처방의 카테고리명 일괄 변경
  const renameCategoryMutation = useMutation({
    mutationFn: async ({ oldName, newName }: { oldName: string; newName: string }) => {
      const { error } = await supabase
        .from('prescription_definitions')
        .update({ category: newName })
        .eq('category', oldName)
        .eq('is_active', true)

      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prescription-definitions'] })
      setShowCategoryModal(false)
      setSelectedCategory(null)
      alert('카테고리 이름이 변경되었습니다.')
    },
    onError: (error: any) => {
      alert(error.message || '카테고리 이름 변경에 실패했습니다.')
    }
  })

  const resetForm = () => {
    setFormData({
      name: '',
      alias: '',
      category: '',
      source: '',
      composition: ''
    })
  }

  const handleAdd = () => {
    resetForm()
    setShowAddModal(true)
  }

  const handleEdit = (prescription: PrescriptionDefinition) => {
    setFormData({
      name: prescription.name,
      alias: prescription.alias || '',
      category: prescription.category || '',
      source: prescription.source || '',
      composition: prescription.composition
    })
    setSelectedPrescription(prescription)
    setShowEditModal(true)
  }

  const handleDelete = (id: number, name: string) => {
    if (confirm(`"${name}" 처방을 삭제하시겠습니까?`)) {
      deleteMutation.mutate(id)
    }
  }

  const handleSubmitAdd = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim()) {
      alert('처방명을 입력해주세요.')
      return
    }
    if (!formData.composition.trim()) {
      alert('약재 구성을 입력해주세요.')
      return
    }
    createMutation.mutate(formData)
  }

  const handleSubmitEdit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedPrescription) return
    if (!formData.name.trim()) {
      alert('처방명을 입력해주세요.')
      return
    }
    if (!formData.composition.trim()) {
      alert('약재 구성을 입력해주세요.')
      return
    }
    updateMutation.mutate({ id: selectedPrescription.id, data: formData })
  }

  const handleAddCategory = () => {
    if (!newCategoryName.trim()) {
      alert('카테고리명을 입력해주세요.')
      return
    }
    createCategoryMutation.mutate(newCategoryName.trim())
  }

  const handleDeleteCategory = (id: number, name: string) => {
    if (confirm(`"${name}" 카테고리를 삭제하시겠습니까?`)) {
      deleteCategoryMutation.mutate(id)
    }
  }

  return (
    <div className="h-full overflow-auto p-6">
      {/* 헤더 - 한 줄에 제목, 검색, 버튼들 */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-xl font-bold text-clinic-text-primary whitespace-nowrap">처방 정의</h2>

          {/* 검색 */}
          <div className="flex-1 max-w-md relative">
            <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"></i>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-clinic-secondary focus:border-transparent"
              placeholder="처방명, 별명, 약재로 검색..."
            />
          </div>

          {/* 버튼들 */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleAdd}
              className="px-4 py-2 bg-clinic-primary text-white rounded-lg hover:bg-blue-900 transition-colors whitespace-nowrap"
            >
              <i className="fa-solid fa-plus mr-2"></i>
              처방 추가
            </button>
            <button
              onClick={() => {
                if (selectedCategory && selectedCategory !== '__uncategorized__') {
                  setRenameCategoryName(selectedCategory)
                } else {
                  setRenameCategoryName('')
                }
                setShowCategoryModal(true)
              }}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors whitespace-nowrap"
            >
              <i className="fa-solid fa-tags mr-2"></i>
              카테고리 편집
            </button>
          </div>
        </div>
      </div>

      {/* 메인 컨텐츠 */}
      <div className="flex gap-6">
        {/* 왼쪽 사이드바 - 카테고리 */}
        <div className="w-48 flex-shrink-0">
          <div className="bg-white rounded-lg shadow-sm">
            <div className="px-4 py-3 border-b border-gray-200">
              <h3 className="font-semibold text-gray-700 text-sm">카테고리</h3>
            </div>
            <div className="p-2">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  selectedCategory === null
                    ? 'bg-clinic-primary text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                전체 ({prescriptions?.length || 0})
              </button>
              <button
                onClick={() => setSelectedCategory('__uncategorized__')}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  selectedCategory === '__uncategorized__'
                    ? 'bg-clinic-primary text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                (분류없음) ({prescriptions?.filter(p => !p.category).length || 0})
              </button>
              {allCategories.map((category) => {
                const count = prescriptions?.filter(p => p.category === category).length || 0
                return (
                  <button
                    key={category}
                    onClick={() => setSelectedCategory(category)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                      selectedCategory === category
                        ? 'bg-clinic-primary text-white'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {category} ({count})
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* 처방 목록 */}
        <div className="flex-1 bg-white rounded-lg shadow-sm">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-clinic-text-primary">
              {selectedCategory === '__uncategorized__' ? '(분류없음)' : selectedCategory ? selectedCategory : '전체'} ({filteredPrescriptions.length}개)
            </h3>
          </div>

          {isLoading ? (
            <div className="text-center py-12">
              <i className="fa-solid fa-spinner fa-spin text-2xl text-gray-400 mb-2"></i>
              <p className="text-gray-500">로딩 중...</p>
            </div>
          ) : filteredPrescriptions.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <i className="fa-solid fa-file-prescription text-4xl mb-2"></i>
              <p className="text-sm">
                {search ? '검색 결과가 없습니다' : '등록된 처방이 없습니다'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200 max-h-[calc(100vh-280px)] overflow-y-auto">
              {filteredPrescriptions.map((prescription) => (
                <div
                  key={prescription.id}
                  onClick={() => setSelectedPrescription(prescription)}
                  className={`px-6 py-4 cursor-pointer transition-colors ${
                    selectedPrescription?.id === prescription.id
                      ? 'bg-blue-50'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center">
                        <h4 className="font-semibold text-gray-900">{prescription.name}</h4>
                        {prescription.category && (
                          <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">
                            {prescription.category}
                          </span>
                        )}
                      </div>
                      {prescription.alias && (
                        <p className="text-sm text-gray-600 mt-1">{prescription.alias}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-1 truncate max-w-lg">
                        {prescription.composition}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2 ml-4">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleEdit(prescription)
                        }}
                        className="text-blue-500 hover:text-blue-700 p-1"
                        title="수정"
                      >
                        <i className="fa-solid fa-pen-to-square"></i>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDelete(prescription.id, prescription.name)
                        }}
                        className="text-red-500 hover:text-red-700 p-1"
                        title="삭제"
                      >
                        <i className="fa-solid fa-trash"></i>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 처방 상세 */}
        <div className="w-80 flex-shrink-0 bg-white rounded-lg shadow-sm">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-clinic-text-primary">처방 구성</h3>
          </div>

          {selectedPrescription ? (
            <div className="p-6">
              <div className="mb-4 pb-4 border-b border-gray-200">
                <h4 className="font-semibold text-lg text-gray-900 mb-2">
                  {selectedPrescription.name}
                </h4>
                {selectedPrescription.alias && (
                  <p className="text-sm text-gray-600">{selectedPrescription.alias}</p>
                )}
                {selectedPrescription.category && (
                  <p className="text-xs text-blue-600 mt-1">
                    <i className="fa-solid fa-tag mr-1"></i>
                    분류: {selectedPrescription.category}
                  </p>
                )}
                {selectedPrescription.source && (
                  <p className="text-xs text-gray-500 mt-1">
                    <i className="fa-solid fa-book mr-1"></i>
                    출전: {selectedPrescription.source}
                  </p>
                )}
              </div>

              {/* 약재 구성 */}
              <div>
                <h5 className="font-semibold text-gray-900 mb-3 flex items-center">
                  <i className="fa-solid fa-leaf text-green-600 mr-2"></i>
                  약재 구성 ({parseComposition(selectedPrescription.composition).length}종)
                </h5>
                {parseComposition(selectedPrescription.composition).length > 0 ? (
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {parseComposition(selectedPrescription.composition).map((item, index) => (
                      <div
                        key={index}
                        className="bg-gray-50 border border-gray-200 rounded p-2 flex items-center justify-between"
                      >
                        <span className="text-sm font-medium text-gray-900">{item.herb}</span>
                        <span className="text-xs text-gray-600 bg-white px-2 py-0.5 rounded border border-gray-200">
                          {item.amount}g
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-400">
                    <p className="text-sm">약재 구성 정보가 없습니다</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-12 text-center text-gray-400">
              <i className="fa-solid fa-hand-pointer text-4xl mb-2"></i>
              <p className="text-sm">처방을 선택하면</p>
              <p className="text-sm">구성 내용이 표시됩니다</p>
            </div>
          )}
        </div>
      </div>

      {/* 추가 모달 */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">처방 추가</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <i className="fa-solid fa-xmark text-xl"></i>
              </button>
            </div>
            <form onSubmit={handleSubmitAdd} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    처방명 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-clinic-secondary focus:border-transparent"
                    placeholder="예: 쌍화탕"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">별명</label>
                  <input
                    type="text"
                    value={formData.alias}
                    onChange={(e) => setFormData({ ...formData, alias: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-clinic-secondary focus:border-transparent"
                    placeholder="예: 雙和湯"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">분류</label>
                  <input
                    type="text"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-clinic-secondary focus:border-transparent"
                    placeholder="예: 보익제"
                    list="category-list"
                  />
                  <datalist id="category-list">
                    {allCategories.map(cat => (
                      <option key={cat} value={cat} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">출전</label>
                  <input
                    type="text"
                    value={formData.source}
                    onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-clinic-secondary focus:border-transparent"
                    placeholder="예: 동의보감"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  약재 구성 <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={formData.composition}
                  onChange={(e) => setFormData({ ...formData, composition: e.target.value })}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-clinic-secondary focus:border-transparent"
                  placeholder="약재명:용량/약재명:용량 형식으로 입력&#10;예: 백작약:6/숙지황:6/당귀:4/천궁:4"
                  required
                />
                <p className="mt-1 text-xs text-gray-500">
                  형식: 약재명:용량(g)/약재명:용량(g)/...
                </p>
              </div>
              <div className="flex justify-end space-x-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="px-6 py-2 bg-clinic-primary text-white rounded-lg hover:bg-blue-900 disabled:opacity-50"
                >
                  {createMutation.isPending ? '등록 중...' : '등록'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 수정 모달 */}
      {showEditModal && selectedPrescription && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">처방 수정</h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <i className="fa-solid fa-xmark text-xl"></i>
              </button>
            </div>
            <form onSubmit={handleSubmitEdit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    처방명 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-clinic-secondary focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">별명</label>
                  <input
                    type="text"
                    value={formData.alias}
                    onChange={(e) => setFormData({ ...formData, alias: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-clinic-secondary focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">분류</label>
                  <input
                    type="text"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-clinic-secondary focus:border-transparent"
                    list="category-list-edit"
                  />
                  <datalist id="category-list-edit">
                    {allCategories.map(cat => (
                      <option key={cat} value={cat} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">출전</label>
                  <input
                    type="text"
                    value={formData.source}
                    onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-clinic-secondary focus:border-transparent"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  약재 구성 <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={formData.composition}
                  onChange={(e) => setFormData({ ...formData, composition: e.target.value })}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-clinic-secondary focus:border-transparent"
                  required
                />
                <p className="mt-1 text-xs text-gray-500">
                  형식: 약재명:용량(g)/약재명:용량(g)/...
                </p>
              </div>
              <div className="flex justify-end space-x-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={updateMutation.isPending}
                  className="px-6 py-2 bg-clinic-primary text-white rounded-lg hover:bg-blue-900 disabled:opacity-50"
                >
                  {updateMutation.isPending ? '수정 중...' : '수정'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 카테고리 편집 모달 */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">카테고리 편집</h3>
              <button
                onClick={() => setShowCategoryModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <i className="fa-solid fa-xmark text-xl"></i>
              </button>
            </div>
            <div className="p-6">
              {/* 선택된 카테고리 이름 변경 */}
              {selectedCategory && selectedCategory !== '__uncategorized__' && (
                <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h4 className="text-sm font-semibold text-blue-900 mb-2">
                    <i className="fa-solid fa-pen-to-square mr-2"></i>
                    선택된 카테고리 이름 변경
                  </h4>
                  <p className="text-xs text-blue-700 mb-3">
                    "{selectedCategory}" 카테고리의 모든 처방({prescriptions?.filter(p => p.category === selectedCategory).length || 0}개)이 일괄 변경됩니다.
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={renameCategoryName}
                      onChange={(e) => setRenameCategoryName(e.target.value)}
                      className="flex-1 px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="새 카테고리 이름"
                    />
                    <button
                      onClick={() => {
                        if (!renameCategoryName.trim()) {
                          alert('새 카테고리 이름을 입력해주세요.')
                          return
                        }
                        if (renameCategoryName === selectedCategory) {
                          alert('현재 이름과 동일합니다.')
                          return
                        }
                        if (confirm(`"${selectedCategory}"을(를) "${renameCategoryName}"(으)로 변경하시겠습니까?`)) {
                          renameCategoryMutation.mutate({ oldName: selectedCategory, newName: renameCategoryName.trim() })
                        }
                      }}
                      disabled={renameCategoryMutation.isPending}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      {renameCategoryMutation.isPending ? '변경 중...' : '변경'}
                    </button>
                  </div>
                </div>
              )}

              {/* 새 카테고리 추가 */}
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-clinic-secondary focus:border-transparent"
                  placeholder="새 카테고리명"
                />
                <button
                  onClick={handleAddCategory}
                  disabled={createCategoryMutation.isPending}
                  className="px-4 py-2 bg-clinic-primary text-white rounded-lg hover:bg-blue-900 disabled:opacity-50"
                >
                  추가
                </button>
              </div>

              {/* 카테고리 목록 */}
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {categories.length === 0 ? (
                  <p className="text-center text-gray-400 py-4">등록된 카테고리가 없습니다</p>
                ) : (
                  categories.map((category) => (
                    <div
                      key={category.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      {editingCategory?.id === category.id ? (
                        <input
                          type="text"
                          value={editingCategory.name}
                          onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })}
                          className="flex-1 px-2 py-1 border border-gray-300 rounded mr-2"
                          autoFocus
                        />
                      ) : (
                        <span className="text-gray-700">{category.name}</span>
                      )}
                      <div className="flex items-center gap-2">
                        {editingCategory?.id === category.id ? (
                          <>
                            <button
                              onClick={() => updateCategoryMutation.mutate({ id: category.id, name: editingCategory.name })}
                              className="text-green-600 hover:text-green-800"
                            >
                              <i className="fa-solid fa-check"></i>
                            </button>
                            <button
                              onClick={() => setEditingCategory(null)}
                              className="text-gray-500 hover:text-gray-700"
                            >
                              <i className="fa-solid fa-xmark"></i>
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => setEditingCategory(category)}
                              className="text-blue-500 hover:text-blue-700"
                            >
                              <i className="fa-solid fa-pen"></i>
                            </button>
                            <button
                              onClick={() => handleDeleteCategory(category.id, category.name)}
                              className="text-red-500 hover:text-red-700"
                            >
                              <i className="fa-solid fa-trash"></i>
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="mt-4 pt-4 border-t">
                <p className="text-xs text-gray-500">
                  <i className="fa-solid fa-circle-info mr-1"></i>
                  처방에 사용된 카테고리는 자동으로 목록에 표시됩니다.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default PrescriptionDefinitions
