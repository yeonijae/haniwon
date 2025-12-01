import { useState, useEffect } from 'react';
import { ConsultationRoom, Patient, MedicalStaff } from '../types';

interface UseConsultationRoomsProps {
  medicalStaff: MedicalStaff[];
}

export const useConsultationRooms = ({ medicalStaff }: UseConsultationRoomsProps) => {
  const [consultationRooms, setConsultationRooms] = useState<ConsultationRoom[]>([]);

  // 의료진 데이터를 기반으로 진료실 목록 생성
  useEffect(() => {
    const rooms: ConsultationRoom[] = [];
    let roomId = 1;

    // DB에 저장된 의료진 중 consultationRoom이 있는 의료진만 진료실에 추가
    medicalStaff
      .filter(staff => staff.consultationRoom && staff.status === 'working')
      .sort((a, b) => {
        // 진료실 번호 순으로 정렬 (1진료실, 2진료실, 3진료실, 4진료실)
        const getOrder = (room: string) => {
          const match = room.match(/^(\d+)진료실$/);
          return match ? parseInt(match[1]) : 999;
        };
        return getOrder(a.consultationRoom!) - getOrder(b.consultationRoom!);
      })
      .forEach(staff => {
        rooms.push({
          id: roomId++,
          roomName: staff.consultationRoom!,
          doctorName: `${staff.name} 원장`,
          status: 'available',
        });
      });

    // 고정 진료실 추가 (상담실, 검사실 등)
    rooms.push(
      {
        id: roomId++,
        roomName: '상담실',
        doctorName: '상담실장',
        status: 'available',
      },
      {
        id: roomId++,
        roomName: '검사실',
        doctorName: '검사담당',
        status: 'available',
      }
    );

    // 기존 진료실의 환자 정보를 유지하면서 업데이트
    setConsultationRooms(prevRooms => {
      return rooms.map(newRoom => {
        const existingRoom = prevRooms.find(
          r => r.roomName === newRoom.roomName && r.doctorName === newRoom.doctorName
        );
        if (existingRoom) {
          // 기존 진료실의 환자 정보를 유지
          return {
            ...newRoom,
            status: existingRoom.status,
            patientId: existingRoom.patientId,
            patientName: existingRoom.patientName,
            patientDetails: existingRoom.patientDetails,
          };
        }
        return newRoom;
      });
    });
  }, [medicalStaff]);

  const handleFinishConsultation = (patientId: number, onMoveToTreatment: (patient: Patient) => void, onMoveToPayment: (patient: Patient) => void) => {
    // 진료실을 사용 가능 상태로 변경
    setConsultationRooms(prevRooms =>
      prevRooms.map(room =>
        room.patientId === patientId
          ? { ...room, status: 'available', patientId: undefined, patientName: undefined, patientDetails: undefined }
          : room
      )
    );
  };

  const handleAssignPatientToRoom = (patientId: number, roomId: number) => {
    const targetRoom = consultationRooms.find(r => r.id === roomId);

    if (!targetRoom) {
      alert('진료실 정보를 찾을 수 없습니다.');
      return false;
    }
    if (targetRoom.status !== 'available') {
      alert(`${targetRoom.roomName}은 현재 사용 중입니다.`);
      return false;
    }

    return true;
  };

  const assignPatientToRoom = (roomId: number, patientId: number, patientName: string, patientDetails: string) => {
    setConsultationRooms(prev => prev.map(room => {
      if (room.id === roomId) {
        return {
          ...room,
          status: 'in_consultation',
          patientId,
          patientName,
          patientDetails,
        };
      }
      return room;
    }));
  };

  // 진료실 비우기 (환자 제거)
  const clearConsultationRoom = (roomId: number) => {
    setConsultationRooms(prev => prev.map(room => {
      if (room.id === roomId) {
        return {
          ...room,
          status: 'available',
          patientId: undefined,
          patientName: undefined,
          patientDetails: undefined,
        };
      }
      return room;
    }));
  };

  return {
    consultationRooms,
    setConsultationRooms,
    handleFinishConsultation,
    handleAssignPatientToRoom,
    assignPatientToRoom,
    clearConsultationRoom,
  };
};
