import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signOut, hasPermission } from '@shared/lib/auth';
import { APPS, AppInfo } from '@shared/constants/apps';
import type { PortalUser } from '@shared/types';
import '../styles/portal.css';

interface DashboardProps {
  user: PortalUser;
  onLogout: () => void;
}

function Dashboard({ user, onLogout }: DashboardProps) {
  const navigate = useNavigate();
  const [isEditMode, setIsEditMode] = useState(false);
  const [orderedApps, setOrderedApps] = useState<AppInfo[]>([]);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // localStorage 키 (사용자별로 저장)
  const storageKey = `portal_app_order_${user.login_id}`;

  // 초기 로드: localStorage에서 순서 불러오기
  useEffect(() => {
    const userApps = APPS.filter((app) => hasPermission(user, app.id));
    const savedOrder = localStorage.getItem(storageKey);

    if (savedOrder) {
      try {
        const orderIds: string[] = JSON.parse(savedOrder);
        // 저장된 순서대로 정렬, 새로 추가된 앱은 뒤에 추가
        const ordered: AppInfo[] = [];
        orderIds.forEach(id => {
          const app = userApps.find(a => a.id === id);
          if (app) ordered.push(app);
        });
        // 저장되지 않은 새 앱 추가
        userApps.forEach(app => {
          if (!ordered.find(a => a.id === app.id)) {
            ordered.push(app);
          }
        });
        setOrderedApps(ordered);
      } catch {
        setOrderedApps(userApps);
      }
    } else {
      setOrderedApps(userApps);
    }
  }, [user, storageKey]);

  async function handleLogout() {
    try {
      await signOut();
      onLogout();
    } catch (error) {
      console.error('로그아웃 실패:', error);
    }
  }

  function handleAppClick(app: AppInfo) {
    if (isEditMode) return; // 편집 모드에서는 클릭 무시
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

  // 드래그 앤 드롭 핸들러
  function handleDragStart(e: React.DragEvent, index: number) {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedIndex !== null && draggedIndex !== index) {
      setDragOverIndex(index);
    }
  }

  function handleDragLeave() {
    setDragOverIndex(null);
  }

  function handleDrop(e: React.DragEvent, dropIndex: number) {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDragOverIndex(null);
      return;
    }

    const newOrder = [...orderedApps];
    const [draggedApp] = newOrder.splice(draggedIndex, 1);
    newOrder.splice(dropIndex, 0, draggedApp);
    setOrderedApps(newOrder);
    setDraggedIndex(null);
    setDragOverIndex(null);
  }

  function handleDragEnd() {
    setDraggedIndex(null);
    setDragOverIndex(null);
  }

  // 위/아래 버튼으로 이동
  function moveApp(index: number, direction: 'up' | 'down') {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= orderedApps.length) return;

    const newOrder = [...orderedApps];
    [newOrder[index], newOrder[newIndex]] = [newOrder[newIndex], newOrder[index]];
    setOrderedApps(newOrder);
  }

  // 순서 저장
  function handleSaveOrder() {
    const orderIds = orderedApps.map(app => app.id);
    localStorage.setItem(storageKey, JSON.stringify(orderIds));
    setIsEditMode(false);
  }

  // 편집 취소
  function handleCancelEdit() {
    const savedOrder = localStorage.getItem(storageKey);
    const userApps = APPS.filter((app) => hasPermission(user, app.id));

    if (savedOrder) {
      try {
        const orderIds: string[] = JSON.parse(savedOrder);
        const ordered: AppInfo[] = [];
        orderIds.forEach(id => {
          const app = userApps.find(a => a.id === id);
          if (app) ordered.push(app);
        });
        userApps.forEach(app => {
          if (!ordered.find(a => a.id === app.id)) {
            ordered.push(app);
          }
        });
        setOrderedApps(ordered);
      } catch {
        setOrderedApps(userApps);
      }
    } else {
      setOrderedApps(userApps);
    }
    setIsEditMode(false);
  }

  // 기본 순서로 초기화
  function handleResetOrder() {
    const userApps = APPS.filter((app) => hasPermission(user, app.id));
    setOrderedApps(userApps);
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
        <div className="section-header">
          <h2 className="section-title">서비스 목록</h2>
          {!isEditMode ? (
            <button
              className="edit-order-button"
              onClick={() => setIsEditMode(true)}
            >
              ✏️ 순서 편집
            </button>
          ) : (
            <div className="edit-actions">
              <button className="reset-button" onClick={handleResetOrder}>
                초기화
              </button>
              <button className="cancel-button" onClick={handleCancelEdit}>
                취소
              </button>
              <button className="save-button" onClick={handleSaveOrder}>
                저장
              </button>
            </div>
          )}
        </div>

        {isEditMode && (
          <div className="edit-hint">
            드래그하거나 화살표 버튼으로 앱 순서를 변경하세요
          </div>
        )}

        <div className={`apps-grid ${isEditMode ? 'edit-mode' : ''}`}>
          {orderedApps.map((app, index) => (
            <div
              key={app.id}
              className={`app-card ${isEditMode ? 'draggable' : ''} ${draggedIndex === index ? 'dragging' : ''} ${dragOverIndex === index ? 'drag-over' : ''}`}
              onClick={() => handleAppClick(app)}
              style={{ borderColor: app.color }}
              draggable={isEditMode}
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
            >
              {isEditMode && (
                <div className="order-controls">
                  <button
                    className="order-button"
                    onClick={(e) => { e.stopPropagation(); moveApp(index, 'up'); }}
                    disabled={index === 0}
                  >
                    ▲
                  </button>
                  <span className="order-number">{index + 1}</span>
                  <button
                    className="order-button"
                    onClick={(e) => { e.stopPropagation(); moveApp(index, 'down'); }}
                    disabled={index === orderedApps.length - 1}
                  >
                    ▼
                  </button>
                </div>
              )}
              <div className="app-icon">{app.icon}</div>
              <h3 className="app-name">{app.name}</h3>
              <p className="app-description">{app.description}</p>
            </div>
          ))}
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
