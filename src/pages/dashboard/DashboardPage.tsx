import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { BedDouble, Users, DoorOpen, UserCheck, Wallet, ChefHat, ClipboardList, Clock  } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/shared/PageHeader';
import { useI18n } from '@/contexts/I18nContext';
import { useHotel } from '@/contexts/HotelContext';
import { useAuth } from '@/contexts/AuthContext';
import { useRoleGuard } from '@/hooks/useRoleGuard';
import { useCashSession } from '@/hooks/useCashSession';
import { useEnsureMainCourante } from '@/hooks/useMainCourante';
import { supabase } from '@/integrations/supabase/client';
import { formatFCFA, formatFullDate } from '@/utils/formatters';
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';

const DashboardPage = () => {
  useRoleGuard(['admin','manager','receptionist','accountant','restaurant','kitchen','housekeeping']);
  const { t } = useI18n();
  const { hotel } = useHotel();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const hotelId = hotel?.id;
  const userRole = profile?.role;

  // Role-based rendering
  if (userRole === 'restaurant' || userRole === 'kitchen') {
    return <RestaurantDashboard hotel={hotel} />;
  }
  if (userRole === 'housekeeping') {
    return <HousekeepingDashboard hotel={hotel} />;
  }
  if (userRole === 'accountant') {
    return <AccountantDashboard hotel={hotel} />;
  }
  
  // Default/Reception dashboard
  return <ReceptionDashboard hotel={hotel} hotelId={hotelId} t={t} navigate={navigate} />;
};

