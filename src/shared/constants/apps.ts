import type { AppType } from '../types';

export interface AppInfo {
  id: AppType;
  name: string;
  description: string;
  path: string;
  icon: string;
  color: string;
}

export const APPS: AppInfo[] = [
  {
    id: 'manage',
    name: '운영관리',
    description: '한의원 운영 전반을 관리합니다. 예약, 환자 관리, 매출 통계 등을 확인할 수 있습니다.',
    path: '/manage',
    icon: '📊',
    color: '#667eea',
  },
  {
    id: 'chart',
    name: '진료관리',
    description: '환자 차트 및 진료 기록을 관리합니다. 처방전, 진료 노트, 의료 기록을 작성할 수 있습니다.',
    path: '/chart',
    icon: '📋',
    color: '#10b981',
  },
  {
    id: 'inventory',
    name: '재고관리',
    description: '약재 및 물품 재고를 관리합니다. 입출고 현황, 재고 현황, 발주 관리를 할 수 있습니다.',
    path: '/inventory',
    icon: '📦',
    color: '#f59e0b',
  },
  {
    id: 'treatment',
    name: '치료관리',
    description: '치료실을 관리합니다. 환자 베드 배정, 치료 타이머, 치료 정보 수정을 할 수 있습니다.',
    path: '/treatment',
    icon: '🏥',
    color: '#06b6d4',
  },
  {
    id: 'acting',
    name: '액팅관리',
    description: '원장별 액팅 대기열을 관리합니다. 자침, 추나, 초음파 등 액팅 순서를 조정할 수 있습니다.',
    path: '/acting',
    icon: '👨‍⚕️',
    color: '#14b8a6',
  },
  {
    id: 'herbal',
    name: '복약관리',
    description: '초진콜, 복약콜, 내원콜 등 환자 관리 업무를 처리합니다.',
    path: '/herbal',
    icon: '💊',
    color: '#22c55e',
  },
  {
    id: 'funnel',
    name: '퍼널관리',
    description: '환자 유입 퍼널을 관리합니다. 리드 관리, 리타겟팅, DM발송 등을 할 수 있습니다.',
    path: '/funnel',
    icon: '🎯',
    color: '#8b5cf6',
  },
  {
    id: 'content',
    name: '컨텐츠관리',
    description: '블로그, 안내페이지, 랜딩페이지, 이벤트DM 등 컨텐츠를 관리합니다.',
    path: '/content',
    icon: '📝',
    color: '#f43f5e',
  },
  {
    id: 'reservation',
    name: '예약관리',
    description: '환자 예약을 관리합니다. 캘린더 뷰, 의사별 일정, 외부예약 승인 등을 처리할 수 있습니다.',
    path: '/reservation',
    icon: '📅',
    color: '#3b82f6',
  },
  {
    id: 'doctor_pad',
    name: '닥터패드',
    description: '원장용 진료 화면입니다. 액팅 대기열 확인, 진료 시작/완료, 환자 정보를 확인할 수 있습니다.',
    path: '/doctor-pad',
    icon: '👨‍⚕️',
    color: '#059669',
  },
  {
    id: 'statistics',
    name: '통계',
    description: '일간/주간/월간 운영 통계를 확인합니다. 환자수, 추나현황, 예약율, 매출 등을 분석할 수 있습니다.',
    path: '/statistics',
    icon: '📈',
    color: '#dc2626',
  },
  {
    id: 'db_admin',
    name: 'DB관리',
    description: 'MSSQL 데이터베이스를 조회합니다. 테이블 구조, 데이터 확인, SQL 쿼리 실행이 가능합니다.',
    path: '/db-admin',
    icon: '🗄️',
    color: '#475569',
  },
  {
    id: 'staff',
    name: '직원관리',
    description: '원장/직원 정보 및 근무일정을 관리합니다. 근무패턴, 급여/면담 타임라인, 휴가 관리가 가능합니다.',
    path: '/staff',
    icon: '👥',
    color: '#6366f1',
  },
  {
    id: 'wiki',
    name: '운영매뉴얼',
    description: '한의원 운영 매뉴얼입니다. 업무 프로세스, 가이드, 문서를 위키 형태로 관리합니다.',
    path: '/wiki',
    icon: '📖',
    color: '#0ea5e9',
  },
  {
    id: 'cs',
    name: 'CS관리',
    description: '데스크 업무를 관리합니다. 예약, 수납메모, 문의접수, 환자검색을 할 수 있습니다.',
    path: '/cs',
    icon: '🎧',
    color: '#ec4899',
  },
];
