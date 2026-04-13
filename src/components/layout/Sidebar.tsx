import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, CalendarCheck, CalendarDays, BedDouble, LogIn,
  Coffee, BookOpen, UtensilsCrossed, ChefHat, Package,
  Receipt, Wallet, Sparkles, BarChart3,
  MessageSquare, QrCode, Settings, ScrollText, Building2,
  Globe, Layers, CreditCard, UserPlus
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useHotel } from '@/contexts/HotelContext';
import { useI18n } from '@/contexts/I18nContext';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';

const navGroups = [
  {
    label: 'Réception',
    items: [
      { key: 'nav.accueil', path: '/accueil', icon: UserPlus, roles: ['admin','manager','receptionist'] },
      { key: 'nav.dashboard', path: '/dashboard', icon: LayoutDashboard, roles: ['admin','manager','receptionist','accountant','restaurant','kitchen','housekeeping'] },
      { key: 'nav.guests', path: '/guests', icon: Users, roles: ['admin','manager','receptionist'] },
      { key: 'nav.reservations', path: '/reservations', icon: CalendarCheck, roles: ['admin','manager','receptionist'] },
      { key: 'nav.calendar', path: '/calendar', icon: CalendarDays, roles: ['admin','manager','receptionist'] },
      { key: 'nav.rooms', path: '/rooms', icon: BedDouble, roles: ['admin','manager','receptionist'] },
      { key: 'nav.categories', path: '/room-categories', icon: Layers, roles: ['admin','manager'] },
      { key: 'nav.checkinout', path: '/check-in-out', icon: LogIn, roles: ['admin','manager','receptionist'] },
      { key: 'nav.siestes', path: '/siestes', icon: Coffee, roles: ['admin','manager','receptionist'] },
      { key: 'nav.maincourante', path: '/main-courante', icon: BookOpen, roles: ['admin','manager','receptionist'] },
    ],
  },
  {
    label: 'Opérations',
    items: [
      { key: 'nav.restaurant', path: '/restaurant', icon: UtensilsCrossed, roles: ['admin','manager','receptionist','restaurant'] },
      { key: 'nav.kitchen', path: '/kitchen', icon: ChefHat, roles: ['admin','manager','kitchen'] },
      { key: 'nav.inventory', path: '/inventory', icon: Package, roles: ['admin','manager','receptionist'] },
      { key: 'nav.housekeeping', path: '/housekeeping', icon: Sparkles, roles: ['admin','manager','housekeeping'] },
    ],
  },
  {
    label: 'Finance',
    items: [
      { key: 'nav.cashexpenses', path: '/cash-expenses', icon: Wallet, roles: ['admin','manager','receptionist','accountant'] },
      { key: 'nav.billing', path: '/billing', icon: Receipt, roles: ['admin','manager','receptionist','accountant'] },
    ],
  },
  {
    label: 'Gestion',
    items: [
      { key: 'nav.reports', path: '/reports', icon: BarChart3, roles: ['admin','manager','accountant'] },
      { key: 'nav.feedback', path: '/feedback', icon: MessageSquare, roles: ['admin','manager'] },
      { key: 'nav.qrcodes', path: '/qr-codes', icon: QrCode, roles: ['admin','manager'] },
      { key: 'nav.audit', path: '/audit', icon: ScrollText, roles: ['admin','manager'] },
    ],
  },
  {
    label: 'Configuration',
    items: [
      { key: 'nav.settings', path: '/settings', icon: Settings, roles: ['admin','manager'] },
    ],
  },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export const Sidebar = ({ collapsed, onToggle }: SidebarProps) => {
  const { profile } = useAuth();
  const { hotel } = useHotel();
  const { t, lang, setLang } = useI18n();
  const location = useLocation();

  return (
    <aside
      className={`fixed left-0 top-0 h-screen bg-sidebar text-sidebar-foreground flex flex-col z-50 transition-all duration-300 ${
        collapsed ? 'w-16' : 'w-[260px]'
      }`}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-sidebar-border">
        <Building2 className="h-8 w-8 text-sidebar-primary shrink-0" />
        {!collapsed && (
          <div className="overflow-hidden">
            <h1 className="text-lg font-semibold truncate">HôtelManager Pro</h1>
            {hotel && <p className="text-xs text-sidebar-foreground/60 truncate">{hotel.name}</p>}
          </div>
        )}
      </div>

      {/* Nav */}
      <ScrollArea className="flex-1 py-2">
        <nav className="sidebar-nav px-2">
          {navGroups.map((group) => {
            const visibleItems = group.items.filter(item =>
              profile?.is_super_admin || item.roles.includes(profile?.role || '')
            );
            if (visibleItems.length === 0) return null;
            return (
              <div key={group.label} className="mb-3">
                {!collapsed && (
                  <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
                    {group.label}
                  </p>
                )}
                {visibleItems.map((item) => {
                  const active = location.pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`sidebar-link ${active ? 'active' : ''}`}
                      title={collapsed ? t(item.key) : undefined}
                    >
                      <item.icon className="h-5 w-5 shrink-0" />
                      {!collapsed && <span className="truncate">{t(item.key)}</span>}
                    </Link>
                  );
                })}
              </div>
            );
          })}
          {profile?.is_super_admin && (
            <Link
              to="/superadmin"
              className={`sidebar-link ${location.pathname.startsWith('/superadmin') ? 'active' : ''}`}
            >
              <Globe className="h-5 w-5 shrink-0" />
              {!collapsed && <span>Super Admin</span>}
            </Link>
          )}
        </nav>
      </ScrollArea>

      {/* Footer */}
      <div className="px-3 py-3 border-t border-sidebar-border space-y-2">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className={`text-xs ${lang === 'fr' ? 'text-sidebar-primary' : 'text-sidebar-foreground/60'}`}
              onClick={() => setLang('fr')}
            >
              FR
            </Button>
            <span className="text-sidebar-foreground/30">|</span>
            <Button
              variant="ghost"
              size="sm"
              className={`text-xs ${lang === 'en' ? 'text-sidebar-primary' : 'text-sidebar-foreground/60'}`}
              onClick={() => setLang('en')}
            >
              EN
            </Button>
          </div>
        )}
      </div>
    </aside>
  );
};
