import TreatmentProgramAdmin from './TreatmentProgramAdmin';

interface SettingsViewProps {
  user?: any;
}

function SettingsView({ user }: SettingsViewProps) {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <TreatmentProgramAdmin />
    </div>
  );
}

export default SettingsView;
