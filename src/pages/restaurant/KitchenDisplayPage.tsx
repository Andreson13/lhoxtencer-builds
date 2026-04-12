import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useHotel } from '@/contexts/HotelContext';
import { useRoleGuard } from '@/hooks/useRoleGuard';
import { useRealtimeTable } from '@/hooks/useRealtimeTable';
import { updateMainCourante } from '@/utils/mainCourante';
import { formatFCFA } from '@/utils/formatters';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { ChefHat, Clock, Play, CheckCircle, User } from 'lucide-react';

const KitchenDisplayPage = () => {
  useRoleGuard(['admin', 'manager', 'kitchen']);
  const { hotel } = useHotel();
  const qc = useQueryClient();

  useRealtimeTable('restaurant_orders', ['kitchen-orders', hotel?.id || '']);

  const { data: orders } = useQuery({
    queryKey: ['kitchen-orders', hotel?.id],
    queryFn: async () => {
      const { data } = await supabase.from('restaurant_orders')
        .select('*, restaurant_order_items(*, restaurant_items(name, inventory_item_id))')
        .eq('hotel_id', hotel!.id)
        .in('status', ['pending', 'in_preparation'])
        .order('created_at');
      return data || [];
    },
    enabled: !!hotel?.id,
    refetchInterval: 10000,
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status, order }: { id: string; status: string; order?: any }) => {
      const updates: any = { status };
      if (status === 'in_preparation') updates.started_at = new Date().toISOString();
      if (status === 'ready') updates.ready_at = new Date().toISOString();
      if (status === 'delivered') {
        updates.delivered_at = new Date().toISOString();

        // FIX 10: Stock auto-deduction on delivery
        if (order?.restaurant_order_items) {
          for (const item of order.restaurant_order_items) {
            const invItemId = (item as any).restaurant_items?.inventory_item_id;
            if (invItemId) {
              // Deduct stock
              const { data: invItem } = await supabase.from('inventory_items').select('current_stock, minimum_stock, name').eq('id', invItemId).maybeSingle();
              if (invItem) {
                const newStock = Math.max(0, invItem.current_stock - item.quantity);
                await supabase.from('inventory_items').update({ current_stock: newStock }).eq('id', invItemId);
                // Log stock movement
                await supabase.from('stock_movements').insert({
                  hotel_id: hotel!.id, item_id: invItemId,
                  movement_type: 'out', quantity: item.quantity,
                  source: 'restaurant_sale', reference_id: id,
                } as any);
                // Low stock notification
                if (newStock <= (invItem.minimum_stock || 5)) {
                  await supabase.from('notifications').insert({
                    hotel_id: hotel!.id, type: 'low_stock',
                    title: 'Stock bas',
                    message: `${invItem.name} — ${newStock} unités restantes (minimum: ${invItem.minimum_stock || 5})`,
                  });
                }
              }
            }
          }
        }

        // FIX 11: Update main_courante restaurant column if billed to room
        if (order?.billed_to_room && order?.guest_id && order?.room_number && hotel) {
          const today = new Date().toISOString().split('T')[0];
          const guestName = order.room_number ? `Chambre ${order.room_number}` : 'Client';
          await updateMainCourante(hotel.id, today, order.guest_id, order.room_number, guestName, 'restaurant', order.total_amount || 0);

          // Add to guest invoice
          if (order.invoice_id) {
            await supabase.from('invoice_items').insert({
              hotel_id: hotel.id, invoice_id: order.invoice_id,
              description: `Restaurant — Commande #${order.order_number}`,
              item_type: 'restaurant', quantity: 1,
              unit_price: order.total_amount || 0, subtotal: order.total_amount || 0,
            });
            // Update invoice total
            const { data: inv } = await supabase.from('invoices').select('total_amount, balance_due').eq('id', order.invoice_id).maybeSingle();
            if (inv) {
              await supabase.from('invoices').update({
                total_amount: (inv.total_amount || 0) + (order.total_amount || 0),
                balance_due: (inv.balance_due || 0) + (order.total_amount || 0),
              }).eq('id', order.invoice_id);
            }
          }
        }
      }

      const { error } = await supabase.from('restaurant_orders').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['kitchen-orders'] }); toast.success('Statut mis à jour'); },
  });

  const pendingOrders = orders?.filter(o => o.status === 'pending') || [];
  const inPrepOrders = orders?.filter(o => o.status === 'in_preparation') || [];

  const getElapsed = (createdAt: string) => Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);

  const OrderCard = ({ order }: { order: any }) => {
    const elapsed = getElapsed(order.created_at);
    const isLate = elapsed > 30;
    const guestLabel = order.room_number
      ? `Chambre ${order.room_number}${order.walkin_name ? ' — ' + order.walkin_name : ''}`
      : order.is_walkin
        ? `Walk-in${order.walkin_name ? ' — ' + order.walkin_name : ''}${order.walkin_table ? ' (Table ' + order.walkin_table + ')' : ''}`
        : 'Commande interne';

    return (
      <Card className={isLate ? 'border-destructive' : ''}>
        <CardHeader className="pb-2">
          <div className="flex justify-between items-center">
            <CardTitle className="text-lg font-mono">{order.order_number}</CardTitle>
            <Badge variant={isLate ? 'destructive' : 'outline'} className="flex items-center gap-1"><Clock className="h-3 w-3" />{elapsed}min</Badge>
          </div>
          <p className="text-sm font-semibold flex items-center gap-1"><User className="h-3 w-3" />{guestLabel}</p>
          {order.billed_to_room && <Badge variant="outline" className="text-xs w-fit">Facturé en chambre</Badge>}
        </CardHeader>
        <CardContent>
          <ul className="space-y-1 mb-4">
            {order.restaurant_order_items?.map((item: any) => (
              <li key={item.id} className="flex justify-between text-sm">
                <span>{item.quantity}× {item.restaurant_items?.name || '?'}</span>
                <span className="text-muted-foreground">{formatFCFA(item.subtotal)}</span>
              </li>
            ))}
          </ul>
          {order.notes && <p className="text-xs text-muted-foreground italic mb-3">Note: {order.notes}</p>}
          <div className="flex gap-2">
            {order.status === 'pending' && (
              <Button size="sm" onClick={() => updateStatus.mutate({ id: order.id, status: 'in_preparation' })} className="flex-1"><Play className="h-3 w-3 mr-1" />Commencer</Button>
            )}
            {order.status === 'in_preparation' && (
              <Button size="sm" onClick={() => updateStatus.mutate({ id: order.id, status: 'ready' })} className="flex-1"><CheckCircle className="h-3 w-3 mr-1" />Prêt</Button>
            )}
            {order.status === 'ready' && (
              <Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ id: order.id, status: 'delivered', order })} className="flex-1">Livré</Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="page-container">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2"><ChefHat className="h-6 w-6" /><h1 className="text-2xl font-bold">Cuisine</h1></div>
        <Badge variant="outline">{(pendingOrders.length + inPrepOrders.length)} commande(s) active(s)</Badge>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2"><Badge variant="destructive">{pendingOrders.length}</Badge>En attente</h2>
          <div className="space-y-4">{pendingOrders.map(o => <OrderCard key={o.id} order={o} />)}</div>
        </div>
        <div>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2"><Badge>{inPrepOrders.length}</Badge>En préparation</h2>
          <div className="space-y-4">{inPrepOrders.map(o => <OrderCard key={o.id} order={o} />)}</div>
        </div>
      </div>
    </div>
  );
};

export default KitchenDisplayPage;
