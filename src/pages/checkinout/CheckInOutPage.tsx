import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useHotel } from '@/contexts/HotelContext';
import { useRoleGuard } from '@/hooks/useRoleGuard';
import { PageHeader } from '@/components/shared/PageHeader';
import { formatFCFA, formatDate } from '@/utils/formatters';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { LogIn, LogOut, Search, User, BedDouble } from 'lucide-react';

const CheckInOutPage = () => {
  useRoleGuard(['admin', 'manager', 'receptionist']);
  const { profile } = useAuth();
  const { hotel } = useHotel();
  const qc = useQueryClient();
  const [searchCheckin, setSearchCheckin] = useState('');
  const [searchCheckout, setSearchCheckout] = useState('');

  const { data: pendingReservations } = useQuery({
    queryKey: ['reservations-checkin', hotel?.id],
    queryFn: async () => {
      const { data } = await supabase.from('reservations').select('*, rooms(room_number)').eq('hotel_id', hotel!.id).in('status', ['confirmed', 'pending']).order('check_in_date');
      return data || [];
    },
    enabled: !!hotel?.id,
  });

  const { data: presentGuests } = useQuery({
    queryKey: ['guests-checkout', hotel?.id],
    queryFn: async () => {
      const { data } = await supabase.from('guests').select('*, rooms(room_number)').eq('hotel_id', hotel!.id).eq('status', 'present').order('check_out_date');
      return data || [];
    },
    enabled: !!hotel?.id,
  });

  const checkinMutation = useMutation({
    mutationFn: async (reservation: any) => {
      // Create guest from reservation
      const { error: guestError } = await supabase.from('guests').insert({
        hotel_id: hotel!.id,
        last_name: reservation.guest_name.split(' ').slice(-1)[0],
        first_name: reservation.guest_name.split(' ').slice(0, -1).join(' ') || reservation.guest_name,
        phone: reservation.guest_phone,
        email: reservation.guest_email,
        room_id: reservation.room_id,
        check_in_date: new Date().toISOString(),
        check_out_date: reservation.check_out_date,
        number_of_nights: reservation.number_of_nights,
        total_price: reservation.total_price,
        status: 'present',
        receptionist_id: profile?.id,
        receptionist_name: profile?.full_name,
      });
      if (guestError) throw guestError;

      // Update reservation status
      await supabase.from('reservations').update({ status: 'checked_in' }).eq('id', reservation.id);
      // Update room status
      if (reservation.room_id) {
        await supabase.from('rooms').update({ status: 'occupied' }).eq('id', reservation.room_id);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reservations-checkin'] });
      qc.invalidateQueries({ queryKey: ['guests-checkout'] });
      qc.invalidateQueries({ queryKey: ['rooms'] });
      toast.success('Check-in effectué avec succès');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const checkoutMutation = useMutation({
    mutationFn: async (guest: any) => {
      await supabase.from('guests').update({ status: 'checked_out', check_out_date: new Date().toISOString() }).eq('id', guest.id);
      if (guest.room_id) {
        await supabase.from('rooms').update({ status: 'housekeeping' }).eq('id', guest.room_id);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['guests-checkout'] });
      qc.invalidateQueries({ queryKey: ['rooms'] });
      toast.success('Check-out effectué avec succès');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const filteredReservations = pendingReservations?.filter(r =>
    !searchCheckin || r.guest_name.toLowerCase().includes(searchCheckin.toLowerCase()) || r.reservation_number.toLowerCase().includes(searchCheckin.toLowerCase())
  ) || [];

  const filteredGuests = presentGuests?.filter(g =>
    !searchCheckout || `${g.last_name} ${g.first_name}`.toLowerCase().includes(searchCheckout.toLowerCase())
  ) || [];

  return (
    <div className="page-container space-y-6">
      <PageHeader title="Check-in / Check-out" subtitle="Gérer les arrivées et départs" />

      <Tabs defaultValue="checkin">
        <TabsList>
          <TabsTrigger value="checkin"><LogIn className="h-4 w-4 mr-2" />Check-in ({filteredReservations.length})</TabsTrigger>
          <TabsTrigger value="checkout"><LogOut className="h-4 w-4 mr-2" />Check-out ({filteredGuests.length})</TabsTrigger>
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
            <Input placeholder="Rechercher par nom..." className="pl-10" value={searchCheckout} onChange={e => setSearchCheckout(e.target.value)} />
          </div>
          {filteredGuests.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">Aucun client présent</CardContent></Card>
          ) : (
            <div className="grid gap-4">
              {filteredGuests.map(g => (
                <Card key={g.id}>
                  <CardContent className="flex items-center justify-between py-4">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center">
                        <User className="h-5 w-5 text-orange-600" />
                      </div>
                      <div>
                        <p className="font-semibold">{g.last_name} {g.first_name}</p>
                        <p className="text-sm text-muted-foreground">{g.phone || '-'} • {g.number_of_nights || 0} nuit(s)</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-sm text-right">
                        <p className="flex items-center gap-1"><BedDouble className="h-3 w-3" />{(g as any).rooms?.room_number || '-'}</p>
                        <p className="text-muted-foreground">{formatFCFA(g.total_price)}</p>
                      </div>
                      <Button variant="destructive" onClick={() => checkoutMutation.mutate(g)} disabled={checkoutMutation.isPending}>
                        <LogOut className="h-4 w-4 mr-2" />Check-out
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CheckInOutPage;
