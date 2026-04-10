import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useHotel } from '@/contexts/HotelContext';
import { useRoleGuard } from '@/hooks/useRoleGuard';
import { PageHeader } from '@/components/shared/PageHeader';
import { formatFCFA } from '@/utils/formatters';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';

const COLORS = ['hsl(var(--primary))', 'hsl(var(--destructive))', '#f59e0b', '#10b981', '#6366f1', '#ec4899'];

const ReportsPage = () => {
  useRoleGuard(['admin', 'manager', 'accountant']);
  const { hotel } = useHotel();
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());

  const { data: rooms } = useQuery({
    queryKey: ['report-rooms', hotel?.id],
    queryFn: async () => {
      const { data } = await supabase.from('rooms').select('id, room_number, status').eq('hotel_id', hotel!.id);
      return data || [];
    },
    enabled: !!hotel?.id,
  });

  const { data: guests } = useQuery({
    queryKey: ['report-guests', hotel?.id, month, year],
    queryFn: async () => {
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const endDate = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`;
      const { data } = await supabase.from('guests').select('*').eq('hotel_id', hotel!.id).gte('check_in_date', startDate).lt('check_in_date', endDate);
      return data || [];
    },
    enabled: !!hotel?.id,
  });

  const { data: invoices } = useQuery({
    queryKey: ['report-invoices', hotel?.id, month, year],
    queryFn: async () => {
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const endDate = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`;
      const { data } = await supabase.from('invoices').select('*').eq('hotel_id', hotel!.id).gte('created_at', startDate).lt('created_at', endDate);
      return data || [];
    },
    enabled: !!hotel?.id,
  });

  const totalRooms = rooms?.length || 0;
  const occupiedRooms = rooms?.filter(r => r.status === 'occupied').length || 0;
  const occupancyRate = totalRooms ? Math.round((occupiedRooms / totalRooms) * 100) : 0;
  const totalRevenue = invoices?.reduce((s, i) => s + (i.total_amount || 0), 0) || 0;
  const totalPaid = invoices?.reduce((s, i) => s + (i.amount_paid || 0), 0) || 0;

  const roomStatusData = [
    { name: 'Disponible', value: rooms?.filter(r => r.status === 'available').length || 0 },
    { name: 'Occupée', value: occupiedRooms },
    { name: 'Nettoyage', value: rooms?.filter(r => r.status === 'housekeeping').length || 0 },
    { name: 'Maintenance', value: rooms?.filter(r => r.status === 'maintenance').length || 0 },
  ].filter(d => d.value > 0);

  const nationalityData = guests?.reduce((acc: Record<string, number>, g) => {
    const nat = g.nationality || 'Inconnue';
    acc[nat] = (acc[nat] || 0) + 1;
    return acc;
  }, {});
  const natChartData = Object.entries(nationalityData || {}).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 6);

  const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];

  return (
    <div className="page-container space-y-6">
      <PageHeader title="Rapports" subtitle="Analyse et statistiques">
        <div className="flex gap-2">
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

      <div className="grid grid-cols-4 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Taux d'occupation</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{occupancyRate}%</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Clients du mois</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{guests?.length || 0}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">CA du mois</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{formatFCFA(totalRevenue)}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Encaissé</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{formatFCFA(totalPaid)}</p></CardContent></Card>
      </div>

      <Tabs defaultValue="occupation">
        <TabsList>
          <TabsTrigger value="occupation">Occupation</TabsTrigger>
          <TabsTrigger value="revenue">Revenus</TabsTrigger>
          <TabsTrigger value="clients">Clients</TabsTrigger>
        </TabsList>

        <TabsContent value="occupation" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Répartition des chambres</CardTitle></CardHeader>
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

        <TabsContent value="revenue" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Revenus — {months[month - 1]} {year}</CardTitle></CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[
                  { name: 'Total', montant: totalRevenue },
                  { name: 'Payé', montant: totalPaid },
                  { name: 'Impayé', montant: totalRevenue - totalPaid },
                ]}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip formatter={(v: number) => formatFCFA(v)} />
                  <Bar dataKey="montant" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="clients" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Nationalités des clients</CardTitle></CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={natChartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={120} />
                  <Tooltip />
                  <Bar dataKey="value" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ReportsPage;
