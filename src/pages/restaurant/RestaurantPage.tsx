import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useHotel } from '@/contexts/HotelContext';
import { useI18n } from '@/contexts/I18nContext';
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
import { UtensilsCrossed, Plus, Pencil, Trash2, Upload, X } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { generateOrderNumber } from '@/utils/formatters';
import { addChargeToInvoice } from '@/services/transactionService';
import { enqueueOfflineSubmission } from '@/services/offlineSubmissionQueue';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

const menuSchema = z.object({
  name: z.string().min(1, 'Nom requis'),
  price: z.coerce.number().min(0),
  category_id: z.string().optional(),
  description: z.string().optional(),
  preparation_time_minutes: z.coerce.number().min(0).optional(),
  calories: z.coerce.number().min(0).optional(),
});

const ALLERGEN_LIST = ['Gluten', 'Lactose', 'Noix', 'Oeufs', 'Poisson', 'Soja', 'Arachides', 'Crustacés'];
const RestaurantPage = () => {
  const { t } = useI18n();
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
  const [menuIngredients, setMenuIngredients] = useState<string[]>([]);
  const [menuIngredientInput, setMenuIngredientInput] = useState('');
  const [menuAllergens, setMenuAllergens] = useState<string[]>([]);
  const [menuImageUrl, setMenuImageUrl] = useState<string>('');
  const [menuImageFile, setMenuImageFile] = useState<File | null>(null);
  const [menuImageUploading, setMenuImageUploading] = useState(false);
  const [menuIsAvailableToday, setMenuIsAvailableToday] = useState(true);

  const isNetworkIssue = (error: any) => {
    const message = String(error?.message || error || '').toLowerCase();
    return message.includes('fetch') || message.includes('network') || message.includes('offline') || message.includes('timeout');
  };

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm({ resolver: zodResolver(menuSchema) });

  const { data: orders, isLoading: ordersLoading } = useQuery({
    queryKey: ['restaurant-orders', hotel?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('restaurant_orders')
        .select('*, guests(first_name, last_name), rooms(room_number), restaurant_order_items(*, restaurant_items(name)), stay_id, guest_id, invoice_id, billed_to_room')
        .eq('hotel_id', hotel!.id)
        .order('created_at', { ascending: false })
        .limit(50);
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
      try {
        const totalAmount = cart.reduce((s, c) => s + c.item.price * c.quantity, 0);
        // Fetch stay/guest/invoice info if room selected (orderRoom is room UUID, not number)
        let stayId: string | null = null;
        let guestId: string | null = null;
        let invoiceId: string | null = null;
        if (orderRoom && !isWalkin) {
          const { data: stayData } = await supabase
            .from('stays')
            .select('id, guest_id, invoice_id, guests(first_name, last_name)')
            .eq('room_id', orderRoom)
            .eq('status', 'active')
            .maybeSingle();
          if (stayData) {
            stayId = stayData.id;
            guestId = stayData.guest_id;
            invoiceId = stayData.invoice_id;
          }
        }
        const { data: order, error } = await supabase.from('restaurant_orders').insert({
          hotel_id: hotel!.id,
          order_number: generateOrderNumber(),
          room_id: !isWalkin && orderRoom ? orderRoom : null,
          stay_id: stayId,
          guest_id: guestId,
          invoice_id: invoiceId,
          billed_to_room: !!stayId,
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
        return { queued: false };
      } catch (error) {
        if (isNetworkIssue(error)) {
          enqueueOfflineSubmission({
            type: 'restaurant-order-create',
            createdAt: new Date().toISOString(),
            payload: {
              hotelId: hotel!.id,
              profileId: profile?.id,
              orderRoom,
              isWalkin,
              walkinName,
              walkinTable,
              cart: cart.map((c) => ({ itemId: c.item.id, price: Number(c.item.price || 0), quantity: Number(c.quantity || 0) })),
            },
          });
          return { queued: true };
        }
        throw error;
      }
    },
    onSuccess: (result) => { qc.invalidateQueries({ queryKey: ['restaurant-orders'] }); toast.success(result?.queued ? 'Commande mise en file locale. Synchronisation en attente du reseau.' : t('restaurant.created')); setOrderDialogOpen(false); setCart([]); setOrderRoom(''); setWalkinName(''); setWalkinTable(''); setIsWalkin(false); },
    onError: (e: any) => toast.error(e.message),
  });

  const updateOrderStatus = useMutation({
    mutationFn: async ({ id, status, order }: { id: string; status: string; order?: any }) => {
      const updates: any = { status };
      if (status === 'in_preparation') updates.started_at = new Date().toISOString();
      if (status === 'ready') updates.ready_at = new Date().toISOString();
      if (status === 'delivered') {
        updates.delivered_at = new Date().toISOString();
        // Normalize transitions when delivered is chosen directly.
        updates.started_at = order?.started_at || updates.delivered_at;
        updates.ready_at = order?.ready_at || updates.delivered_at;
      }
      const { error } = await supabase.from('restaurant_orders').update(updates).eq('id', id);
      if (error) throw error;

      if (
        status === 'delivered' &&
        order?.status !== 'delivered' &&
        order?.billed_to_room &&
        order?.stay_id &&
        order?.invoice_id &&
        order?.stay_id
      ) {
        // Ensure guest_id is available (fetch from stay if order doesn't have it)
        let guestId = order?.guest_id;
        if (!guestId && order?.stay_id) {
          const { data: stay } = await supabase.from('stays').select('guest_id').eq('id', order.stay_id).maybeSingle();
          if (stay?.guest_id) guestId = stay.guest_id;
        }

        if (guestId) {
        const chargeDescription = `Restaurant — Commande #${order.order_number}`;
        const { data: existingCharge } = await supabase
          .from('invoice_items')
          .select('id')
          .eq('invoice_id', order.invoice_id)
          .eq('description', chargeDescription)
          .maybeSingle();

        if (!existingCharge) {
          await addChargeToInvoice({
            hotelId: hotel!.id,
            invoiceId: order.invoice_id,
            stayId: order.stay_id,
            guestId: guestId,
            description: chargeDescription,
            itemType: 'restaurant',
            quantity: 1,
            unitPrice: order.total_amount || 0,
          });
        }
        }

        await supabase.from('notifications').insert({
          hotel_id: hotel!.id,
          type: 'restaurant_delivered',
          title: t('restaurant.deliveredNotificationTitle'),
          message: `${t('restaurant.deliveredNotificationTitle')} ${order.order_number} ${t('restaurant.deliveredNotificationMessage')}`,
        });
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['restaurant-orders'] }); toast.success(t('restaurant.statusUpdated')); },
  });

  const saveMenuMutation = useMutation({
    mutationFn: async (values: any) => {
      let finalImageUrl = menuImageUrl;
      if (menuImageFile) {
        setMenuImageUploading(true);
        try {
          const ext = menuImageFile.name.split('.').pop();
          const path = `restaurant/${hotel!.id}/${Date.now()}.${ext}`;
          const { error: upErr } = await supabase.storage.from('hotel-assets').upload(path, menuImageFile, { upsert: true });
          if (upErr) throw upErr;
          const { data: urlData } = supabase.storage.from('hotel-assets').getPublicUrl(path);
          finalImageUrl = urlData.publicUrl;
        } finally { setMenuImageUploading(false); }
      }
      const payload = {
        ...values,
        hotel_id: hotel!.id,
        category_id: values.category_id || null,
        description: values.description || null,
        image_url: finalImageUrl || null,
        ingredients: menuIngredients.length ? menuIngredients : null,
        allergens: menuAllergens.length ? menuAllergens : null,
        preparation_time_minutes: values.preparation_time_minutes || null,
        calories: values.calories || null,
        is_available_today: menuIsAvailableToday,
      };
      if (editingItem) {
        const { error } = await supabase.from('restaurant_items').update(payload).eq('id', editingItem.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('restaurant_items').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['menu-items'] });
      toast.success(t('restaurant.saved'));
      setMenuDialogOpen(false);
      setEditingItem(null);
      reset();
      setMenuIngredients([]);
      setMenuAllergens([]);
      setMenuImageUrl('');
      setMenuImageFile(null);
      setMenuIsAvailableToday(true);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMenuMutation = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from('restaurant_items').delete().eq('id', id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['menu-items'] }); toast.success(t('restaurant.deleted')); setDeleteItem(null); },
  });

  const addToCart = (item: any) => {
    setCart(prev => {
      const existing = prev.find(c => c.item.id === item.id);
      if (existing) return prev.map(c => c.item.id === item.id ? { ...c, quantity: c.quantity + 1 } : c);
      return [...prev, { item, quantity: 1 }];
    });
  };

  const statusColors: Record<string, string> = { pending: 'bg-yellow-100 text-yellow-800', in_preparation: 'bg-blue-100 text-blue-800', ready: 'bg-green-100 text-green-800', delivered: 'bg-gray-100 text-gray-800', billed: 'bg-purple-100 text-purple-800', cancelled: 'bg-red-100 text-red-800' };
  const statusLabels: Record<string, string> = {
    pending: t('restaurant.status.pending'),
    in_preparation: t('restaurant.status.in_preparation'),
    ready: t('restaurant.status.ready'),
    delivered: t('restaurant.status.delivered'),
    billed: t('restaurant.status.billed'),
    cancelled: t('restaurant.status.cancelled'),
  };
  const pendingOrders = orders?.filter(order => order.status === 'pending').length || 0;
  const preparingOrders = orders?.filter(order => order.status === 'in_preparation').length || 0;
  const restaurantRevenue = orders?.reduce((sum, order) => sum + Number(order.total_amount || 0), 0) || 0;
  const avgOrderValue = orders?.length ? Math.round(restaurantRevenue / orders.length) : 0;

  return (
    <div className="page-container space-y-6">
      <PageHeader title={t('restaurant.title')} subtitle={t('restaurant.subtitle')}>
        <Button onClick={() => setOrderDialogOpen(true)}><Plus className="h-4 w-4 mr-2" />{t('restaurant.newOrder')}</Button>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{t('restaurant.summary.pending')}</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-semibold">{pendingOrders}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{t('restaurant.summary.preparing')}</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-semibold">{preparingOrders}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{t('restaurant.summary.revenue')}</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-semibold">{formatFCFA(restaurantRevenue)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{t('restaurant.summary.avg')}</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-semibold">{formatFCFA(avgOrderValue)}</p></CardContent>
        </Card>
      </div>

      <Tabs defaultValue="orders">
        <TabsList>
          <TabsTrigger value="orders">{t('tabs.orders')}</TabsTrigger>
          <TabsTrigger value="menu">{t('tabs.menu')}</TabsTrigger>
        </TabsList>

        <TabsContent value="orders" className="mt-4">
          {ordersLoading ? <Skeleton className="h-40 w-full" /> : !orders?.length ? (
            <EmptyState icon={UtensilsCrossed} title={t('restaurant.emptyTitle')} description={t('restaurant.emptyDescription')} actionLabel={t('restaurant.newOrder')} onAction={() => setOrderDialogOpen(true)} />
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
                    <p className="text-sm">
                      {order.is_walkin
                        ? `${t('restaurant.order.walkinSummary')}: ${order.walkin_name || '-'}${order.walkin_table ? ` (${t('restaurant.order.table')} ${order.walkin_table})` : ''}`
                        : `${t('restaurant.order.room')} ${(order as any).rooms?.room_number || order.room_number || '-'} - ${((order as any).guests?.last_name && (order as any).guests?.first_name) ? `${(order as any).guests.last_name} ${(order as any).guests.first_name}` : t('restaurant.order.guestFallback')}`}
                    </p>
                    <div className="text-sm space-y-1">
                      {(order as any).restaurant_order_items?.map((oi: any) => (
                        <p key={oi.id}>{oi.quantity}x {oi.restaurant_items?.name} — {formatFCFA(oi.subtotal)}</p>
                      ))}
                    </div>
                    <p className="font-semibold">{formatFCFA(order.total_amount)}</p>
                    <div className="flex gap-2 mt-2">
                      {order.status === 'pending' && <Button size="sm" onClick={() => updateOrderStatus.mutate({ id: order.id, status: 'in_preparation', order })}>{t('restaurant.order.start')}</Button>}
                      {order.status === 'in_preparation' && <Button size="sm" onClick={() => updateOrderStatus.mutate({ id: order.id, status: 'ready', order })}>{t('restaurant.order.ready')}</Button>}
                      {order.status === 'ready' && <Button size="sm" onClick={() => updateOrderStatus.mutate({ id: order.id, status: 'delivered', order })}>{t('restaurant.order.delivered')}</Button>}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="menu" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => { reset(); setEditingItem(null); setMenuDialogOpen(true); }}><Plus className="h-4 w-4 mr-2" />{t('restaurant.menu.add')}</Button>
          </div>
          {menuLoading ? <Skeleton className="h-40 w-full" /> : (
            <div className="rounded-xl border bg-card/60 shadow-sm">
              <Table>
                <TableHeader><TableRow><TableHead>{t('restaurant.menu.name')}</TableHead><TableHead>{t('restaurant.menu.category')}</TableHead><TableHead className="text-right">{t('restaurant.menu.price')}</TableHead><TableHead>{t('restaurant.menu.available')}</TableHead><TableHead className="text-right">{t('common.actions')}</TableHead></TableRow></TableHeader>
                <TableBody>
                  {menuItems?.map(item => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell>{(item as any).restaurant_categories?.name || '-'}</TableCell>
                      <TableCell className="text-right">{formatFCFA(item.price)}</TableCell>
                      <TableCell><Badge variant={item.available ? 'default' : 'secondary'}>{item.available ? t('restaurant.menu.itemAvailable') : t('restaurant.menu.itemUnavailable')}</Badge></TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => {
                          setEditingItem(item);
                          Object.entries(item).forEach(([k, v]) => { if (v != null) setValue(k as any, v); });
                          const itemAny = item as any;
                          setMenuIngredients(Array.isArray(itemAny.ingredients) ? itemAny.ingredients : []);
                          setMenuAllergens(Array.isArray(itemAny.allergens) ? itemAny.allergens : []);
                          setMenuImageUrl(itemAny.image_url || '');
                          setMenuImageFile(null);
                          setMenuIsAvailableToday(itemAny.is_available_today !== false);
                          setMenuDialogOpen(true);
                        }}><Pencil className="h-4 w-4" /></Button>
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
          <DialogHeader><DialogTitle>{t('restaurant.dialog.orderTitle')}</DialogTitle><DialogDescription>{t('restaurant.dialog.orderDescription')}</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-4 mb-2">
              <Label>{t('restaurant.order.walkinLabel')}</Label>
              <Switch checked={isWalkin} onCheckedChange={v => { setIsWalkin(v); if (v) setOrderRoom(''); }} />
            </div>
            {!isWalkin ? (
              <div>
                <Label>{t('restaurant.dialog.occupiedRoom')}</Label>
                {!occupiedRooms?.length ? (
                  <p className="text-sm text-muted-foreground mt-1">{t('restaurant.dialog.noOccupiedRoom')}</p>
                ) : (
                  <Select onValueChange={v => setOrderRoom(v)}>
                    <SelectTrigger><SelectValue placeholder={t('restaurant.dialog.selectRoom')} /></SelectTrigger>
                    <SelectContent>
                      {occupiedRooms.map(r => (
                        <SelectItem key={r.id} value={r.id}>{t('restaurant.order.room')} {r.room_number} - {r.guestName || t('restaurant.order.guestFallback')}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div><Label>{t('restaurant.dialog.walkinName')}</Label><Input placeholder={t('restaurant.dialog.walkinName')} value={walkinName} onChange={e => setWalkinName(e.target.value)} /></div>
                <div><Label>{t('restaurant.dialog.walkinTable')}</Label><Input placeholder={t('restaurant.dialog.walkinTable')} value={walkinTable} onChange={e => setWalkinTable(e.target.value)} /></div>
              </div>
            )}
            <div>
              <Label>{t('restaurant.dialog.availableItems')}</Label>
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
                <Label>{t('restaurant.dialog.cart')}</Label>
                <div className="space-y-1 mt-2">
                  {cart.map(c => (
                    <div key={c.item.id} className="flex justify-between items-center text-sm">
                      <span>{c.quantity}x {c.item.name}</span>
                      <span>{formatFCFA(c.item.price * c.quantity)}</span>
                    </div>
                  ))}
                  <p className="font-bold text-right border-t pt-1">{t('common.total')}: {formatFCFA(cart.reduce((s, c) => s + c.item.price * c.quantity, 0))}</p>
                </div>
              </div>
            )}
            {cart.length === 0 && <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">{t('restaurant.dialog.emptyCart')}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setOrderDialogOpen(false); setCart([]); }}>{t('common.cancel')}</Button>
            <Button onClick={() => createOrderMutation.mutate()} disabled={cart.length === 0 || createOrderMutation.isPending}>{t('restaurant.dialog.createOrder')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Menu Item Dialog */}
      <Dialog open={menuDialogOpen} onOpenChange={v => { if (!v) { setMenuDialogOpen(false); setEditingItem(null); reset(); setMenuIngredients([]); setMenuAllergens([]); setMenuImageUrl(''); setMenuImageFile(null); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingItem ? t('restaurant.dialog.menuEditTitle') : t('restaurant.dialog.menuNewTitle')}</DialogTitle><DialogDescription>{t('restaurant.dialog.menuDescription')}</DialogDescription></DialogHeader>
          <form onSubmit={handleSubmit(d => saveMenuMutation.mutate(d))} className="space-y-4">
            <div><Label>{t('restaurant.menu.name')} *</Label><Input {...register('name')} /></div>
            <div><Label>{t('restaurant.menu.price')} *</Label><Input type="number" {...register('price')} /></div>
            <div><Label>{t('restaurant.menu.category')}</Label>
              <Select onValueChange={v => setValue('category_id', v)}>
                <SelectTrigger><SelectValue placeholder={t('restaurant.menu.category')} /></SelectTrigger>
                <SelectContent>{categories?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>{t('restaurant.dialog.description')}</Label><Textarea {...register('description')} rows={2} /></div>

            {/* Image upload */}
            <div>
              <Label>Image</Label>
              <div className="mt-1 border-2 border-dashed rounded-lg p-3 flex flex-col items-center gap-2">
                {menuImageUrl && !menuImageFile && <img src={menuImageUrl} alt="preview" className="h-24 w-full object-cover rounded" />}
                {menuImageFile && <img src={URL.createObjectURL(menuImageFile)} alt="preview" className="h-24 w-full object-cover rounded" />}
                <label className="cursor-pointer flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
                  <Upload className="h-4 w-4" />
                  {menuImageFile ? menuImageFile.name : 'Choisir une image'}
                  <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) { setMenuImageFile(f); setMenuImageUrl(''); } }} />
                </label>
                {(menuImageUrl || menuImageFile) && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => { setMenuImageUrl(''); setMenuImageFile(null); }}><X className="h-3 w-3 mr-1" />Supprimer</Button>
                )}
              </div>
            </div>

            {/* Ingredients tag input */}
            <div>
              <Label>Ingrédients</Label>
              <div className="flex flex-wrap gap-1 mt-1 mb-1">
                {menuIngredients.map(ing => (
                  <span key={ing} className="inline-flex items-center gap-1 bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full text-xs">
                    {ing}
                    <button type="button" onClick={() => setMenuIngredients(prev => prev.filter(i => i !== ing))}><X className="h-3 w-3" /></button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Ajouter un ingrédient..."
                  value={menuIngredientInput}
                  onChange={e => setMenuIngredientInput(e.target.value)}
                  onKeyDown={e => {
                    if ((e.key === 'Enter' || e.key === ',') && menuIngredientInput.trim()) {
                      e.preventDefault();
                      const val = menuIngredientInput.trim().replace(/,$/, '');
                      if (val && !menuIngredients.includes(val)) setMenuIngredients(prev => [...prev, val]);
                      setMenuIngredientInput('');
                    }
                  }}
                />
                <Button type="button" variant="outline" size="sm" onClick={() => { const val = menuIngredientInput.trim(); if (val && !menuIngredients.includes(val)) { setMenuIngredients(prev => [...prev, val]); setMenuIngredientInput(''); } }}>+</Button>
              </div>
            </div>

            {/* Allergens */}
            <div>
              <Label>Allergènes</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {ALLERGEN_LIST.map(al => (
                  <div key={al} className="flex items-center gap-2">
                    <Checkbox
                      id={`al-${al}`}
                      checked={menuAllergens.includes(al)}
                      onCheckedChange={checked => setMenuAllergens(prev => checked ? [...prev, al] : prev.filter(a => a !== al))}
                    />
                    <label htmlFor={`al-${al}`} className="text-sm cursor-pointer">{al}</label>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div><Label>Temps de préparation (min)</Label><Input type="number" min={0} {...register('preparation_time_minutes')} placeholder="15" /></div>
              <div><Label>Calories (kcal)</Label><Input type="number" min={0} {...register('calories')} placeholder="350" /></div>
            </div>

            {/* Available today toggle */}
            <div className="flex items-center gap-3">
              <Switch checked={menuIsAvailableToday} onCheckedChange={setMenuIsAvailableToday} id="avail-today" />
              <Label htmlFor="avail-today">Disponible aujourd'hui</Label>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setMenuDialogOpen(false); setEditingItem(null); reset(); setMenuIngredients([]); setMenuAllergens([]); setMenuImageUrl(''); setMenuImageFile(null); }}>{t('common.cancel')}</Button>
              <Button type="submit" disabled={menuImageUploading}>{menuImageUploading ? 'Envoi...' : t('common.save')}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={!!deleteItem} onOpenChange={() => setDeleteItem(null)} title={t('restaurant.deleteTitle')} description={`${t('restaurant.deleteDescription')} ${deleteItem?.name || ''} ?`} onConfirm={() => deleteMenuMutation.mutate(deleteItem.id)} confirmLabel={t('common.delete')} variant="destructive" />
    </div>
  );
};

export default RestaurantPage;
