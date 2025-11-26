import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { herbsApi } from '../api/herbs'

interface NewHerbFormProps {
  onSuccess: () => void
}

function NewHerbForm({ onSuccess }: NewHerbFormProps) {
  const queryClient = useQueryClient()
  const [formData, setFormData] = useState({
    name: '',
    origin: '',
    package_size: '',
    current_stock: '',
    min_stock: '',
    unit_cost: ''
  })

  const createMutation = useMutation({
    mutationFn: (data: any) => herbsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['herbs'] })
      alert('약재가 등록되었습니다.')
      onSuccess()
    },
    onError: (error: any) => {
      alert(error.message || '약재 등록에 실패했습니다.')
    }
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name || !formData.origin || !formData.package_size || !formData.current_stock || !formData.min_stock || !formData.unit_cost) {
      alert('모든 항목을 입력해주세요.')
      return
    }

    // 약재 코드 자동 생성 (타임스탬프 기반)
    const code = `H${Date.now().toString().slice(-8)}`

    createMutation.mutate({
      code,
      name: formData.name,
      origin: formData.origin,
      unit: 'g',
      current_stock: parseFloat(formData.current_stock),
      min_stock: parseFloat(formData.min_stock),
      unit_cost: parseFloat(formData.unit_cost),
      selling_price: 0,
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
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-2 gap-6">
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
            placeholder="예: 당귀"
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
            placeholder="예: OO약업사"
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
            placeholder="예: 300, 500, 600, 1000"
            step="1"
            min="0"
            required
          />
        </div>

        {/* 현재 재고 (g) */}
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
        </div>

        {/* 최소 재고 (g) */}
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
        </div>

        {/* 단가 (원/g) */}
        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            단가 (원/g) <span className="text-red-500">*</span>
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
            <i className="fa-solid fa-circle-info mr-1"></i>
            입고 시마다 단가 이력이 자동으로 저장됩니다. 한약 원가 계산 시 최근 단가가 사용됩니다.
          </p>
        </div>
      </div>

      {/* 버튼 */}
      <div className="flex justify-end space-x-3 pt-4 border-t">
        <button
          type="button"
          onClick={onSuccess}
          className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={createMutation.isPending}
          className="px-6 py-2 bg-clinic-primary text-white rounded-lg hover:bg-blue-900 transition-colors disabled:opacity-50"
        >
          {createMutation.isPending ? '등록 중...' : '약재 등록'}
        </button>
      </div>
    </form>
  )
}

export default NewHerbForm
