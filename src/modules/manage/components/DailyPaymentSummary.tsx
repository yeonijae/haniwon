import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import * as api from '../lib/api';

interface DailyPaymentSummaryProps {
    // 날짜 선택 UI를 외부(모달 헤더)로 전달하기 위한 콜백
    onDatePickerRender?: (datePicker: React.ReactNode) => void;
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
        case '약상담':
            return 'bg-emerald-100 text-emerald-800';
        default:
            return 'bg-gray-100 text-gray-800';
    }
};

// 종별 표시 결정 (건보 + 청구금액 0원 = 약상담)
const getDisplayInsuranceType = (receipt: api.ReceiptHistoryItem): string => {
    const type = receipt.insurance_type;
    // 건보인데 청구금액이 0원이면 "약상담"
    if ((type === '건보(직장)' || type === '건보(지역)') && (receipt.insurance_claim || 0) === 0) {
        return '약상담';
    }
    return type;
};

// 수납 방식 아이콘 및 텍스트
const getPaymentMethodDisplay = (receipt: api.ReceiptHistoryItem) => {
    const methods: { icon: string; label: string; color: string }[] = [];
    if (receipt.card > 0) methods.push({ icon: 'fa-credit-card', label: '카드', color: 'text-purple-600' });
    if (receipt.cash > 0) methods.push({ icon: 'fa-money-bill', label: '현금', color: 'text-orange-600' });
    if (receipt.transfer > 0) methods.push({ icon: 'fa-building-columns', label: '이체', color: 'text-teal-600' });
    return methods;
};

