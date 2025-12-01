import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { medicinesApi } from '../api/medicines'
import * as XLSX from 'xlsx'

interface BulkMedicineUploadProps {
  onSuccess: () => void
}

interface MedicineData {
  '상비약 이름': string
  '분류'?: string
  '현재재고'?: number
  '누적사용량'?: number
  '사용여부'?: string | boolean
  '최근탕전일자'?: string | number
  '탕전시-첩수'?: number
  '탕전시-팩수'?: number
}

function BulkMedicineUpload({ onSuccess }: BulkMedicineUploadProps) {
  const queryClient = useQueryClient()
  const [file, setFile] = useState<File | null>(null)
  const [parsedData, setParsedData] = useState<MedicineData[]>([])
  const [isProcessing, setIsProcessing] = useState(false)

  const uploadMutation = useMutation({
    mutationFn: async (medicines: any[]) => {
      // 순차적으로 등록
      const results = []
      for (const medicine of medicines) {
        try {
          const result = await medicinesApi.create(medicine)
          results.push({ success: true, data: result, medicineName: medicine.name })
        } catch (error: any) {
          results.push({
            success: false,
            error,
            medicine,
            medicineName: medicine.name,
            errorMessage: error.message || '알 수 없는 오류'
          })
        }
      }
      return results
    },
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: ['ready-medicines'] })
      const successCount = results.filter(r => r.success).length
      const failCount = results.filter(r => !r.success).length

      let message = `상비약 등록 완료!\n성공: ${successCount}개\n실패: ${failCount}개`

      if (failCount > 0) {
        const failedItems = results
          .filter(r => !r.success)
          .map((r: any) => `- ${r.medicineName}: ${r.errorMessage}`)
          .slice(0, 5) // 최대 5개까지만 표시
          .join('\n')

        message += `\n\n실패 항목:\n${failedItems}`
        if (failCount > 5) {
          message += `\n... 외 ${failCount - 5}개`
        }
      }

      alert(message)

      if (failCount === 0) {
        onSuccess()
      }
    },
    onError: (error: any) => {
      alert(error.message || '상비약 일괄 등록에 실패했습니다.')
    }
  })

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
      parseExcelFile(selectedFile)
    }
  }

  const parseExcelDate = (value: any): string | undefined => {
    if (!value) return undefined

    // 이미 문자열인 경우
    if (typeof value === 'string') {
      return value
    }

    // 엑셀 시리얼 날짜인 경우 (숫자)
    if (typeof value === 'number') {
      const date = XLSX.SSF.parse_date_code(value)
      if (date) {
        const year = date.y
        const month = String(date.m).padStart(2, '0')
        const day = String(date.d).padStart(2, '0')
        return `${year}-${month}-${day}`
      }
    }

    return undefined
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
        const jsonData = XLSX.utils.sheet_to_json<MedicineData>(worksheet)

        setParsedData(jsonData)
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

    // 데이터 검증 (필수: 상비약 이름)
    const invalidRows = parsedData.filter((row) => {
      return !row['상비약 이름']
    })

    if (invalidRows.length > 0) {
      alert(`${invalidRows.length}개의 행에 상비약 이름이 누락되었습니다.\n필수 항목: 상비약 이름`)
      return
    }

    // API 형식으로 변환
    const baseTimestamp = Date.now()
    const medicines = parsedData.map((row, index) => {
      // 고유한 코드 생성: 타임스탬프 + 인덱스 + 랜덤값
      const code = `M${(baseTimestamp + index).toString().slice(-8)}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`

      // 사용여부 파싱
      const isActiveValue = row['사용여부']
      let isActive = true
      if (typeof isActiveValue === 'boolean') {
        isActive = isActiveValue
      } else if (typeof isActiveValue === 'string') {
        isActive = isActiveValue === 'Y' || isActiveValue === 'O' || isActiveValue === '사용' || isActiveValue === '예' || isActiveValue === 'true'
      }

      // 최근탕전일자 파싱
      const lastDecoctionDate = parseExcelDate(row['최근탕전일자'])

      // description에 탕전 관련 정보 저장
      const descriptionParts: string[] = []
      if (row['탕전시-첩수']) {
        descriptionParts.push(`탕전시 첩수: ${row['탕전시-첩수']}첩`)
      }
      if (row['탕전시-팩수']) {
        descriptionParts.push(`탕전시 팩수: ${row['탕전시-팩수']}팩`)
      }
      if (lastDecoctionDate) {
        descriptionParts.push(`최근탕전일: ${lastDecoctionDate}`)
      }
      if (row['누적사용량']) {
        descriptionParts.push(`누적사용량: ${row['누적사용량']}`)
      }

      return {
        code,
        name: row['상비약 이름'],
        category: row['분류'] || '',
        unit: '개',
        current_stock: row['현재재고'] ? Number(row['현재재고']) : 0,
        min_stock: 0,
        unit_cost: 0,
        selling_price: 0,
        is_active: isActive,
        description: descriptionParts.join(' / ')
      }
    })

    uploadMutation.mutate(medicines)
  }

  const downloadTemplate = () => {
    // 템플릿 데이터 생성
    const templateData = [
      {
        '상비약 이름': '쌍화탕',
        '분류': '탕전약',
        '현재재고': 50,
        '누적사용량': 200,
        '사용여부': 'Y',
        '최근탕전일자': '2024-11-01',
        '탕전시-첩수': 10,
        '탕전시-팩수': 30
      },
      {
        '상비약 이름': '보중익기탕',
        '분류': '탕전약',
        '현재재고': 30,
        '누적사용량': 150,
        '사용여부': 'Y',
        '최근탕전일자': '2024-10-15',
        '탕전시-첩수': 10,
        '탕전시-팩수': 30
      },
      {
        '상비약 이름': '예시약품',
        '분류': '',
        '현재재고': '',
        '누적사용량': '',
        '사용여부': '',
        '최근탕전일자': '',
        '탕전시-첩수': '',
        '탕전시-팩수': ''
      }
    ]

    const worksheet = XLSX.utils.json_to_sheet(templateData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, '상비약목록')
    XLSX.writeFile(workbook, '상비약_일괄등록_템플릿.xlsx')
  }

  // 사용여부 표시용 함수
  const formatIsActive = (value: any): string => {
    if (value === undefined || value === null || value === '') return '-'
    if (typeof value === 'boolean') return value ? 'Y' : 'N'
    if (typeof value === 'string') {
      if (value === 'Y' || value === 'O' || value === '사용' || value === '예' || value === 'true') return 'Y'
      if (value === 'N' || value === 'X' || value === '미사용' || value === '아니오' || value === 'false') return 'N'
    }
    return String(value)
  }

  // 날짜 표시용 함수
  const formatDate = (value: any): string => {
    const parsed = parseExcelDate(value)
    return parsed || '-'
  }

  return (
    <div className="space-y-6">
      {/* 템플릿 다운로드 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start">
          <i className="fa-solid fa-circle-info text-blue-600 text-xl mr-3 mt-1"></i>
          <div className="flex-1">
            <h3 className="text-sm font-medium text-blue-900 mb-2">엑셀 템플릿 다운로드</h3>
            <p className="text-sm text-blue-700 mb-2">
              템플릿 파일을 다운로드하여 상비약 정보를 입력한 후 업로드하세요.
            </p>
            <div className="text-xs text-blue-600 mb-3 space-y-1">
              <p><strong>필수 항목:</strong> 상비약 이름</p>
              <p><strong>선택 항목:</strong> 분류, 현재재고, 누적사용량, 사용여부(Y/N), 최근탕전일자, 탕전시-첩수, 탕전시-팩수</p>
              <p className="text-blue-500">※ 선택 항목 미입력 시 기본값으로 설정되며, 나중에 수정 가능합니다.</p>
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

      {/* 파싱된 데이터 미리보기 */}
      {parsedData.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-3">
            미리보기 ({parsedData.length}개 항목)
          </h3>
          <div className="border border-gray-300 rounded-lg overflow-hidden">
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">상비약 이름</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">분류</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">현재재고</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">누적사용량</th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-500">사용여부</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">최근탕전일자</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">첩수</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">팩수</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {parsedData.map((row, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-sm text-gray-900">{row['상비약 이름']}</td>
                      <td className="px-3 py-2 text-sm text-gray-600">{row['분류'] || '-'}</td>
                      <td className="px-3 py-2 text-sm text-gray-900 text-right">{row['현재재고'] ?? '-'}</td>
                      <td className="px-3 py-2 text-sm text-gray-600 text-right">{row['누적사용량'] ?? '-'}</td>
                      <td className="px-3 py-2 text-sm text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                          formatIsActive(row['사용여부']) === 'Y'
                            ? 'bg-green-100 text-green-800'
                            : formatIsActive(row['사용여부']) === 'N'
                            ? 'bg-gray-100 text-gray-600'
                            : 'text-gray-400'
                        }`}>
                          {formatIsActive(row['사용여부'])}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-600">{formatDate(row['최근탕전일자'])}</td>
                      <td className="px-3 py-2 text-sm text-gray-600 text-right">{row['탕전시-첩수'] ?? '-'}</td>
                      <td className="px-3 py-2 text-sm text-gray-600 text-right">{row['탕전시-팩수'] ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

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
          type="button"
          onClick={handleUpload}
          disabled={parsedData.length === 0 || uploadMutation.isPending || isProcessing}
          className="px-6 py-2 bg-clinic-primary text-white rounded-lg hover:bg-blue-900 transition-colors disabled:opacity-50"
        >
          {uploadMutation.isPending ? '등록 중...' : `${parsedData.length}개 상비약 등록`}
        </button>
      </div>
    </div>
  )
}

export default BulkMedicineUpload
