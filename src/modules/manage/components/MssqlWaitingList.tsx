/**
 * MSSQL 대기 현황 컴포넌트
 * 차트 프로그램의 대기실/치료실 데이터를 실시간 표시
 */

import React from 'react';
import Quadrant from './Quadrant';
import { MssqlWaitingPatient, MssqlTreatingPatient } from '../hooks/useMssqlQueue';

interface MssqlWaitingListProps {
  title: string;
  icon: string;
  list: MssqlWaitingPatient[] | MssqlTreatingPatient[];
  listType: 'waiting' | 'treating';
  formatWaitingTime: (time: string | null) => string;
  getWaitingMinutes: (time: string | null) => number;
}

// 대기 환자인지 확인
const isWaitingPatient = (patient: MssqlWaitingPatient | MssqlTreatingPatient): patient is MssqlWaitingPatient => {
  return 'waiting_since' in patient;
};

const MssqlWaitingListItem: React.FC<{
  patient: MssqlWaitingPatient | MssqlTreatingPatient;
  listType: 'waiting' | 'treating';
  formatWaitingTime: (time: string | null) => string;
  getWaitingMinutes: (time: string | null) => number;
}> = ({ patient, listType, formatWaitingTime, getWaitingMinutes }) => {
  // 차트번호 앞의 0 제거
  const formatChartNumber = (chartNumber?: string) => {
    if (!chartNumber) return '';
    return chartNumber.replace(/^0+/, '') || '0';
  };

  // 대기 시간 또는 치료 시간
  const timeField = isWaitingPatient(patient) ? patient.waiting_since : (patient as MssqlTreatingPatient).treating_since;
  const waitingMinutes = getWaitingMinutes(timeField);

  // 오래 대기한 경우 강조 (30분: 주황, 60분: 빨강)
  const isLongWait = waitingMinutes >= 30;
  const isVeryLongWait = waitingMinutes >= 60;

  return (
    <li className={`flex justify-between items-center p-2 rounded-md transition-colors duration-150 ${
      isVeryLongWait
        ? 'bg-red-100 hover:bg-red-150 border-l-4 border-red-500'
        : isLongWait
          ? 'bg-orange-50 hover:bg-orange-100 border-l-4 border-orange-400'
          : 'hover:bg-blue-50'
    }`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-1 flex-wrap">
          <span className="font-bold text-clinic-text-primary">
            {patient.patient_name}
          </span>
          {patient.chart_no && (
            <span className="text-xs text-gray-400">{formatChartNumber(patient.chart_no)}</span>
          )}
          <span className="text-xs text-gray-500">
            {patient.sex === 'M' ? '남' : '여'}/{patient.age || '?'}
          </span>
        </div>
        <div className="text-sm font-medium truncate flex items-center gap-2">
          {patient.doctor && (
            <span className="text-clinic-secondary">{patient.doctor}</span>
          )}
          {patient.status && (
            <>
              {patient.doctor && <span className="text-gray-400">|</span>}
              <span className="text-orange-600">{patient.status}</span>
            </>
          )}
          {isWaitingPatient(patient) && patient.progress && (
            <span className="px-1.5 py-0.5 text-xs bg-blue-100 text-blue-700 rounded">
              {patient.progress}
            </span>
          )}
          {!isWaitingPatient(patient) && (patient as MssqlTreatingPatient).bed !== undefined && (
            <span className="px-1.5 py-0.5 text-xs bg-green-100 text-green-700 rounded">
              베드 {(patient as MssqlTreatingPatient).bed}
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-col items-end ml-2 flex-shrink-0">
        <span className="text-xs text-gray-400">{formatWaitingTime(timeField)}</span>
        {waitingMinutes > 0 && (
          <span className={`text-xs font-medium ${
            isVeryLongWait ? 'text-red-600' : isLongWait ? 'text-orange-600' : 'text-gray-500'
          }`}>
            {waitingMinutes}분
          </span>
        )}
      </div>
    </li>
  );
};

const MssqlWaitingList: React.FC<MssqlWaitingListProps> = ({
  title,
  icon,
  list,
  listType,
  formatWaitingTime,
  getWaitingMinutes,
}) => {
  return (
    <Quadrant icon={icon} title={`${title} (${list.length})`} className="flex-1 min-h-0">
      <ul className="divide-y divide-gray-200 overflow-y-auto p-2 h-full">
        {list.length > 0 ? (
          list.map((patient, index) => (
            <MssqlWaitingListItem
              key={`${listType}-${patient.id}-${index}`}
              patient={patient}
              listType={listType}
              formatWaitingTime={formatWaitingTime}
              getWaitingMinutes={getWaitingMinutes}
            />
          ))
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center text-clinic-text-secondary">
            <i className="fa-regular fa-folder-open text-4xl mb-3"></i>
            <p className="font-semibold">대기 환자가 없습니다.</p>
          </div>
        )}
      </ul>
    </Quadrant>
  );
};

export default MssqlWaitingList;
