import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useHotel } from '@/contexts/HotelContext';
import { useRoleGuard } from '@/hooks/useRoleGuard';
import { useI18n } from '@/contexts/I18nContext';
import { PageHeader } from '@/components/shared/PageHeader';
import { formatFCFA, formatDate, generateInvoiceNumber } from '@/utils/formatters';
import { generateCustomerDossier } from '@/utils/pdfGenerators';
import { fetchCustomerDossierData } from '@/services/guestDocumentService';
import { getOrCreateInvoice, addChargeToInvoice, isSiesteInvoiceItem } from '@/services/transactionService';
import { enqueueOfflineSubmission } from '@/services/offlineSubmissionQueue';
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
import { LogIn, LogOut, Search, User, BedDouble, Plus, Download } from 'lucide-react';

const CheckInOutPage = () => {
  useRoleGuard(['admin', 'manager', 'receptionist']);
  const { t } = useI18n();
  const { profile } = useAuth();
  const { hotel } = useHotel();
  const qc = useQueryClient();
  const [searchParams] = useSearchParams();
  const [searchCheckin, setSearchCheckin] = useState('');
  const [searchCheckout, setSearchCheckout] = useState('');
  const [activeTab, setActiveTab] = useState('checkin');
  const [walkinOpen, setWalkinOpen] = useState(false);
  const [walkinStep, setWalkinStep] = useState(1);
  const [walkinGuestId, setWalkinGuestId] = useState<string | null>(null);
  const [walkinSearch, setWalkinSearch] = useState('');
  const [walkinNewGuest, setWalkinNewGuest] = useState({ last_name: '', first_name: '', phone: '', id_number: '' });
  const [walkinStay, setWalkinStay] = useState({ room_id: '', check_in_date: new Date().toISOString().split('T')[0], check_out_date: '', price_per_night: 0 });
  const [checkoutConfirmOpen, setCheckoutConfirmOpen] = useState(false);
  const [checkoutStay, setCheckoutStay] = useState<any>(null);

  const isNetworkIssue = (error: any) => {
    const message = String(error?.message || error || '').toLowerCase();
    return message.includes('fetch') || message.includes('network') || message.includes('offline') || message.includes('timeout');
  };

  const getLiveStayUnits = (stay: any) => {
    const start = new Date(stay.check_in_date);
    const end = stay.actual_check_out ? new Date(stay.actual_check_out) : new Date();
    if (stay.stay_type === 'sieste') {
      return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 3600000));
    }
    return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000));
  };

  const getLiveEstimatedTotal = (stay: any) => {
    const negotiatedTotal = Number(stay.arrangement_price || 0);
    const configuredUnits = stay.stay_type === 'sieste'
      ? 1
      : Math.max(1, Number(stay.number_of_nights || 1));
    const unitPrice = negotiatedTotal > 0
      ? negotiatedTotal / configuredUnits
      : Number(stay.price_per_night || 0);
    return getLiveStayUnits(stay) * unitPrice;
  };

  useEffect(() => {
    const mode = searchParams.get('mode');
    const reservationId = searchParams.get('reservationId');
    const stayId = searchParams.get('stayId');

    if (mode === 'checkout' || stayId) setActiveTab('checkout');
    if (reservationId) {
      setActiveTab('checkin');
      setSearchCheckin(reservationId);
    }
    if (stayId) setSearchCheckout(stayId);
  }, [searchParams]);

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

      try {
        const { data: existingStay } = await supabase
          .from('stays')
          .select('id')
          .eq('hotel_id', hotel.id)
          .eq('reservation_id', reservation.id)
          .eq('status', 'active')
          .maybeSingle();
        if (existingStay?.id) {
          return { queued: false, duplicate: true };
        }

        // Find or create guest
        let guestId: string;
        if (reservation.guest_id) {
          guestId = reservation.guest_id;
        } else {
          const nameParts = reservation.guest_name.split(' ');
          const lastName = nameParts.slice(-1)[0];
          const firstName = nameParts.slice(0, -1).join(' ') || reservation.guest_name;

          // Check by phone first (stronger), then by name
          let existingGuest: any = null;
          if (reservation.guest_phone) {
            const { data } = await supabase.from('guests')
              .select('id')
              .eq('hotel_id', hotel.id)
              .eq('phone', reservation.guest_phone)
              .limit(1)
              .maybeSingle();
            existingGuest = data;
          }
          if (!existingGuest) {
            const { data } = await supabase.from('guests')
              .select('id').eq('hotel_id', hotel.id)
              .ilike('last_name', lastName).ilike('first_name', firstName)
              .limit(1).maybeSingle();
            existingGuest = data;
          }

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
        return { queued: false, duplicate: false };
      } catch (error) {
        if (isNetworkIssue(error)) {
          enqueueOfflineSubmission({
            type: 'checkin-reservation',
            createdAt: new Date().toISOString(),
            payload: {
              hotelId: hotel.id,
              profile: { id: profile.id, full_name: profile.full_name || '' },
              reservation,
            },
          });
          return { queued: true, duplicate: false };
        }
        throw error;
      }
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['reservations-checkin'] });
      qc.invalidateQueries({ queryKey: ['active-stays-checkout'] });
      qc.invalidateQueries({ queryKey: ['rooms'] });
      if (result?.duplicate) {
        toast.info('Cette reservation est deja enregistree en check-in.');
      } else if (result?.queued) {
        toast.success('Check-in mis en file locale. Synchronisation en attente du reseau.');
      } else {
        toast.success(t('checkinout.checkin.success'));
      }
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Walk-in check-in
  const walkinCheckinMutation = useMutation({
    mutationFn: async () => {
      if (!hotel || !profile) throw new Error('Missing context');

      try {
        let guestId = walkinGuestId;

        // Reuse guest before creating a new one
        if (!guestId && walkinNewGuest.phone) {
          const { data: byPhone } = await supabase
            .from('guests')
            .select('id')
            .eq('hotel_id', hotel.id)
            .eq('phone', walkinNewGuest.phone)
            .maybeSingle();
          if (byPhone?.id) guestId = byPhone.id;
        }

        if (!guestId && walkinNewGuest.id_number) {
          const { data: byIdCard } = await supabase
            .from('guests')
            .select('id')
            .eq('hotel_id', hotel.id)
            .eq('id_number', walkinNewGuest.id_number)
            .maybeSingle();
          if (byIdCard?.id) guestId = byIdCard.id;
        }

        if (!guestId && walkinNewGuest.last_name && walkinNewGuest.first_name) {
          const { data: byName } = await supabase
            .from('guests')
            .select('id')
            .eq('hotel_id', hotel.id)
            .ilike('last_name', walkinNewGuest.last_name)
            .ilike('first_name', walkinNewGuest.first_name)
            .maybeSingle();
          if (byName?.id) guestId = byName.id;
        }

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

        const { data: existingStay } = await supabase
          .from('stays')
          .select('id')
          .eq('hotel_id', hotel.id)
          .eq('room_id', walkinStay.room_id)
          .eq('guest_id', guestId!)
          .eq('status', 'active')
          .maybeSingle();
        if (existingStay?.id) {
          return { queued: false, duplicate: true };
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
        return { queued: false, duplicate: false };
      } catch (error) {
        if (isNetworkIssue(error)) {
          enqueueOfflineSubmission({
            type: 'walkin-checkin',
            createdAt: new Date().toISOString(),
            payload: {
              hotelId: hotel.id,
              profile: { id: profile.id, full_name: profile.full_name || '' },
              walkinGuestId,
              walkinNewGuest: {
                last_name: walkinNewGuest.last_name,
                first_name: walkinNewGuest.first_name,
                phone: walkinNewGuest.phone || '',
                id_number: walkinNewGuest.id_number || '',
              },
              walkinStay: {
                room_id: walkinStay.room_id,
                check_in_date: walkinStay.check_in_date,
                check_out_date: walkinStay.check_out_date || '',
                price_per_night: Number(walkinStay.price_per_night || 0),
              },
            },
          });
          return { queued: true, duplicate: false };
        }
        throw error;
      }
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['active-stays-checkout'] });
      qc.invalidateQueries({ queryKey: ['rooms'] });
      if (result?.duplicate) {
        toast.info('Ce client est deja enregistre dans cette chambre.');
      } else if (result?.queued) {
        toast.success('Check-in walk-in mis en file locale. Synchronisation en attente du reseau.');
      } else {
        toast.success(t('checkinout.walkin.success'));
      }
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

      try {
        if (stay.status === 'checked_out') {
          return { queued: false, noop: true };
        }

        let invoice: any = null;
        if (stay.invoice_id) {
          const { data } = await supabase
            .from('invoices')
            .select('id, guest_id, balance_due, total_amount, amount_paid, invoice_items(item_type, description, quantity, unit_price, subtotal)')
            .eq('id', stay.invoice_id)
            .maybeSingle();
          invoice = data;
        }

        const liveUnits = getLiveStayUnits(stay);
        const storedUnits = Number(stay.number_of_nights || 0);
        const negotiatedTotal = Number(stay.arrangement_price || 0);
        const configuredUnits = stay.stay_type === 'sieste'
          ? 1
          : Math.max(1, Number(stay.number_of_nights || 1));
        const unitPrice = negotiatedTotal > 0
          ? negotiatedTotal / configuredUnits
          : Number(stay.price_per_night || 0);
        const alreadyBilledUnits = (invoice?.invoice_items || [])
          .filter((item: any) => stay.stay_type === 'sieste' ? isSiesteInvoiceItem(item) : item.item_type === 'room')
          .reduce((sum: number, item: any) => sum + Number(item.quantity || 0), 0);
        const missingUnits = Math.max(0, liveUnits - Math.max(storedUnits, alreadyBilledUnits));

        if (missingUnits > 0 && stay.invoice_id) {
          await addChargeToInvoice({
            hotelId: hotel.id,
            invoiceId: stay.invoice_id,
            stayId: stay.id,
            guestId: stay.guest_id,
            description: stay.stay_type === 'sieste' ? `Extension sieste - ${missingUnits}h` : `Nuitees additionnelles - ${missingUnits} nuit(s)`,
            itemType: (stay.stay_type === 'sieste' ? 'sieste' : 'room') as any,
            quantity: missingUnits,
            unitPrice,
          });
        }

        await supabase.from('stays').update({
          status: 'checked_out',
          actual_check_out: new Date().toISOString(),
          number_of_nights: stay.stay_type === 'sieste' ? stay.number_of_nights : liveUnits,
          total_price: getLiveEstimatedTotal(stay),
          payment_status: (invoice?.balance_due <= 0 ? 'paid' : invoice?.balance_due > 0 ? 'partial' : 'pending') as any,
        } as any).eq('id', stay.id);

        if (stay.room_id) {
          await supabase.from('rooms').update({ status: 'housekeeping' }).eq('id', stay.room_id);

          const { data: existingTask } = await supabase
            .from('housekeeping_tasks')
            .select('id')
            .eq('hotel_id', hotel.id)
            .eq('room_id', stay.room_id)
            .eq('status', 'pending')
            .maybeSingle();

          if (!existingTask?.id) {
            await supabase.from('housekeeping_tasks').insert({ hotel_id: hotel.id, room_id: stay.room_id } as any);
          }
        }

        const today = new Date().toISOString().split('T')[0];
        await supabase
          .from('main_courante')
          .update({ observation: 'DÉPART' } as any)
          .eq('hotel_id', hotel.id)
          .eq('journee', today)
          .eq('guest_id', stay.guest_id);

        await withAudit(hotel.id, profile.id, profile.full_name || '', 'check_out', 'stays', stay.id, { status: 'active' }, { status: 'checked_out' });
        return { queued: false, noop: false };
      } catch (error) {
        if (isNetworkIssue(error)) {
          enqueueOfflineSubmission({
            type: 'checkout-stay',
            createdAt: new Date().toISOString(),
            payload: {
              hotelId: hotel.id,
              stayId: stay.id,
              guestId: stay.guest_id,
              roomId: stay.room_id,
              invoiceId: stay.invoice_id,
              stayType: stay.stay_type,
              storedUnits: Number(stay.number_of_nights || 0),
              unitPrice: Number(stay.arrangement_price || 0) > 0
                ? Number(stay.arrangement_price || 0) / Math.max(1, Number(stay.number_of_nights || 1))
                : Number(stay.price_per_night || 0),
            },
          });
          return { queued: true, noop: false };
        }
        throw error;
      }
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['active-stays-checkout'] });
      qc.invalidateQueries({ queryKey: ['rooms'] });
      if (result?.noop) {
        toast.info('Ce sejour est deja cloture.');
      } else if (result?.queued) {
        toast.success('Check-out mis en file locale. Synchronisation en attente du reseau.');
      } else {
        toast.success(t('checkinout.checkout.success'));
      }
    },
    onError: (e: any) => toast.error(e.message),
  });

  const filteredReservations = pendingReservations?.filter(r =>
    !searchCheckin ||
    r.id === searchCheckin ||
    r.guest_name.toLowerCase().includes(searchCheckin.toLowerCase()) ||
    r.reservation_number.toLowerCase().includes(searchCheckin.toLowerCase())
  ) || [];

  const filteredStays = activeStays?.filter(s => {
    if (!searchCheckout) return true;
    const guest = (s as any).guests;
    const room = (s as any).rooms;
    const q = searchCheckout.toLowerCase();
    return s.id === searchCheckout || (guest && `${guest.last_name} ${guest.first_name}`.toLowerCase().includes(q)) || (room?.room_number?.toLowerCase().includes(q));
  }) || [];

  const dashboardCards = [
    { label: t('checkinout.kpi.pending'), value: filteredReservations.length, icon: LogIn, tone: 'text-primary bg-primary/10' },
    { label: t('checkinout.kpi.active'), value: filteredStays.length, icon: LogOut, tone: 'text-orange-600 bg-orange-100' },
    { label: t('checkinout.kpi.available'), value: availableRooms?.length || 0, icon: BedDouble, tone: 'text-emerald-600 bg-emerald-100' },
  ];

  return (
    <div className="page-container space-y-6">
      <PageHeader title={t('checkinout.title')} subtitle={t('checkinout.subtitle')}>
        <Button onClick={() => { setWalkinOpen(true); setWalkinStep(1); }}><Plus className="h-4 w-4 mr-2" />{t('checkinout.walkin')}</Button>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-3">
        {dashboardCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.label} className="shadow-sm border-border/60">
              <CardContent className="pt-6 flex items-center gap-4">
                <div className={`h-11 w-11 rounded-2xl flex items-center justify-center ${card.tone}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{card.label}</p>
                  <p className="text-2xl font-semibold">{card.value}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 rounded-2xl bg-muted/70 p-1 h-auto">
          <TabsTrigger value="checkin" className="rounded-xl"><LogIn className="h-4 w-4 mr-2" />{t('checkinout.tabs.checkin')} ({filteredReservations.length})</TabsTrigger>
          <TabsTrigger value="checkout" className="rounded-xl"><LogOut className="h-4 w-4 mr-2" />{t('checkinout.tabs.checkout')} ({filteredStays.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="checkin" className="mt-4 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder={t('checkinout.search.checkin')} className="pl-10" value={searchCheckin} onChange={e => setSearchCheckin(e.target.value)} />
          </div>
          {filteredReservations.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">{t('checkinout.empty.checkin')}</CardContent></Card>
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
                        <p className="flex items-center gap-1"><BedDouble className="h-3 w-3" />{(r as any).rooms?.room_number || t('common.notAssigned')}</p>
                        <p className="text-muted-foreground">{formatDate(r.check_in_date)} → {formatDate(r.check_out_date)}</p>
                      </div>
                      <Badge variant="outline">{formatFCFA(r.total_price)}</Badge>
                      <Button onClick={() => checkinMutation.mutate(r)} disabled={checkinMutation.isPending || !r.room_id}>
                        <LogIn className="h-4 w-4 mr-2" />{t('checkinout.tabs.checkin')}
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
            <Input placeholder={t('checkinout.search.checkout')} className="pl-10" value={searchCheckout} onChange={e => setSearchCheckout(e.target.value)} />
          </div>
          {filteredStays.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">{t('checkinout.empty.checkout')}</CardContent></Card>
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
                          <p className="text-sm text-muted-foreground">{guest?.phone || '-'} • {getLiveStayUnits(s)} {s.stay_type === 'sieste' ? 'h' : 'nuit(s)'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-sm text-right">
                          <p className="flex items-center gap-1"><BedDouble className="h-3 w-3" />{room?.room_number || '-'}</p>
                          <p className="text-muted-foreground">{formatFCFA(getLiveEstimatedTotal(s))}</p>
                        </div>
                        <Button variant="destructive" onClick={() => { setCheckoutStay(s); setCheckoutConfirmOpen(true); }} disabled={checkoutMutation.isPending}>
                          <LogOut className="h-4 w-4 mr-2" />{t('checkinout.tabs.checkout')}
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
            <DialogTitle>{t('checkinout.walkin.title')} — {t('common.step')} {walkinStep}/2</DialogTitle>
            <DialogDescription>{walkinStep === 1 ? t('checkinout.walkin.identify') : t('checkinout.walkin.details')}</DialogDescription>
          </DialogHeader>

          {walkinStep === 1 && (
            <div className="space-y-4">
              <div>
                <Label>{t('checkinout.walkin.searchGuest')}</Label>
                <Input placeholder={t('checkinout.walkin.searchPlaceholder')} value={walkinSearch} onChange={e => { setWalkinSearch(e.target.value); setWalkinGuestId(null); }} />
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
                  <p className="text-sm font-medium">{t('checkinout.walkin.newGuest')}</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Nom *</Label><Input value={walkinNewGuest.last_name} onChange={e => setWalkinNewGuest(p => ({ ...p, last_name: e.target.value }))} /></div>
                    <div><Label>Prénom *</Label><Input value={walkinNewGuest.first_name} onChange={e => setWalkinNewGuest(p => ({ ...p, first_name: e.target.value }))} /></div>
                    <div><Label>{t('settings.hotel.phone')}</Label><Input value={walkinNewGuest.phone} onChange={e => setWalkinNewGuest(p => ({ ...p, phone: e.target.value }))} /></div>
                    <div><Label>N° ID</Label><Input value={walkinNewGuest.id_number} onChange={e => setWalkinNewGuest(p => ({ ...p, id_number: e.target.value }))} /></div>
                  </div>
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setWalkinOpen(false)}>{t('common.cancel')}</Button>
                <Button onClick={() => setWalkinStep(2)} disabled={!walkinGuestId && (!walkinNewGuest.last_name || !walkinNewGuest.first_name)}>{t('common.next')}</Button>
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
                <Button variant="outline" onClick={() => setWalkinStep(1)}>{t('common.back')}</Button>
                <Button onClick={() => walkinCheckinMutation.mutate()} disabled={!walkinStay.room_id || walkinCheckinMutation.isPending}>{t('checkinout.walkin.perform')}</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={checkoutConfirmOpen} onOpenChange={setCheckoutConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmer le check-out</DialogTitle>
            <DialogDescription>
              Le sejour sera cloture avec recalcul automatique de la duree et des montants dus.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={async () => {
                if (!checkoutStay || !hotel) return;
                try {
                  const dossier = await fetchCustomerDossierData(hotel.id, checkoutStay.guest_id);
                  await generateCustomerDossier({
                    guest: dossier.guest,
                    hotel,
                    stays: dossier.stays,
                    siestes: dossier.siestes,
                    payments: dossier.payments,
                    generatedBy: profile?.full_name || 'Reception',
                  });
                } catch (error: any) {
                  toast.error(error.message || 'Impossible de telecharger le dossier');
                }
              }}
              disabled={!checkoutStay}
            >
              <Download className="h-4 w-4 mr-2" />Telecharger le dossier
            </Button>
            <Button variant="outline" onClick={() => setCheckoutConfirmOpen(false)}>{t('common.cancel')}</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (!checkoutStay) return;
                checkoutMutation.mutate(checkoutStay);
                setCheckoutConfirmOpen(false);
              }}
            >
              <LogOut className="h-4 w-4 mr-2" />{t('checkinout.tabs.checkout')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CheckInOutPage;
