/**
 * 한약 배송/수령 관리 화면
 * 탕전 완료된 패키지의 배송/수령 상태 관리
 */

import { useState, useEffect, useCallback } from 'react';
import {
  getDeliveryPendingPackages,
  updateTrackingNumber,
  markPickupNotified,
  markShippingNotified,
  markAsDelivered,
} from '@modules/cs/lib/decoctionApi';
import { autoRegisterDeliveryHappyCall } from '@modules/cs/lib/automationApi';
import { query } from '@shared/lib/postgres';
import type { HerbalPackage, DeliveryMethod, PackageDeliveryStatus } from '@modules/cs/types';
import { DELIVERY_METHOD_LABELS } from '@modules/cs/types';

type DeliveryPackage = HerbalPackage & {
  patient_phone?: string;
  patient_address?: string;
};

// 배송 상태 라벨
const DELIVERY_STATUS_LABELS: Record<PackageDeliveryStatus, string> = {
  pending: '대기',
  ready: '준비완료',
  shipped: '배송중',
  delivered: '완료',
};

// 배송 상태 색상
const STATUS_COLORS: Record<PackageDeliveryStatus, { bg: string; text: string }> = {
  pending: { bg: 'bg-gray-100', text: 'text-gray-700' },
  ready: { bg: 'bg-blue-100', text: 'text-blue-700' },
  shipped: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  delivered: { bg: 'bg-green-100', text: 'text-green-700' },
};

