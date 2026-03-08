import type { PortalUser } from '@shared/types';
import ReceiptHistory from './ReceiptHistory';

interface TreatmentHistoryProps {
  user: PortalUser;
  onPatientClick?: (patientId: string, chartNumber: string) => void;
  selectedDoctorName?: string;
}

const TreatmentHistory: React.FC<TreatmentHistoryProps> = ({ user, onPatientClick, selectedDoctorName }) => {
  return (
    <ReceiptHistory
      user={user}
      title="진료내역"
      onPatientClick={onPatientClick}
      selectedDoctorName={selectedDoctorName}
      readOnly
    />
  );
};

export default TreatmentHistory;
