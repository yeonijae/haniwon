/**
 * 직원 상세 정보 모달
 * - 기본 정보 편집
 * - 근무 패턴 (원장)
 * - 급여/면담 타임라인 (원장)
 * - 휴가 관리
 */

import React, { useState, useEffect } from 'react';
import type { StaffMember, EmployeeType, WorkPattern, SalaryInterview, LeaveRecord, DoctorPermissions, Gender, ConsultationRoom } from '../types';
import {
  EMPLOYEE_TYPE_LABELS,
  SALARY_EVENT_LABELS,
  LEAVE_TYPE_LABELS,
  DAY_NAMES,
  CONSULTATION_ROOMS,
  PERMISSION_LABELS,
  GENDER_LABELS,
  DEFAULT_DOCTOR_PERMISSIONS
} from '../types';
import {
  createStaff,
  updateStaff,
  deleteStaff,
  fetchWorkPatterns,
  createWorkPattern,
  updateWorkPattern,
  deleteWorkPattern,
  fetchSalaryInterviews,
  createSalaryInterview,
  deleteSalaryInterview,
  fetchLeaveRecords,
  createLeaveRecord,
  deleteLeaveRecord,
  createDoctorFromMssql,
  type MssqlDoctor
} from '../api/staffApi';
import { execute } from '@shared/lib/postgres';

interface StaffDetailModalProps {
  staff: StaffMember | null;
  isNew: boolean;
  defaultType: EmployeeType;
  onClose: () => void;
  onSuccess: () => void;
}

type TabType = 'info' | 'pattern' | 'timeline' | 'leave';

const PROFILE_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1'
];

