import React, { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useI18n } from '@/contexts/I18nContext';
import { useHotel } from '@/contexts/HotelContext';
import { useStayAccrualSync } from '@/hooks/useStayAccrualSync';
import { processOfflineSubmissionQueue } from '@/services/offlineSubmissionQueue';
import { toast } from 'sonner';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

export const AppLayout = () => {
  const { t } = useI18n();
  const { hotel } = useHotel();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [isOnline, setIsOnline] = useState(() => window.navigator.onLine);

  useStayAccrualSync(hotel?.id);

  useEffect(() => {
    const markOnline = () => {
      setIsOnline(true);
      processOfflineSubmissionQueue().then((result) => {
        if (result.processed > 0) {
          toast.success(`${result.processed} enregistrement(s) synchronise(s)`);
        }
      }).catch(() => undefined);
    };
    const markOffline = () => setIsOnline(false);

    window.addEventListener('online', markOnline);
    window.addEventListener('offline', markOffline);

    return () => {
      window.removeEventListener('online', markOnline);
      window.removeEventListener('offline', markOffline);
    };
  }, []);

  useEffect(() => {
    if (!isOnline) return;
    const timer = window.setInterval(() => {
      processOfflineSubmissionQueue().catch(() => undefined);
    }, 20000);
    return () => window.clearInterval(timer);
  }, [isOnline]);

  useEffect(() => {
    const section = location.pathname
      .split('/')
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' / ');
    const hotelName = hotel?.name || 'Hotel Harmony';
    document.title = section ? `${hotelName} - ${section}` : hotelName;
  }, [hotel?.name, location.pathname]);

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
