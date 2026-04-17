import { supabase } from '@/lib/supabase';
import { generateInvoiceNumber } from '@/utils/formatters';
import { logAudit } from '@/utils/auditLog';

export const getCompatibleInvoiceItemType = (itemType: string) => {
  if (itemType === 'sieste') return 'service';
  if (itemType === 'bar') return 'minibar';
  return itemType;
};

export const isSiesteInvoiceItem = (item: { item_type?: string | null; description?: string | null }) => {
  if (item.item_type === 'sieste') return true;
  return item.item_type === 'service' && /sieste/i.test(item.description || '');
};

const runInBackground = (task: Promise<unknown>, label: string) => {
  void task.catch((error) => {
    console.error(label, error);
  });
};

const toDateKey = (date = new Date()) => {
  const d = typeof date === 'string' ? new Date(date) : date;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

async function generateInvoiceNumberForHotel(_hotelId: string) {
  return generateInvoiceNumber();
}

export async function getOrCreateInvoice(hotelId: string, stayId: string, guestId: string) {
  const { data: existing, error: existingError } = await supabase
    .from('invoices')
    .select('*')
    .eq('hotel_id', hotelId)
    .eq('stay_id', stayId)
    .eq('status', 'open')
    .maybeSingle();

  if (existingError) throw existingError;
  if (existing) return existing;

  const invoiceNumber = await generateInvoiceNumberForHotel(hotelId);

  const { data: invoice, error } = await supabase
    .from('invoices')
    .insert({
      hotel_id: hotelId,
      stay_id: stayId,
      guest_id: guestId,
      invoice_number: invoiceNumber,
      status: 'open',
      subtotal: 0,
      total_amount: 0,
      amount_paid: 0,
      balance_due: 0,
    } as any)
    .select()
    .single();

  if (error) throw error;

  await supabase
    .from('stays')
    .update({ invoice_id: invoice.id } as any)
    .eq('id', stayId);

  return invoice;
}

export async function addChargeToInvoice(params: {
  hotelId: string;
  invoiceId: string;
  stayId: string;
  guestId: string;
  description: string;
  itemType: 'room' | 'restaurant' | 'bar' | 'minibar' | 'extra' | 'sieste' | 'service' | 'other';
  quantity: number;
  unitPrice: number;
  date?: string;
}) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!params.invoiceId || !uuidRegex.test(params.invoiceId)) {
    throw new Error('Invalid invoice id for charge');
  }
  if (!Number.isFinite(params.quantity) || params.quantity <= 0) {
    return;
  }
  if (!Number.isFinite(params.unitPrice) || params.unitPrice < 0) {
    return;
  }

  // Validate/fetch guest_id from stay if not provided
  let finalGuestId = params.guestId;
  if (!finalGuestId && params.stayId) {
    const { data: stay } = await supabase.from('stays').select('guest_id').eq('id', params.stayId).maybeSingle();
    if (stay?.guest_id) finalGuestId = stay.guest_id;
  }
  if (!finalGuestId) throw new Error('Guest ID required for charge');

  const date = params.date || toDateKey();
  const subtotal = params.quantity * params.unitPrice;
  const storedItemType = getCompatibleInvoiceItemType(params.itemType);

  const { error: itemError } = await supabase.from('invoice_items').insert({
    hotel_id: params.hotelId,
    invoice_id: params.invoiceId,
    description: params.description,
    item_type: storedItemType,
    quantity: params.quantity,
    unit_price: params.unitPrice,
    subtotal,
  } as any);

  if (itemError) throw itemError;

  await recalculateInvoiceTotals(params.invoiceId);

  const mainCouranteField = {
    room: 'hebergement',
    restaurant: 'restaurant',
    bar: 'bar',
    minibar: 'bar',
    sieste: 'divers',
    extra: 'divers',
    service: 'divers',
  }[params.itemType] as 'hebergement' | 'bar' | 'restaurant' | 'divers';

  await updateMainCourante({
    hotelId: params.hotelId,
    date,
    stayId: params.stayId,
    guestId: finalGuestId,
    field: mainCouranteField,
    addAmount: subtotal,
  });

  await supabase
    .from('stays')
    .update({ payment_status: 'pending' } as any)
    .eq('id', params.stayId);

  runInBackground(reconcileMainCouranteForDate(params.hotelId, date), 'reconcileMainCouranteForDate after addChargeToInvoice failed');
}

