import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useHotel } from '@/contexts/HotelContext';
import { useI18n } from '@/contexts/I18nContext';
import { useRoleGuard } from '@/hooks/useRoleGuard';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { PaymentDialog } from '@/components/shared/PaymentDialog';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { formatFCFA, formatDate, generateInvoiceNumber } from '@/utils/formatters';
import { generateCustomerDossier, generatePoliceRegister } from '@/utils/pdfGenerators';
import { fetchCustomerDossierData, fetchPoliceRegisterRows, getCurrentWeekRange } from '@/services/guestDocumentService';
import { enqueueOfflineSubmission } from '@/services/offlineSubmissionQueue';
import { getOrCreateInvoice, addChargeToInvoice, isSiesteInvoiceItem } from '@/services/transactionService';
import { withAudit } from '@/utils/auditLog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { Users, Plus, Search, Pencil, Trash2, BedDouble, Eye, ArrowLeft, ChevronDown, ChevronUp, Download, FileText, MoreVertical, ScanLine, ShieldAlert } from 'lucide-react';
import { TierBadge } from '@/components/shared/TierBadge';
import { usePermission } from '@/hooks/usePermission';
import { CniScanner, CniData } from '@/components/shared/CniScanner';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

const guestSchema = z.object({
  last_name: z.string().min(1, 'Nom requis'),
  first_name: z.string().min(1, 'Prénom requis'),
  maiden_name: z.string().optional(),
  gender: z.string().optional(),
  nationality: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('Email invalide').optional().or(z.literal('')),
  date_of_birth: z.string().optional(),
  place_of_birth: z.string().optional(),
  country_of_residence: z.string().optional(),
  usual_address: z.string().optional(),
  profession: z.string().optional(),
  id_type: z.string().optional(),
  id_number: z.string().optional(),
  id_issued_on: z.string().optional(),
  id_issued_at: z.string().optional(),
  notes: z.string().optional(),
});

const staySchema = z.object({
  stay_type: z.string().default('night'),
  room_id: z.string().min(1, 'Chambre requise'),
  check_in_date: z.string().min(1, 'Date requise'),
  check_out_date: z.string().min(1, 'Date requise'),
  number_of_adults: z.coerce.number().min(1).default(1),
  number_of_children: z.coerce.number().min(0).default(0),
  arrangement: z.string().optional(),
  price_per_night: z.coerce.number().min(0).default(0),
  notes: z.string().optional(),
});

type GuestForm = z.infer<typeof guestSchema>;
type StayForm = z.infer<typeof staySchema>;

