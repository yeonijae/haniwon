/**
 * 애프터콜 페이지
 * 복용 완료 후 사후관리 콜
 * - 내원콜과 같은 형식 (좌측 목록, 우측 상세)
 * - 날짜 선택 기능 (복용 완료일 기준)
 * - 미루기 기능
 * - 재예약 기능
 * - 카카오톡 메시지 전송
 */

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../chart/lib/supabaseClient';
import { getCurrentDate } from '@shared/lib/postgres';

// 진료 카테고리 정의
const TREATMENT_CATEGORIES = [
  { id: 'all', name: '전체', keywords: [] },
  { id: 'pediatric', name: '소아청소년', keywords: ['ADHD', '틱', 'TIC', '성장', '비염', '아토피', '소아', '청소년'] },
  { id: 'gynecology', name: '부인과', keywords: ['생리', '월경', '임신', '산후', '갱년기', '자궁', '난소', '부인'] },
  { id: 'digestive', name: '소화기', keywords: ['소화', '위', '장', '변비', '설사', '복통', '담적', '역류'] },
  { id: 'respiratory', name: '호흡기', keywords: ['기침', '천식', '비염', '코', '감기', '폐', '호흡'] },
  { id: 'skin', name: '피부', keywords: ['아토피', '습진', '두드러기', '피부', '가려움', '여드름'] },
  { id: 'mental', name: '신경정신', keywords: ['불면', '우울', '불안', '스트레스', '두통', '어지러움'] },
  { id: 'musculoskeletal', name: '근골격', keywords: ['허리', '목', '어깨', '관절', '통증', '디스크', '척추'] },
  { id: 'metabolic', name: '대사/비만', keywords: ['비만', '다이어트', '당뇨', '고혈압', '갑상선'] },
  { id: 'fatigue', name: '피로/보약', keywords: ['피로', '보약', '면역', '기력', '체력'] },
  { id: 'other', name: '기타', keywords: [] }
];

