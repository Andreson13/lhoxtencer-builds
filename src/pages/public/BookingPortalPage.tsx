import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { generateReservationNumber, formatFCFA } from '@/utils/formatters';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Building2, Wifi, Car, Coffee, MapPin, Phone, Mail, Calendar, Users, Check } from 'lucide-react';

const BookingPortalPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    guest_name: '', guest_phone: '', guest_email: '',
    check_in_date: '', check_out_date: '',
    room_type_id: '', number_of_adults: 1, number_of_children: 0,
    special_requests: '',
  });

  const { data: hotel } = useQuery({
    queryKey: ['hotel-public', slug],
    queryFn: async () => {
      const { data } = await supabase.from('hotels').select('*').eq('slug', slug!).single();
      return data;
    },
    enabled: !!slug,
  });

  const { data: roomTypes } = useQuery({
    queryKey: ['room-types-public', hotel?.id],
    queryFn: async () => {
      const { data } = await supabase.from('room_types').select('*').eq('hotel_id', hotel!.id).order('base_price');
      return data || [];
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

  const nights = form.check_in_date && form.check_out_date ? Math.max(1, Math.ceil((new Date(form.check_out_date).getTime() - new Date(form.check_in_date).getTime()) / 86400000)) : 0;
  const selectedType = roomTypes?.find(t => t.id === form.room_type_id);
  const total = nights * (selectedType?.base_price || 0);

  const submitMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('reservations').insert({
        hotel_id: hotel!.id,
        reservation_number: generateReservationNumber(),
        guest_name: form.guest_name,
        guest_phone: form.guest_phone || null,
        guest_email: form.guest_email || null,
        check_in_date: form.check_in_date,
        check_out_date: form.check_out_date,
        room_type_id: form.room_type_id || null,
        number_of_adults: form.number_of_adults,
        number_of_children: form.number_of_children,
        number_of_nights: nights,
        total_price: total,
        source: 'portal',
        special_requests: form.special_requests || null,
        status: 'pending',
      });
      if (error) throw error;
    },
    onSuccess: () => setSubmitted(true),
    onError: (e: any) => toast.error(e.message),
  });

  if (!hotel) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <p className="text-muted-foreground">Chargement...</p>
    </div>
  );

  if (submitted) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-background">
      <Card className="max-w-md w-full mx-4">
        <CardContent className="pt-8 text-center space-y-4">
          <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
            <Check className="h-8 w-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold">Réservation envoyée !</h2>
          <p className="text-muted-foreground">Votre demande de réservation a été reçue. L'hôtel vous contactera pour confirmation.</p>
          <Button variant="outline" onClick={() => { setSubmitted(false); setForm({ guest_name: '', guest_phone: '', guest_email: '', check_in_date: '', check_out_date: '', room_type_id: '', number_of_adults: 1, number_of_children: 0, special_requests: '' }); }}>
            Nouvelle réservation
          </Button>
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
          <div className="flex items-center justify-center gap-2 mt-2 text-primary-foreground/80">
            <MapPin className="h-4 w-4" />
            <span>{hotel.address}, {hotel.city}, {hotel.country}</span>
          </div>
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
            {photos.slice(0, 6).map(p => (
              <img key={p.id} src={p.url} alt={p.caption || ''} className="rounded-lg w-full h-48 object-cover" />
            ))}
          </div>
        )}

        {/* Services */}
        {services && services.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Nos services</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {services.map(s => (
                  <div key={s.id} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-primary" />
                    <span>{s.name}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Room types */}
        {roomTypes && roomTypes.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Types de chambres</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {roomTypes.map(rt => (
                  <div key={rt.id} className={`border rounded-lg p-4 cursor-pointer transition-all ${form.room_type_id === rt.id ? 'border-primary bg-primary/5' : 'hover:border-primary/50'}`}
                    onClick={() => setForm(f => ({ ...f, room_type_id: rt.id }))}>
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold">{rt.name}</h3>
                        {rt.description && <p className="text-sm text-muted-foreground mt-1">{rt.description}</p>}
                      </div>
                      <Badge variant="outline" className="text-lg">{formatFCFA(rt.base_price)}/nuit</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Reservation form */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Calendar className="h-5 w-5" />Réserver maintenant</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><Label>Nom complet *</Label><Input value={form.guest_name} onChange={e => setForm(f => ({ ...f, guest_name: e.target.value }))} /></div>
                <div><Label>Téléphone</Label><Input value={form.guest_phone} onChange={e => setForm(f => ({ ...f, guest_phone: e.target.value }))} /></div>
                <div><Label>Email</Label><Input type="email" value={form.guest_email} onChange={e => setForm(f => ({ ...f, guest_email: e.target.value }))} /></div>
                <div><Label>Type de chambre</Label>
                  <Select value={form.room_type_id} onValueChange={v => setForm(f => ({ ...f, room_type_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                    <SelectContent>{roomTypes?.map(t => <SelectItem key={t.id} value={t.id}>{t.name} — {formatFCFA(t.base_price)}/nuit</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Arrivée *</Label><Input type="date" value={form.check_in_date} onChange={e => setForm(f => ({ ...f, check_in_date: e.target.value }))} min={new Date().toISOString().split('T')[0]} /></div>
                <div><Label>Départ *</Label><Input type="date" value={form.check_out_date} onChange={e => setForm(f => ({ ...f, check_out_date: e.target.value }))} min={form.check_in_date || new Date().toISOString().split('T')[0]} /></div>
                <div><Label>Adultes</Label><Input type="number" value={form.number_of_adults} onChange={e => setForm(f => ({ ...f, number_of_adults: Number(e.target.value) }))} min={1} /></div>
                <div><Label>Enfants</Label><Input type="number" value={form.number_of_children} onChange={e => setForm(f => ({ ...f, number_of_children: Number(e.target.value) }))} min={0} /></div>
              </div>
              <div><Label>Demandes spéciales</Label><Textarea value={form.special_requests} onChange={e => setForm(f => ({ ...f, special_requests: e.target.value }))} /></div>

              {nights > 0 && selectedType && (
                <div className="bg-muted/50 rounded-lg p-4">
                  <div className="flex justify-between text-sm">
                    <span>{nights} nuit(s) × {formatFCFA(selectedType.base_price)}</span>
                    <span className="text-xl font-bold">{formatFCFA(total)}</span>
                  </div>
                </div>
              )}

              <Button className="w-full" size="lg" onClick={() => submitMutation.mutate()} disabled={!form.guest_name || !form.check_in_date || !form.check_out_date || submitMutation.isPending}>
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
