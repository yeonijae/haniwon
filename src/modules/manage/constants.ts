

import { Patient, TreatmentRoom, Payment, PatientStatus, RoomStatus, Treatment, MedicalStaff, Staff, UncoveredCategories, ConsultationRoom, ActingType, DefaultTreatment, User } from './types';

export const TREATMENTS: Treatment[] = [
  { name: '침', acting: 1 },
  { name: '추나', acting: 1 },
  { name: '약초진', acting: 6 },
  { name: '약재진', acting: 3 },
];

export const ALL_PATIENTS: Patient[] = [
    { id: 1, name: '김민준', chartNumber: 'C001', time: '10:00', status: PatientStatus.RESERVED, details: '초진', dob: '1985-03-15', gender: 'male', phone: '010-1111-2222', address: '서울시 강남구 테헤란로 123', referralPath: '인터넷 검색', registrationDate: '2023-01-10' },
    { id: 2, name: '이서연', chartNumber: 'C002', time: '10:30', status: PatientStatus.RESERVED, details: '재진', dob: '1992-07-22', gender: 'female', phone: '010-3333-4444', address: '서울시 서초구 서초대로 456', referralPath: '지인소개', registrationDate: '2023-02-20' },
    { id: 3, name: '박하준', chartNumber: 'C003', time: '11:00', status: PatientStatus.RESERVED, details: '재진', dob: '1978-11-02', gender: 'male', phone: '010-5555-6666', address: '경기도 성남시 분당구 판교역로 789', referralPath: '블로그', registrationDate: '2023-03-05' },
    { id: 4, name: '최지우', chartNumber: 'C004', time: '11:30', status: PatientStatus.RESERVED, details: '초진', dob: '2001-01-20', gender: 'female', phone: '010-7777-8888', address: '인천광역시 연수구 송도국제대로 123', referralPath: '인스타그램', registrationDate: '2023-04-12', defaultTreatments: [{ name: '견인', duration: 10, memo: '목 디스크' }, { name: '초음파', duration: 5, memo: '오른쪽 손목'}, { name: '충격파', duration: 20, memo: '어깨 회전근' }] },
    { id: 5, name: '정시우', chartNumber: 'C005', time: '14:00', status: PatientStatus.RESERVED, details: '재진', dob: '1995-05-10', gender: 'male', phone: '010-9999-0000', address: '서울시 마포구 월드컵북로 456', referralPath: '지인소개', registrationDate: '2023-05-18' },
    { id: 7, name: '강지호', chartNumber: 'C007', time: '10:05', status: PatientStatus.WAITING_TREATMENT, details: '진료완료', dob: '1999-12-25', gender: 'male', phone: '010-8765-4321', address: '경기도 수원시 영통구 광교중앙로 240', referralPath: '맘카페', registrationDate: '2023-07-30' },
    { id: 8, name: '송예나', chartNumber: 'C008', time: '10:10', status: PatientStatus.WAITING_TREATMENT, details: '진료완료', dob: '2005-04-03', gender: 'female', phone: '010-5678-1234', address: '서울시 강동구 천호대로 1000', referralPath: '유튜브', registrationDate: '2023-08-01' },
    { id: 9, name: '박서준', chartNumber: 'C009', time: '10:20', status: PatientStatus.IN_TREATMENT, details: '치료중', dob: '1982-02-18', gender: 'male', phone: '010-2468-1357', address: '서울시 송파구 올림픽로 300', referralPath: '지역광고', registrationDate: '2023-09-15', defaultTreatments: [{ name: '초음파', duration: 10, memo: '허리 3,4번' }, { name: '침', duration: 15, memo: '목 주변' }, { name: '충격파', duration: 15, memo: '오른쪽 어깨' }] },
    { id: 10, name: '한지민', chartNumber: 'C010', time: '10:25', status: PatientStatus.IN_TREATMENT, details: '치료중', dob: '1990-06-30', gender: 'female', phone: '010-1357-2468', address: '경기도 하남시 미사강변동로 84', referralPath: '지인소개', registrationDate: '2023-10-22', defaultTreatments: [{ name: '추나', duration: 20, memo: '골반 교정' }, { name: '견인', duration: 10, memo: '허리' }, { name: '침', duration: 15, memo: '허리, 다리' }] },
    { id: 11, name: '조은서', chartNumber: 'C011', time: '10:30', status: PatientStatus.WAITING_PAYMENT, details: '수납대기', dob: '1997-08-12', gender: 'female', phone: '010-9876-5432', address: '서울시 중구 세종대로 110', referralPath: '네이버예약', registrationDate: '2023-11-03' },
    { id: 12, name: '임도윤', chartNumber: 'C012', time: '10:40', status: PatientStatus.WAITING_PAYMENT, details: '수납대기', dob: '1980-10-05', gender: 'male', phone: '010-5432-9876', address: '부산광역시 해운대구 마린시티2로 33', referralPath: '카카오맵', registrationDate: '2023-12-11' },
    { id: 13, name: '신유준', chartNumber: 'C013', time: '10:50', status: PatientStatus.WAITING_PAYMENT, details: '수납대기', dob: '2003-03-03', gender: 'male', phone: '010-6789-0123', address: '대구광역시 수성구 동대구로 386', referralPath: '블로그', registrationDate: '2024-01-07' },
    { id: 14, name: '김철수', chartNumber: 'C014', time: '', status: PatientStatus.COMPLETED, details: '재진', dob: '1975-01-01', gender: 'male', phone: '010-1111-1111', address: '광주광역시 서구 내방로 111', referralPath: '오래된 환자', registrationDate: '2022-05-20' },
    { id: 15, name: '박영희', chartNumber: 'C015', time: '', status: PatientStatus.COMPLETED, details: '초진', dob: '1968-02-02', gender: 'female', phone: '010-2222-2222', address: '대전광역시 유성구 대덕대로 989', referralPath: '전단지', registrationDate: '2022-06-15' },
    { id: 16, name: '김영수', chartNumber: 'C016', time: '', status: PatientStatus.COMPLETED, details: '재진', dob: '1993-04-14', gender: 'male', phone: '010-3333-3333', address: '울산광역시 남구 번영로 124', referralPath: '재방문', registrationDate: '2022-07-01' },
];

