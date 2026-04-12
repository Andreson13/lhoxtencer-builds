import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useHotel } from '@/contexts/HotelContext';
import { formatFCFA } from '@/utils/formatters';
import { recordPayment } from '@/services/transactionService';
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
  stayId: string;
  guestId: string;
  currentBalance: number;
  invoiceNumber?: string;
  guestName?: string;
  roomNumber?: string;
  onSuccess?: () => void;
}

export const PaymentDialog = ({
  open, onOpenChange, invoiceId, stayId, guestId, currentBalance,
  invoiceNumber, guestName, roomNumber, onSuccess,
}: PaymentDialogProps) => {
  const { profile } = useAuth();
  const { hotel } = useHotel();
  const qc = useQueryClient();
  const [amount, setAmount] = useState(currentBalance);
  const [method, setMethod] = useState('cash');
  const [reference, setReference] = useState('');

  React.useEffect(() => { setAmount(currentBalance); }, [currentBalance]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!hotel || !profile || amount <= 0) throw new Error('Invalid');
      await recordPayment({
        hotelId: hotel.id,
        invoiceId,
        stayId,
        guestId,
        amount,
        paymentMethod: method,
        referenceNumber: reference || undefined,
        userId: profile.id,
        userName: profile.full_name || '',
        roomNumber,
        guestName,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['stays'] });
      qc.invalidateQueries({ queryKey: ['cash-movements'] });
      qc.invalidateQueries({ queryKey: ['main-courante'] });
      toast.success(`Paiement enregistré — ${formatFCFA(amount)} reçus`);
      onSuccess?.();
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Banknote className="h-5 w-5" />Marquer comme payé</DialogTitle>
          <DialogDescription>Facture {invoiceNumber || invoiceId}{guestName ? ` — ${guestName}` : ''}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Montant (FCFA)</Label>
            <Input type="number" value={amount} onChange={e => setAmount(Number(e.target.value))} />
            <p className="text-xs text-muted-foreground mt-1">Solde restant: {formatFCFA(currentBalance)}</p>
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
