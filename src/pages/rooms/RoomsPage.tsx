import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { EmptyState } from '@/components/shared/EmptyState';
import { useHotel } from '@/contexts/HotelContext';
import { useRoleGuard } from '@/hooks/useRoleGuard';
import { supabase } from '@/integrations/supabase/client';
import { formatFCFA } from '@/utils/formatters';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

const roomSchema = z.object({
  room_number: z.string().min(1, 'Numéro requis').max(20),
  floor: z.coerce.number().min(0).max(100),
  capacity: z.coerce.number().min(1).max(50),
  price_per_night: z.coerce.number().min(0),
  status: z.string(),
  description: z.string().max(500).optional(),
});

const RoomsPage = () => {
  useRoleGuard(['admin','manager','receptionist']);
  const { hotel } = useHotel();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editRoom, setEditRoom] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm({
    resolver: zodResolver(roomSchema),
    defaultValues: { floor: 1, capacity: 2, price_per_night: 0, status: 'available' },
  });

  const { data: rooms, isLoading } = useQuery({
    queryKey: ['rooms', hotel?.id],
    queryFn: async () => {
      const { data } = await supabase.from('rooms').select('*').eq('hotel_id', hotel!.id).order('room_number');
      return data || [];
    },
    enabled: !!hotel?.id,
  });

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      if (editRoom) {
        const { error } = await supabase.from('rooms').update(data).eq('id', editRoom.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('rooms').insert({ ...data, hotel_id: hotel!.id } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      setDialogOpen(false);
      setEditRoom(null);
      reset();
      toast.success(editRoom ? 'Chambre modifiée' : 'Chambre ajoutée');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('rooms').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      setDeleteId(null);
      toast.success('Chambre supprimée');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openEdit = (room: any) => {
    setEditRoom(room);
    reset({ room_number: room.room_number, floor: room.floor, capacity: room.capacity, price_per_night: room.price_per_night, status: room.status, description: room.description || '' });
    setDialogOpen(true);
  };

  const openAdd = () => {
    setEditRoom(null);
    reset({ room_number: '', floor: 1, capacity: 2, price_per_night: 0, status: 'available', description: '' });
    setDialogOpen(true);
  };

  const filtered = statusFilter === 'all' ? rooms : rooms?.filter((r: any) => r.status === statusFilter);

  const statusColors: Record<string, string> = {
    available: 'border-l-success',
    occupied: 'border-l-destructive',
    housekeeping: 'border-l-warning',
    maintenance: 'border-l-info',
    out_of_order: 'border-l-muted-foreground',
  };

  return (
    <div className="page-container">
      <PageHeader title="Chambres" subtitle={`${rooms?.length || 0} chambres`}>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Filtrer" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes</SelectItem>
            <SelectItem value="available">Disponibles</SelectItem>
            <SelectItem value="occupied">Occupées</SelectItem>
            <SelectItem value="housekeeping">Nettoyage</SelectItem>
            <SelectItem value="maintenance">Maintenance</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={openAdd}><Plus className="h-4 w-4 mr-2" />Ajouter</Button>
      </PageHeader>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
        </div>
      ) : filtered && filtered.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((room: any) => (
            <Card key={room.id} className={`border-l-4 ${statusColors[room.status] || ''}`}>
              <CardContent className="pt-6">
                <div className="flex justify-between items-start mb-3">
                  <h3 className="text-2xl font-bold">{room.room_number}</h3>
                  <StatusBadge status={room.status} />
                </div>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <p>Étage {room.floor} · {room.capacity} pers.</p>
                  <p className="font-semibold text-foreground fcfa">{formatFCFA(room.price_per_night)}/nuit</p>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button variant="outline" size="sm" onClick={() => openEdit(room)}>
                    <Pencil className="h-3 w-3 mr-1" />Modifier
                  </Button>
                  <Button variant="outline" size="sm" className="text-destructive" onClick={() => setDeleteId(room.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState title="Aucune chambre" description="Ajoutez votre première chambre" actionLabel="Ajouter une chambre" onAction={openAdd} />
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editRoom ? 'Modifier la chambre' : 'Ajouter une chambre'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit((d) => saveMutation.mutate(d))} className="space-y-4">
            <div><Label>Numéro *</Label><Input {...register('room_number')} />
              {errors.room_number && <p className="text-sm text-destructive mt-1">{errors.room_number.message}</p>}</div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Étage</Label><Input type="number" {...register('floor')} /></div>
              <div><Label>Capacité</Label><Input type="number" {...register('capacity')} /></div>
            </div>
            <div><Label>Prix/nuit (FCFA)</Label><Input type="number" {...register('price_per_night')} /></div>
            <div><Label>Statut</Label>
              <Select defaultValue={editRoom?.status || 'available'} onValueChange={(v) => setValue('status', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="available">Disponible</SelectItem>
                  <SelectItem value="occupied">Occupée</SelectItem>
                  <SelectItem value="housekeeping">Nettoyage</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                  <SelectItem value="out_of_order">Hors service</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Description</Label><Input {...register('description')} /></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
              <Button type="submit" disabled={saveMutation.isPending}>{saveMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={() => setDeleteId(null)}
        description={<p>Cette action est irréversible. La chambre sera définitivement supprimée.</p>}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
      />
    </div>
  );
};

export default RoomsPage;
