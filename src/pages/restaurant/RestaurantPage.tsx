import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useHotel } from '@/contexts/HotelContext';
import { useRoleGuard } from '@/hooks/useRoleGuard';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { formatFCFA } from '@/utils/formatters';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { UtensilsCrossed, Plus, Pencil, Trash2 } from 'lucide-react';
import { generateOrderNumber } from '@/utils/formatters';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

const menuSchema = z.object({
  name: z.string().min(1, 'Nom requis'),
  price: z.coerce.number().min(0),
  category_id: z.string().optional(),
  description: z.string().optional(),
});

const RestaurantPage = () => {
  useRoleGuard(['admin', 'manager', 'receptionist', 'restaurant']);
  const { profile } = useAuth();
  const { hotel } = useHotel();
  const qc = useQueryClient();
  const [orderDialogOpen, setOrderDialogOpen] = useState(false);
  const [menuDialogOpen, setMenuDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [deleteItem, setDeleteItem] = useState<any>(null);
  const [cart, setCart] = useState<{ item: any; quantity: number }[]>([]);
  const [orderRoom, setOrderRoom] = useState<string>('');
  const [isWalkin, setIsWalkin] = useState(false);
  const [walkinName, setWalkinName] = useState('');
  const [walkinTable, setWalkinTable] = useState('');

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm({ resolver: zodResolver(menuSchema) });

  const { data: orders, isLoading: ordersLoading } = useQuery({
    queryKey: ['restaurant-orders', hotel?.id],
    queryFn: async () => {
      const { data } = await supabase.from('restaurant_orders').select('*, restaurant_order_items(*, restaurant_items(name))').eq('hotel_id', hotel!.id).order('created_at', { ascending: false }).limit(50);
      return data || [];
    },
    enabled: !!hotel?.id,
  });

  const { data: menuItems, isLoading: menuLoading } = useQuery({
    queryKey: ['menu-items', hotel?.id],
    queryFn: async () => {
      const { data } = await supabase.from('restaurant_items').select('*, restaurant_categories(name)').eq('hotel_id', hotel!.id).order('name');
      return data || [];
    },
    enabled: !!hotel?.id,
  });

  const { data: categories } = useQuery({
    queryKey: ['restaurant-categories', hotel?.id],
    queryFn: async () => {
      const { data } = await supabase.from('restaurant_categories').select('*').eq('hotel_id', hotel!.id).order('display_order');
      return data || [];
    },
    enabled: !!hotel?.id,
  });

  // FIX 8: Fetch occupied rooms with active stay guest names
  const { data: occupiedRooms } = useQuery({
    queryKey: ['rooms-occupied-with-guests', hotel?.id],
    queryFn: async () => {
      const { data: roomsData } = await supabase.from('rooms').select('id, room_number').eq('hotel_id', hotel!.id).eq('status', 'occupied');
      if (!roomsData?.length) return [];
      // Get active stays for these rooms
      const roomIds = roomsData.map(r => r.id);
      const { data: stays } = await supabase.from('stays').select('room_id, guests(last_name, first_name)').eq('hotel_id', hotel!.id).eq('status', 'active').in('room_id', roomIds);
      return roomsData.map(r => {
        const stay = stays?.find(s => s.room_id === r.id);
        const guest = (stay as any)?.guests;
        return { ...r, guestName: guest ? `${guest.last_name} ${guest.first_name}` : '' };
      });
    },
    enabled: !!hotel?.id,
  });

  const createOrderMutation = useMutation({
    mutationFn: async () => {
      const totalAmount = cart.reduce((s, c) => s + c.item.price * c.quantity, 0);
      const { data: order, error } = await supabase.from('restaurant_orders').insert({
        hotel_id: hotel!.id,
        order_number: generateOrderNumber(),
        room_id: orderRoom || null,
        is_walkin: isWalkin,
        walkin_name: walkinName || null,
        walkin_table: walkinTable || null,
        total_amount: totalAmount,
        created_by: profile?.id,
        status: 'pending',
      }).select().single();
      if (error) throw error;

      const items = cart.map(c => ({
        hotel_id: hotel!.id, order_id: order.id, item_id: c.item.id,
        quantity: c.quantity, unit_price: c.item.price, subtotal: c.item.price * c.quantity,
      }));
      const { error: itemsError } = await supabase.from('restaurant_order_items').insert(items);
      if (itemsError) throw itemsError;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['restaurant-orders'] }); toast.success('Commande créée'); setOrderDialogOpen(false); setCart([]); setOrderRoom(''); setWalkinName(''); setWalkinTable(''); setIsWalkin(false); },
    onError: (e: any) => toast.error(e.message),
  });

  const updateOrderStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const updates: any = { status };
      if (status === 'in_preparation') updates.started_at = new Date().toISOString();
      if (status === 'ready') updates.ready_at = new Date().toISOString();
      if (status === 'delivered') updates.delivered_at = new Date().toISOString();
      const { error } = await supabase.from('restaurant_orders').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['restaurant-orders'] }); toast.success('Statut mis à jour'); },
  });

  const saveMenuMutation = useMutation({
    mutationFn: async (values: any) => {
      const payload = { ...values, hotel_id: hotel!.id, category_id: values.category_id || null, description: values.description || null };
      if (editingItem) {
        const { error } = await supabase.from('restaurant_items').update(payload).eq('id', editingItem.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('restaurant_items').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['menu-items'] }); toast.success('Article sauvegardé'); setMenuDialogOpen(false); setEditingItem(null); reset(); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMenuMutation = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from('restaurant_items').delete().eq('id', id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['menu-items'] }); toast.success('Article supprimé'); setDeleteItem(null); },
  });

  const addToCart = (item: any) => {
    setCart(prev => {
      const existing = prev.find(c => c.item.id === item.id);
      if (existing) return prev.map(c => c.item.id === item.id ? { ...c, quantity: c.quantity + 1 } : c);
      return [...prev, { item, quantity: 1 }];
    });
  };

  const statusColors: Record<string, string> = { pending: 'bg-yellow-100 text-yellow-800', in_preparation: 'bg-blue-100 text-blue-800', ready: 'bg-green-100 text-green-800', delivered: 'bg-gray-100 text-gray-800', billed: 'bg-purple-100 text-purple-800', cancelled: 'bg-red-100 text-red-800' };
  const statusLabels: Record<string, string> = { pending: 'En attente', in_preparation: 'En préparation', ready: 'Prêt', delivered: 'Livré', billed: 'Facturé', cancelled: 'Annulé' };

  return (
    <div className="page-container space-y-6">
      <PageHeader title="Restaurant" subtitle="Gestion des commandes et du menu">
        <Button onClick={() => setOrderDialogOpen(true)}><Plus className="h-4 w-4 mr-2" />Nouvelle commande</Button>
      </PageHeader>

      <Tabs defaultValue="orders">
        <TabsList>
          <TabsTrigger value="orders">Commandes</TabsTrigger>
          <TabsTrigger value="menu">Menu</TabsTrigger>
        </TabsList>

        <TabsContent value="orders" className="mt-4">
          {ordersLoading ? <Skeleton className="h-40 w-full" /> : !orders?.length ? (
            <EmptyState icon={UtensilsCrossed} title="Aucune commande" description="Créez une commande" actionLabel="Nouvelle commande" onAction={() => setOrderDialogOpen(true)} />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {orders.map(order => (
                <Card key={order.id}>
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-center">
                      <CardTitle className="text-sm font-mono">{order.order_number}</CardTitle>
                      <Badge className={statusColors[order.status || 'pending']}>{statusLabels[order.status || 'pending']}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p className="text-sm">{order.is_walkin ? `Walk-in: ${order.walkin_name || '-'}${order.walkin_table ? ` (Table ${order.walkin_table})` : ''}` : `Chambre`}</p>
                    <div className="text-sm space-y-1">
                      {(order as any).restaurant_order_items?.map((oi: any) => (
                        <p key={oi.id}>{oi.quantity}x {oi.restaurant_items?.name} — {formatFCFA(oi.subtotal)}</p>
                      ))}
                    </div>
                    <p className="font-semibold">{formatFCFA(order.total_amount)}</p>
                    <div className="flex gap-2 mt-2">
                      {order.status === 'pending' && <Button size="sm" onClick={() => updateOrderStatus.mutate({ id: order.id, status: 'in_preparation' })}>Commencer</Button>}
                      {order.status === 'in_preparation' && <Button size="sm" onClick={() => updateOrderStatus.mutate({ id: order.id, status: 'ready' })}>Prêt</Button>}
                      {order.status === 'ready' && <Button size="sm" onClick={() => updateOrderStatus.mutate({ id: order.id, status: 'delivered' })}>Livré</Button>}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="menu" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => { reset(); setEditingItem(null); setMenuDialogOpen(true); }}><Plus className="h-4 w-4 mr-2" />Ajouter un article</Button>
          </div>
          {menuLoading ? <Skeleton className="h-40 w-full" /> : (
            <div className="rounded-md border">
              <Table>
                <TableHeader><TableRow><TableHead>Nom</TableHead><TableHead>Catégorie</TableHead><TableHead className="text-right">Prix</TableHead><TableHead>Disponible</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                <TableBody>
                  {menuItems?.map(item => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell>{(item as any).restaurant_categories?.name || '-'}</TableCell>
                      <TableCell className="text-right">{formatFCFA(item.price)}</TableCell>
                      <TableCell><Badge variant={item.available ? 'default' : 'secondary'}>{item.available ? 'Oui' : 'Non'}</Badge></TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => { setEditingItem(item); Object.entries(item).forEach(([k, v]) => { if (v != null) setValue(k as any, v); }); setMenuDialogOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteItem(item)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* New Order Dialog - FIX 8 */}
      <Dialog open={orderDialogOpen} onOpenChange={setOrderDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nouvelle commande</DialogTitle><DialogDescription>Sélectionnez les articles</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-4 mb-2">
              <Label>Walk-in</Label>
              <Switch checked={isWalkin} onCheckedChange={v => { setIsWalkin(v); if (v) setOrderRoom(''); }} />
            </div>
            {!isWalkin ? (
              <div>
                <Label>Chambre occupée</Label>
                {!occupiedRooms?.length ? (
                  <p className="text-sm text-muted-foreground mt-1">Aucune chambre occupée</p>
                ) : (
                  <Select onValueChange={v => setOrderRoom(v)}>
                    <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                    <SelectContent>
                      {occupiedRooms.map(r => (
                        <SelectItem key={r.id} value={r.id}>Chambre {r.room_number} — {r.guestName || 'Client'}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Nom du client</Label><Input placeholder="Nom" value={walkinName} onChange={e => setWalkinName(e.target.value)} /></div>
                <div><Label>N° de table</Label><Input placeholder="Table" value={walkinTable} onChange={e => setWalkinTable(e.target.value)} /></div>
              </div>
            )}
            <div>
              <Label>Articles disponibles</Label>
              <div className="grid grid-cols-2 gap-2 mt-2 max-h-48 overflow-y-auto">
                {menuItems?.filter(i => i.available).map(item => (
                  <Button key={item.id} variant="outline" className="justify-between" onClick={() => addToCart(item)}>
                    <span>{item.name}</span><span>{formatFCFA(item.price)}</span>
                  </Button>
                ))}
              </div>
            </div>
            {cart.length > 0 && (
              <div>
                <Label>Panier</Label>
                <div className="space-y-1 mt-2">
                  {cart.map(c => (
                    <div key={c.item.id} className="flex justify-between items-center text-sm">
                      <span>{c.quantity}x {c.item.name}</span>
                      <span>{formatFCFA(c.item.price * c.quantity)}</span>
                    </div>
                  ))}
                  <p className="font-bold text-right border-t pt-1">Total: {formatFCFA(cart.reduce((s, c) => s + c.item.price * c.quantity, 0))}</p>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setOrderDialogOpen(false); setCart([]); }}>Annuler</Button>
            <Button onClick={() => createOrderMutation.mutate()} disabled={cart.length === 0 || createOrderMutation.isPending}>Créer la commande</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Menu Item Dialog */}
      <Dialog open={menuDialogOpen} onOpenChange={v => { if (!v) { setMenuDialogOpen(false); setEditingItem(null); reset(); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingItem ? 'Modifier' : 'Nouvel'} article</DialogTitle><DialogDescription>Informations de l'article</DialogDescription></DialogHeader>
          <form onSubmit={handleSubmit(d => saveMenuMutation.mutate(d))} className="space-y-4">
            <div><Label>Nom *</Label><Input {...register('name')} /></div>
            <div><Label>Prix *</Label><Input type="number" {...register('price')} /></div>
            <div><Label>Catégorie</Label>
              <Select onValueChange={v => setValue('category_id', v)}>
                <SelectTrigger><SelectValue placeholder="Catégorie" /></SelectTrigger>
                <SelectContent>{categories?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Description</Label><Input {...register('description')} /></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setMenuDialogOpen(false); setEditingItem(null); reset(); }}>Annuler</Button>
              <Button type="submit">Enregistrer</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={!!deleteItem} onOpenChange={() => setDeleteItem(null)} title="Supprimer l'article" description={`Supprimer ${deleteItem?.name} ?`} onConfirm={() => deleteMenuMutation.mutate(deleteItem.id)} confirmLabel="Supprimer" variant="destructive" />
    </div>
  );
};

export default RestaurantPage;