export async function recordPayment(params: {
  hotelId: string;
  invoiceId: string;
  stayId: string;
  guestId: string;
  amount: number;
  paymentMethod: string;
  referenceNumber?: string;
  userId: string;
  userName: string;
  roomNumber?: string;
  guestName?: string;
}) {
  const date = toDateKey();

  const { data: payment, error: paymentError } = await supabase
    .from('payments')
    .insert({
      hotel_id: params.hotelId,
      invoice_id: params.invoiceId,
      amount: params.amount,
      payment_method: params.paymentMethod,
      reference_number: params.referenceNumber || null,
      recorded_by: params.userId,
      recorded_by_name: params.userName,
      created_by: params.userId,
      created_by_name: params.userName,
    } as any)
    .select()
    .single();

  if (paymentError) throw paymentError;

  const invoice = await recalculateInvoiceTotals(params.invoiceId);

  await updateMainCourante({
    hotelId: params.hotelId,
    date,
    stayId: params.stayId,
    guestId: params.guestId,
    field: 'encaissement',
    addAmount: params.amount,
  });

  if (params.paymentMethod === 'cash') {
    await recordCashMovement({
      hotelId: params.hotelId,
      type: 'in',
      source: 'payment',
      description: `Paiement — ${params.guestName || ''} Ch.${params.roomNumber || ''}`.trim(),
      amount: params.amount,
      paymentMethod: params.paymentMethod,
      referenceId: payment.id,
      userId: params.userId,
    });
  }

  if (invoice && invoice.balanceDue <= 0) {
    await supabase.from('invoices').update({ status: 'paid' }).eq('id', params.invoiceId);
    await supabase.from('stays').update({ payment_status: 'paid' } as any).eq('id', params.stayId);
  } else if (invoice.amountPaid > 0) {
    await supabase.from('stays').update({ payment_status: 'partial' } as any).eq('id', params.stayId);
  } else {
    await supabase.from('stays').update({ payment_status: 'pending' } as any).eq('id', params.stayId);
  }

  await logAudit(
    params.hotelId,
    params.userId,
    params.userName,
    'payment_recorded',
    'payments',
    payment.id,
    null,
    { amount: params.amount, method: params.paymentMethod, invoice_id: params.invoiceId },
  );

  runInBackground(reconcileMainCouranteForDate(params.hotelId, date), 'reconcileMainCouranteForDate after recordPayment failed');

  return payment;
}

