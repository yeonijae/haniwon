function DecoctionList() {
  return (
    <div className="h-full overflow-auto">
      <div className="page-header">
        <h1>탕전 관리</h1>
        <button className="btn btn-primary">+ 탕전 배치 생성</button>
      </div>

      <div className="card">
        <div className="empty-state">
          <div className="empty-state-icon">🔥</div>
          <p>탕전 배치 목록이 여기에 표시됩니다.</p>
          <p style={{ color: '#7f8c8d', fontSize: '14px', marginTop: '10px' }}>
            처방전을 기반으로 탕전을 제조하고 약재 재고가 자동으로 차감됩니다.
          </p>
        </div>
      </div>
    </div>
  );
}

export default DecoctionList;
