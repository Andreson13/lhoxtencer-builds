import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useHotel } from '@/contexts/HotelContext';
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
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Package, Plus, Pencil, AlertTriangle } from 'lucide-react';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

const schema = z.object({
  name: z.string().min(1, 'Nom requis'),
  unit: z.string().default('unité'),
  buying_price: z.coerce.number().min(0).default(0),
  selling_price: z.coerce.number().min(0).default(0),
  current_stock: z.coerce.number().min(0).default(0),
  minimum_stock: z.coerce.number().min(0).default(5),
  is_minibar: z.boolean().default(false),
});

type InventoryForm = z.infer<typeof schema>;

const InventoryPage = () => {
  useRoleGuard(['admin', 'manager', 'receptionist']);
  const { hotel } = useHotel();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [search, setSearch] = useState('');

  const { register, handleSubmit, reset, setValue, control, formState: { errors } } = useForm<InventoryForm>({ resolver: zodResolver(schema), defaultValues: { unit: 'unité', minimum_stock: 5, current_stock: 0, buying_price: 0, selling_price: 0, name: '', is_minibar: false } });

  const { data: items, isLoading } = useQuery({
    queryKey: ['inventory', hotel?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('inventory_items').select('*').eq('hotel_id', hotel!.id).order('name');
      if (error) throw error;
      return data;
    },
    enabled: !!hotel?.id,
  });

  const saveMutation = useMutation({
    mutationFn: async (values: any) => {
      const payload = { ...values, hotel_id: hotel!.id };
      if (editing) {
        const { error } = await supabase.from('inventory_items').update(payload).eq('id', editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('inventory_items').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['inventory'] }); toast.success('Article sauvegardé'); setDialogOpen(false); setEditing(null); reset(); },
    onError: (e: any) => toast.error(e.message),
  });

  const openEdit = (item: any) => {
    setEditing(item);
    Object.entries(item).forEach(([k, v]) => { if (v != null) setValue(k as any, v); });
    setDialogOpen(true);
  };

  const filtered = items?.filter(i => !search || i.name.toLowerCase().includes(search.toLowerCase())) || [];
  const lowStock = items?.filter(i => i.current_stock <= (i.minimum_stock || 5)) || [];

  return (
    <div className="page-container space-y-6">
      <PageHeader title="Stock" subtitle={`${items?.length || 0} article(s)${lowStock.length > 0 ? ` • ${lowStock.length} en stock bas` : ''}`}>
        <Button onClick={() => { reset(); setEditing(null); setDialogOpen(true); }}><Plus className="h-4 w-4 mr-2" />Ajouter un article</Button>
      </PageHeader>

      <div className="relative">
        <Input placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {isLoading ? <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div> : filtered.length === 0 ? (
        <EmptyState icon={Package} title="Aucun article" description="Ajoutez votre premier article" actionLabel="Ajouter" onAction={() => setDialogOpen(true)} />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Article</TableHead>
                <TableHead>Unité</TableHead>
                <TableHead className="text-right">Prix achat</TableHead>
                <TableHead className="text-right">Prix vente</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead className="text-right">Min</TableHead>
                <TableHead>Minibar</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(item => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium flex items-center gap-2">
                    {item.current_stock <= (item.minimum_stock || 5) && <AlertTriangle className="h-4 w-4 text-destructive" />}
                    {item.name}
                  </TableCell>
                  <TableCell>{item.unit}</TableCell>
                  <TableCell className="text-right">{formatFCFA(item.buying_price)}</TableCell>
                  <TableCell className="text-right">{formatFCFA(item.selling_price)}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant={item.current_stock <= (item.minimum_stock || 5) ? 'destructive' : 'default'}>{item.current_stock}</Badge>
                  </TableCell>
                  <TableCell className="text-right">{item.minimum_stock}</TableCell>
                  <TableCell>{item.is_minibar ? <Badge variant="secondary">Minibar</Badge> : '-'}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(item)}><Pencil className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={v => { if (!v) { setDialogOpen(false); setEditing(null); reset(); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Modifier' : 'Nouvel'} article</DialogTitle><DialogDescription>Informations de l'article</DialogDescription></DialogHeader>
          <form onSubmit={handleSubmit(d => saveMutation.mutate(d))} className="space-y-4">
            <div><Label>Nom *</Label><Input {...register('name')} />{errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}</div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Unité</Label><Input {...register('unit')} /></div>
              <div><Label>Stock actuel</Label><Input type="number" {...register('current_stock')} /></div>
              <div><Label>Stock minimum</Label><Input type="number" {...register('minimum_stock')} /></div>
              <div><Label>Prix d'achat</Label><Input type="number" {...register('buying_price')} /></div>
              <div><Label>Prix de vente</Label><Input type="number" {...register('selling_price')} /></div>
            </div>
            <Controller control={control} name="is_minibar" render={({ field }) => (
              <div className="flex items-center gap-2"><Checkbox checked={field.value} onCheckedChange={field.onChange} /><Label>Article minibar</Label></div>
            )} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setDialogOpen(false); reset(); }}>Annuler</Button>
              <Button type="submit">Enregistrer</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default InventoryPage;