export async function updateMainCourante(params: {
  hotelId: string;
  date: string;
  stayId?: string;
  guestId: string;
  field: 'hebergement' | 'bar' | 'restaurant' | 'divers' | 'encaissement' | 'deduction';
  addAmount: number;
}) {
  let stay: any = null;
  if (params.stayId) {
    const { data } = await supabase
      .from('stays')
      .select('id, number_of_adults, rooms(room_number), guests(first_name, last_name)')
      .eq('id', params.stayId)
      .maybeSingle();
    stay = data;
  }

  const guestName = stay?.guests ? `${stay.guests.last_name} ${stay.guests.first_name}` : '';
  const roomNumber = stay?.rooms?.room_number || '';

  const { data: existing, error: existingError } = await supabase
    .from('main_courante')
    .select('*')
    .eq('hotel_id', params.hotelId)
    .eq('journee', params.date)
    .eq('guest_id', params.guestId)
    .maybeSingle();
  if (existingError) throw existingError;

  if (existing) {
    const currentValue = (existing as any)[params.field] || 0;
    const next = currentValue + params.addAmount;
    const hebergement = params.field === 'hebergement' ? next : existing.hebergement || 0;
    const bar = params.field === 'bar' ? next : existing.bar || 0;
    const restaurant = params.field === 'restaurant' ? next : existing.restaurant || 0;
    const divers = params.field === 'divers' ? next : existing.divers || 0;
    const deduction = params.field === 'deduction' ? next : existing.deduction || 0;
    const encaissement = params.field === 'encaissement' ? next : existing.encaissement || 0;
    const caTotal = hebergement + bar + restaurant + divers;
    const aReporter = caTotal + (existing.report_veille || 0) - deduction - encaissement;

    const { error: updateError } = await supabase
      .from('main_courante')
      .update({
        guest_id: existing.guest_id || params.guestId,
        room_number: existing.room_number || roomNumber,
        nom_client: existing.nom_client || guestName || 'Client',
        [params.field]: next,
        updated_at: new Date().toISOString(),
      } as any)
      .eq('id', existing.id);
    if (updateError) {
      console.error('updateMainCourante PATCH failed', { id: existing.id, field: params.field, next, error: updateError });
      throw new Error(`main_courante update: ${updateError.message} | ${updateError.details || ''} | ${updateError.hint || ''}`);
    }
  } else {
    const yesterday = new Date(params.date);
    yesterday.setDate(yesterday.getDate() - 1);
    const { data: yesterdayRow } = await supabase
      .from('main_courante')
      .select('a_reporter')
      .eq('hotel_id', params.hotelId)
      .eq('journee', toDateKey(yesterday))
      .eq('guest_id', params.guestId)
      .maybeSingle();

    const reportVeille = yesterdayRow?.a_reporter || 0;
    const hebergement = params.field === 'hebergement' ? params.addAmount : 0;
    const bar = params.field === 'bar' ? params.addAmount : 0;
    const restaurant = params.field === 'restaurant' ? params.addAmount : 0;
    const divers = params.field === 'divers' ? params.addAmount : 0;
    const deduction = params.field === 'deduction' ? params.addAmount : 0;
    const encaissement = params.field === 'encaissement' ? params.addAmount : 0;
    const caTotal = hebergement + bar + restaurant + divers;
    const aReporter = caTotal + reportVeille - deduction - encaissement;

    const { error: insertError } = await supabase.from('main_courante').insert({
      hotel_id: params.hotelId,
      journee: params.date,
      guest_id: params.guestId,
      room_number: roomNumber,
      nom_client: guestName || 'Client',
      nombre_personnes: stay?.number_of_adults || 1,
      report_veille: reportVeille,
      hebergement,
      bar,
      restaurant,
      divers,
      deduction,
      encaissement,
    } as any);
    if (insertError) throw insertError;
  }
}

