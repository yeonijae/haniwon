/**
 * 내원콜 페이지
 * 한약이 3-4일분 남았을 시점에 전화해서 재진 예약 안내
 * - 배송콜과 같은 형식 (좌측 목록, 우측 상세)
 * - 날짜 선택 기능
 * - 미루기 기능
 * - 예약 현황 확인 및 예약 잡기 기능
 * - 카카오톡 메시지 전송
 */

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../doctor/lib/supabaseClient';
import { getCurrentDate } from '@shared/lib/postgres';

interface VisitCallTarget {
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
  expected_end_date: string;
  call_scheduled_date: string;
  days_remaining: number;
  chief_complaint?: string;
  postpone_count: number;
  visit_call_date?: string;
  visit_call_notes?: string;
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

interface ReservationSlot {
  date: string;
  time: string;
  doctor: string;
  available: boolean;
  patientName?: string;
}

// 예약 시 선택할 소요시간 (5분 단위, 1칸~6칸)
const DURATION_OPTIONS = [
  { label: '5분', value: 5, slots: 1 },
  { label: '10분', value: 10, slots: 2 },
  { label: '15분', value: 15, slots: 3 },
  { label: '20분', value: 20, slots: 4 },
  { label: '25분', value: 25, slots: 5 },
  { label: '30분', value: 30, slots: 6 },
];

const VisitCallPage: React.FC = () => {
  // 날짜 선택
  const [selectedDate, setSelectedDate] = useState<string>(getCurrentDate());

  // 데이터
  const [targets, setTargets] = useState<VisitCallTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // 선택된 대상
  const [selectedTarget, setSelectedTarget] = useState<VisitCallTarget | null>(null);
  const [patientInfo, setPatientInfo] = useState<PatientInfo | null>(null);
  const [loadingPatient, setLoadingPatient] = useState(false);

  // 콜 기록 모달
  const [showCallModal, setShowCallModal] = useState(false);
  const [callNotes, setCallNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // 미루기 모달
  const [showPostponeModal, setShowPostponeModal] = useState(false);
  const [postponeDays, setPostponeDays] = useState(1);
  const [postponeReason, setPostponeReason] = useState('');

  // 예약 모달
  const [showReservationModal, setShowReservationModal] = useState(false);
  const [reservationDate, setReservationDate] = useState('');
  const [reservationTime, setReservationTime] = useState('');
  const [reservationDoctor, setReservationDoctor] = useState('');
  const [reservationDuration, setReservationDuration] = useState(15);
  const [reservationMemo, setReservationMemo] = useState('');
  const [availableSlots, setAvailableSlots] = useState<ReservationSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // 의사 목록
  const [doctors, setDoctors] = useState<string[]>(['김원장', '강원장', '임원장', '전원장']);

  // 시간 슬롯 (5분 단위)
  const timeSlots = useMemo(() => {
    const slots: string[] = [];
    for (let hour = 9; hour <= 18; hour++) {
      for (let minute = 0; minute < 60; minute += 5) {
        if (hour === 18 && minute > 0) break;
        slots.push(`${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`);
      }
    }
    return slots;
  }, []);

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

      const callTargets: VisitCallTarget[] = [];

      for (const p of prescriptions || []) {
        const deliveryMethod = p.delivery_method || '직접수령';
        const issuedDate = new Date(p.issued_at);

        // 복약 시작일 계산
        let startDate = new Date(issuedDate);
        if (deliveryMethod === '퀵') startDate.setDate(startDate.getDate() + 1);
        else if (deliveryMethod === '택배') startDate.setDate(startDate.getDate() + 3);

        // 복약 종료 예정일
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + (p.days || 15));

        // 남은 일수 계산
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const daysRemaining = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        // 내원콜 예정일 (미루기 적용된 날짜 또는 기본 종료 3일 전)
        let callDate: Date;
        if (p.visit_call_scheduled_date) {
          callDate = new Date(p.visit_call_scheduled_date);
        } else {
          callDate = new Date(endDate);
          callDate.setDate(callDate.getDate() - 3); // 복약 종료 3일 전
        }
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
            expected_end_date: endDate.toISOString(),
            call_scheduled_date: callDate.toISOString(),
            days_remaining: daysRemaining,
            chief_complaint: chiefComplaint,
            postpone_count: p.visit_call_postponed_count || 0,
            visit_call_date: p.visit_call_date,
            visit_call_notes: p.visit_call_notes,
          });
        }
      }

      // 정렬: 미완료 우선, 남은일수 적은순
      callTargets.sort((a, b) => {
        if (!a.visit_call_date && b.visit_call_date) return -1;
        if (a.visit_call_date && !b.visit_call_date) return 1;
        return a.days_remaining - b.days_remaining;
      });

      setTargets(callTargets);

      // 첫 번째 미완료 항목 자동 선택
      const firstPending = callTargets.find(t => !t.visit_call_date);
      if (firstPending) {
        setSelectedTarget(firstPending);
      } else if (callTargets.length > 0) {
        setSelectedTarget(callTargets[0]);
      } else {
        setSelectedTarget(null);
      }
    } catch (error) {
      console.error('내원콜 대상 로드 실패:', error);
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

  // 예약 현황 로드
  const loadReservationSlots = async (date: string) => {
    try {
      setLoadingSlots(true);

      // 실제로는 reservations 테이블에서 해당 날짜의 예약을 조회
      // 여기서는 임시로 더미 데이터 사용
      const slots: ReservationSlot[] = [];

      for (const doctor of doctors) {
        for (const time of timeSlots) {
          // 임시: 30% 확률로 예약 있음
          const isBooked = Math.random() < 0.3;
          slots.push({
            date,
            time,
            doctor,
            available: !isBooked,
            patientName: isBooked ? '예약환자' : undefined,
          });
        }
      }

      setAvailableSlots(slots);
    } catch (error) {
      console.error('예약 현황 로드 실패:', error);
    } finally {
      setLoadingSlots(false);
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

  const pendingCount = targets.filter(t => !t.visit_call_date).length;
  const completedCount = targets.filter(t => t.visit_call_date).length;

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

  // 콜 완료 처리
  const handleCallRecord = () => {
    if (!selectedTarget) return;
    setCallNotes(selectedTarget.visit_call_notes || '');
    setShowCallModal(true);
  };

  const saveCallRecord = async () => {
    if (!selectedTarget) return;

    try {
      setSaving(true);

      const { error } = await supabase
        .from('prescriptions')
        .update({
          visit_call_date: new Date().toISOString(),
          visit_call_notes: callNotes || null,
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

  // 미루기
  const handlePostpone = () => {
    if (!selectedTarget) return;
    setPostponeDays(1);
    setPostponeReason('');
    setShowPostponeModal(true);
  };

  const savePostpone = async () => {
    if (!selectedTarget) return;

    try {
      setSaving(true);

      const newDate = new Date(selectedDate);
      newDate.setDate(newDate.getDate() + postponeDays);

      const { error } = await supabase
        .from('prescriptions')
        .update({
          visit_call_scheduled_date: newDate.toISOString(),
          visit_call_postponed_count: (selectedTarget.postpone_count || 0) + 1,
          visit_call_postpone_reason: postponeReason || null,
        })
        .eq('id', selectedTarget.prescription_id);

      if (error) throw error;

      setShowPostponeModal(false);
      loadTargets();
    } catch (error) {
      console.error('미루기 저장 실패:', error);
      alert('미루기 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  // 예약하기
  const handleReservation = () => {
    if (!selectedTarget) return;

    // 기본 예약일을 오늘 이후 2일로 설정
    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() + 2);
    const defaultDateStr = `${defaultDate.getFullYear()}-${String(defaultDate.getMonth() + 1).padStart(2, '0')}-${String(defaultDate.getDate()).padStart(2, '0')}`;
    setReservationDate(defaultDateStr);
    setReservationTime('10:00');
    setReservationDoctor(doctors[0]);
    setReservationDuration(15);
    setReservationMemo('');

    loadReservationSlots(defaultDateStr);
    setShowReservationModal(true);
  };

  const saveReservation = async () => {
    if (!selectedTarget || !reservationDate || !reservationTime || !reservationDoctor) {
      alert('예약 정보를 모두 입력해주세요.');
      return;
    }

    try {
      setSaving(true);

      // 예약 저장 (reservations 테이블에 추가)
      // 실제 구현에서는 운영관리시스템의 예약 로직을 따름
      const reservationId = `RES-${Date.now()}`;
      const slots = reservationDuration / 5; // 5분 단위 칸 수

      // 콜 노트에 예약 정보 추가
      const reservationInfo = `예약완료: ${reservationDate} ${reservationTime} ${reservationDoctor} (${reservationDuration}분)`;
      const updatedNotes = callNotes
        ? `${callNotes}\n${reservationInfo}`
        : reservationInfo;

      const { error } = await supabase
        .from('prescriptions')
        .update({
          visit_call_date: new Date().toISOString(),
          visit_call_notes: updatedNotes,
          next_reservation_date: reservationDate,
          next_reservation_time: reservationTime,
          next_reservation_doctor: reservationDoctor,
        })
        .eq('id', selectedTarget.prescription_id);

      if (error) throw error;

      setShowReservationModal(false);
      setShowCallModal(false);
      loadTargets();

      // 카카오톡 메시지 전송 여부 확인
      if (selectedTarget.phone) {
        const sendKakao = window.confirm('예약이 완료되었습니다. 카카오톡으로 예약 안내 메시지를 보내시겠습니까?');
        if (sendKakao) {
          sendKakaoMessage(selectedTarget, reservationDate, reservationTime, reservationDoctor);
        }
      }
    } catch (error) {
      console.error('예약 저장 실패:', error);
      alert('예약 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  // 카카오톡 메시지 전송
  const sendKakaoMessage = async (
    target: VisitCallTarget,
    date: string,
    time: string,
    doctor: string
  ) => {
    try {
      // 카카오 비즈니스 채널을 통한 메시지 전송
      // 실제 구현에서는 카카오 비즈메시지 API 사용
      const message = `
[연이재한의원 예약 안내]

${target.patient_name}님, 안녕하세요.

다음 예약이 확정되었습니다.

📅 예약일시: ${formatFullDate(date)} ${time}
👨‍⚕️ 담당의: ${doctor}

방문 전 궁금하신 점이 있으시면
연락 주세요.

연이재한의원 드림
📞 031-XXX-XXXX
      `.trim();

      console.log('카카오톡 메시지 전송:', {
        phone: target.phone,
        message,
      });

      alert(`카카오톡 메시지 전송 완료\n\n수신자: ${target.phone}\n\n(실제 전송은 카카오 비즈메시지 API 연동 필요)`);
    } catch (error) {
      console.error('카카오톡 전송 실패:', error);
      alert('카카오톡 전송에 실패했습니다.');
    }
  };

  // 특정 날짜/의사의 예약 현황 필터
  const getSlotStatus = (date: string, time: string, doctor: string) => {
    const slot = availableSlots.find(
      s => s.date === date && s.time === time && s.doctor === doctor
    );
    return slot;
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
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
            <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
              <i className="fas fa-hospital text-purple-600"></i>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">내원콜</h1>
              <p className="text-sm text-gray-500">복약 종료 3-4일 전 재진 예약 안내</p>
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
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500"
              />
              {!isToday && (
                <button
                  onClick={() => setSelectedDate(getCurrentDate())}
                  className="px-3 py-2 text-sm text-purple-600 hover:bg-purple-50 rounded-lg"
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
            <div className="flex items-center gap-2 bg-purple-50 px-4 py-2 rounded-lg">
              <span className="text-sm text-gray-600">대기</span>
              <span className="text-xl font-bold text-purple-600">{pendingCount}</span>
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
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500 text-sm"
              />
            </div>
          </div>

          {/* 목록 */}
          <div className="flex-1 overflow-auto">
            {filteredTargets.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                <i className="fas fa-hospital text-4xl mb-4 opacity-30"></i>
                <p>{formatFullDate(selectedDate)}</p>
                <p className="mt-2">내원콜 대상이 없습니다</p>
              </div>
            ) : (
              filteredTargets.map(target => (
                <div
                  key={target.prescription_id}
                  onClick={() => setSelectedTarget(target)}
                  className={`p-4 border-b cursor-pointer transition-all ${
                    selectedTarget?.prescription_id === target.prescription_id
                      ? 'bg-purple-50 border-l-4 border-l-purple-500'
                      : target.visit_call_date
                      ? 'bg-gray-50 opacity-60 hover:opacity-80'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {target.visit_call_date ? (
                          <i className="fas fa-check-circle text-green-500"></i>
                        ) : (
                          <i className="fas fa-phone text-purple-500"></i>
                        )}
                        <span className="font-medium text-gray-900">{target.patient_name}</span>
                        {target.chart_number && (
                          <span className="text-xs text-gray-400">({target.chart_number})</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mt-1 truncate">{target.formula}</p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                        <span className={`font-medium ${
                          target.days_remaining <= 0 ? 'text-red-600' :
                          target.days_remaining <= 3 ? 'text-orange-600' :
                          'text-blue-600'
                        }`}>
                          {target.days_remaining <= 0 ? '복약완료' : `D-${target.days_remaining}`}
                        </span>
                        <span>|</span>
                        <span>{target.days}일분</span>
                        {target.postpone_count > 0 && (
                          <>
                            <span>|</span>
                            <span className="text-yellow-600">{target.postpone_count}회 미룸</span>
                          </>
                        )}
                      </div>
                    </div>
                    {target.visit_call_date && (
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
                  <div className="flex items-center gap-2">
                    {!selectedTarget.visit_call_date ? (
                      <>
                        <button
                          onClick={handlePostpone}
                          className="px-4 py-2 border border-yellow-500 text-yellow-600 rounded-lg hover:bg-yellow-50 transition-colors"
                        >
                          <i className="fas fa-clock mr-2"></i>미루기
                        </button>
                        <button
                          onClick={handleReservation}
                          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                        >
                          <i className="fas fa-calendar-plus mr-2"></i>예약하기
                        </button>
                        <button
                          onClick={handleCallRecord}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                        >
                          <i className="fas fa-check mr-2"></i>콜 완료
                        </button>
                      </>
                    ) : (
                      <span className="px-4 py-2 bg-green-100 text-green-700 rounded-lg">
                        <i className="fas fa-check mr-2"></i>
                        {formatDate(selectedTarget.visit_call_date)} 완료
                      </span>
                    )}
                  </div>
                </div>

                {/* 연락처 */}
                {selectedTarget.phone && (
                  <div className="flex items-center gap-4 mb-4">
                    <a
                      href={`tel:${selectedTarget.phone}`}
                      className="flex items-center gap-2 px-4 py-2 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition-colors"
                    >
                      <i className="fas fa-phone"></i>
                      <span className="font-medium">{selectedTarget.phone}</span>
                    </a>
                    <button
                      onClick={() => selectedTarget.phone && sendKakaoMessage(
                        selectedTarget,
                        getCurrentDate(),
                        '',
                        ''
                      )}
                      className="flex items-center gap-2 px-4 py-2 bg-yellow-50 text-yellow-700 rounded-lg hover:bg-yellow-100 transition-colors"
                    >
                      <i className="fas fa-comment"></i>
                      <span>카카오톡</span>
                    </button>
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

              {/* 복약 상태 카드 */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="font-bold text-gray-900 mb-4 flex items-center">
                  <i className="fas fa-pills text-purple-500 mr-2"></i>
                  복약 상태
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <div className={`text-2xl font-bold ${
                      selectedTarget.days_remaining <= 0 ? 'text-red-600' :
                      selectedTarget.days_remaining <= 3 ? 'text-orange-600' :
                      'text-blue-600'
                    }`}>
                      {selectedTarget.days_remaining <= 0 ? '완료' : `D-${selectedTarget.days_remaining}`}
                    </div>
                    <div className="text-sm text-gray-500 mt-1">남은 일수</div>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <div className="text-2xl font-bold text-gray-900">{selectedTarget.days}일</div>
                    <div className="text-sm text-gray-500 mt-1">처방일수</div>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <div className="text-2xl font-bold text-gray-900">{formatDate(selectedTarget.expected_end_date)}</div>
                    <div className="text-sm text-gray-500 mt-1">종료예정</div>
                  </div>
                </div>
              </div>

              {/* 처방 정보 카드 */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="font-bold text-gray-900 mb-4 flex items-center">
                  <i className="fas fa-prescription text-purple-500 mr-2"></i>
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
              {selectedTarget.visit_call_date && selectedTarget.visit_call_notes && (
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="font-bold text-gray-900 mb-4 flex items-center">
                    <i className="fas fa-comment text-green-500 mr-2"></i>
                    통화 기록
                  </h3>
                  <div className="bg-green-50 rounded-lg p-4">
                    <div className="text-sm text-gray-500 mb-2">
                      {formatFullDate(selectedTarget.visit_call_date)}
                    </div>
                    <div className="text-gray-700 whitespace-pre-wrap">
                      {selectedTarget.visit_call_notes}
                    </div>
                  </div>
                </div>
              )}

              {/* 콜 스크립트 안내 */}
              {!selectedTarget.visit_call_date && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
                  <h3 className="font-bold text-purple-900 mb-3 flex items-center">
                    <i className="fas fa-lightbulb text-purple-500 mr-2"></i>
                    내원콜 안내 스크립트
                  </h3>
                  <div className="text-purple-800 space-y-2 text-sm">
                    <p>"안녕하세요, 연이재한의원입니다. {selectedTarget.patient_name}님 되시죠?"</p>
                    <p>"한약 복용은 잘 하고 계신가요? 불편하신 점은 없으셨나요?"</p>
                    <p>"한약이 {selectedTarget.days_remaining}일 정도 남으셨는데, 재진 예약 잡아드릴까요?"</p>
                    <p>"언제쯤 시간이 괜찮으실까요?"</p>
                    <p className="text-purple-600 font-medium mt-4">[예약 확정 시]</p>
                    <p>"네, {selectedTarget.patient_name}님 OO월 OO일 OO시에 예약 완료되었습니다."</p>
                    <p>"예약 안내 메시지 보내드릴게요. 감사합니다!"</p>
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

      {/* 콜 완료 모달 */}
      {showCallModal && selectedTarget && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-bold text-gray-900">
                <i className="fas fa-check text-green-600 mr-2"></i>내원콜 완료
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
                <div className="text-sm text-purple-600 mt-1">
                  남은 복약일: D-{selectedTarget.days_remaining}
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">통화 내용</label>
                <textarea
                  value={callNotes}
                  onChange={(e) => setCallNotes(e.target.value)}
                  placeholder="재진 예약 여부, 예약 날짜/시간, 특이사항 등을 기록하세요..."
                  rows={5}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500 resize-none"
                />
              </div>

              {/* 빠른 입력 버튼 */}
              <div className="mb-4">
                <div className="text-xs text-gray-500 mb-2">빠른 입력</div>
                <div className="flex flex-wrap gap-2">
                  {['재진 예약 완료', '예약 희망 없음', '부재중', '다시 연락 요청', '복용 양호', '부작용 없음'].map(text => (
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
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {saving ? '저장 중...' : '완료 처리'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 미루기 모달 */}
      {showPostponeModal && selectedTarget && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-bold text-gray-900">
                <i className="fas fa-clock text-yellow-600 mr-2"></i>내원콜 미루기
              </h2>
              <button
                onClick={() => setShowPostponeModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>

            <div className="p-6">
              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <div className="font-medium">{selectedTarget.patient_name}</div>
                <div className="text-sm text-gray-500">{selectedTarget.formula}</div>
                {selectedTarget.postpone_count > 0 && (
                  <div className="text-sm text-yellow-600 mt-1">
                    이미 {selectedTarget.postpone_count}회 미뤘습니다
                  </div>
                )}
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">미룰 일수</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 5, 7].map(days => (
                    <button
                      key={days}
                      onClick={() => setPostponeDays(days)}
                      className={`flex-1 py-2 rounded-lg transition-colors ${
                        postponeDays === days
                          ? 'bg-yellow-500 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {days}일
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">미루는 사유</label>
                <input
                  type="text"
                  value={postponeReason}
                  onChange={(e) => setPostponeReason(e.target.value)}
                  placeholder="예: 부재중, 통화 중, 다시 연락 요청 등"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-yellow-500"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowPostponeModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  onClick={savePostpone}
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 disabled:opacity-50"
                >
                  {saving ? '저장 중...' : `${postponeDays}일 미루기`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 예약 모달 */}
      {showReservationModal && selectedTarget && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0">
              <h2 className="text-lg font-bold text-gray-900">
                <i className="fas fa-calendar-plus text-purple-600 mr-2"></i>재진 예약
              </h2>
              <button
                onClick={() => setShowReservationModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>

            <div className="p-6 overflow-auto">
              {/* 환자 정보 */}
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <div className="font-medium text-lg">{selectedTarget.patient_name}</div>
                <div className="text-sm text-gray-500 mt-1">
                  {selectedTarget.formula} | D-{selectedTarget.days_remaining}
                </div>
              </div>

              {/* 예약 정보 입력 */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">예약 날짜</label>
                  <input
                    type="date"
                    value={reservationDate}
                    onChange={(e) => {
                      setReservationDate(e.target.value);
                      loadReservationSlots(e.target.value);
                    }}
                    min={getCurrentDate()}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">담당 원장</label>
                  <select
                    value={reservationDoctor}
                    onChange={(e) => setReservationDoctor(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500"
                  >
                    {doctors.map(doc => (
                      <option key={doc} value={doc}>{doc}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">예약 시간</label>
                  <select
                    value={reservationTime}
                    onChange={(e) => setReservationTime(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500"
                  >
                    {timeSlots.map(time => {
                      const slot = getSlotStatus(reservationDate, time, reservationDoctor);
                      return (
                        <option
                          key={time}
                          value={time}
                          disabled={slot && !slot.available}
                        >
                          {time} {slot && !slot.available ? '(예약됨)' : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">예상 소요시간</label>
                  <div className="flex gap-1">
                    {DURATION_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setReservationDuration(opt.value)}
                        className={`flex-1 py-2 text-sm rounded-lg transition-colors ${
                          reservationDuration === opt.value
                            ? 'bg-purple-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <div className="text-xs text-gray-500 mt-1 text-right">
                    {reservationDuration / 5}칸 배정
                  </div>
                </div>
              </div>

              {/* 예약 메모 */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">예약 메모</label>
                <textarea
                  value={reservationMemo}
                  onChange={(e) => setReservationMemo(e.target.value)}
                  placeholder="예약 관련 메모..."
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500 resize-none"
                />
              </div>

              {/* 예약 현황 미리보기 */}
              {loadingSlots ? (
                <div className="text-center py-4 text-gray-500">
                  <i className="fas fa-spinner fa-spin mr-2"></i>예약 현황 로딩 중...
                </div>
              ) : (
                <div className="mb-4">
                  <div className="text-sm font-medium text-gray-700 mb-2">
                    {formatFullDate(reservationDate)} {reservationDoctor} 예약 현황
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 max-h-40 overflow-auto">
                    <div className="grid grid-cols-6 gap-1 text-xs">
                      {timeSlots.slice(0, 24).map(time => {
                        const slot = getSlotStatus(reservationDate, time, reservationDoctor);
                        const isSelected = time === reservationTime;
                        return (
                          <button
                            key={time}
                            onClick={() => slot?.available && setReservationTime(time)}
                            disabled={slot && !slot.available}
                            className={`py-1 rounded text-center ${
                              isSelected
                                ? 'bg-purple-600 text-white'
                                : slot?.available
                                ? 'bg-white hover:bg-purple-50 text-gray-700'
                                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                            }`}
                          >
                            {time}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* 버튼 */}
              <div className="flex gap-3">
                <button
                  onClick={() => setShowReservationModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  onClick={saveReservation}
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                >
                  {saving ? '저장 중...' : '예약 확정'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VisitCallPage;
