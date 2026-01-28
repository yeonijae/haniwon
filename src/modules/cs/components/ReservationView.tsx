import React from 'react';
import type { PortalUser } from '@shared/types';
import ReservationApp from '../../reservation/ReservationApp';
import type { ReservationDraft } from '../../reservation/components/ReservationStep1Modal';

interface ReservationViewProps {
  user: PortalUser;
  externalDraft?: ReservationDraft | null;
  onDraftComplete?: () => void;
}

function ReservationView({ user, externalDraft, onDraftComplete }: ReservationViewProps) {
  return (
    <div className="cs-reservation-view">
      <ReservationApp
        user={user}
        externalDraft={externalDraft}
        onDraftComplete={onDraftComplete}
      />
    </div>
  );
}

export default ReservationView;
