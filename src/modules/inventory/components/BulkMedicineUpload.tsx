import { useState, useRef } from 'react'
import * as XLSX from 'xlsx'
import {
  bulkUpsertMedicineInventory,
  getMedicineInventoryByNames,
  type MedicineInventory,
  type BulkImportItem,
} from '../../cs/lib/api'

interface BulkMedicineUploadProps {
  onSuccess: () => void
}

// 검증된 행 타입
interface ValidatedRow {
  rowIndex: number
  name: string
  lastDecoction: string
  totalStock: string
  currentStock: string
  dosesPerBatch: string
  packsPerBatch: string
  category: string
  isActive: string
  status: 'insert' | 'update' | 'skip' | 'error'
  errors: { field: string; message: string }[]
  existingId?: number
}

// 헤더 매핑
const HEADER_MAP: Record<string, keyof ValidatedRow> = {
  '처방명': 'name',
  '최근탕전일': 'lastDecoction',
  '누적': 'totalStock',
  '재고': 'currentStock',
  '첩': 'dosesPerBatch',
  '팩': 'packsPerBatch',
  '분류': 'category',
  '사용': 'isActive',
}

// 날짜 형식 검증 (YYYY-MM-DD 또는 빈값)
const isValidDate = (value: string): boolean => {
  if (!value || value.trim() === '') return true
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/
  if (!dateRegex.test(value)) return false
  const date = new Date(value)
  return !isNaN(date.getTime())
}

// 사용 여부 파싱
const parseIsActive = (value: string): boolean => {
  const lower = value.toLowerCase().trim()
  return ['o', 'y', '1', 'true', '사용', 'yes'].includes(lower)
}

// 엑셀 날짜 파싱
const parseExcelDate = (value: any): string => {
  if (!value) return ''
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number') {
    const date = XLSX.SSF.parse_date_code(value)
    if (date) {
      const year = date.y
      const month = String(date.m).padStart(2, '0')
      const day = String(date.d).padStart(2, '0')
      return `${year}-${month}-${day}`
    }
  }
  return ''
}

