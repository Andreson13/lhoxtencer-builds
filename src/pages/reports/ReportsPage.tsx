import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useHotel } from '@/contexts/HotelContext';
import { useI18n } from '@/contexts/I18nContext';
import { useRoleGuard } from '@/hooks/useRoleGuard';
import { usePermission } from '@/hooks/usePermission';
import { PageHeader } from '@/components/shared/PageHeader';
import { formatFCFA } from '@/utils/formatters';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Button } from '@/components/ui/button';
import { TierBadge } from '@/components/shared/TierBadge';
import { generateDailyReport, generateMonthlyReport, generateWeeklyReport } from '@/utils/pdfGenerators';
import { toast } from 'sonner';

const COLORS = ['hsl(var(--primary))', 'hsl(var(--destructive))', '#f59e0b', '#10b981', '#6366f1', '#ec4899'];

const ReportsPage = () => {
  const { t, lang } = useI18n();
  useRoleGuard(['admin', 'manager', 'accountant']);
  const { hotel } = useHotel();
  const canExportReports = usePermission('reports.export');
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());

  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`;

  const { data: rooms } = useQuery({
    queryKey: ['report-rooms', hotel?.id],
    queryFn: async () => {
      const { data } = await supabase.from('rooms').select('id, room_number, status').eq('hotel_id', hotel!.id);
      return data || [];
    },
    enabled: !!hotel?.id,
  });

  const { data: stays } = useQuery({
    queryKey: ['report-stays', hotel?.id, month, year],
    queryFn: async () => {
      const { data } = await supabase.from('stays').select('*, guests(last_name, first_name), rooms(room_number)').eq('hotel_id', hotel!.id).gte('check_in_date', startDate).lt('check_in_date', endDate);
      return data || [];
    },
    enabled: !!hotel?.id,
  });

  const { data: invoices } = useQuery({
    queryKey: ['report-invoices', hotel?.id, month, year],
    queryFn: async () => {
      const { data } = await supabase.from('invoices').select('*').eq('hotel_id', hotel!.id).gte('created_at', startDate).lt('created_at', endDate);
      return data || [];
    },
    enabled: !!hotel?.id,
  });

  const { data: orders } = useQuery({
    queryKey: ['report-orders', hotel?.id, month, year],
    queryFn: async () => {
      const { data } = await supabase
        .from('restaurant_orders')
        .select('*, guests(first_name, last_name), rooms(room_number), restaurant_order_items(*, restaurant_items(name, category_id, restaurant_categories(name)))')
        .eq('hotel_id', hotel!.id)
        .gte('created_at', startDate)
        .lt('created_at', endDate);
      return data || [];
    },
    enabled: !!hotel?.id,
  });

  const { data: mainCouranteRows } = useQuery({
    queryKey: ['report-main-courante', hotel?.id, month, year],
    queryFn: async () => {
      const { data } = await supabase
        .from('main_courante')
        .select('ca_total_jour, encaissement')
        .eq('hotel_id', hotel!.id)
        .gte('journee', startDate)
        .lt('journee', endDate);
      return data || [];
    },
    enabled: !!hotel?.id,
  });

  const { data: expenses } = useQuery({
    queryKey: ['report-expenses', hotel?.id, month, year],
    queryFn: async () => {
      const { data } = await supabase.from('expenses').select('*, expense_categories(name)').eq('hotel_id', hotel!.id).gte('expense_date', startDate).lt('expense_date', endDate);
      return data || [];
    },
    enabled: !!hotel?.id,
  });

  const { data: cashSessions } = useQuery({
    queryKey: ['report-cash', hotel?.id, month, year],
    queryFn: async () => {
      const { data } = await supabase.from('cash_sessions').select('*').eq('hotel_id', hotel!.id).gte('opened_at', startDate).lt('opened_at', endDate).order('opened_at');
      return data || [];
    },
    enabled: !!hotel?.id,
  });

  const totalRooms = rooms?.length || 0;
  const occupiedRooms = rooms?.filter(r => r.status === 'occupied').length || 0;
  const occupancyRate = totalRooms ? Math.round((occupiedRooms / totalRooms) * 100) : 0;
  const totalRevenue = invoices?.reduce((s, i) => s + (i.total_amount || 0), 0) || 0;
  const totalPaid = invoices?.reduce((s, i) => s + (i.amount_paid || 0), 0) || 0;
  const totalCheckIns = stays?.length || 0;
  const totalCheckOuts = stays?.filter(s => s.status === 'checked_out').length || 0;
  const totalNightsSold = stays?.reduce((s, st) => s + (st.number_of_nights || 0), 0) || 0;
  const mainCouranteCA = mainCouranteRows?.reduce((sum, row) => sum + (row.ca_total_jour || 0), 0) || 0;
  const mainCouranteEncaissement = mainCouranteRows?.reduce((sum, row) => sum + (row.encaissement || 0), 0) || 0;

  const restaurantRevenue = orders?.reduce((s, o) => s + (o.total_amount || 0), 0) || 0;
  const avgOrderValue = orders?.length ? Math.round(restaurantRevenue / orders.length) : 0;

  const approvedExpenses = expenses?.filter(e => e.approval_status === 'approved') || [];
  const totalExpenses = approvedExpenses.reduce((s, e) => s + (e.amount || 0), 0);
  const netProfit = totalPaid - totalExpenses;

  const expenseByCat = approvedExpenses.reduce((acc: Record<string, number>, e) => {
    const cat = (e as any).expense_categories?.name || 'Non catégorisé';
    acc[cat] = (acc[cat] || 0) + e.amount;
    return acc;
  }, {});
  const expensePieData = Object.entries(expenseByCat).map(([name, value]) => ({ name, value }));

  // Top rooms by stays
  const topRooms = React.useMemo(() => {
    if (!stays?.length) return [];
    const map: Record<string, { room_number: string; stays: number; nights: number }> = {};
    for (const s of stays) {
      const rn = (s as any).rooms?.room_number || 'N/A';
      if (!map[rn]) map[rn] = { room_number: rn, stays: 0, nights: 0 };
      map[rn].stays += 1;
      map[rn].nights += s.number_of_nights || 0;
    }
    return Object.values(map).sort((a, b) => b.stays - a.stays).slice(0, 10);
  }, [stays]);

  const topRoomCategories = React.useMemo(() => {
    if (!stays?.length) return [];
    const map: Record<string, { category: string; stays: number; nights: number }> = {};
    for (const s of stays) {
      const category = (s as any).rooms?.room_categories?.name || 'Non catégorisé';
      if (!map[category]) map[category] = { category, stays: 0, nights: 0 };
      map[category].stays += 1;
      map[category].nights += Number(s.number_of_nights || 0);
    }
    return Object.values(map).sort((a, b) => b.stays - a.stays).slice(0, 10);
  }, [stays]);

  // Top food items by order count
  const topFoodItems = React.useMemo(() => {
    if (!orders?.length) return [];
    const map: Record<string, { name: string; count: number; revenue: number }> = {};
    for (const o of orders) {
      for (const item of (o as any).restaurant_order_items || []) {
        const name = item.restaurant_items?.name || 'Inconnu';
        if (!map[name]) map[name] = { name, count: 0, revenue: 0 };
        map[name].count += item.quantity || 1;
        map[name].revenue += (item.unit_price || 0) * (item.quantity || 1);
      }
    }
    return Object.values(map).sort((a, b) => b.count - a.count).slice(0, 10);
  }, [orders]);

  const { topFoodOnlyItems, topDrinkItems } = React.useMemo(() => {
    if (!orders?.length) return { topFoodOnlyItems: [], topDrinkItems: [] };

    const foodMap: Record<string, { name: string; count: number; revenue: number }> = {};
    const drinkMap: Record<string, { name: string; count: number; revenue: number }> = {};

    const isDrinkCategory = (categoryName: string) => {
      const label = categoryName.toLowerCase();
      return label.includes('boisson') || label.includes('drink') || label.includes('jus') || label.includes('vin') || label.includes('biere') || label.includes('beer') || label.includes('cocktail') || label.includes('soda');
    };

    for (const o of orders) {
      for (const item of (o as any).restaurant_order_items || []) {
        const name = item.restaurant_items?.name || 'Inconnu';
        const categoryName = item.restaurant_items?.restaurant_categories?.name || '';
        const target = isDrinkCategory(categoryName) ? drinkMap : foodMap;
        if (!target[name]) target[name] = { name, count: 0, revenue: 0 };
        target[name].count += Number(item.quantity || 1);
        target[name].revenue += Number(item.unit_price || 0) * Number(item.quantity || 1);
      }
    }

    return {
      topFoodOnlyItems: Object.values(foodMap).sort((a, b) => b.count - a.count).slice(0, 10),
      topDrinkItems: Object.values(drinkMap).sort((a, b) => b.count - a.count).slice(0, 10),
    };
  }, [orders]);

  // Top spending guests
  const { data: topGuests = [] } = useQuery({
    queryKey: ['report-top-guests', hotel?.id, month, year],
    queryFn: async () => {
      const { data } = await supabase
        .from('stays')
        .select('guest_id, guests(first_name, last_name, tier, loyalty_points), invoices(total_amount)')
        .eq('hotel_id', hotel!.id)
        .gte('check_in_date', startDate)
        .lt('check_in_date', endDate);
      if (!data) return [];
      const map: Record<string, { name: string; tier: string; loyalty_points: number; total: number }> = {};
      for (const s of data) {
        const g = (s as any).guests;
        if (!g) continue;
        const id = s.guest_id;
        if (!map[id]) map[id] = { name: `${g.last_name} ${g.first_name}`, tier: g.tier || 'regular', loyalty_points: g.loyalty_points || 0, total: 0 };
        for (const inv of (s as any).invoices || []) map[id].total += inv.total_amount || 0;
      }
      return Object.values(map).sort((a, b) => b.total - a.total).slice(0, 10);
    },
    enabled: !!hotel?.id,
  });

  // Tier distribution
  const { data: tierDistribution = [] } = useQuery({
    queryKey: ['report-tier-dist', hotel?.id],
    queryFn: async () => {
      const { data } = await supabase.from('guests').select('tier').eq('hotel_id', hotel!.id);
      if (!data) return [];
      const map: Record<string, number> = {};
      for (const g of data) { const t2 = g.tier || 'regular'; map[t2] = (map[t2] || 0) + 1; }
      return Object.entries(map).map(([name, value]) => ({ name, value }));
    },
    enabled: !!hotel?.id,
  });

  const roomStatusData = [
    { name: t('status.available'), value: rooms?.filter(r => r.status === 'available').length || 0 },
    { name: t('status.occupied'), value: occupiedRooms },
    { name: t('status.housekeeping'), value: rooms?.filter(r => r.status === 'housekeeping').length || 0 },
    { name: t('status.maintenance'), value: rooms?.filter(r => r.status === 'maintenance').length || 0 },
  ].filter(d => d.value > 0);

  const months = lang === 'fr'
    ? ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']
    : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const weeklyRange = React.useMemo(() => {
    const now = new Date();
    const day = now.getDay();
    const diff = day === 0 ? 6 : day - 1;
    const start = new Date(now);
    start.setDate(now.getDate() - diff);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return {
      start: start.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10),
    };
  }, []);

  const reportPayload = {
    summary: {
      occupancyRate,
      totalCheckIns,
      totalRevenue,
      totalPaid,
      totalExpenses,
      netProfit,
      restaurantRevenue,
    },
    topRooms,
    topFoodItems,
    topGuests,
  };

  const handleWeeklyReport = () => {
    if (!hotel) return;
    try {
      generateWeeklyReport(hotel, weeklyRange, reportPayload);
      toast.success('Rapport hebdomadaire généré');
    } catch (e: any) {
      toast.error(e.message || 'Erreur génération rapport hebdomadaire');
    }
  };

  const handleDailyReport = () => {
    if (!hotel) return;
    const today = new Date().toISOString().slice(0, 10);
    try {
      generateDailyReport(hotel, { start: today, end: today }, reportPayload);
      toast.success('Rapport journalier généré');
    } catch (e: any) {
      toast.error(e.message || 'Erreur génération rapport journalier');
    }
  };

  const handleMonthlyReport = () => {
    if (!hotel) return;
    try {
      generateMonthlyReport(hotel, { start: startDate, end: endDate }, reportPayload);
      toast.success('Rapport mensuel généré');
    } catch (e: any) {
      toast.error(e.message || 'Erreur génération rapport mensuel');
    }
  };

  return (
    <div className="page-container space-y-6">
      <PageHeader title={t('reports.title')} subtitle={t('reports.subtitle')}>
        <div className="flex gap-2 flex-wrap justify-end">
          {canExportReports && <Button variant="outline" onClick={handleDailyReport}>Télécharger rapport journalier</Button>}
          {canExportReports && <Button variant="outline" onClick={handleWeeklyReport}>Télécharger rapport hebdomadaire</Button>}
          {canExportReports && <Button onClick={handleMonthlyReport}>Télécharger rapport mensuel</Button>}
          <Select value={String(month)} onValueChange={v => setMonth(Number(v))}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>{months.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={String(year)} onValueChange={v => setYear(Number(v))}>
            <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
            <SelectContent>{[2024, 2025, 2026].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </PageHeader>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{t('reports.summary.occupancy')}</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{occupancyRate}%</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{t('reports.summary.checkins')}</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{totalCheckIns}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{t('reports.summary.revenue')}</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{formatFCFA(totalRevenue)}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{t('reports.summary.netProfit')}</CardTitle></CardHeader><CardContent><p className={`text-2xl font-bold ${netProfit >= 0 ? 'text-green-600' : 'text-destructive'}`}>{formatFCFA(netProfit)}</p></CardContent></Card>
      </div>

      <Tabs defaultValue="reception">
        <TabsList className="flex-wrap">
          <TabsTrigger value="reception">{t('tabs.reception')}</TabsTrigger>
          <TabsTrigger value="restaurant">{t('tabs.restaurant')}</TabsTrigger>
          <TabsTrigger value="financier">{t('tabs.financier')}</TabsTrigger>
          <TabsTrigger value="occupation">{t('tabs.occupation')}</TabsTrigger>
          <TabsTrigger value="clients">Clients</TabsTrigger>
        </TabsList>

        {/* RECEPTION TAB */}
        <TabsContent value="reception" className="mt-4 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">{t('reports.summary.checkins')}</CardTitle></CardHeader><CardContent><p className="text-xl font-bold">{totalCheckIns}</p></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">{t('reports.reception.checkouts')}</CardTitle></CardHeader><CardContent><p className="text-xl font-bold">{totalCheckOuts}</p></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">{t('reports.reception.nightsSold')}</CardTitle></CardHeader><CardContent><p className="text-xl font-bold">{totalNightsSold}</p></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">{t('reports.reception.collected')}</CardTitle></CardHeader><CardContent><p className="text-xl font-bold">{formatFCFA(mainCouranteEncaissement)}</p></CardContent></Card>
          </div>
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">{t('reports.reception.dailyRevenue')}</p>
              <p className="text-2xl font-bold">{formatFCFA(mainCouranteCA)}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Top chambres (séjours)</CardTitle></CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topRooms}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="room_number" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="stays" name="Séjours" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Catégories de chambres les plus vendues</CardTitle></CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topRoomCategories}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="category" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={60} />
                  <YAxis allowDecimals={false} />
                  <Tooltip formatter={(v, n) => [v, n === 'stays' ? 'Séjours' : 'Nuits']} />
                  <Bar dataKey="stays" name="stays" fill="#f59e0b" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          {stays && stays.length > 0 && (
            <Card>
              <CardHeader><CardTitle>{t('reports.reception.staysTitle')}</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow><TableHead>{t('reports.table.guest')}</TableHead><TableHead>{t('reports.table.room')}</TableHead><TableHead>{t('reports.table.nights')}</TableHead><TableHead className="text-right">{t('reports.table.amount')}</TableHead><TableHead>{t('common.status')}</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {stays.slice(0, 20).map(s => (
                      <TableRow key={s.id}>
                        <TableCell>{(s as any).guests?.last_name} {(s as any).guests?.first_name}</TableCell>
                        <TableCell>{(s as any).rooms?.room_number || '-'}</TableCell>
                        <TableCell>{s.number_of_nights || '-'}</TableCell>
                        <TableCell className="text-right">{formatFCFA(s.total_price)}</TableCell>
                        <TableCell><Badge variant={s.status === 'active' ? 'default' : 'secondary'}>{t(`status.${s.status}`)}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* RESTAURANT TAB */}
        <TabsContent value="restaurant" className="mt-4 space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">{t('reports.restaurant.orders')}</CardTitle></CardHeader><CardContent><p className="text-xl font-bold">{orders?.length || 0}</p></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">{t('reports.restaurant.revenue')}</CardTitle></CardHeader><CardContent><p className="text-xl font-bold">{formatFCFA(restaurantRevenue)}</p></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">{t('reports.restaurant.average')}</CardTitle></CardHeader><CardContent><p className="text-xl font-bold">{formatFCFA(avgOrderValue)}</p></CardContent></Card>
          </div>
          <Card>
            <CardHeader><CardTitle>{t('reports.restaurant.revenueChart')} - {months[month - 1]} {year}</CardTitle></CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[
                  { name: t('reports.restaurant.lodging'), montant: totalRevenue - restaurantRevenue },
                  { name: t('tabs.restaurant'), montant: restaurantRevenue },
                ]}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" /><YAxis />
                  <Tooltip formatter={(v: number) => formatFCFA(v)} />
                  <Bar dataKey="montant" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Top 10 plats / produits</CardTitle></CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topFoodItems}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={60} />
                  <YAxis allowDecimals={false} />
                  <Tooltip formatter={(v, n) => [n === 'count' ? `${v} unités` : formatFCFA(Number(v)), n === 'count' ? 'Quantité' : 'CA']} />
                  <Bar dataKey="count" name="count" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle>Top ventes nourriture</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Article</TableHead>
                      <TableHead className="text-right">Qté</TableHead>
                      <TableHead className="text-right">CA</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topFoodOnlyItems.slice(0, 5).map((item, idx) => (
                      <TableRow key={`food-${idx}`}>
                        <TableCell>{item.name}</TableCell>
                        <TableCell className="text-right">{item.count}</TableCell>
                        <TableCell className="text-right">{formatFCFA(item.revenue)}</TableCell>
                      </TableRow>
                    ))}
                    {topFoodOnlyItems.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-4">Aucune donnée</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Top ventes boissons</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Article</TableHead>
                      <TableHead className="text-right">Qté</TableHead>
                      <TableHead className="text-right">CA</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topDrinkItems.slice(0, 5).map((item, idx) => (
                      <TableRow key={`drink-${idx}`}>
                        <TableCell>{item.name}</TableCell>
                        <TableCell className="text-right">{item.count}</TableCell>
                        <TableCell className="text-right">{formatFCFA(item.revenue)}</TableCell>
                      </TableRow>
                    ))}
                    {topDrinkItems.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-4">Aucune donnée</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
          {orders && orders.length > 0 && (
            <Card>
              <CardHeader><CardTitle>{t('reports.restaurant.orderDetails')}</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('tabs.orders')}</TableHead>
                      <TableHead>{t('reports.table.room')}</TableHead>
                      <TableHead>{t('reports.table.guest')}</TableHead>
                      <TableHead>{t('common.status')}</TableHead>
                      <TableHead className="text-right">{t('reports.table.amount')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.slice(0, 25).map((o: any) => (
                      <TableRow key={o.id}>
                        <TableCell className="font-mono">{o.order_number}</TableCell>
                        <TableCell>{o.rooms?.room_number || o.room_number || '-'}</TableCell>
                        <TableCell>{o.guests ? `${o.guests.last_name || ''} ${o.guests.first_name || ''}`.trim() : (o.walkin_name || '-')}</TableCell>
                        <TableCell><Badge variant="outline">{o.status ? t(`restaurant.status.${o.status}`) : '-'}</Badge></TableCell>
                        <TableCell className="text-right">{formatFCFA(o.total_amount || 0)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* FINANCIER TAB */}
        <TabsContent value="financier" className="mt-4 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">{t('reports.financial.totalRevenue')}</CardTitle></CardHeader><CardContent><p className="text-xl font-bold text-green-600">{formatFCFA(totalPaid)}</p></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">{t('reports.financial.totalExpenses')}</CardTitle></CardHeader><CardContent><p className="text-xl font-bold text-destructive">{formatFCFA(totalExpenses)}</p></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">{t('reports.summary.netProfit')}</CardTitle></CardHeader><CardContent><p className={`text-xl font-bold ${netProfit >= 0 ? 'text-green-600' : 'text-destructive'}`}>{formatFCFA(netProfit)}</p></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">{t('reports.financial.unpaid')}</CardTitle></CardHeader><CardContent><p className="text-xl font-bold text-orange-500">{formatFCFA(totalRevenue - totalPaid)}</p></CardContent></Card>
          </div>

          {expensePieData.length > 0 && (
            <Card>
              <CardHeader><CardTitle>{t('reports.financial.expenseByCategory')}</CardTitle></CardHeader>
              <CardContent className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={expensePieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, value }) => `${name}: ${formatFCFA(value)}`}>
                      {expensePieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatFCFA(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {cashSessions && cashSessions.length > 0 && (
            <Card>
              <CardHeader><CardTitle>{t('reports.financial.cashSessions')}</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow><TableHead>{t('reports.table.date')}</TableHead><TableHead className="text-right">{t('reports.table.opening')}</TableHead><TableHead className="text-right">{t('reports.table.closing')}</TableHead><TableHead className="text-right">{t('reports.table.difference')}</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {cashSessions.map(s => (
                      <TableRow key={s.id}>
                        <TableCell>{s.opened_at ? new Date(s.opened_at).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-GB') : '-'}</TableCell>
                        <TableCell className="text-right">{formatFCFA(s.opening_balance)}</TableCell>
                        <TableCell className="text-right">{formatFCFA(s.closing_balance)}</TableCell>
                        <TableCell className={`text-right ${(s.difference || 0) < 0 ? 'text-destructive' : 'text-green-600'}`}>{formatFCFA(s.difference)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* OCCUPATION TAB */}
        <TabsContent value="occupation" className="mt-4">
          <Card>
            <CardHeader><CardTitle>{t('reports.occupancy.roomSplit')}</CardTitle></CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={roomStatusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                    {roomStatusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
        {/* CLIENTS TAB */}
        <TabsContent value="clients" className="mt-4 space-y-4">
          {/* Tier distribution */}
          <Card>
            <CardHeader><CardTitle>Répartition par niveau de fidélité</CardTitle></CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={tierDistribution} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="value" name="Clients" fill="hsl(var(--primary))" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Top 10 spenders */}
          <Card>
            <CardHeader><CardTitle>Top 10 clients (dépenses du mois)</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rang</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Niveau</TableHead>
                    <TableHead>Points</TableHead>
                    <TableHead className="text-right">Dépenses</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topGuests.map((g, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-bold">#{i + 1}</TableCell>
                      <TableCell>{g.name}</TableCell>
                      <TableCell><TierBadge tier={g.tier} /></TableCell>
                      <TableCell>{g.loyalty_points}</TableCell>
                      <TableCell className="text-right font-semibold">{formatFCFA(g.total)}</TableCell>
                    </TableRow>
                  ))}
                  {topGuests.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Aucune donnée</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Top 10 rooms */}
          <Card>
            <CardHeader><CardTitle>Top 10 chambres (séjours ce mois)</CardTitle></CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topRooms} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="room_number" />
                  <YAxis allowDecimals={false} />
                  <Tooltip formatter={(v, name) => [v, name === 'stays' ? 'Séjours' : 'Nuits']} />
                  <Bar dataKey="stays" name="stays" fill="hsl(var(--primary))" radius={[4,4,0,0]} />
                  <Bar dataKey="nights" name="nights" fill="#10b981" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Top 10 food items */}
          <Card>
            <CardHeader><CardTitle>Top 10 plats commandés (restaurant ce mois)</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rang</TableHead>
                    <TableHead>Article</TableHead>
                    <TableHead className="text-right">Qté vendue</TableHead>
                    <TableHead className="text-right">Chiffre d'affaires</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topFoodItems.map((item, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-bold">#{i + 1}</TableCell>
                      <TableCell>{item.name}</TableCell>
                      <TableCell className="text-right">{item.count}</TableCell>
                      <TableCell className="text-right font-semibold">{formatFCFA(item.revenue)}</TableCell>
                    </TableRow>
                  ))}
                  {topFoodItems.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Aucune commande ce mois</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ReportsPage;
