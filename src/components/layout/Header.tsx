import React from 'react';
import { Bell, Menu, LogOut, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/contexts/AuthContext';
import { useHotel } from '@/contexts/HotelContext';
import { useI18n } from '@/contexts/I18nContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

interface HeaderProps {
  onToggleSidebar: () => void;
  mobileMenuOpen?: boolean;
}

export const Header = ({ onToggleSidebar, mobileMenuOpen = false }: HeaderProps) => {
  const { profile, signOut } = useAuth();
  const { hotel, managedHotels, switchHotel } = useHotel();
  const { t } = useI18n();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <header className="h-14 border-b bg-card flex items-center justify-between px-4 sticky top-0 z-40">
      <Button variant="ghost" size="icon" onClick={onToggleSidebar}>
        <Menu className="h-5 w-5" />
      </Button>

      <div className="flex items-center gap-2">
        {managedHotels.length > 1 && (
          <Select
            value={hotel?.id || ''}
            onValueChange={async (hotelId) => {
              try {
                await switchHotel(hotelId);
                navigate('/dashboard');
              } catch (error: any) {
                toast.error(error?.message || 'Impossible de changer d\'hôtel');
              }
            }}
          >
            <SelectTrigger className="w-[200px] h-9">
              <SelectValue placeholder="Choisir hôtel" />
            </SelectTrigger>
            <SelectContent>
              {managedHotels.map((managedHotel) => (
                <SelectItem key={managedHotel.id} value={managedHotel.id}>{managedHotel.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')} title={t('header.notifications')}>
          <Bell className="h-5 w-5" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2">
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">{profile?.full_name || profile?.email}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => navigate('/settings')}>
              {t('header.settings')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
              <LogOut className="h-4 w-4 mr-2" />
              {t('auth.logout')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};