export async function reconcileMainCouranteForDate(hotelId: string, date: string) {
  const dateKey = toDateKey(date);
  const start = `${dateKey}T00:00:00`;
  const endDate = new Date(dateKey);
  endDate.setDate(endDate.getDate() + 1);
  const end = `${toDateKey(endDate)}T00:00:00`;

  // Note: embed only guest_id from invoices (stay_id may not exist in live DB yet)
  const { data: items, error: itemsError } = await supabase
    .from('invoice_items')
    .select('item_type, subtotal, invoice_id, invoices(guest_id)')
    .gte('created_at', start)
    .lt('created_at', end);
  if (itemsError) console.warn('reconcile: invoice_items fetch failed', itemsError);

  const { data: payments, error: paymentsError } = await supabase
    .from('payments')
    .select('amount, invoice_id, invoices(guest_id)')
    .gte('created_at', start)
    .lt('created_at', end)
    .eq('hotel_id', hotelId);
  if (paymentsError) console.warn('reconcile: payments fetch failed', paymentsError);

  const buckets = new Map<string, {
    stayId: string | null;
    guestId: string | null;
    hebergement: number;
    bar: number;
    restaurant: number;
    divers: number;
    encaissement: number;
  }>();

  const ensureBucket = (stayId: string | null, guestId: string | null) => {
    const key = `${stayId || 'nostay'}|${guestId || 'noguest'}`;
    if (!buckets.has(key)) {
      buckets.set(key, {
        stayId,
        guestId,
        hebergement: 0,
        bar: 0,
        restaurant: 0,
        divers: 0,
        encaissement: 0,
      });
    }
    return buckets.get(key)!;
  };

  for (const it of (items || []) as any[]) {
    const guestId = it.invoices?.guest_id || null;
    if (!guestId) continue;
    const b = ensureBucket(null, guestId);
    const value = it.subtotal || 0;
    if (it.item_type === 'room') b.hebergement += value;
    else if (it.item_type === 'restaurant') b.restaurant += value;
    else if (it.item_type === 'bar' || it.item_type === 'minibar') b.bar += value;
    else b.divers += value;
  }

  for (const p of (payments || []) as any[]) {
    const guestId = p.invoices?.guest_id || null;
    if (!guestId) continue;
    const b = ensureBucket(null, guestId);
    b.encaissement += p.amount || 0;
  }

  for (const b of buckets.values()) {
    let existing: any = null;
    if (b.guestId) {
      const { data } = await supabase
        .from('main_courante')
        .select('*')
        .eq('hotel_id', hotelId)
        .eq('journee', dateKey)
        .eq('guest_id', b.guestId)
        .maybeSingle();
      existing = data;
    }

    let stayInfo: any = null;
    if (b.stayId) {
      const { data } = await supabase
        .from('stays')
        .select('number_of_adults, number_of_children, rooms(room_number), guests(first_name, last_name)')
        .eq('id', b.stayId)
        .maybeSingle();
      stayInfo = data;
    } else if (b.guestId) {
      // Find stay from guest_id
      const { data } = await supabase
        .from('stays')
        .select('number_of_adults, number_of_children, rooms(room_number), guests(first_name, last_name)')
        .eq('guest_id', b.guestId)
        .eq('status', 'active')
        .maybeSingle();
      stayInfo = data;
    }

    const reportVeille = existing?.report_veille || 0;
    const deduction = existing?.deduction || 0;
    const caTotal = b.hebergement + b.bar + b.restaurant + b.divers;
    const aReporter = caTotal + reportVeille - deduction - b.encaissement;

    if (existing?.id) {
      // UPDATE: only touch the numeric/calculated columns — never re-send metadata
      const updatePayload = {
        hebergement: b.hebergement,
        bar: b.bar,
        restaurant: b.restaurant,
        divers: b.divers,
        encaissement: b.encaissement,
        deduction,
        updated_at: new Date().toISOString(),
      } as any;
      const { error } = await supabase.from('main_courante').update(updatePayload).eq('id', existing.id);
      if (error) {
        console.error('reconcile UPDATE failed', { id: existing.id, updatePayload, error });
        throw new Error(`main_courante UPDATE: ${error.message} | ${error.details || ''} | ${error.hint || ''}`);
      }
    } else if (b.guestId) {
      // INSERT: send all required fields
      const guestName = stayInfo?.guests
        ? `${stayInfo.guests.last_name} ${stayInfo.guests.first_name}`
        : 'Client';
      const insertPayload = {
        hotel_id: hotelId,
        journee: dateKey,
        guest_id: b.guestId,
        room_number: stayInfo?.rooms?.room_number || '',
        nom_client: guestName,
        nombre_personnes: stayInfo
          ? (stayInfo.number_of_adults || 1) + (stayInfo.number_of_children || 0)
          : 1,
        hebergement: b.hebergement,
        bar: b.bar,
        restaurant: b.restaurant,
        divers: b.divers,
        encaissement: b.encaissement,
        deduction,
        report_veille: reportVeille,
      } as any;
      const { error } = await supabase.from('main_courante').insert(insertPayload);
      if (error) {
        console.error('reconcile INSERT failed', { insertPayload, error });
        throw new Error(`main_courante INSERT: ${error.message} | ${error.details || ''} | ${error.hint || ''}`);
      }
    }
  }
}

