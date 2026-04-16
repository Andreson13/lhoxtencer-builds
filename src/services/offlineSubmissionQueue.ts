import { supabase } from '@/integrations/supabase/client';
import { addChargeToInvoice, getOrCreateInvoice } from '@/services/transactionService';

const QUEUE_KEY = 'hotel-harmony-offline-submit-queue';

type GuestUpsertItem = {
  type: 'guest-upsert';
  createdAt: string;
  payload: {
    hotelId: string;
    guestId?: string;
    values: Record<string, any>;
  };
};

type GuestStayCreateItem = {
  type: 'guest-stay-create';
  createdAt: string;
  payload: {
    hotelId: string;
    guestId: string;
    values: {
      stay_type: string;
      room_id: string;
      check_in_date: string;
      check_out_date: string;
      number_of_adults: number;
      number_of_children: number;
      arrangement?: string;
      price_per_night: number;
      notes?: string;
    };
    receptionist: {
      id: string;
      full_name: string;
    };
    nights: number;
    totalPrice: number;
  };
};

type ReservationSaveItem = {
  type: 'reservation-save';
  createdAt: string;
  payload: {
    hotelId: string;
    profileId: string;
    reservationId?: string;
    reservationNumber?: string;
    selectedGuestId?: string | null;
    createGuestRecord: boolean;
    nights: number;
    form: {
      guest_name: string;
      guest_phone: string;
      guest_email: string;
      category_id: string;
      room_id: string;
      check_in_date: string;
      check_out_date: string;
      number_of_adults: number;
      number_of_children: number;
      total_price: number;
      deposit_paid: number;
      payment_method_cash: boolean;
      payment_method_om: boolean;
      payment_method_momo: boolean;
      source: string;
      special_requests: string;
    };
  };
};

type CheckinReservationItem = {
  type: 'checkin-reservation';
  createdAt: string;
  payload: {
    hotelId: string;
    profile: { id: string; full_name: string };
    reservation: any;
  };
};

type WalkinCheckinItem = {
  type: 'walkin-checkin';
  createdAt: string;
  payload: {
    hotelId: string;
    profile: { id: string; full_name: string };
    walkinGuestId?: string | null;
    walkinNewGuest: {
      last_name: string;
      first_name: string;
      phone?: string;
      id_number?: string;
    };
    walkinStay: {
      room_id: string;
      check_in_date: string;
      check_out_date?: string;
      price_per_night: number;
    };
  };
};

type RestaurantOrderCreateItem = {
  type: 'restaurant-order-create';
  createdAt: string;
  payload: {
    hotelId: string;
    profileId?: string;
    orderRoom: string;
    isWalkin: boolean;
    walkinName: string;
    walkinTable: string;
    cart: Array<{ itemId: string; price: number; quantity: number }>;
  };
};

type QueueItem = GuestUpsertItem | GuestStayCreateItem | ReservationSaveItem | CheckinReservationItem | WalkinCheckinItem | RestaurantOrderCreateItem;

const loadQueue = (): QueueItem[] => {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveQueue = (items: QueueItem[]) => {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(items));
};

export const enqueueOfflineSubmission = (item: QueueItem) => {
  const queue = loadQueue();
  queue.push(item);
  saveQueue(queue);
};

const isNetworkError = (error: any) => {
  const message = String(error?.message || error || '').toLowerCase();
  return message.includes('fetch') || message.includes('network') || message.includes('timeout') || message.includes('offline');
};

const processGuestUpsert = async (item: GuestUpsertItem) => {
  const payload = {
    ...item.payload.values,
    hotel_id: item.payload.hotelId,
    email: item.payload.values.email || null,
  };

  if (item.payload.guestId) {
    const { error } = await supabase.from('guests').update(payload).eq('id', item.payload.guestId);
    if (error) throw error;
    return;
  }

  const { error } = await supabase.from('guests').insert(payload);
  if (error) throw error;
};

