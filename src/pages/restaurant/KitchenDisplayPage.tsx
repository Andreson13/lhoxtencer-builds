import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useHotel } from '@/contexts/HotelContext';
import { useRoleGuard } from '@/hooks/useRoleGuard';
import { useRealtimeTable } from '@/hooks/useRealtimeTable';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { ChefHat, Clock, Play, CheckCircle } from 'lucide-react';

const KitchenDisplayPage = () => {
  useRoleGuard(['admin', 'manager', 'kitchen']);
  const { hotel } = useHotel();
  const qc = useQueryClient();

  useRealtimeTable('restaurant_orders', ['kitchen-orders', hotel?.id || '']);

  const { data: orders } = useQuery({
    queryKey: ['kitchen-orders', hotel?.id],
    queryFn: async () => {
      const { data } = await supabase.from('restaurant_orders').select('*, restaurant_order_items(*, restaurant_items(name))').eq('hotel_id', hotel!.id).in('status', ['pending', 'in_preparation']).order('created_at');
      return data || [];
    },
    enabled: !!hotel?.id,
    refetchInterval: 10000,
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const updates: any = { status };
      if (status === 'in_preparation') updates.started_at = new Date().toISOString();
      if (status === 'ready') updates.ready_at = new Date().toISOString();
      const { error } = await supabase.from('restaurant_orders').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['kitchen-orders'] }); toast.success('Statut mis à jour'); },
  });

  const pendingOrders = orders?.filter(o => o.status === 'pending') || [];
  const inPrepOrders = orders?.filter(o => o.status === 'in_preparation') || [];

  const getElapsed = (createdAt: string) => {
    const mins = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
    return mins;
  };

  const OrderCard = ({ order }: { order: any }) => {
    const elapsed = getElapsed(order.created_at);
    const isLate = elapsed > 30;

    return (
      <Card className={`${isLate ? 'border-destructive' : ''}`}>
        <CardHeader className="pb-2">
          <div className="flex justify-between items-center">
            <CardTitle className="text-lg font-mono">{order.order_number}</CardTitle>
            <Badge variant={isLate ? 'destructive' : 'outline'} className="flex items-center gap-1">
              <Clock className="h-3 w-3" />{elapsed}min
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">{order.is_walkin ? `Walk-in: ${order.walkin_name}` : 'Chambre'}</p>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 mb-4">
            {(order as any).restaurant_order_items?.map((oi: any) => (
              <div key={oi.id} className="flex items-center gap-2">
                <span className="text-2xl font-bold">{oi.quantity}x</span>
                <span className="text-lg">{oi.restaurant_items?.name}</span>
              </div>
            ))}
          </div>
          {order.notes && <p className="text-sm text-muted-foreground mb-3">📝 {order.notes}</p>}
          <div className="flex gap-2">
            {order.status === 'pending' && (
              <Button className="w-full" onClick={() => updateStatus.mutate({ id: order.id, status: 'in_preparation' })}>
                <Play className="h-4 w-4 mr-2" />Commencer
              </Button>
            )}
            {order.status === 'in_preparation' && (
              <Button className="w-full bg-green-600 hover:bg-green-700" onClick={() => updateStatus.mutate({ id: order.id, status: 'ready' })}>
                <CheckCircle className="h-4 w-4 mr-2" />Prêt
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="flex items-center gap-3 mb-6">
        <ChefHat className="h-8 w-8" />
        <h1 className="text-3xl font-bold">Cuisine</h1>
        <Badge variant="outline" className="ml-auto text-lg">{orders?.length || 0} commande(s)</Badge>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Badge className="bg-yellow-500">{pendingOrders.length}</Badge>En attente
          </h2>
          <div className="space-y-4">
            {pendingOrders.map(o => <OrderCard key={o.id} order={o} />)}
            {pendingOrders.length === 0 && <p className="text-muted-foreground text-center py-8">Aucune commande en attente</p>}
          </div>
        </div>
        <div>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Badge className="bg-blue-500">{inPrepOrders.length}</Badge>En préparation
          </h2>
          <div className="space-y-4">
            {inPrepOrders.map(o => <OrderCard key={o.id} order={o} />)}
            {inPrepOrders.length === 0 && <p className="text-muted-foreground text-center py-8">Aucune commande en préparation</p>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default KitchenDisplayPage;
