import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
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

const RoomsPage = () => {
  useRoleGuard(['admin','manager','receptionist']);
  const { hotel } = useHotel();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editRoom, setEditRoom] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [form, setForm] = useState({ room_number: '', floor: 1, capacity: 2, category_id: '', status: 'available', description: '' });
  const [bulkForm, setBulkForm] = useState({ prefix: '', start: 101, end: 110, floor: 1, category_id: '', capacity: 2 });

  const { data: rooms, isLoading } = useQuery({
    queryKey: ['rooms', hotel?.id],
    queryFn: async () => {
      const { data } = await supabase.from('rooms').select('*, room_categories(name, price_per_night, color)').eq('hotel_id', hotel!.id).order('room_number');
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

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        room_number: form.room_number, floor: form.floor, capacity: form.capacity,
        category_id: form.category_id || null, status: form.status,
        description: form.description || null, hotel_id: hotel!.id,
        price_per_night: categories?.find(c => c.id === form.category_id)?.price_per_night || 0,
      };
      if (editRoom) {
        const { error } = await supabase.from('rooms').update(payload).eq('id', editRoom.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('rooms').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      setDialogOpen(false);
      toast.success(editRoom ? 'Chambre modifiée' : 'Chambre ajoutée');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const bulkMutation = useMutation({
    mutationFn: async () => {
      const roomsToCreate: any[] = [];
      const price = categories?.find(c => c.id === bulkForm.category_id)?.price_per_night || 0;
      for (let n = bulkForm.start; n <= bulkForm.end; n++) {
        const roomNumber = bulkForm.prefix ? `${bulkForm.prefix}${n}` : `${n}`;
        const exists = rooms?.some(r => r.room_number === roomNumber);
        if (!exists) {
          roomsToCreate.push({
            hotel_id: hotel!.id, room_number: roomNumber, floor: bulkForm.floor,
            capacity: bulkForm.capacity, category_id: bulkForm.category_id || null,
            price_per_night: price, status: 'available',
          });
        }
      }
      if (roomsToCreate.length === 0) throw new Error('Toutes les chambres existent déjà');
      const { error } = await supabase.from('rooms').insert(roomsToCreate);
      if (error) throw error;
      return roomsToCreate.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      setBulkDialogOpen(false);
      toast.success(`${count} chambre(s) créée(s) avec succès`);
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
    setForm({ room_number: room.room_number, floor: room.floor, capacity: room.capacity, category_id: room.category_id || '', status: room.status, description: room.description || '' });
    setDialogOpen(true);
  };

  const openAdd = () => {
    setEditRoom(null);
    setForm({ room_number: '', floor: 1, capacity: 2, category_id: '', status: 'available', description: '' });
    setDialogOpen(true);
  };

  const filtered = statusFilter === 'all' ? rooms : rooms?.filter((r: any) => r.status === statusFilter);
  const bulkCount = Math.max(0, bulkForm.end - bulkForm.start + 1);
  const bulkExisting = rooms ? Array.from({ length: bulkCount }, (_, i) => {
    const n = bulkForm.start + i;
    const roomNumber = bulkForm.prefix ? `${bulkForm.prefix}${n}` : `${n}`;
    return rooms.some(r => r.room_number === roomNumber) ? roomNumber : null;
  }).filter(Boolean) : [];

  const statusColors: Record<string, string> = {
    available: 'border-l-success', occupied: 'border-l-destructive',
    housekeeping: 'border-l-warning', maintenance: 'border-l-info',
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
        <Button variant="outline" onClick={() => setBulkDialogOpen(true)}><Layers className="h-4 w-4 mr-2" />Créer en lot</Button>
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
                  {room.room_categories && <p className="text-xs"><span className="inline-block w-2 h-2 rounded-full mr-1" style={{ backgroundColor: room.room_categories.color || '#6366f1' }} />{room.room_categories.name}</p>}
                  <p className="font-semibold text-foreground">{formatFCFA(room.room_categories?.price_per_night ?? room.price_per_night)}/nuit</p>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button variant="outline" size="sm" onClick={() => openEdit(room)}><Pencil className="h-3 w-3 mr-1" />Modifier</Button>
                  <Button variant="outline" size="sm" className="text-destructive" onClick={() => setDeleteId(room.id)}><Trash2 className="h-3 w-3" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState title="Aucune chambre" description="Ajoutez votre première chambre" actionLabel="Ajouter une chambre" onAction={openAdd} />
      )}

      {/* Single room dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editRoom ? 'Modifier la chambre' : 'Ajouter une chambre'}</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="space-y-4">
            <div><Label>Numéro *</Label><Input value={form.room_number} onChange={e => setForm(f => ({...f, room_number: e.target.value}))} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Étage</Label><Input type="number" value={form.floor} onChange={e => setForm(f => ({...f, floor: Number(e.target.value)}))} /></div>
              <div><Label>Capacité</Label><Input type="number" value={form.capacity} onChange={e => setForm(f => ({...f, capacity: Number(e.target.value)}))} /></div>
            </div>
            <div><Label>Catégorie</Label>
              <Select value={form.category_id} onValueChange={v => setForm(f => ({...f, category_id: v}))}>
                <SelectTrigger><SelectValue placeholder="Sélectionner une catégorie" /></SelectTrigger>
                <SelectContent>
                  {categories?.map(c => <SelectItem key={c.id} value={c.id}>{c.name} — {formatFCFA(c.price_per_night)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Statut</Label>
              <Select value={form.status} onValueChange={(v) => setForm(f => ({...f, status: v}))}>
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
            <div><Label>Description</Label><Input value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))} /></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
              <Button type="submit" disabled={saveMutation.isPending}>Enregistrer</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Bulk creation dialog */}
      <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Créer des chambres en lot</DialogTitle><DialogDescription>Générer plusieurs chambres automatiquement</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div><Label>Préfixe</Label><Input placeholder="ex: 1" value={bulkForm.prefix} onChange={e => setBulkForm(f => ({ ...f, prefix: e.target.value }))} /></div>
              <div><Label>N° début</Label><Input type="number" value={bulkForm.start} onChange={e => setBulkForm(f => ({ ...f, start: Number(e.target.value) }))} /></div>
              <div><Label>N° fin</Label><Input type="number" value={bulkForm.end} onChange={e => setBulkForm(f => ({ ...f, end: Number(e.target.value) }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Étage</Label><Input type="number" value={bulkForm.floor} onChange={e => setBulkForm(f => ({ ...f, floor: Number(e.target.value) }))} /></div>
              <div><Label>Capacité</Label><Input type="number" value={bulkForm.capacity} onChange={e => setBulkForm(f => ({ ...f, capacity: Number(e.target.value) }))} /></div>
            </div>
            <div><Label>Catégorie *</Label>
              <Select value={bulkForm.category_id} onValueChange={v => setBulkForm(f => ({ ...f, category_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                <SelectContent>{categories?.map(c => <SelectItem key={c.id} value={c.id}>{c.name} — {formatFCFA(c.price_per_night)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="bg-muted p-3 rounded-md text-sm">
              <p>Cela créera <strong>{bulkCount - bulkExisting.length}</strong> chambre(s)</p>
              {bulkExisting.length > 0 && (
                <p className="text-warning mt-1">⚠ {bulkExisting.length} chambre(s) existante(s) seront ignorées: {bulkExisting.join(', ')}</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDialogOpen(false)}>Annuler</Button>
            <Button onClick={() => bulkMutation.mutate()} disabled={bulkCount === 0 || !bulkForm.category_id || bulkMutation.isPending}>
              Créer {bulkCount - bulkExisting.length} chambre(s)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}
        description={<p>Cette action est irréversible. La chambre sera définitivement supprimée.</p>}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)} />
    </div>
  );
};

export default RoomsPage;
