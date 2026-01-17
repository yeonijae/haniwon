import HerbalPurposeAdmin from './HerbalPurposeAdmin';
import HerbalDiseaseAdmin from './HerbalDiseaseAdmin';
import NokryongTypeAdmin from './NokryongTypeAdmin';

function HerbalSettingsAdmin() {
  return (
    <div className="herbal-settings-admin">
      <div className="herbal-settings-header">
        <h2>
          <i className="fa-solid fa-seedling"></i>
          한약 관리
        </h2>
        <p>한약 선결제 등록 시 사용되는 치료목적, 질환명 태그, 녹용 종류를 관리합니다.</p>
      </div>

      <div className="herbal-settings-grid">
        <div className="grid-column">
          <HerbalPurposeAdmin />
        </div>
        <div className="grid-column">
          <HerbalDiseaseAdmin />
        </div>
        <div className="grid-column">
          <NokryongTypeAdmin />
        </div>
      </div>

      <style>{`
        .herbal-settings-admin {
          padding: 20px;
        }

        .herbal-settings-header {
          margin-bottom: 24px;
          padding-bottom: 16px;
          border-bottom: 1px solid #e5e7eb;
        }

        .herbal-settings-header h2 {
          margin: 0 0 8px 0;
          font-size: 18px;
          font-weight: 600;
          color: #1f2937;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .herbal-settings-header h2 i {
          color: #22c55e;
        }

        .herbal-settings-header p {
          margin: 0;
          font-size: 13px;
          color: #6b7280;
        }

        .herbal-settings-grid {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 20px;
        }

        .grid-column {
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          overflow: hidden;
        }

        /* 내부 Admin 컴포넌트 스타일 오버라이드 */
        .grid-column .herbal-purpose-admin,
        .grid-column .herbal-disease-admin,
        .grid-column .nokryong-type-admin {
          max-width: 100%;
          padding: 16px;
        }

        .grid-column .admin-header {
          margin-bottom: 16px;
        }

        .grid-column .admin-header h3 {
          font-size: 14px;
        }

        .grid-column .admin-add-form {
          padding: 10px;
        }

        .grid-column .admin-add-form input {
          font-size: 12px;
        }

        .grid-column .admin-table th,
        .grid-column .admin-table td {
          padding: 6px 8px;
          font-size: 12px;
        }

        .grid-column .admin-footer {
          margin-top: 16px;
          padding-top: 12px;
        }

        /* 반응형 - 중간 화면에서 2단 */
        @media (max-width: 1200px) {
          .herbal-settings-grid {
            grid-template-columns: 1fr 1fr;
          }
        }

        /* 반응형 - 좁은 화면에서 1단 */
        @media (max-width: 800px) {
          .herbal-settings-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}

export default HerbalSettingsAdmin;
