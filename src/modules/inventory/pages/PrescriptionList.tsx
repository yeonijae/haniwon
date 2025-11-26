import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { prescriptionsApi, Prescription } from '../api/prescriptions'

// 약재 구성 파싱 함수
const parseComposition = (composition: string): { herb: string; amount: string }[] => {
  if (!composition) return []

  return composition.split('/').map(item => {
    const [herb, amount] = item.split(':')
    return { herb: herb?.trim() || '', amount: amount?.trim() || '' }
  }).filter(item => item.herb)
}

function PrescriptionList() {
  const [selectedPrescription, setSelectedPrescription] = useState<Prescription | null>(null)

  // 최근 발행된 처방전 15개 조회
  const { data: recentPrescriptions, isLoading } = useQuery({
    queryKey: ['prescriptions', 'recent'],
    queryFn: () => prescriptionsApi.getRecent(15)
  })

  return (
    <div className="h-full overflow-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-clinic-text-primary mb-2">처방전</h2>
          <p className="text-clinic-text-secondary">발행된 처방전 목록 및 구성 확인</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* 처방전 목록 */}
        <div className="bg-white rounded-lg shadow-sm">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-clinic-text-primary">
              최근 처방전 (15개)
            </h3>
          </div>
          <div className="p-4 space-y-3 max-h-[700px] overflow-y-auto">
            {isLoading ? (
              <div className="text-center py-12">
                <i className="fa-solid fa-spinner fa-spin text-2xl text-gray-400 mb-2"></i>
                <p className="text-gray-500">로딩 중...</p>
              </div>
            ) : !recentPrescriptions || recentPrescriptions.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <i className="fa-solid fa-file-prescription text-4xl mb-2"></i>
                <p className="text-sm">발행된 처방전이 없습니다</p>
                <p className="text-xs mt-1">처방전 발행 기능은 추후 업데이트 예정입니다</p>
              </div>
            ) : (
              recentPrescriptions.map((prescription) => (
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
                      <h4 className="font-semibold text-gray-900">{prescription.prescription_name}</h4>
                      {prescription.patient_name && (
                        <p className="text-sm text-gray-600 mt-1">환자: {prescription.patient_name}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center text-xs text-gray-500 mt-2">
                    <i className="fa-solid fa-user-doctor mr-1"></i>
                    <span>{prescription.issued_by}</span>
                    <span className="mx-2">•</span>
                    <i className="fa-solid fa-calendar mr-1"></i>
                    <span>
                      {new Date(prescription.issued_date).toLocaleDateString('ko-KR')}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 처방 구성 보기 */}
        <div className="bg-white rounded-lg shadow-sm">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-clinic-text-primary">
              처방 구성 보기
            </h3>
          </div>
          <div className="p-4 max-h-[700px] overflow-y-auto">
            {selectedPrescription ? (
              <div>
                <div className="mb-4 pb-4 border-b border-gray-200">
                  <h4 className="font-semibold text-lg text-gray-900 mb-2">
                    {selectedPrescription.prescription_name}
                  </h4>
                  {selectedPrescription.patient_name && (
                    <p className="text-sm text-gray-600">환자: {selectedPrescription.patient_name}</p>
                  )}
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                    <div className="flex items-center">
                      <i className="fa-solid fa-user-doctor mr-1"></i>
                      <span>발행: {selectedPrescription.issued_by}</span>
                    </div>
                    <div className="flex items-center">
                      <i className="fa-solid fa-calendar mr-1"></i>
                      <span>{new Date(selectedPrescription.issued_date).toLocaleDateString('ko-KR')}</span>
                    </div>
                  </div>
                  {selectedPrescription.notes && (
                    <div className="mt-2 text-sm text-gray-600">
                      <i className="fa-solid fa-memo mr-1"></i>
                      {selectedPrescription.notes}
                    </div>
                  )}
                </div>

                {/* 약재 구성 */}
                <div>
                  <h5 className="font-semibold text-gray-900 mb-3 flex items-center">
                    <i className="fa-solid fa-leaf text-green-600 mr-2"></i>
                    약재 구성
                  </h5>
                  {parseComposition(selectedPrescription.composition).length > 0 ? (
                    <div className="grid grid-cols-2 gap-3">
                      {parseComposition(selectedPrescription.composition).map((item, index) => (
                        <div
                          key={index}
                          className="bg-gray-50 border border-gray-200 rounded-lg p-3 flex items-center justify-between"
                        >
                          <span className="font-medium text-gray-900">{item.herb}</span>
                          <span className="text-sm text-gray-600 bg-white px-2 py-1 rounded border border-gray-200">
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

                  {/* 원본 데이터 표시 */}
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <h6 className="text-xs font-medium text-gray-500 mb-2">원본 데이터:</h6>
                    <div className="bg-gray-100 rounded p-2 text-xs font-mono text-gray-700 break-all">
                      {selectedPrescription.composition}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-gray-400">
                <i className="fa-solid fa-hand-pointer text-4xl mb-2"></i>
                <p className="text-sm">처방전을 선택하면</p>
                <p className="text-sm">구성 내용이 표시됩니다</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default PrescriptionList
