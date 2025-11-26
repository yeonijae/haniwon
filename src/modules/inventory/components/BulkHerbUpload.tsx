import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { herbsApi } from '../api/herbs'
import * as XLSX from 'xlsx'

interface BulkHerbUploadProps {
  onSuccess: () => void
}

interface HerbData {
  약재명: string
  '현재 재고(g)'?: number
  '한봉당 용량(g)'?: number
  거래처?: string
  '최소 재고(g)'?: number
  '단가(원/g)'?: number
}

function BulkHerbUpload({ onSuccess }: BulkHerbUploadProps) {
  const queryClient = useQueryClient()
  const [file, setFile] = useState<File | null>(null)
  const [parsedData, setParsedData] = useState<HerbData[]>([])
  const [isProcessing, setIsProcessing] = useState(false)

  const uploadMutation = useMutation({
    mutationFn: async (herbs: any[]) => {
      // 순차적으로 등록
      const results = []
      for (const herb of herbs) {
        try {
          const result = await herbsApi.create(herb)
          results.push({ success: true, data: result, herbName: herb.name })
        } catch (error: any) {
          results.push({
            success: false,
            error,
            herb,
            herbName: herb.name,
            errorMessage: error.message || '알 수 없는 오류'
          })
        }
      }
      return results
    },
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: ['herbs'] })
      const successCount = results.filter(r => r.success).length
      const failCount = results.filter(r => !r.success).length

      let message = `약재 등록 완료!\n성공: ${successCount}개\n실패: ${failCount}개`

      if (failCount > 0) {
        const failedItems = results
          .filter(r => !r.success)
          .map((r: any) => `- ${r.herbName}: ${r.errorMessage}`)
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
      alert(error.message || '약재 일괄 등록에 실패했습니다.')
    }
  })

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
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
        const jsonData = XLSX.utils.sheet_to_json<HerbData>(worksheet)

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

    // 데이터 검증 (필수: 약재명만)
    const invalidRows = parsedData.filter((row, index) => {
      return !row.약재명
    })

    if (invalidRows.length > 0) {
      alert(`${invalidRows.length}개의 행에 약재명이 누락되었습니다.\n필수 항목: 약재명`)
      return
    }

    // Supabase 형식으로 변환
    const baseTimestamp = Date.now()
    const herbs = parsedData.map((row, index) => {
      // 고유한 코드 생성: 타임스탬프 + 인덱스 + 랜덤값
      const code = `H${(baseTimestamp + index).toString().slice(-8)}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`
      const packageSize = row['한봉당 용량(g)'] ? Number(row['한봉당 용량(g)']) : 0

      return {
        code,
        name: row.약재명,
        origin: row.거래처 || '',
        unit: 'g',
        current_stock: row['현재 재고(g)'] ? Number(row['현재 재고(g)']) : 0,
        min_stock: row['최소 재고(g)'] ? Number(row['최소 재고(g)']) : 0,
        unit_cost: row['단가(원/g)'] ? Number(row['단가(원/g)']) : 0,
        selling_price: 0,
        description: packageSize > 0 ? `한봉당 용량: ${packageSize}g` : ''
      }
    })

    uploadMutation.mutate(herbs)
  }

  const downloadTemplate = () => {
    // 템플릿 데이터 생성
    const templateData = [
      {
        '약재명': '당귀',
        '현재 재고(g)': 1000,
        '한봉당 용량(g)': 500,
        '거래처': 'OO약업사',
        '최소 재고(g)': 500,
        '단가(원/g)': 10
      },
      {
        '약재명': '인삼',
        '현재 재고(g)': '',
        '한봉당 용량(g)': '',
        '거래처': '',
        '최소 재고(g)': '',
        '단가(원/g)': ''
      },
      {
        '약재명': '백출',
        '현재 재고(g)': '',
        '한봉당 용량(g)': '',
        '거래처': '',
        '최소 재고(g)': '',
        '단가(원/g)': ''
      }
    ]

    const worksheet = XLSX.utils.json_to_sheet(templateData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, '약재목록')
    XLSX.writeFile(workbook, '약재_일괄등록_템플릿.xlsx')
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
              템플릿 파일을 다운로드하여 약재 정보를 입력한 후 업로드하세요.
            </p>
            <div className="text-xs text-blue-600 mb-3 space-y-1">
              <p><strong>필수 항목:</strong> 약재명만 입력하면 등록 가능</p>
              <p><strong>선택 항목:</strong> 현재 재고, 한봉당 용량, 거래처, 최소 재고, 단가</p>
              <p className="text-blue-500">※ 선택 항목 미입력 시 기본값(0 또는 빈 값)으로 설정되며, 나중에 수정 가능합니다.</p>
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
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">약재명</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">현재 재고(g)</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">한봉당 용량(g)</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">거래처</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">최소 재고(g)</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">단가(원/g)</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {parsedData.map((row, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-sm text-gray-900">{row.약재명}</td>
                      <td className="px-4 py-2 text-sm text-gray-900">{row['현재 재고(g)']}</td>
                      <td className="px-4 py-2 text-sm text-gray-900">{row['한봉당 용량(g)']}</td>
                      <td className="px-4 py-2 text-sm text-gray-900">{row.거래처}</td>
                      <td className="px-4 py-2 text-sm text-gray-900">{row['최소 재고(g)']}</td>
                      <td className="px-4 py-2 text-sm text-gray-900">{row['단가(원/g)']}</td>
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
          {uploadMutation.isPending ? '등록 중...' : `${parsedData.length}개 약재 등록`}
        </button>
      </div>
    </div>
  )
}

export default BulkHerbUpload
