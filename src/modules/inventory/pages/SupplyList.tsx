import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { suppliesApi, SupplyRequest } from '../api/supplies'

function SupplyList() {
  const queryClient = useQueryClient()
  const [showAddForm, setShowAddForm] = useState(false)
  const [itemName, setItemName] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editItemName, setEditItemName] = useState('')

  const { data: supplies, isLoading } = useQuery({
    queryKey: ['supplies'],
    queryFn: () => suppliesApi.getAll()
  })

  const createMutation = useMutation({
    mutationFn: (data: Partial<SupplyRequest>) => suppliesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplies'] })
      setShowAddForm(false)
      setItemName('')
      alert('물품 요청이 등록되었습니다.')
    },
    onError: (error: any) => {
      alert(error.message || '물품 요청 등록에 실패했습니다.')
    }
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<SupplyRequest> }) =>
      suppliesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplies'] })
      setEditingId(null)
      alert('수정되었습니다.')
    },
    onError: (error: any) => {
      alert(error.message || '수정에 실패했습니다.')
    }
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      suppliesApi.toggleComplete(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplies'] })
    }
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => suppliesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplies'] })
      alert('물품 요청이 삭제되었습니다.')
    }
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!itemName.trim()) {
      alert('물품명을 입력해주세요.')
      return
    }
    createMutation.mutate({
      item_name: itemName,
      requested_by: '관리자'
    })
  }

  const handleEdit = (item: SupplyRequest) => {
    setEditingId(item.id)
    setEditItemName(item.item_name)
  }

  const handleUpdate = (id: number) => {
    if (!editItemName.trim()) {
      alert('물품명을 입력해주세요.')
      return
    }
    updateMutation.mutate({
      id,
      data: {
        item_name: editItemName
      }
    })
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditItemName('')
  }

  const handleToggle = (item: SupplyRequest) => {
    toggleMutation.mutate({ id: item.id, status: item.status })
  }

  const handleDelete = (id: number) => {
    if (confirm('정말 삭제하시겠습니까?')) {
      deleteMutation.mutate(id)
    }
  }

  const pendingItems = supplies?.filter(item => item.status === 'pending') || []
  const completedItems = supplies?.filter(item => item.status === 'completed') || []

  return (
    <div className="h-full overflow-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-clinic-text-primary mb-2">구입 요청</h2>
          <p className="text-clinic-text-secondary">필요한 물품을 요청하고 처리 상태를 관리합니다</p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-4 py-2 bg-clinic-primary text-white rounded-lg hover:bg-blue-900 transition-colors"
        >
          <i className="fa-solid fa-plus mr-2"></i>
          구입 요청
        </button>
      </div>

      {/* 구입 요청 폼 */}
      {showAddForm && (
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h3 className="text-lg font-semibold text-clinic-text-primary mb-4">새 구입 요청</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                내용 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-clinic-secondary focus:border-transparent"
                placeholder="예: 경근약침/현10바이알/11월27일(금)까지"
                autoFocus
                required
              />
              <p className="mt-2 text-xs text-gray-500">
                <i className="fa-solid fa-circle-info mr-1"></i>
                입력 형식: 물품명/규격/현재재고/요청수량/데드라인
              </p>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="px-6 py-2 bg-clinic-primary text-white rounded-lg hover:bg-blue-900 transition-colors disabled:opacity-50"
              >
                {createMutation.isPending ? '등록 중...' : '등록'}
              </button>
            </div>
          </form>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-12">
          <i className="fa-solid fa-spinner fa-spin text-2xl text-gray-400 mb-2"></i>
          <p className="text-gray-500">로딩 중...</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-6">
          {/* 요청 대기 */}
          <div className="bg-white rounded-lg shadow-sm">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center">
                <i className="fa-solid fa-clock text-yellow-500 mr-2"></i>
                <h3 className="text-lg font-semibold text-clinic-text-primary">
                  요청 대기 ({pendingItems.length})
                </h3>
              </div>
            </div>
            <div className="p-4 space-y-3 max-h-[600px] overflow-y-auto">
              {pendingItems.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <i className="fa-solid fa-inbox text-4xl mb-2"></i>
                  <p className="text-sm">대기 중인 요청이 없습니다</p>
                </div>
              ) : (
                pendingItems.map((item) => (
                  <div
                    key={item.id}
                    className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                  >
                    {editingId === item.id ? (
                      /* 편집 모드 */
                      <div className="space-y-2">
                        <textarea
                          value={editItemName}
                          onChange={(e) => setEditItemName(e.target.value)}
                          rows={3}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-clinic-secondary focus:border-transparent resize-none"
                          placeholder="내용을 입력하세요"
                          autoFocus
                        />
                        <div className="flex items-center justify-between">
                          <div className="flex items-center text-xs text-gray-500">
                            <i className="fa-solid fa-user mr-1"></i>
                            <span>{item.requested_by}</span>
                          </div>
                          <div className="flex space-x-2">
                            <button
                              onClick={handleCancelEdit}
                              className="px-3 py-1 text-xs border border-gray-300 text-gray-700 rounded hover:bg-gray-50"
                            >
                              취소
                            </button>
                            <button
                              onClick={() => handleUpdate(item.id)}
                              className="px-3 py-1 text-xs bg-clinic-secondary text-white rounded hover:bg-blue-700"
                            >
                              저장
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* 일반 모드 */
                      <>
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-start flex-1">
                            <button
                              onClick={() => handleToggle(item)}
                              className="mr-3 mt-1 w-5 h-5 border-2 border-gray-300 rounded hover:border-clinic-secondary transition-colors flex-shrink-0"
                            >
                              {toggleMutation.isPending ? (
                                <i className="fa-solid fa-spinner fa-spin text-xs text-gray-400"></i>
                              ) : null}
                            </button>
                            <div className="flex-1">
                              <h4 className="font-semibold text-gray-900">{item.item_name}</h4>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2 ml-2">
                            <button
                              onClick={() => handleEdit(item)}
                              className="text-blue-500 hover:text-blue-700"
                            >
                              <i className="fa-solid fa-pen-to-square text-sm"></i>
                            </button>
                            <button
                              onClick={() => handleDelete(item.id)}
                              className="text-red-500 hover:text-red-700"
                            >
                              <i className="fa-solid fa-trash text-sm"></i>
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center text-xs text-gray-500 mt-2">
                          <i className="fa-solid fa-user mr-1"></i>
                          <span>{item.requested_by}</span>
                          <span className="mx-2">•</span>
                          <i className="fa-solid fa-clock mr-1"></i>
                          <span>
                            {new Date(item.created_at).toLocaleString('ko-KR', {
                              year: '2-digit',
                              month: '2-digit',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 처리 완료 */}
          <div className="bg-white rounded-lg shadow-sm">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center">
                <i className="fa-solid fa-check-circle text-green-600 mr-2"></i>
                <h3 className="text-lg font-semibold text-clinic-text-primary">
                  처리 완료 ({completedItems.length})
                </h3>
              </div>
            </div>
            <div className="p-4 space-y-3 max-h-[600px] overflow-y-auto">
              {completedItems.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <i className="fa-solid fa-inbox text-4xl mb-2"></i>
                  <p className="text-sm">완료된 요청이 없습니다</p>
                </div>
              ) : (
                completedItems.map((item) => (
                  <div
                    key={item.id}
                    className="border border-gray-200 rounded-lg p-4 bg-gray-50"
                  >
                    {editingId === item.id ? (
                      /* 편집 모드 */
                      <div className="space-y-2">
                        <textarea
                          value={editItemName}
                          onChange={(e) => setEditItemName(e.target.value)}
                          rows={3}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-clinic-secondary focus:border-transparent resize-none"
                          placeholder="내용을 입력하세요"
                          autoFocus
                        />
                        <div className="flex items-center justify-between">
                          <div className="flex items-center text-xs text-gray-500">
                            <i className="fa-solid fa-user mr-1"></i>
                            <span>{item.requested_by}</span>
                          </div>
                          <div className="flex space-x-2">
                            <button
                              onClick={handleCancelEdit}
                              className="px-3 py-1 text-xs border border-gray-300 text-gray-700 rounded hover:bg-gray-50"
                            >
                              취소
                            </button>
                            <button
                              onClick={() => handleUpdate(item.id)}
                              className="px-3 py-1 text-xs bg-clinic-secondary text-white rounded hover:bg-blue-700"
                            >
                              저장
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* 일반 모드 */
                      <>
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-start flex-1">
                            <button
                              onClick={() => handleToggle(item)}
                              className="mr-3 mt-1 w-5 h-5 bg-green-600 border-2 border-green-600 rounded hover:bg-green-700 transition-colors flex-shrink-0 flex items-center justify-center"
                            >
                              <i className="fa-solid fa-check text-white text-xs"></i>
                            </button>
                            <div className="flex-1">
                              <h4 className="font-semibold text-gray-600 line-through">{item.item_name}</h4>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2 ml-2">
                            <button
                              onClick={() => handleEdit(item)}
                              className="text-blue-400 hover:text-blue-600"
                            >
                              <i className="fa-solid fa-pen-to-square text-sm"></i>
                            </button>
                            <button
                              onClick={() => handleDelete(item.id)}
                              className="text-red-400 hover:text-red-600"
                            >
                              <i className="fa-solid fa-trash text-sm"></i>
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center text-xs text-gray-400 mt-2">
                          <i className="fa-solid fa-user mr-1"></i>
                          <span>{item.requested_by}</span>
                          <span className="mx-2">•</span>
                          <i className="fa-solid fa-check-circle mr-1"></i>
                          <span>
                            {item.completed_at
                              ? new Date(item.completed_at).toLocaleString('ko-KR', {
                                  year: '2-digit',
                                  month: '2-digit',
                                  day: '2-digit',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })
                              : new Date(item.created_at).toLocaleString('ko-KR', {
                                  year: '2-digit',
                                  month: '2-digit',
                                  day: '2-digit',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })
                            }
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SupplyList