export const USERS: User[] = [
  { id: 'doctor_kim', password: 'password123', name: '김경희', affiliation: '의료진' },
  { id: 'doctor_lee', password: 'password123', name: '이수진', affiliation: '의료진' },
  { id: 'manager_choi', password: 'password123', name: '최민지', affiliation: '데스크' },
  { id: 'therapist_lee', password: 'password123', name: '이준호', affiliation: '치료실' },
  { id: 'admin', password: '7582', name: '관리자', affiliation: '데스크' },
];

export const RESERVATIONS: Patient[] = [
  { id: 1, name: '김민준', chartNumber: 'C001', time: '10:00', status: PatientStatus.RESERVED, details: '초진' },
  { id: 2, name: '이서연', chartNumber: 'C002', time: '10:30', status: PatientStatus.RESERVED, details: '재진' },
  { id: 3, name: '박하준', chartNumber: 'C003', time: '11:00', status: PatientStatus.RESERVED, details: '재진' },
  { id: 4, name: '최지우', chartNumber: 'C004', time: '11:30', status: PatientStatus.RESERVED, details: '초진' },
  { id: 5, name: '정시우', chartNumber: 'C005', time: '14:00', status: PatientStatus.RESERVED, details: '재진' },
];

export const CONSULTATION_WAITING_LIST: Patient[] = ALL_PATIENTS.filter(p => [1].includes(p.id)).map(p => {
    if (p.id === 1) return { ...p, status: PatientStatus.WAITING_CONSULTATION, time: '10:00', details: '예약환자' };
    return p;
});

export const TREATMENT_WAITING_LIST: Patient[] = ALL_PATIENTS.filter(p => [7, 8].includes(p.id)).map(p => {
    if (p.id === 7) return { ...p, status: PatientStatus.WAITING_TREATMENT, time: '10:05', details: '진료완료' };
    if (p.id === 8) return { ...p, status: PatientStatus.WAITING_TREATMENT, time: '10:10', details: '진료완료' };
    return p;
});

export const CONSULTATION_ROOMS: ConsultationRoom[] = [
  { id: 1, roomName: '1진료실', doctorName: '김경희 원장', status: 'available' },
  { id: 2, roomName: '2진료실', doctorName: '이수진 원장', status: 'waiting', patientId: 1, patientName: '김민준', patientDetails: '재진 | 예약환자' },
  { id: 3, roomName: '3진료실', doctorName: '박지훈 원장', status: 'available' },
  { id: 4, roomName: '4진료실', doctorName: '미지정', status: 'available' },
  { id: 5, roomName: '상담실', doctorName: '상담실장', status: 'available' },
  { id: 6, roomName: '검사실', doctorName: '검사담당', status: 'available' },
];

