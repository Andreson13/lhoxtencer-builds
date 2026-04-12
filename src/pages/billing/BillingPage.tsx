import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useHotel } from '@/contexts/HotelContext';
import { useRoleGuard } from '@/hooks/useRoleGuard';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { PaymentDialog } from '@/components/shared/PaymentDialog';
import { formatFCFA, formatDate, generateInvoiceNumber } from '@/utils/formatters';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { toast } from 'sonner';
import { Receipt, Plus, CreditCard } from 'lucide-react';

const BillingPage = () => {
  useRoleGuard(['admin', 'manager', 'receptionist', 'accountant']);
  const { profile } = useAuth();
  const { hotel } = useHotel();
  const qc = useQueryClient();
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);

  const { data: invoices, isLoading } = useQuery({
    queryKey: ['invoices', hotel?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('invoices').select('*, invoice_items(*), guests(last_name, first_name), stays(id, guest_id, rooms(room_number))').eq('hotel_id', hotel!.id).order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!hotel?.id,
  });

  return (
    <div className="page-container space-y-6">
      <PageHeader title="Facturation" subtitle={`${invoices?.length || 0} facture(s)`} />

      {isLoading ? <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div> : !invoices?.length ? (
        <EmptyState icon={Receipt} title="Aucune facture" description="Les factures seront créées automatiquement lors des check-outs" />
      ) : (
        <Accordion type="single" collapsible className="space-y-2">
          {invoices.map(inv => (
            <AccordionItem key={inv.id} value={inv.id} className="border rounded-md px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-4 w-full mr-4">
                  <span className="font-mono text-sm">{inv.invoice_number}</span>
                  <span className="font-medium">{(inv as any).guests ? `${(inv as any).guests.last_name} ${(inv as any).guests.first_name}` : '-'}</span>
                  <span className="ml-auto font-semibold">{formatFCFA(inv.total_amount)}</span>
                  <StatusBadge status={inv.status || 'open'} />
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 pb-4">
                  <Table>
                    <TableHeader><TableRow><TableHead>Description</TableHead><TableHead>Type</TableHead><TableHead className="text-right">Qté</TableHead><TableHead className="text-right">P.U.</TableHead><TableHead className="text-right">Sous-total</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {(inv as any).invoice_items?.map((item: any) => (
                        <TableRow key={item.id}>
                          <TableCell>{item.description}</TableCell>
                          <TableCell>{item.item_type}</TableCell>
                          <TableCell className="text-right">{item.quantity}</TableCell>
                          <TableCell className="text-right">{formatFCFA(item.unit_price)}</TableCell>
                          <TableCell className="text-right">{formatFCFA(item.subtotal)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="flex justify-between items-center border-t pt-3">
                    <div className="text-sm space-y-1">
                      <p>Sous-total: {formatFCFA(inv.subtotal)}</p>
                      <p>Taxes ({inv.tax_percentage}%): {formatFCFA(inv.tax_amount)}</p>
                      <p className="font-semibold">Total: {formatFCFA(inv.total_amount)}</p>
                      <p>Payé: {formatFCFA(inv.amount_paid)}</p>
                      <p className="text-destructive font-semibold">Solde: {formatFCFA(inv.balance_due)}</p>
                    </div>
                    {inv.status !== 'paid' && inv.status !== 'cancelled' && (
                      <Button onClick={() => { setSelectedInvoice(inv); setPaymentDialogOpen(true); }}>
                        <CreditCard className="h-4 w-4 mr-2" />Enregistrer un paiement
                      </Button>
                    )}
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
      {selectedInvoice && (
        <PaymentDialog
          open={paymentDialogOpen}
          onOpenChange={setPaymentDialogOpen}
          invoiceId={selectedInvoice.id}
          stayId={selectedInvoice.stay_id || selectedInvoice.stays?.id}
          guestId={selectedInvoice.guest_id || selectedInvoice.stays?.guest_id}
          currentBalance={selectedInvoice.balance_due || 0}
          invoiceNumber={selectedInvoice.invoice_number}
          guestName={(selectedInvoice as any).guests ? `${(selectedInvoice as any).guests.last_name} ${(selectedInvoice as any).guests.first_name}` : undefined}
          roomNumber={(selectedInvoice as any).stays?.rooms?.room_number || undefined}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ['invoices'] });
            setSelectedInvoice(null);
          }}
        />
      )}
    </div>
  );
};

export default BillingPage;