// 진료내역 툴팁 컴포넌트
const TreatmentTooltip: React.FC<{
    receipt: api.ReceiptHistoryItem;
    summaryText: string;
}> = ({ receipt, summaryText }) => {
    const [isVisible, setIsVisible] = useState(false);
    const tooltipRef = useRef<HTMLDivElement>(null);

    return (
        <div className="relative inline-flex items-center">
            <span className="truncate max-w-[100px]">{summaryText}</span>
            <button
                className="ml-1 text-gray-400 hover:text-blue-500 transition-colors"
                onMouseEnter={() => setIsVisible(true)}
                onMouseLeave={() => setIsVisible(false)}
                onClick={(e) => { e.stopPropagation(); setIsVisible(!isVisible); }}
            >
                <i className="fa-solid fa-circle-info text-xs"></i>
            </button>
            {isVisible && (
                <div
                    ref={tooltipRef}
                    className="absolute left-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-lg p-3 min-w-[220px] max-w-[300px]"
                    onMouseEnter={() => setIsVisible(true)}
                    onMouseLeave={() => setIsVisible(false)}
                >
                    <div className="text-xs font-semibold text-gray-500 mb-2 border-b pb-1">진료 상세</div>
                    {receipt.treatments.length > 0 ? (
                        <div className="space-y-1.5">
                            {receipt.treatments.map((t, idx) => (
                                <div key={idx} className="flex items-start text-xs">
                                    <span className={`inline-block w-10 px-1 py-0.5 rounded text-center mr-2 ${t.is_covered ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                                        {t.is_covered ? '급여' : '비급여'}
                                    </span>
                                    <span className="flex-1">{t.name || t.item}</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-xs text-gray-400">상세 내역 없음</div>
                    )}
                    {receipt.treatments.some(t => t.doctor) && (
                        <div className="mt-2 pt-1 border-t text-xs text-gray-500">
                            담당: {receipt.treatments.find(t => t.doctor)?.doctor}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// 인라인 메모 편집 컴포넌트
const InlineMemoEditor: React.FC<{
    receiptId: number;
    initialMemo: string;
    onSave: (receiptId: number, memo: string) => Promise<void>;
}> = ({ receiptId, initialMemo, onSave }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [memo, setMemo] = useState(initialMemo);
    const [isSaving, setIsSaving] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isEditing]);

    const handleSave = async () => {
        if (memo === initialMemo) {
            setIsEditing(false);
            return;
        }
        setIsSaving(true);
        try {
            await onSave(receiptId, memo);
            setIsEditing(false);
        } catch (err) {
            console.error('메모 저장 실패:', err);
            alert('메모 저장에 실패했습니다.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSave();
        } else if (e.key === 'Escape') {
            setMemo(initialMemo);
            setIsEditing(false);
        }
    };

    if (isEditing) {
        return (
            <div className="flex items-center space-x-1" onClick={(e) => e.stopPropagation()}>
                <input
                    ref={inputRef}
                    type="text"
                    value={memo}
                    onChange={(e) => setMemo(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onBlur={handleSave}
                    disabled={isSaving}
                    className="w-full text-xs px-2 py-1 border border-blue-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="메모 입력..."
                    maxLength={100}
                />
                {isSaving && <i className="fa-solid fa-spinner fa-spin text-blue-500 text-xs"></i>}
            </div>
        );
    }

    return (
        <div
            className="group cursor-pointer min-h-[24px] flex items-center"
            onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
            title={memo || '클릭하여 메모 추가'}
        >
            {memo ? (
                <span className="text-xs text-gray-700 truncate max-w-[140px] group-hover:text-blue-600">
                    {memo}
                </span>
            ) : (
                <span className="text-xs text-gray-300 group-hover:text-blue-400 italic">
                    + 메모
                </span>
            )}
            <i className="fa-solid fa-pen text-[10px] text-gray-300 group-hover:text-blue-500 ml-1 opacity-0 group-hover:opacity-100 transition-opacity"></i>
        </div>
    );
};

const DailyPaymentSummary: React.FC<DailyPaymentSummaryProps> = ({ onDatePickerRender }) => {
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [data, setData] = useState<api.ReceiptHistoryResponse | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    // 로컬 메모 상태 (API 저장 전 UI 반영용)
    const [localMemos, setLocalMemos] = useState<Record<number, string>>({});

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
            // 메모 초기화
            const memos: Record<number, string> = {};
            result.receipts.forEach(r => {
                memos[r.id] = r.memo || '';
            });
            setLocalMemos(memos);
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

    // 메모 저장 핸들러
    const handleSaveMemo = async (receiptId: number, memo: string) => {
        // 로컬 상태 먼저 업데이트
        setLocalMemos(prev => ({ ...prev, [receiptId]: memo }));

        // API 호출 (추후 구현)
        try {
            await api.saveReceiptMemo(receiptId, memo);
        } catch (err) {
            console.error('메모 저장 실패:', err);
            // 실패 시 원래 값으로 복구
            throw err;
        }
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

    // 날짜 선택 UI 컴포넌트
    const datePickerUI = (
        <div className="flex items-center space-x-2">
            <button onClick={() => changeDay(-1)} className="px-2 py-1 rounded-md hover:bg-gray-200 transition-colors" aria-label="이전 날짜">
                <i className="fa-solid fa-chevron-left"></i>
            </button>
            <input
                type="date"
                value={formattedSelectedDate}
                onChange={handleDateChange}
                className="border border-gray-300 rounded-md px-2 py-1 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-clinic-secondary"
            />
            <button onClick={() => changeDay(1)} className="px-2 py-1 rounded-md hover:bg-gray-200 transition-colors" aria-label="다음 날짜">
                <i className="fa-solid fa-chevron-right"></i>
            </button>
            <button onClick={goToToday} className="px-3 py-1 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-100 transition-colors font-medium">
                오늘
            </button>
            <button onClick={loadData} className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium">
                <i className="fa-solid fa-rotate-right mr-1"></i>
                새로고침
            </button>
        </div>
    );

    // 날짜 선택 UI를 외부로 전달
    useEffect(() => {
        if (onDatePickerRender) {
            onDatePickerRender(datePickerUI);
        }
    }, [formattedSelectedDate, isLoading]);

    return (
        <div className="flex flex-col space-y-4 h-full">
            {/* 날짜 선택 - onDatePickerRender가 없을 때만 내부에 표시 */}
            {!onDatePickerRender && (
                <div className="flex items-center justify-center space-x-4 p-2 bg-gray-50 rounded-lg border">
                    {datePickerUI}
                </div>
            )}

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

            {/* List Section - 새로운 테이블 구조 */}
            {!isLoading && !error && (
                <div className="flex-grow overflow-auto border border-gray-200 rounded-lg bg-white">
                    <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-gray-50 z-10">
                            <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                <th className="px-3 py-3 text-center w-10">#</th>
                                <th className="px-3 py-3 w-14">시간</th>
                                <th className="px-3 py-3 w-28">환자명</th>
                                <th className="px-3 py-3 w-16">종별</th>
                                <th className="px-3 py-3 w-32">진료내역</th>
                                <th className="px-3 py-3 text-right w-20">본인부담</th>
                                <th className="px-3 py-3 text-right w-20">비급여</th>
                                <th className="px-3 py-3 text-right w-24">수납/방식</th>
                                <th className="px-3 py-3 text-right w-16">미수</th>
                                <th className="px-3 py-3 w-40">메모</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {receipts.length > 0 ? (
                                receipts.map((receipt, index) => {
                                    const paymentMethods = getPaymentMethodDisplay(receipt);
                                    const hasMisu = (receipt.unpaid || 0) > 0;
                                    const displayType = getDisplayInsuranceType(receipt);

                                    return (
                                        <tr key={receipt.id} className="hover:bg-gray-50 transition-colors">
                                            {/* 순번 */}
                                            <td className="px-3 py-2.5 text-center font-bold text-gray-600">
                                                {index + 1}
                                            </td>

                                            {/* 시간 */}
                                            <td className="px-3 py-2.5 text-gray-900 font-medium">
                                                {receipt.receipt_time ? receipt.receipt_time.substring(11, 16) : '-'}
                                            </td>

                                            {/* 환자명(차트번호) */}
                                            <td className="px-3 py-2.5">
                                                <div className="font-semibold text-gray-900">{receipt.patient_name}</div>
                                                <div className="text-xs text-gray-400">{receipt.chart_no}</div>
                                            </td>

                                            {/* 종별 */}
                                            <td className="px-3 py-2.5">
                                                <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${getInsuranceTypeBadge(displayType)}`}>
                                                    {displayType}
                                                </span>
                                            </td>

                                            {/* 진료내역 + 툴팁 */}
                                            <td className="px-3 py-2.5 text-gray-600">
                                                <TreatmentTooltip
                                                    receipt={receipt}
                                                    summaryText={getTreatmentSummaryText(receipt)}
                                                />
                                            </td>

                                            {/* 본인부담 */}
                                            <td className="px-3 py-2.5 text-right text-gray-900">
                                                {formatMoney(receipt.insurance_self)}
                                            </td>

                                            {/* 비급여 */}
                                            <td className="px-3 py-2.5 text-right text-gray-900">
                                                {formatMoney(receipt.general_amount)}
                                            </td>

                                            {/* 수납총액/방식 */}
                                            <td className="px-3 py-2.5 text-right">
                                                <div className="font-semibold text-gray-900">
                                                    {formatMoney(receipt.total_amount)}
                                                </div>
                                                <div className="flex items-center justify-end space-x-1 mt-0.5">
                                                    {paymentMethods.map((m, i) => (
                                                        <span key={i} className={`${m.color}`} title={m.label}>
                                                            <i className={`fa-solid ${m.icon} text-xs`}></i>
                                                        </span>
                                                    ))}
                                                    {paymentMethods.length === 0 && (
                                                        <span className="text-gray-300 text-xs">-</span>
                                                    )}
                                                </div>
                                            </td>

                                            {/* 미수금 */}
                                            <td className={`px-3 py-2.5 text-right font-bold ${hasMisu ? 'text-red-600' : 'text-gray-300'}`}>
                                                {hasMisu ? (
                                                    <span className="flex items-center justify-end">
                                                        <i className="fa-solid fa-triangle-exclamation text-xs mr-1"></i>
                                                        {formatMoney(receipt.unpaid)}
                                                    </span>
                                                ) : (
                                                    '-'
                                                )}
                                            </td>

                                            {/* 메모 (인라인 편집) */}
                                            <td className="px-3 py-2.5">
                                                <InlineMemoEditor
                                                    receiptId={receipt.id}
                                                    initialMemo={localMemos[receipt.id] || ''}
                                                    onSave={handleSaveMemo}
                                                />
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={10} className="text-center py-10 text-gray-500">
                                        해당 날짜에 수납 내역이 없습니다.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* 하단 합계 영역 */}
            {!isLoading && !error && receipts.length > 0 && (
                <div className="bg-gray-50 rounded-lg border p-4">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="text-sm text-gray-600">
                            총 <span className="font-bold text-gray-900">{summary.count}건</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-4 text-sm">
                            <div>
                                <span className="text-gray-500">본인부담:</span>
                                <span className="font-semibold text-sky-600 ml-1">{formatMoney(summary.insurance_self)}원</span>
                            </div>
                            <div>
                                <span className="text-gray-500">비급여:</span>
                                <span className="font-semibold text-green-600 ml-1">{formatMoney(summary.general_amount)}원</span>
                            </div>
                            <div className="border-l pl-4">
                                <span className="text-purple-600"><i className="fa-solid fa-credit-card mr-1"></i>{formatMoney(summary.card)}</span>
                                <span className="text-gray-300 mx-2">|</span>
                                <span className="text-orange-600"><i className="fa-solid fa-money-bill mr-1"></i>{formatMoney(summary.cash)}</span>
                                <span className="text-gray-300 mx-2">|</span>
                                <span className="text-teal-600"><i className="fa-solid fa-building-columns mr-1"></i>{formatMoney(summary.transfer)}</span>
                            </div>
                            {summary.unpaid > 0 && (
                                <div className="border-l pl-4">
                                    <span className="text-red-600 font-bold">
                                        <i className="fa-solid fa-triangle-exclamation mr-1"></i>
                                        미수금: {formatMoney(summary.unpaid)}원
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DailyPaymentSummary;
