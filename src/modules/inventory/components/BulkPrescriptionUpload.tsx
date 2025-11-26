import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { prescriptionDefinitionsApi } from '../api/prescriptions'
import * as XLSX from 'xlsx'

interface BulkPrescriptionUploadProps {
  onSuccess: () => void
}

interface PrescriptionData {
  처방명: string
  별명?: string
  분류?: string
  출전?: string
  약재구성: string
}

interface ParsedPrescription extends PrescriptionData {
  error?: string
  isEditing?: boolean
}

interface UploadResult {
  success: boolean
  prescriptionName: string
  error?: string
}

function BulkPrescriptionUpload({ onSuccess }: BulkPrescriptionUploadProps) {
  const queryClient = useQueryClient()
  const [file, setFile] = useState<File | null>(null)
  const [parsedData, setParsedData] = useState<ParsedPrescription[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [uploadResults, setUploadResults] = useState<UploadResult[]>([])
  const [showResults, setShowResults] = useState(false)

  const uploadMutation = useMutation({
    mutationFn: async (prescriptions: any[]) => {
      const results: UploadResult[] = []
      for (const prescription of prescriptions) {
        try {
          await prescriptionDefinitionsApi.create(prescription)
          results.push({
            success: true,
            prescriptionName: prescription.name
          })
        } catch (error: any) {
          results.push({
            success: false,
            prescriptionName: prescription.name,
            error: error.message || '알 수 없는 오류'
          })
        }
      }
      return results
    },
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: ['prescription-definitions'] })
      setUploadResults(results)
      setShowResults(true)

      const successCount = results.filter(r => r.success).length
      if (successCount === results.length) {
        setTimeout(() => {
          onSuccess()
        }, 2000)
      }
    },
    onError: (error: any) => {
      alert(error.message || '처방 일괄 등록에 실패했습니다.')
    }
  })

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
      setShowResults(false)
      parseExcelFile(selectedFile)
    }
  }

  const parseExcelFile = (file: File) => {
    setIsProcessing(true)
    const reader = new FileReader()

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        const jsonData = XLSX.utils.sheet_to_json<PrescriptionData>(worksheet)

        // 데이터 검증 및 오류 표시
        const validatedData = jsonData.map((row, index) => {
          const errors: string[] = []

          if (!row.처방명 || row.처방명.trim() === '') {
            errors.push('처방명 필수')
          }
          if (!row.약재구성 || row.약재구성.trim() === '') {
            errors.push('약재구성 필수')
          }

          return {
            ...row,
            error: errors.length > 0 ? errors.join(', ') : undefined,
            isEditing: false
          }
        })

        setParsedData(validatedData)
        setIsProcessing(false)
      } catch (error) {
        alert('엑셀 파일 파싱에 실패했습니다.')
        setIsProcessing(false)
      }
    }

    reader.readAsArrayBuffer(file)
  }

  const handleUpload = () => {
    if (parsedData.length === 0) {
      alert('업로드할 데이터가 없습니다.')
      return
    }

    // 오류가 있는 행이 있는지 확인
    const hasErrors = parsedData.some(row => row.error)
    if (hasErrors) {
      alert('오류가 있는 항목이 있습니다. 수정 후 다시 시도해주세요.')
      return
    }

    // Supabase 형식으로 변환
    const prescriptions = parsedData.map((row) => ({
      name: row.처방명.trim(),
      alias: row.별명?.trim() || '',
      category: row.분류?.trim() || '',
      source: row.출전?.trim() || '',
      composition: row.약재구성.trim()
    }))

    uploadMutation.mutate(prescriptions)
  }

  const handleEdit = (index: number, field: keyof PrescriptionData, value: string) => {
    const newData = [...parsedData]
    newData[index] = {
      ...newData[index],
      [field]: value
    }

    // 재검증
    const errors: string[] = []
    if (!newData[index].처방명 || newData[index].처방명.trim() === '') {
      errors.push('처방명 필수')
    }
    if (!newData[index].약재구성 || newData[index].약재구성.trim() === '') {
      errors.push('약재구성 필수')
    }
    newData[index].error = errors.length > 0 ? errors.join(', ') : undefined

    setParsedData(newData)
  }

  const handleRetryFailed = () => {
    // 실패한 항목만 다시 등록
    const failedNames = uploadResults
      .filter(r => !r.success)
      .map(r => r.prescriptionName)

    const failedData = parsedData.filter(row =>
      failedNames.includes(row.처방명.trim())
    )

    if (failedData.length === 0) {
      alert('재시도할 항목이 없습니다.')
      return
    }

    const prescriptions = failedData.map((row) => ({
      name: row.처방명.trim(),
      alias: row.별명?.trim() || '',
      category: row.분류?.trim() || '',
      source: row.출전?.trim() || '',
      composition: row.약재구성.trim()
    }))

    uploadMutation.mutate(prescriptions)
  }

  const downloadTemplate = () => {
    const templateData = [
      {
        '처방명': '소청룡탕',
        '별명': '小靑龍湯/소청룡탕',
        '분류': '해표제',
        '출전': '상한론',
        '약재구성': '마황:12/작약:12/건강:12/세신:6/오미자:6/계지:12/반하:12/감초:12'
      },
      {
        '처방명': '육미지황탕',
        '별명': '六味地黃湯',
        '분류': '보익제',
        '출전': '의학입문',
        '약재구성': '숙지황:24/산수유:12/산약:12/택사:9/목단피:9/복령:9'
      },
      {
        '처방명': '',
        '별명': '',
        '분류': '',
        '출전': '',
        '약재구성': ''
      }
    ]

    const worksheet = XLSX.utils.json_to_sheet(templateData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, '처방목록')
    XLSX.writeFile(workbook, '처방_일괄등록_템플릿.xlsx')
  }

  const successCount = uploadResults.filter(r => r.success).length
  const failCount = uploadResults.filter(r => !r.success).length
  const totalCount = uploadResults.length
  const successRate = totalCount > 0 ? (successCount / totalCount) * 100 : 0

  return (
    <div className="space-y-6">
      {/* 템플릿 다운로드 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start">
          <i className="fa-solid fa-circle-info text-blue-600 text-xl mr-3 mt-1"></i>
          <div className="flex-1">
            <h3 className="text-sm font-medium text-blue-900 mb-2">엑셀 템플릿 다운로드</h3>
            <p className="text-sm text-blue-700 mb-2">
              템플릿 파일을 다운로드하여 처방 정보를 입력한 후 업로드하세요.
            </p>
            <div className="text-xs text-blue-600 mb-3 space-y-1">
              <p><strong>필수 항목:</strong> 처방명, 약재구성</p>
              <p><strong>선택 항목:</strong> 별명, 분류, 출전</p>
              <p><strong>약재구성 형식:</strong> 약재명:용량/약재명:용량/... (예: 마황:12/작약:12/건강:12)</p>
              <p><strong>별명 형식:</strong> 여러 별명은 "/"로 구분 (예: 小靑龍湯/소청룡탕)</p>
            </div>
            <button
              type="button"
              onClick={downloadTemplate}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
            >
              <i className="fa-solid fa-download mr-2"></i>
              템플릿 다운로드
            </button>
          </div>
        </div>
      </div>

      {/* 파일 업로드 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          엑셀 파일 업로드
        </label>
        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFileChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-clinic-secondary focus:border-transparent"
        />
      </div>

      {/* 등록 결과 */}
      {showResults && uploadResults.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">등록 결과</h3>

          {/* 통계 */}
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-gray-900">{totalCount}</div>
              <div className="text-sm text-gray-600">전체</div>
            </div>
            <div className="bg-green-50 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-green-600">{successCount}</div>
              <div className="text-sm text-gray-600">성공</div>
            </div>
            <div className="bg-red-50 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-red-600">{failCount}</div>
              <div className="text-sm text-gray-600">실패</div>
            </div>
          </div>

          {/* 막대그래프 */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">성공률</span>
              <span className="text-sm font-bold text-gray-900">{successRate.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-6 overflow-hidden">
              <div className="flex h-full">
                {successCount > 0 && (
                  <div
                    className="bg-green-500 flex items-center justify-center text-white text-xs font-medium"
                    style={{ width: `${(successCount / totalCount) * 100}%` }}
                  >
                    {successCount}
                  </div>
                )}
                {failCount > 0 && (
                  <div
                    className="bg-red-500 flex items-center justify-center text-white text-xs font-medium"
                    style={{ width: `${(failCount / totalCount) * 100}%` }}
                  >
                    {failCount}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 실패 목록 */}
          {failCount > 0 && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold text-red-600">실패 항목</h4>
                <button
                  onClick={handleRetryFailed}
                  className="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                  disabled={uploadMutation.isPending}
                >
                  <i className="fa-solid fa-rotate-right mr-1"></i>
                  재시도
                </button>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 max-h-48 overflow-y-auto">
                <div className="space-y-2">
                  {uploadResults
                    .filter(r => !r.success)
                    .map((result, index) => (
                      <div key={index} className="text-sm">
                        <span className="font-medium text-red-900">{result.prescriptionName}</span>
                        <span className="text-red-600 ml-2">- {result.error}</span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}

          {/* 완료 버튼 */}
          {successCount === totalCount && (
            <div className="mt-4 text-center">
              <button
                onClick={onSuccess}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                <i className="fa-solid fa-check mr-2"></i>
                완료
              </button>
            </div>
          )}
        </div>
      )}

      {/* 파싱된 데이터 미리보기 */}
      {parsedData.length > 0 && !showResults && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-700">
              미리보기 ({parsedData.length}개 항목)
            </h3>
            <div className="text-xs text-gray-500">
              {parsedData.filter(r => r.error).length > 0 && (
                <span className="text-red-600">
                  <i className="fa-solid fa-exclamation-triangle mr-1"></i>
                  {parsedData.filter(r => r.error).length}개 오류
                </span>
              )}
            </div>
          </div>
          <div className="border border-gray-300 rounded-lg overflow-hidden">
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">상태</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">처방명</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">별명</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">분류</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">출전</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">약재구성</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {parsedData.map((row, index) => (
                    <tr
                      key={index}
                      className={row.error ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-gray-50'}
                    >
                      <td className="px-4 py-2 text-center">
                        {row.error ? (
                          <i className="fa-solid fa-circle-exclamation text-red-600" title={row.error}></i>
                        ) : (
                          <i className="fa-solid fa-circle-check text-green-600"></i>
                        )}
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="text"
                          value={row.처방명 || ''}
                          onChange={(e) => handleEdit(index, '처방명', e.target.value)}
                          className={`w-full px-2 py-1 text-sm border rounded ${
                            row.error?.includes('처방명')
                              ? 'border-red-300 bg-red-50'
                              : 'border-gray-300'
                          }`}
                          placeholder="필수"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="text"
                          value={row.별명 || ''}
                          onChange={(e) => handleEdit(index, '별명', e.target.value)}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                          placeholder="선택"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="text"
                          value={row.분류 || ''}
                          onChange={(e) => handleEdit(index, '분류', e.target.value)}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                          placeholder="선택"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="text"
                          value={row.출전 || ''}
                          onChange={(e) => handleEdit(index, '출전', e.target.value)}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                          placeholder="선택"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <textarea
                          value={row.약재구성 || ''}
                          onChange={(e) => handleEdit(index, '약재구성', e.target.value)}
                          className={`w-full px-2 py-1 text-sm border rounded font-mono ${
                            row.error?.includes('약재구성')
                              ? 'border-red-300 bg-red-50'
                              : 'border-gray-300'
                          }`}
                          placeholder="필수"
                          rows={2}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {parsedData.some(r => r.error) && (
            <div className="mt-2 text-xs text-red-600">
              <i className="fa-solid fa-info-circle mr-1"></i>
              오류가 있는 항목은 표에서 직접 수정할 수 있습니다.
            </div>
          )}
        </div>
      )}

      {/* 버튼 */}
      {!showResults && (
        <div className="flex justify-end space-x-3 pt-4 border-t">
          <button
            type="button"
            onClick={onSuccess}
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleUpload}
            disabled={parsedData.length === 0 || uploadMutation.isPending || isProcessing || parsedData.some(r => r.error)}
            className="px-6 py-2 bg-clinic-primary text-white rounded-lg hover:bg-blue-900 transition-colors disabled:opacity-50"
          >
            {uploadMutation.isPending ? '등록 중...' : `${parsedData.length}개 처방 등록`}
          </button>
        </div>
      )}
    </div>
  )
}

export default BulkPrescriptionUpload
