import { supabase } from '@/lib/supabase';

const toDateKey = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const getCurrentWeekRange = () => {
  const now = new Date();
  const day = now.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset);
  return { start: toDateKey(monday), end: toDateKey(now) };
};

export const normalizeDateRange = (start: string, end: string) => {
  if (start <= end) return { start, end };
  return { start: end, end: start };
};

export const fetchPoliceRegisterRows = async (hotelId: string, periodStart: string, periodEnd: string) => {
  const { start, end } = normalizeDateRange(periodStart, periodEnd);

  const { data: stays, error: staysError } = await supabase
    .from('stays')
    .select(`
      id, guest_id, stay_type, check_in_date, check_out_date, actual_check_out, status,
      rooms(room_number),
      guests(
        id, last_name, first_name, date_of_birth, place_of_birth,
        nationality, profession, usual_address, country_of_residence,
        id_type, id_number, id_issued_on, id_issued_at, gender, phone
      )
    `)
    .eq('hotel_id', hotelId)
    .lte('check_in_date', `${end}T23:59:59`)
    .or(`check_out_date.is.null,check_out_date.gte.${start}T00:00:00`)
    .order('check_in_date', { ascending: true });

  if (staysError) throw staysError;

  const { data: siestes, error: siestesError } = await supabase
    .from('siestes')
    .select(`
      id, guest_id, arrival_date, arrival_time, departure_time,
      rooms(room_number),
      guests(
        id, last_name, first_name, date_of_birth, place_of_birth,
        nationality, profession, usual_address, country_of_residence,
        id_type, id_number, id_issued_on, id_issued_at, gender, phone
      )
    `)
    .eq('hotel_id', hotelId)
    .gte('arrival_date', start)
    .lte('arrival_date', end)
    .order('arrival_date', { ascending: true });

  if (siestesError) throw siestesError;

  const stayRows = (stays || []).map((row: any) => ({
    source: 'stay',
    id: row.id,
    guest: row.guests,
    room_number: row.rooms?.room_number || '-',
    check_in_date: row.check_in_date,
    check_out_date: row.actual_check_out || row.check_out_date,
    observation: row.status === 'active' ? 'Toujours en séjour' : '',
  }));

  const siesteRows = (siestes || []).map((row: any) => ({
    source: 'sieste',
    id: row.id,
    guest: row.guests,
    room_number: row.rooms?.room_number || '-',
    check_in_date: row.arrival_date,
    check_out_date: row.arrival_date,
    observation: 'Sieste',
  }));

  return [...stayRows, ...siesteRows].filter((row) => !!row.guest?.id);
};

export const fetchCustomerDossierData = async (hotelId: string, guestId: string) => {
  const { data: guest, error: guestError } = await supabase
    .from('guests')
    .select('*')
    .eq('id', guestId)
    .eq('hotel_id', hotelId)
    .maybeSingle();

  if (guestError) throw guestError;
  if (!guest) throw new Error('Client introuvable');

  const { data: stays, error: staysError } = await supabase
    .from('stays')
    .select(`
      *,
      rooms(room_number),
      room_categories(name, color),
      invoices(
        id, invoice_number, subtotal, tax_percentage, tax_amount,
        total_amount, amount_paid, balance_due, status,
        created_at,
        invoice_items(description, item_type, quantity, unit_price, subtotal)
      )
    `)
    .eq('guest_id', guestId)
    .eq('hotel_id', hotelId)
    .order('check_in_date', { ascending: false });

  if (staysError) throw staysError;

  const { data: siestes, error: siestesError } = await supabase
    .from('siestes')
    .select('*, rooms(room_number)')
    .eq('guest_id', guestId)
    .eq('hotel_id', hotelId)
    .order('arrival_date', { ascending: false });

  if (siestesError) throw siestesError;

  const invoiceIds = (stays || [])
    .map((s: any) => s.invoices?.id)
    .filter(Boolean);

  let payments: any[] = [];
  if (invoiceIds.length > 0) {
    const { data: paymentsData, error: paymentsError } = await supabase
      .from('payments')
      .select('*, invoices(invoice_number)')
      .eq('hotel_id', hotelId)
      .in('invoice_id', invoiceIds)
      .order('created_at', { ascending: false });

    if (paymentsError) throw paymentsError;
    payments = paymentsData || [];
  }

  return {
    guest,
    stays: stays || [],
    siestes: siestes || [],
    payments,
  };
};
