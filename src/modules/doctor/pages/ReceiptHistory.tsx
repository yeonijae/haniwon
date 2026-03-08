import type { PortalUser } from '@shared/types';
import DoctorReceiptView from '../components/DoctorReceiptView';
import '@modules/cs/styles/cs.css';

interface ReceiptHistoryProps {
  user: PortalUser;
  onPatientClick?: (patientId: string, chartNumber: string) => void;
  selectedDoctorName?: string;
  title?: string;
  readOnly?: boolean;
}

const ReceiptHistory: React.FC<ReceiptHistoryProps> = ({
  user,
  onPatientClick,
  selectedDoctorName,
  readOnly = true,
}) => {
  return (
    <DoctorReceiptView
      user={user}
      readOnly={readOnly}
      fixedDoctorFilter={selectedDoctorName}
      onPatientClick={onPatientClick}
    />
  );
};

export default ReceiptHistory;
