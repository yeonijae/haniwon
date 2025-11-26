import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { prescriptionDefinitionsApi, PrescriptionDefinition } from '../api/prescriptions'

// 약재 구성 파싱 함수
const parseComposition = (composition: string): { herb: string; amount: string }[] => {
  if (!composition) return []

  return composition.split('/').map(item => {
    const [herb, amount] = item.split(':')
    return { herb: herb?.trim() || '', amount: amount?.trim() || '' }
  }).filter(item => item.herb)
}

function PrescriptionDefinitionList() {
  const queryClient = useQueryClient()
  const [selectedPrescription, setSelectedPrescription] = useState<PrescriptionDefinition | null>(null)

  const { data: prescriptions, isLoading } = useQuery({
    queryKey: ['prescription-definitions'],
    queryFn: () => prescriptionDefinitionsApi.getAll({ isActive: true })
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => prescriptionDefinitionsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prescription-definitions'] })
      setSelectedPrescription(null)
      alert('처방이 삭제되었습니다.')
    }
  })

  const handleDelete = (id: number, name: string) => {
    if (confirm(`"${name}" 처방을 삭제하시겠습니까?`)) {
      deleteMutation.mutate(id)
    }
  }

  return (
    <div className="bg-white rounded-lg">
      <div className="grid grid-cols-2 gap-6">
        {/* 처방 목록 */}
        <div>
          <h3 className="text-lg font-semibold text-clinic-text-primary mb-4">
            등록된 처방 정의 ({prescriptions?.length || 0}개)
          </h3>

          {isLoading ? (
            <div className="text-center py-12">
              <i className="fa-solid fa-spinner fa-spin text-2xl text-gray-400 mb-2"></i>
              <p className="text-gray-500">로딩 중...</p>
            </div>
          ) : !prescriptions || prescriptions.length === 0 ? (
            <div className="text-center py-12 text-gray-400 border border-gray-200 rounded-lg">
              <i className="fa-solid fa-file-prescription text-4xl mb-2"></i>
              <p className="text-sm">등록된 처방 정의가 없습니다</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {prescriptions.map((prescription) => (
                <div
                  key={prescription.id}
                  onClick={() => setSelectedPrescription(prescription)}
                  className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                    selectedPrescription?.id === prescription.id
                      ? 'border-clinic-secondary bg-blue-50'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900">{prescription.name}</h4>
                      {prescription.alias && (
                        <p className="text-sm text-gray-600 mt-1">{prescription.alias}</p>
                      )}
                      {prescription.category && (
                        <p className="text-xs text-blue-600 mt-1">
                          <i className="fa-solid fa-tag mr-1"></i>
                          {prescription.category}
                        </p>
                      )}
                      {prescription.source && (
                        <p className="text-xs text-gray-500 mt-1">
                          <i className="fa-solid fa-book mr-1"></i>
                          {prescription.source}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(prescription.id, prescription.name)
                      }}
                      className="text-red-500 hover:text-red-700 ml-2"
                      title="삭제"
                    >
                      <i className="fa-solid fa-trash text-sm"></i>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 처방 상세 보기 */}
        <div>
          <h3 className="text-lg font-semibold text-clinic-text-primary mb-4">
            처방 구성
          </h3>

          {selectedPrescription ? (
            <div className="border border-gray-200 rounded-lg p-4">
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
                  약재 구성
                </h5>
                {parseComposition(selectedPrescription.composition).length > 0 ? (
                  <div className="grid grid-cols-2 gap-2">
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
                    <i className="fa-solid fa-exclamation-circle text-2xl mb-2"></i>
                    <p className="text-sm">약재 구성 정보가 없습니다</p>
                  </div>
                )}

                {/* 원본 데이터 */}
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <h6 className="text-xs font-medium text-gray-500 mb-2">원본 데이터:</h6>
                  <div className="bg-gray-100 rounded p-2 text-xs font-mono text-gray-700 break-all">
                    {selectedPrescription.composition}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="border border-gray-200 rounded-lg p-12 text-center text-gray-400">
              <i className="fa-solid fa-hand-pointer text-4xl mb-2"></i>
              <p className="text-sm">처방을 선택하면</p>
              <p className="text-sm">구성 내용이 표시됩니다</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default PrescriptionDefinitionList
