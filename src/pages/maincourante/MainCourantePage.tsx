import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useHotel } from '@/contexts/HotelContext';
import { useI18n } from '@/contexts/I18nContext';
import { useRoleGuard } from '@/hooks/useRoleGuard';
import { useEnsureMainCourante } from '@/hooks/useMainCourante';
import { reconcileMainCouranteForDate } from '@/services/transactionService';
import { PageHeader } from '@/components/shared/PageHeader';
import { PaymentDialog } from '@/components/shared/PaymentDialog';
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
import { ChevronLeft, ChevronRight, Plus, Lock } from 'lucide-react';

const toSafeNumber = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const formatSupabaseError = (error: any) => {
  if (!error) return 'Erreur inconnue';
  const parts = [error.message, error.details, error.hint].filter(Boolean);
  return parts.length ? parts.join(' | ') : String(error);
};

const MainCourantePage = () => {
  const getLocalDateKey = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  useRoleGuard(['admin', 'manager', 'receptionist']);
  const { t } = useI18n();
  const { profile } = useAuth();
  const { hotel } = useHotel();
  const qc = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(getLocalDateKey());
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [manualEntry, setManualEntry] = useState({ room_number: '', nom_client: '', nombre_personnes: 1 });
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentContext, setPaymentContext] = useState<any>(null);

  const ensureMC = useEnsureMainCourante();

  // Auto-populate when date changes
  useEffect(() => {
    if (hotel?.id) {
      ensureMC.mutate({ hotelId: hotel.id, date: selectedDate });
    }
  }, [hotel?.id, selectedDate]);

  const { data: entries, isLoading } = useQuery({
    queryKey: ['main-courante', hotel?.id, selectedDate],
    queryFn: async () => {
      await reconcileMainCouranteForDate(hotel!.id, selectedDate);
      const { data, error } = await supabase.from('main_courante').select('*').eq('hotel_id', hotel!.id).eq('journee', selectedDate).order('room_number');
      if (error) throw error;
      return data;
    },
    enabled: !!hotel?.id,
  });

  const updateFieldMutation = useMutation({
    mutationFn: async ({ id, field, value }: { id: string; field: string; value: number }) => {
      const entry = entries?.find(e => e.id === id);
      if (!entry) throw new Error(t('maincourante.missingEntry'));
      const h = field === 'hebergement' ? toSafeNumber(value) : toSafeNumber(entry.hebergement);
      const b = field === 'bar' ? toSafeNumber(value) : toSafeNumber(entry.bar);
      const r = field === 'restaurant' ? toSafeNumber(value) : toSafeNumber(entry.restaurant);
      const d = field === 'divers' ? toSafeNumber(value) : toSafeNumber(entry.divers);
      const ded = field === 'deduction' ? toSafeNumber(value) : toSafeNumber(entry.deduction);
      const enc = field === 'encaissement' ? toSafeNumber(value) : toSafeNumber(entry.encaissement);
      const caTotal = h + b + r + d;
      const aReporter = caTotal + toSafeNumber(entry.report_veille) - ded - enc;

      const payload = {
        hebergement: h, bar: b, restaurant: r, divers: d,
        deduction: ded, encaissement: enc,
        updated_at: new Date().toISOString(),
      } as any;

      const { error } = await supabase.from('main_courante').update(payload).eq('id', id);
      if (error) {
        console.error('main_courante PATCH failed', { id, field, value, payload, error });
        throw new Error(formatSupabaseError(error));
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['main-courante'] }),
    onError: (e: any) => {
      const msg = formatSupabaseError(e);
      toast.error(`Main Courante: ${msg.length > 220 ? `${msg.slice(0, 220)}...` : msg}`);
    },
  });

  const closeDayMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('main_courante').update({ day_closed: true }).eq('hotel_id', hotel!.id).eq('journee', selectedDate);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['main-courante'] }); toast.success(t('maincourante.closed')); },
    onError: (e: any) => toast.error(e.message),
  });

  const addManualMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('main_courante').insert({
        hotel_id: hotel!.id, journee: selectedDate, room_number: manualEntry.room_number,
        nom_client: manualEntry.nom_client, nombre_personnes: manualEntry.nombre_personnes, is_manual: true,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['main-courante'] }); toast.success(t('maincourante.added')); setAddDialogOpen(false); setManualEntry({ room_number: '', nom_client: '', nombre_personnes: 1 }); },
    onError: (e: any) => toast.error(e.message),
  });

  const navigateDate = (dir: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + dir);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const isClosed = entries?.some(e => e.day_closed);
  const todayKey = getLocalDateKey();
  const isToday = selectedDate === todayKey;
  const isPast = selectedDate < todayKey;

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

    if (field === 'encaissement') {
      return (
        <TableCell className="text-right">
          <button
            className="text-right w-full hover:bg-muted/50 px-1 rounded cursor-pointer"
            onClick={async () => {
              const { data: invoice } = await supabase
                .from('invoices')
                .select('id, invoice_number, balance_due, stay_id')
                .eq('hotel_id', hotel!.id)
                .eq('guest_id', entry.guest_id)
                .in('status', ['open', 'partial'])
                .order('created_at', { ascending: false })
                .maybeSingle();

              if (!invoice || !invoice.balance_due || invoice.balance_due <= 0) {
                toast.info(t('maincourante.noOpenBalance'));
                return;
              }

              setPaymentContext({
                invoiceId: invoice.id,
                stayId: invoice.stay_id || entry.stay_id,
                guestId: entry.guest_id,
                currentBalance: invoice.balance_due,
                invoiceNumber: invoice.invoice_number,
                roomNumber: entry.room_number,
                guestName: entry.nom_client,
              });
              setPaymentDialogOpen(true);
            }}
          >
            {formatFCFA(value)}
          </button>
        </TableCell>
      );
    }

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
      <PageHeader title={t('maincourante.title')} subtitle={hotel?.name || ''}>
        <div className="flex items-center gap-2">
          {!isClosed && isToday && (profile?.role === 'admin' || profile?.role === 'manager') && (
            <Button variant="destructive" onClick={() => closeDayMutation.mutate()}><Lock className="h-4 w-4 mr-2" />{t('maincourante.closeDay')}</Button>
          )}
          <Button variant="outline" onClick={() => setAddDialogOpen(true)} disabled={!!isClosed}><Plus className="h-4 w-4 mr-2" />{t('maincourante.addLine')}</Button>
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
        <Badge variant={isClosed ? 'destructive' : 'default'}>{isClosed ? t('maincourante.closedDay') : t('maincourante.openDay')}</Badge>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card><CardContent className="pt-4"><p className="text-sm text-muted-foreground">{t('maincourante.kpi.ca')}</p><p className="text-xl font-bold">{formatFCFA(totals?.ca_total_jour || 0)}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-sm text-muted-foreground">{t('maincourante.kpi.cash')}</p><p className="text-xl font-bold">{formatFCFA(totals?.encaissement || 0)}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-sm text-muted-foreground">{t('maincourante.kpi.carry')}</p><p className="text-xl font-bold text-destructive">{formatFCFA(totals?.a_reporter || 0)}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-sm text-muted-foreground">{t('maincourante.kpi.misc')}</p><p className="text-xl font-bold">{formatFCFA(totals?.divers || 0)}</p></CardContent></Card>
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 bg-background z-10">{t('maincourante.table.room')}</TableHead>
                <TableHead className="sticky left-[80px] bg-background z-10">{t('maincourante.table.people')}</TableHead>
                <TableHead className="sticky left-[130px] bg-background z-10">{t('maincourante.table.guest')}</TableHead>
                <TableHead className="text-right">{t('maincourante.table.lodging')}</TableHead>
                <TableHead className="text-right">{t('maincourante.table.bar')}</TableHead>
                <TableHead className="text-right">{t('maincourante.table.restaurant')}</TableHead>
                <TableHead className="text-right bg-muted/30">{t('maincourante.table.caTotal')}</TableHead>
                <TableHead className="text-right">{t('maincourante.table.deduction')}</TableHead>
                <TableHead className="text-right">{t('maincourante.table.previousCarry')}</TableHead>
                <TableHead className="text-right">{t('maincourante.table.cash')}</TableHead>
                <TableHead className="text-right bg-muted/30">{t('maincourante.table.carry')}</TableHead>
                <TableHead className="text-right">{t('maincourante.table.misc')}</TableHead>
                <TableHead>{t('maincourante.table.observation')}</TableHead>
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
              {entries && entries.length > 0 && (
                <TableRow className="bg-muted/50 font-bold">
                  <TableCell className="sticky left-0 bg-muted/50 z-10" colSpan={3}>{t('maincourante.table.totals')}</TableCell>
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
          <DialogHeader><DialogTitle>{t('maincourante.dialog.title')}</DialogTitle><DialogDescription>{t('maincourante.dialog.description')}</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div><Label>{t('maincourante.dialog.room')}</Label><Input value={manualEntry.room_number} onChange={e => setManualEntry(p => ({ ...p, room_number: e.target.value }))} /></div>
            <div><Label>{t('maincourante.dialog.guest')} *</Label><Input value={manualEntry.nom_client} onChange={e => setManualEntry(p => ({ ...p, nom_client: e.target.value }))} /></div>
            <div><Label>{t('maincourante.dialog.people')}</Label><Input type="number" value={manualEntry.nombre_personnes} onChange={e => setManualEntry(p => ({ ...p, nombre_personnes: Number(e.target.value) }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={() => addManualMutation.mutate()} disabled={!manualEntry.nom_client}>{t('common.add')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {paymentContext && (
        <PaymentDialog
          open={paymentDialogOpen}
          onOpenChange={setPaymentDialogOpen}
          invoiceId={paymentContext.invoiceId}
          stayId={paymentContext.stayId}
          guestId={paymentContext.guestId}
          currentBalance={paymentContext.currentBalance}
          invoiceNumber={paymentContext.invoiceNumber}
          roomNumber={paymentContext.roomNumber}
          guestName={paymentContext.guestName}
          onSuccess={() => qc.invalidateQueries({ queryKey: ['main-courante'] })}
        />
      )}
    </div>
  );
};

export default MainCourantePage;
