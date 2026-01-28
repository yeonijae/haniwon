/**
 * 원장 선택 패널
 * 대시보드 진입 시 원장 선택 화면
 */

import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { fetchDoctorsWithSqliteStatus } from '@modules/staff/api/staffApi';
import { getAllDoctorsUrgentCounts } from '../lib/dashboardApi';
import type { StaffMember } from '@modules/staff/types';

export function DoctorSelectPanel() {
  const navigate = useNavigate();
  const [, setSearchParams] = useSearchParams();
  const [doctors, setDoctors] = useState<StaffMember[]>([]);
  const [urgentCounts, setUrgentCounts] = useState<Map<number, number>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDoctors();
  }, []);

  const loadDoctors = async () => {
    try {
      const [doctorList, counts] = await Promise.all([
        fetchDoctorsWithSqliteStatus(),
        getAllDoctorsUrgentCounts(),
      ]);
      // 활성 의사만 필터링
      const activeDoctors = doctorList.filter(d => d.status === 'active');
      setDoctors(activeDoctors);
      setUrgentCounts(counts);
    } catch (error) {
      console.error('원장 목록 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectDoctor = (doctorId: number) => {
    setSearchParams({ doctor: doctorId.toString() });
  };

  // 긴급도 배지 스타일
  const getUrgencyBadge = (count: number) => {
    if (count === 0) return null;
    
    const bgColor = count >= 3 ? 'bg-red-500' : count >= 1 ? 'bg-orange-500' : 'bg-gray-400';
    return (
      <span className={`text-xs px-2 py-0.5 rounded-full ${bgColor} text-white font-medium`}>
        D-2 {count}건
      </span>
    );
  };

  // 프로필 색상 기본값
  const getProfileColor = (doctor: StaffMember) => {
    return doctor.profile_color || '#3B82F6';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="border-4 border-gray-200 border-t-clinic-primary rounded-full w-12 h-12 animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500">원장 목록을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center h-full bg-gray-50">
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-2xl w-full mx-4">
        {/* 헤더 */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">
            원장을 선택하세요
          </h1>
          <p className="text-gray-500 text-sm">
            대시보드를 확인할 원장을 선택해주세요
          </p>
        </div>

        {/* 원장 그리드 */}
        <div className="grid grid-cols-2 gap-4">
          {doctors.map(doctor => {
            const urgentCount = urgentCounts.get(doctor.id) || 0;
            const color = getProfileColor(doctor);
            
            return (
              <button
                key={doctor.id}
                onClick={() => handleSelectDoctor(doctor.id)}
                className="relative p-6 rounded-lg border-2 border-gray-200 hover:border-clinic-primary hover:shadow-md transition-all text-left group"
              >
                {/* 프로필 아바타 */}
                <div className="flex items-center gap-4">
                  <div
                    className="w-14 h-14 rounded-full flex items-center justify-center text-white text-xl font-bold shadow-md"
                    style={{ backgroundColor: color }}
                  >
                    {doctor.alias?.[0] || doctor.name[0]}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800 group-hover:text-clinic-primary transition-colors">
                      {doctor.alias || doctor.name}
                    </h3>
                    <p className="text-sm text-gray-500">{doctor.name}</p>
                  </div>
                </div>

                {/* 긴급 배지 */}
                {urgentCount > 0 && (
                  <div className="absolute top-3 right-3">
                    {getUrgencyBadge(urgentCount)}
                  </div>
                )}

                {/* 진료실 정보 */}
                {doctor.consultation_room && (
                  <div className="mt-3 text-xs text-gray-400">
                    {doctor.consultation_room}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* 비어있을 때 */}
        {doctors.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <p>등록된 원장이 없습니다.</p>
            <p className="text-sm mt-2">인사관리에서 원장을 등록해주세요.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default DoctorSelectPanel;
