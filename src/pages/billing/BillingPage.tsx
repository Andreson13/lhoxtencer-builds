import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useHotel } from '@/contexts/HotelContext';
import { useRoleGuard } from '@/hooks/useRoleGuard';
import { useI18n } from '@/contexts/I18nContext';
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
  const { t } = useI18n();
  const { profile } = useAuth();
  const { hotel } = useHotel();
  const qc = useQueryClient();
  const [searchParams] = useSearchParams();
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [openInvoiceId, setOpenInvoiceId] = useState<string | undefined>(searchParams.get('invoiceId') || undefined);

  const { data: invoices, isLoading } = useQuery({
    queryKey: ['invoices', hotel?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('invoices').select('*, invoice_items(*), guests(last_name, first_name), stays(id, guest_id, rooms(room_number))').eq('hotel_id', hotel!.id).order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!hotel?.id,
  });

  const queryInvoiceId = searchParams.get('invoiceId');
  const visibleInvoices = queryInvoiceId ? (invoices || []).filter((inv: any) => inv.id === queryInvoiceId) : (invoices || []);
  const openInvoices = visibleInvoices.filter((inv: any) => !['paid', 'cancelled'].includes(inv.status || 'open')).length;
  const paidInvoices = visibleInvoices.filter((inv: any) => inv.status === 'paid').length;
  const outstandingTotal = visibleInvoices.reduce((sum: number, inv: any) => sum + Number(inv.balance_due || 0), 0);

  return (
    <div className="page-container space-y-6">
      <PageHeader title={t('billing.title')} subtitle={`${visibleInvoices.length || 0} ${t('billing.subtitle')}`} />

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <p className="text-sm text-muted-foreground">{t('billing.summary.openInvoices')}</p>
          <p className="mt-2 text-2xl font-semibold">{openInvoices}</p>
        </div>
        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <p className="text-sm text-muted-foreground">{t('billing.summary.paidInvoices')}</p>
          <p className="mt-2 text-2xl font-semibold">{paidInvoices}</p>
        </div>
        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <p className="text-sm text-muted-foreground">{t('billing.summary.outstanding')}</p>
          <p className="mt-2 text-2xl font-semibold text-destructive">{formatFCFA(outstandingTotal)}</p>
        </div>
      </div>

      {isLoading ? <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div> : !visibleInvoices.length ? (
        <EmptyState icon={Receipt} title={t('billing.emptyTitle')} description={t('billing.emptyDescription')} />
      ) : (
        <Accordion type="single" collapsible className="space-y-2" value={openInvoiceId} onValueChange={setOpenInvoiceId}>
          {visibleInvoices.map((inv: any) => (
            <AccordionItem key={inv.id} value={inv.id} className="border rounded-2xl px-4 bg-card shadow-sm">
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
                    <TableHeader><TableRow><TableHead>{t('billing.table.description')}</TableHead><TableHead>{t('billing.table.type')}</TableHead><TableHead className="text-right">{t('billing.table.qty')}</TableHead><TableHead className="text-right">{t('billing.table.unitPrice')}</TableHead><TableHead className="text-right">{t('billing.table.subtotal')}</TableHead></TableRow></TableHeader>
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
                      <p>{t('billing.total.subtotal')}: {formatFCFA(inv.subtotal)}</p>
                      <p>{t('billing.total.taxes')} ({inv.tax_percentage}%): {formatFCFA(inv.tax_amount)}</p>
                      <p className="font-semibold">{t('billing.total.total')}: {formatFCFA(inv.total_amount)}</p>
                      <p>{t('billing.total.paid')}: {formatFCFA(inv.amount_paid)}</p>
                      <p className="text-destructive font-semibold">{t('billing.total.balance')}: {formatFCFA(inv.balance_due)}</p>
                    </div>
                    {inv.status !== 'paid' && inv.status !== 'cancelled' && (
                      <Button onClick={() => { setSelectedInvoice(inv); setPaymentDialogOpen(true); }}>
                        <CreditCard className="h-4 w-4 mr-2" />{t('billing.recordPayment')}
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
