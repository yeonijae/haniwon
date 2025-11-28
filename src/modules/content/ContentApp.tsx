/**
 * 컨텐츠 관리 시스템
 * 블로그, 안내페이지, 랜딩페이지, 이벤트DM 관리
 */

import React, { useState } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import type { PortalUser } from '@shared/types';
import { ROLE_LABELS } from '@shared/types';

// Pages
import GuideManagement from './pages/GuideManagement';
import LandingManagement from './pages/LandingManagement';
import EventDMManagement from './pages/EventDMManagement';
import YouTubeManagement from './pages/YouTubeManagement';
import StorageManagement from './pages/StorageManagement';
import MediaManagement from './pages/MediaManagement';

// Blog Pages (기존 blog 모듈에서 가져옴)
import BlogManagePage from '../blog/pages/BlogManagePage';
import BlogEditPage from '../blog/pages/BlogEditPage';

interface ContentAppProps {
  user: PortalUser;
}

type ViewMode = 'blog' | 'guide' | 'landing' | 'event_dm' | 'youtube' | 'media' | 'settings';

const ContentApp: React.FC<ContentAppProps> = ({ user }) => {
  const navigate = useNavigate();
  const location = useLocation();

  // URL에서 현재 viewMode 결정
  const getViewModeFromPath = (): ViewMode => {
    const path = location.pathname;
    if (path.includes('/content/youtube')) return 'youtube';
    if (path.includes('/content/guide')) return 'guide';
    if (path.includes('/content/landing')) return 'landing';
    if (path.includes('/content/event')) return 'event_dm';
    if (path.includes('/content/media')) return 'media';
    if (path.includes('/content/settings')) return 'settings';
    return 'blog';
  };

  const [viewMode, setViewMode] = useState<ViewMode>(getViewModeFromPath());

  const menuItems = [
    { id: 'blog' as ViewMode, icon: 'fa-solid fa-pen-fancy', label: '블로그' },
    { id: 'youtube' as ViewMode, icon: 'fa-brands fa-youtube', label: '유튜브' },
    { id: 'guide' as ViewMode, icon: 'fa-solid fa-book-open', label: '안내페이지' },
    { id: 'landing' as ViewMode, icon: 'fa-solid fa-rocket', label: '랜딩페이지' },
    { id: 'event_dm' as ViewMode, icon: 'fa-solid fa-gift', label: '이벤트DM' },
    { id: 'media' as ViewMode, icon: 'fa-solid fa-photo-film', label: '미디어' },
    { id: 'settings' as ViewMode, icon: 'fa-solid fa-cog', label: '설정' },
  ];

  return (
    <div className="h-screen bg-gray-100 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-white shadow-md flex items-center px-4 py-2 flex-shrink-0">
        {/* 왼쪽 영역 - 로고 및 제목 */}
        <div
          className="flex items-center cursor-pointer hover:opacity-80 transition-opacity"
          onClick={() => navigate('/')}
          role="button"
          aria-label="포털로 이동"
        >
          <i className="fas fa-newspaper text-3xl text-rose-500 mr-3"></i>
          <div className="flex flex-col">
            <h1 className="text-2xl font-bold text-rose-500">컨텐츠 관리</h1>
            <p className="text-xs text-gray-400 -mt-0.5">연이재한의원</p>
          </div>
        </div>

        {/* 오른쪽 - 뷰 전환 버튼 */}
        <nav className="flex items-center space-x-2 ml-auto">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setViewMode(item.id);
                // 해당 섹션으로 라우팅
                const paths: Record<ViewMode, string> = {
                  blog: '/content/blog',
                  youtube: '/content/youtube',
                  guide: '/content/guide',
                  landing: '/content/landing',
                  event_dm: '/content/event',
                  media: '/content/media',
                  settings: '/content/settings',
                };
                navigate(paths[item.id]);
              }}
              className={`flex flex-col items-center justify-center px-3 py-2 text-sm font-medium rounded-lg transition-colors duration-200 w-24 ${
                viewMode === item.id
                  ? 'bg-rose-500 text-white'
                  : 'text-gray-500 hover:bg-gray-100 hover:text-rose-500'
              }`}
            >
              <i className={`${item.icon} text-xl mb-1`}></i>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        {/* 사용자 정보 */}
        <div className="flex items-center space-x-3 ml-4">
          <div className="text-right">
            <p className="font-semibold text-sm text-gray-800">{user?.name || '관리자'}</p>
            <p className="text-xs text-gray-500">
              {user?.role ? ROLE_LABELS[user.role] : '연이재한의원'}
            </p>
          </div>
          <button
            onClick={() => window.close()}
            className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-100 text-gray-500 hover:bg-red-100 hover:text-red-600 transition-colors"
            title="닫기"
            aria-label="닫기"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden overflow-y-auto">
        <Routes>
          {/* 블로그 관리 */}
          <Route path="/" element={<BlogManagePage embedded />} />
          <Route path="/blog" element={<BlogManagePage embedded />} />
          <Route path="/blog/new" element={<BlogEditPage />} />
          <Route path="/blog/edit/:id" element={<BlogEditPage />} />

          {/* 유튜브 관리 */}
          <Route path="/youtube" element={<YouTubeManagement />} />

          {/* 안내페이지 관리 */}
          <Route path="/guide" element={<GuideManagement />} />

          {/* 랜딩페이지 관리 */}
          <Route path="/landing" element={<LandingManagement />} />

          {/* 이벤트DM 관리 */}
          <Route path="/event" element={<EventDMManagement />} />

          {/* 미디어 관리 */}
          <Route path="/media" element={<MediaManagement />} />

          {/* 설정 (스토리지 관리) */}
          <Route path="/settings" element={<StorageManagement />} />
        </Routes>
      </div>
    </div>
  );
};

export default ContentApp;
