import React from 'react';
import type { PortalUser } from '@shared/types';
import ReservationApp from '../../reservation/ReservationApp';

interface ReservationViewProps {
  user: PortalUser;
}

function ReservationView({ user }: ReservationViewProps) {
  return (
    <div className="cs-reservation-view">
      <ReservationApp user={user} />
    </div>
  );
}

export default ReservationView;
