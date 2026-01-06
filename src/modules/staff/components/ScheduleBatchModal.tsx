/**
 * 근무일정 일괄입력 모달
 * - Method A: 그리드 뷰 (직접 셀 클릭/드래그)
 * - Method B: 패턴 템플릿 (템플릿 선택 후 적용)
 * - Method C: 퀵 입력 (빠른 키보드 입력)
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { StaffMember, ShiftType, WorkSchedule, ScheduleTemplate, BatchScheduleChange } from '../types';
import { SHIFT_TYPE_LABELS, SHIFT_COLORS, DAY_NAMES } from '../types';
import {
  fetchMonthlySchedules,
  fetchScheduleTemplates,
  batchUpdateSchedules,
  upsertSchedule,
  applyTemplateToStaff
} from '../api/staffApi';
import { getCurrentDate } from '@shared/lib/postgres';

interface ScheduleBatchModalProps {
  staffList: StaffMember[];
  onClose: () => void;
  onSuccess: () => void;
}

type InputMethod = 'grid' | 'template' | 'quick';

const ScheduleBatchModal: React.FC<ScheduleBatchModalProps> = ({
  staffList,
  onClose,
  onSuccess
}) => {
  const [activeMethod, setActiveMethod] = useState<InputMethod>('grid');
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  });
  const [schedules, setSchedules] = useState<Map<string, WorkSchedule>>(new Map());
  const [templates, setTemplates] = useState<ScheduleTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // 변경사항 추적
  const [changes, setChanges] = useState<Map<string, ShiftType>>(new Map());

  // 데이터 로드
  useEffect(() => {
    loadData();
  }, [currentMonth.year, currentMonth.month]);

  async function loadData() {
    setLoading(true);
    try {
      const [scheduleData, templateData] = await Promise.all([
        fetchMonthlySchedules(currentMonth.year, currentMonth.month),
        fetchScheduleTemplates()
      ]);

      const scheduleMap = new Map<string, WorkSchedule>();
      scheduleData.forEach(s => {
        scheduleMap.set(`${s.staff_id}_${s.work_date}`, s);
      });
      setSchedules(scheduleMap);
      setTemplates(templateData);
      setChanges(new Map());
    } catch (error) {
      console.error('데이터 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  }

  // 월 변경
  function handleMonthChange(delta: number) {
    setCurrentMonth(prev => {
      let newMonth = prev.month + delta;
      let newYear = prev.year;

      if (newMonth > 12) {
        newMonth = 1;
        newYear++;
      } else if (newMonth < 1) {
        newMonth = 12;
        newYear--;
      }

      return { year: newYear, month: newMonth };
    });
  }

  // 변경사항 저장
  async function handleSave() {
    if (changes.size === 0) {
      alert('변경사항이 없습니다.');
      return;
    }

    setSaving(true);
    try {
      const batchChanges: BatchScheduleChange[] = [];
      changes.forEach((shiftType, key) => {
        const [staffId, date] = key.split('_');
        batchChanges.push({
          staff_id: parseInt(staffId),
          work_date: date,
          shift_type: shiftType,
          action: shiftType === 'off' ? 'delete' : 'update'
        });
      });

      await batchUpdateSchedules(batchChanges);
      alert(`${changes.size}건의 스케줄이 저장되었습니다.`);
      onSuccess();
    } catch (error) {
      console.error('저장 실패:', error);
      alert('저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  // 셀 시프트 가져오기 (변경사항 우선)
  function getShiftType(staffId: number, date: string): ShiftType {
    const key = `${staffId}_${date}`;
    if (changes.has(key)) {
      return changes.get(key)!;
    }
    const schedule = schedules.get(key);
    return schedule?.shift_type || 'off';
  }

  // 셀 변경
  function handleCellChange(staffId: number, date: string, shiftType: ShiftType) {
    const key = `${staffId}_${date}`;
    const newChanges = new Map(changes);
    newChanges.set(key, shiftType);
    setChanges(newChanges);
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[95vh] overflow-hidden flex flex-col">
        {/* 헤더 */}
        <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 px-6 py-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">근무일정 일괄입력</h2>
              <p className="text-indigo-200 text-sm">
                {currentMonth.year}년 {currentMonth.month}월 | {staffList.length}명의 직원
              </p>
            </div>
            <div className="flex items-center gap-4">
              {/* 월 네비게이션 */}
              <div className="flex items-center gap-2 bg-indigo-400 rounded-lg p-1">
                <button
                  onClick={() => handleMonthChange(-1)}
                  className="w-8 h-8 flex items-center justify-center text-white hover:bg-indigo-500 rounded"
                >
                  <i className="fas fa-chevron-left"></i>
                </button>
                <span className="text-white font-medium px-2">
                  {currentMonth.year}.{String(currentMonth.month).padStart(2, '0')}
                </span>
                <button
                  onClick={() => handleMonthChange(1)}
                  className="w-8 h-8 flex items-center justify-center text-white hover:bg-indigo-500 rounded"
                >
                  <i className="fas fa-chevron-right"></i>
                </button>
              </div>
              <button
                onClick={onClose}
                className="text-white hover:text-indigo-200 transition-colors"
              >
                <i className="fas fa-times text-xl"></i>
              </button>
            </div>
          </div>

          {/* 입력 방식 탭 */}
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => setActiveMethod('grid')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                activeMethod === 'grid'
                  ? 'bg-white text-indigo-600'
                  : 'text-indigo-100 hover:bg-indigo-400'
              }`}
            >
              <i className="fas fa-table"></i>
              그리드 뷰
              <span className="text-xs px-1.5 py-0.5 bg-indigo-200 text-indigo-700 rounded">A</span>
            </button>
            <button
              onClick={() => setActiveMethod('template')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                activeMethod === 'template'
                  ? 'bg-white text-indigo-600'
                  : 'text-indigo-100 hover:bg-indigo-400'
              }`}
            >
              <i className="fas fa-copy"></i>
              패턴 템플릿
              <span className="text-xs px-1.5 py-0.5 bg-indigo-200 text-indigo-700 rounded">B</span>
            </button>
            <button
              onClick={() => setActiveMethod('quick')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                activeMethod === 'quick'
                  ? 'bg-white text-indigo-600'
                  : 'text-indigo-100 hover:bg-indigo-400'
              }`}
            >
              <i className="fas fa-keyboard"></i>
              퀵 입력
              <span className="text-xs px-1.5 py-0.5 bg-indigo-200 text-indigo-700 rounded">C</span>
            </button>
          </div>
        </div>

        {/* 본문 */}
        <div className="flex-1 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <i className="fas fa-spinner fa-spin text-4xl text-indigo-500 mb-4"></i>
                <p className="text-gray-500">스케줄을 불러오는 중...</p>
              </div>
            </div>
          ) : (
            <>
              {activeMethod === 'grid' && (
                <GridInputView
                  staffList={staffList}
                  year={currentMonth.year}
                  month={currentMonth.month}
                  getShiftType={getShiftType}
                  onCellChange={handleCellChange}
                  changes={changes}
                />
              )}
              {activeMethod === 'template' && (
                <TemplateInputView
                  staffList={staffList}
                  templates={templates}
                  year={currentMonth.year}
                  month={currentMonth.month}
                  onApplyTemplate={(staffId, template) => {
                    const startDate = `${currentMonth.year}-${String(currentMonth.month).padStart(2, '0')}-01`;
                    const lastDay = new Date(currentMonth.year, currentMonth.month, 0).getDate();
                    const endDate = `${currentMonth.year}-${String(currentMonth.month).padStart(2, '0')}-${lastDay}`;

                    // 템플릿 적용 (로컬 변경사항에 반영)
                    const dayShifts: ShiftType[] = [
                      template.mon_shift,
                      template.tue_shift,
                      template.wed_shift,
                      template.thu_shift,
                      template.fri_shift,
                      template.sat_shift,
                      template.sun_shift
                    ];

                    const newChanges = new Map(changes);
                    const start = new Date(startDate);
                    const end = new Date(endDate);
                    const current = new Date(start);

                    while (current <= end) {
                      const dayOfWeek = current.getDay();
                      const adjustedDay = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
                      const shiftType = dayShifts[adjustedDay];
                      const dateStr = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`;
                      newChanges.set(`${staffId}_${dateStr}`, shiftType);
                      current.setDate(current.getDate() + 1);
                    }

                    setChanges(newChanges);
                  }}
                />
              )}
              {activeMethod === 'quick' && (
                <QuickInputView
                  staffList={staffList}
                  year={currentMonth.year}
                  month={currentMonth.month}
                  changes={changes}
                  onBatchChange={(newChanges) => {
                    const merged = new Map(changes);
                    newChanges.forEach((v, k) => merged.set(k, v));
                    setChanges(merged);
                  }}
                />
              )}
            </>
          )}
        </div>

        {/* 푸터 */}
        <div className="px-6 py-4 bg-gray-50 border-t flex items-center justify-between flex-shrink-0">
          <div className="text-sm text-gray-600">
            {changes.size > 0 && (
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></span>
                {changes.size}건의 변경사항
              </span>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-6 py-2 text-gray-600 font-medium rounded-lg hover:bg-gray-100 transition-colors"
              disabled={saving}
            >
              취소
            </button>
            <button
              onClick={handleSave}
              disabled={saving || changes.size === 0}
              className="px-6 py-2 bg-indigo-500 text-white font-medium rounded-lg hover:bg-indigo-600 transition-colors disabled:opacity-50"
            >
              {saving ? (
                <>
                  <i className="fas fa-spinner fa-spin mr-2"></i>
                  저장 중...
                </>
              ) : (
                <>
                  <i className="fas fa-save mr-2"></i>
                  저장 ({changes.size}건)
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// =====================================================
// Method A: 그리드 뷰
// =====================================================

const GridInputView: React.FC<{
  staffList: StaffMember[];
  year: number;
  month: number;
  getShiftType: (staffId: number, date: string) => ShiftType;
  onCellChange: (staffId: number, date: string, shiftType: ShiftType) => void;
  changes: Map<string, ShiftType>;
}> = ({ staffList, year, month, getShiftType, onCellChange, changes }) => {
  const [selectedShift, setSelectedShift] = useState<ShiftType>('full');
  const [isDragging, setIsDragging] = useState(false);

  // 해당 월의 날짜들 생성
  const days = useMemo(() => {
    const result: { date: Date; dateStr: string; dayOfWeek: number }[] = [];
    const lastDay = new Date(year, month, 0).getDate();

    for (let d = 1; d <= lastDay; d++) {
      const date = new Date(year, month - 1, d);
      result.push({
        date,
        dateStr: `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
        dayOfWeek: date.getDay()
      });
    }
    return result;
  }, [year, month]);

  // 셀 클릭/드래그
  function handleCellMouseDown(staffId: number, dateStr: string) {
    setIsDragging(true);
    onCellChange(staffId, dateStr, selectedShift);
  }

  function handleCellMouseEnter(staffId: number, dateStr: string) {
    if (isDragging) {
      onCellChange(staffId, dateStr, selectedShift);
    }
  }

  function handleMouseUp() {
    setIsDragging(false);
  }

  useEffect(() => {
    document.addEventListener('mouseup', handleMouseUp);
    return () => document.removeEventListener('mouseup', handleMouseUp);
  }, []);

  // 시프트 라벨 축약
  const shiftLabels: Record<ShiftType, string> = {
    full: '풀',
    am: '오전',
    pm: '오후',
    off: '-',
    half_am: 'ㅎ오전',
    half_pm: 'ㅎ오후'
  };

  return (
    <div className="h-full flex flex-col">
      {/* 시프트 선택 팔레트 */}
      <div className="px-4 py-3 bg-gray-50 border-b flex items-center gap-2">
        <span className="text-sm text-gray-600 mr-2">선택된 시프트:</span>
        {(Object.keys(SHIFT_TYPE_LABELS) as ShiftType[]).map(shift => (
          <button
            key={shift}
            onClick={() => setSelectedShift(shift)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border-2 transition-all ${
              selectedShift === shift
                ? `${SHIFT_COLORS[shift]} border-current scale-105`
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
            }`}
          >
            {SHIFT_TYPE_LABELS[shift]}
          </button>
        ))}
        <div className="ml-auto text-xs text-gray-500">
          <i className="fas fa-info-circle mr-1"></i>
          셀을 클릭하거나 드래그하세요
        </div>
      </div>

      {/* 그리드 */}
      <div className="flex-1 overflow-auto p-4">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 bg-white z-10">
            <tr>
              <th className="p-2 border bg-gray-100 text-sm font-medium text-gray-700 sticky left-0 z-20 min-w-[100px]">
                직원
              </th>
              {days.map(({ date, dateStr, dayOfWeek }) => (
                <th
                  key={dateStr}
                  className={`p-1 border text-xs font-medium min-w-[40px] ${
                    dayOfWeek === 0 ? 'bg-red-50 text-red-600' :
                    dayOfWeek === 6 ? 'bg-blue-50 text-blue-600' :
                    'bg-gray-100 text-gray-700'
                  }`}
                >
                  <div>{date.getDate()}</div>
                  <div className="text-[10px] text-gray-400">
                    {['일', '월', '화', '수', '목', '금', '토'][dayOfWeek]}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {staffList.map(staff => (
              <tr key={staff.id} className="hover:bg-gray-50">
                <td className="p-2 border bg-white sticky left-0 z-10">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: staff.profile_color }}
                    ></span>
                    <span className="text-sm font-medium text-gray-800 truncate">
                      {staff.name}
                    </span>
                  </div>
                </td>
                {days.map(({ dateStr, dayOfWeek }) => {
                  const shiftType = getShiftType(staff.id, dateStr);
                  const isChanged = changes.has(`${staff.id}_${dateStr}`);

                  return (
                    <td
                      key={dateStr}
                      className={`p-0 border text-center cursor-pointer select-none transition-colors ${
                        dayOfWeek === 0 ? 'bg-red-50/50' :
                        dayOfWeek === 6 ? 'bg-blue-50/50' : ''
                      }`}
                      onMouseDown={() => handleCellMouseDown(staff.id, dateStr)}
                      onMouseEnter={() => handleCellMouseEnter(staff.id, dateStr)}
                    >
                      <div
                        className={`m-0.5 px-1 py-1 rounded text-xs font-medium ${SHIFT_COLORS[shiftType]} ${
                          isChanged ? 'ring-2 ring-orange-400' : ''
                        }`}
                      >
                        {shiftLabels[shiftType]}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// =====================================================
// Method B: 패턴 템플릿
// =====================================================

const TemplateInputView: React.FC<{
  staffList: StaffMember[];
  templates: ScheduleTemplate[];
  year: number;
  month: number;
  onApplyTemplate: (staffId: number, template: ScheduleTemplate) => void;
}> = ({ staffList, templates, year, month, onApplyTemplate }) => {
  const [selectedTemplate, setSelectedTemplate] = useState<ScheduleTemplate | null>(
    templates.find(t => t.is_default) || templates[0] || null
  );
  const [selectedStaff, setSelectedStaff] = useState<number[]>([]);

  function handleToggleStaff(staffId: number) {
    setSelectedStaff(prev =>
      prev.includes(staffId)
        ? prev.filter(id => id !== staffId)
        : [...prev, staffId]
    );
  }

  function handleSelectAll() {
    if (selectedStaff.length === staffList.length) {
      setSelectedStaff([]);
    } else {
      setSelectedStaff(staffList.map(s => s.id));
    }
  }

  function handleApply() {
    if (!selectedTemplate) {
      alert('템플릿을 선택해주세요.');
      return;
    }
    if (selectedStaff.length === 0) {
      alert('적용할 직원을 선택해주세요.');
      return;
    }

    selectedStaff.forEach(staffId => {
      onApplyTemplate(staffId, selectedTemplate);
    });

    alert(`${selectedStaff.length}명에게 "${selectedTemplate.template_name}" 템플릿이 적용되었습니다.`);
  }

  return (
    <div className="h-full flex">
      {/* 템플릿 목록 */}
      <div className="w-80 border-r bg-gray-50 p-4 overflow-y-auto">
        <h3 className="font-semibold text-gray-800 mb-3">패턴 템플릿</h3>
        <div className="space-y-2">
          {templates.length === 0 ? (
            <p className="text-sm text-gray-500">등록된 템플릿이 없습니다.</p>
          ) : (
            templates.map(template => (
              <div
                key={template.id}
                onClick={() => setSelectedTemplate(template)}
                className={`p-3 rounded-lg border cursor-pointer transition-all ${
                  selectedTemplate?.id === template.id
                    ? 'bg-indigo-50 border-indigo-300'
                    : 'bg-white border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-gray-800">{template.template_name}</h4>
                  {template.is_default && (
                    <span className="px-2 py-0.5 bg-indigo-100 text-indigo-600 text-xs rounded">
                      기본
                    </span>
                  )}
                </div>
                {template.description && (
                  <p className="text-xs text-gray-500 mb-2">{template.description}</p>
                )}
                <div className="flex gap-1">
                  {DAY_NAMES.map((day, i) => {
                    const dayKey = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'][i] as keyof ScheduleTemplate;
                    const shift = template[`${dayKey}_shift` as keyof ScheduleTemplate] as ShiftType;
                    return (
                      <span
                        key={day}
                        className={`px-1.5 py-0.5 rounded text-[10px] ${SHIFT_COLORS[shift]}`}
                      >
                        {day}
                      </span>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 직원 선택 */}
      <div className="flex-1 p-4 overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-800">적용할 직원 선택</h3>
          <button
            onClick={handleSelectAll}
            className="text-sm text-indigo-600 hover:text-indigo-700"
          >
            {selectedStaff.length === staffList.length ? '전체 해제' : '전체 선택'}
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
          {staffList.map(staff => (
            <div
              key={staff.id}
              onClick={() => handleToggleStaff(staff.id)}
              className={`p-3 rounded-lg border cursor-pointer transition-all ${
                selectedStaff.includes(staff.id)
                  ? 'bg-indigo-50 border-indigo-300'
                  : 'bg-white border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selectedStaff.includes(staff.id)}
                  onChange={() => {}}
                  className="w-4 h-4 text-indigo-600 rounded"
                />
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: staff.profile_color }}
                ></span>
                <span className="font-medium text-gray-800">{staff.name}</span>
              </div>
              <p className="text-xs text-gray-500 mt-1 ml-6">{staff.position || '-'}</p>
            </div>
          ))}
        </div>

        {/* 적용 버튼 */}
        <div className="sticky bottom-0 bg-white pt-4 border-t">
          <button
            onClick={handleApply}
            disabled={!selectedTemplate || selectedStaff.length === 0}
            className="w-full py-3 bg-indigo-500 text-white font-medium rounded-lg hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <i className="fas fa-check mr-2"></i>
            {selectedStaff.length > 0
              ? `${selectedStaff.length}명에게 적용`
              : '직원을 선택하세요'}
          </button>
        </div>
      </div>
    </div>
  );
};

// =====================================================
// Method C: 퀵 입력
// =====================================================

const QuickInputView: React.FC<{
  staffList: StaffMember[];
  year: number;
  month: number;
  changes: Map<string, ShiftType>;
  onBatchChange: (changes: Map<string, ShiftType>) => void;
}> = ({ staffList, year, month, changes, onBatchChange }) => {
  const [inputText, setInputText] = useState('');
  const [selectedStaffId, setSelectedStaffId] = useState<number | null>(
    staffList[0]?.id || null
  );

  // 키보드 단축키 맵핑
  const keyMap: Record<string, ShiftType> = {
    'f': 'full',
    'F': 'full',
    'a': 'am',
    'A': 'am',
    'p': 'pm',
    'P': 'pm',
    'o': 'off',
    'O': 'off',
    'x': 'off',
    'X': 'off',
    '-': 'off',
    '1': 'half_am',
    '2': 'half_pm',
  };

  // 입력 파싱 및 적용
  function parseAndApply() {
    if (!selectedStaffId || !inputText.trim()) {
      alert('직원을 선택하고 입력값을 넣어주세요.');
      return;
    }

    const chars = inputText.replace(/\s/g, '').split('');
    const newChanges = new Map<string, ShiftType>();
    const lastDay = new Date(year, month, 0).getDate();

    let dayIndex = 1;
    for (const char of chars) {
      if (dayIndex > lastDay) break;

      const shiftType = keyMap[char];
      if (shiftType) {
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(dayIndex).padStart(2, '0')}`;
        newChanges.set(`${selectedStaffId}_${dateStr}`, shiftType);
        dayIndex++;
      }
    }

    if (newChanges.size > 0) {
      onBatchChange(newChanges);
      alert(`${newChanges.size}일의 스케줄이 입력되었습니다.`);
      setInputText('');
    } else {
      alert('유효한 입력이 없습니다.');
    }
  }

  // 전체 월 채우기
  function fillMonth(shiftType: ShiftType) {
    if (!selectedStaffId) {
      alert('직원을 선택해주세요.');
      return;
    }

    const newChanges = new Map<string, ShiftType>();
    const lastDay = new Date(year, month, 0).getDate();

    for (let d = 1; d <= lastDay; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      newChanges.set(`${selectedStaffId}_${dateStr}`, shiftType);
    }

    onBatchChange(newChanges);
    alert(`${lastDay}일 전체가 "${SHIFT_TYPE_LABELS[shiftType]}"으로 설정되었습니다.`);
  }

  // 주말만 휴무
  function setWeekendsOff() {
    if (!selectedStaffId) {
      alert('직원을 선택해주세요.');
      return;
    }

    const newChanges = new Map<string, ShiftType>();
    const lastDay = new Date(year, month, 0).getDate();

    for (let d = 1; d <= lastDay; d++) {
      const date = new Date(year, month - 1, d);
      const dayOfWeek = date.getDay();
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

      if (dayOfWeek === 0 || dayOfWeek === 6) {
        newChanges.set(`${selectedStaffId}_${dateStr}`, 'off');
      }
    }

    onBatchChange(newChanges);
    alert('주말이 휴무로 설정되었습니다.');
  }

  // 평일 풀타임 + 주말 휴무
  function setWeekdaysFull() {
    if (!selectedStaffId) {
      alert('직원을 선택해주세요.');
      return;
    }

    const newChanges = new Map<string, ShiftType>();
    const lastDay = new Date(year, month, 0).getDate();

    for (let d = 1; d <= lastDay; d++) {
      const date = new Date(year, month - 1, d);
      const dayOfWeek = date.getDay();
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

      if (dayOfWeek === 0 || dayOfWeek === 6) {
        newChanges.set(`${selectedStaffId}_${dateStr}`, 'off');
      } else {
        newChanges.set(`${selectedStaffId}_${dateStr}`, 'full');
      }
    }

    onBatchChange(newChanges);
    alert('평일 풀타임, 주말 휴무로 설정되었습니다.');
  }

  const selectedStaff = staffList.find(s => s.id === selectedStaffId);

  return (
    <div className="h-full p-6 overflow-y-auto">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* 직원 선택 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            직원 선택
          </label>
          <select
            value={selectedStaffId || ''}
            onChange={(e) => setSelectedStaffId(parseInt(e.target.value))}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-lg"
          >
            {staffList.map(staff => (
              <option key={staff.id} value={staff.id}>
                {staff.name} ({staff.position || '-'})
              </option>
            ))}
          </select>
        </div>

        {/* 키보드 입력 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            키보드 빠른 입력
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="예: ffffffaaooofffff (1일부터 순서대로)"
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-mono text-lg"
            />
            <button
              onClick={parseAndApply}
              className="px-6 py-3 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 font-medium"
            >
              적용
            </button>
          </div>
          <div className="mt-2 text-sm text-gray-500">
            <strong>단축키:</strong> f=풀타임, a=오전, p=오후, o/-/x=휴무, 1=오전반차, 2=오후반차
          </div>
        </div>

        {/* 빠른 작업 버튼 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            빠른 작업
          </label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <button
              onClick={() => fillMonth('full')}
              className="p-3 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 font-medium text-sm"
            >
              <i className="fas fa-calendar-check mr-2"></i>
              전체 풀타임
            </button>
            <button
              onClick={() => fillMonth('off')}
              className="p-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium text-sm"
            >
              <i className="fas fa-calendar-times mr-2"></i>
              전체 휴무
            </button>
            <button
              onClick={setWeekendsOff}
              className="p-3 bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 font-medium text-sm"
            >
              <i className="fas fa-umbrella-beach mr-2"></i>
              주말만 휴무
            </button>
            <button
              onClick={setWeekdaysFull}
              className="p-3 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 font-medium text-sm"
            >
              <i className="fas fa-briefcase mr-2"></i>
              평일풀+주말휴
            </button>
          </div>
        </div>

        {/* 미리보기 */}
        {selectedStaff && (
          <div className="p-4 bg-gray-50 rounded-lg border">
            <h4 className="font-medium text-gray-800 mb-3">
              {selectedStaff.name} - {year}년 {month}월 미리보기
            </h4>
            <div className="flex flex-wrap gap-1">
              {Array.from({ length: new Date(year, month, 0).getDate() }, (_, i) => {
                const d = i + 1;
                const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                const key = `${selectedStaffId}_${dateStr}`;
                const shift = changes.get(key) || 'off';
                const date = new Date(year, month - 1, d);
                const dayOfWeek = date.getDay();

                return (
                  <div
                    key={d}
                    className={`w-9 h-9 flex flex-col items-center justify-center rounded text-xs ${SHIFT_COLORS[shift]} ${
                      dayOfWeek === 0 ? 'ring-1 ring-red-300' :
                      dayOfWeek === 6 ? 'ring-1 ring-blue-300' : ''
                    }`}
                    title={`${d}일: ${SHIFT_TYPE_LABELS[shift]}`}
                  >
                    <span className="font-bold">{d}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 도움말 */}
        <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-200">
          <h4 className="font-medium text-indigo-800 mb-2">
            <i className="fas fa-lightbulb mr-2"></i>
            사용 팁
          </h4>
          <ul className="text-sm text-indigo-700 space-y-1">
            <li>- 키보드 입력은 1일부터 순서대로 적용됩니다.</li>
            <li>- 공백은 무시됩니다. 예: "f f f f f a o" = "ffffao"</li>
            <li>- 빠른 작업 버튼으로 전체/주말만 빠르게 설정 가능합니다.</li>
            <li>- 변경사항은 "저장" 버튼을 누르기 전까지 임시 상태입니다.</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default ScheduleBatchModal;
