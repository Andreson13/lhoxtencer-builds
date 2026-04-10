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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { CalendarCheck, Plus, Search, Pencil, Trash2, Check, X, LogIn } from 'lucide-react';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

const schema = z.object({
  guest_name: z.string().min(1, 'Nom requis'),
  guest_phone: z.string().optional(),
  guest_email: z.string().optional(),
  room_id: z.string().optional(),
  room_type_id: z.string().optional(),
  check_in_date: z.string().min(1, 'Date requise'),
  check_out_date: z.string().min(1, 'Date requise'),
  number_of_adults: z.coerce.number().min(1).default(1),
  number_of_children: z.coerce.number().min(0).default(0),
  total_price: z.coerce.number().min(0).default(0),
  deposit_paid: z.coerce.number().min(0).default(0),
  payment_method_cash: z.boolean().default(false),
  payment_method_om: z.boolean().default(false),
  payment_method_momo: z.boolean().default(false),
  source: z.string().default('direct'),
  special_requests: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

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

  const { register, handleSubmit, reset, setValue, watch, control, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { number_of_adults: 1, number_of_children: 0, total_price: 0, deposit_paid: 0, source: 'direct' },
  });

  const checkIn = watch('check_in_date');
  const checkOut = watch('check_out_date');
  const nights = checkIn && checkOut ? Math.max(1, Math.ceil((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000)) : 0;

  const { data: reservations, isLoading } = useQuery({
    queryKey: ['reservations', hotel?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('reservations').select('*, rooms(room_number)').eq('hotel_id', hotel!.id).order('check_in_date', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!hotel?.id,
  });

  const { data: rooms } = useQuery({
    queryKey: ['rooms-all', hotel?.id],
    queryFn: async () => {
      const { data } = await supabase.from('rooms').select('id, room_number, price_per_night, room_type_id').eq('hotel_id', hotel!.id);
      return data || [];
    },
    enabled: !!hotel?.id,
  });

  const { data: roomTypes } = useQuery({
    queryKey: ['room-types', hotel?.id],
    queryFn: async () => {
      const { data } = await supabase.from('room_types').select('*').eq('hotel_id', hotel!.id);
      return data || [];
    },
    enabled: !!hotel?.id,
  });

  const saveMutation = useMutation({
    mutationFn: async (values: FormData) => {
      const payload: any = {
        ...values,
        hotel_id: hotel!.id,
        number_of_nights: nights,
        reservation_number: editing?.reservation_number || generateReservationNumber(),
        created_by: profile?.id,
        guest_email: values.guest_email || null,
        guest_phone: values.guest_phone || null,
        special_requests: values.special_requests || null,
        room_id: values.room_id || null,
        room_type_id: values.room_type_id || null,
      };
      if (editing) {
        const { error } = await supabase.from('reservations').update(payload).eq('id', editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('reservations').insert(payload);
        if (error) throw error;
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

  const closeDialog = () => { setDialogOpen(false); setEditing(null); reset(); };

  const openEdit = (r: any) => {
    setEditing(r);
    Object.keys(schema.shape).forEach(k => { const v = r[k]; if (v != null) setValue(k as any, v); });
    setDialogOpen(true);
  };

  const filtered = reservations?.filter(r => {
    const matchSearch = !search || `${r.guest_name} ${r.reservation_number}`.toLowerCase().includes(search.toLowerCase());
    const matchTab = tab === 'all' || r.status === tab;
    return matchSearch && matchTab;
  }) || [];

  return (
    <div className="page-container space-y-6">
      <PageHeader title="Réservations" subtitle={`${filtered.length} réservation(s)`}>
        <Button onClick={() => { reset(); setDialogOpen(true); }}><Plus className="h-4 w-4 mr-2" />Nouvelle réservation</Button>
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
                <TableHeader>
                  <TableRow>
                    <TableHead>N° Réservation</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Chambre</TableHead>
                    <TableHead>Arrivée</TableHead>
                    <TableHead>Départ</TableHead>
                    <TableHead>Nuits</TableHead>
                    <TableHead className="text-right">Montant</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
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

      <Dialog open={dialogOpen} onOpenChange={v => { if (!v) closeDialog(); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Modifier la réservation' : 'Nouvelle réservation'}</DialogTitle>
            <DialogDescription>Remplissez les informations de la réservation</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(d => saveMutation.mutate(d))} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Nom du client *</Label><Input {...register('guest_name')} />{errors.guest_name && <p className="text-sm text-destructive">{errors.guest_name.message}</p>}</div>
              <div><Label>Téléphone</Label><Input {...register('guest_phone')} /></div>
              <div><Label>Email</Label><Input {...register('guest_email')} /></div>
              <div><Label>Source</Label>
                <Select onValueChange={v => setValue('source', v)} defaultValue="direct">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="direct">Direct</SelectItem>
                    <SelectItem value="phone">Téléphone</SelectItem>
                    <SelectItem value="portal">Portail</SelectItem>
                    <SelectItem value="walkin">Walk-in</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Chambre</Label>
                <Select onValueChange={v => { setValue('room_id', v); const room = rooms?.find(r => r.id === v); if (room) setValue('total_price', room.price_per_night * Math.max(nights, 1)); }}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                  <SelectContent>{rooms?.map(r => <SelectItem key={r.id} value={r.id}>{r.room_number}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Type de chambre</Label>
                <Select onValueChange={v => setValue('room_type_id', v)}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                  <SelectContent>{roomTypes?.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Arrivée *</Label><Input type="date" {...register('check_in_date')} /></div>
              <div><Label>Départ *</Label><Input type="date" {...register('check_out_date')} /></div>
              <div><Label>Adultes</Label><Input type="number" {...register('number_of_adults')} /></div>
              <div><Label>Enfants</Label><Input type="number" {...register('number_of_children')} /></div>
              <div><Label>Montant total</Label><Input type="number" {...register('total_price')} /></div>
              <div><Label>Acompte versé</Label><Input type="number" {...register('deposit_paid')} /></div>
            </div>
            <div>
              <Label className="mb-2 block">Mode de paiement</Label>
              <div className="flex gap-6">
                <Controller control={control} name="payment_method_cash" render={({ field }) => (
                  <div className="flex items-center gap-2"><Checkbox checked={field.value} onCheckedChange={field.onChange} /><span>Cash</span></div>
                )} />
                <Controller control={control} name="payment_method_om" render={({ field }) => (
                  <div className="flex items-center gap-2"><Checkbox checked={field.value} onCheckedChange={field.onChange} /><span>Orange Money</span></div>
                )} />
                <Controller control={control} name="payment_method_momo" render={({ field }) => (
                  <div className="flex items-center gap-2"><Checkbox checked={field.value} onCheckedChange={field.onChange} /><span>MTN MoMo</span></div>
                )} />
              </div>
            </div>
            <div><Label>Demandes spéciales</Label><Textarea {...register('special_requests')} /></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>Annuler</Button>
              <Button type="submit" disabled={saveMutation.isPending}>Enregistrer</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={!!deleteItem} onOpenChange={() => setDeleteItem(null)} title="Supprimer la réservation" description={`Supprimer la réservation de ${deleteItem?.guest_name} ?`} onConfirm={() => deleteMutation.mutate(deleteItem.id)} confirmLabel="Supprimer" variant="destructive" />
    </div>
  );
};

export default ReservationsPage;
