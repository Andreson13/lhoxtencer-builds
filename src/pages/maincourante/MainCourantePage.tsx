import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useHotel } from '@/contexts/HotelContext';
import { useRoleGuard } from '@/hooks/useRoleGuard';
import { PageHeader } from '@/components/shared/PageHeader';
import { formatFCFA, formatFullDate } from '@/utils/formatters';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';
import { BookOpen, ChevronLeft, ChevronRight, Plus, Lock, Unlock } from 'lucide-react';

const MainCourantePage = () => {
  useRoleGuard(['admin', 'manager', 'receptionist']);
  const { profile } = useAuth();
  const { hotel } = useHotel();
  const qc = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [manualEntry, setManualEntry] = useState({ room_number: '', nom_client: '', nombre_personnes: 1 });

  const { data: entries, isLoading } = useQuery({
    queryKey: ['main-courante', hotel?.id, selectedDate],
    queryFn: async () => {
      const { data, error } = await supabase.from('main_courante').select('*').eq('hotel_id', hotel!.id).eq('journee', selectedDate).order('room_number');
      if (error) throw error;
      return data;
    },
    enabled: !!hotel?.id,
  });

  // Auto-populate from present guests
  const { data: presentGuests } = useQuery({
    queryKey: ['present-guests-mc', hotel?.id],
    queryFn: async () => {
      const { data } = await supabase.from('guests').select('*, rooms(room_number)').eq('hotel_id', hotel!.id).eq('status', 'present');
      return data || [];
    },
    enabled: !!hotel?.id,
  });

  const autoPopulateMutation = useMutation({
    mutationFn: async () => {
      if (!presentGuests || !hotel) return;
      for (const guest of presentGuests) {
        const roomNumber = (guest as any).rooms?.room_number || '';
        const existing = entries?.find(e => e.guest_id === guest.id && e.journee === selectedDate);
        if (!existing) {
          // Get previous day's a_reporter for this guest
          const prevDate = new Date(selectedDate);
          prevDate.setDate(prevDate.getDate() - 1);
          const { data: prevEntry } = await supabase.from('main_courante').select('a_reporter').eq('hotel_id', hotel.id).eq('guest_id', guest.id).eq('journee', prevDate.toISOString().split('T')[0]).single();

          await supabase.from('main_courante').upsert({
            hotel_id: hotel.id,
            journee: selectedDate,
            room_number: roomNumber,
            room_id: guest.room_id,
            guest_id: guest.id,
            nom_client: `${guest.last_name} ${guest.first_name}`,
            nombre_personnes: (guest.number_of_adults || 1) + (guest.number_of_children || 0),
            hebergement: guest.price_per_night || 0,
            report_veille: prevEntry?.a_reporter || 0,
          }, { onConflict: 'hotel_id,journee,room_id' });
        }
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['main-courante'] }); },
  });

  useEffect(() => {
    if (presentGuests && hotel && selectedDate === new Date().toISOString().split('T')[0]) {
      autoPopulateMutation.mutate();
    }
  }, [presentGuests, hotel, selectedDate]);

  const updateFieldMutation = useMutation({
    mutationFn: async ({ id, field, value }: { id: string; field: string; value: number }) => {
      const numericFields = ['hebergement', 'bar', 'restaurant', 'divers', 'deduction', 'encaissement'];
      if (!numericFields.includes(field)) return;
      const entry = entries?.find(e => e.id === id);
      if (!entry) return;
      const updated = { ...entry, [field]: value };
      const caTotal = (updated.hebergement || 0) + (updated.bar || 0) + (updated.restaurant || 0) + (updated.divers || 0);
      const aReporter = caTotal + (updated.report_veille || 0) - (updated.deduction || 0) - (updated.encaissement || 0);

      const { error } = await supabase.from('main_courante').update({
        [field]: value,
        ca_total_jour: caTotal,
        a_reporter: aReporter,
        updated_at: new Date().toISOString(),
      }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['main-courante'] }),
    onError: (e: any) => toast.error(e.message),
  });

  const closeDayMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('main_courante').update({ day_closed: true }).eq('hotel_id', hotel!.id).eq('journee', selectedDate);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['main-courante'] }); toast.success('Journée clôturée'); },
    onError: (e: any) => toast.error(e.message),
  });

  const addManualMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('main_courante').insert({
        hotel_id: hotel!.id,
        journee: selectedDate,
        room_number: manualEntry.room_number,
        nom_client: manualEntry.nom_client,
        nombre_personnes: manualEntry.nombre_personnes,
        is_manual: true,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['main-courante'] }); toast.success('Ligne ajoutée'); setAddDialogOpen(false); setManualEntry({ room_number: '', nom_client: '', nombre_personnes: 1 }); },
    onError: (e: any) => toast.error(e.message),
  });

  const navigateDate = (dir: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + dir);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const isClosed = entries?.some(e => e.day_closed);
  const isToday = selectedDate === new Date().toISOString().split('T')[0];
  const isPast = selectedDate < new Date().toISOString().split('T')[0];

  const totals = entries?.reduce((acc, e) => ({
    hebergement: acc.hebergement + (e.hebergement || 0),
    bar: acc.bar + (e.bar || 0),
    restaurant: acc.restaurant + (e.restaurant || 0),
    divers: acc.divers + (e.divers || 0),
    ca_total_jour: acc.ca_total_jour + (e.ca_total_jour || 0),
    deduction: acc.deduction + (e.deduction || 0),
    report_veille: acc.report_veille + (e.report_veille || 0),
    encaissement: acc.encaissement + (e.encaissement || 0),
    a_reporter: acc.a_reporter + (e.a_reporter || 0),
  }), { hebergement: 0, bar: 0, restaurant: 0, divers: 0, ca_total_jour: 0, deduction: 0, report_veille: 0, encaissement: 0, a_reporter: 0 });

  const EditableCell = ({ entry, field, value }: { entry: any; field: string; value: number }) => {
    const [editing, setEditing] = useState(false);
    const [val, setVal] = useState(value);
    const readonly = isClosed || (isPast && !isToday);

    if (readonly) return <TableCell className="text-right">{formatFCFA(value)}</TableCell>;

    return (
      <TableCell className="text-right">
        <Popover open={editing} onOpenChange={setEditing}>
          <PopoverTrigger asChild>
            <button className="text-right w-full hover:bg-muted/50 px-1 rounded cursor-pointer">{formatFCFA(value)}</button>
          </PopoverTrigger>
          <PopoverContent className="w-48">
            <div className="space-y-2">
              <Input type="number" value={val} onChange={e => setVal(Number(e.target.value))} autoFocus />
              <Button size="sm" className="w-full" onClick={() => { updateFieldMutation.mutate({ id: entry.id, field, value: val }); setEditing(false); }}>OK</Button>
            </div>
          </PopoverContent>
        </Popover>
      </TableCell>
    );
  };

  return (
    <div className="page-container space-y-6">
      <PageHeader title="Main Courante — Réception" subtitle={hotel?.name || ''}>
        <div className="flex items-center gap-2">
          {!isClosed && isToday && (profile?.role === 'admin' || profile?.role === 'manager') && (
            <Button variant="destructive" onClick={() => closeDayMutation.mutate()}><Lock className="h-4 w-4 mr-2" />Clôturer</Button>
          )}
          <Button variant="outline" onClick={() => setAddDialogOpen(true)} disabled={!!isClosed}><Plus className="h-4 w-4 mr-2" />Ajouter une ligne</Button>
        </div>
      </PageHeader>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => navigateDate(-1)}><ChevronLeft className="h-4 w-4" /></Button>
          <div className="text-center">
            <p className="font-semibold capitalize">{formatFullDate(new Date(selectedDate + 'T00:00:00'))}</p>
            <Input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="mt-1 w-40" />
          </div>
          <Button variant="outline" size="icon" onClick={() => navigateDate(1)}><ChevronRight className="h-4 w-4" /></Button>
        </div>
        <Badge variant={isClosed ? 'destructive' : 'default'}>{isClosed ? 'Journée clôturée' : 'Journée ouverte'}</Badge>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card><CardContent className="pt-4"><p className="text-sm text-muted-foreground">CA Jour</p><p className="text-xl font-bold">{formatFCFA(totals?.ca_total_jour || 0)}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-sm text-muted-foreground">Encaissements</p><p className="text-xl font-bold">{formatFCFA(totals?.encaissement || 0)}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-sm text-muted-foreground">À Reporter</p><p className="text-xl font-bold text-destructive">{formatFCFA(totals?.a_reporter || 0)}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-sm text-muted-foreground">Divers</p><p className="text-xl font-bold">{formatFCFA(totals?.divers || 0)}</p></CardContent></Card>
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 bg-background z-10">N° Chbre</TableHead>
                <TableHead className="sticky left-[80px] bg-background z-10">Pers</TableHead>
                <TableHead className="sticky left-[130px] bg-background z-10">Nom du client</TableHead>
                <TableHead className="text-right">Hébergement</TableHead>
                <TableHead className="text-right">Bar</TableHead>
                <TableHead className="text-right">Restau</TableHead>
                <TableHead className="text-right bg-muted/30">CA Total</TableHead>
                <TableHead className="text-right">Déduction</TableHead>
                <TableHead className="text-right">Report veille</TableHead>
                <TableHead className="text-right">Encaissement</TableHead>
                <TableHead className="text-right bg-muted/30">À Reporter</TableHead>
                <TableHead className="text-right">Divers</TableHead>
                <TableHead>Observation</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries?.map(e => (
                <TableRow key={e.id}>
                  <TableCell className="sticky left-0 bg-background z-10 font-mono">{e.room_number || '-'}</TableCell>
                  <TableCell className="sticky left-[80px] bg-background z-10">{e.nombre_personnes}</TableCell>
                  <TableCell className="sticky left-[130px] bg-background z-10 font-medium">{e.nom_client}</TableCell>
                  <EditableCell entry={e} field="hebergement" value={e.hebergement || 0} />
                  <EditableCell entry={e} field="bar" value={e.bar || 0} />
                  <EditableCell entry={e} field="restaurant" value={e.restaurant || 0} />
                  <TableCell className="text-right bg-muted/30 font-semibold text-primary">{formatFCFA(e.ca_total_jour || 0)}</TableCell>
                  <EditableCell entry={e} field="deduction" value={e.deduction || 0} />
                  <TableCell className="text-right bg-muted/10">{formatFCFA(e.report_veille || 0)}</TableCell>
                  <EditableCell entry={e} field="encaissement" value={e.encaissement || 0} />
                  <TableCell className="text-right bg-muted/30 font-semibold text-destructive">{formatFCFA(e.a_reporter || 0)}</TableCell>
                  <EditableCell entry={e} field="divers" value={e.divers || 0} />
                  <TableCell className="max-w-32 truncate">{e.observation || '-'}</TableCell>
                </TableRow>
              ))}
              {/* Totals row */}
              {entries && entries.length > 0 && (
                <TableRow className="bg-muted/50 font-bold">
                  <TableCell className="sticky left-0 bg-muted/50 z-10" colSpan={3}>TOTAUX</TableCell>
                  <TableCell className="text-right">{formatFCFA(totals?.hebergement || 0)}</TableCell>
                  <TableCell className="text-right">{formatFCFA(totals?.bar || 0)}</TableCell>
                  <TableCell className="text-right">{formatFCFA(totals?.restaurant || 0)}</TableCell>
                  <TableCell className="text-right bg-muted/30">{formatFCFA(totals?.ca_total_jour || 0)}</TableCell>
                  <TableCell className="text-right">{formatFCFA(totals?.deduction || 0)}</TableCell>
                  <TableCell className="text-right">{formatFCFA(totals?.report_veille || 0)}</TableCell>
                  <TableCell className="text-right">{formatFCFA(totals?.encaissement || 0)}</TableCell>
                  <TableCell className="text-right bg-muted/30 text-destructive">{formatFCFA(totals?.a_reporter || 0)}</TableCell>
                  <TableCell className="text-right">{formatFCFA(totals?.divers || 0)}</TableCell>
                  <TableCell />
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Ajouter une ligne</DialogTitle><DialogDescription>Entrée manuelle walk-in</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div><Label>N° Chambre</Label><Input value={manualEntry.room_number} onChange={e => setManualEntry(p => ({ ...p, room_number: e.target.value }))} /></div>
            <div><Label>Nom du client *</Label><Input value={manualEntry.nom_client} onChange={e => setManualEntry(p => ({ ...p, nom_client: e.target.value }))} /></div>
            <div><Label>Nombre de personnes</Label><Input type="number" value={manualEntry.nombre_personnes} onChange={e => setManualEntry(p => ({ ...p, nombre_personnes: Number(e.target.value) }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>Annuler</Button>
            <Button onClick={() => addManualMutation.mutate()} disabled={!manualEntry.nom_client}>Ajouter</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MainCourantePage;
