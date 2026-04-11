import { supabase } from '@/integrations/supabase/client';

export const recordCashMovement = async (
  hotelId: string,
  type: 'in' | 'out',
  source: string,
  description: string,
  amount: number,
  paymentMethod: string,
  referenceId?: string,
  recordedBy?: string,
) => {
  const today = new Date().toISOString().split('T')[0];

  // Find open session for today
  let { data: session } = await supabase
    .from('cash_sessions')
    .select('id, expected_balance')
    .eq('hotel_id', hotelId)
    .eq('status', 'open')
    .gte('opened_at', `${today}T00:00:00`)
    .limit(1)
    .maybeSingle();

  // Auto-create if none exists
  if (!session) {
    // Get yesterday's closing balance
    const { data: lastSession } = await supabase
      .from('cash_sessions')
      .select('closing_balance, expected_balance')
      .eq('hotel_id', hotelId)
      .eq('status', 'closed')
      .order('closed_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const openingBalance = lastSession?.closing_balance ?? lastSession?.expected_balance ?? 0;

    const { data: newSession, error: sessErr } = await supabase
      .from('cash_sessions')
      .insert({
        hotel_id: hotelId,
        opening_balance: openingBalance,
        expected_balance: openingBalance,
        opened_by: recordedBy || null,
        status: 'open',
      })
      .select()
      .single();
    if (sessErr) throw sessErr;
    session = newSession;
  }

  // Insert cash movement
  const { error: mvErr } = await supabase.from('cash_movements').insert({
    hotel_id: hotelId,
    session_id: session.id,
    type,
    source,
    description,
    amount,
    payment_method: paymentMethod,
    reference_id: referenceId || null,
    recorded_by: recordedBy || null,
  });
  if (mvErr) throw mvErr;

  // Update expected balance
  const newBalance = (session.expected_balance || 0) + (type === 'in' ? amount : -amount);
  await supabase
    .from('cash_sessions')
    .update({ expected_balance: newBalance })
    .eq('id', session.id);
};
