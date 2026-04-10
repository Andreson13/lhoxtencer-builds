import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useHotel } from '@/contexts/HotelContext';
import { useRoleGuard } from '@/hooks/useRoleGuard';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { formatFCFA } from '@/utils/formatters';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Coffee, Plus, Clock, AlertTriangle } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

const schema = z.object({
  full_name: z.string().min(1, 'Nom requis'),
  phone: z.string().optional(),
  room_id: z.string().optional(),
  arrival_time: z.string().min(1, 'Heure requise'),
  duration_hours: z.coerce.number().min(1).default(3),
  amount_paid: z.coerce.number().min(0).default(0),
  payment_method: z.string().optional(),
  nationality: z.string().optional(),
  id_number: z.string().optional(),
  notes: z.string().optional(),
});

const SiestesPage = () => {
  useRoleGuard(['admin', 'manager', 'receptionist']);
  const { profile } = useAuth();
  const { hotel } = useHotel();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { duration_hours: hotel?.sieste_default_duration_hours || 3, amount_paid: 0, arrival_time: new Date().toTimeString().slice(0, 5) },
  });

  const today = new Date().toISOString().split('T')[0];

  const { data: siestes, isLoading } = useQuery({
    queryKey: ['siestes', hotel?.id, today],
    queryFn: async () => {
      const { data, error } = await supabase.from('siestes').select('*, rooms(room_number)').eq('hotel_id', hotel!.id).eq('arrival_date', today).order('arrival_time');
      if (error) throw error;
      return data;
    },
    enabled: !!hotel?.id,
  });

  const { data: rooms } = useQuery({
    queryKey: ['rooms-available', hotel?.id],
    queryFn: async () => {
      const { data } = await supabase.from('rooms').select('id, room_number').eq('hotel_id', hotel!.id).eq('status', 'available');
      return data || [];
    },
    enabled: !!hotel?.id,
  });

  const saveMutation = useMutation({
    mutationFn: async (values: any) => {
      const { error } = await supabase.from('siestes').insert({
        ...values,
        hotel_id: hotel!.id,
        arrival_date: today,
        recorded_by: profile?.id,
        room_id: values.room_id || null,
        phone: values.phone || null,
        notes: values.notes || null,
        nationality: values.nationality || null,
        id_number: values.id_number || null,
        payment_method: values.payment_method || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['siestes'] }); toast.success('Sieste enregistrée'); setDialogOpen(false); reset(); },
    onError: (e: any) => toast.error(e.message),
  });

  const checkOvertime = (arrivalTime: string, durationHours: number) => {
    const [h, m] = arrivalTime.split(':').map(Number);
    const start = new Date(); start.setHours(h, m, 0);
    const end = new Date(start.getTime() + durationHours * 3600000);
    const now = new Date();
    if (now > end) {
      const overtimeMs = now.getTime() - end.getTime();
      return Math.ceil(overtimeMs / 3600000);
    }
    return 0;
  };

  const todaySiestes = siestes || [];
  const totalRevenue = todaySiestes.reduce((s, si) => s + (si.amount_paid || 0), 0);
  const inProgress = todaySiestes.filter(s => !s.departure_time);
  const withOvertime = inProgress.filter(s => checkOvertime(s.arrival_time, s.duration_hours || 3) > 0);

  return (
    <div className="page-container space-y-6">
      <PageHeader title="Siestes" subtitle={`Journée du ${new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`}>
        <Button onClick={() => { reset({ duration_hours: hotel?.sieste_default_duration_hours || 3, amount_paid: 0, arrival_time: new Date().toTimeString().slice(0, 5) }); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />Nouvelle sieste
        </Button>
      </PageHeader>

      <div className="grid grid-cols-3 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Siestes aujourd'hui</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{todaySiestes.length}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Revenus du jour</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{formatFCFA(totalRevenue)}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground flex items-center gap-1">{withOvertime.length > 0 && <AlertTriangle className="h-4 w-4 text-destructive" />}En cours</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{inProgress.length}</p>{withOvertime.length > 0 && <p className="text-sm text-destructive">{withOvertime.length} en dépassement</p>}</CardContent></Card>
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : todaySiestes.length === 0 ? (
        <EmptyState icon={Coffee} title="Aucune sieste aujourd'hui" description="Enregistrez une nouvelle sieste" actionLabel="Nouvelle sieste" onAction={() => setDialogOpen(true)} />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>N°</TableHead>
                <TableHead>Nom</TableHead>
                <TableHead>Chambre</TableHead>
                <TableHead>Arrivée</TableHead>
                <TableHead>Durée</TableHead>
                <TableHead>Temps restant</TableHead>
                <TableHead className="text-right">Montant</TableHead>
                <TableHead>Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {todaySiestes.map((s, i) => {
                const overtime = checkOvertime(s.arrival_time, s.duration_hours || 3);
                return (
                  <TableRow key={s.id}>
                    <TableCell>{i + 1}</TableCell>
                    <TableCell className="font-medium">{s.full_name}</TableCell>
                    <TableCell>{(s as any).rooms?.room_number || '-'}</TableCell>
                    <TableCell>{s.arrival_time}</TableCell>
                    <TableCell>{s.duration_hours || 3}h</TableCell>
                    <TableCell>
                      {s.departure_time ? (
                        <Badge variant="secondary">Terminé</Badge>
                      ) : overtime > 0 ? (
                        <Badge variant="destructive" className="flex items-center gap-1"><Clock className="h-3 w-3" />+{overtime}h dépassement</Badge>
                      ) : (
                        <Badge variant="outline" className="flex items-center gap-1"><Clock className="h-3 w-3" />En cours</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">{formatFCFA(s.amount_paid)}</TableCell>
                    <TableCell>{s.departure_time ? <Badge variant="secondary">Parti</Badge> : <Badge>En cours</Badge>}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouvelle sieste</DialogTitle>
            <DialogDescription>Enregistrer une sieste</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(d => saveMutation.mutate(d))} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Nom complet *</Label><Input {...register('full_name')} />{errors.full_name && <p className="text-sm text-destructive">{errors.full_name.message}</p>}</div>
              <div><Label>Téléphone</Label><Input {...register('phone')} /></div>
              <div><Label>Chambre</Label>
                <Select onValueChange={v => setValue('room_id', v)}>
                  <SelectTrigger><SelectValue placeholder="Chambre" /></SelectTrigger>
                  <SelectContent>{rooms?.map(r => <SelectItem key={r.id} value={r.id}>{r.room_number}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Heure d'arrivée *</Label><Input type="time" {...register('arrival_time')} /></div>
              <div><Label>Durée (heures)</Label><Input type="number" {...register('duration_hours')} /></div>
              <div><Label>Montant payé</Label><Input type="number" {...register('amount_paid')} /></div>
              <div><Label>Mode de paiement</Label>
                <Select onValueChange={v => setValue('payment_method', v)}>
                  <SelectTrigger><SelectValue placeholder="Mode" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="mtn_momo">MTN MoMo</SelectItem>
                    <SelectItem value="orange_money">Orange Money</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>N° ID</Label><Input {...register('id_number')} /></div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
              <Button type="submit" disabled={saveMutation.isPending}>Enregistrer</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SiestesPage;