export const INITIAL_TREATMENT_ROOMS: TreatmentRoom[] = [
  { 
    id: 1, name: '1-1', status: RoomStatus.IN_USE, sessionId: 'sess-1', patientId: 9, patientName: '박서준', patientChartNumber: 'C009', doctorName: '김경희 원장', inTime: new Date(Date.now() - 10 * 60000).toISOString(), 
    sessionTreatments: [
      { id: 't1', name: '초음파', status: 'completed', duration: 10, startTime: new Date(Date.now() - 10 * 60000).toISOString(), elapsedSeconds: 600, memo: '허리 3,4번' },
      { id: 't2', name: '침', status: 'running', duration: 15, startTime: new Date(Date.now() - 5 * 60000).toISOString(), elapsedSeconds: 0, memo: '목 주변' },
      { id: 't3', name: '충격파', status: 'pending', duration: 15, elapsedSeconds: 0, memo: '오른쪽 어깨' }
    ]
  },
  { id: 2, name: '1-2', status: RoomStatus.AVAILABLE, sessionTreatments: [] },
  { id: 3, name: '1-3', status: RoomStatus.AVAILABLE, sessionTreatments: [] },
  { id: 4, name: '1-4', status: RoomStatus.CLEANING, sessionTreatments: [] },
  { id: 5, name: '1-5', status: RoomStatus.AVAILABLE, sessionTreatments: [] },
  { id: 6, name: '2-1', status: RoomStatus.AVAILABLE, sessionTreatments: [] },
  { 
    id: 7, name: '2-2', status: RoomStatus.IN_USE, sessionId: 'sess-2', patientId: 10, patientName: '한지민', patientChartNumber: 'C010', doctorName: '이수진 원장', inTime: new Date(Date.now() - 15 * 60000).toISOString(),
    sessionTreatments: [
      { id: 't4', name: '추나', status: 'running', duration: 20, startTime: new Date(Date.now() - 15 * 60000).toISOString(), elapsedSeconds: 0, memo: '골반 교정' },
      // FIX: Added the missing 'status' property.
      { id: 't5', name: '견인', status: 'pending', duration: 10, elapsedSeconds: 0 },
      { id: 't6', name: '침', status: 'pending', duration: 15, elapsedSeconds: 0, memo: '허리, 다리' }
    ]
  },
  { id: 8, name: '2-3', status: RoomStatus.AVAILABLE, sessionTreatments: [] },
  { id: 9, name: '2-4', status: RoomStatus.AVAILABLE, sessionTreatments: [] },
  { id: 10, name: '2-5', status: RoomStatus.AVAILABLE, sessionTreatments: [] },
  { id: 11, name: '2-6', status: RoomStatus.NEED_CLEAN, sessionTreatments: [] },
  { id: 12, name: '2-7', status: RoomStatus.AVAILABLE, sessionTreatments: [] },
  { 
    id: 13, name: '2-8', status: RoomStatus.IN_USE, sessionId: 'sess-3', patientId: 4, patientName: '최지우', patientChartNumber: 'C004', doctorName: '박지훈 원장', inTime: new Date(Date.now() - 2 * 60000).toISOString(),
    sessionTreatments: [
      { id: 't7', name: '견인', status: 'completed', duration: 10, startTime: new Date(Date.now() - 2 * 60000).toISOString(), elapsedSeconds: 600 },
      { id: 't8', name: '초음파', status: 'completed', duration: 5, startTime: new Date(Date.now() - 2 * 60000).toISOString(), elapsedSeconds: 300 },
      { id: 't9', name: '충격파', status: 'paused', duration: 20, elapsedSeconds: 120 }
    ]
  },
  { id: 14, name: '3-1', status: RoomStatus.AVAILABLE, sessionTreatments: [] },
  { id: 15, name: '3-2', status: RoomStatus.AVAILABLE, sessionTreatments: [] },
  { id: 16, name: '4-1', status: RoomStatus.AVAILABLE, sessionTreatments: [] },
  { id: 17, name: '4-2', status: RoomStatus.AVAILABLE, sessionTreatments: [] },
];

export const PAYMENTS_WAITING: Payment[] = [
    { id: 1, patientId: 11, patientName: '조은서', patientChartNumber: 'C011', details: '침치료, 약침', isPaid: false },
    { id: 2, patientId: 12, patientName: '임도윤', patientChartNumber: 'C012', details: '물리치료, 부항', isPaid: false },
    { id: 3, patientId: 13, patientName: '신유준', patientChartNumber: 'C013', details: '추나, 공진단(1환)', isPaid: false },
];

