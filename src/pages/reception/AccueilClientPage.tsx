import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useHotel } from '@/contexts/HotelContext';
import { useRoleGuard } from '@/hooks/useRoleGuard';
import { formatFCFA, generateInvoiceNumber } from '@/utils/formatters';
import { getOrCreateInvoice, addChargeToInvoice, recordPayment } from '@/services/transactionService';
import { applyTaxesAndFixedCharges } from '@/services/taxService';
import { applyTierBenefitsPricing, getActiveTierBenefits } from '@/services/tierService';
import { withAudit } from '@/utils/auditLog';
import { TierBadge } from '@/components/shared/TierBadge';
import { CniScanner, CniData } from '@/components/shared/CniScanner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Search, Moon, Clock, CalendarCheck, User, BedDouble, Check, ArrowRight, Loader2, ScanLine, AlertTriangle, Star } from 'lucide-react';

const AccueilClientPage = () => {
  useRoleGuard(['admin', 'manager', 'receptionist']);
  const { profile } = useAuth();
  const { hotel } = useHotel();
  const qc = useQueryClient();
  const [searchParams] = useSearchParams();
  const reservationId = searchParams.get('reservationId');

  // State
  const [guestSearch, setGuestSearch] = useState('');
  const [selectedGuestId, setSelectedGuestId] = useState<string | null>(null);
  const [selectedGuestData, setSelectedGuestData] = useState<any>(null);
  const [newGuest, setNewGuest] = useState({ last_name: '', first_name: '', phone: '', nationality: 'Camerounaise', id_number: '', id_type: 'CNI' });
  const [serviceType, setServiceType] = useState<'night' | 'sieste' | 'reservation' | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [checkInDate, setCheckInDate] = useState(new Date().toISOString().split('T')[0]);
  const [checkOutDate, setCheckOutDate] = useState('');
  const [arrivalTime, setArrivalTime] = useState(new Date().toTimeString().slice(0, 5));
  const [durationHours, setDurationHours] = useState(3);
  const [numAdults, setNumAdults] = useState(1);
  const [numChildren, setNumChildren] = useState(0);
  const [negotiatedPrice, setNegotiatedPrice] = useState<number | null>(null);
  const [payNow, setPayNow] = useState<boolean | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<string[]>(['cash']);
  const [success, setSuccess] = useState<{ room: string; guest: string } | null>(null);
  const [cniScannerOpen, setCniScannerOpen] = useState(false);
  const [blacklistConfirmed, setBlacklistConfirmed] = useState(false);
  const [prefillApplied, setPrefillApplied] = useState(false);
  const serviceSectionRef = useRef<HTMLDivElement | null>(null);
  const categorySectionRef = useRef<HTMLDivElement | null>(null);
  const roomSelectionRef = useRef<HTMLDivElement | null>(null);
  const detailsSectionRef = useRef<HTMLDivElement | null>(null);
  const paymentSectionRef = useRef<HTMLDivElement | null>(null);
  const finalizeSectionRef = useRef<HTMLDivElement | null>(null);
  const guestReadyRef = useRef(false);
  const serviceReadyRef = useRef(false);
  const categoryReadyRef = useRef(false);
  const roomReadyRef = useRef(false);
  const detailsReadyRef = useRef(false);
  const paymentReadyRef = useRef(false);

  const toDateKey = (value: string | null | undefined) => {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = `${d.getMonth() + 1}`.padStart(2, '0');
    const day = `${d.getDate()}`.padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  // Queries
  const { data: existingGuests } = useQuery({
    queryKey: ['guest-search-accueil', hotel?.id, guestSearch],
    queryFn: async () => {
      if (guestSearch.length < 1) return [];
      const searchTerm = guestSearch.trim();
      
      // First try exact prefix match on full name
      const { data } = await supabase.from('guests').select('id, last_name, first_name, phone, id_number, nationality, tier, loyalty_points')
        .eq('hotel_id', hotel!.id)
        // Search with fuzzy/partial matching
        .or(`last_name.ilike.${searchTerm}%,first_name.ilike.${searchTerm}%,last_name.ilike.%${searchTerm}%,first_name.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%,id_number.ilike.%${searchTerm}%`)
        .order('last_name, first_name')
        .limit(20);
      return data || [];
    },
    enabled: !!hotel?.id && guestSearch.length >= 1,
  });

  const { data: categories } = useQuery({
    queryKey: ['room-categories-accueil', hotel?.id],
    queryFn: async () => {
      const { data } = await supabase.from('room_categories').select('*').eq('hotel_id', hotel!.id).order('display_order');
      return data || [];
    },
    enabled: !!hotel?.id,
  });

  const { data: availableRooms } = useQuery({
    queryKey: ['rooms-available-accueil', hotel?.id, selectedCategoryId],
    queryFn: async () => {
      let q = supabase.from('rooms').select('id, room_number, floor, category_id, status').eq('hotel_id', hotel!.id).eq('status', 'available');
      if (selectedCategoryId) q = q.eq('category_id', selectedCategoryId);
      const { data } = await q.order('room_number');
      let rooms = data || [];

      // Keep preselected reservation room visible even if it is not currently "available"
      if (selectedRoomId && !rooms.some((r: any) => r.id === selectedRoomId)) {
        const { data: selectedRoomData } = await supabase
          .from('rooms')
          .select('id, room_number, floor, category_id, status')
          .eq('hotel_id', hotel!.id)
          .eq('id', selectedRoomId)
          .maybeSingle();
        if (selectedRoomData) rooms = [...rooms, selectedRoomData];
      }

      return rooms;
    },
    enabled: !!hotel?.id,
  });

  const { data: reservationPrefill } = useQuery({
    queryKey: ['reservation-prefill-accueil', hotel?.id, reservationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reservations')
        .select('*, guests(id, first_name, last_name, phone, nationality, id_number), room_categories(id, name)')
        .eq('hotel_id', hotel!.id)
        .eq('id', reservationId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!hotel?.id && !!reservationId,
  });

  useEffect(() => {
    if (!reservationId || !reservationPrefill || prefillApplied) return;

    setServiceType('night');
    setSelectedRoomId(reservationPrefill.room_id || null);
    setSelectedCategoryId(reservationPrefill.category_id || null);
    setCheckInDate(toDateKey(reservationPrefill.check_in_date) || new Date().toISOString().split('T')[0]);
    setCheckOutDate(toDateKey(reservationPrefill.check_out_date));
    setNumAdults(reservationPrefill.number_of_adults || 1);
    setNumChildren(reservationPrefill.number_of_children || 0);

    const prefGuest = (reservationPrefill as any).guests;
    if (prefGuest?.id) {
      setSelectedGuestId(prefGuest.id);
      setSelectedGuestData(prefGuest);
      setGuestSearch(`${prefGuest.last_name || ''} ${prefGuest.first_name || ''}`.trim());
    } else {
      const parts = (reservationPrefill.guest_name || '').trim().split(' ').filter(Boolean);
      const lastName = parts.length > 1 ? parts[parts.length - 1] : (parts[0] || '');
      const firstName = parts.length > 1 ? parts.slice(0, -1).join(' ') : '';
      setNewGuest((prev) => ({
        ...prev,
        last_name: lastName,
        first_name: firstName,
        phone: reservationPrefill.guest_phone || prev.phone,
      }));
    }

    setPrefillApplied(true);
    toast.success(`Prérempli depuis la réservation ${reservationPrefill.reservation_number || ''}`.trim());
  }, [prefillApplied, reservationId, reservationPrefill]);

  const selectedCategory = categories?.find(c => c.id === selectedCategoryId);
  const selectedRoom = availableRooms?.find(r => r.id === selectedRoomId);
  const nights = checkInDate && checkOutDate ? Math.max(1, Math.ceil((new Date(checkOutDate).getTime() - new Date(checkInDate).getTime()) / 86400000)) : 1;
  const basePrice = serviceType === 'sieste'
    ? (selectedCategory?.price_sieste || 0)
    : (selectedCategory?.price_per_night || 0) * nights;
  const finalPrice = negotiatedPrice != null && negotiatedPrice > 0 ? negotiatedPrice : basePrice;
  const guestTier = (selectedGuestData as any)?.tier || 'regular';

  const { data: activeTierBenefits = [] } = useQuery({
    queryKey: ['accueil-tier-benefits', hotel?.id, guestTier],
    queryFn: async () => getActiveTierBenefits(hotel!.id, guestTier),
    enabled: !!hotel?.id && !!selectedGuestData?.id && guestTier !== 'regular' && guestTier !== 'blacklist',
  });

  const tierPricingPreview = useMemo(() => {
    const units = serviceType === 'night' ? Math.max(1, nights) : 1;
    return applyTierBenefitsPricing(finalPrice, units, activeTierBenefits as any);
  }, [finalPrice, nights, serviceType, activeTierBenefits]);
  const hasGuestIdentity = Boolean(selectedGuestId || (newGuest.last_name.trim() && newGuest.first_name.trim()));
  const hasBookableService = Boolean(serviceType && serviceType !== 'reservation');
  const detailsComplete = serviceType === 'night'
    ? Boolean(checkInDate && checkOutDate)
    : Boolean(arrivalTime && durationHours > 0);
  const paymentDecisionMade = payNow !== null;

  useEffect(() => {
    if (hasGuestIdentity && !guestReadyRef.current) {
      serviceSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    guestReadyRef.current = hasGuestIdentity;
  }, [hasGuestIdentity]);

  useEffect(() => {
    if (hasBookableService && !serviceReadyRef.current) {
      categorySectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    serviceReadyRef.current = hasBookableService;
  }, [hasBookableService]);

  useEffect(() => {
    const hasCategory = Boolean(selectedCategoryId && hasBookableService);
    if (hasCategory && !categoryReadyRef.current) {
      roomSelectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    categoryReadyRef.current = hasCategory;
  }, [hasBookableService, selectedCategoryId]);

  useEffect(() => {
    const hasRoom = Boolean(selectedRoomId && hasBookableService);
    if (hasRoom && !roomReadyRef.current) {
      detailsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    roomReadyRef.current = hasRoom;
  }, [hasBookableService, selectedRoomId]);

  useEffect(() => {
    if (detailsComplete && selectedRoomId && !detailsReadyRef.current) {
      paymentSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    detailsReadyRef.current = detailsComplete;
  }, [detailsComplete, selectedRoomId]);

  useEffect(() => {
    if (paymentDecisionMade && detailsComplete && !paymentReadyRef.current) {
      finalizeSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    paymentReadyRef.current = paymentDecisionMade;
  }, [detailsComplete, paymentDecisionMade]);

  const reservationHint = useMemo(() => {
    if (!reservationPrefill) return null;
    return {
      number: reservationPrefill.reservation_number,
      name: reservationPrefill.guest_name,
      status: reservationPrefill.status,
    };
  }, [reservationPrefill]);

  const finalizeMutation = useMutation({
    mutationFn: async () => {
      if (!hotel || !profile) throw new Error('Missing context');
      if (!selectedRoomId) throw new Error('Sélectionnez une chambre');
      if (!serviceType) throw new Error('Sélectionnez un type de service');

      // Create or find guest
      let guestId = selectedGuestId;
      let guestName = selectedGuestData ? `${selectedGuestData.last_name} ${selectedGuestData.first_name}` : `${newGuest.last_name} ${newGuest.first_name}`;
      if (!guestId) {
        if (!newGuest.last_name || !newGuest.first_name) throw new Error('Nom et prénom requis');
        const { data: g, error } = await supabase.from('guests').insert({
          hotel_id: hotel.id, last_name: newGuest.last_name, first_name: newGuest.first_name,
          phone: newGuest.phone || null, nationality: newGuest.nationality || null,
          id_number: newGuest.id_number || null, id_type: newGuest.id_type || null,
        }).select().single();
        if (error) throw error;
        guestId = g.id;
      }

      const { data: tierData } = await supabase
        .from('guests')
        .select('tier')
        .eq('id', guestId)
        .maybeSingle();
      const effectiveTier = tierData?.tier || 'regular';
      const tierBenefits = await getActiveTierBenefits(hotel.id, effectiveTier);
      const pricing = applyTierBenefitsPricing(finalPrice, serviceType === 'night' ? nights : 1, tierBenefits);
      const appliedTotal = pricing.discountedTotal;

      // Create stay first, then attach invoice for full transaction chain linking
      const stayData: any = {
        hotel_id: hotel.id, guest_id: guestId, stay_type: serviceType === 'sieste' ? 'sieste' : 'night',
        room_id: selectedRoomId, status: 'active', payment_status: 'pending',
        receptionist_id: profile.id, receptionist_name: profile.full_name,
        created_by: profile.id, created_by_name: profile.full_name,
        number_of_adults: numAdults, number_of_children: numChildren,
        total_price: appliedTotal,
      };
      if (serviceType === 'night') {
        stayData.check_in_date = new Date(checkInDate).toISOString();
        stayData.check_out_date = checkOutDate ? new Date(checkOutDate).toISOString() : null;
        stayData.number_of_nights = nights;
        stayData.price_per_night = pricing.unitPrice;
      } else {
        stayData.check_in_date = new Date().toISOString();
      }
      if (negotiatedPrice != null && negotiatedPrice > 0) stayData.arrangement_price = appliedTotal;

      const { data: stay, error: stayErr } = await supabase.from('stays').insert(stayData).select().single();
      if (stayErr) throw stayErr;

      const [roomUpdateResult, invoice] = await Promise.all([
        supabase.from('rooms').update({ status: 'occupied' }).eq('id', selectedRoomId),
        getOrCreateInvoice(hotel.id, stay.id, guestId),
      ]);

      if (roomUpdateResult.error) {
        throw roomUpdateResult.error;
      }

      const chargeDescription = serviceType === 'sieste'
        ? `Sieste — ${durationHours}h`
        : `Hébergement — ${selectedCategory?.name || 'Chambre'} — ${nights} nuit(s)`;

      await addChargeToInvoice({
        hotelId: hotel.id,
        invoiceId: invoice.id,
        stayId: stay.id,
        guestId,
        description: `${chargeDescription}${pricing.discountPercent > 0 ? ` — Avantage fidélité ${pricing.discountPercent}%` : ''}`,
        itemType: serviceType === 'sieste' ? 'sieste' : 'room',
        quantity: serviceType === 'sieste' ? 1 : nights,
        unitPrice: serviceType === 'sieste' ? appliedTotal : pricing.unitPrice,
      });

      // Feature 1: Apply taxes & fixed charges for night stays
      if (serviceType === 'night') {
        await applyTaxesAndFixedCharges({
          hotelId: hotel.id,
          invoiceId: invoice.id,
          stayId: stay.id,
          guestId,
          numberOfNights: nights,
        });
      }

      // If sieste, also create sieste record
      if (serviceType === 'sieste') {
        await supabase.from('siestes').insert({
          hotel_id: hotel.id, guest_id: guestId, full_name: guestName,
          room_id: selectedRoomId, arrival_date: new Date().toISOString().split('T')[0],
          arrival_time: arrivalTime, duration_hours: durationHours,
          amount_paid: payNow ? appliedTotal : 0, payment_method: paymentMethods[0] || 'cash',
          recorded_by: profile.id, created_by: profile.id, created_by_name: profile.full_name,
          invoice_id: invoice.id,
        } as any);
      }

      if (payNow) {
        await recordPayment({
          hotelId: hotel.id,
          invoiceId: invoice.id,
          stayId: stay.id,
          guestId,
          amount: appliedTotal,
          paymentMethod: paymentMethods[0] || 'cash',
          userId: profile.id,
          userName: profile.full_name || '',
          roomNumber: selectedRoom?.room_number,
          guestName,
        });
      }

      void withAudit(hotel.id, profile.id, profile.full_name || '', 'check_in', 'stays', stay.id, null, { guest_id: guestId, room_id: selectedRoomId, service: serviceType });

      return { room: selectedRoom?.room_number || '', guest: guestName };
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['rooms'] });
      qc.invalidateQueries({ queryKey: ['stays'] });
      qc.invalidateQueries({ queryKey: ['guests'] });
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['siestes'] });
      setSuccess(result);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const resetAll = () => {
    setGuestSearch(''); setSelectedGuestId(null); setSelectedGuestData(null);
    setNewGuest({ last_name: '', first_name: '', phone: '', nationality: 'Camerounaise', id_number: '', id_type: 'CNI' });
    setServiceType(null); setSelectedCategoryId(null); setSelectedRoomId(null);
    setCheckInDate(new Date().toISOString().split('T')[0]); setCheckOutDate('');
    setArrivalTime(new Date().toTimeString().slice(0, 5)); setDurationHours(3);
    setNumAdults(1); setNumChildren(0); setNegotiatedPrice(null);
    setPayNow(null); setPaymentMethods(['cash']); setSuccess(null);
    setBlacklistConfirmed(false);
    guestReadyRef.current = false;
    serviceReadyRef.current = false;
    categoryReadyRef.current = false;
    roomReadyRef.current = false;
    detailsReadyRef.current = false;
    paymentReadyRef.current = false;
  };

  // Success screen
  if (success) {
    return (
      <div className="page-container flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full text-center">
          <CardContent className="py-12 space-y-4">
            <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
              <Check className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold">Check-in réussi !</h2>
            <p className="text-lg">Chambre <span className="font-bold text-primary">{success.room}</span></p>
            <p className="text-muted-foreground">{success.guest}</p>
            <div className="flex gap-3 justify-center pt-4">
              <Button variant="outline" onClick={resetAll}><User className="h-4 w-4 mr-2" />Nouvel arrivant</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const canFinalize = hasGuestIdentity && hasBookableService && selectedRoomId && detailsComplete && paymentDecisionMade
    && ((selectedGuestData as any)?.tier !== 'blacklist' || blacklistConfirmed);

  return (
    <div className="page-container">
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left panel */}
        <div className="lg:col-span-3 space-y-6">
          <h1 className="text-2xl font-bold">Accueil client</h1>

          {reservationHint && (
            <Card className="border-green-200 bg-green-50/60">
              <CardContent className="py-3">
                <p className="text-sm font-medium text-green-800">
                  Préremplissage réservation #{reservationHint.number || '-'} — {reservationHint.name || 'Client'}
                </p>
                <p className="text-xs text-green-700">Statut: {reservationHint.status || 'pending'}</p>
              </CardContent>
            </Card>
          )}

          {/* Section A — Client */}
          <Card>
            <CardHeader><CardTitle className="text-base">1. Client</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Rechercher un client existant (nom, téléphone, ID)..." className="pl-10"
                  value={guestSearch} onChange={e => { setGuestSearch(e.target.value); setSelectedGuestId(null); setSelectedGuestData(null); }} />
              </div>
              {existingGuests && existingGuests.length > 0 && !selectedGuestId && (
                <div className="border rounded-md max-h-40 overflow-y-auto">
                  {existingGuests.map(g => (
                    <button key={g.id} onClick={() => {
                      setSelectedGuestId(g.id);
                      setSelectedGuestData(g);
                      setGuestSearch(`${g.last_name} ${g.first_name}`);
                      if ((g as any).tier === 'blacklist') setBlacklistConfirmed(false);
                    }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex justify-between items-center">
                      <span className="font-medium">{g.last_name} {g.first_name}</span>
                      <div className="flex items-center gap-2">
                        {(g as any).tier && (g as any).tier !== 'regular' && <TierBadge tier={(g as any).tier} />}
                        <span className="text-muted-foreground">{g.phone || g.id_number || ''}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {/* Blacklist warning */}
              {selectedGuestData && (selectedGuestData as any).tier === 'blacklist' && !blacklistConfirmed && (
                <div className="bg-red-50 border border-red-300 rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2 text-red-700 font-semibold">
                    <AlertTriangle className="h-5 w-5" />
                    Client en liste noire
                  </div>
                  <p className="text-sm text-red-600">{(selectedGuestData as any).tier_notes || 'Ce client est en liste noire.'}</p>
                  <Button variant="destructive" size="sm" onClick={() => setBlacklistConfirmed(true)}>
                    Confirmer — procéder quand même
                  </Button>
                </div>
              )}
              {/* VIP / Gold banner */}
              {selectedGuestData && (selectedGuestData as any).tier === 'vip' && (
                <div className="bg-purple-50 border border-purple-300 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-purple-700 font-semibold">
                    <Star className="h-5 w-5 fill-purple-500" />
                    Client VIP — {selectedGuestData.last_name} {selectedGuestData.first_name}
                  </div>
                  <p className="text-sm text-purple-600">Points de fidélité: {(selectedGuestData as any).loyalty_points || 0}</p>
                </div>
              )}
              {selectedGuestData && (selectedGuestData as any).tier === 'gold' && (
                <div className="bg-amber-50 border border-amber-300 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-amber-700 font-semibold">
                    <Star className="h-5 w-5 fill-amber-500" />
                    Client Gold — {selectedGuestData.last_name} {selectedGuestData.first_name}
                  </div>
                  <p className="text-sm text-amber-600">Points de fidélité: {(selectedGuestData as any).loyalty_points || 0}</p>
                </div>
              )}
              {selectedGuestData && activeTierBenefits.length > 0 && (
                <div className="bg-emerald-50 border border-emerald-300 rounded-lg p-3 space-y-1">
                  <p className="text-sm font-semibold text-emerald-700">Avantages appliqués automatiquement</p>
                  <div className="flex flex-wrap gap-1">
                    {activeTierBenefits.map((benefit: any) => (
                      <Badge key={benefit.id} variant="outline" className="text-emerald-700 border-emerald-300">
                        {benefit.benefit_type === 'discount_percentage' ? `Remise ${benefit.benefit_value}%` : (benefit.description || benefit.benefit_type)}
                      </Badge>
                    ))}
                  </div>
                  {tierPricingPreview.discountPercent > 0 && (
                    <p className="text-xs text-emerald-700">
                      Prix ajusté: {formatFCFA(tierPricingPreview.originalTotal)} → {formatFCFA(tierPricingPreview.discountedTotal)}
                    </p>
                  )}
                </div>
              )}
              {selectedGuestData && (
                <div className="bg-muted/50 rounded-lg p-3 text-sm">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold">{selectedGuestData.last_name} {selectedGuestData.first_name}</p>
                    {(selectedGuestData as any).tier && <TierBadge tier={(selectedGuestData as any).tier} />}
                  </div>
                  <p className="text-muted-foreground">{selectedGuestData.phone || '-'} • {selectedGuestData.nationality || '-'} • {selectedGuestData.id_number || '-'}</p>
                </div>
              )}
              {!selectedGuestId && (
                <div className="grid grid-cols-2 gap-3 border-t pt-3">
                  <div><Label>Nom *</Label><Input value={newGuest.last_name} onChange={e => setNewGuest(p => ({ ...p, last_name: e.target.value }))} /></div>
                  <div><Label>Prénom *</Label><Input value={newGuest.first_name} onChange={e => setNewGuest(p => ({ ...p, first_name: e.target.value }))} /></div>
                  <div><Label>Téléphone</Label><Input value={newGuest.phone} onChange={e => setNewGuest(p => ({ ...p, phone: e.target.value }))} /></div>
                  <div><Label>Nationalité</Label><Input value={newGuest.nationality} onChange={e => setNewGuest(p => ({ ...p, nationality: e.target.value }))} /></div>
                  <div>
                    <Label>N° ID</Label>
                    <div className="flex gap-2">
                      <Input value={newGuest.id_number} onChange={e => setNewGuest(p => ({ ...p, id_number: e.target.value }))} />
                      <Button type="button" variant="outline" size="icon" title="Scanner la CNI" onClick={() => setCniScannerOpen(true)}>
                        <ScanLine className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div><Label>Type ID</Label>
                    <Select value={newGuest.id_type} onValueChange={v => setNewGuest(p => ({ ...p, id_type: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CNI">CNI</SelectItem>
                        <SelectItem value="Passeport">Passeport</SelectItem>
                        <SelectItem value="Permis">Permis de conduire</SelectItem>
                        <SelectItem value="Autre">Autre</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Section B — Service Type */}
          <div ref={serviceSectionRef}>
          <Card>
            <CardHeader><CardTitle className="text-base">2. Service</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-3">
                <button onClick={() => setServiceType('night')}
                  className={`border-2 rounded-lg p-4 text-center transition-all ${serviceType === 'night' ? 'border-primary bg-primary/5' : 'hover:border-muted-foreground/30'}`}>
                  <Moon className="h-6 w-6 mx-auto mb-2" />
                  <p className="font-semibold">Nuit</p>
                </button>
                <button onClick={() => setServiceType('sieste')}
                  className={`border-2 rounded-lg p-4 text-center transition-all ${serviceType === 'sieste' ? 'border-primary bg-primary/5' : 'hover:border-muted-foreground/30'}`}>
                  <Clock className="h-6 w-6 mx-auto mb-2" />
                  <p className="font-semibold">Sieste</p>
                </button>
                <button onClick={() => setServiceType('reservation')}
                  className={`border-2 rounded-lg p-4 text-center transition-all ${serviceType === 'reservation' ? 'border-primary bg-primary/5' : 'hover:border-muted-foreground/30'}`}>
                  <CalendarCheck className="h-6 w-6 mx-auto mb-2" />
                  <p className="font-semibold text-xs">Réservation existante</p>
                </button>
              </div>
            </CardContent>
          </Card>
          </div>

          {/* Section C — Category & Room */}
          {serviceType && serviceType !== 'reservation' && (
            <div ref={categorySectionRef}>
            <Card>
              <CardHeader><CardTitle className="text-base">3. Catégorie & Chambre</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {categories?.map(cat => (
                    <button key={cat.id} onClick={() => { setSelectedCategoryId(cat.id); setSelectedRoomId(null); }}
                      className={`border-2 rounded-lg p-3 text-left transition-all ${selectedCategoryId === cat.id ? 'border-primary bg-primary/5' : 'hover:border-muted-foreground/30'}`}
                      style={{ borderLeftColor: cat.color || undefined, borderLeftWidth: 4 }}>
                      <p className="font-semibold text-sm">{cat.name}</p>
                      <p className="text-lg font-bold">{formatFCFA(serviceType === 'sieste' ? (cat.price_sieste || 0) : cat.price_per_night)}</p>
                      {cat.description && <p className="text-xs text-muted-foreground">{cat.description}</p>}
                      <div className="flex flex-wrap gap-1 mt-1">
                        {(cat.features as string[])?.slice(0, 3).map(f => <Badge key={f} variant="outline" className="text-[10px]">{f}</Badge>)}
                      </div>
                    </button>
                  ))}
                </div>
                {selectedCategoryId && (
                  <div ref={roomSelectionRef}>
                    <Label className="text-sm font-semibold">Chambres disponibles</Label>
                    {!availableRooms?.length ? (
                      <p className="text-sm text-muted-foreground mt-2">Aucune chambre disponible dans cette catégorie</p>
                    ) : (
                      <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 mt-2">
                        {availableRooms.map(r => (
                          <button key={r.id} onClick={() => setSelectedRoomId(r.id)}
                            className={`border-2 rounded-lg p-2 text-center transition-all ${selectedRoomId === r.id ? 'border-primary bg-primary/5' : 'hover:border-muted-foreground/30'}`}>
                            <p className="font-bold">{r.room_number}</p>
                            <p className="text-[10px] text-muted-foreground">Étage {r.floor}</p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
            </div>
          )}

          {/* Section D — Details */}
          {serviceType && serviceType !== 'reservation' && selectedRoomId && (
            <div ref={detailsSectionRef}>
            <Card>
              <CardHeader><CardTitle className="text-base">4. Détails</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  {serviceType === 'night' ? (
                    <>
                      <div><Label>Arrivée</Label><Input type="date" value={checkInDate} onChange={e => setCheckInDate(e.target.value)} /></div>
                      <div><Label>Départ</Label><Input type="date" value={checkOutDate} onChange={e => setCheckOutDate(e.target.value)} /></div>
                      <div><Label>Nuits</Label><Input value={nights} readOnly className="bg-muted" /></div>
                    </>
                  ) : (
                    <>
                      <div><Label>Heure d'arrivée</Label><Input type="time" value={arrivalTime} onChange={e => setArrivalTime(e.target.value)} /></div>
                      <div><Label>Durée (heures)</Label>
                        <Select value={String(durationHours)} onValueChange={v => setDurationHours(Number(v))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{[1,2,3,4,5,6].map(h => <SelectItem key={h} value={String(h)}>{h}h</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    </>
                  )}
                  <div><Label>Adultes</Label><Input type="number" value={numAdults} onChange={e => setNumAdults(Number(e.target.value))} /></div>
                  <div><Label>Enfants</Label><Input type="number" value={numChildren} onChange={e => setNumChildren(Number(e.target.value))} /></div>
                  <div className="col-span-2">
                    <Label>Prix négocié (si différent)</Label>
                    <Input type="number" placeholder="Laissez vide si prix normal" value={negotiatedPrice ?? ''} onChange={e => setNegotiatedPrice(e.target.value ? Number(e.target.value) : null)} />
                    <p className="text-xs text-muted-foreground mt-1">Si le client a négocié un prix différent, entrez-le ici.</p>
                    {negotiatedPrice != null && negotiatedPrice > 0 && negotiatedPrice !== basePrice && (
                      <Badge variant="outline" className="mt-1 text-orange-600 border-orange-300">Prix négocié — écart de {formatFCFA(Math.abs(negotiatedPrice - basePrice))}</Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
            </div>
          )}

          {/* Section E — Payment */}
          {serviceType && serviceType !== 'reservation' && selectedRoomId && (
            <div ref={paymentSectionRef}>
            <Card>
              <CardHeader><CardTitle className="text-base">5. Paiement</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Le client paye maintenant ?</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <Button type="button" variant={payNow === true ? 'default' : 'outline'} onClick={() => setPayNow(true)}>
                      Oui, payer maintenant
                    </Button>
                    <Button type="button" variant={payNow === false ? 'default' : 'outline'} onClick={() => setPayNow(false)}>
                      Non, paiement plus tard
                    </Button>
                  </div>
                </div>
                {payNow && (
                  <div className="flex gap-4">
                    {[{ v: 'cash', l: 'Cash' }, { v: 'mtn_momo', l: 'MTN MoMo' }, { v: 'orange_money', l: 'Orange Money' }].map(m => (
                      <label key={m.v} className="flex items-center gap-2">
                        <Checkbox checked={paymentMethods.includes(m.v)}
                          onCheckedChange={checked => setPaymentMethods(prev => checked ? [...prev, m.v] : prev.filter(p => p !== m.v))} />
                        <span className="text-sm">{m.l}</span>
                      </label>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            </div>
          )}
        </div>

        {/* Right panel — Live Summary */}
        <div className="lg:col-span-2">
          <div className="sticky top-6">
            <Card className="border-primary/20">
              <CardHeader>
                <CardTitle className="text-base">Récapitulatif</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Guest */}
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold">{selectedGuestData ? `${selectedGuestData.last_name} ${selectedGuestData.first_name}` : (newGuest.last_name ? `${newGuest.last_name} ${newGuest.first_name}` : 'Client non identifié')}</p>
                    {selectedGuestData && <Badge variant="outline" className="text-xs">Client existant</Badge>}
                  </div>
                </div>

                {/* Service */}
                {serviceType && (
                  <div className="flex items-center gap-2">
                    {serviceType === 'night' ? <Moon className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                    <Badge>{serviceType === 'night' ? 'Nuit' : serviceType === 'sieste' ? 'Sieste' : 'Réservation'}</Badge>
                  </div>
                )}

                {/* Room */}
                {selectedRoom && (
                  <div className="flex items-center gap-2">
                    <BedDouble className="h-4 w-4" />
                    <span className="font-bold text-lg">{selectedRoom.room_number}</span>
                    {selectedCategory && <span className="text-sm text-muted-foreground">{selectedCategory.name}</span>}
                  </div>
                )}

                {/* Dates */}
                {serviceType === 'night' && checkInDate && (
                  <div className="text-sm text-muted-foreground">
                    {checkInDate} → {checkOutDate || '?'} • {nights} nuit(s)
                  </div>
                )}
                {serviceType === 'sieste' && (
                  <div className="text-sm text-muted-foreground">
                    {arrivalTime} • {durationHours}h
                  </div>
                )}

                {/* Price */}
                <div className="border-t pt-3">
                  {selectedCategory && (
                    <div className="text-sm text-muted-foreground">
                      Prix catégorie: {formatFCFA(serviceType === 'sieste' ? (selectedCategory.price_sieste || 0) : selectedCategory.price_per_night)}
                      {serviceType === 'night' && nights > 1 && ` × ${nights} nuits`}
                    </div>
                  )}
                  <p className="text-3xl font-bold mt-1">{formatFCFA(finalPrice)}</p>
                  {payNow === true && <Badge className="mt-1 bg-green-600">Paiement immédiat</Badge>}
                  {payNow === false && serviceType && <Badge variant="outline" className="mt-1">Paiement en attente</Badge>}
                </div>

                <div ref={finalizeSectionRef}>
                  <Button className="w-full mt-4" size="lg" disabled={!canFinalize || finalizeMutation.isPending}
                    onClick={() => finalizeMutation.mutate()}>
                    {finalizeMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ArrowRight className="h-4 w-4 mr-2" />}
                    {finalizeMutation.isPending ? 'Finalisation en cours...' : "Finaliser l'accueil"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      <CniScanner
        open={cniScannerOpen}
        onClose={() => setCniScannerOpen(false)}
        hotelId={hotel?.id || ''}
        onConfirm={(data: CniData) => {
          setNewGuest(prev => ({
            ...prev,
            last_name: data.last_name || prev.last_name,
            first_name: data.first_name || prev.first_name,
            nationality: data.nationality || prev.nationality,
            id_number: data.id_number || prev.id_number,
          }));
          toast.success('Données CNI appliquées');
        }}
      />
    </div>
  );
};

export default AccueilClientPage;