function HerbalDeliveryManager() {
  const [packages, setPackages] = useState<DeliveryPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | DeliveryMethod>('all');
  const [trackingInputId, setTrackingInputId] = useState<number | null>(null);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [processingId, setProcessingId] = useState<number | null>(null);

  // 데이터 로드
  const loadPackages = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getDeliveryPendingPackages();
      setPackages(data);
    } catch (error) {
      console.error('배송 목록 로드 오류:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // 완료된 패키지 목록 (오늘 완료된 것만)
  const [completedPackages, setCompletedPackages] = useState<DeliveryPackage[]>([]);
  const [showCompleted, setShowCompleted] = useState(false);

  const loadCompletedPackages = useCallback(async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const sql = `
        SELECT hp.*
        FROM cs_herbal_packages hp
        WHERE hp.delivery_status = 'delivered'
          AND hp.delivery_completed_at::date = '${today}'
        ORDER BY hp.delivery_completed_at DESC
      `;
      const data = await query<DeliveryPackage>(sql);
      setCompletedPackages(data);
    } catch (error) {
      console.error('완료 목록 로드 오류:', error);
    }
  }, []);

  useEffect(() => {
    loadPackages();
    loadCompletedPackages();
    const interval = setInterval(() => {
      loadPackages();
      loadCompletedPackages();
    }, 60 * 1000);
    return () => clearInterval(interval);
  }, [loadPackages, loadCompletedPackages]);

  // 필터링된 패키지
  const filteredPackages = filter === 'all'
    ? packages
    : packages.filter(p => p.delivery_method === filter);

  // 내원 수령 알림
  const handlePickupNotify = async (pkg: DeliveryPackage) => {
    try {
      setProcessingId(pkg.id || null);
      await markPickupNotified(pkg.id!);
      alert(`${pkg.patient_name}님께 수령 안내를 발송했습니다.`);
      loadPackages();
    } catch (error) {
      console.error('수령 알림 오류:', error);
      alert('수령 알림 발송에 실패했습니다.');
    } finally {
      setProcessingId(null);
    }
  };

  // 송장번호 등록
  const handleTrackingSubmit = async (pkg: DeliveryPackage) => {
    if (!trackingNumber.trim()) {
      alert('송장번호를 입력해주세요.');
      return;
    }

    try {
      setProcessingId(pkg.id || null);
      await updateTrackingNumber(pkg.id!, trackingNumber.trim());
      setTrackingInputId(null);
      setTrackingNumber('');
      alert('송장번호가 등록되었습니다.');
      loadPackages();
    } catch (error) {
      console.error('송장번호 등록 오류:', error);
      alert('송장번호 등록에 실패했습니다.');
    } finally {
      setProcessingId(null);
    }
  };

  // 배송 알림 발송
  const handleShippingNotify = async (pkg: DeliveryPackage) => {
    try {
      setProcessingId(pkg.id || null);
      await markShippingNotified(pkg.id!);
      alert(`${pkg.patient_name}님께 배송 알림을 발송했습니다.`);
      loadPackages();
    } catch (error) {
      console.error('배송 알림 오류:', error);
      alert('배송 알림 발송에 실패했습니다.');
    } finally {
      setProcessingId(null);
    }
  };

  // 수령/배송 완료 처리
  const handleComplete = async (pkg: DeliveryPackage) => {
    const methodLabel = pkg.delivery_method === 'pickup' ? '수령' : '배송';
    if (!confirm(`${pkg.patient_name}님 ${methodLabel} 완료 처리하시겠습니까?`)) return;

    try {
      setProcessingId(pkg.id || null);
      await markAsDelivered(pkg.id!);

      // 해피콜 자동 등록
      const happyCallResult = await autoRegisterDeliveryHappyCall(pkg.id!);
      if (happyCallResult.success) {
        console.log('해피콜 자동 등록 완료:', happyCallResult.careItemId);
      }

      alert(`${methodLabel} 완료 처리되었습니다.\n(해피콜 일정이 자동 등록되었습니다)`);
      loadPackages();
      loadCompletedPackages();
    } catch (error) {
      console.error('완료 처리 오류:', error);
      alert('완료 처리에 실패했습니다.');
    } finally {
      setProcessingId(null);
    }
  };

  // 통계
  const stats = {
    total: packages.length,
    pickup: packages.filter(p => p.delivery_method === 'pickup').length,
    local: packages.filter(p => p.delivery_method === 'local').length,
    express: packages.filter(p => p.delivery_method === 'express').length,
    completed: completedPackages.length,
  };

  return (
    <div className="h-full overflow-auto bg-gray-50">
      {/* 헤더 */}
      <div className="page-header bg-white border-b sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold text-gray-800">한약 배송/수령 관리</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCompleted(!showCompleted)}
              className={`btn ${showCompleted ? 'btn-primary' : 'btn-outline'}`}
            >
              <i className="fa-solid fa-check-double mr-2"></i>
              오늘 완료 ({stats.completed})
            </button>
            <button
              onClick={() => { loadPackages(); loadCompletedPackages(); }}
              className="btn btn-outline"
              disabled={loading}
            >
              <i className="fa-solid fa-refresh mr-2"></i>
              새로고침
            </button>
          </div>
        </div>

        {/* 필터 및 통계 */}
        <div className="flex items-center gap-4 mt-4">
          <div className="flex gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filter === 'all'
                  ? 'bg-gray-800 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              전체 ({stats.total})
            </button>
            <button
              onClick={() => setFilter('pickup')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filter === 'pickup'
                  ? 'bg-blue-600 text-white'
                  : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
              }`}
            >
              <i className="fa-solid fa-store mr-1"></i>
              내원 ({stats.pickup})
            </button>
            <button
              onClick={() => setFilter('local')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filter === 'local'
                  ? 'bg-green-600 text-white'
                  : 'bg-green-50 text-green-600 hover:bg-green-100'
              }`}
            >
              <i className="fa-solid fa-motorcycle mr-1"></i>
              시내배송 ({stats.local})
            </button>
            <button
              onClick={() => setFilter('express')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filter === 'express'
                  ? 'bg-purple-600 text-white'
                  : 'bg-purple-50 text-purple-600 hover:bg-purple-100'
              }`}
            >
              <i className="fa-solid fa-truck mr-1"></i>
              택배 ({stats.express})
            </button>
          </div>
        </div>
      </div>

      {/* 목록 */}
      <div className="p-4">
        {loading ? (
          <div className="text-center py-12">
            <i className="fa-solid fa-spinner fa-spin text-2xl text-gray-400"></i>
            <p className="mt-2 text-gray-500">로딩 중...</p>
          </div>
        ) : filteredPackages.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg">
            <i className="fa-solid fa-box-open text-4xl text-gray-300"></i>
            <p className="mt-2 text-gray-500">
              {filter === 'all' ? '배송/수령 대기 중인 한약이 없습니다.' : `${DELIVERY_METHOD_LABELS[filter]} 대기 중인 한약이 없습니다.`}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredPackages.map(pkg => (
              <div
                key={pkg.id}
                className="bg-white rounded-lg shadow-sm border p-4"
              >
                <div className="flex items-start justify-between">
                  {/* 좌측: 환자/패키지 정보 */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      {/* 수령방식 배지 */}
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded ${
                          pkg.delivery_method === 'pickup'
                            ? 'bg-blue-100 text-blue-700'
                            : pkg.delivery_method === 'local'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-purple-100 text-purple-700'
                        }`}
                      >
                        {DELIVERY_METHOD_LABELS[pkg.delivery_method!]}
                      </span>

                      {/* 배송 상태 */}
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded ${
                          STATUS_COLORS[pkg.delivery_status as PackageDeliveryStatus]?.bg || 'bg-gray-100'
                        } ${STATUS_COLORS[pkg.delivery_status as PackageDeliveryStatus]?.text || 'text-gray-700'}`}
                      >
                        {DELIVERY_STATUS_LABELS[pkg.delivery_status as PackageDeliveryStatus] || '대기'}
                      </span>

                      {/* 환자명 */}
                      <span className="font-bold text-gray-800">{pkg.patient_name}</span>
                      <span className="text-sm text-gray-500">({pkg.chart_number})</span>
                    </div>

                    {/* 약명 */}
                    <div className="mt-2">
                      <span className="text-gray-700 font-medium">{pkg.herbal_name}</span>
                    </div>

                    {/* 탕전 완료 시간 */}
                    {pkg.decoction_completed_at && (
                      <div className="mt-1 text-sm text-gray-500">
                        <i className="fa-solid fa-clock mr-1"></i>
                        탕전완료: {new Date(pkg.decoction_completed_at).toLocaleString('ko-KR', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    )}

                    {/* 송장번호 표시 */}
                    {pkg.tracking_number && (
                      <div className="mt-1 text-sm text-purple-600">
                        <i className="fa-solid fa-barcode mr-1"></i>
                        송장: {pkg.tracking_number}
                      </div>
                    )}

                    {/* 메모 */}
                    {pkg.memo && (
                      <div className="mt-1 text-sm text-gray-500">
                        <i className="fa-solid fa-sticky-note mr-1"></i>
                        {pkg.memo}
                      </div>
                    )}
                  </div>

                  {/* 우측: 액션 버튼 */}
                  <div className="flex flex-col gap-2 min-w-[140px]">
                    {/* 내원 수령 */}
                    {pkg.delivery_method === 'pickup' && (
                      <>
                        {!pkg.pickup_notified_at && (
                          <button
                            onClick={() => handlePickupNotify(pkg)}
                            disabled={processingId === pkg.id}
                            className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
                          >
                            {processingId === pkg.id ? (
                              <><i className="fa-solid fa-spinner fa-spin mr-1"></i> 발송중...</>
                            ) : (
                              <><i className="fa-solid fa-bell mr-1"></i> 수령 안내</>
                            )}
                          </button>
                        )}
                        {pkg.pickup_notified_at && (
                          <span className="text-xs text-blue-600 text-center">
                            <i className="fa-solid fa-check mr-1"></i>
                            안내 발송됨
                          </span>
                        )}
                        <button
                          onClick={() => handleComplete(pkg)}
                          disabled={processingId === pkg.id}
                          className="px-3 py-1.5 text-sm bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
                        >
                          <i className="fa-solid fa-check mr-1"></i> 수령 완료
                        </button>
                      </>
                    )}

                    {/* 배송 (시내/택배) */}
                    {(pkg.delivery_method === 'local' || pkg.delivery_method === 'express') && (
                      <>
                        {/* 송장번호 입력 */}
                        {!pkg.tracking_number && trackingInputId !== pkg.id && (
                          <button
                            onClick={() => { setTrackingInputId(pkg.id!); setTrackingNumber(''); }}
                            className="px-3 py-1.5 text-sm bg-purple-500 text-white rounded hover:bg-purple-600"
                          >
                            <i className="fa-solid fa-barcode mr-1"></i> 송장 등록
                          </button>
                        )}

                        {trackingInputId === pkg.id && (
                          <div className="flex gap-1">
                            <input
                              type="text"
                              value={trackingNumber}
                              onChange={e => setTrackingNumber(e.target.value)}
                              placeholder="송장번호"
                              className="flex-1 px-2 py-1 text-sm border rounded"
                              autoFocus
                            />
                            <button
                              onClick={() => handleTrackingSubmit(pkg)}
                              disabled={processingId === pkg.id}
                              className="px-2 py-1 text-sm bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-50"
                            >
                              <i className="fa-solid fa-check"></i>
                            </button>
                            <button
                              onClick={() => { setTrackingInputId(null); setTrackingNumber(''); }}
                              className="px-2 py-1 text-sm bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                            >
                              <i className="fa-solid fa-xmark"></i>
                            </button>
                          </div>
                        )}

                        {/* 배송 알림 */}
                        {pkg.tracking_number && !pkg.shipping_notified_at && (
                          <button
                            onClick={() => handleShippingNotify(pkg)}
                            disabled={processingId === pkg.id}
                            className="px-3 py-1.5 text-sm bg-yellow-500 text-white rounded hover:bg-yellow-600 disabled:opacity-50"
                          >
                            {processingId === pkg.id ? (
                              <><i className="fa-solid fa-spinner fa-spin mr-1"></i> 발송중...</>
                            ) : (
                              <><i className="fa-solid fa-paper-plane mr-1"></i> 배송 알림</>
                            )}
                          </button>
                        )}

                        {pkg.shipping_notified_at && (
                          <span className="text-xs text-yellow-600 text-center">
                            <i className="fa-solid fa-check mr-1"></i>
                            배송 알림 발송됨
                          </span>
                        )}

                        {/* 배송 완료 */}
                        {pkg.tracking_number && (
                          <button
                            onClick={() => handleComplete(pkg)}
                            disabled={processingId === pkg.id}
                            className="px-3 py-1.5 text-sm bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
                          >
                            <i className="fa-solid fa-check mr-1"></i> 배송 완료
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 오늘 완료 목록 */}
        {showCompleted && completedPackages.length > 0 && (
          <div className="mt-6">
            <h2 className="text-lg font-semibold text-gray-700 mb-3">
              <i className="fa-solid fa-check-circle text-green-500 mr-2"></i>
              오늘 완료 ({completedPackages.length}건)
            </h2>
            <div className="space-y-2">
              {completedPackages.map(pkg => (
                <div
                  key={pkg.id}
                  className="bg-green-50 rounded-lg border border-green-200 p-3 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 text-xs rounded ${
                      pkg.delivery_method === 'pickup'
                        ? 'bg-blue-100 text-blue-700'
                        : pkg.delivery_method === 'local'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-purple-100 text-purple-700'
                    }`}>
                      {DELIVERY_METHOD_LABELS[pkg.delivery_method!]}
                    </span>
                    <span className="font-medium">{pkg.patient_name}</span>
                    <span className="text-sm text-gray-500">{pkg.herbal_name}</span>
                  </div>
                  <div className="text-sm text-green-600">
                    <i className="fa-solid fa-check mr-1"></i>
                    {pkg.delivery_completed_at && new Date(pkg.delivery_completed_at).toLocaleTimeString('ko-KR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default HerbalDeliveryManager;
