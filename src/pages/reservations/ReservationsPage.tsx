import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useHotel } from '@/contexts/HotelContext';
import { useRoleGuard } from '@/hooks/useRoleGuard';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { formatFCFA, formatDate, generateReservationNumber } from '@/utils/formatters';
import { withAudit } from '@/utils/auditLog';
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
import { toast } from 'sonner';
import { CalendarCheck, Plus, Search, Pencil, Trash2, Check, X, LogIn } from 'lucide-react';

const ReservationsPage = () => {
  useRoleGuard(['admin', 'manager', 'receptionist']);
  const { profile } = useAuth();
  const { hotel } = useHotel();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [deleteItem, setDeleteItem] = useState<any>(null);

  // Guest search
  const [guestSearch, setGuestSearch] = useState('');
  const [selectedGuestId, setSelectedGuestId] = useState<string | null>(null);
  const [selectedGuestData, setSelectedGuestData] = useState<any>(null);
  const [createGuestRecord, setCreateGuestRecord] = useState(true);

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

      // Create guest record if new and checkbox checked
      let guestId = selectedGuestId;
      if (!guestId && createGuestRecord && form.guest_name) {
        const nameParts = form.guest_name.trim().split(' ');
        const lastName = nameParts[0] || form.guest_name;
        const firstName = nameParts.slice(1).join(' ') || '';
        const { data: g } = await supabase.from('guests').insert({
          hotel_id: hotel.id, last_name: lastName, first_name: firstName || lastName,
          phone: form.guest_phone || null, email: form.guest_email || null,
        }).select().single();
        if (g) guestId = g.id;
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

      if (editing) {
        payload.reservation_number = editing.reservation_number;
        const { error } = await supabase.from('reservations').update(payload).eq('id', editing.id);
        if (error) throw error;
      } else {
        payload.reservation_number = generateReservationNumber();
        payload.created_by = profile.id;
        const { error } = await supabase.from('reservations').insert(payload);
        if (error) throw error;
      }

      if (profile && hotel) {
        await withAudit(hotel.id, profile.id, profile.full_name || '', editing ? 'update_reservation' : 'create_reservation', 'reservations', editing?.id, null, payload);
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['reservations'] }); toast.success(editing ? 'Réservation modifiée' : 'Réservation créée'); closeDialog(); },
    onError: (e: any) => toast.error(e.message),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from('reservations').update({ status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['reservations'] }); toast.success('Statut mis à jour'); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from('reservations').delete().eq('id', id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['reservations'] }); toast.success('Réservation supprimée'); setDeleteItem(null); },
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

  return (
    <div className="page-container space-y-6">
      <PageHeader title="Réservations" subtitle={`${filtered.length} réservation(s)`}>
        <Button onClick={() => { closeDialog(); setDialogOpen(true); }}><Plus className="h-4 w-4 mr-2" />Nouvelle réservation</Button>
      </PageHeader>

      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher..." className="pl-10" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="all">Toutes</TabsTrigger>
          <TabsTrigger value="pending">En attente</TabsTrigger>
          <TabsTrigger value="confirmed">Confirmées</TabsTrigger>
          <TabsTrigger value="checked_in">Checked-in</TabsTrigger>
          <TabsTrigger value="cancelled">Annulées</TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="mt-4">
          {isLoading ? (
            <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : filtered.length === 0 ? (
            <EmptyState icon={CalendarCheck} title="Aucune réservation" description="Créez votre première réservation" actionLabel="Nouvelle réservation" onAction={() => setDialogOpen(true)} />
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>N° Réservation</TableHead><TableHead>Client</TableHead><TableHead>Chambre</TableHead><TableHead>Arrivée</TableHead><TableHead>Départ</TableHead><TableHead>Nuits</TableHead><TableHead className="text-right">Montant</TableHead><TableHead>Paiement</TableHead><TableHead>Statut</TableHead><TableHead className="text-right">Actions</TableHead>
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
                          ? <Badge variant="destructive">En attente</Badge>
                          : (r.deposit_paid || 0) < (r.total_price || 0)
                            ? <Badge className="bg-orange-500">Partiel</Badge>
                            : <Badge className="bg-green-600">Payé</Badge>}
                      </TableCell>
                      <TableCell><StatusBadge status={r.status || 'pending'} /></TableCell>
                      <TableCell className="text-right space-x-1">
                        {r.status === 'pending' && <Button variant="outline" size="sm" onClick={() => statusMutation.mutate({ id: r.id, status: 'confirmed' })}><Check className="h-3 w-3 mr-1" />Confirmer</Button>}
                        {r.status === 'confirmed' && <Button variant="outline" size="sm" onClick={() => statusMutation.mutate({ id: r.id, status: 'checked_in' })}><LogIn className="h-3 w-3 mr-1" />Check-in</Button>}
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
            <DialogTitle>{editing ? 'Modifier la réservation' : 'Nouvelle réservation'}</DialogTitle>
            <DialogDescription>Remplissez les informations de la réservation</DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            {/* Guest Search */}
            {!editing && (
              <div className="space-y-3">
                <Label className="text-sm font-semibold">Rechercher un client existant</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Nom, téléphone, ID..." className="pl-10" value={guestSearch}
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
                  <Badge variant="outline" className="text-xs">Client existant — {selectedGuestData.last_name} {selectedGuestData.first_name}</Badge>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div><Label>Nom du client *</Label><Input value={form.guest_name} onChange={e => setForm(f => ({ ...f, guest_name: e.target.value }))} /></div>
              <div><Label>Téléphone</Label><Input value={form.guest_phone} onChange={e => setForm(f => ({ ...f, guest_phone: e.target.value }))} /></div>
              <div><Label>Email</Label><Input value={form.guest_email} onChange={e => setForm(f => ({ ...f, guest_email: e.target.value }))} /></div>
              <div><Label>Source</Label>
                <Select value={form.source} onValueChange={v => setForm(f => ({ ...f, source: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="direct">Direct</SelectItem>
                    <SelectItem value="phone">Téléphone</SelectItem>
                    <SelectItem value="portal">Portail</SelectItem>
                    <SelectItem value="walkin">Walk-in</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Category selection */}
            <div>
              <Label className="text-sm font-semibold">Catégorie de chambre</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-2">
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
                <Label>Chambre (optionnel — peut être assignée au check-in)</Label>
                <Select value={form.room_id} onValueChange={v => setForm(f => ({ ...f, room_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Assigner plus tard" /></SelectTrigger>
                  <SelectContent>{rooms.map(r => <SelectItem key={r.id} value={r.id}>{r.room_number} (Étage {r.floor})</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div><Label>Arrivée *</Label><Input type="date" value={form.check_in_date} onChange={e => {
                const ci = e.target.value;
                setForm(f => ({ ...f, check_in_date: ci, total_price: selectedCategory ? selectedCategory.price_per_night * Math.max(1, ci && f.check_out_date ? Math.ceil((new Date(f.check_out_date).getTime() - new Date(ci).getTime()) / 86400000) : 1) : f.total_price }));
              }} /></div>
              <div><Label>Départ *</Label><Input type="date" value={form.check_out_date} onChange={e => {
                const co = e.target.value;
                setForm(f => ({ ...f, check_out_date: co, total_price: selectedCategory ? selectedCategory.price_per_night * Math.max(1, f.check_in_date && co ? Math.ceil((new Date(co).getTime() - new Date(f.check_in_date).getTime()) / 86400000) : 1) : f.total_price }));
              }} /></div>
              <div><Label>Nuits</Label><Input value={nights} readOnly className="bg-muted" /></div>
              <div><Label>Adultes</Label><Input type="number" value={form.number_of_adults} onChange={e => setForm(f => ({ ...f, number_of_adults: Number(e.target.value) }))} /></div>
              <div><Label>Enfants</Label><Input type="number" value={form.number_of_children} onChange={e => setForm(f => ({ ...f, number_of_children: Number(e.target.value) }))} /></div>
              <div><Label>Montant total</Label><Input type="number" value={form.total_price} onChange={e => setForm(f => ({ ...f, total_price: Number(e.target.value) }))} /></div>
              <div><Label>Acompte versé</Label><Input type="number" value={form.deposit_paid} onChange={e => setForm(f => ({ ...f, deposit_paid: Number(e.target.value) }))} /></div>
            </div>

            <div>
              <Label className="mb-2 block">Mode de paiement</Label>
              <div className="flex gap-6">
                <label className="flex items-center gap-2"><Checkbox checked={form.payment_method_cash} onCheckedChange={v => setForm(f => ({ ...f, payment_method_cash: !!v }))} /><span>Cash</span></label>
                <label className="flex items-center gap-2"><Checkbox checked={form.payment_method_om} onCheckedChange={v => setForm(f => ({ ...f, payment_method_om: !!v }))} /><span>Orange Money</span></label>
                <label className="flex items-center gap-2"><Checkbox checked={form.payment_method_momo} onCheckedChange={v => setForm(f => ({ ...f, payment_method_momo: !!v }))} /><span>MTN MoMo</span></label>
              </div>
            </div>

            {!selectedGuestId && !editing && (
              <label className="flex items-center gap-2">
                <Checkbox checked={createGuestRecord} onCheckedChange={v => setCreateGuestRecord(!!v)} />
                <span className="text-sm">Créer ce client dans la base</span>
              </label>
            )}

            <div><Label>Demandes spéciales</Label><Textarea value={form.special_requests} onChange={e => setForm(f => ({ ...f, special_requests: e.target.value }))} /></div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Annuler</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!form.guest_name || !form.check_in_date || !form.check_out_date || saveMutation.isPending}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={!!deleteItem} onOpenChange={() => setDeleteItem(null)} title="Supprimer la réservation" description={`Supprimer la réservation de ${deleteItem?.guest_name} ?`} onConfirm={() => deleteMutation.mutate(deleteItem.id)} confirmLabel="Supprimer" variant="destructive" />
    </div>
  );
};

export default ReservationsPage;
