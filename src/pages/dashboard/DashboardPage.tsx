import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { BedDouble, Users, DoorOpen, UserCheck, Wallet } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/shared/PageHeader';
import { useHotel } from '@/contexts/HotelContext';
import { useRoleGuard } from '@/hooks/useRoleGuard';
import { useCashSession } from '@/hooks/useCashSession';
import { useEnsureMainCourante } from '@/hooks/useMainCourante';
import { supabase } from '@/integrations/supabase/client';
import { formatFCFA, formatFullDate } from '@/utils/formatters';
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';

const DashboardPage = () => {
  useRoleGuard(['admin','manager','receptionist','accountant','restaurant','kitchen','housekeeping']);
  const { hotel } = useHotel();
  const navigate = useNavigate();
  const hotelId = hotel?.id;

  // Auto-ensure cash session
  useCashSession();

  // Auto-populate main courante for today
  const ensureMC = useEnsureMainCourante();
  useEffect(() => {
    if (hotelId) {
      ensureMC.mutate({ hotelId, date: new Date().toISOString().split('T')[0] });
    }
  }, [hotelId]);

  const { data: rooms, isLoading: loadingRooms } = useQuery({
    queryKey: ['rooms', hotelId],
    queryFn: async () => {
      const { data } = await supabase.from('rooms').select('id, room_number, status, room_type_id, room_types(name)').eq('hotel_id', hotelId!);
      return data || [];
    },
    enabled: !!hotelId,
  });

  const { data: activeStays } = useQuery({
    queryKey: ['active-stays-count', hotelId],
    queryFn: async () => {
      const { data } = await supabase.from('stays').select('id').eq('hotel_id', hotelId!).eq('status', 'active');
      return data || [];
    },
    enabled: !!hotelId,
  });

  const { data: pendingPayments } = useQuery({
    queryKey: ['pending-payments', hotelId],
    queryFn: async () => {
      const { data } = await supabase
        .from('stays')
        .select('id, invoices(balance_due)')
        .eq('hotel_id', hotelId!)
        .eq('status', 'active');
      return (data || []).reduce((sum: number, row: any) => sum + (row.invoices?.balance_due || 0), 0);
    },
    enabled: !!hotelId,
  });

  const totalRooms = rooms?.length || 0;
  const occupiedRooms = rooms?.filter((r: any) => r.status === 'occupied').length || 0;
  const availableRooms = rooms?.filter((r: any) => r.status === 'available').length || 0;
  const presentGuests = activeStays?.length || 0;

  const stats = [
    { label: 'Total Chambres', value: totalRooms, icon: BedDouble, color: 'bg-primary/10 text-primary' },
    { label: 'Occupées', value: occupiedRooms, icon: DoorOpen, color: 'bg-destructive/10 text-destructive' },
    { label: 'Disponibles', value: availableRooms, icon: BedDouble, color: 'bg-success/10 text-success' },
    { label: 'Clients Présents', value: presentGuests, icon: UserCheck, color: 'bg-info/10 text-info' },
    { label: 'Paiements en attente', value: formatFCFA(pendingPayments || 0), icon: Wallet, color: 'bg-orange-100 text-orange-700' },
  ];

  const statusColors: Record<string, string> = {
    available: 'bg-success/20 border-success text-success',
    occupied: 'bg-destructive/20 border-destructive text-destructive',
    housekeeping: 'bg-warning/20 border-warning text-warning',
    maintenance: 'bg-info/20 border-info text-info',
    out_of_order: 'bg-muted border-muted-foreground text-muted-foreground',
  };

  return (
    <div className="page-container">
      <PageHeader
        title="Tableau de bord"
        subtitle={hotel ? `${hotel.name} — ${formatFullDate(new Date())}` : ''}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="pt-6">
              {loadingRooms ? (
                <Skeleton className="h-16 w-full" />
              ) : (
                <div className="flex items-center gap-4">
                  <div className={`stat-card-icon ${stat.color}`}>
                    <stat.icon className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-2xl font-semibold">{stat.value}</p>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">État des chambres</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingRooms ? (
            <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-3">
              {Array.from({ length: 12 }).map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-lg" />
              ))}
            </div>
          ) : rooms && rooms.length > 0 ? (
            <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-3">
              {rooms.map((room: any) => (
                <button
                  key={room.id}
                  onClick={() => navigate('/rooms')}
                  className={`rounded-lg border-2 p-3 text-center transition-all hover:scale-105 w-20 h-20 flex flex-col items-center justify-center ${statusColors[room.status] || 'bg-muted border-border'}`}
                >
                  <p className="text-lg font-bold leading-tight">{room.room_number}</p>
                  <p className="text-[10px] capitalize leading-tight">{(room as any).room_types?.name || room.status}</p>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <BedDouble className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Aucune chambre configurée</p>
              <button onClick={() => navigate('/rooms')} className="text-primary text-sm mt-1 underline">
                Ajouter des chambres
              </button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DashboardPage;
