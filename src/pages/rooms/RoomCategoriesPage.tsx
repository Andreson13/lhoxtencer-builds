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

interface ExtraOption { id: string; name: string; price: number; }

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
    breakfast_included: false, breakfast_price: 0, extra_options: [] as ExtraOption[],
    enable_day_pricing: true, enable_sieste_pricing: true, sieste_pricing_type: 'fixed' as 'fixed' | 'hourly',
    price_per_hour_sieste: 0, enable_nuitee_pricing: false, price_nuitee: 0,
  });
  const [newOptionName, setNewOptionName] = useState('');
  const [newOptionPrice, setNewOptionPrice] = useState(0);

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
      const payload: any = {
        hotel_id: hotel!.id, name: form.name, description: form.description || null,
        price_per_night: form.price_per_night, price_sieste: form.price_sieste,
        features: form.features, color: form.color, portal_visible: form.portal_visible,
        breakfast_included: form.breakfast_included, breakfast_price: form.breakfast_price,
        extra_options: form.extra_options,
        enable_day_pricing: form.enable_day_pricing,
        enable_sieste_pricing: form.enable_sieste_pricing,
        sieste_pricing_type: form.sieste_pricing_type,
        price_per_hour_sieste: form.price_per_hour_sieste,
        enable_nuitee_pricing: form.enable_nuitee_pricing,
        price_nuitee: form.price_nuitee,
      };
      if (editing) {
        const { error } = await supabase.from('room_categories').update(payload).eq('id', editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('room_categories').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['room-categories'] }); toast.success(editing ? 'Catégorie modifiée' : 'Catégorie créée'); setDialogOpen(false); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from('room_categories').delete().eq('id', id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['room-categories'] }); toast.success('Catégorie supprimée'); setDeleteId(null); },
    onError: (e: any) => toast.error(e.message),
  });

  const assignRoomsMutation = useMutation({
    mutationFn: async () => {
      if (!managingCategory) return;
      const prevRooms = rooms?.filter(r => r.category_id === managingCategory.id).map(r => r.id) || [];
      const toUnassign = prevRooms.filter(id => !selectedRoomIds.includes(id));
      const toAssign = selectedRoomIds.filter(id => !prevRooms.includes(id));
      if (toUnassign.length) await supabase.from('rooms').update({ category_id: null } as any).in('id', toUnassign);
      if (toAssign.length) await supabase.from('rooms').update({ category_id: managingCategory.id } as any).in('id', toAssign);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['all-rooms'] }); toast.success('Chambres assignées'); setRoomsDialogOpen(false); },
    onError: (e: any) => toast.error(e.message),
  });

  const openEdit = (cat: any) => {
    setEditing(cat);
    setForm({
      name: cat.name, description: cat.description || '', price_per_night: cat.price_per_night,
      price_sieste: cat.price_sieste || 0, features: cat.features || [], color: cat.color || '#6366f1',
      portal_visible: cat.portal_visible ?? true,
      breakfast_included: (cat as any).breakfast_included ?? false,
      breakfast_price: (cat as any).breakfast_price ?? 0,
      extra_options: ((cat as any).extra_options as ExtraOption[]) || [],
      enable_day_pricing: cat.enable_day_pricing ?? true,
      enable_sieste_pricing: cat.enable_sieste_pricing ?? true,
      sieste_pricing_type: cat.sieste_pricing_type || 'fixed',
      price_per_hour_sieste: cat.price_per_hour_sieste || 0,
      enable_nuitee_pricing: cat.enable_nuitee_pricing ?? false,
      price_nuitee: cat.price_nuitee || 0,
    });
    setDialogOpen(true);
  };

  const openAdd = () => {
    setEditing(null);
    setForm({ name: '', description: '', price_per_night: 0, price_sieste: 0, features: [], color: '#6366f1', portal_visible: true, breakfast_included: false, breakfast_price: 0, extra_options: [], enable_day_pricing: true, enable_sieste_pricing: true, sieste_pricing_type: 'fixed', price_per_hour_sieste: 0, enable_nuitee_pricing: false, price_nuitee: 0 });
    setDialogOpen(true);
  };

  const openManageRooms = (cat: any) => {
    setManagingCategory(cat);
    setSelectedRoomIds(rooms?.filter(r => r.category_id === cat.id).map(r => r.id) || []);
    setRoomsDialogOpen(true);
  };

  const toggleFeature = (feat: string) => setForm(f => ({ ...f, features: f.features.includes(feat) ? f.features.filter(ff => ff !== feat) : [...f.features, feat] }));

  const addExtraOption = () => {
    if (!newOptionName) return;
    const opt: ExtraOption = { id: newOptionName.toLowerCase().replace(/\s+/g, '_'), name: newOptionName, price: newOptionPrice };
    setForm(f => ({ ...f, extra_options: [...f.extra_options, opt] }));
    setNewOptionName(''); setNewOptionPrice(0);
  };

  const removeExtraOption = (id: string) => setForm(f => ({ ...f, extra_options: f.extra_options.filter(o => o.id !== id) }));

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
                <div className="space-y-2">
                  {cat.enable_day_pricing && <div><p className="text-xs text-muted-foreground">Prix/jour</p><p className="text-lg font-bold">{formatFCFA(cat.price_per_night)}</p></div>}
                  {cat.enable_sieste_pricing && (
                    <div>
                      <p className="text-xs text-muted-foreground">Prix sieste</p>
                      <p className="text-lg font-bold">
                        {cat.sieste_pricing_type === 'fixed' ? formatFCFA(cat.price_sieste) : `${formatFCFA(cat.price_per_hour_sieste)}/h`}
                      </p>
                    </div>
                  )}
                  {cat.enable_nuitee_pricing && <div><p className="text-xs text-muted-foreground">Prix nuitée</p><p className="text-lg font-bold">{formatFCFA(cat.price_nuitee)}</p></div>}
                </div>
                {(cat as any).breakfast_included && <Badge variant="outline" className="text-xs text-green-600 border-green-300">Petit-déjeuner inclus</Badge>}
                {!(cat as any).breakfast_included && (cat as any).breakfast_price > 0 && <Badge variant="outline" className="text-xs">PDJ: {formatFCFA((cat as any).breakfast_price)}/pers</Badge>}
                <div className="flex flex-wrap gap-1">
                  {(cat.features as string[])?.map(f => <Badge key={f} variant="outline" className="text-xs">{f}</Badge>)}
                </div>
                {((cat as any).extra_options as ExtraOption[] || []).length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {((cat as any).extra_options as ExtraOption[]).map(o => <Badge key={o.id} variant="secondary" className="text-xs">{o.name} +{formatFCFA(o.price)}</Badge>)}
                  </div>
                )}
                <div className="flex items-center justify-between pt-2 border-t">
                  <p className="text-sm text-muted-foreground">{getRoomCount(cat.id)} chambre(s)</p>
                  <Button variant="outline" size="sm" onClick={() => openManageRooms(cat)}><BedDouble className="h-3 w-3 mr-1" />Gérer les chambres</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Category Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Modifier la catégorie' : 'Nouvelle catégorie'}</DialogTitle>
            <DialogDescription>Définissez le type de chambre et ses tarifs</DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            <div><Label className="font-medium">Nom *</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="mt-1" /></div>
            <div><Label className="font-medium">Description</Label><Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="mt-1" /></div>

            {/* Pricing Options */}
            <div className="border-2 rounded-lg p-4 space-y-5 bg-slate-50">
              <Label className="font-bold text-base block">💰 Options de tarification</Label>

              {/* Full Day Pricing */}
              <div className="bg-white rounded-lg p-4 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Switch checked={form.enable_day_pricing} onCheckedChange={v => setForm(f => ({ ...f, enable_day_pricing: v }))} />
                    <Label className="text-sm font-semibold">Prix à la journée</Label>
                  </div>
                  {form.enable_day_pricing && <span className="text-xs text-muted-foreground">Activé</span>}
                </div>
                {form.enable_day_pricing && (
                  <div><Label className="text-xs font-medium text-slate-600">Prix par jour (FCFA)</Label><Input type="number" value={form.price_per_night} onChange={e => setForm(f => ({ ...f, price_per_night: Number(e.target.value) }))} className="mt-1" /></div>
                )}
              </div>

              {/* Siesta Pricing */}
              <div className="bg-white rounded-lg p-4 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Switch checked={form.enable_sieste_pricing} onCheckedChange={v => setForm(f => ({ ...f, enable_sieste_pricing: v }))} />
                    <Label className="text-sm font-semibold">Sieste</Label>
                  </div>
                  {form.enable_sieste_pricing && <span className="text-xs text-muted-foreground">Activé</span>}
                </div>
                {form.enable_sieste_pricing && (
                  <div className="space-y-3 ml-0 pt-2">
                    <div className="flex items-center gap-3 border rounded-lg p-3 bg-blue-50 hover:bg-blue-100 cursor-pointer" onClick={() => setForm(f => ({ ...f, sieste_pricing_type: 'fixed' }))}>
                      <input type="radio" id="sieste-fixed" name="sieste-type" checked={form.sieste_pricing_type === 'fixed'} onChange={() => setForm(f => ({ ...f, sieste_pricing_type: 'fixed' }))} className="w-4 h-4" />
                      <label htmlFor="sieste-fixed" className="text-sm font-medium cursor-pointer flex-1">Prix fixe</label>
                      {form.sieste_pricing_type === 'fixed' && <Input type="number" value={form.price_sieste || ''} onChange={e => { e.stopPropagation(); setForm(f => ({ ...f, price_sieste: Number(e.target.value) })); }} placeholder="Prix (FCFA)" className="w-40 h-9 ml-2" onClick={e => e.stopPropagation()} />}
                    </div>
                    <div className="flex items-center gap-3 border rounded-lg p-3 bg-amber-50 hover:bg-amber-100 cursor-pointer" onClick={() => setForm(f => ({ ...f, sieste_pricing_type: 'hourly' }))}>
                      <input type="radio" id="sieste-hourly" name="sieste-type" checked={form.sieste_pricing_type === 'hourly'} onChange={() => setForm(f => ({ ...f, sieste_pricing_type: 'hourly' }))} className="w-4 h-4" />
                      <label htmlFor="sieste-hourly" className="text-sm font-medium cursor-pointer flex-1">Prix à l'heure</label>
                      {form.sieste_pricing_type === 'hourly' && <Input type="number" value={form.price_per_hour_sieste || ''} onChange={e => { e.stopPropagation(); setForm(f => ({ ...f, price_per_hour_sieste: Number(e.target.value) })); }} placeholder="Prix/h (FCFA)" className="w-40 h-9 ml-2" onClick={e => e.stopPropagation()} />}
                    </div>
                  </div>
                )}
              </div>

              {/* Night Pricing */}
              <div className="bg-white rounded-lg p-4 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Switch checked={form.enable_nuitee_pricing} onCheckedChange={v => setForm(f => ({ ...f, enable_nuitee_pricing: v }))} />
                    <Label className="text-sm font-semibold">Nuitée</Label>
                  </div>
                  {form.enable_nuitee_pricing && <span className="text-xs text-muted-foreground">Activé</span>}
                </div>
                {form.enable_nuitee_pricing && (
                  <div><Label className="text-xs font-medium text-slate-600">Prix pour la nuit (FCFA)</Label><Input type="number" value={form.price_nuitee} onChange={e => setForm(f => ({ ...f, price_nuitee: Number(e.target.value) }))} className="mt-1" /></div>
                )}
              </div>
            </div>
            <div>
              <Label className="font-bold text-base block mb-3">✨ Équipements</Label>
              <div className="flex flex-wrap gap-2">
                {featureOptions.map(f => <Badge key={f} variant={form.features.includes(f) ? 'default' : 'outline'} className="cursor-pointer px-3 py-2" onClick={() => toggleFeature(f)}>{f}</Badge>)}
              </div>
            </div>

            {/* Breakfast */}
            <div className="border-2 rounded-lg p-4 space-y-3 bg-orange-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Switch checked={form.breakfast_included} onCheckedChange={v => setForm(f => ({ ...f, breakfast_included: v }))} />
                  <Label className="text-sm font-semibold">Petit-déjeuner inclus</Label>
                </div>
                {form.breakfast_included && <span className="text-xs text-muted-foreground">Inclus</span>}
              </div>
              {!form.breakfast_included && (
                <div><Label className="text-xs font-medium text-slate-600">Prix par personne (FCFA)</Label><Input type="number" value={form.breakfast_price} onChange={e => setForm(f => ({ ...f, breakfast_price: Number(e.target.value) }))} className="mt-1" /></div>
              )}
            </div>

            {/* Extra Options */}
            <div className="border-2 rounded-lg p-4 space-y-3 bg-purple-50">
              <Label className="font-bold text-base block">🎁 Options supplémentaires</Label>
              {form.extra_options.map(opt => (
                <div key={opt.id} className="flex items-center justify-between text-sm bg-white rounded px-3 py-2 border border-purple-200">
                  <span className="font-medium">{opt.name} — {formatFCFA(opt.price)}</span>
                  <Button variant="ghost" size="sm" onClick={() => removeExtraOption(opt.id)} className="h-6 px-2 text-destructive hover:bg-red-100">×</Button>
                </div>
              ))}
              <div className="flex gap-2 pt-2">
                <Input placeholder="Nom de l'option" value={newOptionName} onChange={e => setNewOptionName(e.target.value)} className="flex-1" />
                <Input type="number" placeholder="Prix" value={newOptionPrice || ''} onChange={e => setNewOptionPrice(Number(e.target.value))} className="w-28" />
                <Button variant="outline" size="sm" onClick={addExtraOption} disabled={!newOptionName} className="px-3">+</Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div><Label className="font-medium">Couleur de catégorie</Label><div className="mt-2 flex items-center gap-2"><Input type="color" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))} className="w-16 h-10 rounded cursor-pointer" /><span className="text-xs text-muted-foreground">{form.color}</span></div></div>
              <div className="flex items-center gap-3 mt-6"><Switch checked={form.portal_visible} onCheckedChange={v => setForm(f => ({ ...f, portal_visible: v }))} /><Label className="font-medium">Visible sur le portail</Label></div>
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
                  <Checkbox checked={selectedRoomIds.includes(room.id)} onCheckedChange={checked => setSelectedRoomIds(prev => checked ? [...prev, room.id] : prev.filter(id => id !== room.id))} />
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