function BulkMedicineUpload({ onSuccess }: BulkMedicineUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [bulkImportMode, setBulkImportMode] = useState<'overwrite' | 'newOnly'>('overwrite')
  const [validatedRows, setValidatedRows] = useState<ValidatedRow[]>([])
  const [bulkImportStep, setBulkImportStep] = useState<'upload' | 'validate' | 'saving'>('upload')
  const [showOnlyErrors, setShowOnlyErrors] = useState(false)
  const [editingRowIndex, setEditingRowIndex] = useState<number | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  // 파일 선택 핸들러
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsProcessing(true)
    try {
      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data, { type: 'array' })
      const sheetName = workbook.SheetNames[0]
      const sheet = workbook.Sheets[sheetName]
      const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { header: 1 })

      if (jsonData.length < 2) {
        alert('데이터가 없습니다.')
        return
      }

      // 헤더 파싱
      const headers = jsonData[0] as string[]
      const headerIndices: Record<string, number> = {}

      headers.forEach((header, idx) => {
        const trimmed = header?.toString().trim()
        if (trimmed && HEADER_MAP[trimmed]) {
          headerIndices[HEADER_MAP[trimmed]] = idx
        }
      })

      // 필수 헤더 확인
      if (!('name' in headerIndices)) {
        alert('필수 헤더 "처방명"이 없습니다.')
        return
      }

      // 데이터 행 파싱
      const rows: ValidatedRow[] = []
      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i] as any[]
        if (!row || row.length === 0) continue

        const name = row[headerIndices['name']]?.toString().trim() || ''
        if (!name) continue

        rows.push({
          rowIndex: i,
          name,
          lastDecoction: parseExcelDate(row[headerIndices['lastDecoction']]),
          totalStock: row[headerIndices['totalStock']]?.toString().trim() || '0',
          currentStock: row[headerIndices['currentStock']]?.toString().trim() || '0',
          dosesPerBatch: row[headerIndices['dosesPerBatch']]?.toString().trim() || '20',
          packsPerBatch: row[headerIndices['packsPerBatch']]?.toString().trim() || '30',
          category: row[headerIndices['category']]?.toString().trim() || '상비약',
          isActive: row[headerIndices['isActive']]?.toString().trim() || 'O',
          status: 'insert',
          errors: [],
        })
      }

      if (rows.length === 0) {
        alert('유효한 데이터가 없습니다.')
        return
      }

      // 기존 데이터 조회 및 검증
      const names = rows.map(r => r.name)
      const existingMap = await getMedicineInventoryByNames(names)

      const validated = rows.map(row => validateRow(row, existingMap, bulkImportMode))
      setValidatedRows(validated)
      setBulkImportStep('validate')

    } catch (err: any) {
      alert(`파일 파싱 오류: ${err.message}`)
    } finally {
      setIsProcessing(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  // 행 검증
  const validateRow = (
    row: ValidatedRow,
    existingMap: Map<string, MedicineInventory>,
    mode: 'overwrite' | 'newOnly'
  ): ValidatedRow => {
    const errors: { field: string; message: string }[] = []
    const existing = existingMap.get(row.name)

    // 이름 검증
    if (!row.name) {
      errors.push({ field: 'name', message: '처방명 필수' })
    }

    // 날짜 검증
    if (row.lastDecoction && !isValidDate(row.lastDecoction)) {
      errors.push({ field: 'lastDecoction', message: '날짜형식 오류 (YYYY-MM-DD)' })
    }

    // 숫자 검증
    const numFields = [
      { field: 'totalStock', label: '누적' },
      { field: 'currentStock', label: '재고' },
      { field: 'dosesPerBatch', label: '첩' },
      { field: 'packsPerBatch', label: '팩' },
    ] as const

    numFields.forEach(({ field, label }) => {
      const value = row[field]
      if (value && (isNaN(Number(value)) || Number(value) < 0)) {
        errors.push({ field, message: `${label}: 0 이상 숫자` })
      }
    })

    // 상태 결정
    let status: ValidatedRow['status'] = 'insert'
    if (errors.length > 0) {
      status = 'error'
    } else if (existing) {
      if (mode === 'newOnly') {
        status = 'skip'
      } else {
        status = 'update'
      }
    }

    return {
      ...row,
      status,
      errors,
      existingId: existing?.id,
    }
  }

  // 행 수정
  const handleRowChange = (rowIndex: number, field: keyof ValidatedRow, value: string) => {
    setValidatedRows(validatedRows.map(row => {
      if (row.rowIndex === rowIndex) {
        return { ...row, [field]: value }
      }
      return row
    }))
  }

  // 행 재검증
  const revalidateRow = async (rowIndex: number) => {
    const row = validatedRows.find(r => r.rowIndex === rowIndex)
    if (!row) return

    const existingMap = await getMedicineInventoryByNames([row.name])
    const validated = validateRow(row, existingMap, bulkImportMode)

    setValidatedRows(validatedRows.map(r =>
      r.rowIndex === rowIndex ? validated : r
    ))
    setEditingRowIndex(null)
  }

  // 전체 재검증
  const revalidateAll = async () => {
    setIsProcessing(true)
    try {
      const names = validatedRows.map(r => r.name)
      const existingMap = await getMedicineInventoryByNames(names)
      const revalidated = validatedRows.map(row => validateRow(row, existingMap, bulkImportMode))
      setValidatedRows(revalidated)
    } finally {
      setIsProcessing(false)
    }
  }

  // 등록 실행
  const handleSave = async () => {
    const validRows = validatedRows.filter(r => r.status === 'insert' || r.status === 'update')
    if (validRows.length === 0) {
      alert('등록할 항목이 없습니다.')
      return
    }

    const errorRows = validatedRows.filter(r => r.status === 'error')
    if (errorRows.length > 0) {
      if (!confirm(`${errorRows.length}개 오류 항목이 있습니다. 오류 항목은 건너뛰고 진행할까요?`)) {
        return
      }
    }

    setBulkImportStep('saving')
    setIsProcessing(true)

    try {
      const items: BulkImportItem[] = validRows.map(row => ({
        name: row.name,
        lastDecoction: row.lastDecoction || undefined,
        totalStock: parseInt(row.totalStock) || 0,
        currentStock: parseInt(row.currentStock) || 0,
        dosesPerBatch: parseInt(row.dosesPerBatch) || 20,
        packsPerBatch: parseInt(row.packsPerBatch) || 30,
        category: row.category || '상비약',
        isActive: parseIsActive(row.isActive),
      }))

      const result = await bulkUpsertMedicineInventory(items, bulkImportMode)

      alert(
        `등록 완료!\n` +
        `- 신규: ${result.inserted}건\n` +
        `- 업데이트: ${result.updated}건\n` +
        `- 건너뜀: ${result.skipped}건\n` +
        `- 실패: ${result.failed}건` +
        (result.errors.length > 0 ? `\n\n오류:\n${result.errors.slice(0, 5).join('\n')}` : '')
      )

      onSuccess()
    } catch (err: any) {
      alert(`저장 오류: ${err.message}`)
      setBulkImportStep('validate')
    } finally {
      setIsProcessing(false)
    }
  }

  // 템플릿 다운로드
  const downloadTemplate = () => {
    const templateData = [
      {
        '처방명': '쌍화탕',
        '최근탕전일': '2024-11-01',
        '누적': 200,
        '재고': 50,
        '첩': 20,
        '팩': 30,
        '분류': '상비약',
        '사용': 'O',
      },
      {
        '처방명': '보중익기탕',
        '최근탕전일': '2024-10-15',
        '누적': 150,
        '재고': 30,
        '첩': 20,
        '팩': 30,
        '분류': '상비약',
        '사용': 'O',
      },
    ]

    const worksheet = XLSX.utils.json_to_sheet(templateData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, '상비약목록')
    XLSX.writeFile(workbook, '상비약_일괄등록_템플릿.xlsx')
  }

  // 통계 계산
  const stats = {
    total: validatedRows.length,
    insert: validatedRows.filter(r => r.status === 'insert').length,
    update: validatedRows.filter(r => r.status === 'update').length,
    skip: validatedRows.filter(r => r.status === 'skip').length,
    error: validatedRows.filter(r => r.status === 'error').length,
  }

  const displayRows = showOnlyErrors
    ? validatedRows.filter(r => r.status === 'error')
    : validatedRows

  return (
    <div className="space-y-6">
      {/* 업로드 단계 */}
      {bulkImportStep === 'upload' && (
        <>
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
                  <p><strong>헤더 형식:</strong> 처방명, 최근탕전일, 누적, 재고, 첩, 팩, 분류, 사용</p>
                  <p><strong>분류:</strong> 자유 입력 (관리 목적에 맞게 분류)</p>
                  <p><strong>사용:</strong> O/X 또는 Y/N</p>
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

          {/* 모드 선택 */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-900 mb-3">등록 모드 선택</h3>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="importMode"
                  checked={bulkImportMode === 'overwrite'}
                  onChange={() => setBulkImportMode('overwrite')}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="font-medium">덮어쓰기</span>
                <span className="text-sm text-gray-500">(기존 데이터 업데이트)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="importMode"
                  checked={bulkImportMode === 'newOnly'}
                  onChange={() => setBulkImportMode('newOnly')}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="font-medium">신규만</span>
                <span className="text-sm text-gray-500">(새 처방만 등록)</span>
              </label>
            </div>
          </div>

          {/* 파일 업로드 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              엑셀 파일 업로드
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileSelect}
              disabled={isProcessing}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {isProcessing && (
              <p className="text-sm text-blue-600 mt-2">파일 처리 중...</p>
            )}
          </div>

          {/* 취소 버튼 */}
          <div className="flex justify-end pt-4 border-t">
            <button
              type="button"
              onClick={onSuccess}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              취소
            </button>
          </div>
        </>
      )}

      {/* 검증 단계 */}
      {bulkImportStep === 'validate' && (
        <>
          {/* 통계 및 컨트롤 */}
          <div className="flex justify-between items-center flex-wrap gap-3">
            <div className="flex gap-4 items-center text-sm">
              <span>총 <strong>{stats.total}</strong>건</span>
              <span className="text-green-600">등록: {stats.insert}</span>
              <span className="text-blue-600">업데이트: {stats.update}</span>
              <span className="text-gray-500">건너뜀: {stats.skip}</span>
              <span className="text-red-600">오류: {stats.error}</span>
            </div>

            <div className="flex gap-2 items-center">
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input
                  type="checkbox"
                  checked={showOnlyErrors}
                  onChange={(e) => setShowOnlyErrors(e.target.checked)}
                  className="w-4 h-4"
                />
                오류만 보기
              </label>
              <button
                onClick={revalidateAll}
                disabled={isProcessing}
                className="px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
              >
                전체 재검증
              </button>
              <button
                onClick={() => { setBulkImportStep('upload'); setValidatedRows([]) }}
                className="px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
              >
                다시 선택
              </button>
            </div>
          </div>

          {/* 검증 결과 테이블 */}
          <div className="border border-gray-300 rounded-lg overflow-hidden">
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-center w-16">상태</th>
                    <th className="px-3 py-2 text-left">처방명</th>
                    <th className="px-3 py-2 text-center w-24">최근탕전일</th>
                    <th className="px-3 py-2 text-center w-16">누적</th>
                    <th className="px-3 py-2 text-center w-16">재고</th>
                    <th className="px-3 py-2 text-center w-12">첩</th>
                    <th className="px-3 py-2 text-center w-12">팩</th>
                    <th className="px-3 py-2 text-center w-20">분류</th>
                    <th className="px-3 py-2 text-center w-12">사용</th>
                    <th className="px-3 py-2 text-left">오류</th>
                    <th className="px-3 py-2 text-center w-16">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {displayRows.map((row) => {
                    const isEditing = editingRowIndex === row.rowIndex
                    const statusConfig = {
                      insert: { bg: 'bg-green-50', color: 'text-green-600', border: 'border-green-500', label: '등록' },
                      update: { bg: 'bg-blue-50', color: 'text-blue-600', border: 'border-blue-500', label: '업데이트' },
                      skip: { bg: 'bg-gray-50', color: 'text-gray-500', border: 'border-gray-400', label: '건너뜀' },
                      error: { bg: 'bg-red-50', color: 'text-red-600', border: 'border-red-500', label: '오류' },
                    }
                    const config = statusConfig[row.status]
                    const errorFields = new Set(row.errors.map(e => e.field))

                    return (
                      <tr key={row.rowIndex} className={config.bg}>
                        <td className="px-3 py-2 text-center">
                          <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium border ${config.color} ${config.border} bg-white`}>
                            {config.label}
                          </span>
                        </td>
                        <td className={`px-3 py-2 ${errorFields.has('name') ? 'border-l-4 border-red-500' : ''}`}>
                          {isEditing ? (
                            <input
                              value={row.name}
                              onChange={(e) => handleRowChange(row.rowIndex, 'name', e.target.value)}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                            />
                          ) : row.name}
                        </td>
                        <td className={`px-3 py-2 text-center ${errorFields.has('lastDecoction') ? 'border-l-4 border-red-500' : ''}`}>
                          {isEditing ? (
                            <input
                              value={row.lastDecoction}
                              onChange={(e) => handleRowChange(row.rowIndex, 'lastDecoction', e.target.value)}
                              placeholder="YYYY-MM-DD"
                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-center"
                            />
                          ) : (row.lastDecoction || '-')}
                        </td>
                        <td className={`px-3 py-2 text-center ${errorFields.has('totalStock') ? 'border-l-4 border-red-500' : ''}`}>
                          {isEditing ? (
                            <input
                              type="number"
                              value={row.totalStock}
                              onChange={(e) => handleRowChange(row.rowIndex, 'totalStock', e.target.value)}
                              className="w-14 px-1 py-1 border border-gray-300 rounded text-sm text-center"
                            />
                          ) : row.totalStock}
                        </td>
                        <td className={`px-3 py-2 text-center ${errorFields.has('currentStock') ? 'border-l-4 border-red-500' : ''}`}>
                          {isEditing ? (
                            <input
                              type="number"
                              value={row.currentStock}
                              onChange={(e) => handleRowChange(row.rowIndex, 'currentStock', e.target.value)}
                              className="w-14 px-1 py-1 border border-gray-300 rounded text-sm text-center"
                            />
                          ) : row.currentStock}
                        </td>
                        <td className={`px-3 py-2 text-center ${errorFields.has('dosesPerBatch') ? 'border-l-4 border-red-500' : ''}`}>
                          {isEditing ? (
                            <input
                              type="number"
                              value={row.dosesPerBatch}
                              onChange={(e) => handleRowChange(row.rowIndex, 'dosesPerBatch', e.target.value)}
                              className="w-12 px-1 py-1 border border-gray-300 rounded text-sm text-center"
                            />
                          ) : row.dosesPerBatch}
                        </td>
                        <td className={`px-3 py-2 text-center ${errorFields.has('packsPerBatch') ? 'border-l-4 border-red-500' : ''}`}>
                          {isEditing ? (
                            <input
                              type="number"
                              value={row.packsPerBatch}
                              onChange={(e) => handleRowChange(row.rowIndex, 'packsPerBatch', e.target.value)}
                              className="w-12 px-1 py-1 border border-gray-300 rounded text-sm text-center"
                            />
                          ) : row.packsPerBatch}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {isEditing ? (
                            <input
                              value={row.category}
                              onChange={(e) => handleRowChange(row.rowIndex, 'category', e.target.value)}
                              className="w-20 px-1 py-1 border border-gray-300 rounded text-sm text-center"
                            />
                          ) : (row.category || '-')}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {isEditing ? (
                            <select
                              value={row.isActive}
                              onChange={(e) => handleRowChange(row.rowIndex, 'isActive', e.target.value)}
                              className="px-1 py-1 border border-gray-300 rounded text-sm"
                            >
                              <option value="O">O</option>
                              <option value="X">X</option>
                            </select>
                          ) : row.isActive}
                        </td>
                        <td className="px-3 py-2 text-xs text-red-600">
                          {row.errors.map(e => e.message).join(', ')}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {isEditing ? (
                            <button
                              onClick={() => revalidateRow(row.rowIndex)}
                              className="px-2 py-1 bg-green-500 text-white rounded text-xs hover:bg-green-600"
                            >
                              확인
                            </button>
                          ) : (
                            <button
                              onClick={() => setEditingRowIndex(row.rowIndex)}
                              className="px-2 py-1 border border-gray-300 rounded text-xs hover:bg-gray-100"
                            >
                              수정
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
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
              type="button"
              onClick={handleSave}
              disabled={isProcessing || (stats.insert === 0 && stats.update === 0)}
              className={`px-6 py-2 rounded-lg font-medium text-white transition-colors ${
                (stats.insert > 0 || stats.update > 0) && !isProcessing
                  ? 'bg-blue-600 hover:bg-blue-700'
                  : 'bg-gray-300 cursor-not-allowed'
              }`}
            >
              {stats.insert + stats.update}개 등록하기
            </button>
          </div>
        </>
      )}

      {/* 저장 중 */}
      {bulkImportStep === 'saving' && (
        <div className="py-20 text-center">
          <div className="text-lg font-medium text-gray-900 mb-2">저장 중...</div>
          <p className="text-gray-500">잠시만 기다려주세요.</p>
        </div>
      )}
    </div>
  )
}

export default BulkMedicineUpload
