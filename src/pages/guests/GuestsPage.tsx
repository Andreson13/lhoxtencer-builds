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
import { formatFCFA, formatDate, generateInvoiceNumber } from '@/utils/formatters';
import { withAudit } from '@/utils/auditLog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Users, Plus, Search, Pencil, Trash2, BedDouble, Eye, ArrowLeft } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

const guestSchema = z.object({
  last_name: z.string().min(1, 'Nom requis'),
  first_name: z.string().min(1, 'Prénom requis'),
  maiden_name: z.string().optional(),
  gender: z.string().optional(),
  nationality: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('Email invalide').optional().or(z.literal('')),
  date_of_birth: z.string().optional(),
  place_of_birth: z.string().optional(),
  country_of_residence: z.string().optional(),
  usual_address: z.string().optional(),
  profession: z.string().optional(),
  id_type: z.string().optional(),
  id_number: z.string().optional(),
  id_issued_on: z.string().optional(),
  id_issued_at: z.string().optional(),
  notes: z.string().optional(),
});

const staySchema = z.object({
  stay_type: z.string().default('night'),
  room_id: z.string().min(1, 'Chambre requise'),
  check_in_date: z.string().min(1, 'Date requise'),
  check_out_date: z.string().min(1, 'Date requise'),
  number_of_adults: z.coerce.number().min(1).default(1),
  number_of_children: z.coerce.number().min(0).default(0),
  arrangement: z.string().optional(),
  price_per_night: z.coerce.number().min(0).default(0),
  notes: z.string().optional(),
});

type GuestForm = z.infer<typeof guestSchema>;
type StayForm = z.infer<typeof staySchema>;

