
import React, { useState, useMemo, useEffect } from 'react';
import { Payment, PaymentMethod, TreatmentDetailItem, TreatmentItemCategory, UncoveredCategories } from '../types';

interface PaymentModalProps {
  payment: Payment | null;
  onClose: () => void;
  onComplete: (payment: Payment, details: { 
    totalAmount: number; 
    items: PaymentItem[]; 
    remainingAmount: number; 
    treatmentItems: TreatmentDetailItem[];
  }) => void;
  uncoveredCategories: UncoveredCategories;
}

interface PaymentItem {
    id: number;
    method: PaymentMethod;
    amount: string;
}

interface UncoveredItemState {
    id: number;
    name: string;
    amount: string;
    memo: string;
}

let nextPaymentItemId = 0;
let nextTreatmentItemId = 0;

const formatNumber = (value: string) => {
    if (!value) return '';
    const num = parseInt(value.replace(/[^0-9]/g, ''), 10);
    return isNaN(num) ? '' : num.toLocaleString();
};

const PaymentModal: React.FC<PaymentModalProps> = ({ payment, onClose, onComplete, uncoveredCategories }) => {
  const [selectedCoveredTreatments, setSelectedCoveredTreatments] = useState<string[]>([]);
  const [coveredTotalAmount, setCoveredTotalAmount] = useState<string>('');
  const [uncoveredItems, setUncoveredItems] = useState<UncoveredItemState[]>([]);
  const [paymentItems, setPaymentItems] = useState<PaymentItem[]>([]);
  const [cashReceived, setCashReceived] = useState<string>('');
  const [isAddingUncovered, setIsAddingUncovered] = useState(false);
  const [activeUncoveredCategory, setActiveUncoveredCategory] = useState<string | null>(null);
  
  useEffect(() => {
    if (payment) {
      nextTreatmentItemId = 0;
      setSelectedCoveredTreatments([]);
      setCoveredTotalAmount('');
      setUncoveredItems([]);
      setPaymentItems([]);
      setCashReceived('');
      setIsAddingUncovered(false);
      setActiveUncoveredCategory(null);
    }
  }, [payment]);

  const coveredTotal = useMemo(() => parseInt(coveredTotalAmount.replace(/,/g, ''), 10) || 0, [coveredTotalAmount]);
  const uncoveredTotal = useMemo(() => uncoveredItems.reduce((sum, item) => sum + (parseInt(item.amount.replace(/,/g, ''), 10) || 0), 0), [uncoveredItems]);
  const totalAmountAsNumber = useMemo(() => coveredTotal + uncoveredTotal, [coveredTotal, uncoveredTotal]);

  const paidAmount = useMemo(() => {
    return paymentItems.reduce((sum, item) => sum + (parseInt(item.amount.replace(/,/g, ''), 10) || 0), 0);
  }, [paymentItems]);

  const remainingAmount = totalAmountAsNumber - paidAmount;
  
  const totalCashPayment = useMemo(() => {
    return paymentItems
      .filter(item => item.method === 'cash')
      .reduce((sum, item) => sum + (parseInt(item.amount.replace(/,/g, ''), 10) || 0), 0);
  }, [paymentItems]);

  const change = useMemo(() => {
    const received = parseInt(cashReceived.replace(/,/g, ''), 10) || 0;
    if (!received || totalCashPayment === 0) return 0;
    return received - totalCashPayment;
  }, [cashReceived, totalCashPayment]);

  const hasCashPayment = useMemo(() => paymentItems.some(item => item.method === 'cash'), [paymentItems]);

  if (!payment) return null;

  const handleCoveredTreatmentChange = (treatmentName: string, isChecked: boolean) => {
    setSelectedCoveredTreatments(prev => {
        if (isChecked) {
            return [...prev, treatmentName];
        } else {
            return prev.filter(name => name !== treatmentName);
        }
    });
  };

  const handleAddUncoveredItem = (name: string) => {
    setUncoveredItems(prev => [...prev, { id: nextTreatmentItemId++, name, amount: '', memo: '' }]);
    setIsAddingUncovered(false);
    setActiveUncoveredCategory(null);
  };
  const handleRemoveUncoveredItem = (id: number) => {
      setUncoveredItems(prev => prev.filter(item => item.id !== id));
  };
  const handleUncoveredItemChange = (id: number, field: 'memo' | 'amount', value: string) => {
      const newValue = field === 'amount' ? formatNumber(value) : value;
      setUncoveredItems(prev => prev.map(item => item.id === id ? { ...item, [field]: newValue } : item));
  };

  const handleComplete = () => {
    if (totalAmountAsNumber <= 0) {
        alert('치료 항목에 금액을 입력하여 총 결제금액이 0원 이상이어야 합니다.');
        return;
    }
    const finalPaymentItems = paymentItems.map(item => ({
      ...item,
      amount: item.amount.replace(/,/g, '')
    }));

    const finalTreatmentItems: TreatmentDetailItem[] = [
        ...(selectedCoveredTreatments.length > 0 && coveredTotal > 0
            ? [{
                id: 'c-summary',
                name: selectedCoveredTreatments.join(', '),
                amount: coveredTotal,
                category: 'covered' as TreatmentItemCategory,
            }]
            : []
        ),
        ...uncoveredItems
            .filter(i => i.name.trim() !== '')
            .map(i => ({
                category: 'uncovered' as TreatmentItemCategory,
                amount: parseInt(i.amount.replace(/,/g, ''), 10) || 0,
                id: `u-${i.id}`,
                name: i.name,
                memo: i.memo.trim() ? i.memo.trim() : undefined,
             })),
    ];

    onComplete(payment, { 
        totalAmount: totalAmountAsNumber, 
        items: finalPaymentItems, 
        remainingAmount,
        treatmentItems: finalTreatmentItems,
    });
  };
  
  const handleNumericInputChange = (setter: React.Dispatch<React.SetStateAction<string>>) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setter(formatNumber(e.target.value));
  };
  
  const handlePaymentItemAmountChange = (id: number, value: string) => {
    setPaymentItems(items => items.map(item => item.id === id ? { ...item, amount: formatNumber(value) } : item));
  };
  
  const handlePaymentItemChange = (id: number, field: keyof Omit<PaymentItem, 'id' | 'amount'>, value: string) => {
    setPaymentItems(items => items.map(item => item.id === id ? { ...item, [field]: value as PaymentMethod } : item));
  };
  
  const handleAddPaymentItem = () => {
    const newId = nextPaymentItemId++;
    const newAmount = remainingAmount > 0 ? String(remainingAmount) : '';
    setPaymentItems(prev => [...prev, { id: newId, method: 'card', amount: formatNumber(newAmount) }]);
  };

  const handleRemovePaymentItem = (id: number) => {
    setPaymentItems(items => items.filter(item => item.id !== id));
  };


  return (
    <div className="space-y-6">
      {/* Patient Info */}
      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
        <p className="text-sm font-medium text-gray-500">환자명</p>
        <p className="text-xl font-bold text-clinic-text-primary">{payment.patientName}</p>
        <p className="text-base text-clinic-text-secondary mt-1">{payment.details}</p>
      </div>

      {/* Treatment Items */}
      <div className="space-y-4">
        {/* Covered Items */}
        <div className="space-y-2 rounded-lg border-l-4 p-4 border-blue-500 bg-blue-50">
            <h4 className="font-bold text-gray-700">급여 항목</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {['침', '단순추나', '복잡추나'].map(treatmentName => (
                    <label key={treatmentName} className="flex items-center p-3 border rounded-lg hover:bg-gray-50 cursor-pointer has-[:checked]:bg-blue-50 has-[:checked]:border-blue-400">
                        <input
                            type="checkbox"
                            checked={selectedCoveredTreatments.includes(treatmentName)}
                            onChange={(e) => handleCoveredTreatmentChange(treatmentName, e.target.checked)}
                            className="h-5 w-5 rounded border-gray-300 text-clinic-secondary focus:ring-clinic-secondary"
                        />
                        <span className="ml-3 text-sm font-medium text-gray-800">{treatmentName}</span>
                    </label>
                ))}
            </div>
            <div className="pt-2 border-t mt-2">
                <label htmlFor="covered-total" className="block text-sm font-medium text-gray-700">급여항목 합계</label>
                <div className="relative mt-1">
                    <input
                        type="text"
                        id="covered-total"
                        value={coveredTotalAmount}
                        onChange={(e) => setCoveredTotalAmount(formatNumber(e.target.value))}
                        className="block w-full text-right px-3 py-1.5 pr-8 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-clinic-secondary focus:border-clinic-secondary sm:text-sm"
                        placeholder="금액"
                    />
                    <span className="absolute inset-y-0 right-0 pr-2 flex items-center text-sm text-gray-500">원</span>
                </div>
            </div>
        </div>
        
        {/* Uncovered Items */}
        <div className="space-y-2 rounded-lg border-l-4 p-4 border-green-500 bg-green-50">
            <h4 className="font-bold text-gray-700">비급여 항목</h4>
            <div className="space-y-3">
              {uncoveredItems.map((item) => (
                <div key={item.id} className="p-3 bg-white rounded-md border border-gray-200">
                  <div className="grid grid-cols-[1fr_auto] gap-2 items-center">
                    <p className="font-semibold text-clinic-text-primary">{item.name}</p>
                    <button
                        type="button"
                        onClick={() => handleRemoveUncoveredItem(item.id)}
                        className="text-gray-400 hover:text-red-500 px-1"
                        aria-label="비급여 항목 삭제"
                    >
                        <i className="fa-solid fa-trash-can"></i>
                    </button>
                  </div>
                  <div className="grid grid-cols-[1.5fr_1fr] gap-2 items-center mt-2">
                    <input
                        type="text"
                        value={item.memo}
                        onChange={(e) => handleUncoveredItemChange(item.id, 'memo', e.target.value)}
                        className="block w-full px-3 py-1.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-clinic-secondary focus:border-clinic-secondary sm:text-sm"
                        placeholder="메모"
                    />
                    <div className="relative">
                        <input
                            type="text"
                            value={item.amount}
                            onChange={(e) => handleUncoveredItemChange(item.id, 'amount', e.target.value)}
                            className="block w-full text-right px-3 py-1.5 pr-8 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-clinic-secondary focus:border-clinic-secondary sm:text-sm"
                            placeholder="금액"
                        />
                        <span className="absolute inset-y-0 right-0 pr-2 flex items-center text-sm text-gray-500">원</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {isAddingUncovered ? (
              <div className="mt-2 p-3 border-2 border-dashed border-gray-300 rounded-lg">
                  <div className="flex flex-wrap gap-2">
                      {Object.keys(uncoveredCategories).map(category => (
                          <button
                              key={category}
                              type="button"
                              onClick={() => setActiveUncoveredCategory(category)}
                              className={`px-3 py-1.5 text-sm font-semibold rounded-md transition-colors ${activeUncoveredCategory === category ? 'bg-clinic-primary text-white' : 'bg-white hover:bg-gray-100 border'}`}
                          >
                              {category}
                          </button>
                      ))}
                  </div>
                  {activeUncoveredCategory && (
                      <div className="mt-3 pt-3 border-t">
                          <h5 className="text-sm font-semibold mb-2">{activeUncoveredCategory}</h5>
                          <div className="flex flex-wrap gap-2">
                              {uncoveredCategories[activeUncoveredCategory].map(subCategory => (
                                  <button
                                      key={subCategory}
                                      type="button"
                                      onClick={() => handleAddUncoveredItem(subCategory)}
                                      className="px-3 py-1.5 text-sm bg-white rounded-md border hover:bg-blue-50 hover:border-blue-300 transition-colors"
                                  >
                                      {subCategory}
                                  </button>
                              ))}
                          </div>
                      </div>
                  )}
                  <button type="button" onClick={() => { setIsAddingUncovered(false); setActiveUncoveredCategory(null); }} className="w-full mt-3 text-xs text-gray-500 hover:underline">취소</button>
              </div>
            ) : (
              <button
                  type="button"
                  onClick={() => setIsAddingUncovered(true)}
                  className="w-full mt-2 px-4 py-1.5 border-2 border-dashed border-gray-300 text-gray-500 font-semibold rounded-md hover:bg-gray-100 hover:border-gray-400 transition-colors text-sm"
              >
                  <i className="fa-solid fa-plus mr-2"></i>비급여 항목 추가
              </button>
            )}

            <div className="text-right font-semibold pt-2 border-t mt-2">
                비급여 항목 합계: <span className="text-lg ml-2">{uncoveredTotal.toLocaleString()} 원</span>
            </div>
        </div>
      </div>

      {/* Amount Summary */}
      <div className="space-y-2 rounded-lg border border-gray-200 p-4">
        <div className="flex justify-between items-center text-lg">
            <p className="font-bold text-clinic-text-primary">총 결제금액</p>
            <p className="text-2xl font-bold text-clinic-primary">{totalAmountAsNumber.toLocaleString()} 원</p>
        </div>
        <div className="border-t my-2"></div>
        <div className="flex justify-between items-center text-sm">
            <p className="font-medium text-gray-600">결제된 금액</p>
            <p className="font-semibold text-gray-800">{paidAmount.toLocaleString()} 원</p>
        </div>
        <div className="flex justify-between items-center">
            <p className="font-medium text-clinic-accent">남은 금액 (미수금)</p>
            <p className={`font-bold text-lg ${remainingAmount > 0 ? 'text-red-500' : 'text-clinic-accent'}`}>
                {remainingAmount.toLocaleString()} 원
            </p>
        </div>
      </div>
      
      {/* Payment Items */}
      <div className="space-y-2">
        <h4 className="block text-sm font-medium text-gray-700">결제 항목</h4>
        {paymentItems.map((item) => (
            <div key={item.id} className="grid grid-cols-[1fr_1.5fr_auto] gap-2 items-center p-2 bg-gray-50 rounded-md">
                <select 
                    value={item.method}
                    onChange={(e) => handlePaymentItemChange(item.id, 'method', e.target.value)}
                    className="block w-full px-2 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-clinic-secondary focus:border-clinic-secondary sm:text-sm"
                >
                    <option value="card">카드</option>
                    <option value="cash">현금</option>
                    <option value="transfer">계좌이체</option>
                </select>
                <div className="relative">
                    <input
                        type="text"
                        value={item.amount}
                        onChange={(e) => handlePaymentItemAmountChange(item.id, e.target.value)}
                        className="block w-full text-right px-3 py-2 pr-8 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-clinic-secondary focus:border-clinic-secondary sm:text-sm"
                        placeholder="금액"
                    />
                    <span className="absolute inset-y-0 right-0 pr-2 flex items-center text-sm text-gray-500">원</span>
                </div>
                <button
                    type="button"
                    onClick={() => handleRemovePaymentItem(item.id)}
                    className="text-gray-400 hover:text-red-500 px-2"
                    aria-label="결제 항목 삭제"
                >
                    <i className="fa-solid fa-trash-can"></i>
                </button>
            </div>
        ))}
        <button
            type="button"
            onClick={handleAddPaymentItem}
            className="w-full mt-2 px-4 py-2 border-2 border-dashed border-gray-300 text-gray-500 font-semibold rounded-md hover:bg-gray-100 hover:border-gray-400 transition-colors"
        >
            <i className="fa-solid fa-plus mr-2"></i>결제 항목 추가
        </button>
      </div>
      
      {/* Cash Payment Details */}
      {hasCashPayment && (
        <div className="grid grid-cols-2 gap-4 bg-yellow-50 p-4 rounded-lg border border-yellow-200">
          <div>
            <label htmlFor="cashReceived" className="block text-sm font-medium text-gray-700">받은 현금</label>
            <div className="relative mt-1">
              <input
                type="text"
                id="cashReceived"
                value={cashReceived}
                onChange={handleNumericInputChange(setCashReceived)}
                className="block w-full px-3 py-2 pr-8 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-clinic-secondary focus:border-clinic-secondary sm:text-sm"
                placeholder="받은 금액"
                autoComplete="off"
              />
              <span className="absolute inset-y-0 right-0 pr-2 flex items-center text-sm text-gray-500">원</span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">거스름돈</label>
            <div className="mt-1 flex items-center justify-end h-10 px-3 py-2 bg-white border border-gray-300 rounded-md">
                <span className={`font-bold ${change < 0 ? 'text-red-500' : 'text-clinic-text-primary'}`}>{change.toLocaleString()}</span>
                <span className="ml-1 text-gray-500">원</span>
            </div>
          </div>
        </div>
      )}
      
      {/* Action Buttons */}
      <div className="flex justify-end pt-4 border-t mt-4">
        <button type="button" onClick={onClose} className="mr-2 px-6 py-2 bg-gray-200 text-gray-800 font-semibold rounded-md hover:bg-gray-300 transition-colors">취소</button>
        <button 
          type="button" 
          onClick={handleComplete}
          className="px-8 py-2 bg-clinic-accent text-white font-semibold rounded-md hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-clinic-accent transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
          disabled={totalAmountAsNumber <= 0}
        >
          수납완료
        </button>
      </div>
    </div>
  );
};

export default PaymentModal;
