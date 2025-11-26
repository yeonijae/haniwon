// 치료관리 모듈 상수

import { ActingType, DefaultTreatment } from './types';

export const DOCTORS = ['김원장', '강원장', '임원장', '전원장'];

export const ACTING_TYPE_DETAILS: { [key in ActingType]: { icon: string; color: string; } } = {
  '침': { icon: 'fa-solid fa-syringe', color: 'bg-teal-100 border-teal-500' },
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
