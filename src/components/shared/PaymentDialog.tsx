import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useHotel } from '@/contexts/HotelContext';
import { recordCashMovement } from '@/utils/cashMovement';
import { updateMainCourante } from '@/utils/mainCourante';
import { formatFCFA } from '@/utils/formatters';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Banknote } from 'lucide-react';

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string;
  invoiceNumber: string;
  balanceDue: number;
  totalAmount: number;
  amountPaid: number;
  guestName?: string;
  guestId?: string | null;
  roomNumber?: string;
  source?: string;
}

export const PaymentDialog = ({
  open, onOpenChange, invoiceId, invoiceNumber, balanceDue, totalAmount, amountPaid,
  guestName, guestId, roomNumber, source = 'payment',
}: PaymentDialogProps) => {
  const { profile } = useAuth();
  const { hotel } = useHotel();
  const qc = useQueryClient();
  const [amount, setAmount] = useState(balanceDue);
  const [method, setMethod] = useState('cash');
  const [reference, setReference] = useState('');

  React.useEffect(() => { setAmount(balanceDue); }, [balanceDue]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!hotel || !profile || amount <= 0) throw new Error('Invalid');

      // Insert payment
      const { error: payErr } = await supabase.from('payments').insert({
        hotel_id: hotel.id,
        invoice_id: invoiceId,
        amount,
        payment_method: method,
        reference_number: reference || null,
        recorded_by: profile.id,
        created_by: profile.id,
        created_by_name: profile.full_name,
      } as any);
      if (payErr) throw payErr;

      // Update invoice
      const newPaid = amountPaid + amount;
      const newBalance = Math.max(0, totalAmount - newPaid);
      const newStatus = newBalance <= 0 ? 'paid' : 'partial';
      await supabase.from('invoices').update({
        amount_paid: newPaid, balance_due: newBalance, status: newStatus,
      }).eq('id', invoiceId);

      // Record cash movement
      await recordCashMovement(
        hotel.id, 'in', source,
        `Paiement facture #${invoiceNumber}${guestName ? ' — ' + guestName : ''}`,
        amount, method, invoiceId, profile.id,
      );

      // Update main courante
      if (roomNumber) {
        const today = new Date().toISOString().split('T')[0];
        await updateMainCourante(hotel.id, today, guestId || null, roomNumber, guestName || '', 'encaissement', amount);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['stays'] });
      qc.invalidateQueries({ queryKey: ['cash-movements'] });
      qc.invalidateQueries({ queryKey: ['main-courante'] });
      toast.success(`Paiement enregistré — ${formatFCFA(amount)} reçus`);
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Banknote className="h-5 w-5" />Marquer comme payé</DialogTitle>
          <DialogDescription>Facture {invoiceNumber}{guestName ? ` — ${guestName}` : ''}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Montant (FCFA)</Label>
            <Input type="number" value={amount} onChange={e => setAmount(Number(e.target.value))} />
            <p className="text-xs text-muted-foreground mt-1">Solde restant: {formatFCFA(balanceDue)}</p>
          </div>
          <div>
            <Label>Mode de paiement</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="mtn_momo">MTN MoMo</SelectItem>
                <SelectItem value="orange_money">Orange Money</SelectItem>
                <SelectItem value="bank_transfer">Virement</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>N° de référence (optionnel)</Label>
            <Input value={reference} onChange={e => setReference(e.target.value)} placeholder="Référence transaction" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || amount <= 0} className="bg-green-600 hover:bg-green-700">
            <Banknote className="h-4 w-4 mr-2" />Enregistrer le paiement
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
