import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Patient, PatientStatus, DefaultTreatment, Acting } from '../types';
import { NewPatientData } from '../components/NewPatientForm';
import { BulkPatientData } from '../components/Settings';
import * as api from '../lib/api';
import { supabase } from '@shared/lib/supabase';
import { DOCTORS } from '../constants';

// 자신의 변경을 무시하기 위한 타임스탬프 (구독 이벤트 무시용)
let lastLocalWaitingQueueUpdate = 0;
const IGNORE_SUBSCRIPTION_MS = 2000;

interface BulkAddFailure {
  name: string;
  chartNumber?: string;
  reason: string;
}

export const usePatients = (currentUser: any) => {
  // patientCache: ID로 환자를 빠르게 찾기 위한 캐시 (필요시 로드)
  const [patientCache, setPatientCache] = useState<Map<number, Patient>>(new Map());
  const [consultationWaitingList, setConsultationWaitingList] = useState<Patient[]>([]);
  const [treatmentWaitingList, setTreatmentWaitingList] = useState<Patient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState('대기 목록 로드 중...');

  // 더 이상 초기에 전체 환자를 로드하지 않음
  // 검색은 서버사이드로, 개별 환자 조회는 캐시 또는 API로 처리

  // allPatients는 캐시된 환자 목록으로 대체 (하위 호환성 유지)
  const allPatients = useMemo(() => Array.from(patientCache.values()), [patientCache]);

  // 초기 대기 목록 로드
  useEffect(() => {
    if (!currentUser) return;

    const loadWaitingQueues = async () => {
      try {
        setIsLoading(true);
        setLoadingMessage('대기 목록 로드 중...');

        // 진료 대기 목록 로드
        const consultationQueue = await api.fetchWaitingQueue('consultation');
        // 치료 대기 목록 로드
        const treatmentQueue = await api.fetchWaitingQueue('treatment');

        // 환자 ID 수집
        const patientIds = [
          ...consultationQueue.map(q => q.patient_id),
          ...treatmentQueue.map(q => q.patient_id),
        ];

        // 환자 정보 로드 및 캐시
        const patientMap = new Map<number, Patient>();
        for (const patientId of patientIds) {
          const patient = await api.fetchPatientById(patientId);
          if (patient) {
            // 기본 치료 정보도 로드
            const treatments = await api.fetchPatientDefaultTreatments(patientId);
            patient.defaultTreatments = treatments;
            patientMap.set(patientId, patient);
          }
        }

        // 캐시 업데이트
        setPatientCache(prev => {
          const newMap = new Map(prev);
          patientMap.forEach((patient, id) => newMap.set(id, patient));
          return newMap;
        });

        // 진료 대기 목록 구성
        const consultationPatients: Patient[] = consultationQueue
          .map(q => {
            const patient = patientMap.get(q.patient_id);
            if (!patient) return null;
            return {
              ...patient,
              status: PatientStatus.WAITING_CONSULTATION,
              time: q.created_at ? new Date(q.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }) : '',
              details: q.details,
            };
          })
          .filter((p): p is Patient => p !== null);

        // 치료 대기 목록 구성
        const treatmentPatients: Patient[] = treatmentQueue
          .map(q => {
            const patient = patientMap.get(q.patient_id);
            if (!patient) return null;
            return {
              ...patient,
              status: PatientStatus.WAITING_TREATMENT,
              time: q.created_at ? new Date(q.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }) : '',
              details: q.details,
            };
          })
          .filter((p): p is Patient => p !== null);

        setConsultationWaitingList(consultationPatients);
        setTreatmentWaitingList(treatmentPatients);

        console.log(`✅ 대기 목록 로드 완료 - 진료: ${consultationPatients.length}명, 치료: ${treatmentPatients.length}명`);
      } catch (error) {
        console.error('❌ 대기 목록 로드 오류:', error);
      } finally {
        setIsLoading(false);
        setLoadingMessage('');
      }
    };

    loadWaitingQueues();
  }, [currentUser]);

  // 대기 목록 실시간 구독
  useEffect(() => {
    if (!currentUser) return;

    const reloadWaitingQueues = async () => {
      // 자신의 변경 직후라면 구독 이벤트 무시
      const timeSinceLastUpdate = Date.now() - lastLocalWaitingQueueUpdate;
      if (timeSinceLastUpdate < IGNORE_SUBSCRIPTION_MS) {
        console.log(`[usePatients] 대기 목록 구독 이벤트 무시 (${timeSinceLastUpdate}ms 전 로컬 변경)`);
        return;
      }

      console.log('[usePatients] 대기 목록 외부 변경 감지, 데이터 리로드');

      try {
        const consultationQueue = await api.fetchWaitingQueue('consultation');
        const treatmentQueue = await api.fetchWaitingQueue('treatment');

        const patientIds = [
          ...consultationQueue.map(q => q.patient_id),
          ...treatmentQueue.map(q => q.patient_id),
        ];

        const patientMap = new Map<number, Patient>();
        for (const patientId of patientIds) {
          // 캐시 확인
          let patient = patientCache.get(patientId);
          if (!patient) {
            patient = await api.fetchPatientById(patientId) || undefined;
            if (patient) {
              const treatments = await api.fetchPatientDefaultTreatments(patientId);
              patient.defaultTreatments = treatments;
            }
          }
          if (patient) {
            patientMap.set(patientId, patient);
          }
        }

        // 캐시 업데이트
        setPatientCache(prev => {
          const newMap = new Map(prev);
          patientMap.forEach((patient, id) => newMap.set(id, patient));
          return newMap;
        });

        const consultationPatients: Patient[] = consultationQueue
          .map(q => {
            const patient = patientMap.get(q.patient_id);
            if (!patient) return null;
            return {
              ...patient,
              status: PatientStatus.WAITING_CONSULTATION,
              time: q.created_at ? new Date(q.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }) : '',
              details: q.details,
            };
          })
          .filter((p): p is Patient => p !== null);

        const treatmentPatients: Patient[] = treatmentQueue
          .map(q => {
            const patient = patientMap.get(q.patient_id);
            if (!patient) return null;
            return {
              ...patient,
              status: PatientStatus.WAITING_TREATMENT,
              time: q.created_at ? new Date(q.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }) : '',
              details: q.details,
            };
          })
          .filter((p): p is Patient => p !== null);

        setConsultationWaitingList(consultationPatients);
        setTreatmentWaitingList(treatmentPatients);
      } catch (error) {
        console.error('❌ 대기 목록 실시간 로드 오류:', error);
      }
    };

    const waitingQueueSubscription = supabase
      .channel('waiting-queue-changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'waiting_queue' },
        reloadWaitingQueues
      )
      .subscribe();

    return () => {
      supabase.removeChannel(waitingQueueSubscription);
    };
  }, [currentUser, patientCache]);

  // 개별 환자 조회 (캐시 우선, 없으면 API 호출)
  const getPatientById = useCallback(async (patientId: number): Promise<Patient | null> => {
    // 캐시 확인
    if (patientCache.has(patientId)) {
      return patientCache.get(patientId)!;
    }

    // API 호출
    try {
      const patient = await api.fetchPatientById(patientId);
      if (patient) {
        setPatientCache(prev => new Map(prev).set(patientId, patient));
      }
      return patient;
    } catch (error) {
      console.error('환자 조회 오류:', error);
      return null;
    }
  }, [patientCache]);

  // 환자를 캐시에 추가
  const addToCache = useCallback((patient: Patient) => {
    setPatientCache(prev => new Map(prev).set(patient.id, patient));
  }, []);

  // 실시간 구독 (Supabase 사용 시에만) - 캐시 업데이트
  useEffect(() => {
    if (!currentUser || !supabase) return;

    const patientsSubscription = supabase
      .channel('patients-changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'patients' },
        async (payload) => {
          if (payload.eventType === 'INSERT') {
            const newPatient = payload.new as any;
            const treatments = await api.fetchPatientDefaultTreatments(newPatient.id);
            setPatientCache(prev => new Map(prev).set(newPatient.id, { ...newPatient, defaultTreatments: treatments }));
          } else if (payload.eventType === 'UPDATE') {
            const updatedPatient = payload.new as any;
            // 캐시에 있는 경우에만 업데이트
            setPatientCache(prev => {
              if (prev.has(updatedPatient.id)) {
                const newMap = new Map(prev);
                const existing = prev.get(updatedPatient.id);
                newMap.set(updatedPatient.id, { ...existing, ...updatedPatient });
                return newMap;
              }
              return prev;
            });
          } else if (payload.eventType === 'DELETE') {
            const deletedId = payload.old.id;
            setPatientCache(prev => {
              const newMap = new Map(prev);
              newMap.delete(deletedId);
              return newMap;
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(patientsSubscription);
    };
  }, [currentUser]);

  // 활성/삭제된 환자 필터 (캐시 기반)
  const activePatients = useMemo(() => allPatients.filter(p => !p.deletionDate), [allPatients]);
  const deletedPatients = useMemo(() => allPatients.filter(p => !!p.deletionDate), [allPatients]);

  // 환자 추가
  const addNewPatient = useCallback(async (formData: NewPatientData, onAddActing?: (doctor: string, acting: Acting) => void) => {
    try {
      const tempPatient: Patient = {
        id: 0,
        name: formData.name,
        chartNumber: formData.chartNumber || '',
        status: PatientStatus.WAITING_CONSULTATION,
        time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }),
        details: `신규 | ${formData.treatmentType || '희망치료 미지정'}`,
        dob: formData.dob,
        gender: formData.gender === '' ? undefined : formData.gender,
        phone: formData.phone,
        address: formData.address,
        referralPath: formData.referral,
        registrationDate: new Date().toISOString().split('T')[0],
      };

      const savedPatient = await api.createPatient(tempPatient);

      const newPatient: Patient = {
        ...tempPatient,
        id: savedPatient.id,
        chartNumber: savedPatient.chartNumber || tempPatient.chartNumber,
      };

      // 캐시에 추가
      setPatientCache(prev => new Map(prev).set(newPatient.id, newPatient));
      setConsultationWaitingList(prevList => [newPatient, ...prevList]);

      // Add '초진' acting
      const doctor = formData.doctor;
      if (doctor && DOCTORS.includes(doctor) && onAddActing) {
        const newActing: Acting = {
          id: `act-${newPatient.id}-${Date.now()}-0`,
          patientId: newPatient.id,
          patientName: newPatient.name,
          type: '초진',
          duration: 30,
          source: 'new_patient',
        };
        onAddActing(doctor, newActing);
      }

      alert(`${newPatient.name}님을 신규 환자로 등록하고 진료 대기 목록에 추가했습니다.`);
      return newPatient;
    } catch (error) {
      console.error('❌ 환자 등록 오류:', error);
      alert('환자 등록 중 오류가 발생했습니다.');
      throw error;
    }
  }, []);

  // 환자 정보 수정
  const updatePatientInfo = useCallback(async (updatedPatientData: Patient) => {
    try {
      await api.updatePatient(updatedPatientData.id, updatedPatientData);

      // 캐시 업데이트
      setPatientCache(prev => new Map(prev).set(updatedPatientData.id, updatedPatientData));
      setConsultationWaitingList(prev => prev.map(p => p.id === updatedPatientData.id ? { ...p, ...updatedPatientData } : p));
      setTreatmentWaitingList(prev => prev.map(p => p.id === updatedPatientData.id ? { ...p, ...updatedPatientData } : p));

      alert(`${updatedPatientData.name}님의 정보가 수정되었습니다.`);
      return { name: updatedPatientData.name, chartNumber: updatedPatientData.chartNumber || '' };
    } catch (error) {
      console.error('❌ 환자 정보 수정 오류:', error);
      alert('환자 정보 수정 중 오류가 발생했습니다.');
      throw error;
    }
  }, []);

  // 환자 기본 치료 수정
  const updatePatientDefaultTreatments = useCallback(async (patientId: number, treatments: DefaultTreatment[]) => {
    try {
      await api.savePatientDefaultTreatments(patientId, treatments);

      const updateTreatments = (p: Patient) => {
        if (p.id === patientId) {
          return { ...p, defaultTreatments: treatments };
        }
        return p;
      };
      // 캐시 업데이트
      setPatientCache(prev => {
        if (prev.has(patientId)) {
          const newMap = new Map(prev);
          const existing = prev.get(patientId)!;
          newMap.set(patientId, { ...existing, defaultTreatments: treatments });
          return newMap;
        }
        return prev;
      });
      setTreatmentWaitingList(prev => prev.map(updateTreatments));
      setConsultationWaitingList(prev => prev.map(updateTreatments));
    } catch (error) {
      console.error('❌ 기본 치료 저장 오류:', error);
      alert('기본 치료 저장 중 오류가 발생했습니다.');
      throw error;
    }
  }, []);

  // 환자 삭제
  const deletePatient = useCallback(async (patientId: number) => {
    // 캐시에서 환자 찾기
    const patientToDelete = patientCache.get(patientId);

    if (!patientToDelete) {
      console.error("삭제할 환자를 찾을 수 없습니다.");
      return;
    }

    // 캐시에 삭제 표시
    setPatientCache(prev => {
      const newMap = new Map(prev);
      newMap.set(patientId, { ...patientToDelete, deletionDate: new Date().toISOString() });
      return newMap;
    });

    try {
      await api.deletePatient(patientId);

      setConsultationWaitingList(prev => prev.filter(p => p.id !== patientId));
      setTreatmentWaitingList(prev => prev.filter(p => p.id !== patientId));

      alert(`${patientToDelete.name}(${patientToDelete.chartNumber}) 님의 정보가 삭제 처리되었습니다.`);
    } catch (error) {
      console.error('❌ 환자 삭제 오류:', error);
      alert('환자 삭제 중 오류가 발생했습니다.');

      // Rollback on error
      setPatientCache(prev => {
        const newMap = new Map(prev);
        newMap.set(patientId, { ...patientToDelete, deletionDate: undefined });
        return newMap;
      });

      throw error;
    }
  }, [patientCache]);

  // 환자 복구
  const restorePatient = useCallback(async (patientId: number) => {
    // 캐시에서 환자 찾기
    const patientToRestore = patientCache.get(patientId);
    const previousDeletionDate = patientToRestore?.deletionDate;

    if (!patientToRestore) {
      alert("복구할 환자 정보를 찾을 수 없습니다.");
      return;
    }

    // 캐시에서 삭제 날짜 제거
    setPatientCache(prev => {
      const newMap = new Map(prev);
      const { deletionDate, ...restoredPatient } = patientToRestore;
      newMap.set(patientId, restoredPatient as Patient);
      return newMap;
    });

    try {
      await api.restorePatient(patientId);
      alert(`${patientToRestore.name} 님의 정보가 복구되었습니다.`);
    } catch (error) {
      console.error('❌ 환자 복구 오류:', error);
      alert('환자 복구 중 오류가 발생했습니다.');

      // Rollback on error
      if (previousDeletionDate) {
        setPatientCache(prev => {
          const newMap = new Map(prev);
          newMap.set(patientId, { ...patientToRestore, deletionDate: previousDeletionDate });
          return newMap;
        });
      }

      throw error;
    }
  }, [patientCache]);

  // 일괄 등록
  const addBulkPatients = useCallback(async (
    newPatientsData: BulkPatientData[],
    onProgress?: (current: number, total: number, message: string) => void
  ) => {
    console.log(`📊 [일괄등록] 시작: ${newPatientsData.length}명 처리 예정`);
    console.log(`📊 [일괄등록] onProgress 콜백 존재 여부:`, !!onProgress);

    const updatedPatients: Patient[] = [];
    const newPatients: Patient[] = [];
    const failures: BulkAddFailure[] = [];
    const chartNumbersInFile = new Set<string>();

    // 차트번호로 기존 환자 조회를 위해 서버에서 조회 (캐시 대신 직접 조회)
    const chartNumbers = newPatientsData
      .map(d => d.chartNumber ? String(d.chartNumber).trim() : '')
      .filter(cn => cn !== '');

    let existingPatientMapByChartNumber = new Map<string, Patient>();
    if (chartNumbers.length > 0) {
      try {
        const existingPatients = await api.fetchPatientsByChartNumbers(chartNumbers);
        existingPatientMapByChartNumber = new Map(existingPatients.map(p => [p.chartNumber, p]));
      } catch (error) {
        console.error('기존 환자 조회 실패:', error);
      }
    }

    try {
      console.log(`🔍 [일괄등록] 데이터 검증 중...`);
      for (const data of newPatientsData) {
        const name = String(data.name || '').trim();
        const chartNumber = data.chartNumber ? String(data.chartNumber).trim() : '';

        if (!name) {
          failures.push({ name: '(이름 없음)', chartNumber, reason: '환자 이름이 비어있습니다.' });
          continue;
        }

        if (chartNumber) {
          if (chartNumbersInFile.has(chartNumber)) {
            failures.push({ name, chartNumber, reason: '엑셀 파일 내 중복된 차트번호입니다.' });
            continue;
          }
          chartNumbersInFile.add(chartNumber);
        }

        const existingPatient = chartNumber ? existingPatientMapByChartNumber!.get(chartNumber) : undefined;

        if (existingPatient) {
          const updatedPatient = { ...existingPatient };
          if (data.name) updatedPatient.name = data.name;
          if (data.dob) updatedPatient.dob = data.dob;
          if (data.gender !== undefined) updatedPatient.gender = data.gender;
          if (data.address !== undefined) updatedPatient.address = data.address;
          if (data.phone !== undefined) updatedPatient.phone = data.phone;
          if (data.details !== undefined) updatedPatient.referralPath = data.details;
          if (data.registrationDate) updatedPatient.registrationDate = data.registrationDate;
          updatedPatients.push(updatedPatient);
        } else {
          const tempPatient: Patient = {
            id: 0,
            name,
            chartNumber: chartNumber || '',
            status: PatientStatus.COMPLETED,
            time: '',
            details: '일괄등록',
            dob: data.dob,
            gender: data.gender,
            address: data.address,
            phone: data.phone,
            referralPath: data.details || '',
            registrationDate: data.registrationDate || new Date().toISOString().split('T')[0],
          };
          newPatients.push(tempPatient);
        }
      }

      console.log(`✅ [일괄등록] 검증 완료 - 신규: ${newPatients.length}명, 업데이트: ${updatedPatients.length}명`);

      const savedNewPatients: Patient[] = [];

      const totalOperations = newPatients.length + updatedPatients.length;
      let completedOperations = 0;

      console.log(`📊 [일괄등록] totalOperations: ${totalOperations}`);

      if (newPatients.length > 0) {
        console.log(`💾 [일괄등록] DB 저장 시작: ${newPatients.length}명`);
        for (const patient of newPatients) {
          try {
            const saved = await api.createPatient(patient);
            savedNewPatients.push(saved);
            completedOperations++;

            // 매 건마다 프로그레스 업데이트
            if (onProgress) {
              console.log(`🔔 [프로그레스 호출] ${completedOperations}/${totalOperations}`);
              onProgress(completedOperations, totalOperations, `신규 환자 저장 중... (${savedNewPatients.length}/${newPatients.length})`);
            } else {
              console.warn(`⚠️ [프로그레스] onProgress가 없습니다!`);
            }

            if (completedOperations % 100 === 0 || completedOperations === newPatients.length) {
              console.log(`💾 [일괄등록] 저장 진행 중... ${savedNewPatients.length}/${newPatients.length}`);
            }
          } catch (error) {
            console.error(`❌ [일괄등록] 환자 저장 실패: ${patient.name}`, error);
            failures.push({ name: patient.name, chartNumber: patient.chartNumber, reason: '데이터베이스 저장 오류' });
            completedOperations++;
            if (onProgress) {
              onProgress(completedOperations, totalOperations, `신규 환자 저장 중... (${savedNewPatients.length}/${newPatients.length})`);
            }
          }
        }
        console.log(`✅ [일괄등록] 신규 저장 완료: ${savedNewPatients.length}명`);
      }

      if (updatedPatients.length > 0) {
        console.log(`🔄 [일괄등록] DB 업데이트 시작: ${updatedPatients.length}명`);
        let updateCount = 0;
        for (const patient of updatedPatients) {
          try {
            await api.updatePatient(patient.id, patient);
            updateCount++;
            completedOperations++;

            // 매 건마다 프로그레스 업데이트
            if (onProgress) {
              onProgress(completedOperations, totalOperations, `환자 정보 업데이트 중... (${updateCount}/${updatedPatients.length})`);
            }

            if (updateCount % 100 === 0 || updateCount === updatedPatients.length) {
              console.log(`🔄 [일괄등록] 업데이트 진행 중... ${updateCount}/${updatedPatients.length}`);
            }
          } catch (error) {
            console.error(`❌ [일괄등록] 환자 업데이트 실패: ${patient.name}`, error);
            failures.push({ name: patient.name, chartNumber: patient.chartNumber || '', reason: '데이터베이스 업데이트 오류' });
            completedOperations++;
            if (onProgress) {
              onProgress(completedOperations, totalOperations, `환자 정보 업데이트 중... (${updateCount}/${updatedPatients.length})`);
            }
          }
        }
        console.log(`✅ [일괄등록] 업데이트 완료: ${updateCount}명`);
      }

      if (savedNewPatients.length > 0 || updatedPatients.length > 0) {
        console.log(`📝 [일괄등록] 캐시 업데이트 중...`);
        setPatientCache(prev => {
          const newMap = new Map(prev);
          // 업데이트된 환자 캐시 추가
          updatedPatients.forEach(p => newMap.set(p.id, p));
          // 신규 환자 캐시 추가
          savedNewPatients.forEach(p => newMap.set(p.id, p));
          return newMap;
        });
        console.log(`✅ [일괄등록] 캐시 업데이트 완료`);
      }

      const result = { new: savedNewPatients.length, updated: updatedPatients.length, failures };
      console.log(`🎉 [일괄등록] 전체 작업 완료 -`, result);
      return result;
    } catch (error) {
      console.error('❌ 일괄 등록 오류:', error);
      alert('일괄 등록 중 오류가 발생했습니다.');
      throw error;
    }
  }, []);

  // 대기 목록 추가 (DB 연동)
  const addPatientToConsultation = useCallback(async (patient: Patient, details: string = '검색 추가') => {
    // 이미 대기 목록에 있는지 확인
    const alreadyExists = consultationWaitingList.some(p => p.id === patient.id);
    if (alreadyExists) {
      alert(`${patient.name}님은 이미 진료 대기 목록에 있습니다.`);
      return false;
    }

    // 로컬 상태 먼저 업데이트 (낙관적 업데이트)
    lastLocalWaitingQueueUpdate = Date.now();
    const currentTime = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
    const newPatient: Patient = {
      ...patient,
      status: PatientStatus.WAITING_CONSULTATION,
      time: currentTime,
      details,
    };
    setConsultationWaitingList(prev => [...prev, newPatient]);

    // DB에 저장
    try {
      await api.addToWaitingQueue({
        patient_id: patient.id,
        queue_type: 'consultation',
        details,
        position: 0,
      });
      console.log(`✅ ${patient.name}님을 진료 대기 목록에 추가 (DB 저장 완료)`);
    } catch (error) {
      console.error('❌ 진료 대기 목록 DB 저장 오류:', error);
      // 실패 시 롤백
      setConsultationWaitingList(prev => prev.filter(p => p.id !== patient.id));
      alert('대기 목록 추가 중 오류가 발생했습니다.');
      return false;
    }

    alert(`${patient.name}님을 진료 대기 목록에 추가했습니다.`);
    return true;
  }, [consultationWaitingList]);

  const addPatientToTreatment = useCallback(async (patient: Patient, details: string = '검색 추가') => {
    // 이미 대기 목록에 있는지 확인
    const alreadyExists = treatmentWaitingList.some(p => p.id === patient.id);
    if (alreadyExists) {
      alert(`${patient.name}님은 이미 치료 대기 목록에 있습니다.`);
      return false;
    }

    // 로컬 상태 먼저 업데이트 (낙관적 업데이트)
    lastLocalWaitingQueueUpdate = Date.now();
    const currentTime = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
    const newPatient: Patient = {
      ...patient,
      status: PatientStatus.WAITING_TREATMENT,
      time: currentTime,
      details,
    };
    setTreatmentWaitingList(prev => [...prev, newPatient]);

    // DB에 저장
    try {
      await api.addToWaitingQueue({
        patient_id: patient.id,
        queue_type: 'treatment',
        details,
        position: 0,
      });
      console.log(`✅ ${patient.name}님을 치료 대기 목록에 추가 (DB 저장 완료)`);
    } catch (error) {
      console.error('❌ 치료 대기 목록 DB 저장 오류:', error);
      // 실패 시 롤백
      setTreatmentWaitingList(prev => prev.filter(p => p.id !== patient.id));
      alert('대기 목록 추가 중 오류가 발생했습니다.');
      return false;
    }

    alert(`${patient.name}님을 치료 대기 목록에 추가했습니다.`);
    return true;
  }, [treatmentWaitingList]);

  // 환자 이동 (DB 연동)
  const movePatient = useCallback(async (patientToMove: Patient) => {
    const currentTime = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
    lastLocalWaitingQueueUpdate = Date.now();

    if (patientToMove.status === PatientStatus.WAITING_CONSULTATION) {
      // 로컬 상태 업데이트
      setConsultationWaitingList(prev => prev.filter(p => p.id !== patientToMove.id));
      const updatedPatient = {
        ...patientToMove,
        status: PatientStatus.WAITING_TREATMENT,
        time: currentTime,
        details: '진료완료',
      };
      setTreatmentWaitingList(prev => [...prev, updatedPatient]);

      // DB 업데이트
      try {
        await api.movePatientBetweenQueues(patientToMove.id, 'consultation', 'treatment', '진료완료');
      } catch (error) {
        console.error('❌ 대기 목록 이동 DB 오류:', error);
      }
    } else if (patientToMove.status === PatientStatus.WAITING_TREATMENT) {
      // 로컬 상태 업데이트
      setTreatmentWaitingList(prev => prev.filter(p => p.id !== patientToMove.id));
      const updatedPatient = {
        ...patientToMove,
        status: PatientStatus.WAITING_CONSULTATION,
        time: currentTime,
        details: '재진료요청',
      };
      setConsultationWaitingList(prev => [...prev, updatedPatient]);

      // DB 업데이트
      try {
        await api.movePatientBetweenQueues(patientToMove.id, 'treatment', 'consultation', '재진료요청');
      } catch (error) {
        console.error('❌ 대기 목록 이동 DB 오류:', error);
      }
    }
  }, []);

  // 드래그 앤 드롭
  const handlePatientDrop = useCallback((
    draggedPatientId: number,
    sourceListType: 'consultation' | 'treatment',
    destinationListType: 'consultation' | 'treatment',
    targetPatientId: number | null
  ) => {
    if (sourceListType !== destinationListType) return;

    const setSourceList = sourceListType === 'consultation' ? setConsultationWaitingList : setTreatmentWaitingList;

    setSourceList(prevList => {
      const draggedPatient = prevList.find(p => p.id === draggedPatientId);
      if (!draggedPatient) return prevList;

      const list = [...prevList];
      const draggedIndex = list.findIndex(p => p.id === draggedPatientId);
      list.splice(draggedIndex, 1);
      const targetIndex = targetPatientId !== null ? list.findIndex(p => p.id === targetPatientId) : list.length;
      list.splice(targetIndex, 0, draggedPatient);

      return list;
    });
  }, []);

  // 환자를 대기 목록에서 제거 (DB 연동)
  const removeFromConsultationList = useCallback(async (patientId: number) => {
    lastLocalWaitingQueueUpdate = Date.now();
    setConsultationWaitingList(prev => prev.filter(p => p.id !== patientId));

    try {
      await api.removeFromWaitingQueue(patientId, 'consultation');
    } catch (error) {
      console.error('❌ 진료 대기 목록 제거 DB 오류:', error);
    }
  }, []);

  const removeFromTreatmentList = useCallback(async (patientId: number) => {
    lastLocalWaitingQueueUpdate = Date.now();
    setTreatmentWaitingList(prev => prev.filter(p => p.id !== patientId));

    try {
      await api.removeFromWaitingQueue(patientId, 'treatment');
    } catch (error) {
      console.error('❌ 치료 대기 목록 제거 DB 오류:', error);
    }
  }, []);

  // 환자를 특정 대기 목록에 추가 (DB 연동)
  const addToConsultationList = useCallback(async (patient: Patient, details: string) => {
    lastLocalWaitingQueueUpdate = Date.now();
    const currentTime = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
    const patientForList: Patient = {
      ...patient,
      status: PatientStatus.WAITING_CONSULTATION,
      time: currentTime,
      details,
    };
    setConsultationWaitingList(prev => [...prev, patientForList]);

    try {
      await api.addToWaitingQueue({
        patient_id: patient.id,
        queue_type: 'consultation',
        details,
        position: 0,
      });
    } catch (error) {
      console.error('❌ 진료 대기 목록 추가 DB 오류:', error);
    }
  }, []);

  const addToTreatmentList = useCallback(async (patient: Patient, details: string) => {
    lastLocalWaitingQueueUpdate = Date.now();
    const currentTime = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
    const patientForList: Patient = {
      ...patient,
      status: PatientStatus.WAITING_TREATMENT,
      time: currentTime,
      details,
    };
    setTreatmentWaitingList(prev => [...prev, patientForList]);

    try {
      await api.addToWaitingQueue({
        patient_id: patient.id,
        queue_type: 'treatment',
        details,
        position: 0,
      });
    } catch (error) {
      console.error('❌ 치료 대기 목록 추가 DB 오류:', error);
    }
  }, []);

  return useMemo(() => ({
    allPatients,
    activePatients,
    deletedPatients,
    consultationWaitingList,
    treatmentWaitingList,
    isLoading,
    loadingMessage,
    setConsultationWaitingList,
    setTreatmentWaitingList,
    addNewPatient,
    updatePatientInfo,
    updatePatientDefaultTreatments,
    deletePatient,
    restorePatient,
    addBulkPatients,
    addPatientToConsultation,
    addPatientToTreatment,
    movePatient,
    handlePatientDrop,
    removeFromConsultationList,
    removeFromTreatmentList,
    addToConsultationList,
    addToTreatmentList,
    // 캐시 기반 환자 조회 함수
    getPatientById,
    addToCache,
  }), [
    allPatients,
    activePatients,
    deletedPatients,
    consultationWaitingList,
    treatmentWaitingList,
    isLoading,
    loadingMessage,
    addNewPatient,
    updatePatientInfo,
    updatePatientDefaultTreatments,
    deletePatient,
    restorePatient,
    addBulkPatients,
    addPatientToConsultation,
    addPatientToTreatment,
    movePatient,
    handlePatientDrop,
    removeFromConsultationList,
    removeFromTreatmentList,
    addToConsultationList,
    addToTreatmentList,
    getPatientById,
    addToCache,
  ]);
};
