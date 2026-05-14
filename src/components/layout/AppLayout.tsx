import React, { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useI18n } from '@/contexts/I18nContext';
import { useHotel } from '@/contexts/HotelContext';
import { useStayAccrualSync } from '@/hooks/useStayAccrualSync';
import { useQueryRefresh } from '@/hooks/useQueryRefresh';
import { processOfflineSubmissionQueue, getOfflineSubmissionQueueSize } from '@/services/offlineSubmissionQueue';
import { toast } from 'sonner';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { Badge } from '@/components/ui/badge';
import { useIsMobile } from '@/hooks/use-mobile';

export const AppLayout = () => {
  const { t } = useI18n();
  const { hotel } = useHotel();
  const location = useLocation();
  const isMobile = useIsMobile();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(() => window.navigator.onLine);
  const [queueSize, setQueueSize] = useState(() => getOfflineSubmissionQueueSize());

  useStayAccrualSync(hotel?.id);
  useQueryRefresh();

  useEffect(() => {
    const markOnline = () => {
      setIsOnline(true);
      processOfflineSubmissionQueue().then((result) => {
        setQueueSize(0);
        if (result.processed > 0) {
          const msg = t('common.syncSuccess');
          toast.success(msg.replace('{count}', String(result.processed)));
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
    const hotelName = hotel?.name || 'Lhoxtencer';
    document.title = section ? `${hotelName} - ${section}` : hotelName;
  }, [hotel?.name, location.pathname]);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex flex-col md:flex-row w-full bg-background">
      {/* Desktop Sidebar - Hidden on mobile */}
      <div className="hidden md:block md:sticky md:top-0 md:h-screen md:w-auto">
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      </div>

      {/* Main Content Area */}
      <div
        className={`flex-1 flex flex-col min-h-screen transition-all duration-300 md:ml-0 ${
          !isMobile ? (collapsed ? 'md:ml-16' : 'md:ml-[260px]') : ''
        }`}
      >
        <Header
          onToggleSidebar={() => {
            if (isMobile) {
              setMobileMenuOpen(!mobileMenuOpen);
            } else {
              setCollapsed(!collapsed);
            }
          }}
          mobileMenuOpen={mobileMenuOpen}
        />

        {/* Mobile Navigation Drawer */}
        {isMobile && mobileMenuOpen && (
          <div className="fixed inset-0 top-14 z-40 bg-black/50" onClick={() => setMobileMenuOpen(false)}>
            <div className="bg-sidebar text-sidebar-foreground w-80 h-full shadow-lg overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <Sidebar collapsed={false} onToggle={() => setMobileMenuOpen(false)} isDrawer />
            </div>
          </div>
        )}

        {!isOnline && (
          <div className="offline-banner flex items-center justify-between px-4 py-2">
            <span>{t('common.offlineBanner')}</span>
            {queueSize > 0 && (
              <Badge variant="destructive">{queueSize} {t('common.pending')}</Badge>
            )}
          </div>
        )}

        <main className="flex-1 overflow-auto bg-background px-4 py-6 md:px-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