const StaffDetailModal: React.FC<StaffDetailModalProps> = ({
  staff,
  isNew,
  defaultType,
  onClose,
  onSuccess
}) => {
  // 의료진인지 확인
  const isDoctor = staff?.employee_type === 'doctor' || defaultType === 'doctor';
  // SQLite에 등록되었는지 확인 (id가 0이면 미등록)
  const isRegisteredInSqlite = staff?.isRegisteredInSqlite !== false && staff?.id !== 0;

  const [activeTab, setActiveTab] = useState<TabType>('info');
  const [loading, setLoading] = useState(false);

  // 기본 정보 폼
  const [name, setName] = useState(staff?.name || '');
  const [phone, setPhone] = useState(staff?.phone || '');
  const [email, setEmail] = useState(staff?.email || '');
  const [position, setPosition] = useState(staff?.position || '');
  const [workPart, setWorkPart] = useState(staff?.work_part || '');
  const [hireDate, setHireDate] = useState(staff?.hire_date || '');
  const [resignDate, setResignDate] = useState(staff?.resign_date || '');
  const [profileColor, setProfileColor] = useState(staff?.profile_color || PROFILE_COLORS[0]);
  const [memo, setMemo] = useState(staff?.memo || '');
  const [employeeType] = useState<EmployeeType>(staff?.employee_type || defaultType);

  // 의료진 전용 필드
  const [dob, setDob] = useState(staff?.dob || '');
  const [gender, setGender] = useState<Gender>(staff?.gender || 'male');
  const [consultationRoom, setConsultationRoom] = useState<ConsultationRoom | ''>(staff?.consultation_room || '');
  const [permissions, setPermissions] = useState<DoctorPermissions>(
    staff?.permissions || DEFAULT_DOCTOR_PERMISSIONS
  );
  const [alias, setAlias] = useState(staff?.alias || '');

  // 추가 데이터
  const [workPatterns, setWorkPatterns] = useState<WorkPattern[]>([]);
  const [salaryInterviews, setSalaryInterviews] = useState<SalaryInterview[]>([]);
  const [leaveRecords, setLeaveRecords] = useState<LeaveRecord[]>([]);

  // SQLite에 등록된 의료진만 추가 데이터 조회 가능
  const staffIdForData = isRegisteredInSqlite ? staff?.id : undefined;

  useEffect(() => {
    if (staffIdForData) {
      loadAdditionalData();
    }
  }, [staffIdForData]);

  async function loadAdditionalData() {
    if (!staffIdForData) return;

    try {
      const [patterns, interviews, leaves] = await Promise.all([
        fetchWorkPatterns(staffIdForData),
        fetchSalaryInterviews(staffIdForData),
        fetchLeaveRecords(staffIdForData)
      ]);
      setWorkPatterns(patterns);
      setSalaryInterviews(interviews);
      setLeaveRecords(leaves);
    } catch (error) {
      console.error('추가 데이터 로드 실패:', error);
    }
  }

  // 미등록 의료진을 SQLite에 등록
  async function handleCreateDoctor() {
    if (!staff?.mssql_doctor_id) {
      alert('MSSQL 의료진 정보를 찾을 수 없습니다.');
      return;
    }

    setLoading(true);
    try {
      const mssqlDoc: MssqlDoctor = {
        id: staff.mssql_doctor_id,
        name: staff.name,
        color: staff.profile_color,
        resigned: staff.status === 'resigned',
        isOther: false,
        workStartDate: staff.hire_date || null,
        workEndDate: staff.resign_date || null
      };

      await createDoctorFromMssql(mssqlDoc, {
        dob: dob || undefined,
        gender: gender,
        consultation_room: consultationRoom || undefined,
        permissions: permissions,
        profile_color: profileColor,
        alias: alias || undefined
      });

      alert('의료진 정보가 생성되었습니다.');
      onSuccess();
    } catch (error) {
      console.error('의료진 생성 실패:', error);
      alert('의료진 정보 생성에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }

  // 저장 핸들러
  async function handleSave() {
    if (!name.trim()) {
      alert('이름을 입력해주세요.');
      return;
    }

    setLoading(true);
    try {
      if (isNew) {
        await createStaff({
          employee_type: employeeType,
          name,
          phone: phone || undefined,
          email: email || undefined,
          position: position || undefined,
          work_part: workPart || undefined,
          dob: dob || undefined,
          hire_date: hireDate || undefined,
          status: 'active',
          profile_color: profileColor,
          memo: memo || undefined
        });
        alert('직원이 등록되었습니다.');
      } else if (staff?.id) {
        // 의료진인 경우 추가 필드도 업데이트
        if (isDoctor) {
          await updateDoctorInfo(staff.id, {
            name,
            phone: phone || undefined,
            email: email || undefined,
            position: position || undefined,
            hire_date: hireDate || undefined,
            resign_date: resignDate || undefined,
            profile_color: profileColor,
            memo: memo || undefined,
            dob: dob || undefined,
            gender: gender,
            consultation_room: consultationRoom || undefined,
            permissions: permissions,
            alias: alias || undefined
          });
        } else {
          await updateStaff(staff.id, {
            name,
            phone: phone || undefined,
            email: email || undefined,
            position: position || undefined,
            work_part: workPart || undefined,
            dob: dob || undefined,
            hire_date: hireDate || undefined,
            profile_color: profileColor,
            memo: memo || undefined
          });
        }
        alert('정보가 수정되었습니다.');
      }
      onSuccess();
    } catch (error) {
      console.error('저장 실패:', error);
      alert('저장에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }

  // 의료진 정보 업데이트 (추가 필드 포함)
  async function updateDoctorInfo(id: number, data: any) {
    const permissionsJson = JSON.stringify(data.permissions);
    const updates: string[] = [];

    if (data.name !== undefined) updates.push(`name = '${data.name.replace(/'/g, "''")}'`);
    if (data.phone !== undefined) updates.push(`phone = ${data.phone ? `'${data.phone}'` : 'NULL'}`);
    if (data.email !== undefined) updates.push(`email = ${data.email ? `'${data.email}'` : 'NULL'}`);
    if (data.position !== undefined) updates.push(`position = ${data.position ? `'${data.position}'` : 'NULL'}`);
    if (data.hire_date !== undefined) updates.push(`hire_date = ${data.hire_date ? `'${data.hire_date}'` : 'NULL'}`);
    if (data.resign_date !== undefined) updates.push(`resign_date = ${data.resign_date ? `'${data.resign_date}'` : 'NULL'}`);
    if (data.profile_color !== undefined) updates.push(`profile_color = '${data.profile_color}'`);
    if (data.memo !== undefined) updates.push(`memo = ${data.memo ? `'${data.memo.replace(/'/g, "''")}'` : 'NULL'}`);
    if (data.dob !== undefined) updates.push(`dob = ${data.dob ? `'${data.dob}'` : 'NULL'}`);
    if (data.gender !== undefined) updates.push(`gender = ${data.gender ? `'${data.gender}'` : 'NULL'}`);
    if (data.consultation_room !== undefined) updates.push(`consultation_room = ${data.consultation_room ? `'${data.consultation_room}'` : 'NULL'}`);
    if (data.permissions !== undefined) updates.push(`permissions = '${permissionsJson}'`);
    if (data.alias !== undefined) updates.push(`alias = ${data.alias ? `'${data.alias.replace(/'/g, "''")}'` : 'NULL'}`);

    // 퇴사일이 입력되면 상태를 resigned로 변경
    if (data.resign_date) {
      updates.push(`status = 'resigned'`);
    }

    updates.push(`updated_at = datetime('now')`);

    if (updates.length > 0) {
      await execute(`UPDATE staff SET ${updates.join(', ')} WHERE id = ${id}`);
    }
  }

  // 삭제 핸들러
  async function handleDelete() {
    if (!staff?.id) return;
    if (!confirm(`${staff.name}님을 삭제하시겠습니까?\n관련된 모든 데이터가 함께 삭제됩니다.`)) return;

    setLoading(true);
    try {
      await deleteStaff(staff.id);
      alert('삭제되었습니다.');
      onSuccess();
    } catch (error) {
      console.error('삭제 실패:', error);
      alert('삭제에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* 헤더 */}
        <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 px-6 py-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center text-white text-xl font-bold"
                style={{ backgroundColor: profileColor }}
              >
                {name ? name.charAt(0) : '?'}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-white">
                    {isNew ? '새 직원 등록' : name}
                  </h2>
                  {isDoctor && (
                    <span className="px-2 py-0.5 bg-indigo-400 text-white text-xs rounded-full">
                      OKC
                    </span>
                  )}
                  {isDoctor && !isRegisteredInSqlite && (
                    <span className="px-2 py-0.5 bg-orange-400 text-white text-xs rounded-full">
                      미등록
                    </span>
                  )}
                </div>
                <p className="text-indigo-200 text-sm">
                  {EMPLOYEE_TYPE_LABELS[employeeType]}
                  {position && ` - ${position}`}
                  {hireDate && ` | 입사: ${hireDate}`}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:text-indigo-200 transition-colors"
            >
              <i className="fas fa-times text-xl"></i>
            </button>
          </div>

          {/* 탭 - 등록된 직원/의료진만 */}
          {!isNew && isRegisteredInSqlite && (
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setActiveTab('info')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'info'
                    ? 'bg-white text-indigo-600'
                    : 'text-indigo-100 hover:bg-indigo-400'
                }`}
              >
                기본정보
              </button>
              {/* 의료진인 경우 근무패턴 탭 표시 */}
              {isDoctor && (
                <button
                  onClick={() => setActiveTab('pattern')}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    activeTab === 'pattern'
                      ? 'bg-white text-indigo-600'
                      : 'text-indigo-100 hover:bg-indigo-400'
                  }`}
                >
                  근무패턴
                </button>
              )}
              {/* 면담 탭 - 원장/직원 모두 */}
              <button
                onClick={() => setActiveTab('timeline')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'timeline'
                    ? 'bg-white text-indigo-600'
                    : 'text-indigo-100 hover:bg-indigo-400'
                }`}
              >
                {isDoctor ? '급여/면담' : '면담'}
              </button>
              <button
                onClick={() => setActiveTab('leave')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'leave'
                    ? 'bg-white text-indigo-600'
                    : 'text-indigo-100 hover:bg-indigo-400'
                }`}
              >
                휴가
              </button>
            </div>
          )}
        </div>

        {/* 본문 */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* 미등록 의료진: 정보 생성 폼 */}
          {isDoctor && !isRegisteredInSqlite && (
            <UnregisteredDoctorForm
              staff={staff}
              alias={alias}
              setAlias={setAlias}
              dob={dob}
              setDob={setDob}
              gender={gender}
              setGender={setGender}
              consultationRoom={consultationRoom}
              setConsultationRoom={setConsultationRoom}
              permissions={permissions}
              setPermissions={setPermissions}
              profileColor={profileColor}
              setProfileColor={setProfileColor}
            />
          )}

          {/* 등록된 의료진 또는 직원: 탭별 콘텐츠 */}
          {(isRegisteredInSqlite || isNew) && (
            <>
              {/* 기본정보 탭 */}
              {activeTab === 'info' && (
                isDoctor && isRegisteredInSqlite ? (
                  // 등록된 의료진: 의료진 전용 편집 폼
                  <DoctorInfoForm
                    name={name}
                    setName={setName}
                    alias={alias}
                    setAlias={setAlias}
                    dob={dob}
                    setDob={setDob}
                    gender={gender}
                    setGender={setGender}
                    hireDate={hireDate}
                    setHireDate={setHireDate}
                    resignDate={resignDate}
                    setResignDate={setResignDate}
                    consultationRoom={consultationRoom}
                    setConsultationRoom={setConsultationRoom}
                    permissions={permissions}
                    setPermissions={setPermissions}
                    profileColor={profileColor}
                    setProfileColor={setProfileColor}
                    memo={memo}
                    setMemo={setMemo}
                  />
                ) : (
                  // 일반 직원: 기존 편집 폼
                  <BasicInfoForm
                    name={name}
                    setName={setName}
                    phone={phone}
                    setPhone={setPhone}
                    email={email}
                    setEmail={setEmail}
                    position={position}
                    setPosition={setPosition}
                    workPart={workPart}
                    setWorkPart={setWorkPart}
                    dob={dob}
                    setDob={setDob}
                    hireDate={hireDate}
                    setHireDate={setHireDate}
                    profileColor={profileColor}
                    setProfileColor={setProfileColor}
                    memo={memo}
                    setMemo={setMemo}
                    employeeType={employeeType}
                  />
                )
              )}

              {activeTab === 'pattern' && staffIdForData && (
                <WorkPatternSection
                  staffId={staffIdForData}
                  staffName={staff?.name || ''}
                  patterns={workPatterns}
                  onRefresh={loadAdditionalData}
                />
              )}

              {activeTab === 'timeline' && staffIdForData && (
                <TimelineSection
                  staffId={staffIdForData}
                  interviews={salaryInterviews}
                  onRefresh={loadAdditionalData}
                  isDoctor={isDoctor}
                />
              )}

              {activeTab === 'leave' && staffIdForData && (
                <LeaveSection
                  staffId={staffIdForData}
                  records={leaveRecords}
                  onRefresh={loadAdditionalData}
                />
              )}
            </>
          )}
        </div>

        {/* 푸터 */}
        <div className="px-6 py-4 bg-gray-50 border-t flex justify-between flex-shrink-0">
          <div>
            {/* 등록된 직원만 삭제 가능 (의료진은 삭제 불가 - MSSQL에서 관리) */}
            {!isNew && isRegisteredInSqlite && !isDoctor && (
              <button
                onClick={handleDelete}
                className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                disabled={loading}
              >
                <i className="fas fa-trash mr-2"></i>
                삭제
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-6 py-2 text-gray-600 font-medium rounded-lg hover:bg-gray-100 transition-colors"
              disabled={loading}
            >
              {isDoctor && !isRegisteredInSqlite ? '닫기' : '취소'}
            </button>

            {/* 미등록 의료진: 정보 생성 버튼 */}
            {isDoctor && !isRegisteredInSqlite && (
              <button
                onClick={handleCreateDoctor}
                disabled={loading}
                className="px-6 py-2 bg-green-500 text-white font-medium rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <i className="fas fa-spinner fa-spin mr-2"></i>
                    생성 중...
                  </>
                ) : (
                  <>
                    <i className="fas fa-user-plus mr-2"></i>
                    의료진 정보 생성하기
                  </>
                )}
              </button>
            )}

            {/* 등록된 직원/의료진: 저장 버튼 */}
            {activeTab === 'info' && isRegisteredInSqlite && !isNew && (
              <button
                onClick={handleSave}
                disabled={loading}
                className="px-6 py-2 bg-indigo-500 text-white font-medium rounded-lg hover:bg-indigo-600 transition-colors disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <i className="fas fa-spinner fa-spin mr-2"></i>
                    저장 중...
                  </>
                ) : (
                  <>
                    <i className="fas fa-check mr-2"></i>
                    저장
                  </>
                )}
              </button>
            )}

            {/* 새 직원 등록: 저장 버튼 */}
            {isNew && (
              <button
                onClick={handleSave}
                disabled={loading}
                className="px-6 py-2 bg-indigo-500 text-white font-medium rounded-lg hover:bg-indigo-600 transition-colors disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <i className="fas fa-spinner fa-spin mr-2"></i>
                    저장 중...
                  </>
                ) : (
                  <>
                    <i className="fas fa-check mr-2"></i>
                    저장
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// =====================================================
// 기본 정보 폼
// =====================================================

const BasicInfoForm: React.FC<{
  name: string;
  setName: (v: string) => void;
  phone: string;
  setPhone: (v: string) => void;
  email: string;
  setEmail: (v: string) => void;
  position: string;
  setPosition: (v: string) => void;
  workPart: string;
  setWorkPart: (v: string) => void;
  dob: string;
  setDob: (v: string) => void;
  hireDate: string;
  setHireDate: (v: string) => void;
  profileColor: string;
  setProfileColor: (v: string) => void;
  memo: string;
  setMemo: (v: string) => void;
  employeeType: EmployeeType;
}> = ({
  name, setName,
  phone, setPhone,
  email, setEmail,
  position, setPosition,
  workPart, setWorkPart,
  dob, setDob,
  hireDate, setHireDate,
  profileColor, setProfileColor,
  memo, setMemo,
  employeeType
}) => {
  const positionOptions = ['실장', '팀장', '주임', '사원'];

  return (
    <div className="space-y-4">
      {/* 이름 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          이름 <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          placeholder="이름을 입력하세요"
          required
        />
      </div>

      {/* 직책 & 근무파트 */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">직책</label>
          <select
            value={position}
            onChange={(e) => setPosition(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="">선택하세요</option>
            {positionOptions.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">근무 파트</label>
          <select
            value={workPart}
            onChange={(e) => setWorkPart(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="">선택하세요</option>
            <option value="desk">데스크</option>
            <option value="treatment">치료실</option>
            <option value="decoction">탕전실</option>
          </select>
        </div>
      </div>

      {/* 연락처 */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">전화번호</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            placeholder="010-0000-0000"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">이메일</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            placeholder="email@example.com"
          />
        </div>
      </div>

      {/* 생년월일 & 입사일 */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">생년월일</label>
          <input
            type="date"
            value={dob}
            onChange={(e) => setDob(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">입사일</label>
          <input
            type="date"
            value={hireDate}
            onChange={(e) => setHireDate(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
      </div>

      {/* 프로필 색상 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">프로필 색상</label>
        <div className="flex gap-2 flex-wrap">
          {PROFILE_COLORS.map(color => (
            <button
              key={color}
              type="button"
              onClick={() => setProfileColor(color)}
              className={`w-8 h-8 rounded-full transition-transform ${
                profileColor === color ? 'ring-2 ring-offset-2 ring-indigo-500 scale-110' : ''
              }`}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      </div>

      {/* 메모 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">메모</label>
        <textarea
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          rows={3}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
          placeholder="특이사항을 입력하세요"
        />
      </div>
    </div>
  );
};

// =====================================================
// 미등록 의료진 정보 생성 폼
// =====================================================

const UnregisteredDoctorForm: React.FC<{
  staff: StaffMember | null;
  alias: string;
  setAlias: (v: string) => void;
  dob: string;
  setDob: (v: string) => void;
  gender: Gender;
  setGender: (v: Gender) => void;
  consultationRoom: ConsultationRoom | '';
  setConsultationRoom: (v: ConsultationRoom | '') => void;
  permissions: DoctorPermissions;
  setPermissions: (v: DoctorPermissions) => void;
  profileColor: string;
  setProfileColor: (v: string) => void;
}> = ({
  staff,
  alias, setAlias,
  dob, setDob,
  gender, setGender,
  consultationRoom, setConsultationRoom,
  permissions, setPermissions,
  profileColor, setProfileColor
}) => {
  const formatDate = (dateStr?: string | null) => {
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

  return (
    <div className="space-y-6">
      {/* 안내 메시지 */}
      <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
        <div className="flex items-start gap-3">
          <i className="fas fa-exclamation-circle text-orange-500 text-xl mt-0.5"></i>
          <div>
            <h3 className="font-semibold text-orange-800">의료진 정보 생성 필요</h3>
            <p className="text-sm text-orange-700 mt-1">
              이 의료진은 오케이차트(MSSQL)에서 불러왔지만, 아직 직원관리시스템에 등록되지 않았습니다.
              아래 정보를 입력하고 "의료진 정보 생성하기" 버튼을 클릭하세요.
            </p>
          </div>
        </div>
      </div>

      {/* MSSQL에서 가져온 기본정보 (읽기 전용) */}
      <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
        <h4 className="font-semibold text-indigo-800 mb-3">
          <i className="fas fa-database mr-2"></i>
          오케이차트 기본정보
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-gray-500">이름</span>
            <p className="font-medium text-gray-800">{staff?.name || '-'}</p>
          </div>
          <div>
            <span className="text-gray-500">상태</span>
            <p className={`font-medium ${staff?.status === 'active' ? 'text-green-600' : 'text-red-600'}`}>
              {staff?.status === 'active' ? '근무중' : '퇴사'}
            </p>
          </div>
          <div>
            <span className="text-gray-500">입사일</span>
            <p className="font-medium text-gray-800">{formatDate(staff?.hire_date)}</p>
          </div>
          <div>
            <span className="text-gray-500">퇴사일</span>
            <p className="font-medium text-gray-800">{formatDate(staff?.resign_date)}</p>
          </div>
        </div>
      </div>

      {/* 추가 정보 입력 */}
      <div className="space-y-4">
        <h4 className="font-semibold text-gray-800">
          <i className="fas fa-user-edit mr-2"></i>
          추가 정보 입력
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 호칭 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">호칭</label>
            <input
              type="text"
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="예: 김원장, 강원장"
            />
            <p className="text-xs text-gray-500 mt-1">액팅 등에서 사용되는 호칭입니다.</p>
          </div>

          {/* 생년월일 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">생년월일</label>
            <input
              type="date"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          {/* 성별 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">성별</label>
            <div className="flex gap-4">
              {(['male', 'female'] as Gender[]).map((g) => (
                <label key={g} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="gender"
                    checked={gender === g}
                    onChange={() => setGender(g)}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-gray-700">{GENDER_LABELS[g]}</span>
                </label>
              ))}
            </div>
          </div>

          {/* 진료실 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">진료실</label>
            <select
              value={consultationRoom}
              onChange={(e) => setConsultationRoom(e.target.value as ConsultationRoom | '')}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="">선택하세요</option>
              {CONSULTATION_ROOMS.map((room) => (
                <option key={room} value={room}>{room}</option>
              ))}
            </select>
          </div>

          {/* 프로필 색상 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">프로필 색상</label>
            <div className="flex gap-2 flex-wrap">
              {PROFILE_COLORS.map(color => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setProfileColor(color)}
                  className={`w-8 h-8 rounded-full transition-transform ${
                    profileColor === color ? 'ring-2 ring-offset-2 ring-indigo-500 scale-110' : ''
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* 권한 설정 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">접근 권한</label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {(Object.keys(PERMISSION_LABELS) as Array<keyof DoctorPermissions>).map((key) => (
              <label
                key={key}
                className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                  permissions[key] ? 'bg-indigo-50 border-indigo-300' : 'bg-white border-gray-200'
                }`}
              >
                <input
                  type="checkbox"
                  checked={permissions[key]}
                  onChange={(e) => setPermissions({ ...permissions, [key]: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className={`text-sm ${permissions[key] ? 'text-indigo-700 font-medium' : 'text-gray-600'}`}>
                  {PERMISSION_LABELS[key]}
                </span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// =====================================================
// 등록된 의료진 정보 편집 폼
// =====================================================

const DoctorInfoForm: React.FC<{
  name: string;
  setName: (v: string) => void;
  alias: string;
  setAlias: (v: string) => void;
  dob: string;
  setDob: (v: string) => void;
  gender: Gender;
  setGender: (v: Gender) => void;
  hireDate: string;
  setHireDate: (v: string) => void;
  resignDate: string;
  setResignDate: (v: string) => void;
  consultationRoom: ConsultationRoom | '';
  setConsultationRoom: (v: ConsultationRoom | '') => void;
  permissions: DoctorPermissions;
  setPermissions: (v: DoctorPermissions) => void;
  profileColor: string;
  setProfileColor: (v: string) => void;
  memo: string;
  setMemo: (v: string) => void;
}> = ({
  name, setName,
  alias, setAlias,
  dob, setDob,
  gender, setGender,
  hireDate, setHireDate,
  resignDate, setResignDate,
  consultationRoom, setConsultationRoom,
  permissions, setPermissions,
  profileColor, setProfileColor,
  memo, setMemo
}) => {
  return (
    <div className="space-y-6">
      {/* 안내 메시지 */}
      <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg flex items-center gap-2">
        <i className="fas fa-info-circle text-indigo-500"></i>
        <span className="text-sm text-indigo-700">
          기본정보(이름, 입사일, 퇴사일)는 오케이차트(MSSQL)에서 동기화됩니다. 변경 시 다음 로드 시 덮어쓰여질 수 있습니다.
        </span>
      </div>

      {/* 기본 정보 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 이름 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">이름</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-gray-50"
            readOnly
          />
        </div>

        {/* 호칭 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">호칭</label>
          <input
            type="text"
            value={alias}
            onChange={(e) => setAlias(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            placeholder="예: 김원장, 강원장"
          />
          <p className="text-xs text-gray-500 mt-1">액팅 등에서 사용되는 호칭입니다.</p>
        </div>

        {/* 생년월일 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">생년월일</label>
          <input
            type="date"
            value={dob}
            onChange={(e) => setDob(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        {/* 성별 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">성별</label>
          <div className="flex gap-4 py-2">
            {(['male', 'female'] as Gender[]).map((g) => (
              <label key={g} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="gender"
                  checked={gender === g}
                  onChange={() => setGender(g)}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-gray-700">{GENDER_LABELS[g]}</span>
              </label>
            ))}
          </div>
        </div>

        {/* 진료실 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">진료실</label>
          <select
            value={consultationRoom}
            onChange={(e) => setConsultationRoom(e.target.value as ConsultationRoom | '')}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="">선택하세요</option>
            {CONSULTATION_ROOMS.map((room) => (
              <option key={room} value={room}>{room}</option>
            ))}
          </select>
        </div>

        {/* 입사일 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">입사일</label>
          <input
            type="date"
            value={hireDate}
            onChange={(e) => setHireDate(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-gray-50"
            readOnly
          />
        </div>

        {/* 퇴사일 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">퇴사일</label>
          <input
            type="date"
            value={resignDate}
            onChange={(e) => setResignDate(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-gray-50"
            readOnly
          />
          <p className="text-xs text-gray-500 mt-1">퇴사일은 오케이차트에서 관리됩니다.</p>
        </div>
      </div>

      {/* 권한 설정 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">접근 권한</label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(Object.keys(PERMISSION_LABELS) as Array<keyof DoctorPermissions>).map((key) => (
            <label
              key={key}
              className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                permissions[key] ? 'bg-indigo-50 border-indigo-300' : 'bg-white border-gray-200'
              }`}
            >
              <input
                type="checkbox"
                checked={permissions[key]}
                onChange={(e) => setPermissions({ ...permissions, [key]: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className={`text-sm ${permissions[key] ? 'text-indigo-700 font-medium' : 'text-gray-600'}`}>
                {PERMISSION_LABELS[key]}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* 프로필 색상 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">프로필 색상</label>
        <div className="flex gap-2 flex-wrap">
          {PROFILE_COLORS.map(color => (
            <button
              key={color}
              type="button"
              onClick={() => setProfileColor(color)}
              className={`w-8 h-8 rounded-full transition-transform ${
                profileColor === color ? 'ring-2 ring-offset-2 ring-indigo-500 scale-110' : ''
              }`}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      </div>

      {/* 메모 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">메모</label>
        <textarea
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          rows={3}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
          placeholder="특이사항을 입력하세요"
        />
      </div>
    </div>
  );
};

// =====================================================
// 근무 패턴 섹션 (원장용) - Settings.tsx 스타일
// =====================================================

const WorkPatternSection: React.FC<{
  staffId: number;
  staffName: string;
  patterns: WorkPattern[];
  onRefresh: () => void;
}> = ({ staffId, patterns, onRefresh }) => {
  const [showForm, setShowForm] = useState(false);
  const [editingPatternId, setEditingPatternId] = useState<number | null>(null);

  // 패턴 폼 상태 - Settings.tsx 스타일
  const [patternName, setPatternName] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState('');
  const [dayEnabled, setDayEnabled] = useState<boolean[]>([false, false, false, false, false, false, false]);
  const [dayTimes, setDayTimes] = useState<{ start: string; end: string }[]>(
    Array(7).fill(null).map(() => ({ start: '09:00', end: '18:00' }))
  );

  // 요일 토글 - 체크 시 기본 시간 설정
  function handleDayToggle(dayIndex: number) {
    const newEnabled = [...dayEnabled];
    newEnabled[dayIndex] = !newEnabled[dayIndex];
    setDayEnabled(newEnabled);
  }

  function handleDayTimeChange(dayIndex: number, field: 'start' | 'end', value: string) {
    const newDayTimes = [...dayTimes];
    newDayTimes[dayIndex] = { ...newDayTimes[dayIndex], [field]: value };
    setDayTimes(newDayTimes);
  }

  // 패턴 편집 시작
  function handleEditPattern(pattern: WorkPattern) {
    setEditingPatternId(pattern.id);
    setPatternName(pattern.pattern_name || '');
    setStartDate(pattern.start_date);
    setEndDate(pattern.end_date || '');

    // 요일별 활성화 및 시간 설정
    const dayKeys = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
    const enabled: boolean[] = [];
    const times: { start: string; end: string }[] = [];

    dayKeys.forEach((key) => {
      const start = pattern[`${key}_start` as keyof WorkPattern] as string;
      const end = pattern[`${key}_end` as keyof WorkPattern] as string;
      enabled.push(!!start && !!end);
      times.push({ start: start || '09:00', end: end || '18:00' });
    });

    setDayEnabled(enabled);
    setDayTimes(times);
    setShowForm(true);
  }

  async function handleSavePattern() {
    if (!startDate) {
      alert('적용일을 입력해주세요.');
      return;
    }
    if (!dayEnabled.some(d => d)) {
      alert('근무 요일을 하나 이상 선택해주세요.');
      return;
    }

    const patternData = {
      staff_id: staffId,
      pattern_name: patternName || undefined,
      start_date: startDate,
      end_date: endDate || undefined,
      mon_start: dayEnabled[0] ? dayTimes[0].start : undefined,
      mon_end: dayEnabled[0] ? dayTimes[0].end : undefined,
      tue_start: dayEnabled[1] ? dayTimes[1].start : undefined,
      tue_end: dayEnabled[1] ? dayTimes[1].end : undefined,
      wed_start: dayEnabled[2] ? dayTimes[2].start : undefined,
      wed_end: dayEnabled[2] ? dayTimes[2].end : undefined,
      thu_start: dayEnabled[3] ? dayTimes[3].start : undefined,
      thu_end: dayEnabled[3] ? dayTimes[3].end : undefined,
      fri_start: dayEnabled[4] ? dayTimes[4].start : undefined,
      fri_end: dayEnabled[4] ? dayTimes[4].end : undefined,
      sat_start: dayEnabled[5] ? dayTimes[5].start : undefined,
      sat_end: dayEnabled[5] ? dayTimes[5].end : undefined,
      sun_start: dayEnabled[6] ? dayTimes[6].start : undefined,
      sun_end: dayEnabled[6] ? dayTimes[6].end : undefined
    };

    try {
      if (editingPatternId) {
        await updateWorkPattern(editingPatternId, patternData);
        alert('근무 패턴이 수정되었습니다.');
      } else {
        await createWorkPattern(patternData);
        alert('근무 패턴이 저장되었습니다.');
      }
      setShowForm(false);
      resetForm();
      onRefresh();
    } catch (error) {
      console.error('저장 실패:', error);
      alert('저장에 실패했습니다.');
    }
  }

  async function handleDeletePattern(id: number) {
    if (!confirm('이 근무 패턴을 삭제하시겠습니까?')) return;
    try {
      await deleteWorkPattern(id);
      onRefresh();
    } catch (error) {
      console.error('삭제 실패:', error);
      alert('삭제에 실패했습니다.');
    }
  }

  function resetForm() {
    setPatternName('');
    setStartDate(new Date().toISOString().split('T')[0]);
    setEndDate('');
    setDayEnabled([false, false, false, false, false, false, false]);
    setDayTimes(Array(7).fill(null).map(() => ({ start: '09:00', end: '18:00' })));
    setEditingPatternId(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-800">근무 패턴 관리</h3>
        {!showForm && (
          <button
            onClick={() => { resetForm(); setShowForm(true); }}
            className="px-3 py-1.5 bg-indigo-100 text-indigo-600 rounded-lg text-sm font-medium hover:bg-indigo-200"
          >
            <i className="fas fa-plus mr-1"></i>
            패턴 추가
          </button>
        )}
      </div>

      {/* 패턴 입력 폼 - Settings.tsx 스타일 */}
      {showForm && (
        <div className="p-4 border-2 border-dashed border-indigo-300 rounded-lg bg-indigo-50/50">
          <div className="space-y-4">
            {/* 패턴명 */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">패턴명 (선택)</label>
              <input
                type="text"
                value={patternName}
                onChange={(e) => setPatternName(e.target.value)}
                placeholder="예: 정규 근무, 야간 근무"
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>

            {/* 요일별 근무시간 - Settings.tsx 스타일 인라인 체크박스 */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-2">근무 요일 및 시간</label>
              <div className="space-y-2">
                {DAY_NAMES.map((day, index) => (
                  <div
                    key={day}
                    className={`flex items-center gap-3 p-2 border rounded-md transition-colors ${
                      dayEnabled[index] ? 'bg-blue-50 border-blue-400' : 'bg-white border-gray-200'
                    }`}
                  >
                    <label className="flex items-center min-w-[60px] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={dayEnabled[index]}
                        onChange={() => handleDayToggle(index)}
                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className={`ml-2 text-sm font-medium ${
                        index === 5 ? 'text-blue-600' : index === 6 ? 'text-red-600' : 'text-gray-700'
                      }`}>
                        {day}
                      </span>
                    </label>
                    {dayEnabled[index] && (
                      <div className="flex items-center gap-2 flex-1">
                        <input
                          type="time"
                          value={dayTimes[index].start}
                          onChange={(e) => handleDayTimeChange(index, 'start', e.target.value)}
                          className="px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                        <span className="text-gray-500">~</span>
                        <input
                          type="time"
                          value={dayTimes[index].end}
                          onChange={(e) => handleDayTimeChange(index, 'end', e.target.value)}
                          className="px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* 적용 기간 */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">적용일 *</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">종료일</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  placeholder="미입력 시 현재까지"
                />
              </div>
            </div>

            {/* 버튼 */}
            <div className="flex gap-2 justify-end pt-2">
              <button
                onClick={() => { setShowForm(false); resetForm(); }}
                className="px-4 py-2 text-gray-600 text-sm font-medium hover:bg-gray-100 rounded-lg transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleSavePattern}
                className="px-4 py-2 bg-indigo-500 text-white text-sm font-medium rounded-lg hover:bg-indigo-600 transition-colors"
              >
                <i className={`fas ${editingPatternId ? 'fa-check' : 'fa-plus'} mr-1`}></i>
                {editingPatternId ? '수정 완료' : '패턴 추가'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 패턴 목록 */}
      {patterns.length === 0 && !showForm ? (
        <div className="text-center py-8 text-gray-500">
          <i className="fas fa-calendar-times text-4xl text-gray-300 mb-2"></i>
          <p>등록된 근무 패턴이 없습니다.</p>
          <p className="text-sm text-gray-400 mt-1">상단의 "패턴 추가" 버튼을 클릭하세요.</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {patterns.map(pattern => {
            const dayKeys = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
            const isEditing = editingPatternId === pattern.id;

            return (
              <div
                key={pattern.id}
                className={`p-3 rounded-lg border transition-colors ${
                  isEditing ? 'bg-blue-50 border-blue-400' : 'bg-white border-gray-200'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {pattern.pattern_name && (
                        <span className="font-medium text-gray-800">{pattern.pattern_name}</span>
                      )}
                      <span className="text-xs text-gray-500">
                        {pattern.start_date} ~ {pattern.end_date || '현재'}
                      </span>
                    </div>
                    <div className="space-y-0.5">
                      {dayKeys.map((key, index) => {
                        const start = pattern[`${key}_start` as keyof WorkPattern] as string;
                        const end = pattern[`${key}_end` as keyof WorkPattern] as string;
                        if (!start || !end) return null;
                        return (
                          <div key={key} className="flex items-center gap-2 text-sm">
                            <span className={`font-medium w-6 ${
                              index === 5 ? 'text-blue-600' : index === 6 ? 'text-red-600' : 'text-gray-700'
                            }`}>
                              {DAY_NAMES[index]}
                            </span>
                            <span className="text-gray-600">{start} ~ {end}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleEditPattern(pattern)}
                      className={`px-2 py-1 ${isEditing ? 'text-blue-600' : 'text-gray-400 hover:text-blue-500'}`}
                      disabled={isEditing}
                    >
                      <i className="fas fa-pen text-sm"></i>
                    </button>
                    <button
                      onClick={() => handleDeletePattern(pattern.id)}
                      className="px-2 py-1 text-gray-400 hover:text-red-500"
                    >
                      <i className="fas fa-trash text-sm"></i>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// =====================================================
// 급여/면담 타임라인 섹션
// =====================================================

const TimelineSection: React.FC<{
  staffId: number;
  interviews: SalaryInterview[];
  onRefresh: () => void;
  isDoctor?: boolean;
}> = ({ staffId, interviews, onRefresh, isDoctor = false }) => {
  const [showForm, setShowForm] = useState(false);

  const eventIcons: Record<string, string> = {
    salary_change: 'fa-coins',
    interview: 'fa-comments',
    contract: 'fa-file-signature',
    bonus: 'fa-gift',
    other: 'fa-sticky-note'
  };

  const eventColors: Record<string, string> = {
    salary_change: 'bg-green-500',
    interview: 'bg-blue-500',
    contract: 'bg-purple-500',
    bonus: 'bg-yellow-500',
    other: 'bg-gray-500'
  };

  async function handleDeleteEvent(id: number) {
    if (!confirm('이 기록을 삭제하시겠습니까?')) return;
    try {
      await deleteSalaryInterview(id);
      onRefresh();
    } catch (error) {
      console.error('삭제 실패:', error);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-800">
          {isDoctor ? '급여/면담 타임라인' : '면담 기록'}
        </h3>
        <button
          onClick={() => setShowForm(true)}
          className="px-3 py-1.5 bg-indigo-100 text-indigo-600 rounded-lg text-sm font-medium hover:bg-indigo-200"
        >
          <i className="fas fa-plus mr-1"></i>
          기록 추가
        </button>
      </div>

      {/* 타임라인 */}
      {interviews.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <i className="fas fa-history text-4xl text-gray-300 mb-2"></i>
          <p>등록된 기록이 없습니다.</p>
        </div>
      ) : (
        <div className="relative">
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200"></div>
          <div className="space-y-4">
            {interviews.map(event => (
              <div key={event.id} className="relative pl-10">
                <div className={`absolute left-2 w-5 h-5 rounded-full ${eventColors[event.event_type]} flex items-center justify-center`}>
                  <i className={`fas ${eventIcons[event.event_type]} text-white text-xs`}></i>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg border group">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-xs text-gray-500">{event.event_date}</span>
                      <h4 className="font-medium text-gray-800">
                        {event.title || SALARY_EVENT_LABELS[event.event_type]}
                      </h4>
                    </div>
                    <button
                      onClick={() => handleDeleteEvent(event.id)}
                      className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity"
                    >
                      <i className="fas fa-times"></i>
                    </button>
                  </div>
                  {event.salary_amount && (
                    <p className="text-sm text-green-600 font-medium mt-1">
                      {event.salary_amount.toLocaleString()}원
                      {event.previous_amount && (
                        <span className="text-gray-400 text-xs ml-2">
                          (이전: {event.previous_amount.toLocaleString()}원)
                        </span>
                      )}
                    </p>
                  )}
                  {event.description && (
                    <p className="text-sm text-gray-600 mt-1">{event.description}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 새 기록 폼 */}
      {showForm && (
        <TimelineAddForm
          staffId={staffId}
          onClose={() => setShowForm(false)}
          onSuccess={() => { setShowForm(false); onRefresh(); }}
          isDoctor={isDoctor}
        />
      )}
    </div>
  );
};

const TimelineAddForm: React.FC<{
  staffId: number;
  onClose: () => void;
  onSuccess: () => void;
  isDoctor?: boolean;
}> = ({ staffId, onClose, onSuccess, isDoctor = false }) => {
  const [eventType, setEventType] = useState<SalaryInterview['event_type']>('interview');
  const [eventDate, setEventDate] = useState(new Date().toISOString().split('T')[0]);
  const [title, setTitle] = useState('');
  const [salaryAmount, setSalaryAmount] = useState('');
  const [description, setDescription] = useState('');

  async function handleSubmit() {
    if (!eventDate) {
      alert('날짜를 입력해주세요.');
      return;
    }

    try {
      await createSalaryInterview({
        staff_id: staffId,
        event_type: eventType,
        event_date: eventDate,
        title: title || undefined,
        salary_amount: salaryAmount ? parseInt(salaryAmount) : undefined,
        description: description || undefined
      });
      onSuccess();
    } catch (error) {
      console.error('저장 실패:', error);
      alert('저장에 실패했습니다.');
    }
  }

  return (
    <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-200">
      <h4 className="font-medium text-indigo-800 mb-3">새 기록</h4>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-600 mb-1">유형</label>
            <select
              value={eventType}
              onChange={(e) => setEventType(e.target.value as any)}
              className="w-full px-3 py-2 border rounded-lg text-sm"
            >
              {Object.entries(SALARY_EVENT_LABELS)
                .filter(([key]) => isDoctor || !['salary_change', 'bonus'].includes(key))
                .map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">날짜</label>
            <input
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm"
            />
          </div>
        </div>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="제목 (선택)"
          className="w-full px-3 py-2 border rounded-lg text-sm"
        />
        {eventType === 'salary_change' && (
          <input
            type="number"
            value={salaryAmount}
            onChange={(e) => setSalaryAmount(e.target.value)}
            placeholder="급여 금액"
            className="w-full px-3 py-2 border rounded-lg text-sm"
          />
        )}
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="상세 내용"
          rows={2}
          className="w-full px-3 py-2 border rounded-lg text-sm resize-none"
        />
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-3 py-1.5 text-gray-600 text-sm hover:bg-gray-100 rounded">
            취소
          </button>
          <button onClick={handleSubmit} className="px-3 py-1.5 bg-indigo-500 text-white text-sm rounded hover:bg-indigo-600">
            저장
          </button>
        </div>
      </div>
    </div>
  );
};

// =====================================================
// 휴가 섹션
// =====================================================

const LeaveSection: React.FC<{
  staffId: number;
  records: LeaveRecord[];
  onRefresh: () => void;
}> = ({ staffId, records, onRefresh }) => {
  const [showForm, setShowForm] = useState(false);

  async function handleDeleteLeave(id: number) {
    if (!confirm('이 휴가 기록을 삭제하시겠습니까?')) return;
    try {
      await deleteLeaveRecord(id);
      onRefresh();
    } catch (error) {
      console.error('삭제 실패:', error);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-800">휴가 기록</h3>
        <button
          onClick={() => setShowForm(true)}
          className="px-3 py-1.5 bg-indigo-100 text-indigo-600 rounded-lg text-sm font-medium hover:bg-indigo-200"
        >
          <i className="fas fa-plus mr-1"></i>
          휴가 추가
        </button>
      </div>

      {records.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <i className="fas fa-umbrella-beach text-4xl text-gray-300 mb-2"></i>
          <p>등록된 휴가가 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {records.map(leave => (
            <div key={leave.id} className="p-3 bg-gray-50 rounded-lg border flex items-center justify-between group">
              <div>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                  leave.leave_type === 'annual' ? 'bg-blue-100 text-blue-700' :
                  leave.leave_type === 'sick' ? 'bg-red-100 text-red-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {LEAVE_TYPE_LABELS[leave.leave_type]}
                </span>
                <span className="ml-2 text-sm text-gray-800">
                  {leave.start_date} ~ {leave.end_date}
                </span>
                {leave.days_count && (
                  <span className="ml-2 text-sm text-gray-500">
                    ({leave.days_count}일)
                  </span>
                )}
              </div>
              <button
                onClick={() => handleDeleteLeave(leave.id)}
                className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 휴가 추가 폼 */}
      {showForm && (
        <LeaveAddForm
          staffId={staffId}
          onClose={() => setShowForm(false)}
          onSuccess={() => { setShowForm(false); onRefresh(); }}
        />
      )}
    </div>
  );
};

const LeaveAddForm: React.FC<{
  staffId: number;
  onClose: () => void;
  onSuccess: () => void;
}> = ({ staffId, onClose, onSuccess }) => {
  const [leaveType, setLeaveType] = useState<LeaveRecord['leave_type']>('annual');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [reason, setReason] = useState('');

  async function handleSubmit() {
    if (!startDate || !endDate) {
      alert('날짜를 입력해주세요.');
      return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    try {
      await createLeaveRecord({
        staff_id: staffId,
        leave_type: leaveType,
        start_date: startDate,
        end_date: endDate,
        days_count: days,
        reason: reason || undefined,
        status: 'approved'
      });
      onSuccess();
    } catch (error) {
      console.error('저장 실패:', error);
      alert('저장에 실패했습니다.');
    }
  }

  return (
    <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-200">
      <h4 className="font-medium text-indigo-800 mb-3">휴가 추가</h4>
      <div className="space-y-3">
        <div>
          <label className="block text-xs text-gray-600 mb-1">휴가 유형</label>
          <select
            value={leaveType}
            onChange={(e) => setLeaveType(e.target.value as any)}
            className="w-full px-3 py-2 border rounded-lg text-sm"
          >
            {Object.entries(LEAVE_TYPE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-600 mb-1">시작일</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">종료일</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm"
            />
          </div>
        </div>
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="사유 (선택)"
          className="w-full px-3 py-2 border rounded-lg text-sm"
        />
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-3 py-1.5 text-gray-600 text-sm hover:bg-gray-100 rounded">
            취소
          </button>
          <button onClick={handleSubmit} className="px-3 py-1.5 bg-indigo-500 text-white text-sm rounded hover:bg-indigo-600">
            저장
          </button>
        </div>
      </div>
    </div>
  );
};

export default StaffDetailModal;
