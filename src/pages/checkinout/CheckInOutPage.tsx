import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useHotel } from '@/contexts/HotelContext';
import { useRoleGuard } from '@/hooks/useRoleGuard';
import { PageHeader } from '@/components/shared/PageHeader';
import { formatFCFA, formatDate, generateInvoiceNumber } from '@/utils/formatters';
import { getOrCreateInvoice, addChargeToInvoice } from '@/services/transactionService';
import { withAudit } from '@/utils/auditLog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { LogIn, LogOut, Search, User, BedDouble, Plus } from 'lucide-react';

const CheckInOutPage = () => {
  useRoleGuard(['admin', 'manager', 'receptionist']);
  const { profile } = useAuth();
  const { hotel } = useHotel();
  const qc = useQueryClient();
  const [searchCheckin, setSearchCheckin] = useState('');
  const [searchCheckout, setSearchCheckout] = useState('');
  const [walkinOpen, setWalkinOpen] = useState(false);
  const [walkinStep, setWalkinStep] = useState(1);
  const [walkinGuestId, setWalkinGuestId] = useState<string | null>(null);
  const [walkinSearch, setWalkinSearch] = useState('');
  const [walkinNewGuest, setWalkinNewGuest] = useState({ last_name: '', first_name: '', phone: '', id_number: '' });
  const [walkinStay, setWalkinStay] = useState({ room_id: '', check_in_date: new Date().toISOString().split('T')[0], check_out_date: '', price_per_night: 0 });

  // Pending reservations for check-in
  const { data: pendingReservations } = useQuery({
    queryKey: ['reservations-checkin', hotel?.id],
    queryFn: async () => {
      const { data } = await supabase.from('reservations').select('*, rooms(room_number)').eq('hotel_id', hotel!.id).in('status', ['confirmed', 'pending']).order('check_in_date');
      return data || [];
    },
    enabled: !!hotel?.id,
  });

  // Active stays for check-out
  const { data: activeStays } = useQuery({
    queryKey: ['active-stays-checkout', hotel?.id],
    queryFn: async () => {
      const { data } = await supabase.from('stays').select('*, guests(last_name, first_name, phone), rooms(room_number)').eq('hotel_id', hotel!.id).eq('status', 'active').order('check_in_date');
      return data || [];
    },
    enabled: !!hotel?.id,
  });

  // Existing guests for walk-in search
  const { data: existingGuests } = useQuery({
    queryKey: ['guests-search', hotel?.id, walkinSearch],
    queryFn: async () => {
      if (!walkinSearch || walkinSearch.length < 2) return [];
      const { data } = await supabase.from('guests').select('id, last_name, first_name, phone, id_number').eq('hotel_id', hotel!.id).or(`last_name.ilike.%${walkinSearch}%,first_name.ilike.%${walkinSearch}%,phone.ilike.%${walkinSearch}%`).limit(10);
      return data || [];
    },
    enabled: !!hotel?.id && walkinSearch.length >= 2,
  });

  const { data: availableRooms } = useQuery({
    queryKey: ['rooms-available-checkin', hotel?.id],
    queryFn: async () => {
      const { data } = await supabase.from('rooms').select('id, room_number, price_per_night').eq('hotel_id', hotel!.id).eq('status', 'available');
      return data || [];
    },
    enabled: !!hotel?.id,
  });

  // Check-in from reservation
  const checkinMutation = useMutation({
    mutationFn: async (reservation: any) => {
      if (!hotel || !profile) throw new Error('Missing context');

      // Find or create guest
      let guestId: string;
      const nameParts = reservation.guest_name.split(' ');
      const lastName = nameParts.slice(-1)[0];
      const firstName = nameParts.slice(0, -1).join(' ') || reservation.guest_name;

      // Check if guest exists
      const { data: existingGuest } = await supabase.from('guests')
        .select('id').eq('hotel_id', hotel.id)
        .ilike('last_name', lastName).ilike('first_name', firstName)
        .limit(1).maybeSingle();

      if (existingGuest) {
        guestId = existingGuest.id;
      } else {
        const { data: newGuest, error: gErr } = await supabase.from('guests').insert({
          hotel_id: hotel.id,
          last_name: lastName,
          first_name: firstName,
          phone: reservation.guest_phone,
          email: reservation.guest_email,
        }).select().single();
        if (gErr) throw gErr;
        guestId = newGuest.id;
      }

      const nights = reservation.number_of_nights || 1;
      const total = reservation.total_price || 0;

      const { data: stay, error: stayErr } = await supabase.from('stays').insert({
        hotel_id: hotel.id,
        guest_id: guestId,
        reservation_id: reservation.id,
        stay_type: 'night',
        room_id: reservation.room_id,
        check_in_date: new Date().toISOString(),
        check_out_date: reservation.check_out_date,
        number_of_nights: nights,
        number_of_adults: reservation.number_of_adults || 1,
        number_of_children: reservation.number_of_children || 0,
        price_per_night: total / Math.max(nights, 1),
        total_price: total,
        status: 'active',
        payment_status: 'pending',
        receptionist_id: profile.id,
        receptionist_name: profile.full_name,
        created_by: profile.id,
        created_by_name: profile.full_name,
      } as any).select().single();
      if (stayErr) throw stayErr;

      const invoice = await getOrCreateInvoice(hotel.id, stay.id, guestId);
      await addChargeToInvoice({
        hotelId: hotel.id,
        invoiceId: invoice.id,
        stayId: stay.id,
        guestId,
        description: `Hébergement — ${nights} nuit(s)`,
        itemType: 'room',
        quantity: nights,
        unitPrice: total / Math.max(nights, 1),
      });

      // Update reservation status
      await supabase.from('reservations').update({ status: 'checked_in' }).eq('id', reservation.id);

      // Safety: update room
      if (reservation.room_id) {
        await supabase.from('rooms').update({ status: 'occupied' }).eq('id', reservation.room_id);
      }

      await withAudit(hotel.id, profile.id, profile.full_name || '', 'check_in', 'stays', stay.id, null, { reservation_id: reservation.id, room_id: reservation.room_id });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reservations-checkin'] });
      qc.invalidateQueries({ queryKey: ['active-stays-checkout'] });
      qc.invalidateQueries({ queryKey: ['rooms'] });
      toast.success('Check-in effectué avec succès');
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Walk-in check-in
  const walkinCheckinMutation = useMutation({
    mutationFn: async () => {
      if (!hotel || !profile) throw new Error('Missing context');
      let guestId = walkinGuestId;

      // Create new guest if needed
      if (!guestId) {
        const { data: newGuest, error } = await supabase.from('guests').insert({
          hotel_id: hotel.id,
          last_name: walkinNewGuest.last_name,
          first_name: walkinNewGuest.first_name,
          phone: walkinNewGuest.phone || null,
          id_number: walkinNewGuest.id_number || null,
        }).select().single();
        if (error) throw error;
        guestId = newGuest.id;
      }

      const room = availableRooms?.find(r => r.id === walkinStay.room_id);
      const ppn = walkinStay.price_per_night || room?.price_per_night || 0;
      const nights = walkinStay.check_out_date ? Math.max(1, Math.ceil((new Date(walkinStay.check_out_date).getTime() - new Date(walkinStay.check_in_date).getTime()) / 86400000)) : 1;
      const total = ppn * nights;

      const { data: stay } = await supabase.from('stays').insert({
        hotel_id: hotel.id,
        guest_id: guestId!,
        stay_type: 'night',
        room_id: walkinStay.room_id,
        check_in_date: new Date(walkinStay.check_in_date).toISOString(),
        check_out_date: walkinStay.check_out_date ? new Date(walkinStay.check_out_date).toISOString() : null,
        number_of_nights: nights,
        price_per_night: ppn,
        total_price: total,
        status: 'active',
        payment_status: 'pending',
        receptionist_id: profile.id,
        receptionist_name: profile.full_name,
        created_by: profile.id,
        created_by_name: profile.full_name,
      } as any).select().single();

      const invoice = await getOrCreateInvoice(hotel.id, stay?.id, guestId!);
      await addChargeToInvoice({
        hotelId: hotel.id,
        invoiceId: invoice.id,
        stayId: stay?.id,
        guestId: guestId!,
        description: `Hébergement — ${nights} nuit(s)`,
        itemType: 'room',
        quantity: nights,
        unitPrice: ppn,
      });

      await supabase.from('rooms').update({ status: 'occupied' }).eq('id', walkinStay.room_id);
      await withAudit(hotel.id, profile.id, profile.full_name || '', 'walkin_check_in', 'stays', stay?.id, null, { guest_id: guestId, room_id: walkinStay.room_id });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['active-stays-checkout'] });
      qc.invalidateQueries({ queryKey: ['rooms'] });
      toast.success('Check-in walk-in effectué');
      setWalkinOpen(false);
      setWalkinStep(1);
      setWalkinGuestId(null);
      setWalkinNewGuest({ last_name: '', first_name: '', phone: '', id_number: '' });
      setWalkinStay({ room_id: '', check_in_date: new Date().toISOString().split('T')[0], check_out_date: '', price_per_night: 0 });
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Check-out
  const checkoutMutation = useMutation({
    mutationFn: async (stay: any) => {
      if (!hotel || !profile) throw new Error('Missing context');

      let invoice: any = null;
      if (stay.invoice_id) {
        const { data } = await supabase
          .from('invoices')
          .select('id, guest_id, balance_due')
          .eq('id', stay.invoice_id)
          .maybeSingle();
        invoice = data;
      }

      await supabase.from('stays').update({
        status: 'checked_out',
        actual_check_out: new Date().toISOString(),
        payment_status: invoice?.balance_due <= 0 ? 'paid' : invoice?.balance_due > 0 ? 'partial' : 'pending',
      }).eq('id', stay.id);

      // Room goes to housekeeping via trigger, but safety:
      if (stay.room_id) {
        await supabase.from('rooms').update({ status: 'housekeeping' }).eq('id', stay.room_id);
      }

      if (stay.room_id) {
        await supabase.from('housekeeping_tasks').insert({ hotel_id: hotel.id, room_id: stay.room_id } as any);
      }

      const today = new Date().toISOString().split('T')[0];
      await supabase
        .from('main_courante')
        .update({ observation: 'DÉPART' } as any)
        .eq('hotel_id', hotel.id)
        .eq('journee', today)
        .eq('guest_id', stay.guest_id);

      if (invoice?.balance_due > 0) {
        await supabase.from('debts').upsert({
          hotel_id: hotel.id,
          guest_id: stay.guest_id,
          invoice_id: stay.invoice_id,
          amount_due: invoice.balance_due,
          checkout_date: new Date().toISOString(),
        } as any);
      }

      await withAudit(hotel.id, profile.id, profile.full_name || '', 'check_out', 'stays', stay.id, { status: 'active' }, { status: 'checked_out' });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['active-stays-checkout'] });
      qc.invalidateQueries({ queryKey: ['rooms'] });
      toast.success('Check-out effectué avec succès');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const filteredReservations = pendingReservations?.filter(r =>
    !searchCheckin || r.guest_name.toLowerCase().includes(searchCheckin.toLowerCase()) || r.reservation_number.toLowerCase().includes(searchCheckin.toLowerCase())
  ) || [];

  const filteredStays = activeStays?.filter(s => {
    if (!searchCheckout) return true;
    const guest = (s as any).guests;
    const room = (s as any).rooms;
    const q = searchCheckout.toLowerCase();
    return (guest && `${guest.last_name} ${guest.first_name}`.toLowerCase().includes(q)) || (room?.room_number?.toLowerCase().includes(q));
  }) || [];

  return (
    <div className="page-container space-y-6">
      <PageHeader title="Check-in / Check-out" subtitle="Gérer les arrivées et départs">
        <Button onClick={() => { setWalkinOpen(true); setWalkinStep(1); }}><Plus className="h-4 w-4 mr-2" />Walk-in (sans réservation)</Button>
      </PageHeader>

      <Tabs defaultValue="checkin">
        <TabsList>
          <TabsTrigger value="checkin"><LogIn className="h-4 w-4 mr-2" />Check-in ({filteredReservations.length})</TabsTrigger>
          <TabsTrigger value="checkout"><LogOut className="h-4 w-4 mr-2" />Check-out ({filteredStays.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="checkin" className="mt-4 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Rechercher par nom ou n° réservation..." className="pl-10" value={searchCheckin} onChange={e => setSearchCheckin(e.target.value)} />
          </div>
          {filteredReservations.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">Aucune réservation en attente de check-in</CardContent></Card>
          ) : (
            <div className="grid gap-4">
              {filteredReservations.map(r => (
                <Card key={r.id}>
                  <CardContent className="flex items-center justify-between py-4">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold">{r.guest_name}</p>
                        <p className="text-sm text-muted-foreground">Résa: {r.reservation_number} • {r.guest_phone || '-'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-sm text-right">
                        <p className="flex items-center gap-1"><BedDouble className="h-3 w-3" />{(r as any).rooms?.room_number || 'Non assignée'}</p>
                        <p className="text-muted-foreground">{formatDate(r.check_in_date)} → {formatDate(r.check_out_date)}</p>
                      </div>
                      <Badge variant="outline">{formatFCFA(r.total_price)}</Badge>
                      <Button onClick={() => checkinMutation.mutate(r)} disabled={checkinMutation.isPending || !r.room_id}>
                        <LogIn className="h-4 w-4 mr-2" />Check-in
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="checkout" className="mt-4 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Rechercher par nom ou n° chambre..." className="pl-10" value={searchCheckout} onChange={e => setSearchCheckout(e.target.value)} />
          </div>
          {filteredStays.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">Aucun séjour actif</CardContent></Card>
          ) : (
            <div className="grid gap-4">
              {filteredStays.map(s => {
                const guest = (s as any).guests;
                const room = (s as any).rooms;
                return (
                  <Card key={s.id}>
                    <CardContent className="flex items-center justify-between py-4">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center">
                          <User className="h-5 w-5 text-orange-600" />
                        </div>
                        <div>
                          <p className="font-semibold">{guest?.last_name} {guest?.first_name}</p>
                          <p className="text-sm text-muted-foreground">{guest?.phone || '-'} • {s.number_of_nights || 0} nuit(s)</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-sm text-right">
                          <p className="flex items-center gap-1"><BedDouble className="h-3 w-3" />{room?.room_number || '-'}</p>
                          <p className="text-muted-foreground">{formatFCFA(s.total_price)}</p>
                        </div>
                        <Button variant="destructive" onClick={() => checkoutMutation.mutate(s)} disabled={checkoutMutation.isPending}>
                          <LogOut className="h-4 w-4 mr-2" />Check-out
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Walk-in Dialog */}
      <Dialog open={walkinOpen} onOpenChange={setWalkinOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Check-in Walk-in — Étape {walkinStep}/2</DialogTitle>
            <DialogDescription>{walkinStep === 1 ? 'Identifiez le client' : 'Détails du séjour'}</DialogDescription>
          </DialogHeader>

          {walkinStep === 1 && (
            <div className="space-y-4">
              <div>
                <Label>Rechercher un client existant</Label>
                <Input placeholder="Nom, téléphone..." value={walkinSearch} onChange={e => { setWalkinSearch(e.target.value); setWalkinGuestId(null); }} />
              </div>
              {existingGuests && existingGuests.length > 0 && (
                <div className="border rounded-md max-h-40 overflow-y-auto">
                  {existingGuests.map(g => (
                    <button key={g.id} onClick={() => { setWalkinGuestId(g.id); setWalkinSearch(`${g.last_name} ${g.first_name}`); }}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-muted ${walkinGuestId === g.id ? 'bg-primary/10' : ''}`}>
                      {g.last_name} {g.first_name} — {g.phone || g.id_number || ''}
                    </button>
                  ))}
                </div>
              )}
              {!walkinGuestId && (
                <div className="border-t pt-4 space-y-3">
                  <p className="text-sm font-medium">Ou créer un nouveau client :</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Nom *</Label><Input value={walkinNewGuest.last_name} onChange={e => setWalkinNewGuest(p => ({ ...p, last_name: e.target.value }))} /></div>
                    <div><Label>Prénom *</Label><Input value={walkinNewGuest.first_name} onChange={e => setWalkinNewGuest(p => ({ ...p, first_name: e.target.value }))} /></div>
                    <div><Label>Téléphone</Label><Input value={walkinNewGuest.phone} onChange={e => setWalkinNewGuest(p => ({ ...p, phone: e.target.value }))} /></div>
                    <div><Label>N° ID</Label><Input value={walkinNewGuest.id_number} onChange={e => setWalkinNewGuest(p => ({ ...p, id_number: e.target.value }))} /></div>
                  </div>
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setWalkinOpen(false)}>Annuler</Button>
                <Button onClick={() => setWalkinStep(2)} disabled={!walkinGuestId && (!walkinNewGuest.last_name || !walkinNewGuest.first_name)}>Suivant</Button>
              </DialogFooter>
            </div>
          )}

          {walkinStep === 2 && (
            <div className="space-y-4">
              <div>
                <Label>Chambre *</Label>
                <Select onValueChange={v => {
                  setWalkinStay(p => ({ ...p, room_id: v }));
                  const room = availableRooms?.find(r => r.id === v);
                  if (room) setWalkinStay(p => ({ ...p, price_per_night: room.price_per_night }));
                }}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                  <SelectContent>
                    {availableRooms?.map(r => <SelectItem key={r.id} value={r.id}>{r.room_number} — {formatFCFA(r.price_per_night)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Arrivée</Label><Input type="date" value={walkinStay.check_in_date} onChange={e => setWalkinStay(p => ({ ...p, check_in_date: e.target.value }))} /></div>
                <div><Label>Départ</Label><Input type="date" value={walkinStay.check_out_date} onChange={e => setWalkinStay(p => ({ ...p, check_out_date: e.target.value }))} /></div>
              </div>
              <div><Label>Prix/nuit</Label><Input type="number" value={walkinStay.price_per_night} onChange={e => setWalkinStay(p => ({ ...p, price_per_night: Number(e.target.value) }))} /></div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setWalkinStep(1)}>Retour</Button>
                <Button onClick={() => walkinCheckinMutation.mutate()} disabled={!walkinStay.room_id || walkinCheckinMutation.isPending}>Effectuer le check-in</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CheckInOutPage;
