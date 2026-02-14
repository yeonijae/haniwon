import React from 'react';

interface UncoveredItemInfoProps {
  itemName: string;
  amount: number;
  patientName: string;
  chartNumber: string;
  receiptDate: string;
}

const containerStyle: React.CSSProperties = {
  padding: '16px 20px',
  paddingRight: 48,
  borderBottom: '1px solid #e5e7eb',
  backgroundColor: '#f9fafb',
};

const topRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 8,
};

const itemNameStyle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 600,
  color: '#111827',
};

const amountStyle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 600,
  color: '#2563eb',
};

const bottomRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 16,
  fontSize: 13,
  color: '#6b7280',
};

const UncoveredItemInfo: React.FC<UncoveredItemInfoProps> = ({
  itemName,
  amount,
  patientName,
  chartNumber,
  receiptDate,
}) => {
  return (
    <div style={containerStyle}>
      <div style={topRowStyle}>
        <span style={itemNameStyle}>{itemName}</span>
        <span style={amountStyle}>{amount.toLocaleString()}원</span>
      </div>
      <div style={bottomRowStyle}>
        <span>{patientName} ({chartNumber})</span>
        <span>{receiptDate}</span>
      </div>
    </div>
  );
};

export default UncoveredItemInfo;
