import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useHotel } from '@/contexts/HotelContext';
import { useRoleGuard } from '@/hooks/useRoleGuard';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { formatFCFA } from '@/utils/formatters';
import { recordCashMovement } from '@/utils/cashMovement';
import { withAudit } from '@/utils/auditLog';
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
import { Coffee, Plus, Clock, AlertTriangle, Search } from 'lucide-react';

const SiestesPage = () => {
  useRoleGuard(['admin', 'manager', 'receptionist']);
  const { profile } = useAuth();
  const { hotel } = useHotel();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [guestSearch, setGuestSearch] = useState('');
  const [selectedGuestId, setSelectedGuestId] = useState<string | null>(null);
  const [newGuest, setNewGuest] = useState({ last_name: '', first_name: '', phone: '', nationality: '', id_number: '', date_of_birth: '' });
  const [siesteForm, setSiesteForm] = useState({
    room_id: '', arrival_time: '', duration_hours: 3, amount_paid: 0, payment_method: 'cash', notes: '',
  });

  const today = new Date().toISOString().split('T')[0];

  const { data: siestes, isLoading } = useQuery({
    queryKey: ['siestes', hotel?.id, today],
    queryFn: async () => {
      const { data } = await supabase.from('siestes').select('*, rooms(room_number)').eq('hotel_id', hotel!.id).eq('arrival_date', today).order('arrival_time');
      return data || [];
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

  const { data: existingGuests } = useQuery({
    queryKey: ['guests-sieste-search', hotel?.id, guestSearch],
    queryFn: async () => {
      if (!guestSearch || guestSearch.length < 2) return [];
      const { data } = await supabase.from('guests').select('id, last_name, first_name, phone, id_number')
        .eq('hotel_id', hotel!.id)
        .or(`last_name.ilike.%${guestSearch}%,first_name.ilike.%${guestSearch}%,phone.ilike.%${guestSearch}%`)
        .limit(10);
      return data || [];
    },
    enabled: !!hotel?.id && guestSearch.length >= 2,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!hotel || !profile) throw new Error('Missing context');
      let guestId = selectedGuestId;

      // Create guest if new
      if (!guestId) {
        if (!newGuest.last_name || !newGuest.first_name) throw new Error('Nom et prénom requis');
        const { data: g, error: gErr } = await supabase.from('guests').insert({
          hotel_id: hotel.id,
          last_name: newGuest.last_name,
          first_name: newGuest.first_name,
          phone: newGuest.phone || null,
          nationality: newGuest.nationality || null,
          id_number: newGuest.id_number || null,
          date_of_birth: newGuest.date_of_birth || null,
        }).select().single();
        if (gErr) throw gErr;
        guestId = g.id;
      }

      const fullName = selectedGuestId
        ? existingGuests?.find(g => g.id === selectedGuestId)?.last_name + ' ' + existingGuests?.find(g => g.id === selectedGuestId)?.first_name
        : `${newGuest.last_name} ${newGuest.first_name}`;

      // Create sieste
      const { data: sieste, error } = await supabase.from('siestes').insert({
        hotel_id: hotel.id,
        full_name: fullName,
        guest_id: guestId,
        room_id: siesteForm.room_id || null,
        arrival_date: today,
        arrival_time: siesteForm.arrival_time || new Date().toTimeString().slice(0, 5),
        duration_hours: siesteForm.duration_hours || hotel.sieste_default_duration_hours || 3,
        amount_paid: siesteForm.amount_paid,
        payment_method: siesteForm.payment_method || null,
        notes: siesteForm.notes || null,
        recorded_by: profile.id,
        created_by: profile.id,
        created_by_name: profile.full_name,
      } as any).select().single();
      if (error) throw error;

      // Update room to occupied if assigned
      if (siesteForm.room_id) {
        await supabase.from('rooms').update({ status: 'occupied' }).eq('id', siesteForm.room_id);
      }

      // Record cash movement
      if (siesteForm.amount_paid > 0) {
        const room = rooms?.find(r => r.id === siesteForm.room_id);
        await recordCashMovement(
          hotel.id, 'in', 'sieste',
          `Sieste${room ? ' chambre ' + room.room_number : ''} — ${fullName}`,
          siesteForm.amount_paid, siesteForm.payment_method || 'cash',
          sieste.id, profile.id,
        );
      }

      await withAudit(hotel.id, profile.id, profile.full_name || '', 'create_sieste', 'siestes', sieste.id, null, { guest_id: guestId });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['siestes'] });
      qc.invalidateQueries({ queryKey: ['rooms'] });
      qc.invalidateQueries({ queryKey: ['guests'] });
      toast.success('Sieste enregistrée');
      resetDialog();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const resetDialog = () => {
    setDialogOpen(false);
    setGuestSearch('');
    setSelectedGuestId(null);
    setNewGuest({ last_name: '', first_name: '', phone: '', nationality: '', id_number: '', date_of_birth: '' });
    setSiesteForm({ room_id: '', arrival_time: new Date().toTimeString().slice(0, 5), duration_hours: hotel?.sieste_default_duration_hours || 3, amount_paid: 0, payment_method: 'cash', notes: '' });
  };

  const checkOvertime = (arrivalTime: string, durationHours: number) => {
    const [h, m] = arrivalTime.split(':').map(Number);
    const start = new Date(); start.setHours(h, m, 0);
    const end = new Date(start.getTime() + durationHours * 3600000);
    const now = new Date();
    return now > end ? Math.ceil((now.getTime() - end.getTime()) / 3600000) : 0;
  };

  const todaySiestes = siestes || [];
  const totalRevenue = todaySiestes.reduce((s, si) => s + (si.amount_paid || 0), 0);
  const inProgress = todaySiestes.filter(s => !s.departure_time);
  const withOvertime = inProgress.filter(s => checkOvertime(s.arrival_time, s.duration_hours || 3) > 0);

  return (
    <div className="page-container space-y-6">
      <PageHeader title="Siestes" subtitle={`Journée du ${new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`}>
        <Button onClick={() => { resetDialog(); setDialogOpen(true); setSiesteForm(f => ({ ...f, arrival_time: new Date().toTimeString().slice(0, 5) })); }}>
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
        <EmptyState icon={Coffee} title="Aucune sieste aujourd'hui" description="Enregistrez une nouvelle sieste" actionLabel="Nouvelle sieste" onAction={() => { resetDialog(); setDialogOpen(true); }} />
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

      {/* Sieste Dialog with Guest Search */}
      <Dialog open={dialogOpen} onOpenChange={v => { if (!v) resetDialog(); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nouvelle sieste</DialogTitle>
            <DialogDescription>Identifiez le client puis renseignez la sieste</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Guest identification */}
            <div className="border rounded-lg p-4 space-y-3">
              <h3 className="font-semibold text-sm">1. Identification du client</h3>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Rechercher un client existant..." className="pl-10"
                  value={guestSearch} onChange={e => { setGuestSearch(e.target.value); setSelectedGuestId(null); }} />
              </div>
              {existingGuests && existingGuests.length > 0 && !selectedGuestId && (
                <div className="border rounded-md max-h-32 overflow-y-auto">
                  {existingGuests.map(g => (
                    <button key={g.id} onClick={() => { setSelectedGuestId(g.id); setGuestSearch(`${g.last_name} ${g.first_name}`); }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-muted">
                      {g.last_name} {g.first_name} — {g.phone || g.id_number || ''}
                    </button>
                  ))}
                </div>
              )}
              {selectedGuestId && <Badge variant="default">Client existant sélectionné</Badge>}
              {!selectedGuestId && (
                <div className="border-t pt-3 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Ou nouveau client :</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Nom *</Label><Input value={newGuest.last_name} onChange={e => setNewGuest(p => ({ ...p, last_name: e.target.value }))} /></div>
                    <div><Label>Prénom *</Label><Input value={newGuest.first_name} onChange={e => setNewGuest(p => ({ ...p, first_name: e.target.value }))} /></div>
                    <div><Label>Téléphone</Label><Input value={newGuest.phone} onChange={e => setNewGuest(p => ({ ...p, phone: e.target.value }))} /></div>
                    <div><Label>Nationalité</Label><Input value={newGuest.nationality} onChange={e => setNewGuest(p => ({ ...p, nationality: e.target.value }))} /></div>
                    <div><Label>N° ID</Label><Input value={newGuest.id_number} onChange={e => setNewGuest(p => ({ ...p, id_number: e.target.value }))} /></div>
                    <div><Label>Date de naissance</Label><Input type="date" value={newGuest.date_of_birth} onChange={e => setNewGuest(p => ({ ...p, date_of_birth: e.target.value }))} /></div>
                  </div>
                </div>
              )}
            </div>

            {/* Sieste details */}
            <div className="border rounded-lg p-4 space-y-3">
              <h3 className="font-semibold text-sm">2. Détails de la sieste</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Chambre</Label>
                  <Select onValueChange={v => setSiesteForm(f => ({ ...f, room_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Chambre" /></SelectTrigger>
                    <SelectContent>{rooms?.map(r => <SelectItem key={r.id} value={r.id}>{r.room_number}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Heure d'arrivée</Label><Input type="time" value={siesteForm.arrival_time} onChange={e => setSiesteForm(f => ({ ...f, arrival_time: e.target.value }))} /></div>
                <div><Label>Durée (heures)</Label><Input type="number" value={siesteForm.duration_hours} onChange={e => setSiesteForm(f => ({ ...f, duration_hours: Number(e.target.value) }))} /></div>
                <div><Label>Montant (FCFA)</Label><Input type="number" value={siesteForm.amount_paid} onChange={e => setSiesteForm(f => ({ ...f, amount_paid: Number(e.target.value) }))} /></div>
                <div>
                  <Label>Mode de paiement</Label>
                  <Select value={siesteForm.payment_method} onValueChange={v => setSiesteForm(f => ({ ...f, payment_method: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="mtn_momo">MTN MoMo</SelectItem>
                      <SelectItem value="orange_money">Orange Money</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={resetDialog}>Annuler</Button>
            <Button onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || (!selectedGuestId && (!newGuest.last_name || !newGuest.first_name))}>
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SiestesPage;