export async function synchronizeActiveStayAccruals(hotelId: string) {
  const now = new Date();
  const todayKey = toDateKey(now);

  const { data: activeStays, error: staysError } = await supabase
    .from('stays')
    .select('id, hotel_id, guest_id, stay_type, check_in_date, actual_check_out, number_of_nights, price_per_night, arrangement_price, total_price, invoice_id, status')
    .eq('hotel_id', hotelId)
    .eq('status', 'active');

  if (staysError) throw staysError;
  if (!activeStays?.length) {
    return { scanned: 0, updated: 0, charged: 0 };
  }

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const invoiceIds = activeStays
    .map((stay: any) => stay.invoice_id)
    .filter((value: any): value is string => typeof value === 'string' && uuidRegex.test(value));
  const billedByInvoice = new Map<string, { room: number; sieste: number }>();

  if (invoiceIds.length > 0) {
    const { data: invoiceItems, error: invoiceItemsError } = await supabase
      .from('invoice_items')
      .select('invoice_id, item_type, description, quantity')
      .eq('hotel_id', hotelId)
      .in('invoice_id', invoiceIds as string[]);

    if (!invoiceItemsError) {
      for (const item of invoiceItems || []) {
        if (!item.invoice_id) continue;
        const bucket = billedByInvoice.get(item.invoice_id) || { room: 0, sieste: 0 };
        if (item.item_type === 'room') bucket.room += Number(item.quantity || 0);
        if (isSiesteInvoiceItem(item)) bucket.sieste += Number(item.quantity || 0);
        billedByInvoice.set(item.invoice_id, bucket);
      }
    }
  }

  let updated = 0;
  let charged = 0;

  for (const stay of activeStays as any[]) {
    try {
    const isSieste = stay.stay_type === 'sieste';
    const start = new Date(stay.check_in_date);
    const end = stay.actual_check_out ? new Date(stay.actual_check_out) : now;
    const elapsedUnits = isSieste
      ? Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 3600000))
      : Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000));

    const negotiatedTotal = Number(stay.arrangement_price || 0);
    const configuredUnits = isSieste
      ? 1
      : Math.max(1, Number(stay.number_of_nights || 1));
    const unitPrice = negotiatedTotal > 0
      ? negotiatedTotal / configuredUnits
      : Number(stay.price_per_night || 0);
    const expectedTotal = elapsedUnits * unitPrice;
    const billed = billedByInvoice.get(stay.invoice_id || '') || { room: 0, sieste: 0 };
    const billedUnits = isSieste ? billed.sieste : billed.room;
    const missingUnits = Math.max(0, elapsedUnits - billedUnits);

    let invoiceId = stay.invoice_id;
    if (!stay.guest_id || (typeof stay.guest_id === 'string' && !uuidRegex.test(stay.guest_id))) {
      continue;
    }
    if (!invoiceId) {
      const invoice = await getOrCreateInvoice(hotelId, stay.id, stay.guest_id);
      invoiceId = invoice.id;
    }

    if (missingUnits > 0 && invoiceId) {
      await addChargeToInvoice({
        hotelId,
        invoiceId,
        stayId: stay.id,
        guestId: stay.guest_id,
        description: isSieste
          ? `Extension sieste - ${missingUnits}h`
          : `Nuitees additionnelles - ${missingUnits} nuit(s)`,
        itemType: isSieste ? 'sieste' : 'room',
        quantity: missingUnits,
        unitPrice,
        date: todayKey,
      });
      charged += 1;
    }

    const patch: any = { total_price: expectedTotal };
    if (!isSieste) patch.number_of_nights = elapsedUnits;

    const needsPatch = Number(stay.total_price || 0) !== expectedTotal || (!isSieste && Number(stay.number_of_nights || 0) !== elapsedUnits);
    if (needsPatch) {
      const { error: patchError } = await supabase
        .from('stays')
        .update(patch)
        .eq('id', stay.id);
      if (patchError) throw patchError;
      updated += 1;
    }
    } catch (error) {
      console.warn('stay accrual sync skipped for stay', stay?.id, error);
    }
  }

  return {
    scanned: activeStays.length,
    updated,
    charged,
  };
}

