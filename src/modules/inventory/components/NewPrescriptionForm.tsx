import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { prescriptionDefinitionsApi } from '../api/prescriptions'

interface NewPrescriptionFormProps {
  onSuccess: () => void
}

function NewPrescriptionForm({ onSuccess }: NewPrescriptionFormProps) {
  const queryClient = useQueryClient()
  const [formData, setFormData] = useState({
    name: '',
    alias: '',
    category: '',
    source: '',
    composition: ''
  })

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) => prescriptionDefinitionsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prescription-definitions'] })
      alert('처방이 등록되었습니다.')
      setFormData({
        name: '',
        alias: '',
        category: '',
        source: '',
        composition: ''
      })
      onSuccess()
    },
    onError: (error: any) => {
      alert(error.message || '처방 등록에 실패했습니다.')
    }
  })

  const handleSubmit = (e: React.FormEvent) => {
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  return (
    <div className="bg-white rounded-lg p-6">
      <h3 className="text-lg font-semibold text-clinic-text-primary mb-4">새 처방 등록</h3>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            처방명 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-clinic-secondary focus:border-transparent"
            placeholder="예: 소청룡탕"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            별명
          </label>
          <input
            type="text"
            name="alias"
            value={formData.alias}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-clinic-secondary focus:border-transparent"
            placeholder="예: 小靑龍湯"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            분류
          </label>
          <input
            type="text"
            name="category"
            value={formData.category}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-clinic-secondary focus:border-transparent"
            placeholder="예: 해표제, 보익제, 청열제 등"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            출전
          </label>
          <input
            type="text"
            name="source"
            value={formData.source}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-clinic-secondary focus:border-transparent"
            placeholder="예: 상한론"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            약재 구성 <span className="text-red-500">*</span>
          </label>
          <textarea
            name="composition"
            value={formData.composition}
            onChange={handleChange}
            rows={6}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-clinic-secondary focus:border-transparent font-mono text-sm"
            placeholder="약재명:용량/약재명:용량/약재명:용량&#10;예: 마황:12/작약:12/건강:12/세신:6/오미자:6/계지:12/반하:12/감초:12"
            required
          />
          <p className="text-xs text-gray-500 mt-1">
            형식: 약재명:용량/약재명:용량/... (용량 단위는 g)
          </p>
        </div>

        <div className="flex justify-end space-x-3 pt-4">
          <button
            type="button"
            onClick={() => {
              setFormData({
                name: '',
                alias: '',
                category: '',
                source: '',
                composition: ''
              })
            }}
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            초기화
          </button>
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="px-6 py-2 bg-clinic-secondary text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {createMutation.isPending ? '등록 중...' : '등록'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default NewPrescriptionForm
