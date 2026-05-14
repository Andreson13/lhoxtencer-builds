import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useHotel } from '@/contexts/HotelContext';
import { useI18n } from '@/contexts/I18nContext';
import { useRoleGuard } from '@/hooks/useRoleGuard';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { formatFCFA } from '@/utils/formatters';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Wine, Plus, Pencil, Trash2, AlertTriangle, Plus as PlusIcon } from 'lucide-react';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const schema = z.object({
  name: z.string().min(1, 'Nom requis'),
  unit: z.string().default('unité'),
  category: z.string().optional(),
  buying_price: z.coerce.number().min(0).default(0),
  selling_price: z.coerce.number().min(0).default(0),
  current_stock: z.coerce.number().min(0).default(0),
  minimum_stock: z.coerce.number().min(0).default(3),
});

type DrinkForm = z.infer<typeof schema>;

const DRINK_CATEGORIES = [
  { id: 'beer', label: 'Bière / Beer' },
  { id: 'wine', label: 'Vin / Wine' },
  { id: 'spirit', label: 'Alcool fort / Spirits' },
  { id: 'soft', label: 'Boisson douce / Soft Drink' },
  { id: 'juice', label: 'Jus / Juice' },
  { id: 'water', label: 'Eau / Water' },
  { id: 'coffee', label: 'Café / Coffee' },
  { id: 'tea', label: 'Thé / Tea' },
  { id: 'other', label: 'Autre / Other' },
];