// Reception Dashboard (Admin, Manager, Receptionist)
const ReceptionDashboard = ({ hotel, hotelId, t, navigate }: any) => {
  useCashSession();
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
      const { data } = await supabase.from('stays').select('id, room_id').eq('hotel_id', hotelId!).eq('status', 'active');
      return data || [];
    },
    enabled: !!hotelId,
  });

  const activeRoomIds = new Set((activeStays || []).map((s: any) => s.room_id).filter(Boolean));
  const reconciledRooms = (rooms || []).map((room: any) => {
    if (activeRoomIds.has(room.id) && room.status !== 'occupied') {
      return { ...room, status: 'occupied' };
    }
    return room;
  });

  const { data: pendingPayments } = useQuery({
    queryKey: ['pending-payments', hotelId],
    queryFn: async () => {
      const { data } = await supabase
        .from('stays')
        .select('id, total_price, payment_status, invoices!stays_invoice_id_fkey(balance_due, amount_paid)')
        .eq('hotel_id', hotelId!)
        .eq('status', 'active');
      return (data || []).reduce((sum: number, row: any) => {
        const invoiceBalance = Number(row.invoices?.balance_due || 0);
        if (invoiceBalance > 0) {
          return sum + invoiceBalance;
        }
        if (row.payment_status === 'paid') {
          return sum;
        }
        return sum + Number(row.total_price || 0);
      }, 0);
    },
    enabled: !!hotelId,
  });

  const totalRooms = reconciledRooms.length || 0;
  const occupiedRooms = reconciledRooms.filter((r: any) => r.status === 'occupied').length || 0;
  const availableRooms = reconciledRooms.filter((r: any) => r.status === 'available').length || 0;
  const presentGuests = activeStays?.length || 0;

  const stats = [
    { label: t('dashboard.stats.totalRooms'), value: totalRooms, icon: BedDouble, color: 'bg-primary/10 text-primary' },
    { label: t('dashboard.stats.occupied'), value: occupiedRooms, icon: DoorOpen, color: 'bg-destructive/10 text-destructive' },
    { label: t('dashboard.stats.available'), value: availableRooms, icon: BedDouble, color: 'bg-success/10 text-success' },
    { label: t('dashboard.stats.presentGuests'), value: presentGuests, icon: UserCheck, color: 'bg-info/10 text-info' },
    { label: t('dashboard.stats.pendingPayments'), value: formatFCFA(pendingPayments || 0), icon: Wallet, color: 'bg-orange-100 text-orange-700' },
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
        title={t('dashboard.title')}
        subtitle={hotel ? `${hotel.name} — ${formatFullDate(new Date())}` : ''}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4 mb-6">
        {stats.map((stat) => (
          <Card key={stat.label} className="border-border/60 shadow-sm">
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

      <Card className="border-border/60 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">{t('dashboard.roomsState')}</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingRooms ? (
            <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-3">
              {Array.from({ length: 12 }).map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-lg" />
              ))}
            </div>
          ) : reconciledRooms && reconciledRooms.length > 0 ? (
            <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-3">
              {reconciledRooms.map((room: any) => (
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
              <p>{t('dashboard.emptyRooms')}</p>
              <button onClick={() => navigate('/rooms')} className="text-primary text-sm mt-1 underline">
                {t('dashboard.addRooms')}
              </button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

// Restaurant/Kitchen Dashboard
const RestaurantDashboard = ({ hotel }: any) => {
  const { t } = useI18n();
  const hotelId = hotel?.id;

  const { data: pendingOrders } = useQuery({
    queryKey: ['pending-orders', hotelId],
    queryFn: async () => {
      const { data } = await supabase
        .from('restaurant_orders')
        .select('id, stay_id, total_amount, status, created_at, stays(room_id, rooms(room_number))')
        .eq('hotel_id', hotelId!)
        .in('status', ['pending', 'preparing'])
        .order('created_at');
      return data || [];
    },
    enabled: !!hotelId,
  });

  return (
    <div className="page-container space-y-6">
      <PageHeader 
        title="Restaurant Dashboard" 
        subtitle={`${hotel?.name || ''} — Commandes en attente`}
      />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><ChefHat className="h-5 w-5" />Commandes en attente</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{pendingOrders?.length || 0}</p></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Total à préparer</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold text-primary">{formatFCFA((pendingOrders || []).reduce((s: number, o: any) => s + (o.total_amount || 0), 0))}</p></CardContent>
        </Card>
      </div>
      {pendingOrders && pendingOrders.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Commandes</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(pendingOrders as any[]).map((order) => (
                <div key={order.id} className="flex justify-between items-center p-3 border rounded-lg">
                  <div><p className="font-medium">Chambre {order.stays?.rooms?.room_number}</p><p className="text-sm text-muted-foreground">{formatFCFA(order.total_amount)}</p></div>
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-sm">{order.status}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

// Housekeeping Dashboard
const HousekeepingDashboard = ({ hotel }: any) => {
  const { t } = useI18n();
  const hotelId = hotel?.id;

  const { data: housekeepingTasks } = useQuery({
    queryKey: ['housekeeping-tasks', hotelId],
    queryFn: async () => {
      const { data } = await supabase
        .from('housekeeping_tasks')
        .select('id, room_id, status, priority, assigned_to, rooms(room_number), profiles!housekeeping_tasks_assigned_to_fkey(full_name)')
        .eq('hotel_id', hotelId!)
        .in('status', ['pending', 'in_progress'])
        .order('priority');
      return data || [];
    },
    enabled: !!hotelId,
  });

  return (
    <div className="page-container space-y-6">
      <PageHeader 
        title="Housekeeping Dashboard" 
        subtitle={`${hotel?.name || ''} — Tâches en cours`}
      />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Clock  className="h-5 w-5" />Tâches en attente</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{housekeepingTasks?.filter((t: any) => t.status === 'pending').length || 0}</p></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><ClipboardList className="h-5 w-5" />En cours</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold text-warning">{housekeepingTasks?.filter((t: any) => t.status === 'in_progress').length || 0}</p></CardContent>
        </Card>
      </div>
      {housekeepingTasks && housekeepingTasks.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Tâches assignées</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(housekeepingTasks as any[]).map((task) => (
                <div key={task.id} className="flex justify-between items-center p-3 border rounded-lg">
                  <div><p className="font-medium">Chambre {task.rooms?.room_number}</p><p className="text-sm text-muted-foreground">{task.profiles?.full_name || 'Non assigné'}</p></div>
                  <span className={`px-2 py-1 rounded text-sm ${task.status === 'pending' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>{task.status}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

// Accountant Dashboard
const AccountantDashboard = ({ hotel }: any) => {
  const { t } = useI18n();
  const hotelId = hotel?.id;

  const { data: financialStats } = useQuery({
    queryKey: ['financial-stats', hotelId],
    queryFn: async () => {
      const { data: invoices } = await supabase
        .from('invoices')
        .select('total_amount, amount_paid, balance_due, status')
        .eq('hotel_id', hotelId!);
      
      return {
        totalRevenue: (invoices || []).reduce((s: number, i: any) => s + (i.total_amount || 0), 0),
        totalPaid: (invoices || []).reduce((s: number, i: any) => s + (i.amount_paid || 0), 0),
        totalBalance: (invoices || []).reduce((s: number, i: any) => s + (i.balance_due || 0), 0),
        unpaidInvoices: (invoices || []).filter(i => i.balance_due > 0).length,
      };
    },
    enabled: !!hotelId,
  });

  return (
    <div className="page-container space-y-6">
      <PageHeader 
        title="Accountant Dashboard" 
        subtitle={`${hotel?.name || ''} — Rapport financier`}
      />
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-sm text-muted-foreground">Total Revenu</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{formatFCFA(financialStats?.totalRevenue || 0)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm text-muted-foreground">Total Payé</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-success">{formatFCFA(financialStats?.totalPaid || 0)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm text-muted-foreground">Solde dû</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-destructive">{formatFCFA(financialStats?.totalBalance || 0)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm text-muted-foreground">Factures impayées</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{financialStats?.unpaidInvoices || 0}</p></CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DashboardPage;