export const MEDICAL_STAFF_LIST: MedicalStaff[] = [
  {
    id: 1,
    name: '김경희',
    dob: '1975-05-20',
    gender: 'female',
    hireDate: '2010-03-01',
    status: 'working',
    permissions: { prescription: true, chart: true, payment: true, statistics: true },
    workPatterns: [
      { id: 'wp1-1', days: [true, true, true, true, true, false, false], startDate: '2010-03-01', endDate: '2024-12-31' }
    ],
    consultationRoom: '1진료실'
  },
  {
    id: 2,
    name: '이수진',
    dob: '1982-11-15',
    gender: 'female',
    hireDate: '2015-09-01',
    status: 'working',
    permissions: { prescription: true, chart: true, payment: false, statistics: false },
    workPatterns: [
        { id: 'wp2-1', days: [false, true, false, true, false, true, false], startDate: '2015-09-01', endDate: '2023-12-31' },
        { id: 'wp2-2', days: [true, true, true, true, true, false, false], startDate: '2024-01-01', endDate: '2025-12-31' }
    ],
    consultationRoom: '2진료실'
  },
  {
    id: 3,
    name: '박지훈',
    dob: '1988-02-10',
    gender: 'male',
    hireDate: '2020-01-15',
    fireDate: '2023-12-31',
    status: 'retired',
    permissions: { prescription: true, chart: true, payment: false, statistics: false },
    workPatterns: [
        { id: 'wp3-1', days: [true, true, true, true, true, true, false], startDate: '2020-01-15', endDate: '2023-12-31' }
    ],
    consultationRoom: '3진료실'
  },
];

export const STAFF_LIST: Staff[] = [
  {
    id: 101,
    name: '최민지',
    dob: '1990-08-25',
    gender: 'female',
    hireDate: '2018-03-10',
    status: 'working',
    rank: '실장',
    department: '총괄',
    permissions: { decoction: true, patient: true, herbalMedicine: true, payment: true, inventory: true, board: true, treatmentRoom: true },
  },
  {
    id: 102,
    name: '이준호',
    dob: '1995-04-12',
    gender: 'male',
    hireDate: '2021-07-01',
    status: 'working',
    rank: '팀장',
    department: '치료팀',
    permissions: { decoction: false, patient: true, herbalMedicine: false, payment: false, inventory: true, board: true, treatmentRoom: true },
  },
  {
    id: 103,
    name: '김유나',
    dob: '1998-12-30',
    gender: 'female',
    hireDate: '2022-01-20',
    fireDate: '2024-05-31',
    status: 'retired',
    rank: '사원',
    department: '데스크',
    permissions: { decoction: false, patient: true, herbalMedicine: false, payment: true, inventory: false, board: true, treatmentRoom: false },
  },
];

export const UNCOVERED_CATEGORIES_DATA: UncoveredCategories = {
    '한약': ['선1M', '선2M', '선3M', 'N차처방', '재처방', '녹용추가'],
    '상비한약': ['상비약', '감기약', '치료약', '보완처방', '선물', '테스트'],
    '기성한약': ['사향공진단', '연이재공진단', '황제공진단', '쌍O탕', '녹용경옥고'],
    '약침': ['일회성', '통마선결', '멤버선결', '통마', '멤버십'],
    '물치': ['스파인엠티', '향기요법', '비급여추나', '기타물치'],
    '기타': ['서류발급', '종합진료비']
};

export const DOCTORS = ['김원장', '강원장', '임원장', '전원장'];

// 자침: 원장이 침 놓는 시간 (1~3분), 기존 '침'은 호환성 위해 유지
export const ACTING_TYPE_DETAILS: { [key in ActingType]: { icon: string; color: string; } } = {
  '자침': { icon: 'fa-solid fa-syringe', color: 'bg-teal-100 border-teal-500' },  // 원장 자침 시간
  '침': { icon: 'fa-solid fa-syringe', color: 'bg-teal-100 border-teal-500' },    // 기존 호환성
  '추나': { icon: 'fa-solid fa-person-cane', color: 'bg-sky-100 border-sky-500' },
  '초진': { icon: 'fa-solid fa-user-plus', color: 'bg-indigo-100 border-indigo-500' },
  '약상담': { icon: 'fa-solid fa-pills', color: 'bg-yellow-100 border-yellow-500' },
  '초음파': { icon: 'fa-solid fa-wave-square', color: 'bg-purple-100 border-purple-500' },
  '향기': { icon: 'fa-solid fa-leaf', color: 'bg-violet-100 border-violet-500' },
  '습부': { icon: 'fa-solid fa-droplet', color: 'bg-cyan-100 border-cyan-500' },
  '대기': { icon: 'fa-solid fa-clock', color: 'bg-gray-100 border-gray-400' },
  '기타': { icon: 'fa-solid fa-ellipsis', color: 'bg-orange-100 border-orange-500' },
};

export const AVAILABLE_TREATMENTS: DefaultTreatment[] = [
  { name: '침', duration: 10 },
  { name: '추나', duration: 5 },
  { name: '물치', duration: 10 },
  { name: '핫팩', duration: 10 },
  { name: '습부', duration: 5 },
  { name: '초음파', duration: 10 },
  { name: '고주파', duration: 10 },
  { name: '향기', duration: 5 },
  { name: '견인', duration: 10 },
];

export const BASIC_TREATMENTS: DefaultTreatment[] = [
  { name: '침', duration: 10 },
  { name: '물치', duration: 10 },
  { name: '핫팩', duration: 10 },
];