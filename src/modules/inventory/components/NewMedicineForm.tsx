import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { medicinesApi } from '../api/medicines'

interface NewMedicineFormProps {
  onSuccess: () => void
}

function NewMedicineForm({ onSuccess }: NewMedicineFormProps) {
  const queryClient = useQueryClient()
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    manufacturer: '',
    category: '',
    unit: 'box',
    current_stock: '0',
    min_stock: '0',
    unit_cost: '0',
    selling_price: '0',
    expiry_date: '',
    storage_location: '',
    description: ''
  })

  const createMutation = useMutation({
    mutationFn: (data: any) => medicinesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['medicines'] })
      alert('상비약이 등록되었습니다.')
      onSuccess()
    },
    onError: (error: any) => {
      alert(error.response?.data?.error || '상비약 등록에 실패했습니다.')
    }
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.code || !formData.name) {
      alert('상비약 코드와 이름은 필수 입력 항목입니다.')
      return
    }

    createMutation.mutate({
      ...formData,
      current_stock: parseFloat(formData.current_stock) || 0,
      min_stock: parseFloat(formData.min_stock) || 0,
      unit_cost: parseFloat(formData.unit_cost) || 0,
      selling_price: parseFloat(formData.selling_price) || 0,
      expiry_date: formData.expiry_date || null
    })
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-2 gap-6">
        {/* 상비약 코드 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            상비약 코드 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="code"
            value={formData.code}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-clinic-secondary focus:border-transparent"
            placeholder="예: M001"
            required
          />
        </div>

        {/* 상비약명 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            상비약명 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-clinic-secondary focus:border-transparent"
            placeholder="예: 경옥고"
            required
          />
        </div>

        {/* 제조사 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">제조사</label>
          <input
            type="text"
            name="manufacturer"
            value={formData.manufacturer}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-clinic-secondary focus:border-transparent"
            placeholder="예: OO제약"
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
            placeholder="예: 환제, 액상제 등"
          />
        </div>

        {/* 단위 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">단위</label>
          <select
            name="unit"
            value={formData.unit}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-clinic-secondary focus:border-transparent"
          >
            <option value="box">box (박스)</option>
            <option value="bottle">bottle (병)</option>
            <option value="pack">pack (팩)</option>
            <option value="ea">ea (개)</option>
          </select>
        </div>

        {/* 현재 재고 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">현재 재고</label>
          <input
            type="number"
            name="current_stock"
            value={formData.current_stock}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-clinic-secondary focus:border-transparent"
            step="0.01"
          />
        </div>

        {/* 최소 재고 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">최소 재고</label>
          <input
            type="number"
            name="min_stock"
            value={formData.min_stock}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-clinic-secondary focus:border-transparent"
            step="0.01"
          />
        </div>

        {/* 유효기간 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">유효기간</label>
          <input
            type="date"
            name="expiry_date"
            value={formData.expiry_date}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-clinic-secondary focus:border-transparent"
          />
        </div>

        {/* 단가 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">단가 (입고가)</label>
          <input
            type="number"
            name="unit_cost"
            value={formData.unit_cost}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-clinic-secondary focus:border-transparent"
            step="0.01"
          />
        </div>

        {/* 판매가 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">판매가</label>
          <input
            type="number"
            name="selling_price"
            value={formData.selling_price}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-clinic-secondary focus:border-transparent"
            step="0.01"
          />
        </div>

        {/* 보관 위치 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">보관 위치</label>
          <input
            type="text"
            name="storage_location"
            value={formData.storage_location}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-clinic-secondary focus:border-transparent"
            placeholder="예: 냉장고 A"
          />
        </div>
      </div>

      {/* 설명 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">설명</label>
        <textarea
          name="description"
          value={formData.description}
          onChange={handleChange}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-clinic-secondary focus:border-transparent"
          placeholder="상비약에 대한 추가 설명을 입력하세요"
        />
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
