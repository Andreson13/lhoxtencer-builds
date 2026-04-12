import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { generateReservationNumber, formatFCFA } from '@/utils/formatters';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Building2, MapPin, Phone, Mail, Calendar, Check, Users, Wifi, Tv, Wind } from 'lucide-react';

const featureIcons: Record<string, any> = { WiFi: Wifi, TV: Tv, AC: Wind };

const BookingPortalPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const [submitted, setSubmitted] = useState(false);
  const [resNumber, setResNumber] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [form, setForm] = useState({
    guest_name: '', guest_phone: '', guest_email: '',
    check_in_date: '', check_out_date: '',
    number_of_adults: 1, number_of_children: 0,
    special_requests: '',
    payment_cash: false, payment_momo: false, payment_om: false,
  });

  const { data: hotel } = useQuery({
    queryKey: ['hotel-public', slug],
    queryFn: async () => {
      const { data } = await supabase.from('hotels').select('*').eq('slug', slug!).single();
      return data;
    },
    enabled: !!slug,
  });

  const { data: categories } = useQuery({
    queryKey: ['room-categories-public', hotel?.id],
    queryFn: async () => {
      const { data } = await supabase.from('room_categories').select('*').eq('hotel_id', hotel!.id).eq('portal_visible', true).order('display_order');
      return data || [];
    },
    enabled: !!hotel?.id,
  });

  // Count available rooms per category
  const { data: roomCounts } = useQuery({
    queryKey: ['room-counts-public', hotel?.id],
    queryFn: async () => {
      const { data } = await supabase.from('rooms').select('category_id, status').eq('hotel_id', hotel!.id);
      const counts: Record<string, number> = {};
      (data || []).forEach(r => {
        if (r.status === 'available' && r.category_id) {
          counts[r.category_id] = (counts[r.category_id] || 0) + 1;
        }
      });
      return counts;
    },
    enabled: !!hotel?.id,
  });

  const { data: services } = useQuery({
    queryKey: ['services-public', hotel?.id],
    queryFn: async () => {
      const { data } = await supabase.from('hotel_services').select('*').eq('hotel_id', hotel!.id);
      return data || [];
    },
    enabled: !!hotel?.id,
  });

  const { data: photos } = useQuery({
    queryKey: ['photos-public', hotel?.id],
    queryFn: async () => {
      const { data } = await supabase.from('hotel_photos').select('*').eq('hotel_id', hotel!.id).order('display_order');
      return data || [];
    },
    enabled: !!hotel?.id,
  });

  const selectedCategory = categories?.find(c => c.id === selectedCategoryId);
  const nights = form.check_in_date && form.check_out_date ? Math.max(1, Math.ceil((new Date(form.check_out_date).getTime() - new Date(form.check_in_date).getTime()) / 86400000)) : 0;
  const total = nights * (selectedCategory?.price_per_night || 0);

  const submitMutation = useMutation({
    mutationFn: async () => {
      const rn = generateReservationNumber();
      const { error } = await supabase.from('reservations').insert({
        hotel_id: hotel!.id, reservation_number: rn,
        guest_name: form.guest_name, guest_phone: form.guest_phone || null, guest_email: form.guest_email || null,
        check_in_date: form.check_in_date, check_out_date: form.check_out_date,
        category_id: selectedCategoryId || null,
        number_of_adults: form.number_of_adults, number_of_children: form.number_of_children,
        number_of_nights: nights, total_price: total, source: 'portal', status: 'pending',
        special_requests: form.special_requests || null,
        payment_method_cash: form.payment_cash, payment_method_momo: form.payment_momo, payment_method_om: form.payment_om,
      } as any);
      if (error) throw error;
      return rn;
    },
    onSuccess: (rn) => { setResNumber(rn); setSubmitted(true); },
    onError: (e: any) => toast.error(e.message),
  });

  if (!hotel) return <div className="min-h-screen flex items-center justify-center bg-background"><p>Chargement...</p></div>;

  if (submitted) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-background">
      <Card className="max-w-md w-full mx-4">
        <CardContent className="pt-8 text-center space-y-4">
          <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mx-auto"><Check className="h-8 w-8 text-green-600" /></div>
          <h2 className="text-2xl font-bold">Réservation envoyée !</h2>
          <p className="text-muted-foreground">Votre numéro de réservation :</p>
          <p className="text-2xl font-mono font-bold text-primary">{resNumber}</p>
          <p className="text-sm text-muted-foreground">L'hôtel vous contactera pour confirmation.</p>
          <Button variant="outline" onClick={() => { setSubmitted(false); setSelectedCategoryId(null); setForm({ guest_name: '', guest_phone: '', guest_email: '', check_in_date: '', check_out_date: '', number_of_adults: 1, number_of_children: 0, special_requests: '', payment_cash: false, payment_momo: false, payment_om: false }); }}>Nouvelle réservation</Button>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-background">
      {/* Hero */}
      <div className="bg-primary text-primary-foreground py-12 px-4">
        <div className="max-w-4xl mx-auto text-center">
          {hotel.logo_url && <img src={hotel.logo_url} alt={hotel.name} className="h-16 mx-auto mb-4 rounded-lg" />}
          <h1 className="text-3xl md:text-4xl font-bold">{hotel.name}</h1>
          <div className="flex items-center justify-center gap-2 mt-2 text-primary-foreground/80"><MapPin className="h-4 w-4" /><span>{hotel.address}, {hotel.city}, {hotel.country}</span></div>
          <div className="flex items-center justify-center gap-6 mt-4 text-sm">
            {hotel.phone && <span className="flex items-center gap-1"><Phone className="h-4 w-4" />{hotel.phone}</span>}
            {hotel.email && <span className="flex items-center gap-1"><Mail className="h-4 w-4" />{hotel.email}</span>}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* Photos */}
        {photos && photos.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {photos.slice(0, 6).map(p => <img key={p.id} src={p.url} alt={p.caption || ''} className="rounded-lg w-full h-48 object-cover" />)}
          </div>
        )}

        {/* Services */}
        {services && services.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Nos services</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {services.map(s => <div key={s.id} className="flex items-center gap-2 text-sm"><Check className="h-4 w-4 text-primary" />{s.name}</div>)}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Categories */}
        <div>
          <h2 className="text-2xl font-bold mb-4">Nos chambres</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {categories?.map(cat => {
              const avail = roomCounts?.[cat.id] || 0;
              return (
                <Card key={cat.id}
                  className={`cursor-pointer transition-all ${selectedCategoryId === cat.id ? 'border-primary ring-2 ring-primary/20' : 'hover:border-primary/50'}`}
                  style={{ borderLeftWidth: 4, borderLeftColor: cat.color || '#6366f1' }}
                  onClick={() => setSelectedCategoryId(cat.id)}>
                  <CardContent className="pt-6 space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-lg font-bold">{cat.name}</h3>
                        {cat.description && <p className="text-sm text-muted-foreground">{cat.description}</p>}
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-primary">{formatFCFA(cat.price_per_night)}</p>
                        <p className="text-xs text-muted-foreground">par nuit</p>
                      </div>
                    </div>
                    {(cat.price_sieste as number) > 0 && <p className="text-sm text-muted-foreground">Sieste: {formatFCFA(cat.price_sieste)}</p>}
                    {(cat as any).breakfast_included && <Badge className="bg-green-600">Petit-déjeuner inclus</Badge>}
                    <div className="flex flex-wrap gap-1">
                      {(cat.features as string[])?.map(f => <Badge key={f} variant="outline" className="text-xs">{f}</Badge>)}
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t">
                      <Badge variant={avail > 0 ? 'outline' : 'destructive'} className="text-xs">
                        {avail > 0 ? `${avail} disponible(s)` : 'Complet'}
                      </Badge>
                      {selectedCategoryId === cat.id && <Check className="h-5 w-5 text-primary" />}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Reservation form */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Calendar className="h-5 w-5" />Réserver maintenant</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><Label>Nom complet *</Label><Input value={form.guest_name} onChange={e => setForm(f => ({ ...f, guest_name: e.target.value }))} /></div>
                <div><Label>Téléphone</Label><Input value={form.guest_phone} onChange={e => setForm(f => ({ ...f, guest_phone: e.target.value }))} /></div>
                <div><Label>Email</Label><Input type="email" value={form.guest_email} onChange={e => setForm(f => ({ ...f, guest_email: e.target.value }))} /></div>
                <div />
                <div><Label>Arrivée *</Label><Input type="date" value={form.check_in_date} onChange={e => setForm(f => ({ ...f, check_in_date: e.target.value }))} min={new Date().toISOString().split('T')[0]} /></div>
                <div><Label>Départ *</Label><Input type="date" value={form.check_out_date} onChange={e => setForm(f => ({ ...f, check_out_date: e.target.value }))} min={form.check_in_date || new Date().toISOString().split('T')[0]} /></div>
                <div><Label>Adultes</Label><Input type="number" value={form.number_of_adults} onChange={e => setForm(f => ({ ...f, number_of_adults: Number(e.target.value) }))} min={1} /></div>
                <div><Label>Enfants</Label><Input type="number" value={form.number_of_children} onChange={e => setForm(f => ({ ...f, number_of_children: Number(e.target.value) }))} min={0} /></div>
              </div>

              <div>
                <Label className="mb-2 block">Préférence de paiement</Label>
                <div className="flex gap-6">
                  <label className="flex items-center gap-2"><Checkbox checked={form.payment_cash} onCheckedChange={v => setForm(f => ({ ...f, payment_cash: !!v }))} /><span>À l'arrivée</span></label>
                  <label className="flex items-center gap-2"><Checkbox checked={form.payment_momo} onCheckedChange={v => setForm(f => ({ ...f, payment_momo: !!v }))} /><span>MTN MoMo</span></label>
                  <label className="flex items-center gap-2"><Checkbox checked={form.payment_om} onCheckedChange={v => setForm(f => ({ ...f, payment_om: !!v }))} /><span>Orange Money</span></label>
                </div>
              </div>

              <div><Label>Demandes spéciales</Label><Textarea value={form.special_requests} onChange={e => setForm(f => ({ ...f, special_requests: e.target.value }))} /></div>

              {nights > 0 && selectedCategory && (
                <div className="bg-muted/50 rounded-lg p-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium">{selectedCategory.name}</p>
                      <p className="text-sm text-muted-foreground">{nights} nuit(s) × {formatFCFA(selectedCategory.price_per_night)}</p>
                    </div>
                    <p className="text-2xl font-bold text-primary">{formatFCFA(total)}</p>
                  </div>
                </div>
              )}

              <Button className="w-full" size="lg" onClick={() => submitMutation.mutate()} disabled={!form.guest_name || !form.check_in_date || !form.check_out_date || !selectedCategoryId || submitMutation.isPending}>
                {submitMutation.isPending ? 'Envoi...' : 'Envoyer la demande de réservation'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <footer className="bg-muted py-6 text-center text-sm text-muted-foreground">
        <p>© {new Date().getFullYear()} {hotel.name}. Propulsé par HôtelManager Pro</p>
      </footer>
    </div>
  );
};

export default BookingPortalPage;
