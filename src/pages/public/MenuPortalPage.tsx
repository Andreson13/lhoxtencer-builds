import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formatFCFA } from '@/utils/formatters';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Star, Send, UtensilsCrossed, Check, ShoppingCart, Plus, Minus, X } from 'lucide-react';

const MenuPortalPage = () => {
  const { slug, room } = useParams<{ slug: string; room?: string }>();
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [cart, setCart] = useState<{ item: any; quantity: number }[]>([]);
  const [orderSent, setOrderSent] = useState(false);
  const [orderNumber, setOrderNumber] = useState('');

  const { data: hotel } = useQuery({
    queryKey: ['hotel-menu-public', slug],
    queryFn: async () => {
      const { data } = await supabase.from('hotels').select('*').eq('slug', slug!).single();
      return data;
    },
    enabled: !!slug,
  });

  const { data: categories } = useQuery({
    queryKey: ['menu-categories-public', hotel?.id],
    queryFn: async () => {
      const { data } = await supabase.from('restaurant_categories').select('*').eq('hotel_id', hotel!.id).order('display_order');
      return data || [];
    },
    enabled: !!hotel?.id,
  });

  const { data: menuItems } = useQuery({
    queryKey: ['menu-items-public', hotel?.id],
    queryFn: async () => {
      const { data } = await supabase.from('restaurant_items').select('*').eq('hotel_id', hotel!.id).eq('available', true).order('name');
      return data || [];
    },
    enabled: !!hotel?.id,
  });

  const { data: services } = useQuery({
    queryKey: ['services-menu-public', hotel?.id],
    queryFn: async () => {
      const { data } = await supabase.from('hotel_services').select('*').eq('hotel_id', hotel!.id);
      return data || [];
    },
    enabled: !!hotel?.id,
  });

  const feedbackMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('guest_feedback').insert({
        hotel_id: hotel!.id,
        room_number: room || null,
        rating: feedbackRating,
        comment: feedbackComment || null,
      });
      if (error) throw error;
    },
    onSuccess: () => setFeedbackSent(true),
    onError: (e: any) => toast.error(e.message),
  });

  const orderMutation = useMutation({
    mutationFn: async () => {
      const totalAmount = cart.reduce((s, c) => s + c.item.price * c.quantity, 0);
      const now = new Date();
      const orderNum = `QR-${now.getHours().toString().padStart(2,'0')}${now.getMinutes().toString().padStart(2,'0')}-${Math.floor(Math.random()*999).toString().padStart(3,'0')}`;

      // Find room_id from room_number if provided
      let roomId: string | null = null;
      if (room && hotel) {
        const { data: roomData } = await supabase.from('rooms').select('id').eq('hotel_id', hotel.id).eq('room_number', room).maybeSingle();
        roomId = roomData?.id || null;
      }

      const { data: order, error } = await supabase.from('restaurant_orders').insert({
        hotel_id: hotel!.id,
        order_number: orderNum,
        room_id: roomId,
        room_number: room || null,
        is_walkin: false,
        billed_to_room: !!room,
        total_amount: totalAmount,
        status: 'pending',
      } as any).select().single();
      if (error) throw error;

      const items = cart.map(c => ({
        hotel_id: hotel!.id,
        order_id: order.id,
        item_id: c.item.id,
        quantity: c.quantity,
        unit_price: c.item.price,
        subtotal: c.item.price * c.quantity,
      }));
      const { error: itemsErr } = await supabase.from('restaurant_order_items').insert(items);
      if (itemsErr) throw itemsErr;

      return orderNum;
    },
    onSuccess: (orderNum) => {
      setOrderNumber(orderNum);
      setOrderSent(true);
      setCart([]);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const addToCart = (item: any) => {
    setCart(prev => {
      const existing = prev.find(c => c.item.id === item.id);
      if (existing) return prev.map(c => c.item.id === item.id ? { ...c, quantity: c.quantity + 1 } : c);
      return [...prev, { item, quantity: 1 }];
    });
  };

  const updateQuantity = (itemId: string, delta: number) => {
    setCart(prev => prev.map(c => c.item.id === itemId ? { ...c, quantity: Math.max(0, c.quantity + delta) } : c).filter(c => c.quantity > 0));
  };

  if (!hotel) return <div className="min-h-screen flex items-center justify-center"><p>Chargement...</p></div>;

  const groupedItems = categories?.map(cat => ({
    ...cat,
    items: menuItems?.filter(i => i.category_id === cat.id) || [],
  })).filter(g => g.items.length > 0) || [];

  const uncategorized = menuItems?.filter(i => !i.category_id) || [];
  const cartTotal = cart.reduce((s, c) => s + c.item.price * c.quantity, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-background">
      <div className="bg-primary text-primary-foreground py-8 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-2xl font-bold">{hotel.name}</h1>
          {room && <p className="mt-1 text-primary-foreground/80">Chambre {room}</p>}
          <p className="mt-2 text-sm text-primary-foreground/60">Menu & Services</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Order confirmation */}
        {orderSent && (
          <Card className="border-green-500">
            <CardContent className="py-6 text-center">
              <Check className="h-12 w-12 text-green-500 mx-auto mb-3" />
              <h2 className="text-xl font-bold">Commande envoyée !</h2>
              <p className="text-muted-foreground mt-1">Commande <strong>{orderNumber}</strong></p>
              <p className="text-sm text-muted-foreground mt-2">Votre commande a été envoyée à la cuisine.</p>
              <Button variant="outline" className="mt-4" onClick={() => setOrderSent(false)}>Nouvelle commande</Button>
            </CardContent>
          </Card>
        )}

        {/* Menu */}
        {!orderSent && (
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><UtensilsCrossed className="h-5 w-5" />Notre Menu</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              {groupedItems.map(group => (
                <div key={group.id}>
                  <h3 className="font-semibold text-lg border-b pb-2 mb-3">{group.name}</h3>
                  <div className="space-y-3">
                    {group.items.map(item => (
                      <div key={item.id} className="flex justify-between items-center">
                        <div className="flex-1">
                          <p className="font-medium">{item.name}</p>
                          {item.description && <p className="text-sm text-muted-foreground">{item.description}</p>}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-base">{formatFCFA(item.price)}</Badge>
                          <Button size="sm" variant="outline" onClick={() => addToCart(item)}><Plus className="h-3 w-3" /></Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {uncategorized.length > 0 && (
                <div>
                  <h3 className="font-semibold text-lg border-b pb-2 mb-3">Autres</h3>
                  <div className="space-y-3">
                    {uncategorized.map(item => (
                      <div key={item.id} className="flex justify-between items-center">
                        <p className="font-medium">{item.name}</p>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{formatFCFA(item.price)}</Badge>
                          <Button size="sm" variant="outline" onClick={() => addToCart(item)}><Plus className="h-3 w-3" /></Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Cart */}
        {cart.length > 0 && !orderSent && (
          <Card className="border-primary sticky bottom-4">
            <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2"><ShoppingCart className="h-5 w-5" />Votre commande</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {cart.map(c => (
                <div key={c.item.id} className="flex justify-between items-center text-sm">
                  <span className="flex-1">{c.item.name}</span>
                  <div className="flex items-center gap-2">
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => updateQuantity(c.item.id, -1)}><Minus className="h-3 w-3" /></Button>
                    <span className="w-6 text-center">{c.quantity}</span>
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => updateQuantity(c.item.id, 1)}><Plus className="h-3 w-3" /></Button>
                    <span className="w-24 text-right">{formatFCFA(c.item.price * c.quantity)}</span>
                  </div>
                </div>
              ))}
              <div className="border-t pt-2 flex justify-between font-bold">
                <span>Total</span>
                <span>{formatFCFA(cartTotal)}</span>
              </div>
              <Button className="w-full" onClick={() => orderMutation.mutate()} disabled={orderMutation.isPending}>
                <Send className="h-4 w-4 mr-2" />Passer la commande
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Services */}
        {services && services.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Services disponibles</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                {services.map(s => (
                  <div key={s.id} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-primary" />{s.name}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Feedback */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Star className="h-5 w-5" />Votre avis</CardTitle></CardHeader>
          <CardContent>
            {feedbackSent ? (
              <div className="text-center py-4">
                <Check className="h-8 w-8 text-green-500 mx-auto mb-2" />
                <p className="font-semibold">Merci pour votre avis !</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button key={n} onClick={() => setFeedbackRating(n)}>
                      <Star className={`h-8 w-8 ${n <= feedbackRating ? 'text-yellow-400 fill-yellow-400' : 'text-muted-foreground'}`} />
                    </button>
                  ))}
                </div>
                <Textarea placeholder="Votre commentaire (optionnel)..." value={feedbackComment} onChange={e => setFeedbackComment(e.target.value)} />
                <Button onClick={() => feedbackMutation.mutate()} disabled={feedbackRating === 0 || feedbackMutation.isPending}>
                  <Send className="h-4 w-4 mr-2" />Envoyer
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <footer className="py-6 text-center text-sm text-muted-foreground">
        <p>© {new Date().getFullYear()} {hotel.name}</p>
      </footer>
    </div>
  );
};

export default MenuPortalPage;
