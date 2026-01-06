import { useState, useEffect } from 'react'
import { Herb } from '../api/herbs'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { getCurrentDate } from '@shared/lib/postgres'

interface OrderFormModalProps {
  lowStockHerbs: Herb[]
  onClose: () => void
}

interface OrderItem {
  herb: Herb
  suggestedQuantity: number
  orderQuantity: number
  totalCost: number
}

function OrderFormModal({ lowStockHerbs, onClose }: OrderFormModalProps) {
  const [orderItems, setOrderItems] = useState<OrderItem[]>([])

  useEffect(() => {
    // 일주일치 예상 사용량 기반으로 주문량 계산
    const items = lowStockHerbs.map(herb => {
      // 임시 계산 로직: (최소 재고 * 2) - 현재 재고
      // 나중에 실제 사용량 데이터 기반으로 개선
      const weeklyEstimate = herb.min_stock * 2
      const suggestedQuantity = Math.max(0, weeklyEstimate - herb.current_stock)

      return {
        herb,
        suggestedQuantity,
        orderQuantity: suggestedQuantity,
        totalCost: suggestedQuantity * herb.unit_cost
      }
    })
    setOrderItems(items)
  }, [lowStockHerbs])

  const handleQuantityChange = (index: number, value: string) => {
    const newQuantity = parseFloat(value) || 0
    setOrderItems(prev => {
      const newItems = [...prev]
      newItems[index] = {
        ...newItems[index],
        orderQuantity: newQuantity,
        totalCost: newQuantity * newItems[index].herb.unit_cost
      }
      return newItems
    })
  }

  const totalAmount = orderItems.reduce((sum, item) => sum + item.totalCost, 0)

  const generatePDF = () => {
    const doc = new jsPDF()

    // 한글 폰트 설정 (기본 폰트 사용)
    doc.setFont('helvetica')

    // 제목
    doc.setFontSize(18)
    doc.text('Yakjae Order Form', 105, 20, { align: 'center' })

    // 날짜
    const today = new Date().toLocaleDateString('ko-KR')
    doc.setFontSize(10)
    doc.text(`Order Date: ${today}`, 14, 30)

    // 거래처별로 그룹화
    const groupedByOrigin: { [key: string]: OrderItem[] } = {}
    orderItems.forEach(item => {
      const origin = item.herb.origin || 'Unknown'
      if (!groupedByOrigin[origin]) {
        groupedByOrigin[origin] = []
      }
      if (item.orderQuantity > 0) {
        groupedByOrigin[origin].push(item)
      }
    })

    let yPosition = 40

    // 거래처별로 테이블 생성
    Object.entries(groupedByOrigin).forEach(([origin, items]) => {
      doc.setFontSize(12)
      doc.text(`Supplier: ${origin}`, 14, yPosition)
      yPosition += 5

      const tableData = items.map(item => [
        item.herb.name,
        `${item.herb.current_stock.toLocaleString()}g`,
        `${item.orderQuantity.toLocaleString()}g`,
        `${item.herb.unit_cost.toLocaleString()} won/g`,
        `${item.totalCost.toLocaleString()} won`
      ])

      autoTable(doc, {
        startY: yPosition,
        head: [['Herb Name', 'Current Stock', 'Order Qty', 'Unit Price', 'Total']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [30, 58, 138] },
        margin: { left: 14 }
      })

      yPosition = (doc as any).lastAutoTable.finalY + 10
    })

    // 총 금액
    doc.setFontSize(12)
    doc.text(`Total Amount: ${totalAmount.toLocaleString()} won`, 14, yPosition)

    // PDF 저장
    const fileName = `order_${getCurrentDate()}.pdf`
    doc.save(fileName)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-clinic-secondary text-white px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">약재 주문서 만들기</h2>
            <p className="text-sm mt-1">일주일치 예상 재고를 바탕으로 주문량을 조정하세요</p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-200 transition-colors"
          >
            <i className="fa-solid fa-xmark text-2xl"></i>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
          {orderItems.length === 0 ? (
            <div className="text-center py-12">
              <i className="fa-solid fa-box-open text-6xl text-gray-300 mb-4"></i>
              <p className="text-clinic-text-secondary">주문이 필요한 약재가 없습니다.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">약재명</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">거래처</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">현재 재고</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">최소 재고</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">권장 주문량</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">주문 수량</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">단가</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">예상 금액</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {orderItems.map((item, index) => (
                    <tr key={item.herb.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.herb.name}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{item.herb.origin || '-'}</td>
                      <td className="px-4 py-3 text-sm text-red-600 font-bold">
                        {item.herb.current_stock.toLocaleString()}g
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">{item.herb.min_stock}g</td>
                      <td className="px-4 py-3 text-sm text-blue-600 font-semibold">
                        {item.suggestedQuantity.toLocaleString()}g
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          value={item.orderQuantity}
                          onChange={(e) => handleQuantityChange(index, e.target.value)}
                          className="w-24 px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-clinic-secondary focus:border-transparent"
                          step="1"
                          min="0"
                        />
                        <span className="text-sm text-gray-500 ml-1">g</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {item.herb.unit_cost.toLocaleString()}원/g
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-clinic-accent">
                        {item.totalCost.toLocaleString()}원
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td colSpan={7} className="px-4 py-3 text-right text-sm font-bold text-gray-900">
                      총 주문 금액:
                    </td>
                    <td className="px-4 py-3 text-sm font-bold text-clinic-secondary">
                      {totalAmount.toLocaleString()}원
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* 안내 메시지 */}
          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start">
              <i className="fa-solid fa-circle-info text-blue-500 mr-2 mt-1"></i>
              <div className="text-sm text-blue-900">
                <p className="font-semibold mb-1">주문량 계산 방식</p>
                <p>• 권장 주문량 = (최소 재고 × 2) - 현재 재고</p>
                <p>• 실제 사용량 데이터가 쌓이면 더 정확한 예측이 가능합니다.</p>
                <p>• 주문 수량을 직접 조정하신 후 PDF로 저장하세요.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end space-x-3 px-6 py-4 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
          >
            취소
          </button>
          <button
            onClick={generatePDF}
            disabled={orderItems.length === 0}
            className="px-6 py-2 bg-clinic-secondary text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <i className="fa-solid fa-file-pdf mr-2"></i>
            PDF로 저장
          </button>
        </div>
      </div>
    </div>
  )
}

export default OrderFormModal
