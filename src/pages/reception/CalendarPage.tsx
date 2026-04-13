import React, { useMemo, useRef, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import frLocale from '@fullcalendar/core/locales/fr';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useHotel } from '@/contexts/HotelContext';
import { useRoleGuard } from '@/hooks/useRoleGuard';
import { PageHeader } from '@/components/shared/PageHeader';
import { formatFCFA } from '@/utils/formatters';
import { Calendar as MiniCalendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import './CalendarPage.css';

type DateRange = { start: string; end: string };

type CalendarData = {
  stays: any[];
  reservations: any[];
  siestes: any[];
  roomCategories: any[];
};

const todayKey = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const toDateKey = (value: string | Date | null | undefined) => {
  if (!value) return '';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const fullFrenchDate = (dateKey: string) => {
  const date = new Date(`${dateKey}T00:00:00`);
  const text = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
  return text.charAt(0).toUpperCase() + text.slice(1);
};

const computeNights = (checkIn?: string, checkOut?: string) => {
  const start = checkIn ? new Date(checkIn).getTime() : 0;
  const end = checkOut ? new Date(checkOut).getTime() : 0;
  if (!start || !end) return 1;
  return Math.max(1, Math.ceil((end - start) / 86400000));
};

const isWithinDay = (startValue: string | null | undefined, endValue: string | null | undefined, day: string) => {
  const start = toDateKey(startValue);
  const end = toDateKey(endValue || '9999-12-31');
  return !!start && !!end && start <= day && end >= day;
};

const CalendarPage = () => {
  useRoleGuard(['admin', 'manager', 'receptionist']);
  const { hotel } = useHotel();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const calendarRef = useRef<FullCalendar | null>(null);

  const [selectedDate, setSelectedDate] = useState(todayKey());
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [currentView, setCurrentView] = useState('dayGridMonth');
  const [range, setRange] = useState<DateRange>(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { start: toDateKey(start), end: toDateKey(end) };
  });

  const { data: totalRooms = 0 } = useQuery({
    queryKey: ['calendar-room-total', hotel?.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('rooms')
        .select('id', { count: 'exact', head: true })
        .eq('hotel_id', hotel!.id);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!hotel?.id,
  });

  const { data, isLoading, isFetching, isError, error } = useQuery<CalendarData>({
    queryKey: ['calendar-data', hotel?.id, range.start, range.end],
    queryFn: async () => {
      const [staysRes, reservationsRes, siestesRes, categoriesRes] = await Promise.all([
        supabase
          .from('stays')
          .select('*, guests(first_name, last_name), rooms(room_number, category_id), reservation_id, payment_status')
          .eq('hotel_id', hotel!.id)
          .lte('check_in_date', range.end),
        supabase
          .from('reservations')
          .select('*, room_categories(name, color), rooms(room_number)')
          .eq('hotel_id', hotel!.id)
          .gte('check_out_date', range.start)
          .lte('check_in_date', range.end)
          .in('status', ['pending', 'confirmed']),
        supabase
          .from('siestes')
          .select('*, guests(first_name, last_name), rooms(room_number)')
          .eq('hotel_id', hotel!.id)
          .gte('arrival_date', range.start)
          .lte('arrival_date', range.end),
        supabase.from('room_categories').select('id, name, color').eq('hotel_id', hotel!.id),
      ]);

      if (staysRes.error) throw staysRes.error;
      if (reservationsRes.error) throw reservationsRes.error;
      if (siestesRes.error) throw siestesRes.error;
      if (categoriesRes.error) throw categoriesRes.error;

      const rawStays = staysRes.data || [];
      const staysInRange = rawStays.filter((s: any) => {
        const checkIn = toDateKey(s.check_in_date);
        const checkOut = toDateKey(s.check_out_date || '9999-12-31');
        return !!checkIn && checkIn <= range.end && checkOut >= range.start;
      });

      const invoiceIds = Array.from(new Set(staysInRange.map((s: any) => s.invoice_id).filter(Boolean)));
      const stayIds = Array.from(new Set(staysInRange.map((s: any) => s.id).filter(Boolean)));
      const reservationIds = Array.from(new Set(staysInRange.map((s: any) => s.reservation_id).filter(Boolean)));

      let invoicesById: any[] = [];
      let invoicesByStay: any[] = [];
      let invoicesByReservation: any[] = [];

      if (invoiceIds.length > 0) {
        const { data: byIdData, error: byIdError } = await supabase
          .from('invoices')
          .select('id, invoice_number, total_amount, amount_paid, balance_due, reservation_id, guest_id')
          .eq('hotel_id', hotel!.id)
          .in('id', invoiceIds as string[]);
        if (byIdError) throw byIdError;
        invoicesById = byIdData || [];
      }

      if (stayIds.length > 0) {
        const { data: byStayData, error: byStayError } = await supabase
          .from('invoices')
          .select('id, stay_id, invoice_number, total_amount, amount_paid, balance_due, reservation_id, guest_id' as any)
          .eq('hotel_id', hotel!.id)
          .in('stay_id' as any, stayIds as any);
        if (!byStayError) invoicesByStay = byStayData || [];
      }

      if (reservationIds.length > 0) {
        const { data: byReservationData, error: byReservationError } = await supabase
          .from('invoices')
          .select('id, invoice_number, total_amount, amount_paid, balance_due, reservation_id, guest_id')
          .eq('hotel_id', hotel!.id)
          .in('reservation_id', reservationIds as string[]);
        if (!byReservationError) invoicesByReservation = byReservationData || [];
      }

      const invoiceByIdMap = new Map(invoicesById.map((inv: any) => [inv.id, inv]));
      const invoiceByStayMap = new Map(invoicesByStay.map((inv: any) => [inv.stay_id, inv]));
      const invoiceByReservationMap = new Map(invoicesByReservation.map((inv: any) => [inv.reservation_id, inv]));

      const staysWithResolvedInvoice = staysInRange.map((stay: any) => {
        const linkedInvoice =
          (stay.invoice_id ? invoiceByIdMap.get(stay.invoice_id) : null) ||
          invoiceByStayMap.get(stay.id) ||
          (stay.reservation_id ? invoiceByReservationMap.get(stay.reservation_id) : null) ||
          null;
        return { ...stay, linkedInvoice };
      });

      return {
        stays: staysWithResolvedInvoice,
        reservations: reservationsRes.data || [],
        siestes: siestesRes.data || [],
        roomCategories: categoriesRes.data || [],
      };
    },
    enabled: !!hotel?.id,
    placeholderData: (previousData) => previousData,
  });

  const confirmReservationMutation = useMutation({
    mutationFn: async (reservationId: string) => {
      const { error } = await supabase
        .from('reservations')
        .update({ status: 'confirmed' })
        .eq('id', reservationId)
        .eq('hotel_id', hotel!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['calendar-data'] });
      toast.success('Réservation confirmée');
    },
    onError: (e: any) => toast.error(e.message || 'Impossible de confirmer la réservation'),
  });

  const stays = data?.stays || [];
  const reservations = data?.reservations || [];
  const siestes = data?.siestes || [];
  const roomCategoryMap = useMemo(() => {
    return (data?.roomCategories || []).reduce((acc: Record<string, any>, cat: any) => {
      acc[cat.id] = cat;
      return acc;
    }, {});
  }, [data?.roomCategories]);

  const staysWithCategory = useMemo(() => {
    return stays.map((stay: any) => ({
      ...stay,
      room_categories: stay.rooms?.category_id ? roomCategoryMap[stay.rooms.category_id] : null,
    }));
  }, [stays, roomCategoryMap]);

  const events = useMemo(() => {
    return [
      ...staysWithCategory.map((stay: any) => ({
        id: `stay-${stay.id}`,
        title: `🛏 Ch.${stay.rooms?.room_number || '-'} — ${stay.guests?.last_name || ''} ${stay.guests?.first_name || ''}`,
        start: stay.check_in_date,
        end: stay.check_out_date,
        allDay: true,
        backgroundColor: stay.room_categories?.color || '#3b82f6',
        borderColor: stay.room_categories?.color || '#3b82f6',
        textColor: '#ffffff',
        extendedProps: { type: 'stay', data: stay },
      })),
      ...reservations.map((res: any) => ({
        id: `reservation-${res.id}`,
        title: `📅 ${res.guest_name} — ${res.room_categories?.name || 'Réservation'}`,
        start: res.check_in_date,
        end: res.check_out_date,
        allDay: true,
        backgroundColor: res.status === 'confirmed' ? '#10b981' : '#f59e0b',
        borderColor: res.status === 'confirmed' ? '#059669' : '#d97706',
        textColor: '#ffffff',
        extendedProps: { type: 'reservation', data: res },
      })),
      ...siestes.map((sieste: any) => ({
        id: `sieste-${sieste.id}`,
        title: `⏱ Ch.${sieste.rooms?.room_number || '-'} — ${sieste.guests?.last_name || sieste.full_name || ''}`,
        start: `${toDateKey(sieste.arrival_date)}T${sieste.arrival_time}`,
        end: `${toDateKey(sieste.arrival_date)}T${sieste.departure_time || sieste.arrival_time}`,
        allDay: false,
        backgroundColor: '#8b5cf6',
        borderColor: '#7c3aed',
        textColor: '#ffffff',
        extendedProps: { type: 'sieste', data: sieste },
      })),
    ];
  }, [reservations, siestes, staysWithCategory]);

  const dayStays = useMemo(
    () => staysWithCategory.filter((s: any) => isWithinDay(s.check_in_date, s.check_out_date, selectedDate)),
    [staysWithCategory, selectedDate],
  );

  const dayArrivals = useMemo(
    () => reservations.filter((r: any) => toDateKey(r.check_in_date) === selectedDate),
    [reservations, selectedDate],
  );

  const dayDepartures = useMemo(
    () => staysWithCategory.filter((s: any) => toDateKey(s.check_out_date) === selectedDate),
    [staysWithCategory, selectedDate],
  );

  const dayReservations = useMemo(
    () => reservations.filter((r: any) => isWithinDay(r.check_in_date, r.check_out_date, selectedDate)),
    [reservations, selectedDate],
  );

  const daySiestes = useMemo(
    () => siestes.filter((s: any) => toDateKey(s.arrival_date) === selectedDate),
    [siestes, selectedDate],
  );

  const occupants = dayStays.reduce((sum: number, s: any) => sum + (s.number_of_adults || 1) + (s.number_of_children || 0), 0);
  const occupiedRooms = dayStays.length;
  const occupancyPct = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0;

  const revenueOfDay =
    dayArrivals.reduce((sum: number, r: any) => sum + Number(r.total_price || 0), 0) +
    daySiestes.reduce((sum: number, s: any) => sum + Number(s.amount_paid || 0), 0);

  const occupancyBarClass =
    occupancyPct > 80 ? 'bg-red-500' : occupancyPct >= 50 ? 'bg-amber-500' : 'bg-emerald-500';

  const eventTooltip = (event: any) => {
    const type = event.extendedProps?.type;
    const raw = event.extendedProps?.data || {};
    if (type === 'stay') {
      return `${raw.guests?.last_name || ''} ${raw.guests?.first_name || ''} | Ch.${raw.rooms?.room_number || '-'} | ${raw.room_categories?.name || 'Séjour'} | Solde: ${formatFCFA(raw.linkedInvoice?.balance_due || 0)}`;
    }
    if (type === 'reservation') {
      return `${raw.guest_name || ''} | ${raw.room_categories?.name || 'Réservation'} | ${toDateKey(raw.check_in_date)} → ${toDateKey(raw.check_out_date)}`;
    }
    return `${raw.full_name || raw.guests?.last_name || ''} | Ch.${raw.rooms?.room_number || '-'} | ${raw.arrival_time || ''} → ${raw.departure_time || ''}`;
  };

  return (
    <div className="page-container space-y-6 calendar-page">
      <PageHeader title="Calendrier" subtitle="Visualisation des séjours, réservations et siestes">
        <Button
          variant="outline"
          onClick={() => {
            const api = calendarRef.current?.getApi();
            api?.today();
            setSelectedDate(todayKey());
          }}
        >
          Aujourd'hui
        </Button>
        <Select
          value={currentView}
          onValueChange={(view) => {
            setCurrentView(view);
            calendarRef.current?.getApi().changeView(view);
          }}
        >
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="Mois" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="dayGridMonth">Mois</SelectItem>
            <SelectItem value="timeGridWeek">Semaine</SelectItem>
            <SelectItem value="timeGridDay">Jour</SelectItem>
            <SelectItem value="listWeek">Liste</SelectItem>
          </SelectContent>
        </Select>
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-10 gap-4">
        <Card className="lg:col-span-7">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Planning</CardTitle>
            <div className="flex flex-wrap gap-2 pt-2">
              <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-200">🔵 Séjour en cours</Badge>
              <Badge variant="outline" className="bg-green-100 text-green-700 border-green-200">🟢 Réservation confirmée</Badge>
              <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-200">🟡 Réservation en attente</Badge>
              <Badge variant="outline" className="bg-purple-100 text-purple-700 border-purple-200">🟣 Sieste</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <FullCalendar
                  ref={calendarRef}
                  plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
                  initialView="dayGridMonth"
                  headerToolbar={{
                    left: 'prev,next today',
                    center: 'title',
                    right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek',
                  }}
                  locale={frLocale}
                  firstDay={1}
                  height="auto"
                  events={events}
                  dateClick={(arg) => {
                    setSelectedDate(arg.dateStr);
                    setSelectedEvent(null);
                  }}
                  eventClick={(arg) => {
                    setSelectedDate(toDateKey(arg.event.start || new Date()));
                    setSelectedEvent(arg.event.extendedProps);
                  }}
                  datesSet={(arg) => {
                    const start = arg.startStr.split('T')[0];
                    const end = arg.endStr.split('T')[0];
                    setRange({ start, end });
                    setCurrentView(arg.view.type);
                  }}
                  eventDidMount={(arg) => {
                    arg.el.setAttribute('title', eventTooltip(arg.event));
                  }}
                  dayCellContent={(arg) => {
                    const dateStr = toDateKey(arg.date);
                    const countStays = staysWithCategory.filter((s: any) => isWithinDay(s.check_in_date, s.check_out_date, dateStr)).length;
                    const countReservations = reservations.filter((r: any) => isWithinDay(r.check_in_date, r.check_out_date, dateStr)).length;
                    const countSiestes = siestes.filter((s: any) => toDateKey(s.arrival_date) === dateStr).length;
                    const arrivals = staysWithCategory.filter((s: any) => toDateKey(s.check_in_date) === dateStr).length;
                    const departures = staysWithCategory.filter((s: any) => toDateKey(s.check_out_date) === dateStr).length;

                    return (
                      <div className="fc-daygrid-day-number-custom">
                        <span>{arg.dayNumberText}</span>
                        {currentView === 'dayGridMonth' && (
                          <div className="flex gap-1 flex-wrap mt-1">
                            {countStays > 0 && (
                              <span className="text-xs bg-blue-100 text-blue-700 px-1 rounded font-medium">
                                {countStays} séj.
                              </span>
                            )}
                            {countReservations > 0 && (
                              <span className="text-xs bg-amber-100 text-amber-700 px-1 rounded font-medium">
                                {countReservations} rés.
                              </span>
                            )}
                            {arrivals > 0 && (
                              <span className="text-xs bg-green-100 text-green-700 px-1 rounded font-medium">
                                +{arrivals}
                              </span>
                            )}
                            {departures > 0 && (
                              <span className="text-xs bg-red-100 text-red-700 px-1 rounded font-medium">
                                -{departures}
                              </span>
                            )}
                            {countSiestes > 0 && (
                              <span className="text-xs bg-purple-100 text-purple-700 px-1 rounded font-medium">
                                {countSiestes}s
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  }}
                />
              {(isLoading || isFetching) && (
                <div className="absolute right-2 top-2 text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded">
                  Mise a jour...
                </div>
              )}
              {isError && (
                <div className="absolute left-2 top-2 text-xs text-red-600 bg-background/90 border border-red-200 rounded px-2 py-1 max-w-[85%]">
                  Erreur chargement calendrier: {(error as any)?.message || 'inconnue'}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Détail journée</CardTitle>
            <MiniCalendar
              mode="single"
              selected={new Date(`${selectedDate}T00:00:00`)}
              onSelect={(date) => {
                if (!date) return;
                const next = toDateKey(date);
                setSelectedDate(next);
                calendarRef.current?.getApi().gotoDate(next);
              }}
              className="border rounded-md"
            />
            <p className="text-sm font-semibold mt-2">{fullFrenchDate(selectedDate)}</p>
            <p className="text-xs text-muted-foreground">
              {occupants} occupant(s) · {dayArrivals.length} arrivée(s) · {dayDepartures.length} départ(s)
            </p>

            <div className="rounded-md border p-3 space-y-2">
              <p className="text-sm font-medium">
                Occupation: {occupiedRooms}/{totalRooms} chambres ({occupancyPct}%)
              </p>
              <div className="h-2 w-full rounded bg-muted overflow-hidden">
                <div className={`h-full ${occupancyBarClass}`} style={{ width: `${Math.min(100, occupancyPct)}%` }} />
              </div>
              <p className="text-xs text-muted-foreground">
                Arrivées: {dayArrivals.length} | Départs: {dayDepartures.length} | Siestes: {daySiestes.length}
              </p>
              <p className="text-sm font-semibold">Revenus du jour: {formatFCFA(revenueOfDay)}</p>
            </div>
            {selectedEvent && (
              <div className="rounded-md border p-2 bg-muted/40 text-xs">
                <p className="font-semibold">Événement sélectionné</p>
                <p>{selectedEvent.type === 'stay' ? 'Séjour' : selectedEvent.type === 'reservation' ? 'Réservation' : 'Sieste'}</p>
              </div>
            )}
          </CardHeader>

          <CardContent>
            <Accordion type="multiple" defaultValue={['arrivees', 'stays', 'departs', 'reservations', 'siestes']} className="w-full">
              <AccordionItem value="arrivees">
                <AccordionTrigger className="text-green-700">Arrivées du jour</AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2">
                    {dayArrivals.length === 0 && <p className="text-sm text-muted-foreground">Aucune activité</p>}
                    {dayArrivals.map((r: any) => (
                      <div key={r.id} className="rounded border p-2 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-semibold">
                              {(r.guest_name || '?').split(' ').slice(0, 2).map((p: string) => p[0] || '').join('').toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium text-sm">{r.guest_name}</p>
                              <p className="text-xs text-muted-foreground">{r.room_categories?.name || 'Catégorie'}</p>
                            </div>
                          </div>
                          <Badge variant="outline">Ch.{r.rooms?.room_number || '-'}</Badge>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {computeNights(r.check_in_date, r.check_out_date)} nuit(s)
                        </div>
                        <div className="flex items-center justify-between">
                          <Badge variant={r.status === 'confirmed' ? 'default' : 'secondary'}>
                            {r.status === 'confirmed' ? 'Payé' : 'En attente'}
                          </Badge>
                          {r.status !== 'checked_in' && (
                            <Button size="sm" variant="outline" onClick={() => navigate(`/accueil?reservationId=${r.id}`)}>
                              Check-in
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="stays">
                <AccordionTrigger className="text-blue-700">Séjours en cours</AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2">
                    {dayStays.length === 0 && <p className="text-sm text-muted-foreground">Aucune activité</p>}
                    {dayStays.map((s: any) => {
                      const totalDays = computeNights(s.check_in_date, s.check_out_date);
                      const dayIndex = Math.max(1, Math.floor((new Date(`${selectedDate}T12:00:00`).getTime() - new Date(s.check_in_date).getTime()) / 86400000) + 1);
                      return (
                        <div key={s.id} className="rounded border p-2 space-y-1">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium">{s.guests?.last_name} {s.guests?.first_name}</p>
                            <Badge variant="outline">Ch.{s.rooms?.room_number || '-'}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">Jour {Math.min(dayIndex, totalDays)} sur {totalDays}</p>
                          <div className="flex items-center justify-between">
                            <p className="text-xs text-red-600">Solde: {formatFCFA(s.linkedInvoice?.balance_due || 0)}</p>
                            <Button size="sm" variant="ghost" onClick={() => navigate(`/billing?invoiceId=${s.linkedInvoice?.id || s.invoice_id || ''}`)}>
                              Voir la facture
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="departs">
                <AccordionTrigger className="text-orange-700">Départs du jour</AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2">
                    {dayDepartures.length === 0 && <p className="text-sm text-muted-foreground">Aucune activité</p>}
                    {dayDepartures.map((s: any) => (
                      <div key={s.id} className="rounded border p-2 space-y-1">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium">{s.guests?.last_name} {s.guests?.first_name}</p>
                          <Badge variant="outline">Ch.{s.rooms?.room_number || '-'}</Badge>
                        </div>
                        <p className="text-xs">Total: {formatFCFA(s.linkedInvoice?.total_amount || s.total_price || 0)}</p>
                        <p className="text-xs">Payé: {formatFCFA(s.linkedInvoice?.amount_paid || 0)}</p>
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-red-600">Solde: {formatFCFA(s.linkedInvoice?.balance_due || 0)}</p>
                          <Button size="sm" variant="outline" onClick={() => navigate(`/check-in-out?stayId=${s.id}&mode=checkout`)}>
                            Check-out
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="reservations">
                <AccordionTrigger className="text-amber-700">Réservations</AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2">
                    {dayReservations.length === 0 && <p className="text-sm text-muted-foreground">Aucune activité</p>}
                    {dayReservations.map((r: any) => (
                      <div key={r.id} className="rounded border p-2 space-y-1">
                        <p className="text-sm font-medium">{r.guest_name}</p>
                        <p className="text-xs text-muted-foreground">#{r.reservation_number} · {r.room_categories?.name || 'Catégorie'}</p>
                        <p className="text-xs">{toDateKey(r.check_in_date)} → {toDateKey(r.check_out_date)}</p>
                        <div className="flex items-center justify-between">
                          <Badge variant={r.status === 'confirmed' ? 'default' : 'secondary'}>{r.status}</Badge>
                          {r.status === 'pending' && (
                            <Button size="sm" variant="outline" onClick={() => confirmReservationMutation.mutate(r.id)}>
                              Confirmer
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="siestes">
                <AccordionTrigger className="text-purple-700">Siestes</AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2">
                    {daySiestes.length === 0 && <p className="text-sm text-muted-foreground">Aucune activité</p>}
                    {daySiestes.map((s: any) => (
                      <div key={s.id} className="rounded border p-2 space-y-1">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium">{s.guests ? `${s.guests.last_name} ${s.guests.first_name}` : s.full_name}</p>
                          <Badge variant="outline">Ch.{s.rooms?.room_number || '-'}</Badge>
                        </div>
                        <p className="text-xs">{(s.arrival_time || '').slice(0, 5)} → {(s.departure_time || s.arrival_time || '').slice(0, 5)}</p>
                        <p className="text-xs">Durée: {s.duration_hours || 0}h</p>
                        <p className="text-xs">Montant payé: {formatFCFA(s.amount_paid || 0)}</p>
                        <Badge variant={s.departure_time ? 'outline' : 'secondary'}>{s.departure_time ? 'Terminée' : 'En cours'}</Badge>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CalendarPage;
