/**
 * 직원관리 앱
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import type { PortalUser } from '@shared/types';
import { ROLE_LABELS } from '@shared/types';
import type { StaffMember, EmployeeType } from './types';
import { fetchStaffList, fetchDoctorsWithSqliteStatus, migrateMedicalStaffData } from './api/staffApi';

import StaffListView from './components/StaffListView';
import StaffDetailModal from './components/StaffDetailModal';
import ScheduleBatchModal from './components/ScheduleBatchModal';

interface StaffAppProps {
  user: PortalUser;
}

export type StaffTabType = 'doctors' | 'staff' | 'schedule';

const StaffApp: React.FC<StaffAppProps> = ({ user }) => {
  const navigate = useNavigate();

  // 상태
  const [doctors, setDoctors] = useState<StaffMember[]>([]);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<StaffTabType>('staff');

  // 모달 상태
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [showNewStaffModal, setShowNewStaffModal] = useState(false);
  const [newStaffType, setNewStaffType] = useState<EmployeeType>('staff');
  const [showBatchModal, setShowBatchModal] = useState(false);

  // 마이그레이션 상태 (useRef로 변경하여 불필요한 리렌더링 방지)
  const migrationDoneRef = useRef(false);
  const isLoadingRef = useRef(false);

  // 데이터 로드
  const loadData = useCallback(async () => {
    // 이미 로딩 중이면 중복 호출 방지
    if (isLoadingRef.current) {
      console.log('[loadData] 이미 로딩 중, 스킵');
      return;
    }
    isLoadingRef.current = true;
    setLoading(true);

    try {
      // 최초 실행 시 운영관리시스템 데이터 마이그레이션 시도
      if (!migrationDoneRef.current) {
        try {
          const result = await migrateMedicalStaffData();
          if (result.migrated > 0) {
            console.log(`[Migration] ${result.migrated}명 의료진 마이그레이션 완료`);
          }
          migrationDoneRef.current = true;
        } catch (err) {
          console.error('마이그레이션 오류:', err);
        }
      }

      // 원장: MSSQL + SQLite 상태 병합, 직원: SQLite에서 불러오기
      const [doctorData, staffData] = await Promise.all([
        fetchDoctorsWithSqliteStatus(),
        fetchStaffList('staff')
      ]);

      console.log('[loadData] doctors:', doctorData.length, 'staff:', staffData.length);
      setDoctors(doctorData);
      setStaffMembers(staffData);
    } catch (error) {
      console.error('직원 목록 조회 실패:', error);
    } finally {
      setLoading(false);
      isLoadingRef.current = false;
    }
  }, []);

  useEffect(() => {
    loadData();
  }, []);

  // 핸들러
  function handleStaffClick(staff: StaffMember) {
    setSelectedStaff(staff);
  }

  function handleNewStaff(type: EmployeeType) {
    setNewStaffType(type);
    setShowNewStaffModal(true);
  }

  function handleModalClose() {
    setSelectedStaff(null);
    setShowNewStaffModal(false);
  }

  function handleModalSuccess() {
    handleModalClose();
    loadData();
  }

  function handleBatchSchedule() {
    setShowBatchModal(true);
  }

  // 현재 탭에 따른 데이터
  const currentList = activeTab === 'doctors' ? doctors : staffMembers;
  const currentType: EmployeeType = activeTab === 'doctors' ? 'doctor' : 'staff';

  return (
    <div className="h-screen bg-gray-100 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-white shadow-md flex items-center px-4 py-2 flex-shrink-0">
        {/* 왼쪽 - 로고 및 제목 */}
        <div
          className="flex items-center cursor-pointer hover:opacity-80 transition-opacity"
          onClick={() => navigate('/')}
          role="button"
          aria-label="포털로 이동"
        >
          <i className="fas fa-users text-3xl text-indigo-500 mr-3"></i>
          <div className="flex flex-col">
            <h1 className="text-2xl font-bold text-indigo-600">직원관리</h1>
            <p className="text-xs text-gray-400 -mt-0.5">연이재한의원</p>
          </div>
        </div>

        {/* 탭 */}
        <div className="flex items-center gap-1 ml-8 bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('doctors')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'doctors'
                ? 'bg-white text-indigo-600 shadow'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <i className="fas fa-user-md mr-2"></i>
            원장 ({doctors.length})
          </button>
          <button
            onClick={() => setActiveTab('staff')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'staff'
                ? 'bg-white text-indigo-600 shadow'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <i className="fas fa-id-badge mr-2"></i>
            직원 ({staffMembers.length})
          </button>
          <button
            onClick={() => setActiveTab('schedule')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'schedule'
                ? 'bg-white text-indigo-600 shadow'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <i className="fas fa-calendar-alt mr-2"></i>
            근무일정
          </button>
        </div>

        {/* 오른쪽 - 버튼 및 사용자 정보 */}
        <div className="flex items-center ml-auto gap-4">
          {/* 직원 탭에서만 추가 버튼 표시 (원장은 MSSQL에서 관리) */}
          {activeTab === 'staff' && (
            <button
              onClick={() => handleNewStaff('staff')}
              className="px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors"
            >
              <i className="fas fa-plus mr-2"></i>
              직원 추가
            </button>
          )}

          {activeTab === 'schedule' && (
            <button
              onClick={handleBatchSchedule}
              className="px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors"
            >
              <i className="fas fa-edit mr-2"></i>
              일괄 입력
            </button>
          )}

          <button
            onClick={loadData}
            disabled={loading}
            className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            <i className={`fas fa-sync-alt mr-2 ${loading ? 'animate-spin' : ''}`}></i>
            새로고침
          </button>

          <div className="text-right">
            <p className="font-semibold text-sm text-gray-800">{user?.name || '관리자'}</p>
            <p className="text-xs text-gray-500">
              {user?.role ? ROLE_LABELS[user.role] : '연이재한의원'}
            </p>
          </div>

          <button
            onClick={() => navigate('/')}
            className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-100 text-gray-500 hover:bg-red-100 hover:text-red-600 transition-colors"
            title="닫기"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden bg-gray-50">
        {activeTab === 'schedule' ? (
          <ScheduleCalendarView
            doctors={doctors}
            staffMembers={staffMembers}
            onRefresh={loadData}
          />
        ) : (
          <StaffListView
            staffList={currentList}
            loading={loading}
            employeeType={currentType}
            onStaffClick={handleStaffClick}
          />
        )}
      </main>

      {/* Modals */}
      {(selectedStaff || showNewStaffModal) && (
        <StaffDetailModal
          staff={selectedStaff}
          isNew={showNewStaffModal}
          defaultType={newStaffType}
          onClose={handleModalClose}
          onSuccess={handleModalSuccess}
        />
      )}

      {showBatchModal && (
        <ScheduleBatchModal
          staffList={staffMembers}
          onClose={() => setShowBatchModal(false)}
          onSuccess={() => {
            setShowBatchModal(false);
            loadData();
          }}
        />
      )}
    </div>
  );
};

