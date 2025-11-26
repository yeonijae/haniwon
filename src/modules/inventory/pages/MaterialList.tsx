function MaterialList() {
  return (
    <div className="h-full overflow-auto">
      <div className="page-header">
        <h1>자재 관리</h1>
        <button className="btn btn-primary">+ 자재 등록</button>
      </div>

      <div className="card">
        <div className="empty-state">
          <div className="empty-state-icon">📦</div>
          <p>자재 목록이 여기에 표시됩니다.</p>
          <p style={{ color: '#7f8c8d', fontSize: '14px', marginTop: '10px' }}>
            포장재 등 소모품의 재고를 관리합니다.
          </p>
        </div>
      </div>
    </div>
  );
}

export default MaterialList;
