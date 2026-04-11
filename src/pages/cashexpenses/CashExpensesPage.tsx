import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useHotel } from '@/contexts/HotelContext';
import { useRoleGuard } from '@/hooks/useRoleGuard';
import { useCashSession } from '@/hooks/useCashSession';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { formatFCFA, formatDateTime, formatDate } from '@/utils/formatters';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Wallet, Plus, DollarSign, TrendingDown } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

const expenseSchema = z.object({
  title: z.string().min(1, 'Titre requis'),
  amount: z.coerce.number().min(1, 'Montant requis'),
  payment_method: z.string().default('cash'),
  description: z.string().optional(),
  expense_date: z.string().default(new Date().toISOString().split('T')[0]),
});

type ExpenseForm = z.infer<typeof expenseSchema>;

const CashExpensesPage = () => {
  useRoleGuard(['admin', 'manager', 'receptionist', 'accountant']);
  const { profile } = useAuth();
  const { hotel } = useHotel();
  const qc = useQueryClient();
  const { currentSession } = useCashSession();
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [manualCloseOpen, setManualCloseOpen] = useState(false);
  const [physicalCount, setPhysicalCount] = useState(0);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ExpenseForm>({ resolver: zodResolver(expenseSchema) });

  const { data: movements } = useQuery({
    queryKey: ['cash-movements', hotel?.id, currentSession?.id],
    queryFn: async () => {
      const { data } = await supabase.from('cash_movements').select('*').eq('hotel_id', hotel!.id).eq('session_id', currentSession!.id).order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!currentSession?.id,
  });

  const { data: expenses, isLoading: expensesLoading } = useQuery({
    queryKey: ['expenses', hotel?.id],
    queryFn: async () => {
      const { data } = await supabase.from('expenses').select('*').eq('hotel_id', hotel!.id).order('expense_date', { ascending: false });
      return data || [];
    },
    enabled: !!hotel?.id,
  });

  const totalIn = movements?.filter(m => m.type === 'in').reduce((s, m) => s + m.amount, 0) || 0;
  const totalOut = movements?.filter(m => m.type === 'out').reduce((s, m) => s + m.amount, 0) || 0;
  const expectedBalance = (currentSession?.opening_balance || 0) + totalIn - totalOut;

  const manualCloseMutation = useMutation({
    mutationFn: async () => {
      if (!currentSession) return;
      const diff = physicalCount - expectedBalance;
      const { error } = await supabase.from('cash_sessions').update({
        status: 'closed', closed_at: new Date().toISOString(), closed_by: profile?.id,
        expected_balance: expectedBalance, closing_balance: physicalCount, difference: diff,
      }).eq('id', currentSession.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cash-session-auto'] });
      toast.success('Session clôturée manuellement');
      setManualCloseOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const addExpenseMutation = useMutation({
    mutationFn: async (values: ExpenseForm) => {
      const { error } = await supabase.from('expenses').insert({
        ...values, hotel_id: hotel!.id, recorded_by: profile?.id, description: values.description || null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['expenses'] }); toast.success('Dépense ajoutée'); setExpenseDialogOpen(false); reset(); },
    onError: (e: any) => toast.error(e.message),
  });

  const approveExpense = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from('expenses').update({ approval_status: status, approved_by: profile?.id, approved_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['expenses'] }); toast.success('Statut mis à jour'); },
  });

  return (
    <div className="page-container space-y-6">
      <PageHeader title="Caisse & Dépenses" subtitle="Gestion de la trésorerie" />

      {/* Auto-opened session status */}
      {currentSession && (
        <Card>
          <CardHeader>
            <CardTitle className="flex justify-between items-center">
              <span>Session du {formatDate(currentSession.opened_at)}</span>
              <Badge>Ouverte automatiquement</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-4 gap-4">
            <div><p className="text-sm text-muted-foreground">Solde d'ouverture</p><p className="text-xl font-bold">{formatFCFA(currentSession.opening_balance)}</p></div>
            <div><p className="text-sm text-muted-foreground">Entrées</p><p className="text-xl font-bold text-green-600">{formatFCFA(totalIn)}</p></div>
            <div><p className="text-sm text-muted-foreground">Sorties</p><p className="text-xl font-bold text-destructive">{formatFCFA(totalOut)}</p></div>
            <div><p className="text-sm text-muted-foreground">Solde attendu</p><p className="text-xl font-bold">{formatFCFA(expectedBalance)}</p></div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="cash">
        <TabsList>
          <TabsTrigger value="cash"><DollarSign className="h-4 w-4 mr-2" />Caisse</TabsTrigger>
          <TabsTrigger value="expenses"><TrendingDown className="h-4 w-4 mr-2" />Dépenses</TabsTrigger>
        </TabsList>

        <TabsContent value="cash" className="mt-4 space-y-4">
          {(profile?.role === 'admin' || profile?.role === 'manager') && currentSession && (
            <Button variant="destructive" onClick={() => { setPhysicalCount(expectedBalance); setManualCloseOpen(true); }}>Clôture manuelle</Button>
          )}
          {movements && movements.length > 0 && (
            <div className="rounded-md border">
              <Table>
                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead>Source</TableHead><TableHead>Description</TableHead><TableHead className="text-right">Montant</TableHead></TableRow></TableHeader>
                <TableBody>
                  {movements.map(m => (
                    <TableRow key={m.id}>
                      <TableCell>{formatDateTime(m.created_at)}</TableCell>
                      <TableCell><Badge variant={m.type === 'in' ? 'default' : 'destructive'}>{m.type === 'in' ? 'Entrée' : 'Sortie'}</Badge></TableCell>
                      <TableCell>{m.source}</TableCell>
                      <TableCell>{m.description || '-'}</TableCell>
                      <TableCell className="text-right font-semibold">{formatFCFA(m.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="expenses" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => { reset(); setExpenseDialogOpen(true); }}><Plus className="h-4 w-4 mr-2" />Nouvelle dépense</Button>
          </div>
          {expensesLoading ? <Skeleton className="h-40 w-full" /> : !expenses?.length ? (
            <EmptyState icon={Wallet} title="Aucune dépense" description="Enregistrez votre première dépense" actionLabel="Nouvelle dépense" onAction={() => setExpenseDialogOpen(true)} />
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Titre</TableHead><TableHead className="text-right">Montant</TableHead><TableHead>Mode</TableHead><TableHead>Statut</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                <TableBody>
                  {expenses.map(exp => (
                    <TableRow key={exp.id}>
                      <TableCell>{formatDate(exp.expense_date)}</TableCell>
                      <TableCell className="font-medium">{exp.title}</TableCell>
                      <TableCell className="text-right">{formatFCFA(exp.amount)}</TableCell>
                      <TableCell>{exp.payment_method}</TableCell>
                      <TableCell><StatusBadge status={exp.approval_status || 'pending_approval'} /></TableCell>
                      <TableCell className="text-right space-x-1">
                        {exp.approval_status === 'pending_approval' && (profile?.role === 'admin' || profile?.role === 'manager') && (
                          <>
                            <Button size="sm" variant="outline" onClick={() => approveExpense.mutate({ id: exp.id, status: 'approved' })}>Approuver</Button>
                            <Button size="sm" variant="destructive" onClick={() => approveExpense.mutate({ id: exp.id, status: 'rejected' })}>Rejeter</Button>
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Manual close dialog */}
      <Dialog open={manualCloseOpen} onOpenChange={setManualCloseOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Clôture manuelle de la caisse</DialogTitle><DialogDescription>Comptez le cash physique</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div><Label>Solde attendu</Label><Input value={formatFCFA(expectedBalance)} readOnly className="bg-muted" /></div>
            <div><Label>Comptage physique</Label><Input type="number" value={physicalCount} onChange={e => setPhysicalCount(Number(e.target.value))} /></div>
            <div>
              <Label>Différence</Label>
              <p className={`text-lg font-bold ${physicalCount - expectedBalance >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                {formatFCFA(physicalCount - expectedBalance)}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManualCloseOpen(false)}>Annuler</Button>
            <Button onClick={() => manualCloseMutation.mutate()} disabled={manualCloseMutation.isPending}>Clôturer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Expense dialog */}
      <Dialog open={expenseDialogOpen} onOpenChange={v => { if (!v) { setExpenseDialogOpen(false); reset(); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nouvelle dépense</DialogTitle><DialogDescription>Enregistrer une dépense</DialogDescription></DialogHeader>
          <form onSubmit={handleSubmit(d => addExpenseMutation.mutate(d))} className="space-y-4">
            <div><Label>Titre *</Label><Input {...register('title')} />{errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}</div>
            <div><Label>Montant *</Label><Input type="number" {...register('amount')} /></div>
            <div><Label>Date</Label><Input type="date" {...register('expense_date')} /></div>
            <div><Label>Mode de paiement</Label><Input {...register('payment_method')} /></div>
            <div><Label>Description</Label><Textarea {...register('description')} /></div>
            <DialogFooter><Button type="button" variant="outline" onClick={() => setExpenseDialogOpen(false)}>Annuler</Button><Button type="submit">Enregistrer</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CashExpensesPage;
