import React from 'react';
import type { PortalUser } from '@shared/types';
import { useTreatmentRooms } from '@treatment/hooks/useTreatmentRooms';
import ActingManagementView from '@treatment/components/ActingManagementView';

interface ActingAppProps {
  user: PortalUser;
}

function ActingApp({ user }: ActingAppProps) {
  const { treatmentRooms } = useTreatmentRooms(user);

  const handleNavigateBack = () => {
    window.close();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-clinic-text-primary">액팅관리</h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">{user.name}님</span>
          <button
            onClick={handleNavigateBack}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            닫기
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="h-[calc(100vh-60px)]">
        <ActingManagementView
          treatmentRooms={treatmentRooms}
          allPatients={[]}
        />
      </div>
    </div>
  );
}

export default ActingApp;
