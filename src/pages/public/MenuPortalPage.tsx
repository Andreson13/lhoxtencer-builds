import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useI18n } from '@/contexts/I18nContext';
import { supabase } from '@/integrations/supabase/client';
import { addChargeToInvoice } from '@/services/transactionService';
import { formatFCFA } from '@/utils/formatters';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Star, Send, UtensilsCrossed, Check, ShoppingCart, Plus, Minus, Bell, User } from 'lucide-react';

const MenuPortalPage = () => {
  const { t, setLang } = useI18n();
  const params = useParams<{ slug?: string; room?: string; hotelSlug?: string; roomNumber?: string; hotelId?: string }>();

  React.useEffect(() => {
    setLang('fr');
  }, [setLang]);
  const slug = params.slug || params.hotelSlug || params.hotelId;
  const room = params.room || params.roomNumber;
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [cart, setCart] = useState<{ item: any; quantity: number }[]>([]);
  const [orderSent, setOrderSent] = useState(false);
  const [orderNumber, setOrderNumber] = useState('');
  const [serviceRequest, setServiceRequest] = useState('');
  const [serviceType, setServiceType] = useState('towels');
  const [serviceSent, setServiceSent] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [cartOpen, setCartOpen] = useState(false);

  const { data: hotel } = useQuery({
    queryKey: ['hotel-menu-public', slug],
    queryFn: async () => {
      const identifier = slug;
      if (!identifier) return null;

      const { data: bySlug } = await supabase.from('hotels').select('*').eq('slug', identifier).maybeSingle();
      if (bySlug) return bySlug;

      const { data: byId } = await supabase.from('hotels').select('*').eq('id', identifier).maybeSingle();
      return byId;
    },
    enabled: !!slug,
  });

  // FIX 7: Auto-identify guest from active stay
  const { data: activeStay } = useQuery({
    queryKey: ['active-stay-room', hotel?.id, room],
    queryFn: async () => {
      if (!room || !hotel) return null;
      const { data: roomData } = await supabase.from('rooms').select('id, room_number').eq('hotel_id', hotel.id).eq('room_number', room).maybeSingle();
      if (!roomData) return null;
      const { data: stay } = await supabase
        .from('stays')
        .select('id, guest_id, invoice_id, guests(first_name, last_name), rooms(room_number)')
        .eq('hotel_id', hotel.id)
        .eq('status', 'active')
        .eq('room_id', roomData.id)
        .maybeSingle();
      return stay ? { ...stay, room_id: roomData.id } : null;
    },
    enabled: !!hotel?.id && !!room,
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

  const { data: drinks } = useQuery({
    queryKey: ['drinks-menu-public', hotel?.id],
    queryFn: async () => {
      const { data } = await supabase.from('inventory_items' as any).select('*').eq('hotel_id', hotel!.id).eq('is_minibar', true).gt('current_stock', 0).order('name');
      return data || [];
    },
    enabled: !!hotel?.id,
  });

  const guestName = activeStay?.guests ? `${(activeStay.guests as any).first_name}` : null;
  const guestFullName = activeStay?.guests ? `${(activeStay.guests as any).last_name} ${(activeStay.guests as any).first_name}` : null;

  const feedbackMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('guest_feedback').insert({
        hotel_id: hotel!.id,
        room_number: room || null,
        guest_id: activeStay?.guest_id || null,
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
      const orderNum = `QR-${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}-${Math.floor(Math.random() * 999).toString().padStart(3, '0')}`;

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
        guest_id: activeStay?.guest_id || null,
        stay_id: activeStay?.id || null,
        invoice_id: activeStay?.invoice_id || null,
        is_walkin: !activeStay,
        billed_to_room: !!activeStay,
        total_amount: totalAmount,
        status: 'pending',
      } as any).select().single();
      if (error) throw error;

      const items = cart.map(c => ({
        hotel_id: hotel!.id, order_id: order.id, item_id: c.item.id,
        quantity: c.quantity, unit_price: c.item.price, subtotal: c.item.price * c.quantity,
      }));
      const { error: itemsErr } = await supabase.from('restaurant_order_items').insert(items);
      if (itemsErr) throw itemsErr;

      if (activeStay?.invoice_id && activeStay?.id && activeStay?.guest_id) {
        await addChargeToInvoice({
          hotelId: hotel!.id,
          invoiceId: activeStay.invoice_id,
          stayId: activeStay.id,
          guestId: activeStay.guest_id,
          description: `Restaurant — Commande #${orderNum}`,
          itemType: 'restaurant',
          quantity: 1,
          unitPrice: totalAmount,
        });

        await supabase
          .from('restaurant_orders')
          .update({
            guest_id: activeStay.guest_id,
            stay_id: activeStay.id,
            invoice_id: activeStay.invoice_id,
          } as any)
          .eq('id', order.id);
      }

      return orderNum;
    },
    onSuccess: (orderNum) => { setOrderNumber(orderNum); setOrderSent(true); setCart([]); },
    onError: (e: any) => toast.error(e.message),
  });

  const serviceRequestMutation = useMutation({
    mutationFn: async () => {
      let roomId: string | null = null;
      if (room && hotel) {
        const { data: roomData } = await supabase.from('rooms').select('id').eq('hotel_id', hotel.id).eq('room_number', room).maybeSingle();
        roomId = roomData?.id || null;
      }
      const { error } = await supabase.from('service_requests').insert({
        hotel_id: hotel!.id, room_id: roomId, room_number: room || null,
        request_type: serviceType, description: serviceRequest || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { setServiceSent(true); setServiceRequest(''); },
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

  if (!hotel) return <div className="min-h-screen flex items-center justify-center"><p>{t('menu.loading')}</p></div>;

  const groupedItems = categories?.map(cat => ({ ...cat, items: menuItems?.filter(i => i.category_id === cat.id) || [] })).filter(g => g.items.length > 0) || [];
  const uncategorized = menuItems?.filter(i => !i.category_id) || [];
  const availableTodayItems = (menuItems || []).filter((item: any) => item.is_available_today !== false);
  const cartTotal = cart.reduce((s, c) => s + c.item.price * c.quantity, 0);

  const allCategoryTabs = [
    { id: 'all', name: t('menu.categories.all') },
    ...(categories || []).map((c: any) => ({ id: c.id, name: c.name })),
    ...(drinks && drinks.length > 0 ? [{ id: 'drinks', name: 'Boissons' }] : []),
    ...(uncategorized.length > 0 ? [{ id: 'uncategorized', name: t('menu.categories.other') }] : []),
  ];

  const filteredItems = selectedCategory === 'drinks'
    ? (drinks || []).map(d => ({ ...d, price: d.selling_price, id: d.id, name: d.name }))
    : selectedCategory === 'all'
    ? availableTodayItems
    : selectedCategory === 'uncategorized'
      ? availableTodayItems.filter((item: any) => !item.category_id)
      : availableTodayItems.filter((item: any) => item.category_id === selectedCategory);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-background">
      <div className="bg-primary text-primary-foreground py-8 px-4">
        <div className="max-w-2xl mx-auto text-center">
          {hotel.logo_url && <img src={hotel.logo_url} alt="" className="h-12 mx-auto mb-2 rounded" />}
          <h1 className="text-2xl font-bold">{hotel.name}</h1>
          {room && <p className="mt-1 text-primary-foreground/80">{t('menu.room')} {room}</p>}
          {guestName && (
            <p className="mt-2 text-primary-foreground/90 flex items-center justify-center gap-1">
              <User className="h-4 w-4" /> {t('menu.greeting')} {guestName} !
            </p>
          )}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6 pb-28">
        {/* Billing notice */}
        {activeStay && (
          <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 text-sm text-center">
            {t('menu.billingNotice')} {room}
          </div>
        )}

        {/* Order confirmation */}
        {orderSent && (
          <Card className="border-green-500 bg-gradient-to-br from-green-50 to-emerald-50">
            <CardContent className="py-10 text-center">
              <Check className="h-12 w-12 text-green-500 mx-auto mb-3" />
              <h2 className="text-2xl font-bold">{t('menu.submitted.title')}</h2>
              <p className="text-muted-foreground mt-1">{t('menu.submitted.reference')} <strong>{orderNumber}</strong></p>
              <p className="text-sm text-muted-foreground mt-2">{t('menu.submitted.message')}</p>
              {activeStay && <p className="text-sm text-primary mt-1">{t('menu.submitted.billed')} {room}</p>}
              <Button variant="outline" className="mt-4" onClick={() => setOrderSent(false)}>{t('menu.submitted.new')}</Button>
            </CardContent>
          </Card>
        )}

        {/* Menu */}
        {!orderSent && (
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><UtensilsCrossed className="h-5 w-5" />{t('menu.title')}</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
                <TabsList className="w-full overflow-x-auto justify-start">
                  {allCategoryTabs.map(tab => <TabsTrigger key={tab.id} value={tab.id}>{tab.name}</TabsTrigger>)}
                </TabsList>
              </Tabs>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {filteredItems.map((item: any) => (
                  <Card key={item.id} className="overflow-hidden border-muted">
                    {item.image_url ? (
                      <img src={item.image_url} alt={item.name} className="h-40 w-full object-cover" />
                    ) : (
                      <div className="h-40 w-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center text-slate-400">
                        <UtensilsCrossed className="h-8 w-8" />
                      </div>
                    )}
                    <CardContent className="pt-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold leading-tight">{item.name}</p>
                          {item.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.description}</p>}
                        </div>
                        <Badge variant="outline">{formatFCFA(item.price)}</Badge>
                      </div>

                      <div className="flex flex-wrap gap-1">
                        {item.preparation_time_minutes ? <Badge variant="secondary">{item.preparation_time_minutes} min</Badge> : null}
                        {item.calories ? <Badge variant="secondary">{item.calories} kcal</Badge> : null}
                        {(item.allergens || []).slice(0, 3).map((a: string) => <Badge key={a} variant="outline" className="text-[10px]">{a}</Badge>)}
                      </div>

                      <Button size="sm" className="w-full" onClick={() => addToCart(item)}>
                        <Plus className="h-3 w-3 mr-1" /> {t('menu.addToCart')}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
              {filteredItems.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">{t('menu.empty')}</p>}
            </CardContent>
          </Card>
        )}

        {/* Service Request */}
        {room && (
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5" />{t('menu.service.title')}</CardTitle></CardHeader>
            <CardContent>
              {serviceSent ? (
                <div className="text-center py-4"><Check className="h-8 w-8 text-green-500 mx-auto mb-2" /><p className="font-semibold">{t('menu.service.sent')}</p></div>
              ) : (
                <div className="space-y-3">
                  <Select value={serviceType} onValueChange={setServiceType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="towels">{t('menu.service.towels')}</SelectItem>
                      <SelectItem value="cleaning">{t('menu.service.cleaning')}</SelectItem>
                      <SelectItem value="minibar">{t('menu.service.minibar')}</SelectItem>
                      <SelectItem value="maintenance">{t('menu.service.maintenance')}</SelectItem>
                      <SelectItem value="other">{t('menu.service.other')}</SelectItem>
                    </SelectContent>
                  </Select>
                  <Textarea placeholder={t('menu.service.details')} value={serviceRequest} onChange={e => setServiceRequest(e.target.value)} />
                  <Button onClick={() => serviceRequestMutation.mutate()} disabled={serviceRequestMutation.isPending}><Send className="h-4 w-4 mr-2" />{t('menu.service.send')}</Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Services */}
        {services && services.length > 0 && (
          <Card>
            <CardHeader><CardTitle>{t('menu.service.available')}</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                {services.map(s => <div key={s.id} className="flex items-center gap-2 text-sm"><Check className="h-4 w-4 text-primary" />{s.name}</div>)}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Feedback */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Star className="h-5 w-5" />{t('menu.feedback.title')}</CardTitle></CardHeader>
          <CardContent>
            {feedbackSent ? (
              <div className="text-center py-4"><Check className="h-8 w-8 text-green-500 mx-auto mb-2" /><p className="font-semibold">{t('menu.feedback.thanks')}</p></div>
            ) : (
              <div className="space-y-4">
                <div className="flex gap-2">{[1, 2, 3, 4, 5].map(n => <button key={n} onClick={() => setFeedbackRating(n)}><Star className={`h-8 w-8 ${n <= feedbackRating ? 'text-yellow-400 fill-yellow-400' : 'text-muted-foreground'}`} /></button>)}</div>
                <Textarea placeholder={t('menu.feedback.comment')} value={feedbackComment} onChange={e => setFeedbackComment(e.target.value)} />
                <Button onClick={() => feedbackMutation.mutate()} disabled={feedbackRating === 0 || feedbackMutation.isPending}><Send className="h-4 w-4 mr-2" />{t('menu.feedback.send')}</Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {!orderSent && (
        <div className="fixed bottom-4 left-0 right-0 z-40 px-4">
          <div className="max-w-3xl mx-auto flex justify-end">
            <Button className="rounded-full px-5 shadow-lg" onClick={() => setCartOpen(true)}>
              <ShoppingCart className="h-4 w-4 mr-2" /> {t('menu.cart.title')} ({cart.length}) {cart.length > 0 ? `• ${formatFCFA(cartTotal)}` : ''}
            </Button>
          </div>
        </div>
      )}

      <Dialog open={cartOpen} onOpenChange={setCartOpen}>
        <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><ShoppingCart className="h-5 w-5" />{t('menu.cart.order')}</DialogTitle></DialogHeader>
          {cart.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">{t('menu.cart.empty')}</p>
          ) : (
            <div className="space-y-3">
              {cart.map(c => (
                <div key={c.item.id} className="flex justify-between items-center text-sm border rounded-lg p-2">
                  <div className="flex-1 pr-2">
                    <p className="font-medium leading-tight">{c.item.name}</p>
                    <p className="text-xs text-muted-foreground">{formatFCFA(c.item.price)} x {c.quantity}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => updateQuantity(c.item.id, -1)}><Minus className="h-3 w-3" /></Button>
                    <span className="w-6 text-center">{c.quantity}</span>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => updateQuantity(c.item.id, 1)}><Plus className="h-3 w-3" /></Button>
                  </div>
                </div>
              ))}
              <div className="border-t pt-3 flex justify-between font-bold"><span>{t('menu.cart.total')}</span><span>{formatFCFA(cartTotal)}</span></div>
              <Button className="w-full" onClick={() => orderMutation.mutate()} disabled={orderMutation.isPending}>
                <Send className="h-4 w-4 mr-2" />{t('menu.cart.submit')}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <footer className="py-6 text-center text-sm text-muted-foreground"><p>© {new Date().getFullYear()} {hotel.name}</p></footer>
    </div>
  );
};

export default MenuPortalPage;
