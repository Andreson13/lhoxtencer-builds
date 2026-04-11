import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, BedDouble } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/shared/PageHeader';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { EmptyState } from '@/components/shared/EmptyState';
import { useHotel } from '@/contexts/HotelContext';
import { useRoleGuard } from '@/hooks/useRoleGuard';
import { supabase } from '@/integrations/supabase/client';
import { formatFCFA } from '@/utils/formatters';
import { toast } from 'sonner';

const featureOptions = ['AC', 'TV', 'WiFi', 'Balcon', 'Vue piscine', 'Minibar', 'Coffre-fort', 'Baignoire', 'Douche', 'Réfrigérateur'];

const RoomCategoriesPage = () => {
  useRoleGuard(['admin', 'manager']);
  const { hotel } = useHotel();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [roomsDialogOpen, setRoomsDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editing, setEditing] = useState<any>(null);
  const [managingCategory, setManagingCategory] = useState<any>(null);
  const [selectedRoomIds, setSelectedRoomIds] = useState<string[]>([]);
  const [form, setForm] = useState({
    name: '', description: '', price_per_night: 0, price_sieste: 0,
    features: [] as string[], color: '#6366f1', portal_visible: true,
  });

  const { data: categories, isLoading } = useQuery({
    queryKey: ['room-categories', hotel?.id],
    queryFn: async () => {
      const { data } = await supabase.from('room_categories').select('*').eq('hotel_id', hotel!.id).order('display_order');
      return data || [];
    },
    enabled: !!hotel?.id,
  });

  const { data: rooms } = useQuery({
    queryKey: ['all-rooms', hotel?.id],
    queryFn: async () => {
      const { data } = await supabase.from('rooms').select('id, room_number, category_id, floor').eq('hotel_id', hotel!.id).order('room_number');
      return data || [];
    },
    enabled: !!hotel?.id,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: any = { ...form, hotel_id: hotel!.id };
      if (editing) {
        const { error } = await supabase.from('room_categories').update(payload).eq('id', editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('room_categories').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['room-categories'] });
      toast.success(editing ? 'Catégorie modifiée' : 'Catégorie créée');
      setDialogOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('room_categories').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['room-categories'] });
      toast.success('Catégorie supprimée');
      setDeleteId(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const assignRoomsMutation = useMutation({
    mutationFn: async () => {
      if (!managingCategory) return;
      // Unassign rooms that were in this category but are no longer selected
      const prevRooms = rooms?.filter(r => r.category_id === managingCategory.id).map(r => r.id) || [];
      const toUnassign = prevRooms.filter(id => !selectedRoomIds.includes(id));
      const toAssign = selectedRoomIds.filter(id => !prevRooms.includes(id));

      if (toUnassign.length) {
        await supabase.from('rooms').update({ category_id: null } as any).in('id', toUnassign);
      }
      if (toAssign.length) {
        await supabase.from('rooms').update({ category_id: managingCategory.id } as any).in('id', toAssign);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['all-rooms'] });
      toast.success('Chambres assignées');
      setRoomsDialogOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openEdit = (cat: any) => {
    setEditing(cat);
    setForm({
      name: cat.name, description: cat.description || '', price_per_night: cat.price_per_night,
      price_sieste: cat.price_sieste || 0, features: cat.features || [], color: cat.color || '#6366f1',
      portal_visible: cat.portal_visible ?? true,
    });
    setDialogOpen(true);
  };

  const openAdd = () => {
    setEditing(null);
    setForm({ name: '', description: '', price_per_night: 0, price_sieste: 0, features: [], color: '#6366f1', portal_visible: true });
    setDialogOpen(true);
  };

  const openManageRooms = (cat: any) => {
    setManagingCategory(cat);
    setSelectedRoomIds(rooms?.filter(r => r.category_id === cat.id).map(r => r.id) || []);
    setRoomsDialogOpen(true);
  };

  const toggleFeature = (feat: string) => {
    setForm(f => ({
      ...f,
      features: f.features.includes(feat) ? f.features.filter(ff => ff !== feat) : [...f.features, feat],
    }));
  };

  const getRoomCount = (catId: string) => rooms?.filter(r => r.category_id === catId).length || 0;

  return (
    <div className="page-container space-y-6">
      <PageHeader title="Catégories de chambres" subtitle={`${categories?.length || 0} catégorie(s)`}>
        <Button onClick={openAdd}><Plus className="h-4 w-4 mr-2" />Ajouter une catégorie</Button>
      </PageHeader>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
        </div>
      ) : !categories?.length ? (
        <EmptyState icon={BedDouble} title="Aucune catégorie" description="Créez votre première catégorie de chambres" actionLabel="Ajouter" onAction={openAdd} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map(cat => (
            <Card key={cat.id} className="border-l-4" style={{ borderLeftColor: cat.color || '#6366f1' }}>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg">{cat.name}</CardTitle>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(cat)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeleteId(cat.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {cat.description && <p className="text-sm text-muted-foreground">{cat.description}</p>}
                <div className="flex gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Prix/nuit</p>
                    <p className="text-lg font-bold">{formatFCFA(cat.price_per_night)}</p>
                  </div>
                  {(cat.price_sieste as number) > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground">Prix sieste</p>
                      <p className="text-lg font-bold">{formatFCFA(cat.price_sieste)}</p>
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-1">
                  {(cat.features as string[])?.map(f => (
                    <Badge key={f} variant="outline" className="text-xs">{f}</Badge>
                  ))}
                </div>
                <div className="flex items-center justify-between pt-2 border-t">
                  <p className="text-sm text-muted-foreground">{getRoomCount(cat.id)} chambre(s)</p>
                  <Button variant="outline" size="sm" onClick={() => openManageRooms(cat)}>
                    <BedDouble className="h-3 w-3 mr-1" />Gérer les chambres
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Category Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Modifier la catégorie' : 'Nouvelle catégorie'}</DialogTitle>
            <DialogDescription>Définissez le type de chambre et ses tarifs</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>Nom *</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div><Label>Description</Label><Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Prix/nuit (FCFA)</Label><Input type="number" value={form.price_per_night} onChange={e => setForm(f => ({ ...f, price_per_night: Number(e.target.value) }))} /></div>
              <div><Label>Prix sieste (FCFA)</Label><Input type="number" value={form.price_sieste} onChange={e => setForm(f => ({ ...f, price_sieste: Number(e.target.value) }))} /></div>
            </div>
            <div>
              <Label>Équipements</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {featureOptions.map(f => (
                  <Badge key={f} variant={form.features.includes(f) ? 'default' : 'outline'} className="cursor-pointer" onClick={() => toggleFeature(f)}>
                    {f}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Couleur</Label><Input type="color" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))} /></div>
              <div className="flex items-center gap-2 mt-6">
                <Switch checked={form.portal_visible} onCheckedChange={v => setForm(f => ({ ...f, portal_visible: v }))} />
                <Label>Visible sur le portail</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!form.name || saveMutation.isPending}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Rooms Dialog */}
      <Dialog open={roomsDialogOpen} onOpenChange={setRoomsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Chambres — {managingCategory?.name}</DialogTitle>
            <DialogDescription>Cochez les chambres qui appartiennent à cette catégorie</DialogDescription>
          </DialogHeader>
          <div className="max-h-80 overflow-y-auto space-y-2">
            {rooms?.map(room => {
              const otherCat = room.category_id && room.category_id !== managingCategory?.id;
              const otherCatName = otherCat ? categories?.find(c => c.id === room.category_id)?.name : null;
              return (
                <label key={room.id} className={`flex items-center gap-3 p-2 rounded hover:bg-muted cursor-pointer ${otherCat ? 'opacity-50' : ''}`}>
                  <Checkbox
                    checked={selectedRoomIds.includes(room.id)}
                    onCheckedChange={(checked) => {
                      setSelectedRoomIds(prev => checked ? [...prev, room.id] : prev.filter(id => id !== room.id));
                    }}
                  />
                  <span className="font-mono">{room.room_number}</span>
                  <span className="text-sm text-muted-foreground">Étage {room.floor}</span>
                  {otherCatName && <Badge variant="secondary" className="text-xs ml-auto">{otherCatName}</Badge>}
                </label>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoomsDialogOpen(false)}>Annuler</Button>
            <Button onClick={() => assignRoomsMutation.mutate()} disabled={assignRoomsMutation.isPending}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)} title="Supprimer la catégorie" description="Cette action est irréversible." onConfirm={() => deleteId && deleteMutation.mutate(deleteId)} confirmLabel="Supprimer" variant="destructive" />
    </div>
  );
};

export default RoomCategoriesPage;