const DrinksPage = () => {
  useRoleGuard(['admin', 'manager', 'receptionist']);
  const { t } = useI18n();
  const { hotel } = useHotel();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [deleteItem, setDeleteItem] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [sellDialogOpen, setSellDialogOpen] = useState(false);
  const [sellItem, setSellItem] = useState<any>(null);
  const [sellQuantity, setSellQuantity] = useState(1);
  const [restockDialogOpen, setRestockDialogOpen] = useState(false);
  const [restockItem, setRestockItem] = useState<any>(null);
  const [restockQuantity, setRestockQuantity] = useState(0);

  const { register, handleSubmit, reset, setValue, control, formState: { errors } } = useForm<DrinkForm>({
    resolver: zodResolver(schema),
    defaultValues: { unit: 'unité', minimum_stock: 3, current_stock: 0, buying_price: 0, selling_price: 0, name: '', category: 'other' }
  });

  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) return null;
      const { data: p } = await supabase.from('profiles' as any).select('*').eq('id', data.user.id).single();
      return p;
    },
  });

  const { data: drinks, isLoading } = useQuery({
    queryKey: ['drinks', hotel?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_items' as any)
        .select('id, name, category, unit, buying_price, selling_price, current_stock, minimum_stock, is_minibar, hotel_id, created_at')
        .eq('hotel_id', hotel!.id)
        .eq('is_minibar', true)
        .order('category, name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!hotel?.id,
  });

  const saveMutation = useMutation({
    mutationFn: async (values: any) => {
      if (!hotel?.id) throw new Error('Hotel ID not available');
      const { category, ...rest } = values;
      const payload = { ...rest, hotel_id: hotel.id, is_minibar: true };
      if (editing) {
        const { error } = await supabase.from('inventory_items' as any).update(payload).eq('id', editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('inventory_items' as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['drinks', hotel?.id] });
      toast.success(editing ? 'Boisson mise à jour' : 'Boisson ajoutée');
      setDialogOpen(false);
      setEditing(null);
      reset();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('inventory_items' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['drinks', hotel?.id] });
      toast.success('Boisson supprimée');
      setDeleteItem(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const sellMutation = useMutation({
    mutationFn: async () => {
      if (!sellItem || !sellQuantity || !hotel) throw new Error('Données manquantes');
      if (sellQuantity > sellItem.current_stock) throw new Error(`Stock insuffisant! Seulement ${sellItem.current_stock} disponible.`);
      if (sellQuantity <= 0) throw new Error('Quantité doit être supérieure à 0');
      const newStock = sellItem.current_stock - sellQuantity;
      const { error } = await supabase.from('inventory_items' as any).update({ current_stock: newStock }).eq('id', sellItem.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['drinks', hotel?.id] });
      toast.success(`${sellQuantity}x ${sellItem.name} vendu(s)`);
      setSellDialogOpen(false);
      setSellItem(null);
      setSellQuantity(1);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const restockMutation = useMutation({
    mutationFn: async () => {
      if (!restockItem || !restockQuantity || !hotel || !profile) throw new Error('Données manquantes');
      if (restockQuantity <= 0) throw new Error('Quantité doit être supérieure à 0');
      const newStock = restockItem.current_stock + restockQuantity;
      const { error: updateError } = await supabase.from('inventory_items' as any).update({ current_stock: newStock }).eq('id', restockItem.id);
      if (updateError) throw updateError;
      const { error: logError } = await supabase.from('audit_logs' as any).insert({
        hotel_id: hotel.id,
        user_id: profile.id,
        user_name: profile.full_name || profile.email,
        action: 'restock',
        table_name: 'inventory_items',
        record_id: restockItem.id,
        old_values: { current_stock: restockItem.current_stock },
        new_values: { current_stock: newStock },
      });
      if (logError) throw logError;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['drinks', hotel?.id] });
      toast.success(`${restockQuantity} unité(s) ajoutée(s) - ${restockItem.name}`);
      setRestockDialogOpen(false);
      setRestockItem(null);
      setRestockQuantity(0);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openEdit = (item: any) => {
    setEditing(item);
    Object.entries(item).forEach(([k, v]) => {
      if (v != null && k !== 'is_minibar' && k !== 'category_id') {
        setValue(k as any, v);
      }
    });
    setDialogOpen(true);
  };

  const filtered = drinks?.filter(d => !search || d.name.toLowerCase().includes(search.toLowerCase())) || [];
  const lowStock = drinks?.filter(d => d.current_stock <= (d.minimum_stock || 3)) || [];
  const stockValue = drinks?.reduce((sum, item) => sum + Number(item.current_stock || 0) * Number(item.selling_price || 0), 0) || 0;
  const margin = drinks?.reduce((sum, item) => sum + Number(item.current_stock || 0) * (Number(item.selling_price || 0) - Number(item.buying_price || 0)), 0) || 0;

  return (
    <div className="page-container space-y-6">
      <PageHeader title="Boissons & Minibar" subtitle={`${drinks?.length || 0} boissons${lowStock.length > 0 ? ` • ${lowStock.length} en rupture` : ''}`}>
        <Button onClick={() => { reset(); setEditing(null); setDialogOpen(true); }}><Plus className="h-4 w-4 mr-2" />Ajouter une boisson</Button>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total boissons</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-semibold">{drinks?.length || 0}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">En rupture</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-semibold text-destructive">{lowStock.length}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Valeur stock</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-semibold">{formatFCFA(stockValue)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Marge potentielle</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-semibold text-green-600">{formatFCFA(margin)}</p></CardContent>
        </Card>
      </div>

      <Input
        placeholder="Rechercher une boisson..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="max-w-md"
      />

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Wine} title="Aucune boisson" description="Ajoutez vos boissons et minibar" actionLabel="Ajouter" onAction={() => setDialogOpen(true)} />
      ) : (
        <div className="rounded-xl border bg-card/60 shadow-sm overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Catégorie</TableHead>
                <TableHead>Unité</TableHead>
                <TableHead className="text-right">Prix achat</TableHead>
                <TableHead className="text-right">Prix vente</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead className="text-right">Min.</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(item => {
                return (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium flex items-center gap-2">
                      {item.current_stock <= (item.minimum_stock || 3) && <AlertTriangle className="h-4 w-4 text-destructive" />}
                      {item.name}
                    </TableCell>
                    <TableCell><Badge variant="outline">{item.category ? item.category.charAt(0).toUpperCase() + item.category.slice(1) : 'Other'}</Badge></TableCell>
                    <TableCell>{item.unit}</TableCell>
                    <TableCell className="text-right">{formatFCFA(item.buying_price)}</TableCell>
                    <TableCell className="text-right font-semibold text-green-600">{formatFCFA(item.selling_price)}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant={item.current_stock <= (item.minimum_stock || 3) ? 'destructive' : 'default'}>{item.current_stock}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{item.minimum_stock}</TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => { setSellItem(item); setSellQuantity(1); setSellDialogOpen(true); }}
                      >
                        Vendre
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => { setRestockItem(item); setRestockQuantity(0); setRestockDialogOpen(true); }}
                      >
                        <PlusIcon className="h-4 w-4 mr-1" />Restock
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(item)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteItem(item)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={v => { if (!v) { setDialogOpen(false); setEditing(null); reset(); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Modifier la boisson' : 'Ajouter une boisson'}</DialogTitle>
            <DialogDescription>Boisson ou article minibar</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(d => saveMutation.mutate(d))} className="space-y-4">
            <div><Label>Nom *</Label><Input {...register('name')} />{errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}</div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Catégorie</Label>
                <Controller
                  control={control}
                  name="category"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{DRINK_CATEGORIES.map(cat => <SelectItem key={cat.id} value={cat.id}>{cat.label}</SelectItem>)}</SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div><Label>Unité</Label><Input {...register('unit')} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Prix achat</Label><Input type="number" {...register('buying_price')} /></div>
              <div><Label>Prix vente *</Label><Input type="number" {...register('selling_price')} />{errors.selling_price && <p className="text-sm text-destructive">{errors.selling_price.message}</p>}</div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Stock actuel</Label><Input type="number" {...register('current_stock')} /></div>
              <div><Label>Stock minimum</Label><Input type="number" {...register('minimum_stock')} /></div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setDialogOpen(false); reset(); }}>Annuler</Button>
              <Button type="submit" disabled={saveMutation.isPending}>{editing ? 'Mettre à jour' : 'Ajouter'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Sell Dialog */}
      <Dialog open={sellDialogOpen} onOpenChange={setSellDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Vendre - {sellItem?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Stock actuel: {sellItem?.current_stock}</p>
              <p className="text-sm text-muted-foreground">Prix de vente: {formatFCFA(sellItem?.selling_price)}</p>
            </div>
            <div>
              <Label>Quantité</Label>
              <Input
                type="number"
                min="1"
                max={sellItem?.current_stock}
                value={sellQuantity}
                onChange={e => setSellQuantity(Number(e.target.value))}
              />
              {sellQuantity > (sellItem?.current_stock || 0) && (
                <p className="text-sm text-destructive mt-2">⚠️ Quantité dépasse le stock disponible!</p>
              )}
            </div>
            <p className="text-lg font-semibold">Total: {formatFCFA((sellItem?.selling_price || 0) * sellQuantity)}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSellDialogOpen(false)}>Annuler</Button>
            <Button
              onClick={() => sellMutation.mutate()}
              disabled={sellMutation.isPending || !sellQuantity || sellQuantity > (sellItem?.current_stock || 0)}
            >
              Confirmer vente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Restock Dialog */}
      <Dialog open={restockDialogOpen} onOpenChange={setRestockDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Restock - {restockItem?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Stock actuel: {restockItem?.current_stock}</p>
              <p className="text-sm text-muted-foreground">Unité: {restockItem?.unit}</p>
            </div>
            <div>
              <Label>Quantité à ajouter</Label>
              <Input
                type="number"
                min="1"
                value={restockQuantity}
                onChange={e => setRestockQuantity(Number(e.target.value))}
                placeholder="0"
              />
            </div>
            <p className="text-lg font-semibold">Nouveau stock: {(restockItem?.current_stock || 0) + (restockQuantity || 0)}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRestockDialogOpen(false)}>Annuler</Button>
            <Button
              onClick={() => restockMutation.mutate()}
              disabled={restockMutation.isPending || !restockQuantity || restockQuantity <= 0}
            >
              Confirmer Restock
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteItem}
        onOpenChange={() => setDeleteItem(null)}
        title="Supprimer cette boisson?"
        description={`${deleteItem?.name} sera définitivement supprimée.`}
        onConfirm={() => deleteMutation.mutate(deleteItem.id)}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
};

export default DrinksPage;