const processGuestStayCreate = async (item: GuestStayCreateItem) => {
  const p = item.payload;
  const { data: stay, error: stayErr } = await supabase.from('stays').insert({
    hotel_id: p.hotelId,
    guest_id: p.guestId,
    stay_type: p.values.stay_type,
    room_id: p.values.room_id,
    check_in_date: new Date(p.values.check_in_date).toISOString(),
    check_out_date: new Date(p.values.check_out_date).toISOString(),
    number_of_nights: p.nights,
    number_of_adults: p.values.number_of_adults,
    number_of_children: p.values.number_of_children,
    arrangement: p.values.arrangement || null,
    price_per_night: p.values.price_per_night,
    total_price: p.totalPrice,
    status: 'active',
    payment_status: 'pending',
    receptionist_id: p.receptionist.id,
    receptionist_name: p.receptionist.full_name,
    created_by: p.receptionist.id,
    created_by_name: p.receptionist.full_name,
    notes: p.values.notes || null,
  } as any).select().single();

  if (stayErr) throw stayErr;

  const invoice = await getOrCreateInvoice(p.hotelId, stay.id, p.guestId);
  await addChargeToInvoice({
    hotelId: p.hotelId,
    invoiceId: invoice.id,
    stayId: stay.id,
    guestId: p.guestId,
    description: `Hebergement - ${p.nights} nuit(s)`,
    itemType: 'room',
    quantity: p.nights,
    unitPrice: p.values.price_per_night,
  });

  await supabase.from('rooms').update({ status: 'occupied' }).eq('id', p.values.room_id);
};

const buildNameParts = (fullName: string) => {
  const parts = (fullName || '').trim().split(' ').filter(Boolean);
  const lastName = parts[0] || 'Client';
  const firstName = parts.slice(1).join(' ') || 'Sans prenom';
  return { lastName, firstName };
};

const findOrCreateGuest = async ({
  hotelId,
  guestId,
  fullName,
  phone,
  email,
  idNumber,
}: {
  hotelId: string;
  guestId?: string | null;
  fullName: string;
  phone?: string | null;
  email?: string | null;
  idNumber?: string | null;
}) => {
  if (guestId) return guestId;

  if (phone) {
    const { data } = await supabase.from('guests').select('id').eq('hotel_id', hotelId).eq('phone', phone).maybeSingle();
    if (data?.id) return data.id;
  }

  if (idNumber) {
    const { data } = await supabase.from('guests').select('id').eq('hotel_id', hotelId).eq('id_number', idNumber).maybeSingle();
    if (data?.id) return data.id;
  }

  const { lastName, firstName } = buildNameParts(fullName);
  const { data: byName } = await supabase
    .from('guests')
    .select('id')
    .eq('hotel_id', hotelId)
    .ilike('last_name', lastName)
    .ilike('first_name', firstName)
    .maybeSingle();

  if (byName?.id) return byName.id;

  const { data: created, error } = await supabase
    .from('guests')
    .insert({
      hotel_id: hotelId,
      last_name: lastName,
      first_name: firstName,
      phone: phone || null,
      email: email || null,
      id_number: idNumber || null,
    })
    .select('id')
    .single();
  if (error) throw error;
  return created.id;
};

