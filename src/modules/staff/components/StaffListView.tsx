/**
 * 직원 목록 뷰
 */

import React from 'react';
import type { StaffMember, EmployeeType, WorkPart } from '../types';
import { EMPLOYEE_STATUS_LABELS, WORK_PART_LABELS } from '../types';

interface StaffListViewProps {
  staffList: StaffMember[];
  loading: boolean;
  employeeType: EmployeeType;
  onStaffClick: (staff: StaffMember) => void;
}

const StaffListView: React.FC<StaffListViewProps> = ({
  staffList,
  loading,
  employeeType,
  onStaffClick
}) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <i className="fas fa-spinner fa-spin text-4xl text-indigo-500 mb-4"></i>
          <p className="text-gray-500">직원 정보를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (staffList.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <i className={`fas ${employeeType === 'doctor' ? 'fa-user-md' : 'fa-users'} text-6xl text-gray-300 mb-4`}></i>
          <p className="text-gray-500 text-lg">
            {employeeType === 'doctor' ? '등록된 원장이 없습니다.' : '등록된 직원이 없습니다.'}
          </p>
          <p className="text-gray-400 text-sm mt-2">
            상단의 추가 버튼을 눌러 새로 등록하세요.
          </p>
        </div>
      </div>
    );
  }

  // 미등록 원장 여부 확인
  const hasUnregisteredDoctors = employeeType === 'doctor' && staffList.some(s => s.isRegisteredInSqlite === false);

  return (
    <div className="p-4 h-full overflow-auto">
      {/* 원장 탭 안내 */}
      {employeeType === 'doctor' && (
        <div className={`mb-4 p-3 ${hasUnregisteredDoctors ? 'bg-orange-50 border-orange-200' : 'bg-indigo-50 border-indigo-200'} border rounded-lg flex items-center gap-2`}>
          <i className={`fas fa-info-circle ${hasUnregisteredDoctors ? 'text-orange-500' : 'text-indigo-500'}`}></i>
          <span className={`text-sm ${hasUnregisteredDoctors ? 'text-orange-700' : 'text-indigo-700'}`}>
            {hasUnregisteredDoctors
              ? '정보 생성이 필요한 원장이 있습니다. 카드를 클릭하여 정보를 생성하세요.'
              : '원장 기본정보는 오케이차트(MSSQL)에서 동기화됩니다. 추가 정보(진료실, 권한, 근무패턴 등)를 관리할 수 있습니다.'}
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {staffList.map(staff => (
          <StaffCard
            key={staff.mssql_doctor_id || staff.id}
            staff={staff}
            onClick={() => onStaffClick(staff)}
          />
        ))}
      </div>
    </div>
  );
};

// 직원 카드 컴포넌트
const StaffCard: React.FC<{
  staff: StaffMember;
  onClick: () => void;
}> = ({ staff, onClick }) => {
  const isDoctor = staff.employee_type === 'doctor';
  const isRegistered = staff.isRegisteredInSqlite !== false; // undefined도 등록된 것으로 간주

  const statusColor = {
    active: 'bg-green-100 text-green-700',
    resigned: 'bg-gray-100 text-gray-500',
    leave: 'bg-yellow-100 text-yellow-700'
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    try {
      let date: Date;
      if (dateStr.includes('-') && dateStr.length >= 10) {
        date = new Date(dateStr.substring(0, 10));
      } else {
        const fixedDateStr = dateStr.replace(/ GM$/, ' GMT');
        date = new Date(fixedDateStr);
      }
      if (!isNaN(date.getTime())) {
        const year = String(date.getFullYear()).slice(-2);
        const month = date.getMonth() + 1;
        const day = date.getDate();
        return `${year}/${month}/${day}`;
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  const calculateTenure = (hireDate?: string) => {
    if (!hireDate) return '-';
    const fixedDate = hireDate.replace(/ GM$/, ' GMT');
    const start = new Date(fixedDate);
    const now = new Date();
    const years = now.getFullYear() - start.getFullYear();
    const months = now.getMonth() - start.getMonth();
    const totalMonths = years * 12 + months;

    if (totalMonths < 12) {
      return `${totalMonths}개월`;
    }
    const y = Math.floor(totalMonths / 12);
    const m = totalMonths % 12;
    return m > 0 ? `${y}년 ${m}개월` : `${y}년`;
  };

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 hover:shadow-md hover:border-indigo-200 transition-all cursor-pointer"
    >
      {/* 헤더 */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center text-white text-lg font-bold"
            style={{ backgroundColor: staff.profile_color }}
          >
            {staff.name.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="font-bold text-gray-800">{staff.name}</h3>
              {isDoctor && (
                <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-600 text-[10px] rounded font-medium">
                  OKC
                </span>
              )}
              {isDoctor && !isRegistered && (
                <span className="px-1.5 py-0.5 bg-orange-100 text-orange-600 text-[10px] rounded font-medium">
                  정보생성필요
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500">
              {staff.position || '-'}
              {staff.work_part && ` · ${WORK_PART_LABELS[staff.work_part as WorkPart]}`}
            </p>
          </div>
        </div>
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor[staff.status]}`}>
          {EMPLOYEE_STATUS_LABELS[staff.status]}
        </span>
      </div>

      {/* 정보 */}
      <div className="space-y-2 text-sm">
        <div className="flex items-center text-gray-600">
          <i className="fas fa-calendar-alt w-5 text-gray-400"></i>
          <span className="ml-2">입사: {formatDate(staff.hire_date)}</span>
        </div>
        <div className="flex items-center text-gray-600">
          <i className="fas fa-clock w-5 text-gray-400"></i>
          <span className="ml-2">근속: {calculateTenure(staff.hire_date)}</span>
        </div>
        {staff.phone && (
          <div className="flex items-center text-gray-600">
            <i className="fas fa-phone w-5 text-gray-400"></i>
            <span className="ml-2">{staff.phone}</span>
          </div>
        )}
      </div>

      {/* 메모 미리보기 */}
      {staff.memo && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <p className="text-xs text-gray-500 line-clamp-2">{staff.memo}</p>
        </div>
      )}
    </div>
  );
};

export default StaffListView;
