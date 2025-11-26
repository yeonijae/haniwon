function DeliveryList() {
  return (
    <div className="h-full overflow-auto">
      <div className="page-header">
        <h1>배송 관리</h1>
        <button className="btn btn-primary">+ 배송 등록</button>
      </div>

      <div className="card">
        <div className="empty-state">
          <div className="empty-state-icon">🚚</div>
          <p>배송 목록이 여기에 표시됩니다.</p>
          <p style={{ color: '#7f8c8d', fontSize: '14px', marginTop: '10px' }}>
            탕전 배치와 연동되어 배송 상태를 관리합니다.
          </p>
        </div>
      </div>
    </div>
  );
}

export default DeliveryList;
