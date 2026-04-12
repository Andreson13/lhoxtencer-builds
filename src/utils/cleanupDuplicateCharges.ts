import { supabase } from '@/integrations/supabase/client';

/**
 * Cleans up duplicate restaurant invoice items from the same order.
 * Keeps the first occurrence, removes subsequent duplicates.
 */
export async function cleanupDuplicateRestaurantCharges(hotelId: string) {
  try {
    // Get all restaurant invoice items
    const { data: items, error: itemsError } = await supabase
      .from('invoice_items')
      .select('id, invoice_id, description')
      .eq('hotel_id', hotelId)
      .like('description', 'Restaurant — Commande #%')
      .order('created_at', { ascending: true });

    if (itemsError) throw itemsError;
    if (!items || items.length === 0) return { cleaned: 0, message: 'No restaurant items found' };

    // Group by invoice_id + description to find duplicates
    const groups: Record<string, any[]> = {};
    items.forEach((item: any) => {
      const key = `${item.invoice_id}|${item.description}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });

    // Delete duplicates (keep first)
    let cleanedCount = 0;
    for (const itemGroup of Object.values(groups)) {
      if (itemGroup.length > 1) {
        const idsToDelete = itemGroup.slice(1).map((i: any) => i.id);
        const { error: deleteError } = await supabase
          .from('invoice_items')
          .delete()
          .in('id', idsToDelete);
        if (deleteError) throw deleteError;
        cleanedCount += idsToDelete.length;
      }
    }

    // Recalculate totals for affected invoices
    const affectedInvoices = new Set(items.map((i: any) => i.invoice_id));
    for (const invoiceId of affectedInvoices) {
      // This triggers the recalculation via the transaction service pattern
      const { data: invoiceItems } = await supabase
        .from('invoice_items')
        .select('subtotal')
        .eq('invoice_id', invoiceId);

      if (invoiceItems) {
        const totalAmount = invoiceItems.reduce((sum: number, i: any) => sum + (i.subtotal || 0), 0);
        await supabase.from('invoices').update({ total_amount: totalAmount } as any).eq('id', invoiceId);
      }
    }

    return { cleaned: cleanedCount, message: `Cleaned ${cleanedCount} duplicate restaurant charges` };
  } catch (error) {
    console.error('Cleanup failed:', error);
    throw error;
  }
}
