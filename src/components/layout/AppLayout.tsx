import React, { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useI18n } from '@/contexts/I18nContext';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

export const AppLayout = () => {
  const { t } = useI18n();
  const [collapsed, setCollapsed] = useState(false);
  const [isOnline, setIsOnline] = useState(() => window.navigator.onLine);

  useEffect(() => {
    const markOnline = () => setIsOnline(true);
    const markOffline = () => setIsOnline(false);

    window.addEventListener('online', markOnline);
    window.addEventListener('offline', markOffline);

    return () => {
      window.removeEventListener('online', markOnline);
      window.removeEventListener('offline', markOffline);
    };
  }, []);

  return (
    <div className="min-h-screen flex w-full">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      <div
        className={`flex-1 flex flex-col transition-all duration-300 ${
          collapsed ? 'ml-16' : 'ml-[260px]'
        }`}
      >
        <Header onToggleSidebar={() => setCollapsed(!collapsed)} />
        {!isOnline && (
          <div className="offline-banner">
            {t('common.offlineBanner')}
          </div>
        )}
        <main className="flex-1 overflow-auto bg-background">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
