import { useState } from 'react';
import TreatmentProgramAdmin from './TreatmentProgramAdmin';
import MedicineInventoryAdmin from './MedicineInventoryAdmin';
import DecocionManagementView from './DecocionManagementView';

type SettingsTab = 'medicine' | 'decocion' | 'treatment';

interface SettingsViewProps {
  user?: any;
}

function SettingsView({ user }: SettingsViewProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('medicine');

  const tabs: { id: SettingsTab; label: string; icon: string }[] = [
    { id: 'medicine', label: '상비약 재고', icon: '💊' },
    { id: 'decocion', label: '탕전 관리', icon: '🍵' },
    { id: 'treatment', label: '시술 프로그램', icon: '📋' },
  ];

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 탭 헤더 */}
      <div
        style={{
          display: 'flex',
          gap: '4px',
          padding: '12px 16px',
          borderBottom: '1px solid #e5e7eb',
          background: '#f9fafb',
        }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderRadius: '6px 6px 0 0',
              background: activeTab === tab.id ? 'white' : 'transparent',
              color: activeTab === tab.id ? '#1f2937' : '#6b7280',
              cursor: 'pointer',
              fontWeight: activeTab === tab.id ? 600 : 400,
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              borderBottom: activeTab === tab.id ? '2px solid #3b82f6' : '2px solid transparent',
            }}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* 탭 컨텐츠 */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {activeTab === 'medicine' && <MedicineInventoryAdmin />}
        {activeTab === 'decocion' && <DecocionManagementView />}
        {activeTab === 'treatment' && <TreatmentProgramAdmin />}
      </div>
    </div>
  );
}

export default SettingsView;
