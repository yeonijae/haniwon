import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { herbsApi, Herb } from '../api/herbs';
import StockInModal from '../components/StockInModal';
import StockOutModal from '../components/StockOutModal';
import EditHerbModal from '../components/EditHerbModal';

type SortField = 'name' | 'origin' | 'current_stock' | 'unit_cost';
type SortOrder = 'asc' | 'desc';
type TabType = 'inventory' | 'orders' | 'pricing' | 'statistics';

function HerbList() {
  const [activeTab, setActiveTab] = useState<TabType>('inventory');
  const [search, setSearch] = useState('');
  const [selectedHerb, setSelectedHerb] = useState<Herb | null>(null);
  const [showStockInModal, setShowStockInModal] = useState(false);
  const [showStockOutModal, setShowStockOutModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  const { data: herbs, isLoading, error } = useQuery({
    queryKey: ['herbs', { search }],
    queryFn: () => herbsApi.getAll({ search, isActive: true })
  });

  // 정렬 핸들러
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // 같은 필드를 클릭하면 정렬 순서 토글
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      // 다른 필드를 클릭하면 해당 필드로 오름차순 정렬
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // 정렬 값 추출 함수
  const getSortValue = (herb: Herb, field: SortField): string | number => {
    switch (field) {
      case 'name':
        return herb.name.toLowerCase();
      case 'origin':
        return (herb.origin || '').toLowerCase();
      case 'current_stock':
        return herb.current_stock;
      case 'unit_cost':
        return herb.unit_cost;
      default:
        return '';
    }
  };

  // 정렬 비교 함수
  const compareHerbs = (a: Herb, b: Herb): number => {
    const aValue = getSortValue(a, sortField);
    const bValue = getSortValue(b, sortField);

    if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  };

  // 정렬된 데이터
  const sortedHerbs = useMemo(() => {
    if (!herbs) return [];
    return [...herbs].sort(compareHerbs);
  }, [herbs, sortField, sortOrder]);

  const handleStockIn = (herb: Herb) => {
    setSelectedHerb(herb);
    setShowStockInModal(true);
  };

  const handleStockOut = (herb: Herb) => {
    setSelectedHerb(herb);
    setShowStockOutModal(true);
  };

  const handleEdit = (herb: Herb) => {
    setSelectedHerb(herb);
    setShowEditModal(true);
  };

  // 모달 닫기 및 상태 초기화
  const handleCloseModal = () => {
    setShowStockInModal(false);
    setShowStockOutModal(false);
    setShowEditModal(false);
    setSelectedHerb(null);
  };

  // 한봉당 용량 추출
  const extractPackageSize = (description?: string): string => {
    const match = description?.match(/한봉당 용량: (\d+)g/);
    return match ? match[1] : '-';
  };

  const tabs = [
    { id: 'inventory' as TabType, label: '약재 재고', icon: 'fa-boxes-stacked' },
    { id: 'orders' as TabType, label: '주문서 관리', icon: 'fa-file-invoice' },
    { id: 'pricing' as TabType, label: '단가 관리', icon: 'fa-coins' },
    { id: 'statistics' as TabType, label: '사용량 통계', icon: 'fa-chart-line' }
  ];

  return (
    <div className="h-full overflow-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-clinic-text-primary mb-2">약재 관리</h2>
          <p className="text-clinic-text-secondary">약재 재고 현황 및 입출고 관리</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                py-4 px-1 border-b-2 font-medium text-sm flex items-center transition-colors
                ${activeTab === tab.id
                  ? 'border-clinic-secondary text-clinic-secondary'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `}
            >
              <i className={`fa-solid ${tab.icon} mr-2`}></i>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'inventory' && (
      <div className="bg-white rounded-lg shadow-sm">
        <div className="p-4 border-b border-gray-200">
          <div className="relative">
            <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"></i>
            <input
              type="text"
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-clinic-secondary focus:border-transparent"
              placeholder="약재명 또는 코드로 검색..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-clinic-text-secondary">
            <i className="fa-solid fa-spinner fa-spin text-2xl mb-2"></i>
            <p>로딩 중...</p>
          </div>
        ) : error ? (
          <div className="text-center py-12 text-red-600">
            <i className="fa-solid fa-exclamation-circle text-2xl mb-2"></i>
            <p>데이터를 불러오는데 실패했습니다.</p>
          </div>
        ) : sortedHerbs && sortedHerbs.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">코드</th>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center">
                      약재명
                      {sortField === 'name' && (
                        <i className={`fa-solid fa-sort-${sortOrder === 'asc' ? 'up' : 'down'} ml-1 text-clinic-secondary`}></i>
                      )}
                    </div>
                  </th>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                    onClick={() => handleSort('origin')}
                  >
                    <div className="flex items-center">
                      거래처
                      {sortField === 'origin' && (
                        <i className={`fa-solid fa-sort-${sortOrder === 'asc' ? 'up' : 'down'} ml-1 text-clinic-secondary`}></i>
                      )}
                    </div>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">한봉당 용량</th>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                    onClick={() => handleSort('current_stock')}
                  >
                    <div className="flex items-center">
                      현재 재고
                      {sortField === 'current_stock' && (
                        <i className={`fa-solid fa-sort-${sortOrder === 'asc' ? 'up' : 'down'} ml-1 text-clinic-secondary`}></i>
                      )}
                    </div>
                  </th>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                    onClick={() => handleSort('unit_cost')}
                  >
                    <div className="flex items-center">
                      단가
                      {sortField === 'unit_cost' && (
                        <i className={`fa-solid fa-sort-${sortOrder === 'asc' ? 'up' : 'down'} ml-1 text-clinic-secondary`}></i>
                      )}
                    </div>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">작업</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sortedHerbs.map((herb: Herb) => {
                  const packageSize = extractPackageSize(herb.description);

                  return (
                    <tr key={herb.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{herb.code}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{herb.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{herb.origin || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{packageSize}g</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold">
                        <span className={herb.current_stock <= herb.min_stock ? 'text-red-600' : 'text-clinic-accent'}>
                          {herb.current_stock.toLocaleString()}g
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{herb.unit_cost.toLocaleString()}원/g</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                        <button
                          onClick={() => handleEdit(herb)}
                          className="text-clinic-secondary hover:text-blue-700"
                        >
                          <i className="fa-solid fa-pen-to-square mr-1"></i>
                          수정
                        </button>
                        <button
                          onClick={() => handleStockIn(herb)}
                          className="text-clinic-accent hover:text-green-700"
                        >
                          <i className="fa-solid fa-arrow-down mr-1"></i>
                          입고
                        </button>
                        <button
                          onClick={() => handleStockOut(herb)}
                          className="text-orange-500 hover:text-orange-700"
                        >
                          <i className="fa-solid fa-arrow-up mr-1"></i>
                          출고
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <i className="fa-solid fa-box-open text-6xl text-gray-300 mb-4"></i>
            <p className="text-clinic-text-secondary">등록된 약재가 없습니다.</p>
          </div>
        )}
      </div>
      )}

      {/* 주문서 관리 탭 */}
      {activeTab === 'orders' && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="text-center py-12">
            <i className="fa-solid fa-file-invoice text-6xl text-gray-300 mb-4"></i>
            <p className="text-clinic-text-secondary">주문서 관리 기능 준비중</p>
          </div>
        </div>
      )}

      {/* 단가 관리 탭 */}
      {activeTab === 'pricing' && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="text-center py-12">
            <i className="fa-solid fa-coins text-6xl text-gray-300 mb-4"></i>
            <p className="text-clinic-text-secondary">단가 관리 기능 준비중</p>
          </div>
        </div>
      )}

      {/* 사용량 통계 탭 */}
      {activeTab === 'statistics' && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="text-center py-12">
            <i className="fa-solid fa-chart-line text-6xl text-gray-300 mb-4"></i>
            <p className="text-clinic-text-secondary">사용량 통계 기능 준비중</p>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedHerb && (
        <EditHerbModal herb={selectedHerb} onClose={handleCloseModal} />
      )}

      {/* Stock In Modal */}
      {showStockInModal && selectedHerb && (
        <StockInModal herb={selectedHerb} onClose={handleCloseModal} />
      )}

      {/* Stock Out Modal */}
      {showStockOutModal && selectedHerb && (
        <StockOutModal herb={selectedHerb} onClose={handleCloseModal} />
      )}
    </div>
  );
}

export default HerbList;
