import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useHotel } from '@/contexts/HotelContext';
import { useI18n } from '@/contexts/I18nContext';
import { useRoleGuard } from '@/hooks/useRoleGuard';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { formatFCFA, formatDate, generateInvoiceNumber, generateReservationNumber } from '@/utils/formatters';
import { withAudit } from '@/utils/auditLog';
import { enqueueOfflineSubmission } from '@/services/offlineSubmissionQueue';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { CalendarCheck, Plus, Search, Pencil, Trash2, Check, X, LogIn } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const ReservationsPage = () => {
  const { t } = useI18n();
  useRoleGuard(['admin', 'manager', 'receptionist']);
  const { profile } = useAuth();
  const { hotel } = useHotel();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [deleteItem, setDeleteItem] = useState<any>(null);

  // Guest search
  const [guestSearch, setGuestSearch] = useState('');
  const [selectedGuestId, setSelectedGuestId] = useState<string | null>(null);
  const [selectedGuestData, setSelectedGuestData] = useState<any>(null);
  const [createGuestRecord, setCreateGuestRecord] = useState(false);

  // Form state
  const [form, setForm] = useState({
    guest_name: '', guest_phone: '', guest_email: '',
    category_id: '', room_id: '',
    check_in_date: '', check_out_date: '',
    number_of_adults: 1, number_of_children: 0,
    total_price: 0, deposit_paid: 0,
    payment_method_cash: false, payment_method_om: false, payment_method_momo: false,
    source: 'direct', special_requests: '',
  });

  const nights = form.check_in_date && form.check_out_date ? Math.max(1, Math.ceil((new Date(form.check_out_date).getTime() - new Date(form.check_in_date).getTime()) / 86400000)) : 0;

  const { data: reservations, isLoading } = useQuery({
    queryKey: ['reservations', hotel?.id],
    queryFn: async () => {
      const { data } = await supabase.from('reservations').select('*, rooms(room_number)').eq('hotel_id', hotel!.id).order('check_in_date', { ascending: false });
      return data || [];
    },
    enabled: !!hotel?.id,
  });

  const { data: categories } = useQuery({
    queryKey: ['room-categories', hotel?.id],
    queryFn: async () => {
      const { data } = await supabase.from('room_categories').select('*').eq('hotel_id', hotel!.id).order('display_order');
      return data || [];
    },
    enabled: !!hotel?.id,
  });

  const { data: rooms } = useQuery({
    queryKey: ['rooms-by-category', hotel?.id, form.category_id],
    queryFn: async () => {
      let q = supabase.from('rooms').select('id, room_number, floor, category_id, status').eq('hotel_id', hotel!.id);
      if (form.category_id) q = q.eq('category_id', form.category_id);
      const { data } = await q.eq('status', 'available').order('room_number');
      return data || [];
    },
    enabled: !!hotel?.id,
  });

  const { data: existingGuests } = useQuery({
    queryKey: ['guests-res-search', hotel?.id, guestSearch],
    queryFn: async () => {
      if (guestSearch.length < 2) return [];
      const { data } = await supabase.from('guests').select('id, last_name, first_name, phone, email, id_number')
        .eq('hotel_id', hotel!.id)
        .or(`last_name.ilike.%${guestSearch}%,first_name.ilike.%${guestSearch}%,phone.ilike.%${guestSearch}%`)
        .limit(10);
      return data || [];
    },
    enabled: !!hotel?.id && guestSearch.length >= 2,
  });

  const selectedCategory = categories?.find(c => c.id === form.category_id);
  const estimatedBalance = Math.max(0, Number(form.total_price || 0) - Number(form.deposit_paid || 0));

  const isNetworkIssue = (error: any) => {
    const message = String(error?.message || error || '').toLowerCase();
    return message.includes('fetch') || message.includes('network') || message.includes('offline') || message.includes('timeout');
  };

  const handleCategoryChange = (catId: string) => {
    const cat = categories?.find(c => c.id === catId);
    setForm(f => ({
      ...f,
      category_id: catId,
      room_id: '',
      total_price: cat ? cat.price_per_night * Math.max(nights, 1) : 0,
    }));
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!hotel || !profile) throw new Error('Missing context');
      try {
        // Link existing guest when possible, and only create on NEW reservation when user opted in.
        let guestId = selectedGuestId || editing?.guest_id || null;
        if (!guestId && createGuestRecord && form.guest_name && !editing) {
          const nameParts = form.guest_name.trim().split(' ').filter(Boolean);
          const lastName = nameParts[0] || form.guest_name;
          const firstName = nameParts.slice(1).join(' ') || '';

          // Try to reuse an existing guest before creating a new one.
          let existingGuest: any = null;
          if (form.guest_phone) {
            const { data } = await supabase
              .from('guests')
              .select('id')
              .eq('hotel_id', hotel.id)
              .eq('phone', form.guest_phone)
              .maybeSingle();
            existingGuest = data;
          }
          if (!existingGuest) {
            const { data } = await supabase
              .from('guests')
              .select('id')
              .eq('hotel_id', hotel.id)
              .ilike('last_name', lastName)
              .ilike('first_name', firstName || lastName)
              .maybeSingle();
            existingGuest = data;
          }

          if (existingGuest?.id) {
            guestId = existingGuest.id;
          } else {
            const { data: g } = await supabase.from('guests').insert({
              hotel_id: hotel.id,
              last_name: lastName,
              first_name: firstName || lastName,
              phone: form.guest_phone || null,
              email: form.guest_email || null,
            }).select().single();
            if (g) guestId = g.id;
          }
        }

        const payload: any = {
          hotel_id: hotel.id,
          guest_name: form.guest_name,
          guest_phone: form.guest_phone || null,
          guest_email: form.guest_email || null,
          category_id: form.category_id || null,
          room_id: form.room_id || null,
          check_in_date: form.check_in_date,
          check_out_date: form.check_out_date,
          number_of_nights: nights,
          number_of_adults: form.number_of_adults,
          number_of_children: form.number_of_children,
          total_price: form.total_price,
          deposit_paid: form.deposit_paid,
          payment_method_cash: form.payment_method_cash,
          payment_method_om: form.payment_method_om,
          payment_method_momo: form.payment_method_momo,
          source: form.source,
          special_requests: form.special_requests || null,
          guest_id: guestId || null,
        };

        let reservationId = editing?.id;
        if (editing) {
          payload.reservation_number = editing.reservation_number;
          const { error } = await supabase.from('reservations').update(payload).eq('id', editing.id);
          if (error) throw error;
        } else {
          payload.reservation_number = generateReservationNumber();
          payload.created_by = profile.id;
          const { data: createdReservation, error } = await supabase.from('reservations').insert(payload).select('id').single();
          if (error) throw error;
          reservationId = createdReservation?.id;
        }

        // Ensure reservations appear in Billing with correct acompte/solde values.
        if (reservationId) {
          const amountPaid = Number(form.deposit_paid || 0);
          const totalAmount = Number(form.total_price || 0);
          const balanceDue = Math.max(0, totalAmount - amountPaid);
          const invoiceStatus = balanceDue <= 0 ? 'paid' : amountPaid > 0 ? 'partial' : 'open';

          const { data: existingInvoice } = await supabase
            .from('invoices')
            .select('id')
            .eq('hotel_id', hotel.id)
            .eq('reservation_id', reservationId)
            .maybeSingle();

          if (existingInvoice?.id) {
            const { error: invoiceUpdateError } = await supabase
              .from('invoices')
              .update({
                guest_id: guestId,
                subtotal: totalAmount,
                total_amount: totalAmount,
                amount_paid: amountPaid,
                balance_due: balanceDue,
                status: invoiceStatus,
              } as any)
              .eq('id', existingInvoice.id);
            if (invoiceUpdateError) throw invoiceUpdateError;
          } else {
            const { error: invoiceInsertError } = await supabase
              .from('invoices')
              .insert({
                hotel_id: hotel.id,
                guest_id: guestId,
                reservation_id: reservationId,
                invoice_number: generateInvoiceNumber(),
                status: invoiceStatus,
                subtotal: totalAmount,
                total_amount: totalAmount,
                amount_paid: amountPaid,
                balance_due: balanceDue,
              } as any);
            if (invoiceInsertError) throw invoiceInsertError;
          }
        }

        if (profile && hotel) {
          await withAudit(hotel.id, profile.id, profile.full_name || '', editing ? 'update_reservation' : 'create_reservation', 'reservations', editing?.id, null, payload);
        }
        return { queued: false };
      } catch (error) {
        if (isNetworkIssue(error)) {
          enqueueOfflineSubmission({
            type: 'reservation-save',
            createdAt: new Date().toISOString(),
            payload: {
              hotelId: hotel.id,
              profileId: profile.id,
              reservationId: editing?.id,
              reservationNumber: editing?.reservation_number,
              selectedGuestId,
              createGuestRecord: !!createGuestRecord,
              nights,
              form: {
                guest_name: form.guest_name,
                guest_phone: form.guest_phone,
                guest_email: form.guest_email,
                category_id: form.category_id,
                room_id: form.room_id,
                check_in_date: form.check_in_date,
                check_out_date: form.check_out_date,
                number_of_adults: Number(form.number_of_adults || 1),
                number_of_children: Number(form.number_of_children || 0),
                total_price: Number(form.total_price || 0),
                deposit_paid: Number(form.deposit_paid || 0),
                payment_method_cash: !!form.payment_method_cash,
                payment_method_om: !!form.payment_method_om,
                payment_method_momo: !!form.payment_method_momo,
                source: form.source,
                special_requests: form.special_requests || '',
              },
            },
          });
          return { queued: true };
        }
        throw error;
      }
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['reservations'] });
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['guests'] });
      toast.success(result?.queued ? 'Reservation mise en file locale. Synchronisation en attente du reseau.' : (editing ? t('reservations.updated') : t('reservations.created')));
      closeDialog();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      if (!hotel) throw new Error('Missing context');

      try {
        const currentReservation = reservations?.find((reservation) => reservation.id === id);
        if (currentReservation?.status === status) {
          return { queued: false, noop: true };
        }

        const { error } = await supabase.from('reservations').update({ status }).eq('id', id);
        if (error) throw error;
        return { queued: false, noop: false };
      } catch (error) {
        if (isNetworkIssue(error)) {
          enqueueOfflineSubmission({
            type: 'reservation-status-update',
            createdAt: new Date().toISOString(),
            payload: {
              hotelId: hotel.id,
              reservationId: id,
              status,
            },
          });
          return { queued: true, noop: false };
        }
        throw error;
      }
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['reservations'] });
      if (result?.noop) {
        toast.info('Cette reservation est deja dans cet etat.');
      } else if (result?.queued) {
        toast.success('Changement de statut mis en file locale. Synchronisation en attente du reseau.');
      } else {
        toast.success(t('reservations.statusUpdated'));
      }
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from('reservations').delete().eq('id', id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['reservations'] }); toast.success(t('reservations.deleted')); setDeleteItem(null); },
    onError: (e: any) => toast.error(e.message),
  });

  const closeDialog = () => {
    setDialogOpen(false); setEditing(null); setSelectedGuestId(null); setSelectedGuestData(null); setGuestSearch('');
    setForm({ guest_name: '', guest_phone: '', guest_email: '', category_id: '', room_id: '', check_in_date: '', check_out_date: '', number_of_adults: 1, number_of_children: 0, total_price: 0, deposit_paid: 0, payment_method_cash: false, payment_method_om: false, payment_method_momo: false, source: 'direct', special_requests: '' });
  };

  const openEdit = (r: any) => {
    setEditing(r);
    setForm({
      guest_name: r.guest_name, guest_phone: r.guest_phone || '', guest_email: r.guest_email || '',
      category_id: r.category_id || '', room_id: r.room_id || '',
      check_in_date: r.check_in_date, check_out_date: r.check_out_date,
      number_of_adults: r.number_of_adults || 1, number_of_children: r.number_of_children || 0,
      total_price: r.total_price || 0, deposit_paid: r.deposit_paid || 0,
      payment_method_cash: r.payment_method_cash || false, payment_method_om: r.payment_method_om || false,
      payment_method_momo: r.payment_method_momo || false, source: r.source || 'direct',
      special_requests: r.special_requests || '',
    });
    setDialogOpen(true);
  };

  const selectExistingGuest = (g: any) => {
    setSelectedGuestId(g.id); setSelectedGuestData(g); setGuestSearch(`${g.last_name} ${g.first_name}`);
    setForm(f => ({ ...f, guest_name: `${g.last_name} ${g.first_name}`, guest_phone: g.phone || f.guest_phone, guest_email: g.email || f.guest_email }));
  };

  const filtered = reservations?.filter(r => {
    const matchSearch = !search || `${r.guest_name} ${r.reservation_number}`.toLowerCase().includes(search.toLowerCase());
    const matchTab = tab === 'all' || r.status === tab;
    return matchSearch && matchTab;
  }) || [];

  const pendingReservations = reservations?.filter(r => r.status === 'pending').length || 0;
  const confirmedReservations = reservations?.filter(r => r.status === 'confirmed').length || 0;
  const upcomingArrivals = reservations?.filter(r => ['pending', 'confirmed'].includes(r.status || '')).length || 0;
  const depositTotal = reservations?.reduce((sum, r) => sum + Number(r.deposit_paid || 0), 0) || 0;

  return (
    <div className="page-container space-y-6">
      <PageHeader title={t('reservations.title')} subtitle={`${filtered.length} ${t('reservations.subtitle')}`}>
        <Button onClick={() => { closeDialog(); setDialogOpen(true); }}><Plus className="h-4 w-4 mr-2" />{t('reservations.new')}</Button>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{t('reservations.summary.pending')}</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-semibold">{pendingReservations}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{t('reservations.summary.confirmed')}</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-semibold">{confirmedReservations}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{t('reservations.summary.arrivals')}</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-semibold">{upcomingArrivals}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{t('reservations.summary.deposits')}</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-semibold">{formatFCFA(depositTotal)}</p></CardContent>
        </Card>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder={t('reservations.search')} className="pl-10" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="all">{t('tabs.all')}</TabsTrigger>
          <TabsTrigger value="pending">{t('tabs.pending')}</TabsTrigger>
          <TabsTrigger value="confirmed">{t('tabs.confirmed')}</TabsTrigger>
          <TabsTrigger value="checked_in">{t('tabs.checked_in')}</TabsTrigger>
          <TabsTrigger value="cancelled">{t('tabs.cancelled')}</TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="mt-4">
          {isLoading ? (
            <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : filtered.length === 0 ? (
            <EmptyState icon={CalendarCheck} title={t('reservations.emptyTitle')} description={t('reservations.emptyDescription')} actionLabel={t('reservations.new')} onAction={() => setDialogOpen(true)} />
          ) : (
            <div className="rounded-xl border bg-card/60 shadow-sm">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>{t('reservations.table.number')}</TableHead><TableHead>{t('reservations.table.guest')}</TableHead><TableHead>{t('reservations.table.room')}</TableHead><TableHead>{t('reservations.table.checkin')}</TableHead><TableHead>{t('reservations.table.checkout')}</TableHead><TableHead>{t('reservations.table.nights')}</TableHead><TableHead className="text-right">{t('reservations.table.amount')}</TableHead><TableHead>{t('reservations.table.payment')}</TableHead><TableHead>{t('common.status')}</TableHead><TableHead className="text-right">{t('common.actions')}</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {filtered.map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono">{r.reservation_number}</TableCell>
                      <TableCell className="font-medium">{r.guest_name}</TableCell>
                      <TableCell>{(r as any).rooms?.room_number || '-'}</TableCell>
                      <TableCell>{formatDate(r.check_in_date)}</TableCell>
                      <TableCell>{formatDate(r.check_out_date)}</TableCell>
                      <TableCell>{r.number_of_nights || '-'}</TableCell>
                      <TableCell className="text-right">{formatFCFA(r.total_price)}</TableCell>
                      <TableCell>
                        {(r.deposit_paid || 0) <= 0
                          ? <Badge variant="destructive">{t('reservations.payment.pending')}</Badge>
                          : (r.deposit_paid || 0) < (r.total_price || 0)
                            ? <Badge className="bg-orange-500">{t('reservations.payment.partial')}</Badge>
                            : <Badge className="bg-green-600">{t('reservations.payment.paid')}</Badge>}
                      </TableCell>
                      <TableCell><StatusBadge status={r.status || 'pending'} /></TableCell>
                      <TableCell className="text-right space-x-1">
                        {r.status === 'pending' && <Button variant="outline" size="sm" onClick={() => statusMutation.mutate({ id: r.id, status: 'confirmed' })}><Check className="h-3 w-3 mr-1" />{t('common.confirm')}</Button>}
                        {r.status === 'confirmed' && <Button variant="outline" size="sm" onClick={() => navigate(`/check-in-out?reservationId=${r.id}`)}><LogIn className="h-3 w-3 mr-1" />{t('reservations.actions.checkin')}</Button>}
                        {(r.status === 'pending' || r.status === 'confirmed') && <Button variant="ghost" size="sm" onClick={() => statusMutation.mutate({ id: r.id, status: 'cancelled' })}><X className="h-3 w-3" /></Button>}
                        <Button variant="ghost" size="icon" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteItem(r)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* New Reservation Dialog */}
      <Dialog open={dialogOpen} onOpenChange={v => { if (!v) closeDialog(); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? t('reservations.dialog.editTitle') : t('reservations.dialog.newTitle')}</DialogTitle>
            <DialogDescription>{t('reservations.dialog.description')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            {/* Guest Search */}
            {!editing && (
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-base">{t('reservations.dialog.existingGuest')}</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder={t('reservations.dialog.existingGuestPlaceholder')} className="pl-10" value={guestSearch}
                    onChange={e => { setGuestSearch(e.target.value); setSelectedGuestId(null); setSelectedGuestData(null); }} />
                </div>
                {existingGuests && existingGuests.length > 0 && !selectedGuestId && (
                  <div className="border rounded-md max-h-32 overflow-y-auto">
                    {existingGuests.map(g => (
                      <button key={g.id} onClick={() => selectExistingGuest(g)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex justify-between">
                        <span className="font-medium">{g.last_name} {g.first_name}</span>
                        <span className="text-muted-foreground">{g.phone || ''}</span>
                      </button>
                    ))}
                  </div>
                )}
                {selectedGuestData && (
                  <Badge variant="outline" className="text-xs">{t('reservations.dialog.existingGuestBadge')} - {selectedGuestData.last_name} {selectedGuestData.first_name}</Badge>
                )}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">{t('reservations.dialog.guestSection')}</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div><Label>{t('reservations.dialog.guestName')}</Label><Input value={form.guest_name} onChange={e => setForm(f => ({ ...f, guest_name: e.target.value }))} /></div>
              <div><Label>{t('reservations.dialog.phone')}</Label><Input value={form.guest_phone} onChange={e => setForm(f => ({ ...f, guest_phone: e.target.value }))} /></div>
              <div><Label>{t('reservations.dialog.email')}</Label><Input value={form.guest_email} onChange={e => setForm(f => ({ ...f, guest_email: e.target.value }))} /></div>
              <div><Label>{t('reservations.dialog.source')}</Label>
                <Select value={form.source} onValueChange={v => setForm(f => ({ ...f, source: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="direct">{t('reservations.dialog.source.direct')}</SelectItem>
                    <SelectItem value="phone">{t('reservations.dialog.source.phone')}</SelectItem>
                    <SelectItem value="portal">{t('reservations.dialog.source.portal')}</SelectItem>
                    <SelectItem value="walkin">{t('reservations.dialog.source.walkin')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              </CardContent>
            </Card>

            {/* Category selection */}
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">{t('reservations.dialog.staySection')}</CardTitle></CardHeader>
              <CardContent className="space-y-4">
              <div>
                <Label className="text-sm font-semibold">{t('reservations.dialog.category')}</Label>
                <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                {categories?.map(cat => (
                  <button key={cat.id} onClick={() => handleCategoryChange(cat.id)}
                    className={`border-2 rounded-lg p-3 text-left transition-all ${form.category_id === cat.id ? 'border-primary bg-primary/5' : 'hover:border-muted-foreground/30'}`}
                    style={{ borderLeftColor: cat.color || undefined, borderLeftWidth: 4 }}>
                    <p className="font-semibold text-sm">{cat.name}</p>
                    <p className="text-lg font-bold">{formatFCFA(cat.price_per_night)}/nuit</p>
                  </button>
                ))}
                </div>
              </div>

            {/* Room (optional at reservation) */}
            {form.category_id && rooms && rooms.length > 0 && (
              <div>
                <Label>{t('reservations.dialog.roomOptional')}</Label>
                <Select value={form.room_id} onValueChange={v => setForm(f => ({ ...f, room_id: v }))}>
                  <SelectTrigger><SelectValue placeholder={t('reservations.dialog.assignLater')} /></SelectTrigger>
                  <SelectContent>{rooms.map(r => <SelectItem key={r.id} value={r.id}>{r.room_number} ({t('reservations.dialog.floor')} {r.floor})</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div><Label>{t('reservations.dialog.checkin')}</Label><Input type="date" value={form.check_in_date} onChange={e => {
                const ci = e.target.value;
                setForm(f => ({ ...f, check_in_date: ci, total_price: selectedCategory ? selectedCategory.price_per_night * Math.max(1, ci && f.check_out_date ? Math.ceil((new Date(f.check_out_date).getTime() - new Date(ci).getTime()) / 86400000) : 1) : f.total_price }));
              }} /></div>
              <div><Label>{t('reservations.dialog.checkout')}</Label><Input type="date" value={form.check_out_date} onChange={e => {
                const co = e.target.value;
                setForm(f => ({ ...f, check_out_date: co, total_price: selectedCategory ? selectedCategory.price_per_night * Math.max(1, f.check_in_date && co ? Math.ceil((new Date(co).getTime() - new Date(f.check_in_date).getTime()) / 86400000) : 1) : f.total_price }));
              }} /></div>
              <div><Label>{t('reservations.dialog.nights')}</Label><Input value={nights} readOnly className="bg-muted" /></div>
              <div><Label>{t('reservations.dialog.adults')}</Label><Input type="number" value={form.number_of_adults} onChange={e => setForm(f => ({ ...f, number_of_adults: Number(e.target.value) }))} /></div>
              <div><Label>{t('reservations.dialog.children')}</Label><Input type="number" value={form.number_of_children} onChange={e => setForm(f => ({ ...f, number_of_children: Number(e.target.value) }))} /></div>
            </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">{t('reservations.dialog.pricingSection')}</CardTitle></CardHeader>
              <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div><Label>{t('reservations.dialog.total')}</Label><Input type="number" value={form.total_price} onChange={e => setForm(f => ({ ...f, total_price: Number(e.target.value) }))} /></div>
                <div><Label>{t('reservations.dialog.deposit')}</Label><Input type="number" value={form.deposit_paid} onChange={e => setForm(f => ({ ...f, deposit_paid: Number(e.target.value) }))} /></div>
                <Card className="border-dashed bg-muted/40">
                  <CardHeader className="pb-2"><CardTitle className="text-sm">{t('reservations.dialog.summaryTitle')}</CardTitle></CardHeader>
                  <CardContent className="space-y-1 text-sm">
                    <p className="flex items-center justify-between"><span>{t('reservations.dialog.nights')}</span><span className="font-medium">{nights || 0}</span></p>
                    <p className="flex items-center justify-between"><span>{t('reservations.dialog.summaryCategory')}</span><span className="font-medium">{selectedCategory?.name || '-'}</span></p>
                    <p className="flex items-center justify-between"><span>{t('reservations.dialog.summaryBalance')}</span><span className="font-semibold">{formatFCFA(estimatedBalance)}</span></p>
                  </CardContent>
                </Card>
              </div>
              <div>
              <Label className="mb-2 block">{t('reservations.dialog.paymentMethods')}</Label>
              <div className="flex gap-6">
                <label className="flex items-center gap-2"><Checkbox checked={form.payment_method_cash} onCheckedChange={v => setForm(f => ({ ...f, payment_method_cash: !!v }))} /><span>Cash</span></label>
                <label className="flex items-center gap-2"><Checkbox checked={form.payment_method_om} onCheckedChange={v => setForm(f => ({ ...f, payment_method_om: !!v }))} /><span>Orange Money</span></label>
                <label className="flex items-center gap-2"><Checkbox checked={form.payment_method_momo} onCheckedChange={v => setForm(f => ({ ...f, payment_method_momo: !!v }))} /><span>MTN MoMo</span></label>
              </div>
            </div>
              </CardContent>
            </Card>

            {!selectedGuestId && !editing && (
              <label className="flex items-center gap-2">
                <Checkbox checked={createGuestRecord} onCheckedChange={v => setCreateGuestRecord(!!v)} />
                <span className="text-sm">{t('reservations.dialog.createGuestRecord')}</span>
              </label>
            )}

            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">{t('reservations.dialog.notesSection')}</CardTitle></CardHeader>
              <CardContent><Textarea value={form.special_requests} onChange={e => setForm(f => ({ ...f, special_requests: e.target.value }))} /></CardContent>
            </Card>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>{t('common.cancel')}</Button>
            <Button onClick={() => { if (!saveMutation.isPending) saveMutation.mutate(); }} disabled={!form.guest_name || !form.check_in_date || !form.check_out_date || saveMutation.isPending}>{t('common.save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={!!deleteItem} onOpenChange={() => setDeleteItem(null)} title={t('reservations.deleteTitle')} description={`${t('reservations.deleteDescription')} ${deleteItem?.guest_name || ''} ?`} onConfirm={() => deleteMutation.mutate(deleteItem.id)} confirmLabel={t('common.delete')} variant="destructive" />
    </div>
  );
};

export default ReservationsPage;