interface AfterCallTarget {
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
  completed_date: string;
  days_since_completion: number;
  chief_complaint?: string;
  category: string;
  call_scheduled_date: string;
  postpone_count: number;
  after_call_date?: string;
  after_call_notes?: string;
  after_call_result?: string;
  call_count: number;
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

interface AfterCareCall {
  id: number;
  patient_id: number;
  prescription_id: number;
  call_date: string;
  call_result: string;
  notes?: string;
  next_action?: string;
}

// 예약 시 선택할 소요시간 (5분 단위)
const DURATION_OPTIONS = [
  { label: '5분', value: 5, slots: 1 },
  { label: '10분', value: 10, slots: 2 },
  { label: '15분', value: 15, slots: 3 },
  { label: '20분', value: 20, slots: 4 },
  { label: '25분', value: 25, slots: 5 },
  { label: '30분', value: 30, slots: 6 },
];

const AfterCallPage: React.FC = () => {
  // 날짜 선택
  const [selectedDate, setSelectedDate] = useState<string>(getCurrentDate());

  // 카테고리 필터
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // 데이터
  const [targets, setTargets] = useState<AfterCallTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // 선택된 대상
  const [selectedTarget, setSelectedTarget] = useState<AfterCallTarget | null>(null);
  const [patientInfo, setPatientInfo] = useState<PatientInfo | null>(null);
  const [loadingPatient, setLoadingPatient] = useState(false);

  // 통화 이력
  const [callHistory, setCallHistory] = useState<AfterCareCall[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // 콜 기록 모달
  const [showCallModal, setShowCallModal] = useState(false);
  const [callNotes, setCallNotes] = useState('');
  const [callResult, setCallResult] = useState<'connected' | 'no_answer' | 'callback' | 'completed'>('connected');
  const [nextAction, setNextAction] = useState('');
  const [saving, setSaving] = useState(false);

  // 미루기 모달
  const [showPostponeModal, setShowPostponeModal] = useState(false);
  const [postponeDays, setPostponeDays] = useState(7);
  const [postponeReason, setPostponeReason] = useState('');

  // 예약 모달
  const [showReservationModal, setShowReservationModal] = useState(false);
  const [reservationDate, setReservationDate] = useState('');
  const [reservationTime, setReservationTime] = useState('');
  const [reservationDoctor, setReservationDoctor] = useState('');
  const [reservationDuration, setReservationDuration] = useState(15);

  // 의사 목록
  const doctors = ['김원장', '강원장', '임원장', '전원장'];

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
      loadCallHistory(selectedTarget.prescription_id);
    } else {
      setPatientInfo(null);
      setCallHistory([]);
    }
  }, [selectedTarget]);

  // 주소증 기반 카테고리 분류
  const categorizeByChiefComplaint = (chiefComplaint: string): string => {
    if (!chiefComplaint) return 'other';
    const lowerComplaint = chiefComplaint.toLowerCase();
    for (const category of TREATMENT_CATEGORIES) {
      if (category.id === 'all') continue;
      if (category.keywords.some(keyword => lowerComplaint.includes(keyword.toLowerCase()))) {
        return category.id;
      }
    }
    return 'other';
  };

  const loadTargets = async () => {
    try {
      setLoading(true);

      const { data: prescriptions, error } = await supabase
        .from('prescriptions')
        .select('*')
        .eq('status', 'issued')
        .order('issued_at', { ascending: false });

      if (error) throw error;

      const targetDate = new Date(selectedDate);
      targetDate.setHours(0, 0, 0, 0);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const callTargets: AfterCallTarget[] = [];

      for (const p of prescriptions || []) {
        const deliveryMethod = p.delivery_method || '직접수령';
        const issuedDate = new Date(p.issued_at);

        // 복약 시작일 계산
        let startDate = new Date(issuedDate);
        if (deliveryMethod === '퀵') startDate.setDate(startDate.getDate() + 1);
        else if (deliveryMethod === '택배') startDate.setDate(startDate.getDate() + 3);

        // 복약 완료일
        const completedDate = new Date(startDate);
        completedDate.setDate(completedDate.getDate() + (p.days || 15));

        // 복용이 완료되지 않은 경우 스킵
        if (completedDate > today) continue;

        // 완료 후 경과일
        const daysSinceCompletion = Math.floor((today.getTime() - completedDate.getTime()) / (1000 * 60 * 60 * 24));

        // 애프터콜 예정일 (미루기 적용된 날짜 또는 기본 완료 후 7일)
        let callDate: Date;
        if (p.after_call_scheduled_date) {
          callDate = new Date(p.after_call_scheduled_date);
        } else {
          callDate = new Date(completedDate);
          callDate.setDate(callDate.getDate() + 7); // 복용 완료 7일 후
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

          // 통화 횟수
          const { count } = await supabase
            .from('aftercare_calls')
            .select('*', { count: 'exact', head: true })
            .eq('prescription_id', p.id);

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
            completed_date: completedDate.toISOString(),
            days_since_completion: daysSinceCompletion,
            chief_complaint: chiefComplaint,
            category: categorizeByChiefComplaint(chiefComplaint),
            call_scheduled_date: callDate.toISOString(),
            postpone_count: p.after_call_postponed_count || 0,
            after_call_date: p.after_call_date,
            after_call_notes: p.after_call_notes,
            after_call_result: p.after_call_result,
            call_count: count || 0,
          });
        }
      }

      // 정렬: 미완료 우선, 경과일 많은순
      callTargets.sort((a, b) => {
        if (!a.after_call_date && b.after_call_date) return -1;
        if (a.after_call_date && !b.after_call_date) return 1;
        return b.days_since_completion - a.days_since_completion;
      });

      setTargets(callTargets);

      // 첫 번째 미완료 항목 자동 선택
      const firstPending = callTargets.find(t => !t.after_call_date);
      if (firstPending) {
        setSelectedTarget(firstPending);
      } else if (callTargets.length > 0) {
        setSelectedTarget(callTargets[0]);
      } else {
        setSelectedTarget(null);
      }
    } catch (error) {
      console.error('애프터콜 대상 로드 실패:', error);
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

  const loadCallHistory = async (prescriptionId: number) => {
    try {
      setLoadingHistory(true);
      const { data, error } = await supabase
        .from('aftercare_calls')
        .select('*')
        .eq('prescription_id', prescriptionId)
        .order('call_date', { ascending: false });

      if (error) throw error;
      setCallHistory(data || []);
    } catch (error) {
      console.error('통화 기록 로드 실패:', error);
      setCallHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  // 카테고리별 환자 수
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: targets.length };
    TREATMENT_CATEGORIES.forEach(cat => {
      if (cat.id !== 'all') {
        counts[cat.id] = targets.filter(t => t.category === cat.id).length;
      }
    });
    return counts;
  }, [targets]);

  // 검색 및 카테고리 필터링
  const filteredTargets = useMemo(() => {
    let result = targets;

    // 카테고리 필터
    if (selectedCategory !== 'all') {
      result = result.filter(t => t.category === selectedCategory);
    }

    // 검색어 필터
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(t =>
        t.patient_name.toLowerCase().includes(term) ||
        t.chart_number?.toLowerCase().includes(term) ||
        t.formula.toLowerCase().includes(term) ||
        t.chief_complaint?.toLowerCase().includes(term) ||
        t.phone?.includes(term)
      );
    }

    return result;
  }, [targets, selectedCategory, searchTerm]);

  const pendingCount = targets.filter(t => !t.after_call_date).length;
  const completedCount = targets.filter(t => t.after_call_date).length;

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
    setCallNotes(selectedTarget.after_call_notes || '');
    setCallResult('connected');
    setNextAction('');
    setShowCallModal(true);
  };

  const saveCallRecord = async () => {
    if (!selectedTarget) return;

    try {
      setSaving(true);

      // aftercare_calls 테이블에 기록 추가
      await supabase
        .from('aftercare_calls')
        .insert([{
          patient_id: selectedTarget.patient_id,
          prescription_id: selectedTarget.prescription_id,
          call_date: new Date().toISOString(),
          call_result: callResult,
          notes: callNotes || null,
          next_action: nextAction || null,
        }]);

      // 상담완료인 경우 처방전에도 기록
      if (callResult === 'completed') {
        await supabase
          .from('prescriptions')
          .update({
            after_call_date: new Date().toISOString(),
            after_call_notes: callNotes || null,
            after_call_result: callResult,
          })
          .eq('id', selectedTarget.prescription_id);
      }

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
    setPostponeDays(7);
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
          after_call_scheduled_date: newDate.toISOString(),
          after_call_postponed_count: (selectedTarget.postpone_count || 0) + 1,
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

    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() + 3);
    setReservationDate(`${defaultDate.getFullYear()}-${String(defaultDate.getMonth() + 1).padStart(2, '0')}-${String(defaultDate.getDate()).padStart(2, '0')}`);
    setReservationTime('10:00');
    setReservationDoctor(doctors[0]);
    setReservationDuration(15);
    setShowReservationModal(true);
  };

  const saveReservation = async () => {
    if (!selectedTarget || !reservationDate || !reservationTime || !reservationDoctor) {
      alert('예약 정보를 모두 입력해주세요.');
      return;
    }

    try {
      setSaving(true);

      const reservationInfo = `예약완료: ${reservationDate} ${reservationTime} ${reservationDoctor} (${reservationDuration}분)`;

      // 콜 기록 추가
      await supabase
        .from('aftercare_calls')
        .insert([{
          patient_id: selectedTarget.patient_id,
          prescription_id: selectedTarget.prescription_id,
          call_date: new Date().toISOString(),
          call_result: 'completed',
          notes: reservationInfo,
          next_action: '재진 예약',
        }]);

      // 처방전 업데이트
      await supabase
        .from('prescriptions')
        .update({
          after_call_date: new Date().toISOString(),
          after_call_notes: reservationInfo,
          after_call_result: 'completed',
        })
        .eq('id', selectedTarget.prescription_id);

      setShowReservationModal(false);
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
    target: AfterCallTarget,
    date: string,
    time: string,
    doctor: string
  ) => {
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

    console.log('카카오톡 메시지 전송:', { phone: target.phone, message });
    alert(`카카오톡 메시지 전송 완료\n\n수신자: ${target.phone}\n\n(실제 전송은 카카오 비즈메시지 API 연동 필요)`);
  };

  // 통화 결과 라벨
  const getCallResultLabel = (result: string) => {
    switch (result) {
      case 'connected': return '연결됨';
      case 'no_answer': return '부재중';
      case 'callback': return '재통화';
      case 'completed': return '상담완료';
      default: return result;
    }
  };

  const getCallResultColor = (result: string) => {
    switch (result) {
      case 'connected': return 'bg-green-100 text-green-700';
      case 'no_answer': return 'bg-gray-200 text-gray-700';
      case 'callback': return 'bg-yellow-100 text-yellow-700';
      case 'completed': return 'bg-blue-100 text-blue-700';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white border-b p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center">
              <i className="fas fa-user-check text-teal-600"></i>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">애프터콜</h1>
              <p className="text-sm text-gray-500">복용 완료 후 사후관리</p>
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
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-teal-500"
              />
              {!isToday && (
                <button
                  onClick={() => setSelectedDate(getCurrentDate())}
                  className="px-3 py-2 text-sm text-teal-600 hover:bg-teal-50 rounded-lg"
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
            <div className="flex items-center gap-2 bg-teal-50 px-4 py-2 rounded-lg">
              <span className="text-sm text-gray-600">대기</span>
              <span className="text-xl font-bold text-teal-600">{pendingCount}</span>
            </div>
            <div className="flex items-center gap-2 bg-green-50 px-4 py-2 rounded-lg">
              <span className="text-sm text-gray-600">완료</span>
              <span className="text-xl font-bold text-green-600">{completedCount}</span>
            </div>
          </div>
        </div>

        {/* 카테고리 필터 */}
        <div className="flex flex-wrap gap-2">
          {TREATMENT_CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                selectedCategory === cat.id
                  ? 'bg-teal-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {cat.name} ({categoryCounts[cat.id] || 0})
            </button>
          ))}
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
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-teal-500 text-sm"
              />
            </div>
          </div>

          {/* 목록 */}
          <div className="flex-1 overflow-auto">
            {filteredTargets.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                <i className="fas fa-user-check text-4xl mb-4 opacity-30"></i>
                <p>{formatFullDate(selectedDate)}</p>
                <p className="mt-2">애프터콜 대상이 없습니다</p>
              </div>
            ) : (
              filteredTargets.map(target => (
                <div
                  key={target.prescription_id}
                  onClick={() => setSelectedTarget(target)}
                  className={`p-4 border-b cursor-pointer transition-all ${
                    selectedTarget?.prescription_id === target.prescription_id
                      ? 'bg-teal-50 border-l-4 border-l-teal-500'
                      : target.after_call_date
                      ? 'bg-gray-50 opacity-60 hover:opacity-80'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {target.after_call_date ? (
                          <i className="fas fa-check-circle text-green-500"></i>
                        ) : (
                          <i className="fas fa-phone text-teal-500"></i>
                        )}
                        <span className="font-medium text-gray-900">{target.patient_name}</span>
                        {target.chart_number && (
                          <span className="text-xs text-gray-400">({target.chart_number})</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mt-1 truncate">{target.formula}</p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                        <span className="text-teal-600 font-medium">
                          완료 {target.days_since_completion}일 전
                        </span>
                        <span>|</span>
                        <span>{target.days}일분</span>
                        {target.call_count > 0 && (
                          <>
                            <span>|</span>
                            <span className="text-green-600">통화 {target.call_count}회</span>
                          </>
                        )}
                        {target.postpone_count > 0 && (
                          <>
                            <span>|</span>
                            <span className="text-yellow-600">{target.postpone_count}회 미룸</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {target.after_call_date && (
                        <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded">완료</span>
                      )}
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        target.days_since_completion <= 7 ? 'bg-green-100 text-green-700' :
                        target.days_since_completion <= 30 ? 'bg-yellow-100 text-yellow-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {TREATMENT_CATEGORIES.find(c => c.id === target.category)?.name || '기타'}
                      </span>
                    </div>
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
                    {!selectedTarget.after_call_date ? (
                      <>
                        <button
                          onClick={handlePostpone}
                          className="px-4 py-2 border border-yellow-500 text-yellow-600 rounded-lg hover:bg-yellow-50 transition-colors"
                        >
                          <i className="fas fa-clock mr-2"></i>미루기
                        </button>
                        <button
                          onClick={handleReservation}
                          className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
                        >
                          <i className="fas fa-calendar-plus mr-2"></i>예약하기
                        </button>
                        <button
                          onClick={handleCallRecord}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                        >
                          <i className="fas fa-phone mr-2"></i>콜 기록
                        </button>
                      </>
                    ) : (
                      <span className="px-4 py-2 bg-green-100 text-green-700 rounded-lg">
                        <i className="fas fa-check mr-2"></i>
                        {formatDate(selectedTarget.after_call_date)} 완료
                      </span>
                    )}
                  </div>
                </div>

                {/* 연락처 */}
                {selectedTarget.phone && (
                  <div className="flex items-center gap-4 mb-4">
                    <a
                      href={`tel:${selectedTarget.phone}`}
                      className="flex items-center gap-2 px-4 py-2 bg-teal-50 text-teal-700 rounded-lg hover:bg-teal-100 transition-colors"
                    >
                      <i className="fas fa-phone"></i>
                      <span className="font-medium">{selectedTarget.phone}</span>
                    </a>
                    <button
                      onClick={() => alert('카카오톡 메시지 전송 (API 연동 필요)')}
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
                  </div>
                )}
              </div>

              {/* 복약 정보 카드 */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="font-bold text-gray-900 mb-4 flex items-center">
                  <i className="fas fa-pills text-teal-500 mr-2"></i>
                  복약 정보
                </h3>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <div className="text-2xl font-bold text-teal-600">
                      {selectedTarget.days_since_completion}일
                    </div>
                    <div className="text-sm text-gray-500 mt-1">완료 후 경과</div>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <div className="text-2xl font-bold text-gray-900">{selectedTarget.days}일</div>
                    <div className="text-sm text-gray-500 mt-1">처방일수</div>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <div className="text-2xl font-bold text-gray-900">{formatDate(selectedTarget.completed_date)}</div>
                    <div className="text-sm text-gray-500 mt-1">복약완료</div>
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-500 mb-1">처방명</div>
                  <div className="text-lg font-medium text-gray-900">{selectedTarget.formula}</div>
                </div>
              </div>

              {/* 주소증 카드 */}
              {selectedTarget.chief_complaint && (
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="font-bold text-gray-900 mb-4 flex items-center">
                    <i className="fas fa-clipboard-list text-orange-500 mr-2"></i>
                    주소증
                    <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                      selectedTarget.days_since_completion <= 7 ? 'bg-green-100 text-green-700' :
                      selectedTarget.days_since_completion <= 30 ? 'bg-yellow-100 text-yellow-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {TREATMENT_CATEGORIES.find(c => c.id === selectedTarget.category)?.name || '기타'}
                    </span>
                  </h3>
                  <div className="bg-orange-50 rounded-lg p-4 text-gray-700 whitespace-pre-wrap">
                    {selectedTarget.chief_complaint}
                  </div>
                </div>
              )}

              {/* 통화 이력 카드 */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="font-bold text-gray-900 mb-4 flex items-center">
                  <i className="fas fa-history text-blue-500 mr-2"></i>
                  통화 이력
                  <span className="ml-2 text-sm font-normal text-gray-500">({callHistory.length}건)</span>
                </h3>
                {loadingHistory ? (
                  <div className="text-center py-4 text-gray-500">
                    <i className="fas fa-spinner fa-spin mr-2"></i>로딩 중...
                  </div>
                ) : callHistory.length === 0 ? (
                  <div className="bg-gray-50 rounded-lg p-4 text-center text-gray-500 text-sm">
                    통화 기록이 없습니다
                  </div>
                ) : (
                  <div className="space-y-3">
                    {callHistory.map(call => (
                      <div key={call.id} className="bg-gray-50 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-gray-500">
                            {formatFullDate(call.call_date)}
                          </span>
                          <span className={`text-xs px-2 py-1 rounded-full ${getCallResultColor(call.call_result)}`}>
                            {getCallResultLabel(call.call_result)}
                          </span>
                        </div>
                        {call.notes && (
                          <p className="text-gray-700 text-sm">{call.notes}</p>
                        )}
                        {call.next_action && (
                          <p className="text-xs text-blue-600 mt-2">
                            <i className="fas fa-arrow-right mr-1"></i>
                            {call.next_action}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 콜 스크립트 안내 */}
              {!selectedTarget.after_call_date && (
                <div className="bg-teal-50 border border-teal-200 rounded-lg p-6">
                  <h3 className="font-bold text-teal-900 mb-3 flex items-center">
                    <i className="fas fa-lightbulb text-teal-500 mr-2"></i>
                    애프터콜 안내 스크립트
                  </h3>
                  <div className="text-teal-800 space-y-2 text-sm">
                    <p>"안녕하세요, 연이재한의원입니다. {selectedTarget.patient_name}님 되시죠?"</p>
                    <p>"지난번 복용하셨던 한약의 효과는 어떠셨나요?"</p>
                    <p>"불편하셨던 증상이 어느 정도 좋아지셨나요?"</p>
                    <p className="text-teal-600 font-medium mt-4">[증상 개선된 경우]</p>
                    <p>"좋아지셨다니 다행입니다. 추가 치료가 필요하시면 언제든 연락 주세요."</p>
                    <p className="text-teal-600 font-medium mt-4">[재진 필요한 경우]</p>
                    <p>"재진 예약 잡아드릴까요? 언제쯤 시간이 괜찮으실까요?"</p>
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
                <i className="fas fa-phone text-green-600 mr-2"></i>통화 기록
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
                <div className="text-sm text-teal-600 mt-1">
                  복용 완료 {selectedTarget.days_since_completion}일 전
                </div>
              </div>

              {/* 통화 결과 */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">통화 결과</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'connected', label: '연결됨', color: 'green' },
                    { value: 'no_answer', label: '부재중', color: 'gray' },
                    { value: 'callback', label: '재통화 필요', color: 'yellow' },
                    { value: 'completed', label: '상담완료', color: 'blue' }
                  ].map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setCallResult(opt.value as any)}
                      className={`py-2 text-sm rounded-lg transition-colors ${
                        callResult === opt.value
                          ? `bg-${opt.color}-500 text-white`
                          : `bg-${opt.color}-50 text-${opt.color}-700 hover:bg-${opt.color}-100`
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">통화 내용</label>
                <textarea
                  value={callNotes}
                  onChange={(e) => setCallNotes(e.target.value)}
                  placeholder="통화 내용을 기록하세요..."
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-teal-500 resize-none"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">다음 조치</label>
                <input
                  type="text"
                  value={nextAction}
                  onChange={(e) => setNextAction(e.target.value)}
                  placeholder="예: 1주 후 재통화, 내원 예약 등"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-teal-500"
                />
              </div>

              {/* 빠른 입력 버튼 */}
              <div className="mb-4">
                <div className="text-xs text-gray-500 mb-2">빠른 입력</div>
                <div className="flex flex-wrap gap-2">
                  {['증상 호전', '효과 양호', '재진 희망', '추가 상담 필요', '부재중', '다시 연락'].map(text => (
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
                  {saving ? '저장 중...' : '저장'}
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
                <i className="fas fa-clock text-yellow-600 mr-2"></i>애프터콜 미루기
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
                  {[3, 5, 7, 14, 30].map(days => (
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
                <i className="fas fa-calendar-plus text-teal-600 mr-2"></i>재진 예약
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
                  {selectedTarget.formula} | 완료 {selectedTarget.days_since_completion}일 전
                </div>
              </div>

              {/* 예약 정보 입력 */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">예약 날짜</label>
                  <input
                    type="date"
                    value={reservationDate}
                    onChange={(e) => setReservationDate(e.target.value)}
                    min={getCurrentDate()}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">담당 원장</label>
                  <select
                    value={reservationDoctor}
                    onChange={(e) => setReservationDoctor(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-teal-500"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-teal-500"
                  >
                    {timeSlots.map(time => (
                      <option key={time} value={time}>{time}</option>
                    ))}
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
                            ? 'bg-teal-600 text-white'
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
                  className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
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

export default AfterCallPage;
