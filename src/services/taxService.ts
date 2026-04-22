import { supabase } from '@/lib/supabase';
import { addChargeToInvoice } from './transactionService';

export interface FixedCharge {
  id: string;
  name: string;
  amount: number;
  per: 'night' | 'stay';
  enabled: boolean;
}

export const DEFAULT_FIXED_CHARGES: FixedCharge[] = [
  { id: 'internet', name: 'Internet / WiFi', amount: 1000, per: 'night', enabled: true },
  { id: 'tv', name: 'Canal+ / TV', amount: 500, per: 'night', enabled: true },
  { id: 'linen', name: 'Frais de linge', amount: 1500, per: 'stay', enabled: false },
];

export async function getHotelSetting(hotelId: string, key: string): Promise<string | null> {
  const { data } = await supabase
    .from('hotel_settings')
    .select('value')
    .eq('hotel_id', hotelId)
    .eq('key', key)
    .maybeSingle();
  return data?.value ?? null;
}

export async function setHotelSetting(hotelId: string, key: string, value: string): Promise<void> {
  const { error } = await supabase
    .from('hotel_settings')
    .upsert({ hotel_id: hotelId, key, value }, { onConflict: 'hotel_id,key' });
  if (error) throw error;
}

export async function applyTaxesAndFixedCharges(params: {
  hotelId: string;
  invoiceId: string;
  stayId: string;
  guestId: string;
  numberOfNights: number;
  includeFixedCharges?: boolean; // Allow disabling fixed charges
}): Promise<void> {
  try {
    const [govTaxEnabled, govTax, govTaxLabel, fixedChargesJson] = await Promise.all([
      getHotelSetting(params.hotelId, 'government_tax_enabled'),
      getHotelSetting(params.hotelId, 'government_tax_per_room_per_night'),
      getHotelSetting(params.hotelId, 'government_tax_label'),
      getHotelSetting(params.hotelId, 'fixed_charges'),
    ]);

    // Government tax (always apply if enabled)
    if (govTaxEnabled === 'true' && govTax && parseFloat(govTax) > 0) {
      await addChargeToInvoice({
        hotelId: params.hotelId,
        invoiceId: params.invoiceId,
        stayId: params.stayId,
        guestId: params.guestId,
        description: `${govTaxLabel || 'Taxe gouvernementale'} — ${params.numberOfNights} nuit(s)`,
        itemType: 'tax' as any,
        quantity: params.numberOfNights,
        unitPrice: parseFloat(govTax),
      });
    }

    // Fixed charges (only if explicitly enabled - default: disabled)
    // This allows hotels to decide if they want separate line items or include in room price
    if (params.includeFixedCharges === true && fixedChargesJson) {
      const charges: FixedCharge[] = JSON.parse(fixedChargesJson);
      for (const charge of charges.filter((c) => c.enabled)) {
        const qty = charge.per === 'night' ? params.numberOfNights : 1;
        await addChargeToInvoice({
          hotelId: params.hotelId,
          invoiceId: params.invoiceId,
          stayId: params.stayId,
          guestId: params.guestId,
          description: `${charge.name}${charge.per === 'night' ? ` — ${params.numberOfNights} nuit(s)` : ''}`,
          itemType: 'extra',
          quantity: qty,
          unitPrice: charge.amount,
        });
      }
    }
  } catch (err) {
    console.error('applyTaxesAndFixedCharges error:', err);
  }
}
