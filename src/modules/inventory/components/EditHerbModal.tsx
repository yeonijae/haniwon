import { useState, useEffect } from 'react'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { herbsApi, Herb } from '../api/herbs'

interface EditHerbModalProps {
  herb: Herb
  onClose: () => void
}

function EditHerbModal({ herb, onClose }: EditHerbModalProps) {
  const queryClient = useQueryClient()

  // description에서 한봉당 용량 추출
  const packageSizeMatch = herb.description?.match(/한봉당 용량: (\d+)g/)
  const initialPackageSize = packageSizeMatch ? packageSizeMatch[1] : ''

  const [formData, setFormData] = useState({
    name: herb.name,
    origin: herb.origin || '',
    package_size: initialPackageSize,
    current_stock: herb.current_stock.toString(),
    min_stock: herb.min_stock.toString(),
    unit_cost: herb.unit_cost.toString()
  })

  // 단가 이력 조회
  const { data: priceHistory } = useQuery({
    queryKey: ['herbs', herb.id, 'price-history'],
    queryFn: () => herbsApi.getPriceHistory(herb.id, 5)
  })

  const updateMutation = useMutation({
    mutationFn: (data: Partial<Herb>) => herbsApi.update(herb.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['herbs'] })
      alert('약재 정보가 수정되었습니다.')
      onClose()
    },
    onError: (error: any) => {
      alert(error.message || '약재 수정에 실패했습니다.')
    }
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name || !formData.origin || !formData.package_size || !formData.current_stock || !formData.min_stock || !formData.unit_cost) {
      alert('모든 항목을 입력해주세요.')
      return
    }

    updateMutation.mutate({
      name: formData.name,
      origin: formData.origin,
      current_stock: parseFloat(formData.current_stock),
      min_stock: parseFloat(formData.min_stock),
      unit_cost: parseFloat(formData.unit_cost),
      description: `한봉당 용량: ${formData.package_size}g`
    })
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl">
        {/* Header */}
        <div className="bg-clinic-secondary text-white px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">약재 정보 수정</h2>
            <p className="text-sm mt-1">{herb.code}</p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-200 transition-colors"
          >
            <i className="fa-solid fa-xmark text-2xl"></i>
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-4">
            {/* 약재명 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                약재명 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-clinic-secondary focus:border-transparent"
                placeholder="약재명을 입력하세요"
                required
              />
            </div>

            {/* 거래처 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                거래처 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="origin"
                value={formData.origin}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-clinic-secondary focus:border-transparent"
                placeholder="거래처를 입력하세요"
                required
              />
            </div>

            {/* 한봉당 용량 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                한봉당 용량 (g) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                name="package_size"
                value={formData.package_size}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-clinic-secondary focus:border-transparent"
                placeholder="300, 500, 600, 1000 등"
                step="1"
                min="0"
                required
              />
              <p className="text-sm text-gray-500 mt-1">
                일반적으로 300g, 500g, 600g, 1000g 단위입니다.
              </p>
            </div>

            {/* 현재 재고 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                현재 재고 (g) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                name="current_stock"
                value={formData.current_stock}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-clinic-secondary focus:border-transparent"
                placeholder="0"
                step="0.01"
                min="0"
                required
              />
              <p className="text-sm text-gray-500 mt-1">
                현재 보유하고 있는 재고량을 입력하세요.
              </p>
            </div>

            {/* 최소 재고 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                최소 재고 (g) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                name="min_stock"
                value={formData.min_stock}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-clinic-secondary focus:border-transparent"
                placeholder="0"
                step="0.01"
                min="0"
                required
              />
              <p className="text-sm text-gray-500 mt-1">
                재고가 이 값 이하로 떨어지면 알림이 표시됩니다.
              </p>
            </div>

            {/* 단가 */}
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                현재 단가 (원/g) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                name="unit_cost"
                value={formData.unit_cost}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-clinic-secondary focus:border-transparent"
                placeholder="0"
                step="0.01"
                min="0"
                required
              />
              <p className="text-sm text-gray-500 mt-1">
                입고 시마다 단가가 자동으로 업데이트됩니다. 아래 단가 이력을 참고하세요.
              </p>

              {/* 단가 이력 */}
              {priceHistory && priceHistory.length > 0 && (
                <div className="mt-4 border border-gray-200 rounded-lg overflow-hidden">
                  <div className="bg-gray-50 px-3 py-2 border-b border-gray-200">
                    <p className="text-xs font-medium text-gray-700">
                      <i className="fa-solid fa-clock-rotate-left mr-1"></i>
                      최근 단가 이력 (입고 기준)
                    </p>
                  </div>
                  <div className="max-h-32 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-3 py-1 text-left text-gray-500 font-medium">입고일시</th>
                          <th className="px-3 py-1 text-left text-gray-500 font-medium">단가</th>
                          <th className="px-3 py-1 text-left text-gray-500 font-medium">입고량</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {priceHistory.map((log: any) => (
                          <tr key={log.id} className="hover:bg-gray-50">
                            <td className="px-3 py-1 text-gray-600">
                              {new Date(log.created_at).toLocaleDateString('ko-KR', {
                                year: '2-digit',
                                month: '2-digit',
                                day: '2-digit'
                              })}
                            </td>
                            <td className="px-3 py-1 font-medium text-gray-900">
                              {log.unit_cost?.toLocaleString()}원/g
                            </td>
                            <td className="px-3 py-1 text-gray-600">
                              {log.quantity?.toLocaleString()}g
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 버튼 */}
          <div className="flex justify-end space-x-3 pt-6 border-t mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="px-6 py-2 bg-clinic-secondary text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {updateMutation.isPending ? '저장 중...' : '수정 완료'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default EditHerbModal
