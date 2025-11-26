import { Link, useNavigate } from 'react-router-dom';
import { signOut, hasPermission } from '@shared/lib/auth';
import type { PortalUser, AppType } from '@shared/types';
import '../styles/portal.css';

interface DashboardProps {
  user: PortalUser;
  onLogout: () => void;
}

interface AppInfo {
  id: AppType;
  name: string;
  description: string;
  path: string;
  icon: string;
  color: string;
}

const APPS: AppInfo[] = [
  {
    id: 'manage',
    name: '운영관리',
    description: '한의원 운영 전반을 관리합니다. 예약, 환자 관리, 매출 통계 등을 확인할 수 있습니다.',
    path: '/manage',
    icon: '📊',
    color: '#667eea',
  },
  {
    id: 'chart',
    name: '진료관리',
    description: '환자 차트 및 진료 기록을 관리합니다. 처방전, 진료 노트, 의료 기록을 작성할 수 있습니다.',
    path: '/chart',
    icon: '📋',
    color: '#10b981',
  },
  {
    id: 'inventory',
    name: '재고관리',
    description: '약재 및 물품 재고를 관리합니다. 입출고 현황, 재고 현황, 발주 관리를 할 수 있습니다.',
    path: '/inventory',
    icon: '📦',
    color: '#f59e0b',
  },
  {
    id: 'treatment',
    name: '치료관리',
    description: '치료실 및 액팅을 관리합니다. 치료실 배정, 타이머, 원장별 액팅 대기열을 확인할 수 있습니다.',
    path: '/treatment',
    icon: '🏥',
    color: '#06b6d4',
  },
];

function Dashboard({ user, onLogout }: DashboardProps) {
  const navigate = useNavigate();

  async function handleLogout() {
    try {
      await signOut();
      onLogout();
    } catch (error) {
      console.error('로그아웃 실패:', error);
    }
  }

  function handleAppClick(app: AppInfo) {
    if (!hasPermission(user, app.id)) {
      alert('이 앱에 대한 접근 권한이 없습니다. 관리자에게 문의하세요.');
      return;
    }
    // 새 창으로 최대 크기로 열기
    const url = window.location.origin + app.path;
    const screenWidth = window.screen.availWidth;
    const screenHeight = window.screen.availHeight;
    window.open(url, `${app.id}_window`, `width=${screenWidth},height=${screenHeight},left=0,top=0`);
  }

  function getRoleName(role: string): string {
    switch (role) {
      case 'super_admin':
        return '최고관리자';
      case 'medical_staff':
        return '의료진';
      case 'desk':
        return '데스크';
      case 'counseling':
        return '상담실';
      case 'treatment':
        return '치료실';
      case 'decoction':
        return '탕전실';
      default:
        return role;
    }
  }

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div className="header-left">
          <span className="header-logo">🏥</span>
          <div>
            <h1 className="header-title">연이재한의원 통합 포털</h1>
            <p className="header-subtitle">원하시는 서비스를 선택하세요</p>
          </div>
        </div>
        <div className="header-right">
          <div className="user-info">
            <div className="user-name">{user.name}님</div>
            <div className="user-role">{getRoleName(user.role)}</div>
          </div>
          <button className="logout-button" onClick={handleLogout}>
            로그아웃
          </button>
        </div>
      </header>

      <section className="apps-section">
        <h2 className="section-title">서비스 목록</h2>
        <div className="apps-grid">
          {APPS.map((app) => {
            const accessible = hasPermission(user, app.id);
            return (
              <div
                key={app.id}
                className={`app-card ${!accessible ? 'disabled' : ''}`}
                onClick={() => handleAppClick(app)}
                style={{ borderColor: accessible ? app.color : undefined }}
              >
                <div className="app-icon">{app.icon}</div>
                <h3 className="app-name">{app.name}</h3>
                <p className="app-description">{app.description}</p>
                <span className={`app-status ${accessible ? 'accessible' : 'restricted'}`}>
                  {accessible ? '✓ 접근 가능' : '🔒 권한 필요'}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {user.role === 'super_admin' && (
        <section className="admin-section">
          <h2 className="admin-title">관리자 메뉴</h2>
          <Link to="/admin" className="admin-link">
            ⚙️ 사용자 권한 관리
          </Link>
        </section>
      )}
    </div>
  );
}

export default Dashboard;
