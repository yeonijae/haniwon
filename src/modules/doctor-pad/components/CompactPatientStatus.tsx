/**
 * 축소된 내환자 상태 컴포넌트
 */

import { useState, useEffect } from 'react';
import type { TreatmentRoom } from '@modules/treatment/types';
import type { CompactPatientInfo } from '../types';

interface Props {
  rooms: TreatmentRoom[];
  doctorName: string;
  onPatientClick?: (patientId: number, roomId: number) => void;
}

// 남은 시간 계산
function calculateRemainingSeconds(startTime: string | null | undefined, duration: number | undefined): number {
  if (!startTime || !duration) return 0;

  const start = new Date(startTime).getTime();
  const now = Date.now();
  const elapsed = Math.floor((now - start) / 1000);
  const remaining = (duration * 60) - elapsed;

  return Math.max(0, remaining);
}

// 시간 포맷팅 (초 → MM:SS)
function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// 개별 환자 상태 아이템
function PatientStatusItem({
  info,
  onClick,
}: {
  info: CompactPatientInfo;
  onClick?: () => void;
}) {
  const [remaining, setRemaining] = useState(info.remainingSeconds);

  // 1초마다 남은 시간 업데이트
  useEffect(() => {
    setRemaining(info.remainingSeconds);

    if (info.status === 'running' && info.remainingSeconds > 0) {
      const interval = setInterval(() => {
        setRemaining(prev => Math.max(0, prev - 1));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [info.remainingSeconds, info.status]);

  const isUrgent = remaining > 0 && remaining < 120; // 2분 이하
  const isOvertime = remaining <= 0 && info.status === 'running';

  return (
    <div
      onClick={onClick}
      className={`
        flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer
        transition-all hover:bg-gray-700
        ${isOvertime ? 'bg-red-900/30 border border-red-500/50' : 'bg-gray-800/50'}
      `}
    >
      {/* 치료실명 */}
      <span className="text-xs text-gray-500 min-w-[48px]">
        {info.roomName}
      </span>

      {/* 구분선 */}
      <span className="text-gray-600">·</span>

      {/* 환자명 */}
      <span className="text-sm font-medium text-white truncate min-w-[48px]">
        {info.patientName}
      </span>

      {/* 구분선 */}
      <span className="text-gray-600">·</span>

      {/* 현재 치료 + 남은시간 */}
      <div className="flex items-center gap-1.5">
        <span className="text-xs px-1.5 py-0.5 bg-teal-500/20 text-teal-400 rounded">
          {info.currentTreatment || '대기'}
        </span>

        {info.status === 'running' && (
          <span className={`
            text-xs font-mono
            ${isOvertime ? 'text-red-400 animate-pulse' : isUrgent ? 'text-orange-400' : 'text-gray-400'}
          `}>
            {isOvertime ? '+' : ''}{formatTime(Math.abs(remaining))}
          </span>
        )}
      </div>
    </div>
  );
}

export function CompactPatientStatus({ rooms, doctorName, onPatientClick }: Props) {
  // 내 환자만 필터링
  const myPatientRooms = rooms.filter(
    room => room.patientId && room.doctorName?.includes(doctorName.replace('원장', ''))
  );

  // CompactPatientInfo로 변환
  const patients: CompactPatientInfo[] = myPatientRooms.map(room => {
    const runningTreatment = room.sessionTreatments?.find(t => t.status === 'running');
    const pendingTreatment = room.sessionTreatments?.find(t => t.status === 'pending');

    return {
      roomId: room.id,
      roomName: room.name,
      patientId: room.patientId!,
      patientName: room.patientName || '환자',
      currentTreatment: runningTreatment?.name || pendingTreatment?.name || '대기',
      remainingSeconds: calculateRemainingSeconds(
        runningTreatment?.startTime,
        runningTreatment?.duration
      ),
      status: runningTreatment ? 'running' : pendingTreatment ? 'pending' : 'completed',
    };
  });

  if (patients.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg p-3">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm">🏥</span>
          <span className="text-sm font-medium text-white">내 환자 상태</span>
          <span className="text-xs text-gray-500">(0)</span>
        </div>
        <div className="text-center text-gray-500 text-sm py-2">
          현재 치료 중인 환자가 없습니다
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg overflow-hidden">
      {/* 헤더 */}
      <div className="px-3 py-2 border-b border-gray-700 flex items-center gap-2">
        <span className="text-sm">🏥</span>
        <span className="text-sm font-medium text-white">내 환자 상태</span>
        <span className="text-xs text-gray-500">({patients.length})</span>
      </div>

      {/* 환자 목록 */}
      <div className="p-2 space-y-1 max-h-[120px] overflow-y-auto">
        {patients.map(patient => (
          <PatientStatusItem
            key={patient.roomId}
            info={patient}
            onClick={() => onPatientClick?.(patient.patientId, patient.roomId)}
          />
        ))}
      </div>
    </div>
  );
}