const GuestsPage = () => {
  useRoleGuard(['admin', 'manager', 'receptionist']);
  const { profile } = useAuth();
  const { hotel } = useHotel();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [stayDialogOpen, setStayDialogOpen] = useState(false);
  const [editingGuest, setEditingGuest] = useState<any>(null);
  const [deleteGuest, setDeleteGuest] = useState<any>(null);
  const [selectedGuestId, setSelectedGuestId] = useState<string | null>(null);
  const [stayGuestId, setStayGuestId] = useState<string | null>(null);

  const guestForm = useForm<GuestForm>({
    resolver: zodResolver(guestSchema),
    defaultValues: { nationality: 'Camerounaise', country_of_residence: 'Cameroun' },
  });

  const stayForm = useForm<StayForm>({
    resolver: zodResolver(staySchema),
    defaultValues: { stay_type: 'night', number_of_adults: 1, number_of_children: 0, price_per_night: 0 },
  });

  const stayCheckIn = stayForm.watch('check_in_date');
  const stayCheckOut = stayForm.watch('check_out_date');
  const stayPPN = stayForm.watch('price_per_night');
  const nights = stayCheckIn && stayCheckOut ? Math.max(1, Math.ceil((new Date(stayCheckOut).getTime() - new Date(stayCheckIn).getTime()) / 86400000)) : 0;
  const totalPrice = nights * (stayPPN || 0);

  // Fetch guests with stay counts
  const { data: guests, isLoading } = useQuery({
    queryKey: ['guests', hotel?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('guests')
        .select('*')
        .eq('hotel_id', hotel!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!hotel?.id,
  });

  // Fetch stays for counting
  const { data: allStays } = useQuery({
    queryKey: ['stays-all', hotel?.id],
    queryFn: async () => {
      const { data } = await supabase.from('stays').select('guest_id, status, check_in_date, room_id, rooms(room_number)').eq('hotel_id', hotel!.id).order('check_in_date', { ascending: false });
      return data || [];
    },
    enabled: !!hotel?.id,
  });

  const { data: rooms } = useQuery({
    queryKey: ['rooms-available', hotel?.id],
    queryFn: async () => {
      const { data } = await supabase.from('rooms').select('id, room_number, price_per_night').eq('hotel_id', hotel!.id).eq('status', 'available');
      return data || [];
    },
    enabled: !!hotel?.id,
  });

  // Selected guest profile data
  const selectedGuest = guests?.find(g => g.id === selectedGuestId);
  const { data: guestStays } = useQuery({
    queryKey: ['guest-stays', selectedGuestId],
    queryFn: async () => {
      const { data } = await supabase.from('stays').select('*, rooms(room_number)').eq('guest_id', selectedGuestId!).order('check_in_date', { ascending: false });
      return data || [];
    },
    enabled: !!selectedGuestId,
  });

  const stayCountMap = React.useMemo(() => {
    const map: Record<string, { count: number; lastVisit: string | null; hasActive: boolean }> = {};
    allStays?.forEach(s => {
      if (!map[s.guest_id]) map[s.guest_id] = { count: 0, lastVisit: null, hasActive: false };
      map[s.guest_id].count++;
      if (!map[s.guest_id].lastVisit || (s.check_in_date && s.check_in_date > map[s.guest_id].lastVisit!)) {
        map[s.guest_id].lastVisit = s.check_in_date;
      }
      if (s.status === 'active') map[s.guest_id].hasActive = true;
    });
    return map;
  }, [allStays]);

  const saveMutation = useMutation({
    mutationFn: async (values: GuestForm) => {
      const payload: any = {
        ...values,
        hotel_id: hotel!.id,
        email: values.email || null,
      };
      if (editingGuest) {
        const { error } = await supabase.from('guests').update(payload).eq('id', editingGuest.id);
        if (error) throw error;
        await withAudit(hotel!.id, profile!.id, profile!.full_name || '', 'update', 'guests', editingGuest.id, editingGuest, payload);
      } else {
        const { data, error } = await supabase.from('guests').insert(payload).select().single();
        if (error) throw error;
        await withAudit(hotel!.id, profile!.id, profile!.full_name || '', 'create', 'guests', data.id, null, payload);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['guests'] });
      toast.success(editingGuest ? 'Client modifié' : 'Client ajouté');
      closeDialog();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const createStayMutation = useMutation({
    mutationFn: async (values: StayForm) => {
      if (!stayGuestId || !hotel || !profile) throw new Error('Missing context');

      // Create invoice
      const { data: invoice, error: invErr } = await supabase.from('invoices').insert({
        hotel_id: hotel.id,
        guest_id: stayGuestId,
        invoice_number: generateInvoiceNumber(),
        subtotal: totalPrice,
        total_amount: totalPrice,
        balance_due: totalPrice,
        created_by: profile.id,
        created_by_name: profile.full_name,
      } as any).select().single();
      if (invErr) throw invErr;

      // Create stay
      const { data: stay, error: stayErr } = await supabase.from('stays').insert({
        hotel_id: hotel.id,
        guest_id: stayGuestId,
        stay_type: values.stay_type,
        room_id: values.room_id,
        check_in_date: new Date(values.check_in_date).toISOString(),
        check_out_date: new Date(values.check_out_date).toISOString(),
        number_of_nights: nights,
        number_of_adults: values.number_of_adults,
        number_of_children: values.number_of_children,
        arrangement: values.arrangement || null,
        price_per_night: values.price_per_night,
        total_price: totalPrice,
        status: 'active',
        invoice_id: invoice.id,
        receptionist_id: profile.id,
        receptionist_name: profile.full_name,
        created_by: profile.id,
        created_by_name: profile.full_name,
        notes: values.notes || null,
      } as any).select().single();
      if (stayErr) throw stayErr;

      // Add room charge invoice item
      await supabase.from('invoice_items').insert({
        hotel_id: hotel.id,
        invoice_id: invoice.id,
        description: `Hébergement - ${nights} nuit(s)`,
        item_type: 'room',
        quantity: nights,
        unit_price: values.price_per_night,
        subtotal: totalPrice,
      });

      // Safety: also update room to occupied
      await supabase.from('rooms').update({ status: 'occupied' }).eq('id', values.room_id);

      await withAudit(hotel.id, profile.id, profile.full_name || '', 'create_stay', 'stays', stay.id, null, { guest_id: stayGuestId, room_id: values.room_id });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stays-all'] });
      qc.invalidateQueries({ queryKey: ['guest-stays'] });
      qc.invalidateQueries({ queryKey: ['rooms'] });
      qc.invalidateQueries({ queryKey: ['invoices'] });
      toast.success('Séjour créé avec succès');
      setStayDialogOpen(false);
      stayForm.reset();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('guests').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['guests'] });
      toast.success('Client supprimé');
      setDeleteGuest(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingGuest(null);
    guestForm.reset({ nationality: 'Camerounaise', country_of_residence: 'Cameroun' });
  };

  const openEdit = (guest: any) => {
    setEditingGuest(guest);
    Object.keys(guestSchema.shape).forEach((key) => {
      const val = guest[key];
      if (val !== undefined && val !== null) guestForm.setValue(key as any, key.includes('date') && val ? val.split('T')[0] : val);
    });
    setDialogOpen(true);
  };

  const openNewStay = (guestId: string) => {
    setStayGuestId(guestId);
    stayForm.reset({ stay_type: 'night', number_of_adults: 1, number_of_children: 0, price_per_night: 0, check_in_date: new Date().toISOString().split('T')[0] });
    setStayDialogOpen(true);
  };

  const filtered = guests?.filter(g => {
    return !search || `${g.last_name} ${g.first_name} ${g.id_number || ''} ${g.phone || ''}`.toLowerCase().includes(search.toLowerCase());
  }) || [];

  // ---- GUEST PROFILE VIEW ----
  if (selectedGuestId && selectedGuest) {
    const activeStay = guestStays?.find(s => s.status === 'active');
    return (
      <div className="page-container space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setSelectedGuestId(null)}><ArrowLeft className="h-5 w-5" /></Button>
          <PageHeader title={`${selectedGuest.last_name} ${selectedGuest.first_name}`} subtitle="Profil client">
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => openEdit(selectedGuest)}><Pencil className="h-4 w-4 mr-2" />Modifier</Button>
              <Button onClick={() => openNewStay(selectedGuest.id)}><Plus className="h-4 w-4 mr-2" />Nouveau séjour</Button>
            </div>
          </PageHeader>
        </div>

        {/* Personal info card */}
        <Card>
          <CardHeader><CardTitle>Informations personnelles</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div><span className="text-muted-foreground">Genre:</span> {selectedGuest.gender || '-'}</div>
              <div><span className="text-muted-foreground">Né(e) le:</span> {formatDate(selectedGuest.date_of_birth)}</div>
              <div><span className="text-muted-foreground">Lieu:</span> {selectedGuest.place_of_birth || '-'}</div>
              <div><span className="text-muted-foreground">Nationalité:</span> {selectedGuest.nationality || '-'}</div>
              <div><span className="text-muted-foreground">Téléphone:</span> {selectedGuest.phone || '-'}</div>
              <div><span className="text-muted-foreground">Email:</span> {selectedGuest.email || '-'}</div>
              <div><span className="text-muted-foreground">Profession:</span> {selectedGuest.profession || '-'}</div>
              <div><span className="text-muted-foreground">Adresse:</span> {selectedGuest.usual_address || '-'}</div>
              <div><span className="text-muted-foreground">Pièce:</span> {selectedGuest.id_type || '-'} {selectedGuest.id_number || ''}</div>
              <div><span className="text-muted-foreground">Délivré le:</span> {formatDate(selectedGuest.id_issued_on)}</div>
              <div><span className="text-muted-foreground">Délivré à:</span> {selectedGuest.id_issued_at || '-'}</div>
            </div>
          </CardContent>
        </Card>

        {/* Active stay */}
        {activeStay && (
          <Card className="border-primary">
            <CardHeader><CardTitle className="flex items-center gap-2"><BedDouble className="h-5 w-5" />Séjour actif</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-4 text-sm">
                <div><span className="text-muted-foreground">Chambre:</span> <span className="font-bold">{(activeStay as any).rooms?.room_number}</span></div>
                <div><span className="text-muted-foreground">Arrivée:</span> {formatDate(activeStay.check_in_date)}</div>
                <div><span className="text-muted-foreground">Départ prévu:</span> {formatDate(activeStay.check_out_date)}</div>
                <div><span className="text-muted-foreground">Total:</span> <span className="font-bold">{formatFCFA(activeStay.total_price)}</span></div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stay history */}
        <Card>
          <CardHeader><CardTitle>Historique des séjours</CardTitle></CardHeader>
          <CardContent>
            {!guestStays?.length ? (
              <p className="text-muted-foreground text-center py-4">Aucun séjour enregistré</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Chambre</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Arrivée</TableHead>
                    <TableHead>Départ</TableHead>
                    <TableHead>Nuits</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {guestStays.map(s => (
                    <TableRow key={s.id}>
                      <TableCell className="font-mono">{(s as any).rooms?.room_number || '-'}</TableCell>
                      <TableCell><Badge variant="outline">{s.stay_type === 'sieste' ? 'Sieste' : 'Nuit'}</Badge></TableCell>
                      <TableCell>{formatDate(s.check_in_date)}</TableCell>
                      <TableCell>{formatDate(s.actual_check_out || s.check_out_date)}</TableCell>
                      <TableCell>{s.number_of_nights || '-'}</TableCell>
                      <TableCell className="text-right">{formatFCFA(s.total_price)}</TableCell>
                      <TableCell><StatusBadge status={s.status || 'active'} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Dialogs rendered below */}
        {renderGuestDialog()}
        {renderStayDialog()}
      </div>
    );
  }

  // ---- GUEST DIRECTORY VIEW ----
  function renderGuestDialog() {
    return (
      <Dialog open={dialogOpen} onOpenChange={v => { if (!v) closeDialog(); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingGuest ? 'Modifier le client' : 'Nouveau client'}</DialogTitle>
            <DialogDescription>Informations personnelles uniquement</DialogDescription>
          </DialogHeader>
          <form onSubmit={guestForm.handleSubmit(d => saveMutation.mutate(d))} className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-3">Identité</h3>
              <div className="grid grid-cols-3 gap-4">
                <div><Label>Nom *</Label><Input {...guestForm.register('last_name')} />{guestForm.formState.errors.last_name && <p className="text-sm text-destructive mt-1">{guestForm.formState.errors.last_name.message}</p>}</div>
                <div><Label>Prénom *</Label><Input {...guestForm.register('first_name')} />{guestForm.formState.errors.first_name && <p className="text-sm text-destructive mt-1">{guestForm.formState.errors.first_name.message}</p>}</div>
                <div><Label>Nom de jeune fille</Label><Input {...guestForm.register('maiden_name')} /></div>
                <div><Label>Genre</Label><Select onValueChange={v => guestForm.setValue('gender', v)} value={guestForm.watch('gender') || ''}><SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger><SelectContent><SelectItem value="M">Masculin</SelectItem><SelectItem value="F">Féminin</SelectItem></SelectContent></Select></div>
                <div><Label>Date de naissance</Label><Input type="date" {...guestForm.register('date_of_birth')} /></div>
                <div><Label>Lieu de naissance</Label><Input {...guestForm.register('place_of_birth')} /></div>
                <div><Label>Nationalité</Label><Input {...guestForm.register('nationality')} /></div>
                <div><Label>Pays de résidence</Label><Input {...guestForm.register('country_of_residence')} /></div>
                <div><Label>Adresse</Label><Input {...guestForm.register('usual_address')} /></div>
                <div><Label>Profession</Label><Input {...guestForm.register('profession')} /></div>
                <div><Label>Téléphone</Label><Input {...guestForm.register('phone')} /></div>
                <div><Label>Email</Label><Input type="email" {...guestForm.register('email')} /></div>
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-3">Pièce d'identité</h3>
              <div className="grid grid-cols-4 gap-4">
                <div><Label>Type</Label><Select onValueChange={v => guestForm.setValue('id_type', v)} value={guestForm.watch('id_type') || ''}><SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger><SelectContent><SelectItem value="cni">CNI</SelectItem><SelectItem value="passport">Passeport</SelectItem><SelectItem value="permit">Permis</SelectItem></SelectContent></Select></div>
                <div><Label>Numéro</Label><Input {...guestForm.register('id_number')} /></div>
                <div><Label>Délivré le</Label><Input type="date" {...guestForm.register('id_issued_on')} /></div>
                <div><Label>Délivré à</Label><Input {...guestForm.register('id_issued_at')} /></div>
              </div>
            </div>
            <div><Label>Notes</Label><Textarea {...guestForm.register('notes')} /></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>Annuler</Button>
              <Button type="submit" disabled={saveMutation.isPending}>{saveMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    );
  }

  function renderStayDialog() {
    return (
      <Dialog open={stayDialogOpen} onOpenChange={v => { if (!v) { setStayDialogOpen(false); stayForm.reset(); } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nouveau séjour</DialogTitle>
            <DialogDescription>Détails du séjour pour {guests?.find(g => g.id === stayGuestId)?.last_name} {guests?.find(g => g.id === stayGuestId)?.first_name}</DialogDescription>
          </DialogHeader>
          <form onSubmit={stayForm.handleSubmit(d => createStayMutation.mutate(d))} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Type de séjour</Label>
                <Select onValueChange={v => stayForm.setValue('stay_type', v)} defaultValue="night">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="night">Nuit</SelectItem>
                    <SelectItem value="sieste">Sieste</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Chambre *</Label>
                <Select onValueChange={v => {
                  stayForm.setValue('room_id', v);
                  const room = rooms?.find(r => r.id === v);
                  if (room) stayForm.setValue('price_per_night', room.price_per_night);
                }}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                  <SelectContent>{rooms?.map(r => <SelectItem key={r.id} value={r.id}>{r.room_number} — {formatFCFA(r.price_per_night)}</SelectItem>)}</SelectContent>
                </Select>
                {stayForm.formState.errors.room_id && <p className="text-sm text-destructive mt-1">{stayForm.formState.errors.room_id.message}</p>}
              </div>
              <div><Label>Arrivée *</Label><Input type="date" {...stayForm.register('check_in_date')} /></div>
              <div><Label>Départ *</Label><Input type="date" {...stayForm.register('check_out_date')} /></div>
              <div><Label>Prix/nuit</Label><Input type="number" {...stayForm.register('price_per_night')} /></div>
              <div><Label>Nuits</Label><Input value={nights} readOnly className="bg-muted" /></div>
              <div><Label>Total</Label><Input value={formatFCFA(totalPrice)} readOnly className="bg-muted" /></div>
              <div><Label>Adultes</Label><Input type="number" {...stayForm.register('number_of_adults')} /></div>
              <div><Label>Enfants</Label><Input type="number" {...stayForm.register('number_of_children')} /></div>
              <div><Label>Arrangement</Label><Input {...stayForm.register('arrangement')} /></div>
            </div>
            <div><Label>Notes</Label><Textarea {...stayForm.register('notes')} /></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setStayDialogOpen(false)}>Annuler</Button>
              <Button type="submit" disabled={createStayMutation.isPending}>Créer le séjour</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <div className="page-container space-y-6">
      <PageHeader title="Clients" subtitle={`${filtered.length} client(s)`}>
        <Button onClick={() => { guestForm.reset({ nationality: 'Camerounaise', country_of_residence: 'Cameroun' }); setDialogOpen(true); }}><Plus className="h-4 w-4 mr-2" />Nouveau client</Button>
      </PageHeader>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Rechercher par nom, téléphone, ID..." className="pl-10" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Users} title="Aucun client" description="Ajoutez votre premier client" actionLabel="Nouveau client" onAction={() => setDialogOpen(true)} />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom complet</TableHead>
                <TableHead>Téléphone</TableHead>
                <TableHead>Nationalité</TableHead>
                <TableHead>N° ID</TableHead>
                <TableHead className="text-center">Séjours</TableHead>
                <TableHead>Dernière visite</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(g => {
                const info = stayCountMap[g.id] || { count: 0, lastVisit: null, hasActive: false };
                return (
                  <TableRow key={g.id}>
                    <TableCell className="font-medium">
                      {g.last_name} {g.first_name}
                      {info.hasActive && <Badge variant="default" className="ml-2 text-xs">Présent</Badge>}
                    </TableCell>
                    <TableCell>{g.phone || '-'}</TableCell>
                    <TableCell>{g.nationality || '-'}</TableCell>
                    <TableCell>{g.id_number || '-'}</TableCell>
                    <TableCell className="text-center">{info.count}</TableCell>
                    <TableCell>{info.lastVisit ? formatDate(info.lastVisit) : '-'}</TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="icon" onClick={() => setSelectedGuestId(g.id)} title="Voir le profil"><Eye className="h-4 w-4" /></Button>
                      <Button variant="outline" size="sm" onClick={() => openNewStay(g.id)}><BedDouble className="h-3 w-3 mr-1" />Séjour</Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteGuest(g)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {renderGuestDialog()}
      {renderStayDialog()}
      <ConfirmDialog open={!!deleteGuest} onOpenChange={() => setDeleteGuest(null)} title="Supprimer le client" description={`Voulez-vous supprimer ${deleteGuest?.last_name} ${deleteGuest?.first_name} ?`} onConfirm={() => deleteMutation.mutate(deleteGuest.id)} confirmLabel="Supprimer" variant="destructive" />
    </div>
  );
};

export default GuestsPage;
