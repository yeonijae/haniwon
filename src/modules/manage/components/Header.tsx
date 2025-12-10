import React from 'react';
import { Link } from 'react-router-dom';
import { User } from '../types';

export type ModalType = 'newPatient' | 'reservation' | 'patientSearch' | 'stats' | 'settings' | 'payment' | 'dailyPayments' | 'consultationInfo';

interface HeaderProps {
  onOpenModal: (type: ModalType, title: string, wide?: boolean) => void;
  currentUser: User;
}

interface ButtonConfig {
  icon: string;
  label: string;
  modalTitle: string;
  modalType: ModalType;
  wide?: boolean;
  link?: string;  // 외부 페이지 링크 (새 창)
}

const Header: React.FC<HeaderProps> = ({
    onOpenModal,
    currentUser,
}) => {
  const buttons: ButtonConfig[] = [
    {
      icon: 'fa-solid fa-magnifying-glass',
      label: '환자검색',
      modalTitle: '환자 검색',
      modalType: 'patientSearch',
    },
    {
      icon: 'fa-solid fa-user-plus',
      label: '신규환자',
      modalTitle: '신규환자 등록',
      modalType: 'newPatient'
    },
    {
      icon: 'fa-solid fa-calendar-check',
      label: '예약관리',
      modalTitle: '예약 관리',
      modalType: 'reservation',
      wide: true,
      link: '/reservation',  // 예약관리 시스템으로 이동
    },
    {
      icon: 'fa-solid fa-won-sign',
      label: '수납현황',
      modalTitle: '일일 수납 현황',
      modalType: 'dailyPayments',
      wide: true,
    },
    {
      icon: 'fa-solid fa-chart-line',
      label: '통계',
      modalTitle: '일일 통계',
      modalType: 'stats'
    },
    {
      icon: 'fa-solid fa-gear',
      label: '설정',
      modalTitle: '환경 설정',
      modalType: 'settings'
    },
  ];

  return (
    <header className="bg-clinic-surface shadow-md flex items-center justify-between px-4 py-2 flex-shrink-0">
      <Link
        to="/manage"
        className="flex items-center cursor-pointer"
        aria-label="운영관리 대시보드로 이동"
      >
        <i className="fas fa-clinic-medical text-3xl text-clinic-primary mr-3"></i>
        <div className="flex flex-col">
          <h1 className="text-2xl font-bold text-clinic-primary">운영 관리 시스템</h1>
          <p className="text-xs text-gray-400 -mt-0.5">연이재한의원</p>
        </div>
      </Link>
      <div className="flex items-center space-x-4">
        <nav className="flex items-center space-x-2">
          {buttons.map((btn) => (
            <button
              key={btn.label}
              onClick={() => {
                if (btn.link) {
                  window.open(btn.link, '_blank');
                } else {
                  onOpenModal(btn.modalType, btn.modalTitle, btn.wide);
                }
              }}
              className="flex flex-col items-center justify-center px-3 py-2 text-sm font-medium text-clinic-text-secondary hover:bg-clinic-background hover:text-clinic-primary rounded-lg transition-colors duration-200 w-20"
            >
              <i className={`${btn.icon} text-xl mb-1`}></i>
              <span>{btn.label}</span>
            </button>
          ))}
        </nav>
        <div className="border-l pl-4 ml-2 flex items-center space-x-3">
          <div className="text-right">
            <p className="font-semibold text-sm text-clinic-text-primary">{currentUser.name}</p>
            <p className="text-xs text-clinic-text-secondary">{currentUser.affiliation}</p>
          </div>
          <button
            onClick={() => window.close()}
            className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-100 text-gray-500 hover:bg-red-100 hover:text-red-600 transition-colors"
            title="닫기"
            aria-label="닫기"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
