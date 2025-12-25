import type { CSMenuType } from '../CSApp';

interface CSSidebarProps {
  activeMenu: CSMenuType;
  onMenuChange: (menu: CSMenuType) => void;
  userName: string;
  onClose: () => void;
}

interface MenuItem {
  id: CSMenuType;
  icon: string;
  label: string;
}

const MENU_ITEMS: MenuItem[] = [
  { id: 'reservation', icon: '📅', label: '예약' },
  { id: 'receipt', icon: '💰', label: '수납' },
  { id: 'prepaid', icon: '💊', label: '선결' },
  { id: 'inquiry', icon: '📝', label: '문의' },
  { id: 'search', icon: '🔍', label: '검색' },
];

function CSSidebar({ activeMenu, onMenuChange, userName, onClose }: CSSidebarProps) {
  return (
    <aside className="cs-sidebar">
      <div className="cs-sidebar-header">
        <span className="cs-sidebar-logo">🎧</span>
        <span className="cs-sidebar-title">CS관리</span>
      </div>

      <nav className="cs-sidebar-nav">
        {MENU_ITEMS.map((item) => (
          <button
            key={item.id}
            className={`cs-sidebar-item ${activeMenu === item.id ? 'active' : ''}`}
            onClick={() => onMenuChange(item.id)}
          >
            <span className="cs-sidebar-icon">{item.icon}</span>
            <span className="cs-sidebar-label">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="cs-sidebar-footer">
        <div className="cs-sidebar-user">
          <span className="cs-sidebar-user-icon">👤</span>
          <span className="cs-sidebar-user-name">{userName}</span>
        </div>
        <button className="cs-sidebar-close" onClick={onClose}>
          닫기
        </button>
      </div>
    </aside>
  );
}

export default CSSidebar;
