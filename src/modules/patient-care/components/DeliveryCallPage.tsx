/**
 * 배송콜 페이지
 * 한약 수령 후 3일차 (복약 4-5회 시점) 복용 상태 확인 콜
 */

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../chart/lib/supabaseClient';
import { getCurrentDate } from '@shared/lib/postgres';

interface DeliveryCallTarget {
  prescription_id: number;
  patient_id: number;
  patient_name: string;
  chart_number?: string;
  phone?: string;
  formula: string;
  issued_at: string;
  days: number;
  total_packs?: number;
  delivery_method: string;
  medication_start_date: string;
  call_scheduled_date: string;
  chief_complaint?: string;
  delivery_call_date?: string;
  delivery_call_notes?: string;
}

interface PatientInfo {
  id: number;
  name: string;
  chart_number?: string;
  phone?: string;
  birth_date?: string;
  gender?: string;
  address?: string;
}

const DeliveryCallPage: React.FC = () => {
  // 날짜 선택
  const [selectedDate, setSelectedDate] = useState<string>(getCurrentDate());

  // 데이터
  const [targets, setTargets] = useState<DeliveryCallTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // 선택된 대상
  const [selectedTarget, setSelectedTarget] = useState<DeliveryCallTarget | null>(null);
  const [patientInfo, setPatientInfo] = useState<PatientInfo | null>(null);
  const [loadingPatient, setLoadingPatient] = useState(false);

  // 콜 기록 모달
  const [showCallModal, setShowCallModal] = useState(false);
  const [callNotes, setCallNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadTargets();
  }, [selectedDate]);

  useEffect(() => {
    if (selectedTarget) {
      loadPatientInfo(selectedTarget.patient_id);
    } else {
      setPatientInfo(null);
    }
  }, [selectedTarget]);

  const loadTargets = async () => {
    try {
      setLoading(true);

      const { data: prescriptions, error } = await supabase
        .from('prescriptions')
        .select('*')
        .eq('status', 'issued')
        .eq('medication_completed', false)
        .order('issued_at', { ascending: false });

      if (error) throw error;

      const targetDate = new Date(selectedDate);
      targetDate.setHours(0, 0, 0, 0);

      const callTargets: DeliveryCallTarget[] = [];

      for (const p of prescriptions || []) {
        const deliveryMethod = p.delivery_method || '직접수령';
        const issuedDate = new Date(p.issued_at);

        // 복약 시작일 계산 (수령일)
        let startDate = new Date(issuedDate);
        if (deliveryMethod === '퀵') startDate.setDate(startDate.getDate() + 1);
        else if (deliveryMethod === '택배') startDate.setDate(startDate.getDate() + 3);

        // 배송콜 예정일 (수령 후 3일차 = 복약 4-5회 시점)
        const callDate = new Date(startDate);
        callDate.setDate(callDate.getDate() + 2); // 0일차가 수령일이므로 +2가 3일차
        callDate.setHours(0, 0, 0, 0);

        // 선택한 날짜에 해당하는 콜만 표시
        if (callDate.getTime() === targetDate.getTime()) {
          // 환자 전화번호
          let phone = '';
          if (p.patient_id) {
            const { data: patientData } = await supabase
              .from('patients')
              .select('phone')
              .eq('id', p.patient_id)
              .single();
            phone = patientData?.phone || '';
          }

          // 주소증 가져오기
          let chiefComplaint = '';
          if (p.source_type === 'initial_chart' && p.source_id) {
            const { data: chartData } = await supabase
              .from('initial_charts')
              .select('notes')
              .eq('id', p.source_id)
              .single();
            if (chartData?.notes) {
              const match = chartData.notes.match(/\[주소증\]([\s\S]*?)(?=\n\[|$)/);
              if (match) chiefComplaint = match[1].trim();
            }
          }

          callTargets.push({
            prescription_id: p.id,
            patient_id: p.patient_id,
            patient_name: p.patient_name || '이름없음',
            chart_number: p.chart_number,
            phone,
            formula: p.formula,
            issued_at: p.issued_at,
            days: p.days || 15,
            total_packs: p.total_packs,
            delivery_method: deliveryMethod,
            medication_start_date: startDate.toISOString(),
            call_scheduled_date: callDate.toISOString(),
            chief_complaint: chiefComplaint,
            delivery_call_date: p.delivery_call_date,
            delivery_call_notes: p.delivery_call_notes,
          });
        }
      }

      // 정렬: 미완료 우선
      callTargets.sort((a, b) => {
        if (!a.delivery_call_date && b.delivery_call_date) return -1;
        if (a.delivery_call_date && !b.delivery_call_date) return 1;
        return a.patient_name.localeCompare(b.patient_name);
      });

      setTargets(callTargets);

      // 첫 번째 미완료 항목 자동 선택
      const firstPending = callTargets.find(t => !t.delivery_call_date);
      if (firstPending) {
        setSelectedTarget(firstPending);
      } else if (callTargets.length > 0) {
        setSelectedTarget(callTargets[0]);
      } else {
        setSelectedTarget(null);
      }
    } catch (error) {
      console.error('배송콜 대상 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPatientInfo = async (patientId: number) => {
    try {
      setLoadingPatient(true);
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .eq('id', patientId)
        .single();

      if (error) throw error;
      setPatientInfo(data);
    } catch (error) {
      console.error('환자 정보 로드 실패:', error);
      setPatientInfo(null);
    } finally {
      setLoadingPatient(false);
    }
  };

  // 검색 필터링
  const filteredTargets = useMemo(() => {
    if (!searchTerm) return targets;
    const term = searchTerm.toLowerCase();
    return targets.filter(t =>
      t.patient_name.toLowerCase().includes(term) ||
      t.chart_number?.toLowerCase().includes(term) ||
      t.formula.toLowerCase().includes(term) ||
      t.phone?.includes(term)
    );
  }, [targets, searchTerm]);

  const pendingCount = targets.filter(t => !t.delivery_call_date).length;
  const completedCount = targets.filter(t => t.delivery_call_date).length;

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ko-KR', {
      month: 'short',
      day: 'numeric',
    });
  };

  const formatFullDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'short',
    });
  };

  // 날짜 이동
  const moveDate = (days: number) => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() + days);
    setSelectedDate(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`);
  };

  const isToday = selectedDate === getCurrentDate();

  const handleCallRecord = () => {
    if (!selectedTarget) return;
    setCallNotes(selectedTarget.delivery_call_notes || '');
    setShowCallModal(true);
  };

  const saveCallRecord = async () => {
    if (!selectedTarget) return;

    try {
      setSaving(true);

      const { error } = await supabase
        .from('prescriptions')
        .update({
          delivery_call_date: new Date().toISOString(),
          delivery_call_notes: callNotes || null,
        })
        .eq('id', selectedTarget.prescription_id);

      if (error) throw error;

      setShowCallModal(false);
      loadTargets();
    } catch (error) {
      console.error('콜 기록 저장 실패:', error);
      alert('콜 기록 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white border-b p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <i className="fas fa-truck text-blue-600"></i>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">배송콜</h1>
              <p className="text-sm text-gray-500">수령 후 3일차 (복약 4-5회 시점) 상태 확인</p>
            </div>
          </div>

          {/* 날짜 선택 */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => moveDate(-1)}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100"
            >
              <i className="fas fa-chevron-left text-gray-600"></i>
            </button>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
              />
              {!isToday && (
                <button
                  onClick={() => setSelectedDate(getCurrentDate())}
                  className="px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg"
                >
                  오늘
                </button>
              )}
            </div>
            <button
              onClick={() => moveDate(1)}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100"
            >
              <i className="fas fa-chevron-right text-gray-600"></i>
            </button>
          </div>

          {/* 통계 */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-blue-50 px-4 py-2 rounded-lg">
              <span className="text-sm text-gray-600">대기</span>
              <span className="text-xl font-bold text-blue-600">{pendingCount}</span>
            </div>
            <div className="flex items-center gap-2 bg-green-50 px-4 py-2 rounded-lg">
              <span className="text-sm text-gray-600">완료</span>
              <span className="text-xl font-bold text-green-600">{completedCount}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 메인 컨텐츠 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 왼쪽: 콜 목록 */}
        <div className="w-96 border-r bg-white flex flex-col">
          {/* 검색 */}
          <div className="p-4 border-b">
            <div className="relative">
              <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
              <input
                type="text"
                placeholder="환자명, 차트번호, 전화번호..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 text-sm"
              />
            </div>
          </div>

          {/* 목록 */}
          <div className="flex-1 overflow-auto">
            {filteredTargets.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                <i className="fas fa-truck text-4xl mb-4 opacity-30"></i>
                <p>{formatFullDate(selectedDate)}</p>
                <p className="mt-2">배송콜 대상이 없습니다</p>
              </div>
            ) : (
              filteredTargets.map(target => (
                <div
                  key={target.prescription_id}
                  onClick={() => setSelectedTarget(target)}
                  className={`p-4 border-b cursor-pointer transition-all ${
                    selectedTarget?.prescription_id === target.prescription_id
                      ? 'bg-blue-50 border-l-4 border-l-blue-500'
                      : target.delivery_call_date
                      ? 'bg-gray-50 opacity-60 hover:opacity-80'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {target.delivery_call_date ? (
                          <i className="fas fa-check-circle text-green-500"></i>
                        ) : (
                          <i className="fas fa-phone text-blue-500"></i>
                        )}
                        <span className="font-medium text-gray-900">{target.patient_name}</span>
                        {target.chart_number && (
                          <span className="text-xs text-gray-400">({target.chart_number})</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mt-1 truncate">{target.formula}</p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                        <span>{target.delivery_method}</span>
                        <span>|</span>
                        <span>{target.days}일분</span>
                      </div>
                    </div>
                    {target.delivery_call_date && (
                      <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded">완료</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 오른쪽: 상세 정보 */}
        <div className="flex-1 bg-gray-50 overflow-auto">
          {selectedTarget ? (
            <div className="p-6 space-y-6">
              {/* 환자 정보 카드 */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-gray-900">
                    {selectedTarget.patient_name}
                    {selectedTarget.chart_number && (
                      <span className="text-base font-normal text-gray-500 ml-2">
                        ({selectedTarget.chart_number})
                      </span>
                    )}
                  </h2>
                  {!selectedTarget.delivery_call_date ? (
                    <button
                      onClick={handleCallRecord}
                      className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <i className="fas fa-phone mr-2"></i>콜 완료
                    </button>
                  ) : (
                    <span className="px-4 py-2 bg-green-100 text-green-700 rounded-lg">
                      <i className="fas fa-check mr-2"></i>
                      {formatDate(selectedTarget.delivery_call_date)} 완료
                    </span>
                  )}
                </div>

                {/* 연락처 */}
                {selectedTarget.phone && (
                  <div className="flex items-center gap-4 mb-4">
                    <a
                      href={`tel:${selectedTarget.phone}`}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
                    >
                      <i className="fas fa-phone"></i>
                      <span className="font-medium">{selectedTarget.phone}</span>
                    </a>
                  </div>
                )}

                {/* 환자 기본정보 */}
                {loadingPatient ? (
                  <div className="text-gray-400 text-sm">환자 정보 로딩 중...</div>
                ) : patientInfo && (
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {patientInfo.birth_date && (
                      <div>
                        <span className="text-gray-500">생년월일:</span>
                        <span className="ml-2 text-gray-900">{patientInfo.birth_date}</span>
                      </div>
                    )}
                    {patientInfo.gender && (
                      <div>
                        <span className="text-gray-500">성별:</span>
                        <span className="ml-2 text-gray-900">{patientInfo.gender === 'M' ? '남' : '여'}</span>
                      </div>
                    )}
                    {patientInfo.address && (
                      <div className="col-span-2">
                        <span className="text-gray-500">주소:</span>
                        <span className="ml-2 text-gray-900">{patientInfo.address}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 처방 정보 카드 */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="font-bold text-gray-900 mb-4 flex items-center">
                  <i className="fas fa-prescription text-blue-500 mr-2"></i>
                  처방 정보
                </h3>
                <div className="space-y-4">
                  <div>
                    <div className="text-sm text-gray-500 mb-1">처방명</div>
                    <div className="text-lg font-medium text-gray-900">{selectedTarget.formula}</div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <div className="text-sm text-gray-500 mb-1">복용일수</div>
                      <div className="font-medium text-gray-900">{selectedTarget.days}일</div>
                    </div>
                    {selectedTarget.total_packs && (
                      <div>
                        <div className="text-sm text-gray-500 mb-1">총 팩수</div>
                        <div className="font-medium text-gray-900">{selectedTarget.total_packs}팩</div>
                      </div>
                    )}
                    <div>
                      <div className="text-sm text-gray-500 mb-1">수령방법</div>
                      <div className="font-medium text-gray-900">{selectedTarget.delivery_method}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-gray-500 mb-1">발급일</div>
                      <div className="font-medium text-gray-900">{formatFullDate(selectedTarget.issued_at)}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500 mb-1">복약 시작일</div>
                      <div className="font-medium text-gray-900">{formatFullDate(selectedTarget.medication_start_date)}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 주소증 카드 */}
              {selectedTarget.chief_complaint && (
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="font-bold text-gray-900 mb-4 flex items-center">
                    <i className="fas fa-clipboard-list text-orange-500 mr-2"></i>
                    주소증
                  </h3>
                  <div className="bg-orange-50 rounded-lg p-4 text-gray-700 whitespace-pre-wrap">
                    {selectedTarget.chief_complaint}
                  </div>
                </div>
              )}

              {/* 콜 기록 카드 */}
              {selectedTarget.delivery_call_date && selectedTarget.delivery_call_notes && (
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="font-bold text-gray-900 mb-4 flex items-center">
                    <i className="fas fa-comment text-green-500 mr-2"></i>
                    통화 기록
                  </h3>
                  <div className="bg-green-50 rounded-lg p-4">
                    <div className="text-sm text-gray-500 mb-2">
                      {formatFullDate(selectedTarget.delivery_call_date)}
                    </div>
                    <div className="text-gray-700 whitespace-pre-wrap">
                      {selectedTarget.delivery_call_notes}
                    </div>
                  </div>
                </div>
              )}

              {/* 콜 스크립트 안내 */}
              {!selectedTarget.delivery_call_date && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                  <h3 className="font-bold text-blue-900 mb-3 flex items-center">
                    <i className="fas fa-lightbulb text-blue-500 mr-2"></i>
                    배송콜 안내 스크립트
                  </h3>
                  <div className="text-blue-800 space-y-2 text-sm">
                    <p>"안녕하세요, 연이재한의원입니다. {selectedTarget.patient_name}님 되시죠?"</p>
                    <p>"한약 잘 받으셨나요? 복용은 잘 하고 계신가요?"</p>
                    <p>"혹시 복용하시면서 불편한 점이나 궁금한 점 있으신가요?"</p>
                    <p>"네, 복용 잘 하시고 궁금하신 점 있으시면 언제든 연락 주세요."</p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-400">
              <div className="text-center">
                <i className="fas fa-hand-pointer text-6xl mb-4 opacity-30"></i>
                <p className="text-lg">왼쪽에서 환자를 선택하세요</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 콜 기록 모달 */}
      {showCallModal && selectedTarget && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-bold text-gray-900">
                <i className="fas fa-phone text-blue-600 mr-2"></i>배송콜 완료
              </h2>
              <button
                onClick={() => setShowCallModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>

            <div className="p-6">
              <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                <div className="font-medium text-lg">{selectedTarget.patient_name}</div>
                <div className="text-sm text-gray-500 mt-1">{selectedTarget.formula}</div>
                {selectedTarget.phone && (
                  <div className="text-sm text-blue-600 mt-1">
                    <i className="fas fa-phone mr-1"></i>{selectedTarget.phone}
                  </div>
                )}
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">통화 내용</label>
                <textarea
                  value={callNotes}
                  onChange={(e) => setCallNotes(e.target.value)}
                  placeholder="한약 수령 여부, 복용 상태, 특이사항 등을 기록하세요..."
                  rows={5}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>

              {/* 빠른 입력 버튼 */}
              <div className="mb-4">
                <div className="text-xs text-gray-500 mb-2">빠른 입력</div>
                <div className="flex flex-wrap gap-2">
                  {['정상 복용 중', '수령 완료', '부재중', '다시 연락 요청', '부작용 없음'].map(text => (
                    <button
                      key={text}
                      onClick={() => setCallNotes(prev => prev ? `${prev}\n${text}` : text)}
                      className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                    >
                      {text}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowCallModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  onClick={saveCallRecord}
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? '저장 중...' : '완료 처리'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeliveryCallPage;
