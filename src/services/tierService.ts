import { supabase } from '@/lib/supabase';
import { getHotelSetting } from './taxService';

export interface TierThresholds {
  silver: { stays: number; totalSpent: number; points: number };
  gold: { stays: number; totalSpent: number; points: number };
  vip: { stays: number; totalSpent: number; points: number };
}

export interface TierBenefit {
  id: string;
  tier: 'silver' | 'gold' | 'vip';
  benefit_type: 'discount_percentage' | 'free_night_after_stays' | 'priority_room' | 'free_breakfast' | 'complimentary_upgrade';
  benefit_value: number;
  description?: string | null;
  active: boolean;
}

export const DEFAULT_TIER_THRESHOLDS: TierThresholds = {
  silver: { stays: 3, totalSpent: 150000, points: 150 },
  gold: { stays: 10, totalSpent: 500000, points: 500 },
  vip: { stays: 25, totalSpent: 1500000, points: 1500 },
};

export async function getTierThresholds(hotelId: string): Promise<TierThresholds> {
  const json = await getHotelSetting(hotelId, 'tier_thresholds');
  if (json) {
    try {
      return JSON.parse(json);
    } catch {}
  }
  return DEFAULT_TIER_THRESHOLDS;
}

export async function evaluateGuestTier(guestId: string, hotelId: string): Promise<void> {
  try {
    // Count completed stays
    const { data: stays } = await supabase
      .from('stays')
      .select('id, total_price')
      .eq('guest_id', guestId)
      .eq('hotel_id', hotelId)
      .eq('status', 'checked_out');

    const totalStays = stays?.length || 0;
    const totalSpent = stays?.reduce((s, st) => s + Number(st.total_price || 0), 0) || 0;

    const { data: guest } = await supabase
      .from('guests')
      .select('tier, loyalty_points')
      .eq('id', guestId)
      .maybeSingle();

    const currentTier = guest?.tier || 'regular';
    const loyaltyPoints = guest?.loyalty_points || 0;

    const thresholds = await getTierThresholds(hotelId);

    let newTier = 'regular';
    if (
      totalStays >= thresholds.vip.stays ||
      totalSpent >= thresholds.vip.totalSpent ||
      loyaltyPoints >= thresholds.vip.points
    ) {
      newTier = 'vip';
    } else if (
      totalStays >= thresholds.gold.stays ||
      totalSpent >= thresholds.gold.totalSpent ||
      loyaltyPoints >= thresholds.gold.points
    ) {
      newTier = 'gold';
    } else if (
      totalStays >= thresholds.silver.stays ||
      totalSpent >= thresholds.silver.totalSpent ||
      loyaltyPoints >= thresholds.silver.points
    ) {
      newTier = 'silver';
    }

    // Don't downgrade blacklisted guests
    if (currentTier === 'blacklist') return;
    // Don't downgrade
    const tierOrder = ['regular', 'silver', 'gold', 'vip'];
    if (tierOrder.indexOf(newTier) <= tierOrder.indexOf(currentTier)) return;

    await supabase
      .from('guests')
      .update({ tier: newTier, tier_assigned_at: new Date().toISOString() } as any)
      .eq('id', guestId);
  } catch (err) {
    console.error('evaluateGuestTier error:', err);
  }
}

export async function getActiveTierBenefits(hotelId: string, tier: string): Promise<TierBenefit[]> {
  if (!hotelId || !tier || tier === 'regular' || tier === 'blacklist') return [];
  const { data, error } = await supabase
    .from('tier_benefits' as any)
    .select('id, tier, benefit_type, benefit_value, description, active')
    .eq('hotel_id', hotelId)
    .eq('tier', tier)
    .eq('active', true);
  if (error) {
    console.warn('getActiveTierBenefits error:', error.message);
    return [];
  }
  return (data || []) as TierBenefit[];
}

export function applyTierBenefitsPricing(baseTotal: number, units: number, benefits: TierBenefit[]) {
  const safeBase = Math.max(0, Number(baseTotal || 0));
  const safeUnits = Math.max(1, Number(units || 1));
  const discountPercent = benefits
    .filter((b) => b.benefit_type === 'discount_percentage')
    .reduce((sum, b) => sum + Number(b.benefit_value || 0), 0);
  const cappedDiscount = Math.min(90, Math.max(0, discountPercent));
  const discountedTotal = Math.round(safeBase * (1 - cappedDiscount / 100));
  const unitPrice = Math.round(discountedTotal / safeUnits);

  return {
    discountPercent: cappedDiscount,
    originalTotal: safeBase,
    discountedTotal,
    unitPrice,
    appliedBenefits: benefits,
  };
}

export async function addLoyaltyPoints(params: {
  guestId: string;
  hotelId: string;
  amountPaid: number;
  tier: string;
}): Promise<void> {
  try {
    const pointsPerThousand = await getHotelSetting(params.hotelId, 'loyalty_points_per_1000_fcfa');
    const rate = parseFloat(pointsPerThousand || '1');
    let points = Math.floor((params.amountPaid / 1000) * rate);

    // Tier bonuses
    if (params.tier === 'silver') points = Math.floor(points * 1.1);
    else if (params.tier === 'gold') points = Math.floor(points * 1.25);
    else if (params.tier === 'vip') points = Math.floor(points * 1.5);

    if (points <= 0) return;

    await supabase.rpc('increment_loyalty_points' as any, { guest_id: params.guestId, points_to_add: points });
  } catch {
    // fallback: direct update
    try {
      const { data: g } = await supabase.from('guests').select('loyalty_points').eq('id', params.guestId).maybeSingle();
      const current = g?.loyalty_points || 0;
      const pointsPerThousand = await getHotelSetting(params.hotelId, 'loyalty_points_per_1000_fcfa');
      const rate = parseFloat(pointsPerThousand || '1');
      let points = Math.floor((params.amountPaid / 1000) * rate);
      if (params.tier === 'silver') points = Math.floor(points * 1.1);
      else if (params.tier === 'gold') points = Math.floor(points * 1.25);
      else if (params.tier === 'vip') points = Math.floor(points * 1.5);
      await supabase.from('guests').update({ loyalty_points: current + points } as any).eq('id', params.guestId);
    } catch (err) {
      console.error('addLoyaltyPoints fallback error:', err);
    }
  }
}