// 임시 스케줄 캘린더 뷰
const ScheduleCalendarView: React.FC<{
  doctors: StaffMember[];
  staffMembers: StaffMember[];
  onRefresh: () => void;
}> = ({ doctors, staffMembers }) => {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  });

  const handlePrevMonth = () => {
    setCurrentMonth(prev => {
      if (prev.month === 1) {
        return { year: prev.year - 1, month: 12 };
      }
      return { ...prev, month: prev.month - 1 };
    });
  };

  const handleNextMonth = () => {
    setCurrentMonth(prev => {
      if (prev.month === 12) {
        return { year: prev.year + 1, month: 1 };
      }
      return { ...prev, month: prev.month + 1 };
    });
  };

  const allStaff = [...doctors, ...staffMembers];

  // 월의 날짜들 생성
  const getDaysInMonth = (year: number, month: number) => {
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const days: Date[] = [];

    // 첫째 주 시작 요일 (일=0)
    const startDayOfWeek = firstDay.getDay();
    // 이전 달 날짜 채우기
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, -i);
      days.push(d);
    }

    // 현재 달 날짜
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(year, month - 1, i));
    }

    // 다음 달 날짜 채우기 (6주 완성)
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push(new Date(year, month, i));
    }

    return days;
  };

  const days = getDaysInMonth(currentMonth.year, currentMonth.month);

  return (
    <div className="h-full flex flex-col p-4">
      {/* 월 네비게이션 */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={handlePrevMonth}
          className="px-3 py-2 bg-white rounded-lg shadow hover:bg-gray-50"
        >
          <i className="fas fa-chevron-left"></i>
        </button>
        <h2 className="text-xl font-bold text-gray-800">
          {currentMonth.year}년 {currentMonth.month}월
        </h2>
        <button
          onClick={handleNextMonth}
          className="px-3 py-2 bg-white rounded-lg shadow hover:bg-gray-50"
        >
          <i className="fas fa-chevron-right"></i>
        </button>
      </div>

      {/* 캘린더 그리드 */}
      <div className="flex-1 bg-white rounded-xl shadow overflow-hidden">
        <div className="grid grid-cols-8 border-b">
          <div className="p-2 text-center text-sm font-medium text-gray-500 border-r bg-gray-50">
            직원
          </div>
          {['일', '월', '화', '수', '목', '금', '토'].map((day, i) => (
            <div
              key={day}
              className={`p-2 text-center text-sm font-medium ${
                i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-gray-600'
              }`}
            >
              {day}
            </div>
          ))}
        </div>

        <div className="overflow-auto" style={{ maxHeight: 'calc(100vh - 220px)' }}>
          {allStaff.map(staff => (
            <div key={staff.id} className="grid grid-cols-8 border-b hover:bg-gray-50">
              <div className="p-2 text-sm font-medium text-gray-800 border-r flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: staff.profile_color }}
                ></span>
                {staff.name}
              </div>
              {/* 첫째 주만 표시 (예시) */}
              {days.slice(0, 7).map((date, i) => (
                <div
                  key={i}
                  className={`p-1 text-center text-xs ${
                    date.getMonth() + 1 !== currentMonth.month ? 'text-gray-300' : ''
                  }`}
                >
                  <span className="inline-block px-2 py-1 rounded bg-blue-100 text-blue-700">
                    풀
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <p className="text-sm text-yellow-800">
          <i className="fas fa-info-circle mr-2"></i>
          위의 "일괄 입력" 버튼을 클릭하여 세 가지 방식으로 근무일정을 입력할 수 있습니다.
        </p>
      </div>
    </div>
  );
};

export default StaffApp;
