import React, { useState, useMemo, useEffect, useCallback } from 'react';
import * as api from '../lib/api';

interface DailyPaymentSummaryProps {
    // props 비워둠 - MSSQL에서 직접 조회
}

// 금액을 정수로 포맷 (소수점 제거)
const formatMoney = (amount: number | null | undefined): string => {
    return Math.floor(amount || 0).toLocaleString();
};

// 종별 배지 색상
const getInsuranceTypeBadge = (type: string) => {
    switch (type) {
        case '건보(직장)':
        case '건보(지역)':
            return 'bg-blue-100 text-blue-800';
        case '자보':
            return 'bg-orange-100 text-orange-800';
        case '1종':
        case '2종':
        case '의료급여1종':
        case '의료급여2종':
            return 'bg-purple-100 text-purple-800';
        case '차상위':
            return 'bg-indigo-100 text-indigo-800';
        case '임산부':
            return 'bg-pink-100 text-pink-800';
        case '산정특례':
            return 'bg-red-100 text-red-800';
        default:
            return 'bg-gray-100 text-gray-800';
    }
};

const DailyPaymentSummary: React.FC<DailyPaymentSummaryProps> = () => {
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [data, setData] = useState<api.ReceiptHistoryResponse | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [expandedReceipts, setExpandedReceipts] = useState<Set<number>>(new Set());

    const formattedSelectedDate = useMemo(() => {
        const year = selectedDate.getFullYear();
        const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
        const day = String(selectedDate.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }, [selectedDate]);

    // 데이터 로드
    const loadData = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const result = await api.fetchReceiptHistory(formattedSelectedDate);
            setData(result);
        } catch (err) {
            console.error('수납현황 로드 오류:', err);
            setError('수납 현황을 불러오는 중 오류가 발생했습니다.');
        } finally {
            setIsLoading(false);
        }
    }, [formattedSelectedDate]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const dateString = e.target.value;
        if (dateString) {
            setSelectedDate(new Date(dateString.replace(/-/g, '/')));
        }
    };

    const changeDay = (amount: number) => {
        setSelectedDate(prevDate => {
            const newDate = new Date(prevDate);
            newDate.setDate(newDate.getDate() + amount);
            return newDate;
        });
    };

    const goToToday = () => {
        setSelectedDate(new Date());
    };

    const toggleReceipt = (receiptId: number) => {
        setExpandedReceipts(prev => {
            const next = new Set(prev);
            if (next.has(receiptId)) {
                next.delete(receiptId);
            } else {
                next.add(receiptId);
            }
            return next;
        });
    };

    // 진료 내역 요약 문자열 생성
    const getTreatmentSummaryText = (receipt: api.ReceiptHistoryItem) => {
        const parts: string[] = [];
        if (receipt.treatment_summary.acupuncture) parts.push('침');
        if (receipt.treatment_summary.choona) parts.push('추나');
        if (receipt.treatment_summary.yakchim) parts.push('약침');
        receipt.treatment_summary.uncovered.forEach(u => parts.push(u.name));
        return parts.length > 0 ? parts.join(', ') : '-';
    };

    const summary = data?.summary || {
        count: 0,
        total_amount: 0,
        insurance_self: 0,
        general_amount: 0,
        cash: 0,
        card: 0,
        transfer: 0,
        unpaid: 0,
    };

    const receipts = data?.receipts || [];

    return (
        <div className="flex flex-col space-y-4 max-h-[80vh]">
            {/* 날짜 선택 */}
            <div className="flex items-center justify-center space-x-4 p-2 bg-gray-50 rounded-lg border">
                <button onClick={() => changeDay(-1)} className="px-3 py-1 rounded-md hover:bg-gray-200 transition-colors" aria-label="이전 날짜">
                    <i className="fa-solid fa-chevron-left"></i>
                </button>
                <input
                    type="date"
                    value={formattedSelectedDate}
                    onChange={handleDateChange}
                    className="border border-gray-300 rounded-md px-3 py-1.5 text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-clinic-secondary"
                />
                <button onClick={() => changeDay(1)} className="px-3 py-1 rounded-md hover:bg-gray-200 transition-colors" aria-label="다음 날짜">
                    <i className="fa-solid fa-chevron-right"></i>
                </button>
                <button onClick={goToToday} className="px-4 py-1.5 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-100 transition-colors font-semibold">
                    오늘
                </button>
                <button onClick={loadData} className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-semibold">
                    <i className="fa-solid fa-rotate-right mr-1"></i>
                    새로고침
                </button>
            </div>

            {/* Summary Section */}
            <div className="grid grid-cols-4 lg:grid-cols-8 gap-2">
                <div className="bg-white p-3 rounded-lg shadow-sm border-l-4 border-gray-600">
                    <p className="text-xs font-medium text-gray-500">환자수</p>
                    <p className="text-xl font-bold text-gray-600 mt-1">{summary.count}명</p>
                </div>
                <div className="bg-white p-3 rounded-lg shadow-sm border-l-4 border-blue-900">
                    <p className="text-xs font-medium text-gray-500">총 매출</p>
                    <p className="text-xl font-bold text-blue-900 mt-1">{formatMoney(summary.total_amount)}원</p>
                </div>
                <div className="bg-white p-3 rounded-lg shadow-sm border-l-4 border-sky-600">
                    <p className="text-xs font-medium text-gray-500">본인부담</p>
                    <p className="text-xl font-bold text-sky-600 mt-1">{formatMoney(summary.insurance_self)}원</p>
                </div>
                <div className="bg-white p-3 rounded-lg shadow-sm border-l-4 border-green-600">
                    <p className="text-xs font-medium text-gray-500">비급여</p>
                    <p className="text-xl font-bold text-green-600 mt-1">{formatMoney(summary.general_amount)}원</p>
                </div>
                <div className="bg-white p-3 rounded-lg shadow-sm border-l-4 border-purple-600">
                    <p className="text-xs font-medium text-gray-500">카드</p>
                    <p className="text-xl font-bold text-purple-600 mt-1">{formatMoney(summary.card)}원</p>
                </div>
                <div className="bg-white p-3 rounded-lg shadow-sm border-l-4 border-orange-600">
                    <p className="text-xs font-medium text-gray-500">현금</p>
                    <p className="text-xl font-bold text-orange-600 mt-1">{formatMoney(summary.cash)}원</p>
                </div>
                <div className="bg-white p-3 rounded-lg shadow-sm border-l-4 border-teal-600">
                    <p className="text-xs font-medium text-gray-500">계좌이체</p>
                    <p className="text-xl font-bold text-teal-600 mt-1">{formatMoney(summary.transfer)}원</p>
                </div>
                <div className="bg-white p-3 rounded-lg shadow-sm border-l-4 border-red-600">
                    <p className="text-xs font-medium text-gray-500">미수금</p>
                    <p className="text-xl font-bold text-red-600 mt-1">{formatMoney(summary.unpaid)}원</p>
                </div>
            </div>

            {/* Error/Loading */}
            {isLoading && (
                <div className="text-center py-6 text-gray-500">
                    <i className="fa-solid fa-spinner fa-spin mr-2"></i>
                    수납 현황을 불러오는 중...
                </div>
            )}

            {error && (
                <div className="text-center py-6 text-red-500">
                    <i className="fa-solid fa-circle-exclamation mr-2"></i>
                    {error}
                </div>
            )}

            {/* List Section */}
            {!isLoading && !error && (
                <div className="flex-grow overflow-y-auto border border-gray-200 rounded-lg bg-white">
                    <div className="sticky top-0 bg-gray-50 z-10">
                        <div className="grid grid-cols-12 gap-2 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            <div className="col-span-1 text-center">번호</div>
                            <div className="col-span-1">시간</div>
                            <div className="col-span-2">환자명</div>
                            <div className="col-span-1">종별</div>
                            <div className="col-span-2">진료내역</div>
                            <div className="col-span-1 text-right">본인부담</div>
                            <div className="col-span-1 text-right">비급여</div>
                            <div className="col-span-1 text-right">총액</div>
                            <div className="col-span-1 text-right">미수금</div>
                            <div className="col-span-1 text-center">메모</div>
                        </div>
                    </div>
                    <div className="divide-y divide-gray-200">
                        {receipts.length > 0 ? (
                            receipts.map((receipt, index) => (
                                <div key={receipt.id} className="hover:bg-gray-50">
                                    <div
                                        className="grid grid-cols-12 gap-2 px-4 py-3 items-center cursor-pointer"
                                        onClick={() => toggleReceipt(receipt.id)}
                                    >
                                        <div className="col-span-1 text-base font-bold text-gray-700 text-center">{index + 1}</div>
                                        <div className="col-span-1 text-sm text-gray-900">
                                            {receipt.receipt_time ? receipt.receipt_time.substring(11, 16) : '-'}
                                        </div>
                                        <div className="col-span-2">
                                            <div className="text-sm font-semibold text-gray-900">{receipt.patient_name}</div>
                                            <div className="text-xs text-gray-500">{receipt.chart_no}</div>
                                        </div>
                                        <div className="col-span-1">
                                            <span className={`text-xs px-2 py-0.5 rounded-full ${getInsuranceTypeBadge(receipt.insurance_type)}`}>
                                                {receipt.insurance_type}
                                            </span>
                                        </div>
                                        <div className="col-span-2 text-sm text-gray-600 truncate" title={getTreatmentSummaryText(receipt)}>
                                            {getTreatmentSummaryText(receipt)}
                                        </div>
                                        <div className="col-span-1 text-right text-sm text-gray-900">
                                            {formatMoney(receipt.insurance_self)}원
                                        </div>
                                        <div className="col-span-1 text-right text-sm text-gray-900">
                                            {formatMoney(receipt.general_amount)}원
                                        </div>
                                        <div className="col-span-1 text-right text-sm font-semibold text-gray-900">
                                            {formatMoney(receipt.total_amount)}원
                                        </div>
                                        <div className={`col-span-1 text-right text-sm font-bold ${(receipt.unpaid || 0) > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                                            {formatMoney(receipt.unpaid)}원
                                        </div>
                                        <div className="col-span-1 text-center">
                                            {(receipt.package_info || receipt.memo) ? (
                                                <i className="fa-solid fa-note-sticky text-yellow-500" title="메모 있음"></i>
                                            ) : (
                                                <span className="text-gray-300">-</span>
                                            )}
                                            <i className={`fa-solid fa-chevron-${expandedReceipts.has(receipt.id) ? 'up' : 'down'} ml-2 text-gray-400`}></i>
                                        </div>
                                    </div>

                                    {/* Expanded Details */}
                                    {expandedReceipts.has(receipt.id) && (
                                        <div className="px-4 pb-4 bg-gray-50 border-t">
                                            <div className="grid grid-cols-2 gap-4 mt-3">
                                                {/* 진료 상세 내역 */}
                                                <div>
                                                    <h4 className="text-xs font-semibold text-gray-500 mb-2">진료 상세 내역</h4>
                                                    {receipt.treatments.length > 0 ? (
                                                        <div className="space-y-1">
                                                            {receipt.treatments.map((t) => (
                                                                <div key={t.id} className="flex justify-between items-center text-sm bg-white p-2 rounded">
                                                                    <div>
                                                                        <span className={`text-xs px-1.5 py-0.5 rounded mr-2 ${t.is_covered ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                                                                            {t.is_covered ? '급여' : '비급여'}
                                                                        </span>
                                                                        <span className="font-medium">{t.name || t.item}</span>
                                                                        {t.doctor && <span className="text-gray-500 ml-2">({t.doctor})</span>}
                                                                    </div>
                                                                    <span className="font-semibold">{formatMoney(t.amount)}원</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <div className="text-sm text-gray-400">진료 상세 내역 없음</div>
                                                    )}
                                                </div>

                                                {/* 수납 정보 & 메모 */}
                                                <div className="space-y-3">
                                                    {/* 수납 방법 */}
                                                    <div>
                                                        <h4 className="text-xs font-semibold text-gray-500 mb-2">수납 방법</h4>
                                                        <div className="flex gap-3 text-sm">
                                                            {receipt.card > 0 && (
                                                                <div className="bg-purple-50 px-2 py-1 rounded">
                                                                    <span className="text-purple-600 font-medium">카드:</span> {formatMoney(receipt.card)}원
                                                                </div>
                                                            )}
                                                            {receipt.cash > 0 && (
                                                                <div className="bg-orange-50 px-2 py-1 rounded">
                                                                    <span className="text-orange-600 font-medium">현금:</span> {formatMoney(receipt.cash)}원
                                                                </div>
                                                            )}
                                                            {receipt.transfer > 0 && (
                                                                <div className="bg-teal-50 px-2 py-1 rounded">
                                                                    <span className="text-teal-600 font-medium">이체:</span> {formatMoney(receipt.transfer)}원
                                                                </div>
                                                            )}
                                                            {receipt.card === 0 && receipt.cash === 0 && receipt.transfer === 0 && (
                                                                <span className="text-gray-400">수납 정보 없음</span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* 메모 */}
                                                    {(receipt.package_info || receipt.memo) && (
                                                        <div>
                                                            <h4 className="text-xs font-semibold text-gray-500 mb-2">메모</h4>
                                                            <div className="bg-yellow-50 p-2 rounded text-sm">
                                                                {receipt.package_info && (
                                                                    <div className="mb-1">
                                                                        <span className="font-medium text-yellow-800">패키지:</span>{' '}
                                                                        <span className="text-yellow-700">{receipt.package_info}</span>
                                                                    </div>
                                                                )}
                                                                {receipt.memo && (
                                                                    <div>
                                                                        <span className="font-medium text-yellow-800">메모:</span>{' '}
                                                                        <span className="text-yellow-700">{receipt.memo}</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-10 text-gray-500">
                                해당 날짜에 수납 내역이 없습니다.
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default DailyPaymentSummary;
