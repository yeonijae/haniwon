import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { herbsApi } from '../api/herbs';
import { suppliesApi } from '../api/supplies';
import OrderFormModal from '../components/OrderFormModal';

function Dashboard() {
  const [showOrderModal, setShowOrderModal] = useState(false);

  const { data: lowStockData } = useQuery({
    queryKey: ['herbs', 'low-stock'],
    queryFn: () => herbsApi.getLowStock()
  });

  const { data: allHerbs } = useQuery({
    queryKey: ['herbs', { isActive: true }],
    queryFn: () => herbsApi.getAll({ isActive: true })
  });

  const { data: supplyStats } = useQuery({
    queryKey: ['supplies', 'stats'],
    queryFn: () => suppliesApi.getStats()
  });

  const { data: pendingSupplies } = useQuery({
    queryKey: ['supplies', 'pending'],
    queryFn: async () => {
      const all = await suppliesApi.getAll();
      return all?.filter(item => item.status === 'pending') || [];
    }
  });

  // 통계 계산
  const totalHerbs = allHerbs?.length || 0;
  const lowStockCount = lowStockData?.length || 0;
  const pendingCount = pendingSupplies?.length || 0;
  const completedCount = supplyStats?.completed || 0;

  return (
    <div className="h-full overflow-hidden p-4">
      {/* 5개 섹션 가로 배열 */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3 h-full">
        {/* 1. 약재 관리 섹션 */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden flex flex-col">
          <div className="bg-blue-50 px-3 py-2 border-b border-blue-100 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="bg-clinic-secondary w-9 h-9 rounded-lg flex items-center justify-center mr-2">
                  <i className="fa-solid fa-leaf text-white text-base"></i>
                </div>
                <h3 className="text-base font-bold text-clinic-text-primary">약재 관리</h3>
              </div>
              <button
                onClick={() => setShowOrderModal(true)}
                disabled={lowStockCount === 0}
                className="px-3 py-1.5 bg-clinic-secondary text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <i className="fa-solid fa-file-invoice mr-1.5"></i>
                주문서 생성
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            {/* 재고 부족 알림 */}
            {lowStockData && lowStockData.length > 0 ? (
              <div className="border border-red-200 rounded-lg overflow-hidden">
                <div className="bg-red-50 px-3 py-2 flex items-center">
                  <i className="fa-solid fa-triangle-exclamation text-red-600 mr-2 text-sm"></i>
                  <span className="text-sm font-medium text-red-900">재고 부족 ({lowStockCount}개)</span>
                </div>
                <div className="grid grid-cols-2 gap-2 p-2">
                  {lowStockData.map((herb: any) => (
                    <div key={herb.id} className="bg-white border border-gray-200 rounded-lg p-2.5 hover:bg-gray-50 transition-colors">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-medium text-sm text-gray-900 truncate" title={herb.name}>
                          {herb.name}
                        </span>
                        <span className="text-sm font-bold text-red-600 whitespace-nowrap">
                          {herb.current_stock.toLocaleString()}g
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="border border-green-200 bg-green-50 rounded-lg p-4 text-center">
                <i className="fa-solid fa-check-circle text-green-600 text-2xl mb-2"></i>
                <p className="text-sm text-green-900 font-medium">재고 충분</p>
              </div>
            )}
          </div>
        </div>

        {/* 2. 탕전 관리 섹션 */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden flex flex-col">
          <div className="bg-orange-50 px-3 py-2 border-b border-orange-100 flex-shrink-0">
            <div className="flex items-center">
              <div className="bg-orange-500 w-9 h-9 rounded-lg flex items-center justify-center mr-2">
                <i className="fa-solid fa-fire-burner text-white text-base"></i>
              </div>
              <h3 className="text-base font-bold text-clinic-text-primary">탕전 관리</h3>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">오늘 탕전</span>
                <span className="text-lg font-bold text-orange-500">0건</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">대기 중</span>
                <span className="text-lg font-bold text-orange-500">0건</span>
              </div>
            </div>
          </div>
        </div>

        {/* 3. 상비약 관리 섹션 */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden flex flex-col">
          <div className="bg-purple-50 px-3 py-2 border-b border-purple-100 flex-shrink-0">
            <div className="flex items-center">
              <div className="bg-purple-500 w-9 h-9 rounded-lg flex items-center justify-center mr-2">
                <i className="fa-solid fa-pills text-white text-base"></i>
              </div>
              <h3 className="text-base font-bold text-clinic-text-primary">상비약 관리</h3>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">총 상비약</span>
                <span className="text-lg font-bold text-purple-500">0개</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">재고 부족</span>
                <span className="text-lg font-bold text-purple-500">0개</span>
              </div>
            </div>
          </div>
        </div>

        {/* 4. 물품 관리 섹션 */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden flex flex-col">
          <div className="bg-yellow-50 px-3 py-2 border-b border-yellow-100 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="bg-yellow-500 w-9 h-9 rounded-lg flex items-center justify-center mr-2">
                  <i className="fa-solid fa-clipboard-list text-white text-base"></i>
                </div>
                <h3 className="text-base font-bold text-clinic-text-primary">물품 관리</h3>
              </div>
              <span className="text-sm font-medium text-yellow-700">
                {pendingCount}건 대기
              </span>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            {pendingSupplies && pendingSupplies.length > 0 ? (
              <div className="space-y-2">
                {pendingSupplies.map((item: any) => (
                  <div
                    key={item.id}
                    className="bg-yellow-50 border border-yellow-200 rounded-lg p-2.5 hover:bg-yellow-100 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm text-gray-900 flex-1 line-clamp-2">
                        {item.item_name}
                      </p>
                    </div>
                    <div className="flex items-center text-xs text-gray-500 mt-1">
                      <i className="fa-solid fa-user mr-1"></i>
                      <span>{item.requested_by}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="border border-green-200 bg-green-50 rounded-lg p-4 text-center">
                <i className="fa-solid fa-check-circle text-green-600 text-2xl mb-2"></i>
                <p className="text-sm text-green-900 font-medium">요청 없음</p>
              </div>
            )}
          </div>
        </div>

        {/* 5. 배송 관리 섹션 */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden flex flex-col">
          <div className="bg-green-50 px-3 py-2 border-b border-green-100 flex-shrink-0">
            <div className="flex items-center">
              <div className="bg-clinic-accent w-9 h-9 rounded-lg flex items-center justify-center mr-2">
                <i className="fa-solid fa-truck text-white text-base"></i>
              </div>
              <h3 className="text-base font-bold text-clinic-text-primary">배송 관리</h3>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">오늘 배송</span>
                <span className="text-lg font-bold text-clinic-accent">0건</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">배송 대기</span>
                <span className="text-lg font-bold text-clinic-accent">0건</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Order Form Modal */}
      {showOrderModal && lowStockData && (
        <OrderFormModal
          lowStockHerbs={lowStockData}
          onClose={() => setShowOrderModal(false)}
        />
      )}
    </div>
  );
}

export default Dashboard;