const processReservationSave = async (item: ReservationSaveItem) => {
  const p = item.payload;
  let guestId = p.selectedGuestId || null;

  if (!guestId && p.createGuestRecord && p.form.guest_name) {
    guestId = await findOrCreateGuest({
      hotelId: p.hotelId,
      fullName: p.form.guest_name,
      phone: p.form.guest_phone || null,
      email: p.form.guest_email || null,
    });
  }

  const reservationPayload: any = {
    hotel_id: p.hotelId,
    guest_name: p.form.guest_name,
    guest_phone: p.form.guest_phone || null,
    guest_email: p.form.guest_email || null,
    category_id: p.form.category_id || null,
    room_id: p.form.room_id || null,
    check_in_date: p.form.check_in_date,
    check_out_date: p.form.check_out_date,
    number_of_nights: p.nights,
    number_of_adults: p.form.number_of_adults,
    number_of_children: p.form.number_of_children,
    total_price: p.form.total_price,
    deposit_paid: p.form.deposit_paid,
    payment_method_cash: p.form.payment_method_cash,
    payment_method_om: p.form.payment_method_om,
    payment_method_momo: p.form.payment_method_momo,
    source: p.form.source,
    special_requests: p.form.special_requests || null,
    guest_id: guestId,
  };

  let reservationId = p.reservationId;

  if (reservationId) {
    const { error } = await supabase.from('reservations').update(reservationPayload).eq('id', reservationId);
    if (error) throw error;
  } else {
    const reservationNumber = p.reservationNumber || `R-OFF-${Date.now().toString(36).toUpperCase()}`;
    const { data, error } = await supabase
      .from('reservations')
      .insert({
        ...reservationPayload,
        reservation_number: reservationNumber,
        created_by: p.profileId,
      })
      .select('id')
      .single();
    if (error) throw error;
    reservationId = data.id;
  }

  if (!reservationId) return;

  const totalAmount = Number(p.form.total_price || 0);
  const amountPaid = Number(p.form.deposit_paid || 0);
  const balanceDue = Math.max(0, totalAmount - amountPaid);
  const invoiceStatus = balanceDue <= 0 ? 'paid' : amountPaid > 0 ? 'partial' : 'open';

  const { data: existingInvoice } = await supabase
    .from('invoices')
    .select('id')
    .eq('hotel_id', p.hotelId)
    .eq('reservation_id', reservationId)
    .maybeSingle();

  if (existingInvoice?.id) {
    const { error } = await supabase
      .from('invoices')
      .update({
        guest_id: guestId,
        subtotal: totalAmount,
        total_amount: totalAmount,
        amount_paid: amountPaid,
        balance_due: balanceDue,
        status: invoiceStatus,
      } as any)
      .eq('id', existingInvoice.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('invoices').insert({
      hotel_id: p.hotelId,
      guest_id: guestId,
      reservation_id: reservationId,
      invoice_number: `INV-OFF-${Date.now().toString(36).toUpperCase()}`,
      status: invoiceStatus,
      subtotal: totalAmount,
      total_amount: totalAmount,
      amount_paid: amountPaid,
      balance_due: balanceDue,
    } as any);
    if (error) throw error;
  }
};

const processCheckinReservation = async (item: CheckinReservationItem) => {
  const p = item.payload;
  const reservation = p.reservation;

  const { data: existingStay } = await supabase
    .from('stays')
    .select('id, guest_id')
    .eq('hotel_id', p.hotelId)
    .eq('reservation_id', reservation.id)
    .eq('status', 'active')
    .maybeSingle();
  if (existingStay?.id) return;

  const guestId = await findOrCreateGuest({
    hotelId: p.hotelId,
    guestId: reservation.guest_id,
    fullName: reservation.guest_name,
    phone: reservation.guest_phone || null,
    email: reservation.guest_email || null,
  });

  const nights = reservation.number_of_nights || 1;
  const total = reservation.total_price || 0;
  const unitPrice = total / Math.max(nights, 1);

  const { data: stay, error: stayErr } = await supabase
    .from('stays')
    .insert({
      hotel_id: p.hotelId,
      guest_id: guestId,
      reservation_id: reservation.id,
      stay_type: 'night',
      room_id: reservation.room_id,
      check_in_date: new Date().toISOString(),
      check_out_date: reservation.check_out_date,
      number_of_nights: nights,
      number_of_adults: reservation.number_of_adults || 1,
      number_of_children: reservation.number_of_children || 0,
      price_per_night: unitPrice,
      total_price: total,
      status: 'active',
      payment_status: 'pending',
      receptionist_id: p.profile.id,
      receptionist_name: p.profile.full_name,
      created_by: p.profile.id,
      created_by_name: p.profile.full_name,
    } as any)
    .select()
    .single();
  if (stayErr) throw stayErr;

  const invoice = await getOrCreateInvoice(p.hotelId, stay.id, guestId);
  await addChargeToInvoice({
    hotelId: p.hotelId,
    invoiceId: invoice.id,
    stayId: stay.id,
    guestId,
    description: `Hebergement - ${nights} nuit(s)`,
    itemType: 'room',
    quantity: nights,
    unitPrice,
  });

  await supabase.from('reservations').update({ status: 'checked_in' }).eq('id', reservation.id);
  if (reservation.room_id) {
    await supabase.from('rooms').update({ status: 'occupied' }).eq('id', reservation.room_id);
  }
};

const processWalkinCheckin = async (item: WalkinCheckinItem) => {
  const p = item.payload;

  const guestId = await findOrCreateGuest({
    hotelId: p.hotelId,
    guestId: p.walkinGuestId,
    fullName: `${p.walkinNewGuest.last_name || ''} ${p.walkinNewGuest.first_name || ''}`.trim(),
    phone: p.walkinNewGuest.phone || null,
    idNumber: p.walkinNewGuest.id_number || null,
  });

  const { data: existingStay } = await supabase
    .from('stays')
    .select('id')
    .eq('hotel_id', p.hotelId)
    .eq('room_id', p.walkinStay.room_id)
    .eq('guest_id', guestId)
    .eq('status', 'active')
    .maybeSingle();
  if (existingStay?.id) return;

  const nights = p.walkinStay.check_out_date
    ? Math.max(
        1,
        Math.ceil(
          (new Date(p.walkinStay.check_out_date).getTime() - new Date(p.walkinStay.check_in_date).getTime()) /
            86400000,
        ),
      )
    : 1;
  const unitPrice = Number(p.walkinStay.price_per_night || 0);
  const total = unitPrice * nights;

  const { data: stay, error } = await supabase
    .from('stays')
    .insert({
      hotel_id: p.hotelId,
      guest_id: guestId,
      stay_type: 'night',
      room_id: p.walkinStay.room_id,
      check_in_date: new Date(p.walkinStay.check_in_date).toISOString(),
      check_out_date: p.walkinStay.check_out_date ? new Date(p.walkinStay.check_out_date).toISOString() : null,
      number_of_nights: nights,
      price_per_night: unitPrice,
      total_price: total,
      status: 'active',
      payment_status: 'pending',
      receptionist_id: p.profile.id,
      receptionist_name: p.profile.full_name,
      created_by: p.profile.id,
      created_by_name: p.profile.full_name,
    } as any)
    .select()
    .single();
  if (error) throw error;

  const invoice = await getOrCreateInvoice(p.hotelId, stay.id, guestId);
  await addChargeToInvoice({
    hotelId: p.hotelId,
    invoiceId: invoice.id,
    stayId: stay.id,
    guestId,
    description: `Hebergement - ${nights} nuit(s)`,
    itemType: 'room',
    quantity: nights,
    unitPrice,
  });

  await supabase.from('rooms').update({ status: 'occupied' }).eq('id', p.walkinStay.room_id);
};

const processRestaurantOrderCreate = async (item: RestaurantOrderCreateItem) => {
  const p = item.payload;
  const totalAmount = p.cart.reduce((sum, c) => sum + Number(c.price || 0) * Number(c.quantity || 0), 0);
  const orderNumber = `R-OFF-${Date.now().toString(36).toUpperCase()}`;

  let stayId: string | null = null;
  let guestId: string | null = null;
  let invoiceId: string | null = null;

  if (p.orderRoom && !p.isWalkin) {
    const { data: stayData } = await supabase
      .from('stays')
      .select('id, guest_id, invoice_id')
      .eq('room_id', p.orderRoom)
      .eq('status', 'active')
      .maybeSingle();
    if (stayData) {
      stayId = stayData.id;
      guestId = stayData.guest_id;
      invoiceId = stayData.invoice_id;
    }
  }

  const { data: order, error } = await supabase
    .from('restaurant_orders')
    .insert({
      hotel_id: p.hotelId,
      order_number: orderNumber,
      room_id: !p.isWalkin && p.orderRoom ? p.orderRoom : null,
      stay_id: stayId,
      guest_id: guestId,
      invoice_id: invoiceId,
      billed_to_room: !!stayId,
      is_walkin: p.isWalkin,
      walkin_name: p.walkinName || null,
      walkin_table: p.walkinTable || null,
      total_amount: totalAmount,
      created_by: p.profileId || null,
      status: 'pending',
    } as any)
    .select('id')
    .single();
  if (error) throw error;

  const orderItems = p.cart.map((c) => ({
    hotel_id: p.hotelId,
    order_id: order.id,
    item_id: c.itemId,
    quantity: c.quantity,
    unit_price: c.price,
    subtotal: Number(c.price || 0) * Number(c.quantity || 0),
  }));

  const { error: orderItemsError } = await supabase.from('restaurant_order_items').insert(orderItems as any);
  if (orderItemsError) throw orderItemsError;
};

const processQueueItem = async (item: QueueItem) => {
  if (item.type === 'guest-upsert') return processGuestUpsert(item);
  if (item.type === 'guest-stay-create') return processGuestStayCreate(item);
  if (item.type === 'reservation-save') return processReservationSave(item);
  if (item.type === 'checkin-reservation') return processCheckinReservation(item);
  if (item.type === 'walkin-checkin') return processWalkinCheckin(item);
  if (item.type === 'restaurant-order-create') return processRestaurantOrderCreate(item);
};

export const processOfflineSubmissionQueue = async () => {
  if (!navigator.onLine) return { processed: 0, remaining: loadQueue().length };

  const queue = loadQueue();
  if (!queue.length) return { processed: 0, remaining: 0 };

  let processed = 0;
  const remaining: QueueItem[] = [];

  for (let index = 0; index < queue.length; index += 1) {
    const item = queue[index];
    try {
      await processQueueItem(item);
      processed += 1;
    } catch (error) {
      if (isNetworkError(error)) {
        remaining.push(item, ...queue.slice(index + 1));
        break;
      }
      console.warn('Dropping invalid offline queue item', item.type, error);
    }
  }

  saveQueue(remaining);
  return { processed, remaining: remaining.length };
};

export const getOfflineSubmissionQueueSize = () => loadQueue().length;