export async function recordCashMovement(params: {
  hotelId: string;
  type: 'in' | 'out';
  source: string;
  description: string;
  amount: number;
  paymentMethod: string;
  referenceId?: string;
  userId: string;
}) {
  const session = await getOrCreateCashSession(params.hotelId, params.userId);

  const { error } = await supabase.from('cash_movements').insert({
    hotel_id: params.hotelId,
    session_id: session.id,
    type: params.type,
    source: params.source,
    description: params.description,
    amount: params.amount,
    payment_method: params.paymentMethod,
    reference_id: params.referenceId,
    recorded_by: params.userId,
  });

  if (error) throw error;

  const delta = params.type === 'in' ? params.amount : -params.amount;
  await supabase
    .from('cash_sessions')
    .update({ expected_balance: (session.expected_balance || 0) + delta })
    .eq('id', session.id);
}

export async function getOrCreateCashSession(hotelId: string, userId: string) {
  const today = toDateKey();

  const { data: existing } = await supabase
    .from('cash_sessions')
    .select('*')
    .eq('hotel_id', hotelId)
    .eq('status', 'open')
    .gte('opened_at', `${today}T00:00:00`)
    .maybeSingle();

  if (existing) return existing;

  const { data: oldSession } = await supabase
    .from('cash_sessions')
    .select('*')
    .eq('hotel_id', hotelId)
    .eq('status', 'open')
    .maybeSingle();

  if (oldSession) {
    await supabase
      .from('cash_sessions')
      .update({
        status: 'closed',
        closed_at: new Date().toISOString(),
        closing_balance: oldSession.expected_balance,
        difference: 0,
      })
      .eq('id', oldSession.id);
  }

  const openingBalance = oldSession?.expected_balance || 0;

  const { data: newSession, error } = await supabase
    .from('cash_sessions')
    .insert({
      hotel_id: hotelId,
      opened_by: userId,
      opening_balance: openingBalance,
      expected_balance: openingBalance,
      status: 'open',
    })
    .select()
    .single();

  if (error) throw error;
  return newSession;
}

export async function recalculateInvoiceTotals(invoiceId: string) {
  const { data: items } = await supabase
    .from('invoice_items')
    .select('subtotal')
    .eq('invoice_id', invoiceId);

  const { data: paymentsData } = await supabase
    .from('payments')
    .select('amount')
    .eq('invoice_id', invoiceId);

  const { data: invoiceData } = await supabase
    .from('invoices')
    .select('tax_percentage')
    .eq('id', invoiceId)
    .single();

  const subtotal = items?.reduce((sum, i) => sum + (i.subtotal || 0), 0) || 0;
  const taxPct = invoiceData?.tax_percentage || 0;
  const taxAmount = subtotal * (taxPct / 100);
  const totalAmount = subtotal + taxAmount;
  const amountPaid = paymentsData?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;
  const balanceDue = totalAmount - amountPaid;

  await supabase
    .from('invoices')
    .update({
      subtotal,
      tax_amount: taxAmount,
      total_amount: totalAmount,
      amount_paid: amountPaid,
      balance_due: balanceDue,
      status: balanceDue <= 0 ? 'paid' : amountPaid > 0 ? 'partial' : 'open',
    })
    .eq('id', invoiceId);

  return { subtotal, totalAmount, amountPaid, balanceDue };
}
