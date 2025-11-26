import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { herbsApi, Herb } from '../api/herbs'

interface StockInModalProps {
  herb: Herb
  onClose: () => void
}

function StockInModal({ herb, onClose }: StockInModalProps) {
  const queryClient = useQueryClient()
  const [formData, setFormData] = useState({
    quantity: '',
    unitCost: herb.unit_cost.toString(),
    reason: '구매 입고',
    note: ''
  })

  const stockInMutation = useMutation({
    mutationFn: (data: any) => herbsApi.stockIn(herb.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['herbs'] })
      alert('입고 처리되었습니다.')
      onClose()
    },
    onError: (error: any) => {
      alert(error.message || '입고 처리에 실패했습니다.')
    }
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.quantity || parseFloat(formData.quantity) <= 0) {
      alert('입고 수량을 입력해주세요.')
      return
    }

    stockInMutation.mutate({
      quantity: parseFloat(formData.quantity),
      unitCost: parseFloat(formData.unitCost),
      reason: formData.reason,
      note: formData.note
    })
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  // description에서 한봉당 용량 추출
  const packageSizeMatch = herb.description?.match(/한봉당 용량: (\d+)g/)
  const packageSize = packageSizeMatch ? parseInt(packageSizeMatch[1]) : 0

  const handlePackageInput = () => {
    if (packageSize > 0) {
      const currentQty = parseFloat(formData.quantity) || 0
      setFormData({
        ...formData,
        quantity: (currentQty + packageSize).toString()
      })
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl">
        {/* Header */}
        <div className="bg-clinic-accent text-white px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">약재 입고</h2>
            <p className="text-sm mt-1">{herb.name}</p>
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
          {/* 현재 재고 정보 */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-gray-500 mb-1">현재 재고</p>
                <p className="text-lg font-bold text-clinic-text-primary">{herb.current_stock.toLocaleString()}g</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">거래처</p>
                <p className="text-lg font-semibold text-clinic-text-primary">{herb.origin || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">한봉당 용량</p>
                <p className="text-lg font-semibold text-clinic-text-primary">{packageSize > 0 ? `${packageSize}g` : '-'}</p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {/* 입고 수량 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                입고 수량 (g) <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  name="quantity"
                  value={formData.quantity}
                  onChange={handleChange}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-clinic-accent focus:border-transparent"
                  placeholder="0"
                  step="0.01"
                  min="0"
                  required
                />
                {packageSize > 0 && (
                  <button
                    type="button"
                    onClick={handlePackageInput}
                    className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors whitespace-nowrap"
                  >
                    +{packageSize}g
                  </button>
                )}
              </div>
              {packageSize > 0 && (
                <p className="text-sm text-gray-500 mt-1">
                  한 봉지({packageSize}g)씩 추가하려면 버튼을 클릭하세요
                </p>
              )}
            </div>

            {/* 단가 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                단가 (원/g)
              </label>
              <input
                type="number"
                name="unitCost"
                value={formData.unitCost}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-clinic-accent focus:border-transparent"
                step="0.01"
                min="0"
              />
              <p className="text-sm text-gray-500 mt-1">
                <i className="fa-solid fa-circle-info mr-1"></i>
                입력한 단가는 이력으로 저장되며, 약재의 현재 단가로 업데이트됩니다.
              </p>
            </div>

            {/* 입고 사유 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                입고 사유
              </label>
              <select
                name="reason"
                value={formData.reason}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-clinic-accent focus:border-transparent"
              >
                <option value="구매 입고">구매 입고</option>
                <option value="반품 입고">반품 입고</option>
                <option value="이동 입고">이동 입고</option>
                <option value="기타">기타</option>
              </select>
            </div>

            {/* 메모 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                메모
              </label>
              <textarea
                name="note"
                value={formData.note}
                onChange={handleChange}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-clinic-accent focus:border-transparent"
                placeholder="입고 관련 메모를 입력하세요"
              />
            </div>

            {/* 예상 재고 */}
            {formData.quantity && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-green-900">입고 후 예상 재고</span>
                  <span className="text-xl font-bold text-green-700">
                    {(herb.current_stock + parseFloat(formData.quantity)).toLocaleString()}g
                  </span>
                </div>
              </div>
            )}
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
              disabled={stockInMutation.isPending}
              className="px-6 py-2 bg-clinic-accent text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              {stockInMutation.isPending ? '처리 중...' : '입고 처리'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default StockInModal
