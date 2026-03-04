import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { createMedicineInventory } from '../../cs/lib/api'

interface NewMedicineFormProps {
  onSuccess: () => void
}

function NewMedicineForm({ onSuccess }: NewMedicineFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    current_stock: '0',
    accumulated_usage: '0',
    is_active: true,
    last_decoction_date: '',
    decoction_doses: '',
    decoction_packs: ''
  })

  const createMutation = useMutation({
    mutationFn: (data: {
      prescription_id: number | null
      name: string
      alias: string | null
      category: string
      total_stock: number
      current_stock: number
      doses_per_batch: number
      packs_per_batch: number
      unit: string
      is_active: boolean
      sort_order: number
      memo: string | null
      last_decoction_date: string | null
    }) => createMedicineInventory(data),
    onSuccess: () => {
      alert('상비약이 등록되었습니다.')
      onSuccess()
    },
    onError: (error: any) => {
      alert(error.message || '상비약 등록에 실패했습니다.')
    }
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name) {
      alert('상비약 이름은 필수 입력 항목입니다.')
      return
    }

    createMutation.mutate({
      prescription_id: null,
      name: formData.name,
      alias: null,
      category: formData.category || '상비약',
      total_stock: parseFloat(formData.accumulated_usage) || 0,
      current_stock: parseFloat(formData.current_stock) || 0,
      doses_per_batch: parseInt(formData.decoction_doses) || 20,
      packs_per_batch: parseInt(formData.decoction_packs) || 30,
      unit: '팩',
      is_active: formData.is_active,
      sort_order: 0,
      memo: null,
      last_decoction_date: formData.last_decoction_date || null,
    })
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target

    if (type === 'checkbox') {
      setFormData({
        ...formData,
        [name]: (e.target as HTMLInputElement).checked
      })
    } else {
      setFormData({
        ...formData,
        [name]: value
      })
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-2 gap-6">
        {/* 상비약 이름 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            상비약 이름 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-clinic-secondary focus:border-transparent"
            placeholder="예: 쌍화탕"
            required
          />
        </div>

        {/* 분류 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">분류</label>
          <input
            type="text"
            name="category"
            value={formData.category}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-clinic-secondary focus:border-transparent"
            placeholder="예: 탕전약, 환제 등"
          />
        </div>

        {/* 현재 재고 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">현재재고</label>
          <input
            type="number"
            name="current_stock"
            value={formData.current_stock}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-clinic-secondary focus:border-transparent"
            min="0"
          />
        </div>

        {/* 누적사용량 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">누적사용량</label>
          <input
            type="number"
            name="accumulated_usage"
            value={formData.accumulated_usage}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-clinic-secondary focus:border-transparent"
            min="0"
          />
        </div>

        {/* 사용여부 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">사용여부</label>
          <div className="flex items-center space-x-4 h-[42px]">
            <label className="inline-flex items-center cursor-pointer">
              <input
                type="radio"
                name="is_active"
                checked={formData.is_active === true}
                onChange={() => setFormData({ ...formData, is_active: true })}
                className="w-4 h-4 text-clinic-primary border-gray-300 focus:ring-clinic-secondary"
              />
              <span className="ml-2 text-sm text-gray-700">사용</span>
            </label>
            <label className="inline-flex items-center cursor-pointer">
              <input
                type="radio"
                name="is_active"
                checked={formData.is_active === false}
                onChange={() => setFormData({ ...formData, is_active: false })}
                className="w-4 h-4 text-clinic-primary border-gray-300 focus:ring-clinic-secondary"
              />
              <span className="ml-2 text-sm text-gray-700">미사용</span>
            </label>
          </div>
        </div>

        {/* 최근탕전일자 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">최근탕전일자</label>
          <input
            type="date"
            name="last_decoction_date"
            value={formData.last_decoction_date}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-clinic-secondary focus:border-transparent"
          />
        </div>

        {/* 탕전시-첩수 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">탕전시-첩수</label>
          <div className="relative">
            <input
              type="number"
              name="decoction_doses"
              value={formData.decoction_doses}
              onChange={handleChange}
              className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-clinic-secondary focus:border-transparent"
              placeholder="예: 10"
              min="0"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">첩</span>
          </div>
        </div>

        {/* 탕전시-팩수 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">탕전시-팩수</label>
          <div className="relative">
            <input
              type="number"
              name="decoction_packs"
              value={formData.decoction_packs}
              onChange={handleChange}
              className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-clinic-secondary focus:border-transparent"
              placeholder="예: 30"
              min="0"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">팩</span>
          </div>
        </div>
      </div>

      {/* 안내 문구 */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <div className="flex items-start">
          <i className="fa-solid fa-circle-info text-gray-400 mr-2 mt-0.5"></i>
          <p className="text-sm text-gray-600">
            입력한 값은 상비약 재고 테이블에 직접 저장됩니다. 탕전시 첩수/팩수는 입고 기본값으로 사용됩니다.
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
          {createMutation.isPending ? '등록 중...' : '상비약 등록'}
        </button>
      </div>
    </form>
  )
}

export default NewMedicineForm
