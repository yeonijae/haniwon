import React, { useState, useEffect, useMemo } from 'react';
import { query, queryOne, execute, insert, escapeString, toSqlValue, getCurrentTimestamp } from '@shared/lib/postgres';

// 오늘의 콜 대상 인터페이스
interface TodayCallTarget {
  prescription_id: number;
  patient_id: number;
  patient_name: string;
  chart_number?: string;
  phone?: string;
  formula: string;
  issued_at: string;
  days: number;
  delivery_method: string;
  medication_start_date: string;
  call_scheduled_date: string;
  visit_call_scheduled_date?: string;
  visit_call_postponed_count?: number;
  visit_call_postpone_reason?: string;
  chief_complaint?: string;
  is_completed?: boolean;
  call_completed_at?: string;
}

interface MedicationPatient {
  patient_id: number;
  patient_name: string;
  chart_number?: string;
  phone?: string;
  active_prescriptions: number;
  last_prescription_date: string;
}

interface Treatment {
  id: number;
  prescription_id: number;
  formula: string;
  issued_at: string;
  days: number;
  total_packs: number;
  status: 'active' | 'completed';
  completed_at?: string;
  chief_complaint?: string;
  delivery_completed?: boolean;
  delivery_completed_at?: string;
  medication_completed?: boolean;
  medication_completed_at?: string;
}

interface PrescriptionDetail {
  id: number;
  formula: string;
  issued_at: string;
  days: number;
  total_packs: number;
  doses_per_day: number;
  expected_end_date: string;
  days_remaining: number;
  delivery_completed: boolean;
  delivery_call_date?: string;
  delivery_call_notes?: string;
  visit_call_date?: string;
  visit_call_notes?: string;
  medication_completed: boolean;
  medication_completed_at?: string;
  chief_complaint?: string;
}

interface AppointmentSlot {
  time: string;
  available: boolean;
}