const GuestsPage = () => {
  useRoleGuard(['admin', 'manager', 'receptionist']);
  const { t } = useI18n();
  const { profile } = useAuth();
  const { hotel } = useHotel();
  const navigate = useNavigate();
  const { guestId: guestIdParam } = useParams();
  const qc = useQueryClient();
  const canChangeTier = usePermission('guests.change_tier');
  const canViewFinancial = usePermission('guests.view_financial');
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [stayDialogOpen, setStayDialogOpen] = useState(false);
  const [editingGuest, setEditingGuest] = useState<any>(null);
  const [deleteGuest, setDeleteGuest] = useState<any>(null);
  const [cniScannerOpen, setCniScannerOpen] = useState(false);
  const [tierDialogOpen, setTierDialogOpen] = useState(false);
  const [tierTargetGuest, setTierTargetGuest] = useState<any>(null);
  const [tierForm, setTierForm] = useState({ tier: 'regular', notes: '' });
  const [selectedGuestId, setSelectedGuestId] = useState<string | null>(null);
  const [stayGuestId, setStayGuestId] = useState<string | null>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentContext, setPaymentContext] = useState<any>(null);
  const [expandedStayId, setExpandedStayId] = useState<string | null>(null);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyStay, setHistoryStay] = useState<any>(null);
  const [historySearch, setHistorySearch] = useState('');

  useEffect(() => {
    if (guestIdParam) {
      setSelectedGuestId(guestIdParam);
    } else {
      setSelectedGuestId(null);
    }
  }, [guestIdParam]);

  const guestForm = useForm<GuestForm>({
    resolver: zodResolver(guestSchema),
    defaultValues: { nationality: 'Camerounaise', country_of_residence: 'Cameroun' },
  });

  const stayForm = useForm<StayForm>({
    resolver: zodResolver(staySchema),
    defaultValues: { stay_type: 'night', number_of_adults: 1, number_of_children: 0, price_per_night: 0 },
  });

  const stayCheckIn = stayForm.watch('check_in_date');
  const stayCheckOut = stayForm.watch('check_out_date');
  const stayPPN = stayForm.watch('price_per_night');
  const stayType = stayForm.watch('stay_type');
  const stayRoomId = stayForm.watch('room_id');
  const nights = stayCheckIn && stayCheckOut ? Math.max(1, Math.ceil((new Date(stayCheckOut).getTime() - new Date(stayCheckIn).getTime()) / 86400000)) : 0;
  const totalPrice = stayType === 'sieste' ? (stayPPN || 0) : nights * (stayPPN || 0);

  // Fetch guests with stay counts
  const { data: guests, isLoading } = useQuery({
    queryKey: ['guests', hotel?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('guests')
        .select('*')
        .eq('hotel_id', hotel!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!hotel?.id,
  });

  // Fetch stays for counting
  const { data: allStays } = useQuery({
    queryKey: ['stays-all', hotel?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stays')
        .select('id, guest_id, status, check_in_date, room_id, rooms(room_number), invoices!stays_invoice_id_fkey(balance_due, amount_paid, total_amount)')
        .eq('hotel_id', hotel!.id)
        .order('check_in_date', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!hotel?.id,
  });

  const { data: allSiestes } = useQuery({
    queryKey: ['siestes-all', hotel?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('siestes')
        .select('id, guest_id, arrival_date, arrival_time, departure_date, departure_time')
        .eq('hotel_id', hotel!.id)
        .order('arrival_date', { ascending: false })
        .order('arrival_time', { ascending: false });
      return data || [];
    },
    enabled: !!hotel?.id,
  });

  const { data: rooms } = useQuery({
    queryKey: ['rooms-available', hotel?.id],
    queryFn: async () => {
      const { data } = await supabase.from('rooms').select('id, room_number, price_per_night, category_id, room_categories(price_sieste)').eq('hotel_id', hotel!.id).eq('status', 'available');
      return data || [];
    },
    enabled: !!hotel?.id,
  });

  // Selected guest profile data
  const selectedGuest = guests?.find(g => g.id === selectedGuestId);
  const { data: guestStays } = useQuery({
    queryKey: ['guest-stays', selectedGuestId],
    queryFn: async () => {
      const { data } = await supabase
        .from('stays')
        .select(`
          *,
          rooms(room_number, room_categories(name)),
          invoices!stays_invoice_id_fkey(
            invoice_number,
            total_amount,
            amount_paid,
            balance_due,
            status,
            invoice_items(description, item_type, quantity, unit_price, subtotal)
          )
        `)
        .eq('guest_id', selectedGuestId!)
        .eq('hotel_id', hotel!.id)
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!selectedGuestId && !!hotel?.id,
  });

  const stayCountMap = useMemo(() => {
    const map: Record<string, { count: number; lastVisit: string | null; hasActive: boolean; paymentStatus: string | null }> = {};
    const seen = new Set<string>();
    allStays?.forEach(s => {
      if (!s.id || seen.has(s.id)) return;
      seen.add(s.id);
      if (!map[s.guest_id]) map[s.guest_id] = { count: 0, lastVisit: null, hasActive: false, paymentStatus: null };
      map[s.guest_id].count++;
      if (!map[s.guest_id].lastVisit || (s.check_in_date && s.check_in_date > map[s.guest_id].lastVisit!)) {
        map[s.guest_id].lastVisit = s.check_in_date;
      }
      if (s.status === 'active') {
        map[s.guest_id].hasActive = true;
        const inv = (s as any).invoices;
        if (!inv) {
          map[s.guest_id].paymentStatus = 'pending';
        } else if ((inv.balance_due || 0) <= 0) {
          map[s.guest_id].paymentStatus = 'paid';
        } else if ((inv.amount_paid || 0) > 0) {
          map[s.guest_id].paymentStatus = 'partial';
        } else {
          map[s.guest_id].paymentStatus = 'pending';
        }
      }
    });

    const siesteSeen = new Set<string>();
    allSiestes?.forEach((s: any) => {
      if (!s?.id || !s?.guest_id || siesteSeen.has(s.id)) return;
      siesteSeen.add(s.id);
      if (!map[s.guest_id]) map[s.guest_id] = { count: 0, lastVisit: null, hasActive: false, paymentStatus: null };

      map[s.guest_id].count++;
      const visitDate = s.departure_date || s.arrival_date || null;
      if (visitDate && (!map[s.guest_id].lastVisit || visitDate > map[s.guest_id].lastVisit!)) {
        map[s.guest_id].lastVisit = visitDate;
      }

      if (!s.departure_time) {
        map[s.guest_id].hasActive = true;
        if (!map[s.guest_id].paymentStatus) {
          map[s.guest_id].paymentStatus = 'pending';
        }
      }
    });

    return map;
  }, [allStays, allSiestes]);

  const getLiveStayStats = (stay: any) => {
    const now = new Date();
    const checkIn = new Date(stay.check_in_date);
    const endDate = stay.actual_check_out ? new Date(stay.actual_check_out) : now;
    const isSieste = stay.stay_type === 'sieste';
    const negotiatedTotal = Number(stay.arrangement_price || 0);
    const configuredUnits = isSieste
      ? 1
      : Math.max(1, Number(stay.number_of_nights || 1));
    const baseUnitPrice = negotiatedTotal > 0
      ? negotiatedTotal / configuredUnits
      : Number(stay.price_per_night || 0);

    const elapsedUnits = isSieste
      ? Math.max(1, Math.ceil((endDate.getTime() - checkIn.getTime()) / 3600000))
      : Math.max(1, Math.ceil((endDate.getTime() - checkIn.getTime()) / 86400000));

    const invoiceItems = stay.invoices?.invoice_items || [];
    const roomItems = invoiceItems.filter((item: any) => isSieste ? isSiesteInvoiceItem(item) : item.item_type === 'room');
    const billedRoomSubtotal = roomItems.reduce((sum: number, item: any) => sum + Number(item.subtotal || 0), 0);

    const expectedRoomSubtotal = elapsedUnits * baseUnitPrice;
    const deltaRoomCharge = Math.max(0, expectedRoomSubtotal - billedRoomSubtotal);
    const estimatedTotal = Number(stay.invoices?.total_amount || stay.total_price || 0) + deltaRoomCharge;
    const amountPaid = Number(stay.invoices?.amount_paid || 0);
    const estimatedBalance = Math.max(0, estimatedTotal - amountPaid);

    return {
      elapsedUnits,
      estimatedTotal,
      estimatedBalance,
      deltaRoomCharge,
      unitLabel: isSieste ? 'h' : 'nuit(s)',
      isSieste,
    };
  };

  const getExactNights = (stay: any) => {
    if (stay?.stay_type === 'sieste') return '-';
    const start = stay?.check_in_date ? new Date(stay.check_in_date) : null;
    const endRaw = stay?.actual_check_out || stay?.check_out_date;
    const end = endRaw ? new Date(endRaw) : null;
    if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return stay?.number_of_nights || '-';
    }
    return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000));
  };

  const getCategoryLabel = (item: any) => {
    if (item?.item_type === 'room' || isSiesteInvoiceItem(item)) return t('guests.history.lodging');
    if (item?.item_type === 'restaurant') return t('guests.history.restaurant');
    if (item?.item_type === 'bar' || item?.item_type === 'minibar') return t('guests.history.bar');
    return t('guests.history.extras');
  };

  const filteredHistoryItems = React.useMemo(() => {
    const items = historyStay?.invoices?.invoice_items || [];
    const q = historySearch.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it: any) =>
      `${it.description || ''} ${it.item_type || ''}`.toLowerCase().includes(q),
    );
  }, [historyStay, historySearch]);

  const groupedHistoryItems = React.useMemo(() => {
    const groups: Record<string, any[]> = {
      Hebergement: [],
      Restaurant: [],
      Bar: [],
      Extras: [],
    };
    filteredHistoryItems.forEach((it: any) => {
      const category = getCategoryLabel(it);
      groups[category].push(it);
    });
    return groups;
  }, [filteredHistoryItems]);

  const handlePreviewIdDocument = (url?: string | null) => {
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleDownloadIdDocument = (url?: string | null) => {
    if (!url) return;
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.download = 'piece-identite';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const categoryTotals = React.useMemo(() => {
    const totals: Record<string, number> = {};
    Object.entries(groupedHistoryItems).forEach(([category, items]) => {
      totals[category] = items.reduce((sum: number, it: any) => sum + (it.subtotal || 0), 0);
    });
    return totals;
  }, [groupedHistoryItems]);

  const printHistory = () => {
    if (!historyStay) return;
    const invoice = historyStay.invoices;
    const allItems = filteredHistoryItems;
    const rows = allItems.map((it: any) => `
      <tr>
        <td style="padding:8px;border:1px solid #ddd;">${it.description || ''}</td>
        <td style="padding:8px;border:1px solid #ddd;">${getCategoryLabel(it.item_type || 'extra')}</td>
        <td style="padding:8px;border:1px solid #ddd;text-align:right;">${it.quantity || 0}</td>
        <td style="padding:8px;border:1px solid #ddd;text-align:right;">${formatFCFA(it.unit_price || 0)}</td>
        <td style="padding:8px;border:1px solid #ddd;text-align:right;">${formatFCFA(it.subtotal || 0)}</td>
      </tr>
    `).join('');

    const printable = window.open('', '_blank');
    if (!printable) return;
    printable.document.write(`
      <html>
        <head><title>${t('guests.profile.consumptionHistory')}</title></head>
        <body style="font-family:Arial,sans-serif;padding:24px;">
          <h2>${t('guests.profile.consumptionHistory')}</h2>
          <p>${t('reports.table.guest')}: ${selectedGuest?.last_name || ''} ${selectedGuest?.first_name || ''}</p>
          <p>${t('guests.profile.invoiceLabel')}: ${invoice?.invoice_number || '-'} | ${t('reports.table.room')}: ${historyStay?.rooms?.room_number || '-'}</p>
          <table style="width:100%;border-collapse:collapse;margin-top:12px;">
            <thead>
              <tr>
                <th style="padding:8px;border:1px solid #ddd;text-align:left;">${t('billing.table.description')}</th>
                <th style="padding:8px;border:1px solid #ddd;text-align:left;">${t('billing.table.type')}</th>
                <th style="padding:8px;border:1px solid #ddd;text-align:right;">${t('billing.table.qty')}</th>
                <th style="padding:8px;border:1px solid #ddd;text-align:right;">${t('billing.table.unitPrice')}</th>
                <th style="padding:8px;border:1px solid #ddd;text-align:right;">${t('billing.table.subtotal')}</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          <p style="margin-top:16px;"><strong>${t('guests.profile.invoiceTotal')}: ${formatFCFA(invoice?.total_amount || 0)}</strong></p>
          <p><strong>${t('guests.profile.paid')}: ${formatFCFA(invoice?.amount_paid || 0)}</strong></p>
          <p><strong>${t('guests.profile.balance')}: ${formatFCFA(invoice?.balance_due || 0)}</strong></p>
        </body>
      </html>
    `);
    printable.document.close();
    printable.focus();
    printable.print();
  };

  const isNetworkIssue = (error: any) => {
    const message = String(error?.message || error || '').toLowerCase();
    return message.includes('fetch') || message.includes('network') || message.includes('offline') || message.includes('timeout');
  };

  const saveMutation = useMutation({
    mutationFn: async (values: GuestForm) => {
      const payload: any = {
        ...values,
        hotel_id: hotel!.id,
        email: values.email || null,
      };
      try {
        if (editingGuest) {
          const { error } = await supabase.from('guests').update(payload).eq('id', editingGuest.id);
          if (error) throw error;
          await withAudit(hotel!.id, profile!.id, profile!.full_name || '', 'update', 'guests', editingGuest.id, editingGuest, payload);
        } else {
          let existingGuest: any = null;
          if (values.phone) {
            const { data } = await supabase
              .from('guests')
              .select('id')
              .eq('hotel_id', hotel!.id)
              .eq('phone', values.phone)
              .maybeSingle();
            existingGuest = data;
          }

          if (!existingGuest && values.id_number) {
            const { data } = await supabase
              .from('guests')
              .select('id')
              .eq('hotel_id', hotel!.id)
              .eq('id_number', values.id_number)
              .maybeSingle();
            existingGuest = data;
          }

          if (!existingGuest) {
            const { data } = await supabase
              .from('guests')
              .select('id')
              .eq('hotel_id', hotel!.id)
              .ilike('last_name', values.last_name)
              .ilike('first_name', values.first_name)
              .maybeSingle();
            existingGuest = data;
          }

          if (existingGuest?.id) {
            const { error } = await supabase.from('guests').update(payload).eq('id', existingGuest.id);
            if (error) throw error;
            return { queued: false, duplicate: true };
          }

          const { data, error } = await supabase.from('guests').insert(payload).select().single();
          if (error) throw error;
          await withAudit(hotel!.id, profile!.id, profile!.full_name || '', 'create', 'guests', data.id, null, payload);
        }
        return { queued: false, duplicate: false };
      } catch (error) {
        if (isNetworkIssue(error)) {
          enqueueOfflineSubmission({
            type: 'guest-upsert',
            createdAt: new Date().toISOString(),
            payload: {
              hotelId: hotel!.id,
              guestId: editingGuest?.id,
              values,
            },
          });
          return { queued: true };
        }
        throw error;
      }
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['guests'] });
      if (result?.queued) {
        toast.success('Enregistre localement. Synchronisation en attente du reseau.');
      } else if (result?.duplicate && !editingGuest) {
        toast.success('Client deja existant mis a jour pour eviter un doublon.');
      } else {
        toast.success(editingGuest ? t('guests.updated') : t('guests.created'));
      }
      closeDialog();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const createStayMutation = useMutation({
    mutationFn: async (values: StayForm) => {
      if (!stayGuestId || !hotel || !profile) throw new Error('Missing context');

      try {
        // Create stay first then link invoice and post charge via centralized service
        const { data: stay, error: stayErr } = await supabase.from('stays').insert({
          hotel_id: hotel.id,
          guest_id: stayGuestId,
          stay_type: values.stay_type,
          room_id: values.room_id,
          check_in_date: new Date(values.check_in_date).toISOString(),
          check_out_date: new Date(values.check_out_date).toISOString(),
          number_of_nights: nights,
          number_of_adults: values.number_of_adults,
          number_of_children: values.number_of_children,
          arrangement: values.arrangement || null,
          price_per_night: values.price_per_night,
          total_price: totalPrice,
          status: 'active',
          payment_status: 'pending',
          receptionist_id: profile.id,
          receptionist_name: profile.full_name,
          created_by: profile.id,
          created_by_name: profile.full_name,
          notes: values.notes || null,
        } as any).select().single();
        if (stayErr) throw stayErr;

        const invoice = await getOrCreateInvoice(hotel.id, stay.id, stayGuestId);
        await addChargeToInvoice({
          hotelId: hotel.id,
          invoiceId: invoice.id,
          stayId: stay.id,
          guestId: stayGuestId,
          description: `Hébergement — ${nights} nuit(s)`,
          itemType: 'room',
          quantity: nights,
          unitPrice: values.price_per_night,
        });

        // Safety: also update room to occupied
        await supabase.from('rooms').update({ status: 'occupied' }).eq('id', values.room_id);

        await withAudit(hotel.id, profile.id, profile.full_name || '', 'create_stay', 'stays', stay.id, null, { guest_id: stayGuestId, room_id: values.room_id });
        return { queued: false };
      } catch (error) {
        if (isNetworkIssue(error)) {
          enqueueOfflineSubmission({
            type: 'guest-stay-create',
            createdAt: new Date().toISOString(),
            payload: {
              hotelId: hotel.id,
              guestId: stayGuestId,
              values: {
                stay_type: values.stay_type || 'night',
                room_id: values.room_id,
                check_in_date: values.check_in_date,
                check_out_date: values.check_out_date,
                number_of_adults: Number(values.number_of_adults || 1),
                number_of_children: Number(values.number_of_children || 0),
                arrangement: values.arrangement || undefined,
                price_per_night: Number(values.price_per_night || 0),
                notes: values.notes || undefined,
              },
              receptionist: {
                id: profile.id,
                full_name: profile.full_name || '',
              },
              nights,
              totalPrice,
            },
          });
          return { queued: true };
        }
        throw error;
      }
    },
    onSuccess: (result) => {
      // Invalidate all queries that depend on stay status across the app
      qc.invalidateQueries({ queryKey: ['stays-all'] });
      qc.invalidateQueries({ queryKey: ['guest-stays'] });
      qc.invalidateQueries({ queryKey: ['active-stays-count'] });
      qc.invalidateQueries({ queryKey: ['guests'] });
      qc.invalidateQueries({ queryKey: ['rooms'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['pending-payments'] });
      qc.invalidateQueries({ queryKey: ['invoices'] });
      toast.success(result?.queued ? 'Sejour mis en file locale. Synchronisation en attente du reseau.' : t('guests.stayCreated'));
      setStayDialogOpen(false);
      stayForm.reset();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('guests').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['guests'] });
      toast.success(t('guests.deleted'));
      setDeleteGuest(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingGuest(null);
    guestForm.reset({ nationality: 'Camerounaise', country_of_residence: 'Cameroun' });
  };

  const openEdit = (guest: any) => {
    setEditingGuest(guest);
    Object.keys(guestSchema.shape).forEach((key) => {
      const val = guest[key];
      if (val !== undefined && val !== null) guestForm.setValue(key as any, key.includes('date') && val ? val.split('T')[0] : val);
    });
    setDialogOpen(true);
  };

  const openNewStay = (guestId: string) => {
    setStayGuestId(guestId);
    stayForm.reset({ stay_type: 'night', number_of_adults: 1, number_of_children: 0, price_per_night: 0, check_in_date: new Date().toISOString().split('T')[0] });
    setStayDialogOpen(true);
  };

  const filtered = guests?.filter(g => {
    return !search || `${g.last_name} ${g.first_name} ${g.id_number || ''} ${g.phone || ''}`.toLowerCase().includes(search.toLowerCase());
  }) || [];

  const handleDownloadDossier = async (guestId: string) => {
    if (!hotel) return;
    try {
      const dossier = await fetchCustomerDossierData(hotel.id, guestId);
      await generateCustomerDossier({
        guest: dossier.guest,
        hotel,
        stays: dossier.stays,
        siestes: dossier.siestes,
        payments: dossier.payments,
        generatedBy: profile?.full_name || 'Reception',
      });
    } catch (error: any) {
      toast.error(error.message || 'Impossible de generer le dossier client');
    }
  };

  const handleExportPoliceRegister = async () => {
    if (!hotel) return;
    const range = getCurrentWeekRange();
    try {
      const rows = await fetchPoliceRegisterRows(hotel.id, range.start, range.end);
      await generatePoliceRegister({
        hotel,
        guests: rows,
        periodStart: range.start,
        periodEnd: range.end,
        generatedBy: profile?.full_name || 'Reception',
      });
    } catch (error: any) {
      toast.error(error.message || 'Impossible de generer le registre de police');
    }
  };

  // ---- GUEST PROFILE VIEW ----
  if (selectedGuestId && selectedGuest) {
    const activeStays = (guestStays || [])
      .filter((s: any) => s.status === 'active')
      .sort((a: any, b: any) => new Date(b.check_in_date).getTime() - new Date(a.check_in_date).getTime());
    const activeStaySummaries = activeStays.map((stay: any) => ({
      stay,
      liveStats: getLiveStayStats(stay),
    }));
    const totalActiveEstimated = activeStaySummaries.reduce((sum, entry) => sum + (entry.liveStats?.estimatedTotal || Number((entry.stay as any).invoices?.total_amount || entry.stay.total_price || 0)), 0);
    const totalActiveBalance = activeStaySummaries.reduce((sum, entry) => sum + (entry.liveStats?.estimatedBalance || Number((entry.stay as any).invoices?.balance_due || 0)), 0);
    const lifetimeValue = guestStays?.reduce((sum, s: any) => sum + ((s as any).invoices?.amount_paid || 0), 0) || 0;
    return (
      <div className="page-container space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/guests')} title={t('common.back')}><ArrowLeft className="h-5 w-5" /></Button>
          <PageHeader title={`${selectedGuest.last_name} ${selectedGuest.first_name}`} subtitle={t('guests.profile.title')}>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => openEdit(selectedGuest)}><Pencil className="h-4 w-4 mr-2" />{t('guests.profile.edit')}</Button>
              <Button onClick={() => openNewStay(selectedGuest.id)}><Plus className="h-4 w-4 mr-2" />{t('guests.newStay')}</Button>
              <Button variant="secondary" onClick={() => handleDownloadDossier(selectedGuest.id)}><Download className="h-4 w-4 mr-2" />Telecharger le dossier complet</Button>
            </div>
          </PageHeader>
        </div>

        {/* Personal info card */}
        <Card>
          <CardHeader><CardTitle>{t('guests.profile.personalInfo')}</CardTitle></CardHeader>
          <CardContent>
            <div className="mb-4 flex gap-3">
              <div className="flex-1 p-3 rounded-lg bg-primary/10 border border-primary/20">
                <p className="text-sm text-muted-foreground">{t('guests.profile.lifetimeValue')}</p>
                <p className="text-2xl font-bold text-primary">{formatFCFA(lifetimeValue)}</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 border flex flex-col gap-2 items-start">
                <p className="text-sm text-muted-foreground">Niveau fidélité</p>
                <div className="flex items-center gap-2">
                  <TierBadge tier={(selectedGuest as any).tier || 'regular'} />
                  <span className="text-sm font-medium">{(selectedGuest as any).loyalty_points || 0} pts</span>
                </div>
                {canChangeTier && (
                  <Button size="sm" variant="outline" onClick={() => {
                    setTierTargetGuest(selectedGuest);
                    setTierForm({ tier: (selectedGuest as any).tier || 'regular', notes: (selectedGuest as any).tier_notes || '' });
                    setTierDialogOpen(true);
                  }}>
                    <ShieldAlert className="h-4 w-4 mr-1" />Changer le niveau
                  </Button>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div><span className="text-muted-foreground">{t('guests.profile.gender')}:</span> {selectedGuest.gender || '-'}</div>
              <div><span className="text-muted-foreground">{t('guests.profile.birthDate')}:</span> {formatDate(selectedGuest.date_of_birth)}</div>
              <div><span className="text-muted-foreground">{t('guests.profile.birthPlace')}:</span> {selectedGuest.place_of_birth || '-'}</div>
              <div><span className="text-muted-foreground">{t('guests.profile.nationality')}:</span> {selectedGuest.nationality || '-'}</div>
              <div><span className="text-muted-foreground">{t('guests.profile.phone')}:</span> {selectedGuest.phone || '-'}</div>
              <div><span className="text-muted-foreground">{t('guests.profile.email')}:</span> {selectedGuest.email || '-'}</div>
              <div><span className="text-muted-foreground">{t('guests.profile.profession')}:</span> {selectedGuest.profession || '-'}</div>
              <div><span className="text-muted-foreground">{t('guests.profile.address')}:</span> {selectedGuest.usual_address || '-'}</div>
              <div><span className="text-muted-foreground">{t('guests.profile.id')}:</span> {selectedGuest.id_type || '-'} {selectedGuest.id_number || ''}</div>
              <div><span className="text-muted-foreground">{t('guests.profile.issuedOn')}:</span> {formatDate(selectedGuest.id_issued_on)}</div>
              <div><span className="text-muted-foreground">{t('guests.profile.issuedAt')}:</span> {selectedGuest.id_issued_at || '-'}</div>
            </div>
            {(selectedGuest as any).id_document_url && (
              <div className="mt-4 rounded-md border p-3">
                <p className="text-sm font-medium mb-2">Pièce scannée</p>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => handlePreviewIdDocument((selectedGuest as any).id_document_url)}>
                    <Eye className="h-4 w-4 mr-1" />Aperçu CNI
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => handleDownloadIdDocument((selectedGuest as any).id_document_url)}>
                    <Download className="h-4 w-4 mr-1" />Télécharger CNI
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Active stay */}
        {activeStaySummaries.length > 0 && (
          <Card className="border-primary">
            <CardHeader><CardTitle className="flex items-center gap-2"><BedDouble className="h-5 w-5" />{activeStaySummaries.length > 1 ? 'Séjours actifs' : t('guests.profile.activeStay')}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {activeStaySummaries.length > 1 && (
                <div className="grid gap-4 md:grid-cols-3 rounded-md border bg-primary/5 p-4 text-sm">
                  <div><span className="text-muted-foreground">Services actifs:</span> <span className="font-bold">{activeStaySummaries.length}</span></div>
                  <div><span className="text-muted-foreground">{t('common.total')}:</span> <span className="font-bold">{formatFCFA(totalActiveEstimated)}</span></div>
                  <div><span className="text-muted-foreground">{t('guests.profile.balance')}:</span> <span className="font-bold text-destructive">{formatFCFA(totalActiveBalance)}</span></div>
                </div>
              )}

              {activeStaySummaries.map(({ stay, liveStats }) => {
                const currentBalance = liveStats?.estimatedBalance || Number((stay as any).invoices?.balance_due || 0);
                return (
                  <div key={stay.id} className="rounded-md border p-4">
                    <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-4">
                      <div><span className="text-muted-foreground">{t('reports.table.room')}:</span> <span className="font-bold">{(stay as any).rooms?.room_number}</span></div>
                      <div><span className="text-muted-foreground">{t('guests.profile.checkin')}:</span> {formatDate(stay.check_in_date)}</div>
                      <div><span className="text-muted-foreground">{t('guests.profile.checkout')}:</span> {formatDate(stay.check_out_date)}</div>
                      <div><span className="text-muted-foreground">{t('common.total')}:</span> <span className="font-bold">{formatFCFA(liveStats?.estimatedTotal || Number((stay as any).invoices?.total_amount || stay.total_price || 0))}</span></div>
                    </div>
                    <div className="mt-2 text-sm text-muted-foreground">
                      Duree en cours: <span className="font-medium">{liveStats?.elapsedUnits || 0} {liveStats?.unitLabel || ''}</span>
                      {(liveStats?.deltaRoomCharge || 0) > 0 && (
                        <span className="ml-2 text-orange-600">(+{formatFCFA(liveStats?.deltaRoomCharge || 0)} a regulariser)</span>
                      )}
                    </div>
                    {currentBalance > 0 && (
                      <div className="mt-4 flex items-center justify-between rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2">
                        <p className="text-destructive font-semibold">{t('guests.profile.balance')}: {formatFCFA(currentBalance)}</p>
                        <Button className="bg-green-600 hover:bg-green-700" onClick={() => {
                          setPaymentContext({
                            invoiceId: stay.invoice_id,
                            stayId: stay.id,
                            guestId: stay.guest_id,
                            currentBalance,
                            invoiceNumber: (stay as any).invoices?.invoice_number,
                            roomNumber: (stay as any).rooms?.room_number,
                            guestName: `${selectedGuest.last_name} ${selectedGuest.first_name}`,
                          });
                          setPaymentDialogOpen(true);
                        }}>{t('guests.profile.markPaid')}</Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Stay history */}
        <Card>
          <CardHeader><CardTitle>{t('guests.profile.stayHistory')}</CardTitle></CardHeader>
          <CardContent>
            {!guestStays?.length ? (
              <p className="text-muted-foreground text-center py-4">{t('guests.profile.noStay')}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('reports.table.room')}</TableHead>
                    <TableHead>{t('billing.table.type')}</TableHead>
                    <TableHead>{t('guests.profile.checkin')}</TableHead>
                    <TableHead>Départ prévu</TableHead>
                    <TableHead>Départ final</TableHead>
                    <TableHead>Nuits exactes</TableHead>
                    <TableHead className="text-right">{t('common.total')}</TableHead>
                    <TableHead className="text-right">{t('guests.profile.balance')}</TableHead>
                    <TableHead>{t('common.status')}</TableHead>
                    <TableHead className="text-right">{t('common.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {guestStays.map(s => {
                    const isExpanded = expandedStayId === s.id;
                    const invoice = (s as any).invoices;
                    return (
                      <React.Fragment key={s.id}>
                        <TableRow>
                          <TableCell className="font-mono">{(s as any).rooms?.room_number || '-'}</TableCell>
                          <TableCell><Badge variant="outline">{s.stay_type === 'sieste' ? t('guests.dialog.stayDay') : t('guests.dialog.stayNight')}</Badge></TableCell>
                          <TableCell>{formatDate(s.check_in_date)}</TableCell>
                          <TableCell>{formatDate(s.check_out_date)}</TableCell>
                          <TableCell>{formatDate(s.actual_check_out)}</TableCell>
                          <TableCell>{getExactNights(s)}</TableCell>
                          <TableCell className="text-right">{formatFCFA(invoice?.total_amount || s.total_price)}</TableCell>
                          <TableCell className="text-right text-destructive font-medium">{formatFCFA(invoice?.balance_due || 0)}</TableCell>
                          <TableCell><StatusBadge status={s.status || 'active'} /></TableCell>
                          <TableCell className="text-right space-x-2">
                            <Button variant="outline" size="sm" onClick={() => setExpandedStayId(isExpanded ? null : s.id)}>
                              {isExpanded ? <ChevronUp className="h-3 w-3 mr-1" /> : <ChevronDown className="h-3 w-3 mr-1" />}
                              {t('common.details')}
                            </Button>
                            <Button variant="secondary" size="sm" onClick={() => {
                              setHistoryStay(s);
                              setHistorySearch('');
                              setHistoryModalOpen(true);
                            }}>{t('guests.profile.history')}</Button>
                            {(getLiveStayStats(s).estimatedBalance || invoice?.balance_due || 0) > 0 && s.invoice_id && (
                              <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => {
                                const liveStats = getLiveStayStats(s);
                                setPaymentContext({
                                  invoiceId: s.invoice_id,
                                  stayId: s.id,
                                  guestId: s.guest_id,
                                  currentBalance: liveStats.estimatedBalance || invoice?.balance_due || 0,
                                  invoiceNumber: invoice?.invoice_number,
                                  roomNumber: (s as any).rooms?.room_number,
                                  guestName: `${selectedGuest.last_name} ${selectedGuest.first_name}`,
                                });
                                setPaymentDialogOpen(true);
                              }}>{t('guests.profile.markPaid')}</Button>
                            )}
                          </TableCell>
                        </TableRow>
                        {isExpanded && (
                          <TableRow>
                            <TableCell colSpan={10}>
                              {!invoice?.invoice_items?.length ? (
                                <p className="text-sm text-muted-foreground py-2">{t('guests.profile.noInvoiceLines')}</p>
                              ) : (
                                <div className="rounded-md border p-3">
                                  <p className="text-sm font-semibold mb-2">{t('guests.profile.invoiceLabel')} {invoice?.invoice_number || '-'}</p>
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead>{t('billing.table.description')}</TableHead>
                                        <TableHead>{t('billing.table.type')}</TableHead>
                                        <TableHead className="text-right">{t('billing.table.qty')}</TableHead>
                                        <TableHead className="text-right">{t('billing.table.unitPrice')}</TableHead>
                                        <TableHead className="text-right">{t('billing.table.subtotal')}</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {invoice.invoice_items.map((item: any, idx: number) => (
                                        <TableRow key={`${s.id}-${idx}`}>
                                          <TableCell>{item.description}</TableCell>
                                          <TableCell>{isSiesteInvoiceItem(item) ? 'sieste' : item.item_type}</TableCell>
                                          <TableCell className="text-right">{item.quantity}</TableCell>
                                          <TableCell className="text-right">{formatFCFA(item.unit_price)}</TableCell>
                                          <TableCell className="text-right">{formatFCFA(item.subtotal)}</TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {paymentContext && (
          <PaymentDialog
            open={paymentDialogOpen}
            onOpenChange={setPaymentDialogOpen}
            invoiceId={paymentContext.invoiceId}
            stayId={paymentContext.stayId}
            guestId={paymentContext.guestId}
            currentBalance={paymentContext.currentBalance}
            invoiceNumber={paymentContext.invoiceNumber}
            roomNumber={paymentContext.roomNumber}
            guestName={paymentContext.guestName}
            onSuccess={() => {
              qc.invalidateQueries({ queryKey: ['guest-stays'] });
              qc.invalidateQueries({ queryKey: ['stays-all'] });
            }}
          />
        )}

        <Dialog open={historyModalOpen} onOpenChange={setHistoryModalOpen}>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t('guests.profile.consumptionHistory')}</DialogTitle>
              <DialogDescription>
                {t('guests.profile.invoiceLabel')} {historyStay?.invoices?.invoice_number || '-'} - {t('reports.table.room')} {historyStay?.rooms?.room_number || '-'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Input
                  placeholder={t('guests.profile.searchLine')}
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                />
                <Button variant="outline" onClick={printHistory}>{t('common.print')}</Button>
              </div>

              {Object.entries(groupedHistoryItems).map(([category, items]) => (
                <div key={category} className="rounded-md border p-3">
                  <div className="flex justify-between items-center mb-2">
                    <p className="font-semibold">{category}</p>
                    {items.length > 0 && <Badge variant="outline" className="text-xs">{formatFCFA(categoryTotals[category] || 0)}</Badge>}
                  </div>
                  {items.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t('guests.profile.noLine')}</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t('billing.table.description')}</TableHead>
                          <TableHead className="text-right">{t('billing.table.qty')}</TableHead>
                          <TableHead className="text-right">{t('billing.table.unitPrice')}</TableHead>
                          <TableHead className="text-right">{t('billing.table.subtotal')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map((it: any, idx: number) => (
                          <TableRow key={`${category}-${idx}`}>
                            <TableCell>{it.description}</TableCell>
                            <TableCell className="text-right">{it.quantity}</TableCell>
                            <TableCell className="text-right">{formatFCFA(it.unit_price)}</TableCell>
                            <TableCell className="text-right">{formatFCFA(it.subtotal)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              ))}

              <div className="rounded-md border bg-muted/40 p-3 text-sm">
                <p>{t('guests.profile.invoiceTotal')}: <span className="font-semibold">{formatFCFA(historyStay?.invoices?.total_amount || 0)}</span></p>
                <p>{t('guests.profile.paid')}: <span className="font-semibold">{formatFCFA(historyStay?.invoices?.amount_paid || 0)}</span></p>
                <p>{t('guests.profile.balance')}: <span className="font-semibold text-destructive">{formatFCFA(historyStay?.invoices?.balance_due || 0)}</span></p>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Dialogs rendered below */}
        {renderGuestDialog()}
        {renderStayDialog()}

        {/* Tier Change Dialog */}
        <Dialog open={tierDialogOpen} onOpenChange={setTierDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Changer le niveau — {tierTargetGuest?.last_name} {tierTargetGuest?.first_name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Nouveau niveau</Label>
                <Select value={tierForm.tier} onValueChange={v => setTierForm(p => ({ ...p, tier: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="regular">Regular</SelectItem>
                    <SelectItem value="silver">Silver</SelectItem>
                    <SelectItem value="gold">Gold</SelectItem>
                    <SelectItem value="vip">VIP</SelectItem>
                    <SelectItem value="blacklist">Blacklist</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Notes / Raison</Label>
                <Textarea value={tierForm.notes} onChange={e => setTierForm(p => ({ ...p, notes: e.target.value }))} placeholder="Raison du changement de niveau..." />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setTierDialogOpen(false)}>Annuler</Button>
              <Button onClick={async () => {
                if (!tierTargetGuest) return;
                try {
                  const { error } = await supabase.from('guests').update({
                    tier: tierForm.tier,
                    tier_notes: tierForm.notes || null,
                    tier_assigned_by: profile?.id,
                    tier_assigned_at: new Date().toISOString(),
                  } as any).eq('id', tierTargetGuest.id);
                  if (error) throw error;
                  qc.invalidateQueries({ queryKey: ['guests'] });
                  qc.invalidateQueries({ queryKey: ['guest', tierTargetGuest.id] });
                  toast.success('Niveau mis à jour');
                  setTierDialogOpen(false);
                } catch (e: any) { toast.error(e.message); }
              }}>Enregistrer</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ---- GUEST DIRECTORY VIEW ----
  function renderGuestDialog() {
    return (
      <Dialog open={dialogOpen} onOpenChange={v => { if (!v) closeDialog(); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingGuest ? t('guests.dialog.editTitle') : t('guests.dialog.newTitle')}</DialogTitle>
            <DialogDescription>{t('guests.dialog.description')}</DialogDescription>
          </DialogHeader>
          <form onSubmit={guestForm.handleSubmit(d => saveMutation.mutate(d))} className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-3">{t('guests.dialog.identity')}</h3>
              <div className="grid grid-cols-3 gap-4">
                <div><Label>{t('guests.dialog.lastName')}</Label><Input {...guestForm.register('last_name')} />{guestForm.formState.errors.last_name && <p className="text-sm text-destructive mt-1">{guestForm.formState.errors.last_name.message}</p>}</div>
                <div><Label>{t('guests.dialog.firstName')}</Label><Input {...guestForm.register('first_name')} />{guestForm.formState.errors.first_name && <p className="text-sm text-destructive mt-1">{guestForm.formState.errors.first_name.message}</p>}</div>
                <div><Label>{t('guests.dialog.maidenName')}</Label><Input {...guestForm.register('maiden_name')} /></div>
                <div><Label>{t('guests.dialog.gender')}</Label><Select onValueChange={v => guestForm.setValue('gender', v)} value={guestForm.watch('gender') || ''}><SelectTrigger><SelectValue placeholder={t('guests.dialog.select')} /></SelectTrigger><SelectContent><SelectItem value="M">{t('guests.dialog.genderMale')}</SelectItem><SelectItem value="F">{t('guests.dialog.genderFemale')}</SelectItem></SelectContent></Select></div>
                <div><Label>{t('guests.dialog.birthDate')}</Label><Input type="date" {...guestForm.register('date_of_birth')} /></div>
                <div><Label>{t('guests.dialog.birthPlace')}</Label><Input {...guestForm.register('place_of_birth')} /></div>
                <div><Label>{t('guests.dialog.nationality')}</Label><Input {...guestForm.register('nationality')} /></div>
                <div><Label>{t('guests.dialog.country')}</Label><Input {...guestForm.register('country_of_residence')} /></div>
                <div><Label>{t('guests.dialog.address')}</Label><Input {...guestForm.register('usual_address')} /></div>
                <div><Label>{t('guests.dialog.profession')}</Label><Input {...guestForm.register('profession')} /></div>
                <div><Label>{t('guests.dialog.phone')}</Label><Input {...guestForm.register('phone')} /></div>
                <div><Label>{t('guests.dialog.email')}</Label><Input type="email" {...guestForm.register('email')} /></div>
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-3">{t('guests.dialog.idSection')}</h3>
              <div className="grid grid-cols-4 gap-4">
                <div><Label>{t('guests.dialog.idType')}</Label><Select onValueChange={v => guestForm.setValue('id_type', v)} value={guestForm.watch('id_type') || ''}><SelectTrigger><SelectValue placeholder={t('guests.dialog.idType')} /></SelectTrigger><SelectContent><SelectItem value="cni">CNI</SelectItem><SelectItem value="passport">Passeport</SelectItem><SelectItem value="permit">Permis</SelectItem></SelectContent></Select></div>
                <div>
                  <Label>{t('guests.dialog.idNumber')}</Label>
                  <div className="flex gap-2">
                    <Input {...guestForm.register('id_number')} />
                    <Button type="button" variant="outline" size="icon" title="Scanner la CNI" onClick={() => setCniScannerOpen(true)}>
                      <ScanLine className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div><Label>{t('guests.dialog.idIssuedOn')}</Label><Input type="date" {...guestForm.register('id_issued_on')} /></div>
                <div><Label>{t('guests.dialog.idIssuedAt')}</Label><Input {...guestForm.register('id_issued_at')} /></div>
              </div>
            </div>
            <div><Label>{t('guests.dialog.notes')}</Label><Textarea {...guestForm.register('notes')} /></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>{t('common.cancel')}</Button>
              <Button type="submit" disabled={saveMutation.isPending}>{saveMutation.isPending ? t('guests.dialog.saving') : t('common.save')}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    );
  }

  function renderStayDialog() {
    return (
      <Dialog open={stayDialogOpen} onOpenChange={v => { if (!v) { setStayDialogOpen(false); stayForm.reset(); } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('guests.dialog.stayTitle')}</DialogTitle>
            <DialogDescription>{t('guests.dialog.stayDescription')} {guests?.find(g => g.id === stayGuestId)?.last_name} {guests?.find(g => g.id === stayGuestId)?.first_name}</DialogDescription>
          </DialogHeader>
          <form onSubmit={stayForm.handleSubmit(d => createStayMutation.mutate(d))} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t('guests.dialog.stayType')}</Label>
                <Select onValueChange={v => {
                  stayForm.setValue('stay_type', v);
                  const currentRoom = rooms?.find((r: any) => r.id === stayRoomId);
                  if (currentRoom) {
                    const siestePrice = (currentRoom as any).room_categories?.price_sieste ?? 0;
                    stayForm.setValue('price_per_night', v === 'sieste' ? siestePrice : currentRoom.price_per_night);
                  }
                }} defaultValue="night">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="night">{t('guests.dialog.stayNight')}</SelectItem>
                    <SelectItem value="sieste">{t('guests.dialog.stayDay')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t('guests.dialog.room')}</Label>
                <Select onValueChange={v => {
                  stayForm.setValue('room_id', v);
                  const room = rooms?.find((r: any) => r.id === v);
                  if (room) {
                    const currentType = stayForm.getValues('stay_type');
                    const siestePrice = (room as any).room_categories?.price_sieste ?? 0;
                    stayForm.setValue('price_per_night', currentType === 'sieste' ? siestePrice : room.price_per_night);
                  }
                }}>
                  <SelectTrigger><SelectValue placeholder={t('guests.dialog.select')} /></SelectTrigger>
                  <SelectContent>{rooms?.map((r: any) => <SelectItem key={r.id} value={r.id}>{r.room_number} — {formatFCFA(r.price_per_night)}</SelectItem>)}</SelectContent>
                </Select>
                {stayForm.formState.errors.room_id && <p className="text-sm text-destructive mt-1">{stayForm.formState.errors.room_id.message}</p>}
              </div>
              <div><Label>{t('guests.dialog.arrival')}</Label><Input type="date" {...stayForm.register('check_in_date')} /></div>
              <div><Label>{t('guests.dialog.departure')}</Label><Input type="date" {...stayForm.register('check_out_date')} /></div>
              <div><Label>{stayType === 'sieste' ? t('guests.dialog.dayPrice') : t('guests.dialog.nightPrice')}</Label><Input type="number" {...stayForm.register('price_per_night')} /></div>
              {stayType !== 'sieste' && <div><Label>{t('guests.dialog.nights')}</Label><Input value={nights} readOnly className="bg-muted" /></div>}
              <div><Label>{t('guests.dialog.total')}</Label><Input value={formatFCFA(totalPrice)} readOnly className="bg-muted" /></div>
              <div><Label>{t('guests.dialog.adults')}</Label><Input type="number" {...stayForm.register('number_of_adults')} /></div>
              <div><Label>{t('guests.dialog.children')}</Label><Input type="number" {...stayForm.register('number_of_children')} /></div>
              <div><Label>{t('guests.dialog.arrangement')}</Label><Input {...stayForm.register('arrangement')} /></div>
            </div>
            <div><Label>{t('guests.dialog.notes')}</Label><Textarea {...stayForm.register('notes')} /></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setStayDialogOpen(false)}>{t('common.cancel')}</Button>
              <Button type="submit" disabled={createStayMutation.isPending}>{t('guests.dialog.stayTitle')}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <div className="page-container space-y-6">
      <PageHeader title={t('guests.title')} subtitle={`${filtered.length} ${t('guests.subtitle')}`}>
        <Button variant="outline" onClick={handleExportPoliceRegister}><FileText className="h-4 w-4 mr-2" />Export Registre de Police</Button>
        <Button onClick={() => { guestForm.reset({ nationality: 'Camerounaise', country_of_residence: 'Cameroun' }); setDialogOpen(true); }}><Plus className="h-4 w-4 mr-2" />{t('guests.new')}</Button>
      </PageHeader>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder={t('guests.search')} className="pl-10" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Users} title={t('guests.emptyTitle')} description={t('guests.emptyDescription')} actionLabel={t('guests.new')} onAction={() => setDialogOpen(true)} />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('guests.table.fullName')}</TableHead>
                <TableHead>{t('guests.table.phone')}</TableHead>
                <TableHead>{t('guests.table.nationality')}</TableHead>
                <TableHead>{t('guests.table.idNumber')}</TableHead>
                <TableHead className="text-center">{t('guests.table.stays')}</TableHead>
                <TableHead>{t('guests.table.lastVisit')}</TableHead>
                <TableHead className="text-right">{t('common.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(g => {
                const info = stayCountMap[g.id] || { count: 0, lastVisit: null, hasActive: false, paymentStatus: null };
                const dotColor = info.paymentStatus === 'paid'
                  ? 'bg-green-600'
                  : info.paymentStatus === 'partial'
                    ? 'bg-orange-500'
                    : 'bg-red-600';
                return (
                  <TableRow key={g.id} className="cursor-pointer hover:bg-muted/40" onClick={() => navigate(`/guests/${g.id}`)}>
                    <TableCell className="font-medium">
                      {info.hasActive && <span className={`inline-block h-2.5 w-2.5 rounded-full mr-2 ${dotColor}`} />}
                      {g.last_name} {g.first_name}
                      {(g as any).tier && (g as any).tier !== 'regular' && <span className="ml-2"><TierBadge tier={(g as any).tier} /></span>}
                      {info.hasActive && <Badge variant="default" className="ml-2 text-xs">{t('guests.present')}</Badge>}
                    </TableCell>
                    <TableCell>{g.phone || '-'}</TableCell>
                    <TableCell>{g.nationality || '-'}</TableCell>
                    <TableCell>{g.id_number || '-'}</TableCell>
                    <TableCell className="text-center">{info.count}</TableCell>
                    <TableCell>{info.lastVisit ? formatDate(info.lastVisit) : '-'}</TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => navigate(`/guests/${g.id}`)}><Eye className="h-4 w-4 mr-2" />Voir le profil</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openNewStay(g.id)}><BedDouble className="h-4 w-4 mr-2" />{t('guests.newStay')}</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDownloadDossier(g.id)}><Download className="h-4 w-4 mr-2" />Dossier complet PDF</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => setDeleteGuest(g)}><Trash2 className="h-4 w-4 mr-2" />{t('common.delete')}</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {renderGuestDialog()}
      {renderStayDialog()}
      <CniScanner
        open={cniScannerOpen}
        onClose={() => setCniScannerOpen(false)}
        hotelId={hotel?.id || ''}
        onConfirm={(data: CniData) => {
          if (data.last_name) guestForm.setValue('last_name', data.last_name);
          if (data.first_name) guestForm.setValue('first_name', data.first_name);
          if (data.nationality) guestForm.setValue('nationality', data.nationality);
          if (data.id_number) guestForm.setValue('id_number', data.id_number);
          if (data.date_of_birth) guestForm.setValue('date_of_birth', data.date_of_birth);
          if (data.place_of_birth) guestForm.setValue('place_of_birth', data.place_of_birth);
          toast.success('Données CNI appliquées');
        }}
      />
      <ConfirmDialog open={!!deleteGuest} onOpenChange={() => setDeleteGuest(null)} title={t('guests.deleteTitle')} description={`${t('delete.title')} ${deleteGuest?.last_name || ''} ${deleteGuest?.first_name || ''} ?`} onConfirm={() => deleteMutation.mutate(deleteGuest.id)} confirmLabel={t('guests.deleteConfirm')} variant="destructive" />

      {/* Tier Change Dialog */}
      <Dialog open={tierDialogOpen} onOpenChange={setTierDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Changer le niveau — {tierTargetGuest?.last_name} {tierTargetGuest?.first_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nouveau niveau</Label>
              <Select value={tierForm.tier} onValueChange={v => setTierForm(p => ({ ...p, tier: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="regular">Regular</SelectItem>
                  <SelectItem value="silver">Silver</SelectItem>
                  <SelectItem value="gold">Gold</SelectItem>
                  <SelectItem value="vip">VIP</SelectItem>
                  <SelectItem value="blacklist">Blacklist</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Notes / Raison</Label>
              <Textarea value={tierForm.notes} onChange={e => setTierForm(p => ({ ...p, notes: e.target.value }))} placeholder="Raison du changement de niveau..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTierDialogOpen(false)}>Annuler</Button>
            <Button onClick={async () => {
              if (!tierTargetGuest) return;
              try {
                const { error } = await supabase.from('guests').update({
                  tier: tierForm.tier,
                  tier_notes: tierForm.notes || null,
                  tier_assigned_by: profile?.id,
                  tier_assigned_at: new Date().toISOString(),
                } as any).eq('id', tierTargetGuest.id);
                if (error) throw error;
                qc.invalidateQueries({ queryKey: ['guests'] });
                qc.invalidateQueries({ queryKey: ['guest', tierTargetGuest.id] });
                toast.success('Niveau mis à jour');
                setTierDialogOpen(false);
              } catch (e: any) { toast.error(e.message); }
            }}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GuestsPage;
