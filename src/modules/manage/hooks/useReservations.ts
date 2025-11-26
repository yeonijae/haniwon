import { useState, useEffect, useRef } from 'react';
import { ReservationsState, Reservation, Patient, Acting, ActingType, TreatmentDetailItem } from '../types';
import { NewReservationData } from '../components/NewReservationForm';
import { findAvailableSlot } from '../utils/reservationUtils';
import * as api from '../lib/api';
import { supabase } from '@shared/lib/supabase';
import { DOCTORS } from '../constants';

export const useReservations = (currentUser: any, allPatients: Patient[]) => {
  const [reservations, setReservations] = useState<ReservationsState>({});
  // allPatients를 ref로 저장하여 useEffect 의존성에서 제외
  const allPatientsRef = useRef<Patient[]>(allPatients);
  allPatientsRef.current = allPatients;

  // 초기 예약 데이터 로드 (currentUser가 변경될 때만 실행)
  useEffect(() => {
    if (!currentUser) return;

    const loadReservationData = async () => {
      try {
        const today = new Date();
        const futureDate = new Date();
        futureDate.setDate(today.getDate() + 30);

        const allReservations = await api.fetchReservations({
          startDate: today.toISOString().split('T')[0],
          endDate: futureDate.toISOString().split('T')[0],
        });

        const reservationsNested: { [date: string]: { [doctor: string]: { [time: string]: Reservation[] } } } = {};

        for (const res of allReservations) {
          const treatments = await api.fetchReservationTreatments(res.id);

          const year = res.reservation_date.substring(0, 4);
          const month = res.reservation_date.substring(5, 7);
          const day = res.reservation_date.substring(8, 10);
          const dateKey = `${year}-${month}-${day}`;
          const timeKey = res.reservation_time;

          // ref를 통해 최신 allPatients 참조 (의존성 배열에서 제외)
          const patient = allPatientsRef.current.find(p => p.id === res.patient_id);

          const totalActing = treatments.reduce((sum, t) => sum + t.acting, 0);
          const slots = findAvailableSlot(dateKey, timeKey, totalActing, reservationsNested, res.doctor);

          slots.forEach((slot, index) => {
            const reservation: Reservation = {
              id: res.id,
              partId: `${res.id}-${slot.date}-${slot.time}`,
              patientId: res.patient_id,
              patientName: patient?.name || res.patientName || '알 수 없음',
              patientChartNumber: patient?.chartNumber || res.patientChartNumber || '',
              doctor: res.doctor,
              date: slot.date,
              time: slot.time,
              treatments,
              slotActing: slot.acting,
              isContinuation: index > 0,
              memo: res.memo || '',
              status: res.status || 'confirmed',
            };

            if (!reservationsNested[slot.date]) reservationsNested[slot.date] = {};
            if (!reservationsNested[slot.date][res.doctor]) reservationsNested[slot.date][res.doctor] = {};
            if (!reservationsNested[slot.date][res.doctor][slot.time]) reservationsNested[slot.date][res.doctor][slot.time] = [];

            reservationsNested[slot.date][res.doctor][slot.time].push(reservation);
          });
        }

        setReservations(reservationsNested);
      } catch (error) {
        console.error('❌ 예약 데이터 로드 오류:', error);
        alert('예약 데이터를 불러오는 중 오류가 발생했습니다.');
      }
    };

    loadReservationData();
  }, [currentUser]); // allPatients 의존성 제거

  // 실시간 구독 (currentUser가 변경될 때만 재구독)
  useEffect(() => {
    if (!currentUser) return;

    const reservationsSubscription = supabase
      .channel('reservations-changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'reservations' },
        async (payload) => {
          try {
            const today = new Date();
            const futureDate = new Date();
            futureDate.setDate(today.getDate() + 30);

            const allReservations = await api.fetchReservations({
              startDate: today.toISOString().split('T')[0],
              endDate: futureDate.toISOString().split('T')[0],
            });

            const reservationsNested: { [date: string]: { [doctor: string]: { [time: string]: Reservation[] } } } = {};

            for (const res of allReservations) {
              const treatments = await api.fetchReservationTreatments(res.id);
              const year = res.reservation_date.substring(0, 4);
              const month = res.reservation_date.substring(5, 7);
              const day = res.reservation_date.substring(8, 10);
              const dateKey = `${year}-${month}-${day}`;
              const timeKey = res.reservation_time;

              // ref를 통해 최신 allPatients 참조 (의존성 배열에서 제외)
              const patient = allPatientsRef.current.find(p => p.id === res.patient_id);
              const totalActing = treatments.reduce((sum, t) => sum + t.acting, 0);
              const slots = findAvailableSlot(dateKey, timeKey, totalActing, reservationsNested, res.doctor);

              slots.forEach((slot, index) => {
                const reservation: Reservation = {
                  id: res.id,
                  partId: `${res.id}-${slot.date}-${slot.time}`,
                  patientId: res.patient_id,
                  patientName: patient?.name || res.patientName || '알 수 없음',
                  patientChartNumber: patient?.chartNumber || res.patientChartNumber || '',
                  doctor: res.doctor,
                  date: slot.date,
                  time: slot.time,
                  treatments,
                  slotActing: slot.acting,
                  isContinuation: index > 0,
                  memo: res.memo || '',
                  status: res.status || 'confirmed',
                };

                if (!reservationsNested[slot.date]) reservationsNested[slot.date] = {};
                if (!reservationsNested[slot.date][res.doctor]) reservationsNested[slot.date][res.doctor] = {};
                if (!reservationsNested[slot.date][res.doctor][slot.time]) reservationsNested[slot.date][res.doctor][slot.time] = [];

                reservationsNested[slot.date][res.doctor][slot.time].push(reservation);
              });
            }

            setReservations(reservationsNested);
          } catch (error) {
            console.error('❌ 실시간 예약 데이터 로드 오류:', error);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(reservationsSubscription);
    };
  }, [currentUser]); // allPatients 의존성 제거

  const addNewReservation = async (data: NewReservationData, onAddActings: (doctor: string, actings: Acting[]) => void) => {
    const { patient, doctor, date, time, treatments, memo } = data;

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateKey = `${year}-${month}-${day}`;

    const totalActing = treatments.reduce((sum, t) => sum + t.acting, 0);
    const slots = findAvailableSlot(dateKey, time, totalActing, reservations, doctor);

    let reservationId: string;

    try {
      reservationId = await api.createReservation({
        patientId: patient.id,
        doctor,
        reservationDate: dateKey,
        reservationTime: time,
        status: 'confirmed',
        memo: memo || '',
      });

      await api.addReservationTreatments(reservationId, treatments);
    } catch (error) {
      console.error('❌ 예약 저장 오류:', error);
      alert('예약 저장 중 오류가 발생했습니다.');
      return { reservationId: null, slots: [] };
    }

    // 로컬 상태 업데이트
    setReservations(prev => {
      const newReservations = JSON.parse(JSON.stringify(prev));

      slots.forEach((slot, index) => {
        const newReservationPart: Reservation = {
          id: reservationId,
          partId: `${reservationId}-${slot.date}-${slot.time}`,
          patientId: patient.id,
          patientName: patient.name,
          patientChartNumber: patient.chartNumber || '',
          doctor,
          date: slot.date,
          time: slot.time,
          treatments,
          slotActing: slot.acting,
          isContinuation: index > 0,
          memo,
          status: 'confirmed',
        };

        if (!newReservations[slot.date]) newReservations[slot.date] = {};
        if (!newReservations[slot.date][doctor]) newReservations[slot.date][doctor] = {};
        if (!newReservations[slot.date][doctor][slot.time]) newReservations[slot.date][doctor][slot.time] = [];

        newReservations[slot.date][doctor][slot.time].push(newReservationPart);
      });

      return newReservations;
    });

    if (slots.length > 1 || slots[0].date !== dateKey || slots[0].time !== time) {
      alert(`예약이 여러 시간대에 걸쳐 ${slots[0].date} ${slots[0].time}부터 배정되었습니다. 자세한 내용은 달력에서 확인해주세요.`);
    }

    alert(`${patient.name}님 예약이 완료되었습니다.`);
    return { reservationId, slots };
  };

  const updateReservation = async (reservationId: string, data: NewReservationData) => {
    const { patient, doctor, date, time, treatments, memo } = data;
    const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const totalActing = treatments.reduce((sum, t) => sum + t.acting, 0);

    try {
      await api.updateReservation(reservationId, {
        patient_id: patient.id,
        doctor,
        reservation_date: dateKey,
        reservation_time: time,
        status: 'confirmed',
        memo: memo || '',
      });

      await api.deleteReservationTreatments(reservationId);
      await api.addReservationTreatments(reservationId, treatments);
    } catch (error) {
      console.error('❌ 예약 수정 오류:', error);
      alert('예약 수정 중 오류가 발생했습니다.');
      return { slots: [] };
    }

    // 로컬 상태 업데이트
    const reservationsWithoutOld = JSON.parse(JSON.stringify(reservations));
    for (const date in reservationsWithoutOld) {
      for (const doctor in reservationsWithoutOld[date]) {
        for (const time in reservationsWithoutOld[date][doctor]) {
          reservationsWithoutOld[date][doctor][time] = reservationsWithoutOld[date][doctor][time].filter(
            (res: Reservation) => res.id !== reservationId
          );
          if (reservationsWithoutOld[date][doctor][time].length === 0) {
            delete reservationsWithoutOld[date][doctor][time];
          }
        }
        if (Object.keys(reservationsWithoutOld[date][doctor]).length === 0) {
          delete reservationsWithoutOld[date][doctor];
        }
      }
      if (Object.keys(reservationsWithoutOld[date]).length === 0) {
        delete reservationsWithoutOld[date];
      }
    }

    const slots = findAvailableSlot(dateKey, time, totalActing, reservationsWithoutOld, doctor);

    slots.forEach((slot, index) => {
      const newReservationPart: Reservation = {
        id: reservationId,
        partId: `${reservationId}-${slot.date}-${slot.time}`,
        patientId: patient.id,
        patientName: patient.name,
        patientChartNumber: patient.chartNumber || '',
        doctor,
        date: slot.date,
        time: slot.time,
        treatments,
        slotActing: slot.acting,
        isContinuation: index > 0,
        memo,
        status: 'confirmed',
      };
      if (!reservationsWithoutOld[slot.date]) reservationsWithoutOld[slot.date] = {};
      if (!reservationsWithoutOld[slot.date][doctor]) reservationsWithoutOld[slot.date][doctor] = {};
      if (!reservationsWithoutOld[slot.date][doctor][slot.time]) reservationsWithoutOld[slot.date][doctor][slot.time] = [];
      reservationsWithoutOld[slot.date][doctor][slot.time].push(newReservationPart);
    });

    setReservations(reservationsWithoutOld);
    alert('예약이 수정되었습니다.');
    return { slots };
  };

  const cancelReservation = async (reservationId: string) => {
    try {
      await api.updateReservation(reservationId, { status: 'canceled' });
    } catch (error) {
      console.error('❌ 예약 취소 오류:', error);
      alert('예약 취소 중 오류가 발생했습니다.');
      return;
    }

    setReservations(prev => {
      const newReservations = JSON.parse(JSON.stringify(prev));
      let patientName = '';
      for (const date in newReservations) {
        for (const doctor in newReservations[date]) {
          for (const time in newReservations[date][doctor]) {
            newReservations[date][doctor][time].forEach((res: Reservation) => {
              if (res.id === reservationId) {
                res.status = 'canceled';
                if (!patientName) patientName = res.patientName;
              }
            });
          }
        }
      }

      alert(`${patientName}님의 예약이 취소되었습니다.`);
      return newReservations;
    });
  };

  const deleteReservation = async (reservationId: string) => {
    try {
      await api.deleteReservation(reservationId);
    } catch (error) {
      console.error('❌ 예약 삭제 오류:', error);
      alert('예약 삭제 중 오류가 발생했습니다.');
      return;
    }

    setReservations(prev => {
      const newReservations = JSON.parse(JSON.stringify(prev));
      for (const date in newReservations) {
        for (const doctor in newReservations[date]) {
          for (const time in newReservations[date][doctor]) {
            newReservations[date][doctor][time] = newReservations[date][doctor][time].filter(
              (res: Reservation) => res.id !== reservationId
            );
            if (newReservations[date][doctor][time].length === 0) {
              delete newReservations[date][doctor][time];
            }
          }
          if (Object.keys(newReservations[date][doctor]).length === 0) {
            delete newReservations[date][doctor];
          }
        }
        if (Object.keys(newReservations[date]).length === 0) {
          delete newReservations[date];
        }
      }

      return newReservations;
    });
  };

  const handlePatientArrival = (
    reservation: Reservation,
    destination: 'consultation' | 'treatment',
    onAddToConsultation: (patient: Patient) => boolean,
    onAddToTreatment: (patient: Patient) => boolean,
    onAddActings: (doctor: string, actings: Acting[]) => void,
    patient: Patient | undefined
  ) => {
    if (!patient) {
      alert('환자 정보를 찾을 수 없습니다.');
      return;
    }

    const currentTime = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
    const patientToWait = {
      ...patient,
      time: currentTime,
      details: '예약환자 내원',
    };

    let success = false;
    if (destination === 'consultation') {
      success = onAddToConsultation(patientToWait);
    } else {
      success = onAddToTreatment(patientToWait);
    }

    if (!success) return;

    // Add actings to queue
    const doctor = reservation.doctor;
    if (DOCTORS.includes(doctor)) {
      const treatmentToActingMap: { [key: string]: { type: ActingType, duration: number } } = {
        '침': { type: '침', duration: 15 },
        '추나': { type: '추나', duration: 20 },
        '약초진': { type: '약상담', duration: 30 },
        '약재진': { type: '약상담', duration: 20 },
      };

      const newActings: Acting[] = reservation.treatments
        .map((treatment, index) => {
          const actingInfo = treatmentToActingMap[treatment.name];
          if (actingInfo) {
            return {
              id: `act-${reservation.patientId}-${Date.now()}-${index}`,
              patientId: reservation.patientId,
              patientName: reservation.patientName,
              type: actingInfo.type,
              duration: actingInfo.duration,
              source: 'reservation' as const,
            };
          }
          return null;
        })
        .filter((a): a is Acting => a !== null);

      onAddActings(doctor, newActings);
    }

    setReservations(prev => {
      const newReservations = JSON.parse(JSON.stringify(prev));
      for (const date in newReservations) {
        for (const doctor in newReservations[date]) {
          for (const time in newReservations[date][doctor]) {
            newReservations[date][doctor][time].forEach((res: Reservation) => {
              if (res.id === reservation.id) {
                res.status = 'arrived';
              }
            });
          }
        }
      }
      return newReservations;
    });

    alert(`${patient.name}님을 ${destination === 'consultation' ? '진료' : '치료'} 대기 목록에 추가했습니다.`);
  };

  const updateReservationPatientInfo = (patientId: number, name: string, chartNumber: string) => {
    setReservations(prev => {
      const newReservations = JSON.parse(JSON.stringify(prev));
      for (const date in newReservations) {
        for (const doctor in newReservations[date]) {
          for (const time in newReservations[date][doctor]) {
            newReservations[date][doctor][time].forEach((res: Reservation) => {
              if (res.patientId === patientId) {
                res.patientName = name;
                res.patientChartNumber = chartNumber;
              }
            });
          }
        }
      }
      return newReservations;
    });
  };

  const deleteReservationsByPatient = (patientId: number) => {
    setReservations(prev => {
      const newReservations = JSON.parse(JSON.stringify(prev));
      for (const date in newReservations) {
        for (const doctor in newReservations[date]) {
          for (const time in newReservations[date][doctor]) {
            newReservations[date][doctor][time] = newReservations[date][doctor][time].filter(
              (res: Reservation) => res.patientId !== patientId
            );
            if (newReservations[date][doctor][time].length === 0) {
              delete newReservations[date][doctor][time];
            }
          }
          if (Object.keys(newReservations[date][doctor]).length === 0) {
            delete newReservations[date][doctor];
          }
        }
        if (Object.keys(newReservations[date]).length === 0) {
          delete newReservations[date];
        }
      }
      return newReservations;
    });
  };

  return {
    reservations,
    setReservations,
    addNewReservation,
    updateReservation,
    cancelReservation,
    deleteReservation,
    handlePatientArrival,
    updateReservationPatientInfo,
    deleteReservationsByPatient,
  };
};