const MedicationManagement: React.FC = () => {
  // 탭 상태
  const [activeTab, setActiveTab] = useState<'today' | 'patients'>('today');

  // 오늘의 콜 목록
  const [selectedCallDate, setSelectedCallDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [deliveryCallTargets, setDeliveryCallTargets] = useState<TodayCallTarget[]>([]);
  const [visitCallTargets, setVisitCallTargets] = useState<TodayCallTarget[]>([]);
  const [loadingTodayCalls, setLoadingTodayCalls] = useState(true);

  // 환자 목록 상태
  const [patients, setPatients] = useState<MedicationPatient[]>([]);
  const [loadingPatients, setLoadingPatients] = useState(true);
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // 선택된 환자의 치료 목록
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [loadingTreatments, setLoadingTreatments] = useState(false);
  const [selectedTreatmentId, setSelectedTreatmentId] = useState<number | null>(null);

  // 선택된 치료의 처방 상세
  const [prescriptions, setPrescriptions] = useState<PrescriptionDetail[]>([]);
  const [loadingPrescriptions, setLoadingPrescriptions] = useState(false);

  // 콜 기록 모달
  const [showCallModal, setShowCallModal] = useState(false);
  const [callType, setCallType] = useState<'delivery' | 'visit'>('delivery');
  const [selectedCallTarget, setSelectedCallTarget] = useState<TodayCallTarget | null>(null);
  const [selectedPrescription, setSelectedPrescription] = useState<PrescriptionDetail | null>(null);
  const [callNotes, setCallNotes] = useState('');

  // 예약 모달
  const [showAppointmentModal, setShowAppointmentModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedDoctor, setSelectedDoctor] = useState('');
  const [availableSlots, setAvailableSlots] = useState<AppointmentSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState('');

  // 미루기 모달
  const [showPostponeModal, setShowPostponeModal] = useState(false);
  const [postponeDays, setPostponeDays] = useState(3);
  const [postponeTargetId, setPostponeTargetId] = useState<number | null>(null);
  const [postponeCount, setPostponeCount] = useState(0);
  const [postponeReason, setPostponeReason] = useState('');

  useEffect(() => {
    loadPatients();
  }, []);

  useEffect(() => {
    if (activeTab === 'today') {
      loadTodayCalls();
    }
  }, [selectedCallDate, activeTab]);

  // 복약 시작일 계산
  const getMedicationStartDate = (issuedDate: string, deliveryMethod: string): Date => {
    const issued = new Date(issuedDate);
    switch (deliveryMethod) {
      case '직접수령':
        return issued;
      case '퀵':
        issued.setDate(issued.getDate() + 1);
        return issued;
      case '택배':
        issued.setDate(issued.getDate() + 3);
        return issued;
      default:
        return issued;
    }
  };

  // 배송콜 예정일 계산 (복약 시작일 +2일)
  const getDeliveryCallScheduledDate = (startDate: Date): Date => {
    const callDate = new Date(startDate);
    callDate.setDate(callDate.getDate() + 2);
    return callDate;
  };

  // 내원콜 예정일 계산 (복약 종료 예정일 -3일)
  const getVisitCallScheduledDate = (issuedDate: string, days: number, startDate: Date): Date => {
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + days);
    const callDate = new Date(endDate);
    callDate.setDate(callDate.getDate() - 3);
    return callDate;
  };

  // 오늘의 콜 대상 로드
  const loadTodayCalls = async () => {
    try {
      setLoadingTodayCalls(true);

      // 발급 완료되었고 복약 완료되지 않은 처방 조회 - SQLite
      const prescriptions = await query<any>(
        `SELECT * FROM prescriptions WHERE status = 'issued' AND (medication_completed = 0 OR medication_completed IS NULL) ORDER BY issued_at DESC`
      );

      const targetDate = new Date(selectedCallDate);
      targetDate.setHours(0, 0, 0, 0);

      const deliveryTargets: TodayCallTarget[] = [];
      const visitTargets: TodayCallTarget[] = [];

      for (const p of prescriptions || []) {
        // 환자 정보 가져오기 - SQLite (patients 테이블이 없으면 스킵)
        let phone = '';
        try {
          const patient = await queryOne<{ phone: string }>(
            `SELECT phone FROM patients WHERE id = ${p.patient_id}`
          );
          phone = patient?.phone || '';
        } catch { /* patients 테이블이 없을 수 있음 */ }

        // 주소증 가져오기
        let chiefComplaint = '';
        if (p.source_type === 'initial_chart' && p.source_id) {
          const chartData = await queryOne<{ notes: string }>(
            `SELECT notes FROM initial_charts WHERE id = ${p.source_id}`
          );
          if (chartData?.notes) {
            const match = chartData.notes.match(/\[주소증\]([\s\S]*?)(?=\n\[|$)/);
            if (match) chiefComplaint = match[1].trim();
          }
        }

        const deliveryMethod = p.delivery_method || '직접수령';
        const startDate = getMedicationStartDate(p.issued_at, deliveryMethod);

        // 배송콜 체크
        const deliveryCallDate = getDeliveryCallScheduledDate(startDate);
        deliveryCallDate.setHours(0, 0, 0, 0);

        if (deliveryCallDate <= targetDate) {
          deliveryTargets.push({
            prescription_id: p.id,
            patient_id: p.patient_id,
            patient_name: p.patient_name || '이름없음',
            chart_number: p.chart_number,
            phone: phone,
            formula: p.formula,
            issued_at: p.issued_at,
            days: p.days || 15,
            delivery_method: deliveryMethod,
            medication_start_date: startDate.toISOString(),
            call_scheduled_date: deliveryCallDate.toISOString(),
            chief_complaint: chiefComplaint,
            is_completed: !!p.delivery_call_date,
            call_completed_at: p.delivery_call_date
          });
        }

        // 내원콜 체크
        const visitCallDate = p.visit_call_scheduled_date
          ? new Date(p.visit_call_scheduled_date)
          : getVisitCallScheduledDate(p.issued_at, p.days || 15, startDate);
        visitCallDate.setHours(0, 0, 0, 0);

        if (visitCallDate <= targetDate) {
          visitTargets.push({
            prescription_id: p.id,
            patient_id: p.patient_id,
            patient_name: p.patient_name || '이름없음',
            chart_number: p.chart_number,
            phone: phone,
            formula: p.formula,
            issued_at: p.issued_at,
            days: p.days || 15,
            delivery_method: deliveryMethod,
            medication_start_date: startDate.toISOString(),
            call_scheduled_date: visitCallDate.toISOString(),
            visit_call_scheduled_date: p.visit_call_scheduled_date,
            visit_call_postponed_count: p.visit_call_postponed_count || 0,
            visit_call_postpone_reason: p.visit_call_postpone_reason,
            chief_complaint: chiefComplaint,
            is_completed: !!p.visit_call_date,
            call_completed_at: p.visit_call_date
          });
        }
      }

      setDeliveryCallTargets(deliveryTargets);
      setVisitCallTargets(visitTargets);
    } catch (error) {
      console.error('오늘의 콜 목록 로드 실패:', error);
    } finally {
      setLoadingTodayCalls(false);
    }
  };

  // 복약 관리 대상 환자 목록 로드
  const loadPatients = async () => {
    try {
      setLoadingPatients(true);

      // SQLite에서 처방 목록 조회
      const prescriptions = await query<{
        patient_id: number;
        patient_name: string;
        chart_number: string;
        issued_at: string;
      }>(`SELECT patient_id, patient_name, chart_number, issued_at FROM prescriptions WHERE status = 'issued' ORDER BY issued_at DESC`);

      const patientMap = new Map<number, MedicationPatient>();

      for (const p of prescriptions || []) {
        if (!p.patient_id) continue;

        if (!patientMap.has(p.patient_id)) {
          // 환자 정보 가져오기 (patients 테이블이 없으면 스킵)
          let phone = '';
          try {
            const patientData = await queryOne<{ phone: string }>(
              `SELECT phone FROM patients WHERE id = ${p.patient_id}`
            );
            phone = patientData?.phone || '';
          } catch { /* patients 테이블이 없을 수 있음 */ }

          patientMap.set(p.patient_id, {
            patient_id: p.patient_id,
            patient_name: p.patient_name || '이름없음',
            chart_number: p.chart_number,
            phone: phone,
            active_prescriptions: 1,
            last_prescription_date: p.issued_at
          });
        } else {
          const existing = patientMap.get(p.patient_id)!;
          existing.active_prescriptions++;
        }
      }

      setPatients(Array.from(patientMap.values()));
    } catch (error) {
      console.error('환자 목록 로드 실패:', error);
    } finally {
      setLoadingPatients(false);
    }
  };

  // 환자 선택 시 치료 목록 로드
  const loadTreatments = async (patientId: number) => {
    try {
      setLoadingTreatments(true);
      setSelectedPatientId(patientId);
      setSelectedTreatmentId(null);
      setPrescriptions([]);

      // SQLite에서 처방 조회
      const data = await query<any>(
        `SELECT * FROM prescriptions WHERE patient_id = ${patientId} AND status = 'issued' ORDER BY issued_at DESC`
      );

      const treatmentList: Treatment[] = [];

      for (const prescription of data || []) {
        let chiefComplaint = '';
        if (prescription.source_type === 'initial_chart' && prescription.source_id) {
          const chartData = await queryOne<{ notes: string }>(
            `SELECT notes FROM initial_charts WHERE id = ${prescription.source_id}`
          );
          if (chartData?.notes) {
            const match = chartData.notes.match(/\[주소증\]([\s\S]*?)(?=\n\[|$)/);
            if (match) chiefComplaint = match[1].trim();
          }
        }

        const issuedDate = new Date(prescription.issued_at);
        const expectedEndDate = new Date(issuedDate);
        expectedEndDate.setDate(expectedEndDate.getDate() + (prescription.days || 15));
        const isCompleted = expectedEndDate < new Date();

        treatmentList.push({
          id: prescription.id,
          prescription_id: prescription.id,
          formula: prescription.formula,
          issued_at: prescription.issued_at,
          days: prescription.days || 15,
          total_packs: prescription.total_packs,
          status: isCompleted ? 'completed' : 'active',
          completed_at: isCompleted ? expectedEndDate.toISOString() : undefined,
          chief_complaint: chiefComplaint,
          delivery_completed: prescription.delivery_completed || false,
          delivery_completed_at: prescription.delivery_completed_at,
          medication_completed: prescription.medication_completed || false,
          medication_completed_at: prescription.medication_completed_at
        });
      }

      setTreatments(treatmentList);

      const activeTreatment = treatmentList.find(t => t.status === 'active');
      if (activeTreatment) {
        loadPrescriptionDetail(activeTreatment.id);
      }
    } catch (error) {
      console.error('치료 목록 로드 실패:', error);
    } finally {
      setLoadingTreatments(false);
    }
  };

  // 치료 선택 시 처방 상세 로드
  const loadPrescriptionDetail = async (treatmentId: number) => {
    try {
      setLoadingPrescriptions(true);
      setSelectedTreatmentId(treatmentId);

      // SQLite에서 처방 상세 조회
      const data = await queryOne<any>(
        `SELECT * FROM prescriptions WHERE id = ${treatmentId}`
      );

      if (data) {
        const issuedDate = new Date(data.issued_at);
        const expectedEndDate = new Date(issuedDate);
        expectedEndDate.setDate(expectedEndDate.getDate() + (data.days || 15));
        const daysRemaining = Math.ceil((expectedEndDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

        let chiefComplaint = '';
        if (data.source_type === 'initial_chart' && data.source_id) {
          const chartData = await queryOne<{ notes: string }>(
            `SELECT notes FROM initial_charts WHERE id = ${data.source_id}`
          );
          if (chartData?.notes) {
            const match = chartData.notes.match(/\[주소증\]([\s\S]*?)(?=\n\[|$)/);
            if (match) chiefComplaint = match[1].trim();
          }
        }

        setPrescriptions([{
          id: data.id,
          formula: data.formula,
          issued_at: data.issued_at,
          days: data.days || 15,
          total_packs: data.total_packs,
          doses_per_day: data.doses_per_day || 2,
          expected_end_date: expectedEndDate.toISOString(),
          days_remaining: daysRemaining,
          delivery_completed: data.delivery_completed || false,
          delivery_call_date: data.delivery_call_date,
          delivery_call_notes: data.delivery_call_notes,
          visit_call_date: data.visit_call_date,
          visit_call_notes: data.visit_call_notes,
          medication_completed: data.medication_completed || false,
          medication_completed_at: data.medication_completed_at,
          chief_complaint: chiefComplaint
        }]);
      }
    } catch (error) {
      console.error('처방 상세 로드 실패:', error);
    } finally {
      setLoadingPrescriptions(false);
    }
  };

  // 배송콜/내원콜 기록 (오늘의 콜 목록에서)
  const handleTodayCallRecord = async () => {
    if (!selectedCallTarget) return;

    try {
      const now = getCurrentTimestamp();

      if (callType === 'delivery') {
        await execute(`
          UPDATE prescriptions SET
            delivery_call_date = ${escapeString(now)},
            delivery_call_notes = ${toSqlValue(callNotes)}
          WHERE id = ${selectedCallTarget.prescription_id}
        `);
      } else {
        await execute(`
          UPDATE prescriptions SET
            visit_call_date = ${escapeString(now)},
            visit_call_notes = ${toSqlValue(callNotes)}
          WHERE id = ${selectedCallTarget.prescription_id}
        `);
      }

      alert(`${callType === 'delivery' ? '배송' : '내원'}콜이 기록되었습니다.`);
      setShowCallModal(false);
      setCallNotes('');
      setSelectedCallTarget(null);

      // 목록 새로고침
      loadTodayCalls();
    } catch (error) {
      console.error('콜 기록 실패:', error);
      alert('콜 기록에 실패했습니다.');
    }
  };

  // 배송콜/내원콜 기록 (환자별 차트에서)
  const handleCallRecord = async () => {
    if (!selectedPrescription) return;

    try {
      const now = getCurrentTimestamp();

      if (callType === 'delivery') {
        await execute(`
          UPDATE prescriptions SET
            delivery_call_date = ${escapeString(now)},
            delivery_call_notes = ${toSqlValue(callNotes)}
          WHERE id = ${selectedPrescription.id}
        `);
      } else {
        await execute(`
          UPDATE prescriptions SET
            visit_call_date = ${escapeString(now)},
            visit_call_notes = ${toSqlValue(callNotes)}
          WHERE id = ${selectedPrescription.id}
        `);
      }

      alert(`${callType === 'delivery' ? '배송' : '내원'}콜이 기록되었습니다.`);
      setShowCallModal(false);
      setCallNotes('');

      if (selectedTreatmentId) {
        loadPrescriptionDetail(selectedTreatmentId);
      }
    } catch (error) {
      console.error('콜 기록 실패:', error);
      alert('콜 기록에 실패했습니다.');
    }
  };

  // 내원콜 미루기 모달 열기
  const openPostponeModal = (prescriptionId: number, currentPostponeCount: number) => {
    setPostponeTargetId(prescriptionId);
    setPostponeCount(currentPostponeCount);
    setPostponeDays(3);
    setPostponeReason('');
    setShowPostponeModal(true);
  };

  // 내원콜 미루기
  const handlePostponeVisitCall = async () => {
    if (!postponeTargetId) return;

    try {
      const newScheduledDate = new Date();
      newScheduledDate.setDate(newScheduledDate.getDate() + postponeDays);

      await execute(`
        UPDATE prescriptions SET
          visit_call_scheduled_date = ${escapeString(newScheduledDate.toISOString())},
          visit_call_postponed_count = ${postponeCount + 1},
          visit_call_postpone_reason = ${toSqlValue(postponeReason)}
        WHERE id = ${postponeTargetId}
      `);

      alert(`내원콜이 ${postponeDays}일 미루어졌습니다.`);
      setShowPostponeModal(false);
      setPostponeTargetId(null);
      setPostponeReason('');
      loadTodayCalls();
    } catch (error) {
      console.error('내원콜 미루기 실패:', error);
      alert('내원콜 미루기에 실패했습니다.');
    }
  };

  // 예약 가능 시간 로드
  const loadAvailableSlots = async (date: string, doctor: string) => {
    try {
      const selectedDate = new Date(date);
      const dayOfWeek = selectedDate.getDay();

      // 해당 요일의 원장 근무시간 조회 - SQLite
      const schedules = await query<any>(
        `SELECT * FROM doctor_schedules WHERE doctor_name = ${escapeString(doctor)} AND day_of_week = ${dayOfWeek} AND is_active = 1`
      );

      if (!schedules || schedules.length === 0) {
        setAvailableSlots([]);
        return;
      }

      const schedule = schedules[0];
      const slots: AppointmentSlot[] = [];

      // 시간대 생성
      const startTime = new Date(`2000-01-01T${schedule.start_time}`);
      const endTime = new Date(`2000-01-01T${schedule.end_time}`);
      const breakStart = schedule.break_start_time ? new Date(`2000-01-01T${schedule.break_start_time}`) : null;
      const breakEnd = schedule.break_end_time ? new Date(`2000-01-01T${schedule.break_end_time}`) : null;
      const slotDuration = schedule.slot_duration || 30;

      let currentTime = new Date(startTime);

      while (currentTime < endTime) {
        const timeStr = currentTime.toTimeString().substring(0, 5);

        // 휴게시간 체크
        const isBreakTime = breakStart && breakEnd && currentTime >= breakStart && currentTime < breakEnd;

        if (!isBreakTime) {
          // 기존 예약 체크 - SQLite
          const appointmentDateTime = new Date(date + 'T' + timeStr);
          const endDateTime = new Date(appointmentDateTime.getTime() + slotDuration * 60000);
          const existingAppointments = await query<any>(
            `SELECT id FROM appointments WHERE doctor_name = ${escapeString(doctor)} AND appointment_date >= ${escapeString(appointmentDateTime.toISOString())} AND appointment_date < ${escapeString(endDateTime.toISOString())} AND status != 'cancelled'`
          );

          slots.push({
            time: timeStr,
            available: !existingAppointments || existingAppointments.length === 0
          });
        }

        currentTime.setMinutes(currentTime.getMinutes() + slotDuration);
      }

      setAvailableSlots(slots);
    } catch (error) {
      console.error('예약 가능 시간 조회 실패:', error);
      setAvailableSlots([]);
    }
  };

  // 예약 생성
  const handleCreateAppointment = async () => {
    if (!selectedCallTarget || !selectedDate || !selectedDoctor || !selectedSlot) {
      alert('모든 정보를 입력해주세요.');
      return;
    }

    try {
      const appointmentDateTime = new Date(`${selectedDate}T${selectedSlot}`);
      const now = getCurrentTimestamp();

      // SQLite에 예약 저장
      await insert(`
        INSERT INTO appointments (patient_id, prescription_id, doctor_name, appointment_date, appointment_type, status, created_at, updated_at)
        VALUES (
          ${selectedCallTarget.patient_id},
          ${selectedCallTarget.prescription_id},
          ${escapeString(selectedDoctor)},
          ${escapeString(appointmentDateTime.toISOString())},
          ${escapeString('재진')},
          ${escapeString('scheduled')},
          ${escapeString(now)},
          ${escapeString(now)}
        )
      `);

      alert('예약이 완료되었습니다.');
      setShowAppointmentModal(false);
      setSelectedDate('');
      setSelectedDoctor('');
      setSelectedSlot('');
    } catch (error) {
      console.error('예약 생성 실패:', error);
      alert('예약 생성에 실패했습니다.');
    }
  };

  // 복약완료 처리
  const handleMedicationComplete = async (prescriptionId: number) => {
    if (!confirm('복약완료로 처리하시겠습니까?')) return;

    try {
      const now = getCurrentTimestamp();

      await execute(`
        UPDATE prescriptions SET
          medication_completed = 1,
          medication_completed_at = ${escapeString(now)}
        WHERE id = ${prescriptionId}
      `);

      alert('복약완료 처리되었습니다.');

      if (selectedPatientId) {
        loadTreatments(selectedPatientId);
      }
    } catch (error) {
      console.error('복약완료 처리 실패:', error);
      alert('복약완료 처리에 실패했습니다.');
    }
  };

  // 필터링된 환자 목록
  const filteredPatients = useMemo(() => {
    if (!searchTerm) return patients;
    const term = searchTerm.toLowerCase();
    return patients.filter(p =>
      p.patient_name.toLowerCase().includes(term) ||
      p.chart_number?.toLowerCase().includes(term)
    );
  }, [patients, searchTerm]);

  // 날짜 포맷
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  };

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // 선택된 환자 정보
  const selectedPatient = patients.find(p => p.patient_id === selectedPatientId);

  // 진행중/완료된 치료 분리
  const activeTreatments = treatments.filter(t => t.status === 'active' && !t.medication_completed);
  const completedTreatments = treatments.filter(t => t.status === 'completed' || t.medication_completed);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="max-w-7xl mx-auto w-full p-6 flex-1 flex flex-col overflow-hidden">
        {/* 헤더 + 탭 */}
        <div className="flex items-center justify-between mb-4 flex-shrink-0">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-clinic-text-primary">
              <i className="fas fa-pills mr-3 text-clinic-primary"></i>
              복약관리
            </h1>
            <div className="flex gap-2">
              <button
                onClick={() => setActiveTab('today')}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === 'today'
                    ? 'bg-clinic-primary text-white'
                    : 'bg-white text-clinic-text-secondary hover:bg-gray-100'
                }`}
              >
                <i className="fas fa-calendar-day mr-1.5"></i>
                오늘의 콜 목록
              </button>
              <button
                onClick={() => setActiveTab('patients')}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === 'patients'
                    ? 'bg-clinic-primary text-white'
                    : 'bg-white text-clinic-text-secondary hover:bg-gray-100'
                }`}
              >
                <i className="fas fa-users mr-1.5"></i>
                환자별 복약차트
              </button>
            </div>
          </div>
          {activeTab === 'today' && (
            <div className="flex items-center gap-2">
              <label className="text-sm text-clinic-text-secondary">기준일:</label>
              <input
                type="date"
                value={selectedCallDate}
                onChange={(e) => setSelectedCallDate(e.target.value)}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-clinic-primary"
              />
              <button
                onClick={() => setSelectedCallDate(new Date().toISOString().split('T')[0])}
                className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                오늘
              </button>
            </div>
          )}
        </div>

        {/* 탭 컨텐츠 */}
        {activeTab === 'today' ? (
          // 오늘의 콜 목록
          <div className="flex-1 overflow-hidden flex flex-col">
            {loadingTodayCalls ? (
              <div className="flex items-center justify-center h-full">
                <div className="border-4 border-clinic-background border-t-clinic-primary rounded-full w-10 h-10 animate-spin"></div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 flex-1 overflow-hidden">
                {/* 배송콜 대상 */}
                <div className="bg-white rounded-lg shadow-sm overflow-hidden flex flex-col">
                  <div className="bg-blue-50 px-4 py-3 border-b flex-shrink-0">
                    <h2 className="font-semibold text-blue-700">
                      <i className="fas fa-truck mr-2"></i>
                      배송콜 대상 ({deliveryCallTargets.length})
                    </h2>
                    <p className="text-xs text-gray-500 mt-1">복약 시작 2일차</p>
                  </div>
                  <div className="overflow-auto flex-1 p-4">
                    {deliveryCallTargets.length === 0 ? (
                      <div className="text-center py-8 text-clinic-text-secondary">
                        <i className="fas fa-check-circle text-4xl mb-2 opacity-30"></i>
                        <p>오늘 처리할 배송콜이 없습니다</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {deliveryCallTargets.map(target => (
                          <div
                            key={target.prescription_id}
                            className={`border rounded-lg p-4 transition-opacity ${
                              target.is_completed
                                ? 'opacity-40 bg-gray-50'
                                : 'hover:bg-gray-50'
                            }`}
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <p className="font-bold text-base">{target.patient_name}</p>
                                <p className="text-xs text-gray-500">{target.chart_number || '-'}</p>
                                <p className="text-xs text-gray-500">{target.phone || '-'}</p>
                              </div>
                              <div className="flex flex-col items-end gap-1">
                                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                                  {target.delivery_method}
                                </span>
                                {target.is_completed && (
                                  <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                                    <i className="fas fa-check mr-1"></i>완료
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="text-sm mb-3">
                              <p className="font-medium truncate">{target.formula}</p>
                              <p className="text-xs text-gray-500">발급: {formatDate(target.issued_at)} | {target.days}일분</p>
                              {target.chief_complaint && (
                                <p className="text-xs text-gray-400 truncate mt-1">{target.chief_complaint}</p>
                              )}
                              {target.is_completed && target.call_completed_at && (
                                <p className="text-xs text-green-600 mt-1">
                                  처리완료: {formatDate(target.call_completed_at)}
                                </p>
                              )}
                            </div>
                            <button
                              onClick={() => {
                                if (!target.is_completed) {
                                  setSelectedCallTarget(target);
                                  setCallType('delivery');
                                  setCallNotes('');
                                  setShowCallModal(true);
                                }
                              }}
                              disabled={target.is_completed}
                              className={`w-full py-2 rounded transition-colors text-sm ${
                                target.is_completed
                                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                  : 'bg-blue-500 text-white hover:bg-blue-600'
                              }`}
                            >
                              <i className="fas fa-phone mr-2"></i>
                              {target.is_completed ? '배송콜 완료' : '배송콜 처리'}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* 내원콜 대상 */}
                <div className="bg-white rounded-lg shadow-sm overflow-hidden flex flex-col">
                  <div className="bg-purple-50 px-4 py-3 border-b flex-shrink-0">
                    <h2 className="font-semibold text-purple-700">
                      <i className="fas fa-hospital mr-2"></i>
                      내원콜 대상 ({visitCallTargets.length})
                    </h2>
                    <p className="text-xs text-gray-500 mt-1">약 3일분 남은 시점</p>
                  </div>
                  <div className="overflow-auto flex-1 p-4">
                    {visitCallTargets.length === 0 ? (
                      <div className="text-center py-8 text-clinic-text-secondary">
                        <i className="fas fa-check-circle text-4xl mb-2 opacity-30"></i>
                        <p>오늘 처리할 내원콜이 없습니다</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {visitCallTargets.map(target => (
                          <div
                            key={target.prescription_id}
                            className={`border rounded-lg p-4 transition-opacity ${
                              target.is_completed
                                ? 'opacity-40 bg-gray-50'
                                : 'hover:bg-gray-50'
                            }`}
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <p className="font-bold text-base">{target.patient_name}</p>
                                <p className="text-xs text-gray-500">{target.chart_number || '-'}</p>
                                <p className="text-xs text-gray-500">{target.phone || '-'}</p>
                              </div>
                              <div className="flex flex-col items-end gap-1">
                                {(target.visit_call_postponed_count || 0) > 0 && (
                                  <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded">
                                    미루기 {target.visit_call_postponed_count}회
                                  </span>
                                )}
                                {target.is_completed && (
                                  <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                                    <i className="fas fa-check mr-1"></i>완료
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="text-sm mb-3">
                              <p className="font-medium truncate">{target.formula}</p>
                              <p className="text-xs text-gray-500">발급: {formatDate(target.issued_at)} | {target.days}일분</p>
                              {target.chief_complaint && (
                                <p className="text-xs text-gray-400 truncate mt-1">{target.chief_complaint}</p>
                              )}
                              {target.visit_call_postpone_reason && (
                                <p className="text-xs text-orange-600 mt-1">
                                  <i className="fas fa-info-circle mr-1"></i>
                                  사유: {target.visit_call_postpone_reason}
                                </p>
                              )}
                              {target.is_completed && target.call_completed_at && (
                                <p className="text-xs text-green-600 mt-1">
                                  처리완료: {formatDate(target.call_completed_at)}
                                </p>
                              )}
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              <button
                                onClick={() => {
                                  if (!target.is_completed) {
                                    setSelectedCallTarget(target);
                                    setCallType('visit');
                                    setCallNotes('');
                                    setShowCallModal(true);
                                  }
                                }}
                                disabled={target.is_completed}
                                className={`py-2 rounded transition-colors text-sm ${
                                  target.is_completed
                                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                    : 'bg-purple-500 text-white hover:bg-purple-600'
                                }`}
                              >
                                <i className="fas fa-phone text-xs"></i>
                                <span className="ml-1 text-xs">콜</span>
                              </button>
                              <button
                                onClick={() => {
                                  if (!target.is_completed) {
                                    openPostponeModal(target.prescription_id, target.visit_call_postponed_count || 0);
                                  }
                                }}
                                disabled={target.is_completed}
                                className={`py-2 rounded transition-colors text-sm ${
                                  target.is_completed
                                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                    : 'bg-gray-500 text-white hover:bg-gray-600'
                                }`}
                              >
                                <i className="fas fa-clock text-xs"></i>
                                <span className="ml-1 text-xs">미루기</span>
                              </button>
                              <button
                                onClick={() => {
                                  if (!target.is_completed) {
                                    setSelectedCallTarget(target);
                                    setShowAppointmentModal(true);
                                    setSelectedDate('');
                                    setSelectedDoctor('');
                                    setSelectedSlot('');
                                  }
                                }}
                                disabled={target.is_completed}
                                className={`py-2 rounded transition-colors text-sm ${
                                  target.is_completed
                                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                    : 'bg-green-500 text-white hover:bg-green-600'
                                }`}
                              >
                                <i className="fas fa-calendar-plus text-xs"></i>
                                <span className="ml-1 text-xs">예약</span>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          // 환자별 복약차트 (기존 코드)
          <>
            {selectedPatient && (
              <div className="mb-4 text-clinic-text-primary flex-shrink-0 bg-white rounded-lg shadow-sm p-4">
                <div className="text-base leading-relaxed">
                  <span className="font-semibold">차트번호:</span> {selectedPatient.chart_number || '-'}
                  <span className="mx-3">|</span>
                  <span className="font-semibold">이름:</span> {selectedPatient.patient_name}
                  <span className="mx-3">|</span>
                  <span className="font-semibold">연락처:</span> {selectedPatient.phone || '-'}
                  <span className="mx-3">|</span>
                  <span className="font-semibold">처방건수:</span> {selectedPatient.active_prescriptions}건
                </div>
              </div>
            )}

            <div className="flex gap-4 flex-1 overflow-hidden">
              {/* 왼쪽: 환자 목록 */}
              <div className="w-1/4 bg-white rounded-lg shadow-sm overflow-hidden flex flex-col">
                <div className="bg-gray-50 px-4 py-3 border-b flex-shrink-0">
                  <h2 className="font-semibold text-clinic-text-primary mb-2">복약차트</h2>
                  <input
                    type="text"
                    placeholder="환자명/차트번호 검색"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:border-clinic-primary"
                  />
                </div>
                <div className="overflow-auto flex-1">
                  {loadingPatients ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="border-4 border-clinic-background border-t-clinic-primary rounded-full w-8 h-8 animate-spin"></div>
                    </div>
                  ) : filteredPatients.length === 0 ? (
                    <div className="text-center py-8 text-clinic-text-secondary text-sm">
                      복약관리 대상이 없습니다
                    </div>
                  ) : (
                    filteredPatients.map(patient => (
                      <div
                        key={patient.patient_id}
                        onClick={() => loadTreatments(patient.patient_id)}
                        className={`px-4 py-3 border-b cursor-pointer transition-colors ${
                          selectedPatientId === patient.patient_id
                            ? 'bg-clinic-primary bg-opacity-10 border-l-4 border-l-clinic-primary'
                            : 'hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-sm">{patient.patient_name}</p>
                            <p className="text-xs text-clinic-text-secondary">
                              {patient.chart_number || '번호없음'}
                            </p>
                          </div>
                          <span className="text-xs bg-clinic-primary text-white px-2 py-0.5 rounded-full">
                            {patient.active_prescriptions}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* 중앙: 치료 목록 */}
              <div className="w-1/4 bg-white rounded-lg shadow-sm overflow-hidden flex flex-col">
                <div className="bg-gray-50 px-4 py-3 border-b flex-shrink-0">
                  <h2 className="font-semibold text-clinic-text-primary">진료관리</h2>
                </div>
                <div className="overflow-auto flex-1">
                  {!selectedPatientId ? (
                    <div className="flex flex-col items-center justify-center h-full text-clinic-text-secondary text-sm">
                      <i className="fas fa-user text-3xl mb-2 opacity-30"></i>
                      <p>환자를 선택하세요</p>
                    </div>
                  ) : loadingTreatments ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="border-4 border-clinic-background border-t-clinic-primary rounded-full w-8 h-8 animate-spin"></div>
                    </div>
                  ) : (
                    <>
                      {activeTreatments.length > 0 && (
                        <div>
                          <div className="bg-green-50 px-4 py-2 text-xs font-semibold text-green-700 sticky top-0">
                            <i className="fas fa-clock mr-1"></i>
                            진행중 ({activeTreatments.length})
                          </div>
                          {activeTreatments.map(treatment => (
                            <div
                              key={treatment.id}
                              onClick={() => loadPrescriptionDetail(treatment.id)}
                              className={`px-4 py-3 border-b cursor-pointer transition-colors ${
                                selectedTreatmentId === treatment.id
                                  ? 'bg-green-50 border-l-4 border-l-green-500'
                                  : 'hover:bg-gray-50'
                              }`}
                            >
                              <p className="font-medium text-sm truncate">{treatment.formula}</p>
                              <p className="text-xs text-clinic-text-secondary mt-1">
                                {formatDate(treatment.issued_at)} | {treatment.days}일
                              </p>
                              {treatment.chief_complaint && (
                                <p className="text-xs text-gray-400 truncate mt-1">
                                  {treatment.chief_complaint}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {completedTreatments.length > 0 && (
                        <div>
                          <div className="bg-gray-100 px-4 py-2 text-xs font-semibold text-gray-600 sticky top-0">
                            <i className="fas fa-check mr-1"></i>
                            완료 ({completedTreatments.length})
                          </div>
                          {completedTreatments.map(treatment => (
                            <div
                              key={treatment.id}
                              onClick={() => loadPrescriptionDetail(treatment.id)}
                              className={`px-4 py-3 border-b cursor-pointer transition-colors opacity-60 ${
                                selectedTreatmentId === treatment.id
                                  ? 'bg-gray-100 border-l-4 border-l-gray-400'
                                  : 'hover:bg-gray-50'
                              }`}
                            >
                              <p className="font-medium text-sm truncate">{treatment.formula}</p>
                              <p className="text-xs text-clinic-text-secondary mt-1">
                                {formatDate(treatment.issued_at)} | {treatment.days}일
                              </p>
                            </div>
                          ))}
                        </div>
                      )}

                      {treatments.length === 0 && (
                        <div className="text-center py-8 text-clinic-text-secondary text-sm">
                          처방 기록이 없습니다
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* 오른쪽: 처방 상세 및 관리 */}
              <div className="flex-1 bg-white rounded-lg shadow-sm overflow-hidden flex flex-col">
                <div className="bg-gray-50 px-4 py-3 border-b flex-shrink-0">
                  <h2 className="font-semibold text-clinic-text-primary">복약 상세</h2>
                </div>
                <div className="overflow-auto flex-1 p-4">
                  {!selectedTreatmentId ? (
                    <div className="flex flex-col items-center justify-center h-full text-clinic-text-secondary">
                      <i className="fas fa-pills text-4xl mb-4 opacity-30"></i>
                      <p>치료를 선택하세요</p>
                    </div>
                  ) : loadingPrescriptions ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="border-4 border-clinic-background border-t-clinic-primary rounded-full w-10 h-10 animate-spin"></div>
                    </div>
                  ) : prescriptions.length === 0 ? (
                    <div className="text-center py-8 text-clinic-text-secondary">
                      처방 정보가 없습니다
                    </div>
                  ) : (
                    prescriptions.map(prescription => (
                      <div key={prescription.id} className="space-y-4">
                        {/* 처방 정보 */}
                        <div className="bg-gray-50 rounded-lg p-4">
                          <h3 className="font-bold text-lg mb-3">{prescription.formula}</h3>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <p><span className="text-clinic-text-secondary">발급일:</span> {formatDate(prescription.issued_at)}</p>
                            <p><span className="text-clinic-text-secondary">복용기간:</span> {prescription.days}일</p>
                            <p><span className="text-clinic-text-secondary">총팩수:</span> {prescription.total_packs}팩</p>
                            <p><span className="text-clinic-text-secondary">하루:</span> {prescription.doses_per_day}팩</p>
                            <p><span className="text-clinic-text-secondary">예상완료:</span> {formatDate(prescription.expected_end_date)}</p>
                            <p>
                              <span className="text-clinic-text-secondary">남은일수:</span>
                              <span className={`ml-1 font-bold ${
                                prescription.days_remaining > 5 ? 'text-green-600' :
                                prescription.days_remaining > 0 ? 'text-orange-600' : 'text-red-600'
                              }`}>
                                {prescription.days_remaining > 0 ? `D-${prescription.days_remaining}` : '복용완료'}
                              </span>
                            </p>
                          </div>
                        </div>

                        {/* 주소증 */}
                        {prescription.chief_complaint && (
                          <div className="bg-blue-50 rounded-lg p-4">
                            <h4 className="font-semibold text-blue-700 mb-2">
                              <i className="fas fa-notes-medical mr-2"></i>주소증
                            </h4>
                            <p className="text-sm whitespace-pre-wrap">{prescription.chief_complaint}</p>
                          </div>
                        )}

                        {/* 콜 기록 상태 */}
                        <div className="bg-white border rounded-lg p-4">
                          <h4 className="font-semibold mb-3">
                            <i className="fas fa-phone-alt mr-2 text-clinic-primary"></i>콜 기록
                          </h4>
                          <div className="space-y-3 text-sm">
                            <div className="py-2 border-b">
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-medium">배송콜</span>
                                {prescription.delivery_call_date ? (
                                  <span className="text-green-600">
                                    <i className="fas fa-check mr-1"></i>
                                    {formatDate(prescription.delivery_call_date)}
                                  </span>
                                ) : (
                                  <span className="text-gray-400">미완료</span>
                                )}
                              </div>
                              {prescription.delivery_call_notes && (
                                <div className="mt-2 bg-gray-50 rounded p-2 text-xs">
                                  <p className="text-gray-600 whitespace-pre-wrap">{prescription.delivery_call_notes}</p>
                                </div>
                              )}
                            </div>

                            <div className="py-2">
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-medium">내원콜</span>
                                {prescription.visit_call_date ? (
                                  <span className="text-green-600">
                                    <i className="fas fa-check mr-1"></i>
                                    {formatDate(prescription.visit_call_date)}
                                  </span>
                                ) : (
                                  <span className="text-gray-400">미완료</span>
                                )}
                              </div>
                              {prescription.visit_call_notes && (
                                <div className="mt-2 bg-gray-50 rounded p-2 text-xs">
                                  <p className="text-gray-600 whitespace-pre-wrap">{prescription.visit_call_notes}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* 복약 상태 */}
                        <div className={`rounded-lg p-4 ${
                          prescription.medication_completed ? 'bg-green-50' : 'bg-orange-50'
                        }`}>
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className={`font-semibold ${
                                prescription.medication_completed ? 'text-green-700' : 'text-orange-700'
                              }`}>
                                <i className={`fas ${prescription.medication_completed ? 'fa-check-circle' : 'fa-clock'} mr-2`}></i>
                                복약 상태
                              </h4>
                              <p className="text-sm mt-1">
                                {prescription.medication_completed
                                  ? `완료 (${formatDate(prescription.medication_completed_at!)})`
                                  : '복약 진행중'}
                              </p>
                            </div>
                            {prescription.medication_completed && (
                              <span className="bg-green-600 text-white px-3 py-1 rounded-full text-sm">
                                완료
                              </span>
                            )}
                          </div>
                        </div>

                        {/* 액션 버튼 (복약 미완료 시) */}
                        {!prescription.medication_completed && (
                          <div className="flex gap-3 pt-4">
                            <button
                              onClick={() => {
                                setSelectedPrescription(prescription);
                                setCallType('delivery');
                                setCallNotes('');
                                setShowCallModal(true);
                              }}
                              className="flex-1 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium"
                            >
                              <i className="fas fa-truck mr-2"></i>
                              배송콜
                            </button>
                            <button
                              onClick={() => {
                                setSelectedPrescription(prescription);
                                setCallType('visit');
                                setCallNotes('');
                                setShowCallModal(true);
                              }}
                              className="flex-1 py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors font-medium"
                            >
                              <i className="fas fa-hospital mr-2"></i>
                              내원콜
                            </button>
                            <button
                              onClick={() => handleMedicationComplete(prescription.id)}
                              className="flex-1 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors font-medium"
                            >
                              <i className="fas fa-check mr-2"></i>
                              복약완료
                            </button>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* 콜 기록 모달 */}
      {showCallModal && (selectedCallTarget || selectedPrescription) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-bold text-clinic-text-primary">
                <i className={`fas ${callType === 'delivery' ? 'fa-truck' : 'fa-hospital'} mr-2`}></i>
                {callType === 'delivery' ? '배송콜' : '내원콜'} 기록
              </h2>
              <button onClick={() => setShowCallModal(false)} className="text-gray-400 hover:text-gray-600">
                <i className="fas fa-times"></i>
              </button>
            </div>

            <div className="px-6 py-4">
              <div className="mb-4">
                <p className="font-medium">
                  {selectedCallTarget?.patient_name || selectedPatient?.patient_name}
                </p>
                <p className="text-sm text-clinic-text-secondary">
                  {selectedCallTarget?.formula || selectedPrescription?.formula}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">통화 내용</label>
                <textarea
                  value={callNotes}
                  onChange={(e) => setCallNotes(e.target.value)}
                  placeholder={callType === 'delivery'
                    ? '배송 관련 통화 내용을 기록하세요...'
                    : '내원 안내 통화 내용을 기록하세요...'}
                  rows={4}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-clinic-primary resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 px-6 py-4 border-t bg-gray-50">
              <button
                onClick={() => setShowCallModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-clinic-text-secondary hover:bg-gray-100"
              >
                취소
              </button>
              <button
                onClick={selectedCallTarget ? handleTodayCallRecord : handleCallRecord}
                className={`flex-1 px-4 py-2 text-white rounded-lg ${
                  callType === 'delivery' ? 'bg-blue-500 hover:bg-blue-600' : 'bg-purple-500 hover:bg-purple-600'
                }`}
              >
                <i className="fas fa-save mr-2"></i>
                저장
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 미루기 모달 */}
      {showPostponeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-bold text-clinic-text-primary">
                <i className="fas fa-clock mr-2"></i>
                내원콜 미루기
              </h2>
              <button onClick={() => setShowPostponeModal(false)} className="text-gray-400 hover:text-gray-600">
                <i className="fas fa-times"></i>
              </button>
            </div>

            <div className="px-6 py-4">
              <div className="mb-4">
                <p className="text-sm text-clinic-text-secondary mb-2">
                  내원콜을 며칠 미루시겠습니까?
                </p>
                <p className="text-xs text-gray-400">
                  현재 미루기 횟수: {postponeCount}회
                </p>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  {[1, 2, 3, 5, 7, 14].map(days => (
                    <button
                      key={days}
                      onClick={() => setPostponeDays(days)}
                      className={`py-3 rounded-lg font-medium transition-colors ${
                        postponeDays === days
                          ? 'bg-clinic-primary text-white'
                          : 'bg-gray-100 hover:bg-gray-200 text-clinic-text-primary'
                      }`}
                    >
                      {days}일
                    </button>
                  ))}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">직접 입력 (일)</label>
                  <input
                    type="number"
                    min="1"
                    max="90"
                    value={postponeDays}
                    onChange={(e) => setPostponeDays(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-clinic-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">미루기 사유 (선택)</label>
                  <input
                    type="text"
                    value={postponeReason}
                    onChange={(e) => setPostponeReason(e.target.value)}
                    placeholder="예: 감기, 개인사정, 해외출장 등"
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-clinic-primary"
                  />
                  <div className="mt-2 flex flex-wrap gap-2">
                    {['감기', '개인사정', '출장', '휴가', '약 남음'].map(reason => (
                      <button
                        key={reason}
                        onClick={() => setPostponeReason(reason)}
                        className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
                      >
                        {reason}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-4 bg-blue-50 rounded p-3">
                <p className="text-sm text-blue-700">
                  <i className="fas fa-info-circle mr-2"></i>
                  선택한 날짜: {new Date(Date.now() + postponeDays * 24 * 60 * 60 * 1000).toLocaleDateString('ko-KR')}
                </p>
              </div>
            </div>

            <div className="flex gap-3 px-6 py-4 border-t bg-gray-50">
              <button
                onClick={() => setShowPostponeModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-clinic-text-secondary hover:bg-gray-100"
              >
                취소
              </button>
              <button
                onClick={handlePostponeVisitCall}
                className="flex-1 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                <i className="fas fa-clock mr-2"></i>
                {postponeDays}일 미루기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 예약 모달 */}
      {showAppointmentModal && selectedCallTarget && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-bold text-clinic-text-primary">
                <i className="fas fa-calendar-plus mr-2"></i>
                내원 예약
              </h2>
              <button onClick={() => setShowAppointmentModal(false)} className="text-gray-400 hover:text-gray-600">
                <i className="fas fa-times"></i>
              </button>
            </div>

            <div className="px-6 py-4">
              <div className="mb-4">
                <p className="font-medium">{selectedCallTarget.patient_name}</p>
                <p className="text-sm text-clinic-text-secondary">{selectedCallTarget.formula}</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">담당 원장</label>
                  <select
                    value={selectedDoctor}
                    onChange={(e) => {
                      setSelectedDoctor(e.target.value);
                      if (selectedDate && e.target.value) {
                        loadAvailableSlots(selectedDate, e.target.value);
                      }
                    }}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-clinic-primary"
                  >
                    <option value="">원장 선택</option>
                    <option value="연이재">연이재 원장</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">예약 날짜</label>
                  <input
                    type="date"
                    value={selectedDate}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={(e) => {
                      setSelectedDate(e.target.value);
                      setSelectedSlot('');
                      if (selectedDoctor && e.target.value) {
                        loadAvailableSlots(e.target.value, selectedDoctor);
                      }
                    }}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-clinic-primary"
                  />
                </div>

                {selectedDate && selectedDoctor && (
                  <div>
                    <label className="block text-sm font-medium mb-2">예약 시간</label>
                    <div className="grid grid-cols-4 gap-2 max-h-64 overflow-auto p-2 border rounded-lg">
                      {availableSlots.length === 0 ? (
                        <div className="col-span-4 text-center py-4 text-gray-500">
                          해당 날짜에 진료가 없습니다
                        </div>
                      ) : (
                        availableSlots.map(slot => (
                          <button
                            key={slot.time}
                            onClick={() => slot.available && setSelectedSlot(slot.time)}
                            disabled={!slot.available}
                            className={`py-2 px-3 rounded text-sm ${
                              selectedSlot === slot.time
                                ? 'bg-clinic-primary text-white'
                                : slot.available
                                  ? 'bg-gray-100 hover:bg-gray-200'
                                  : 'bg-gray-50 text-gray-300 cursor-not-allowed'
                            }`}
                          >
                            {slot.time}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3 px-6 py-4 border-t bg-gray-50">
              <button
                onClick={() => setShowAppointmentModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-clinic-text-secondary hover:bg-gray-100"
              >
                취소
              </button>
              <button
                onClick={handleCreateAppointment}
                disabled={!selectedDate || !selectedDoctor || !selectedSlot}
                className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                <i className="fas fa-check mr-2"></i>
                예약 확정
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MedicationManagement;
