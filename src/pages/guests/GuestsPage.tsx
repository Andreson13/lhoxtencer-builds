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
import { formatFCFA, formatDate } from '@/utils/formatters';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Users, Plus, Search, Pencil, Trash2, Eye, Lock } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

const guestSchema = z.object({
  last_name: z.string().min(1, 'Nom requis'),
  first_name: z.string().min(1, 'Prénom requis'),
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
  coming_from: z.string().optional(),
  going_to: z.string().optional(),
  means_of_transport: z.string().optional(),
  number_of_adults: z.coerce.number().min(1).default(1),
  number_of_children: z.coerce.number().min(0).default(0),
  room_id: z.string().optional(),
  check_in_date: z.string().optional(),
  check_out_date: z.string().optional(),
  price_per_night: z.coerce.number().min(0).default(0),
  arrangement: z.string().optional(),
  notes: z.string().optional(),
});

type GuestForm = z.infer<typeof guestSchema>;

const GuestsPage = () => {
  useRoleGuard(['admin', 'manager', 'receptionist']);
  const { profile } = useAuth();
  const { hotel } = useHotel();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingGuest, setEditingGuest] = useState<any>(null);
  const [deleteGuest, setDeleteGuest] = useState<any>(null);

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<GuestForm>({
    resolver: zodResolver(guestSchema),
    defaultValues: { number_of_adults: 1, number_of_children: 0, price_per_night: 0, nationality: 'Camerounaise', country_of_residence: 'Cameroun' },
  });

  const pricePerNight = watch('price_per_night');
  const checkIn = watch('check_in_date');
  const checkOut = watch('check_out_date');

  const nights = checkIn && checkOut ? Math.max(1, Math.ceil((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000)) : 0;
  const totalPrice = nights * (pricePerNight || 0);

  const { data: guests, isLoading } = useQuery({
    queryKey: ['guests', hotel?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('guests')
        .select('*, rooms(room_number)')
        .eq('hotel_id', hotel!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!hotel?.id,
  });

  const { data: rooms } = useQuery({
    queryKey: ['rooms', hotel?.id],
    queryFn: async () => {
      const { data } = await supabase.from('rooms').select('id, room_number, price_per_night').eq('hotel_id', hotel!.id).eq('status', 'available');
      return data || [];
    },
    enabled: !!hotel?.id,
  });

  const saveMutation = useMutation({
    mutationFn: async (values: GuestForm) => {
      const payload = {
        ...values,
        hotel_id: hotel!.id,
        number_of_nights: nights,
        total_price: totalPrice,
        receptionist_id: profile?.id,
        receptionist_name: profile?.full_name,
        email: values.email || null,
      };
      if (editingGuest) {
        const { error } = await supabase.from('guests').update(payload).eq('id', editingGuest.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('guests').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guests'] });
      toast.success(editingGuest ? 'Client modifié' : 'Client ajouté');
      closeDialog();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('guests').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guests'] });
      toast.success('Client supprimé');
      setDeleteGuest(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingGuest(null);
    reset({ number_of_adults: 1, number_of_children: 0, price_per_night: 0, nationality: 'Camerounaise', country_of_residence: 'Cameroun' });
  };

  const openEdit = (guest: any) => {
    setEditingGuest(guest);
    Object.keys(guestSchema.shape).forEach((key) => {
      const val = guest[key];
      if (val !== undefined && val !== null) setValue(key as any, key.includes('date') && val ? val.split('T')[0] : val);
    });
    setDialogOpen(true);
  };

  const filtered = guests?.filter(g => {
    const matchSearch = !search || `${g.last_name} ${g.first_name} ${g.id_number || ''} ${g.phone || ''}`.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || g.status === statusFilter;
    return matchSearch && matchStatus;
  }) || [];

  return (
    <div className="page-container space-y-6">
      <PageHeader title="Clients" subtitle={`${filtered.length} client(s)`}>
        <Button onClick={() => { reset(); setDialogOpen(true); }}><Plus className="h-4 w-4 mr-2" />Ajouter un client</Button>
      </PageHeader>

      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher par nom, téléphone, ID..." className="pl-10" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            <SelectItem value="present">Présent</SelectItem>
            <SelectItem value="checked_out">Parti</SelectItem>
            <SelectItem value="reserved">Réservé</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Users} title="Aucun client" description="Ajoutez votre premier client" actionLabel="Ajouter un client" onAction={() => setDialogOpen(true)} />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom complet</TableHead>
                <TableHead>N° ID</TableHead>
                <TableHead>Nationalité</TableHead>
                <TableHead>Chambre</TableHead>
                <TableHead>Arrivée</TableHead>
                <TableHead>Départ</TableHead>
                <TableHead>Nuits</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(g => (
                <TableRow key={g.id}>
                  <TableCell className="font-medium">{g.last_name} {g.first_name}</TableCell>
                  <TableCell>{g.id_number || '-'}</TableCell>
                  <TableCell>{g.nationality || '-'}</TableCell>
                  <TableCell>{(g as any).rooms?.room_number || '-'}</TableCell>
                  <TableCell>{formatDate(g.check_in_date)}</TableCell>
                  <TableCell>{formatDate(g.check_out_date)}</TableCell>
                  <TableCell>{g.number_of_nights || '-'}</TableCell>
                  <TableCell><StatusBadge status={g.status || 'present'} /></TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(g)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeleteGuest(g)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={v => { if (!v) closeDialog(); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingGuest ? 'Modifier le client' : 'Nouveau client'}</DialogTitle>
            <DialogDescription>Remplissez les informations du client</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(d => saveMutation.mutate(d))} className="space-y-6">
            {/* Identity */}
            <div>
              <h3 className="text-lg font-semibold mb-3">Identité</h3>
              <div className="grid grid-cols-3 gap-4">
                <div><Label>Nom *</Label><Input {...register('last_name')} />{errors.last_name && <p className="text-sm text-destructive mt-1">{errors.last_name.message}</p>}</div>
                <div><Label>Prénom *</Label><Input {...register('first_name')} />{errors.first_name && <p className="text-sm text-destructive mt-1">{errors.first_name.message}</p>}</div>
                <div><Label>Genre</Label><Select onValueChange={v => setValue('gender', v)}><SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger><SelectContent><SelectItem value="M">Masculin</SelectItem><SelectItem value="F">Féminin</SelectItem></SelectContent></Select></div>
                <div><Label>Date de naissance</Label><Input type="date" {...register('date_of_birth')} /></div>
                <div><Label>Lieu de naissance</Label><Input {...register('place_of_birth')} /></div>
                <div><Label>Nationalité</Label><Input {...register('nationality')} /></div>
                <div><Label>Pays de résidence</Label><Input {...register('country_of_residence')} /></div>
                <div><Label>Adresse</Label><Input {...register('usual_address')} /></div>
                <div><Label>Profession</Label><Input {...register('profession')} /></div>
                <div><Label>Téléphone</Label><Input {...register('phone')} /></div>
                <div><Label>Email</Label><Input type="email" {...register('email')} /></div>
              </div>
            </div>
            {/* ID Document */}
            <div>
              <h3 className="text-lg font-semibold mb-3">Pièce d'identité</h3>
              <div className="grid grid-cols-4 gap-4">
                <div><Label>Type</Label><Select onValueChange={v => setValue('id_type', v)}><SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger><SelectContent><SelectItem value="cni">CNI</SelectItem><SelectItem value="passport">Passeport</SelectItem><SelectItem value="permit">Permis</SelectItem></SelectContent></Select></div>
                <div><Label>Numéro</Label><Input {...register('id_number')} /></div>
                <div><Label>Délivré le</Label><Input type="date" {...register('id_issued_on')} /></div>
                <div><Label>Délivré à</Label><Input {...register('id_issued_at')} /></div>
              </div>
            </div>
            {/* Travel */}
            <div>
              <h3 className="text-lg font-semibold mb-3">Voyage</h3>
              <div className="grid grid-cols-3 gap-4">
                <div><Label>Venant de</Label><Input {...register('coming_from')} /></div>
                <div><Label>Allant à</Label><Input {...register('going_to')} /></div>
                <div><Label>Moyen de transport</Label><Input {...register('means_of_transport')} /></div>
                <div><Label>Adultes</Label><Input type="number" {...register('number_of_adults')} /></div>
                <div><Label>Enfants</Label><Input type="number" {...register('number_of_children')} /></div>
              </div>
            </div>
            {/* Stay */}
            <div>
              <h3 className="text-lg font-semibold mb-3">Séjour</h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Chambre</Label>
                  <Select onValueChange={v => {
                    setValue('room_id', v);
                    const room = rooms?.find(r => r.id === v);
                    if (room) setValue('price_per_night', room.price_per_night);
                  }}>
                    <SelectTrigger><SelectValue placeholder="Chambre" /></SelectTrigger>
                    <SelectContent>{rooms?.map(r => <SelectItem key={r.id} value={r.id}>{r.room_number} - {formatFCFA(r.price_per_night)}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Arrivée</Label><Input type="date" {...register('check_in_date')} /></div>
                <div><Label>Départ</Label><Input type="date" {...register('check_out_date')} /></div>
                <div><Label>Prix/nuit</Label><Input type="number" {...register('price_per_night')} /></div>
                <div><Label>Nuits</Label><Input value={nights} readOnly className="bg-muted" /></div>
                <div><Label>Total</Label><Input value={formatFCFA(totalPrice)} readOnly className="bg-muted" /></div>
                <div><Label>Arrangement</Label><Input {...register('arrangement')} /></div>
              </div>
            </div>
            {/* Receptionist */}
            <div>
              <Label>Réceptionniste</Label>
              <div className="flex items-center gap-2 mt-1">
                <Lock className="h-4 w-4 text-muted-foreground" />
                <Input value={profile?.full_name || ''} readOnly className="bg-muted" />
              </div>
            </div>
            {/* Notes */}
            <div><Label>Notes</Label><Textarea {...register('notes')} /></div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>Annuler</Button>
              <Button type="submit" disabled={saveMutation.isPending}>{saveMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={!!deleteGuest} onOpenChange={() => setDeleteGuest(null)} title="Supprimer le client" description={`Voulez-vous supprimer ${deleteGuest?.last_name} ${deleteGuest?.first_name} ? Cette action est irréversible.`} onConfirm={() => deleteMutation.mutate(deleteGuest.id)} confirmLabel="Supprimer" variant="destructive" />
    </div>
  );
};

export default GuestsPage;
