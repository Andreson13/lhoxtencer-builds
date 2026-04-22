import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useHotel } from '@/contexts/HotelContext';
import { useAuth } from '@/contexts/AuthContext';
import { useRoleGuard } from '@/hooks/useRoleGuard';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Plus, Gift, Users, Pencil, Trash2 } from 'lucide-react';
import { formatFCFA } from '@/utils/formatters';

const ForfaitsPage = () => {
  useRoleGuard(['admin', 'manager', 'receptionist']);
  const { hotel } = useHotel();
  const { profile } = useAuth();
  const qc = useQueryClient();

  const [pkgDialogOpen, setPkgDialogOpen] = useState(false);
  const [editingPkg, setEditingPkg] = useState<any>(null);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [pkgForm, setPkgForm] = useState({ name: '', description: '', price: '', validity_days: '', features: '' });
  const [assignForm, setAssignForm] = useState({ guest_id: '', package_id: '', start_date: '', end_date: '' });

  const { data: packages } = useQuery({
    queryKey: ['loyalty-packages', hotel?.id],
    queryFn: async () => {
      const { data } = await supabase.from('loyalty_packages' as any).select('*').eq('hotel_id', hotel!.id).order('price');
      return data || [];
    },
    enabled: !!hotel?.id,
  });

  const { data: guestPackages } = useQuery({
    queryKey: ['guest-packages', hotel?.id],
    queryFn: async () => {
      const { data } = await supabase.from('guest_packages' as any)
        .select('*, guest:guests(last_name, first_name, phone), package:loyalty_packages(name, price)')
        .eq('hotel_id', hotel!.id)
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!hotel?.id,
  });

  const { data: guests } = useQuery({
    queryKey: ['guests-list-forfaits', hotel?.id],
    queryFn: async () => {
      const { data } = await supabase.from('guests').select('id, last_name, first_name, phone').eq('hotel_id', hotel!.id).order('last_name').limit(200);
      return data || [];
    },
    enabled: !!hotel?.id,
  });

  const savePkgMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        hotel_id: hotel!.id,
        name: pkgForm.name,
        description: pkgForm.description || null,
        price: Number(pkgForm.price),
        validity_days: pkgForm.validity_days ? Number(pkgForm.validity_days) : null,
        features: pkgForm.features ? pkgForm.features.split('\n').filter(Boolean) : [],
      };
      if (editingPkg) {
        const { error } = await supabase.from('loyalty_packages' as any).update(payload).eq('id', editingPkg.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('loyalty_packages' as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['loyalty-packages'] });
      setPkgDialogOpen(false);
      toast.success(editingPkg ? 'Forfait mis à jour' : 'Forfait créé');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deletePkgMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('loyalty_packages' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['loyalty-packages'] }); toast.success('Forfait supprimé'); },
    onError: (e: any) => toast.error(e.message),
  });

  const assignMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('guest_packages' as any).insert({
        hotel_id: hotel!.id,
        guest_id: assignForm.guest_id,
        package_id: assignForm.package_id,
        start_date: assignForm.start_date || new Date().toISOString().slice(0, 10),
        end_date: assignForm.end_date || null,
        status: 'active',
        assigned_by: profile?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['guest-packages'] });
      setAssignDialogOpen(false);
      toast.success('Forfait assigné au client');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openAddPkg = () => {
    setEditingPkg(null);
    setPkgForm({ name: '', description: '', price: '', validity_days: '', features: '' });
    setPkgDialogOpen(true);
  };

  const openEditPkg = (pkg: any) => {
    setEditingPkg(pkg);
    setPkgForm({
      name: pkg.name || '',
      description: pkg.description || '',
      price: String(pkg.price || ''),
      validity_days: String(pkg.validity_days || ''),
      features: (pkg.features || []).join('\n'),
    });
    setPkgDialogOpen(true);
  };

  return (
    <div className="page-container space-y-6">
      <PageHeader title="Forfaits & Abonnements" subtitle="Gérez les forfaits de fidélité et les abonnements clients">
        <Button onClick={() => setAssignDialogOpen(true)} variant="outline">
          <Users className="h-4 w-4 mr-2" />Assigner un forfait
        </Button>
        <Button onClick={openAddPkg}>
          <Plus className="h-4 w-4 mr-2" />Nouveau forfait
        </Button>
      </PageHeader>

      <Tabs defaultValue="packages">
        <TabsList>
          <TabsTrigger value="packages"><Gift className="h-4 w-4 mr-2" />Forfaits disponibles</TabsTrigger>
          <TabsTrigger value="subscriptions"><Users className="h-4 w-4 mr-2" />Abonnements clients</TabsTrigger>
        </TabsList>

        <TabsContent value="packages" className="mt-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {(packages || []).map((pkg: any) => (
              <Card key={pkg.id} className="border-border/60 shadow-sm">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{pkg.name}</CardTitle>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => openEditPkg(pkg)}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => deletePkgMutation.mutate(pkg.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-primary">{formatFCFA(pkg.price)}</p>
                  {pkg.validity_days && <p className="text-xs text-muted-foreground">{pkg.validity_days} jours</p>}
                </CardHeader>
                <CardContent>
                  {pkg.description && <p className="text-sm text-muted-foreground mb-2">{pkg.description}</p>}
                  {(pkg.features || []).length > 0 && (
                    <ul className="space-y-1">
                      {(pkg.features as string[]).map((b, i) => (
                        <li key={i} className="text-sm flex items-center gap-1">
                          <span className="text-green-500">✓</span> {b}
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            ))}
            {(packages || []).length === 0 && (
              <div className="col-span-3 text-center py-12 text-muted-foreground">
                Aucun forfait créé. Cliquez sur "Nouveau forfait" pour commencer.
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="subscriptions" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead>Forfait</TableHead>
                    <TableHead>Date début</TableHead>
                    <TableHead>Date fin</TableHead>
                    <TableHead>Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(guestPackages || []).map((gp: any) => (
                    <TableRow key={gp.id}>
                      <TableCell className="font-medium">{gp.guest?.last_name} {gp.guest?.first_name}</TableCell>
                      <TableCell>{gp.package?.name}</TableCell>
                      <TableCell>{gp.start_date}</TableCell>
                      <TableCell>{gp.end_date || '—'}</TableCell>
                      <TableCell>
                        <Badge variant={gp.status === 'active' ? 'default' : 'secondary'}>{gp.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(guestPackages || []).length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Aucun abonnement actif</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Package dialog */}
      <Dialog open={pkgDialogOpen} onOpenChange={setPkgDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingPkg ? 'Modifier le forfait' : 'Nouveau forfait'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nom *</Label><Input value={pkgForm.name} onChange={e => setPkgForm(p => ({ ...p, name: e.target.value }))} /></div>
            <div><Label>Description</Label><Input value={pkgForm.description} onChange={e => setPkgForm(p => ({ ...p, description: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Prix (FCFA) *</Label><Input type="number" value={pkgForm.price} onChange={e => setPkgForm(p => ({ ...p, price: e.target.value }))} /></div>
              <div><Label>Validité (jours)</Label><Input type="number" value={pkgForm.validity_days} onChange={e => setPkgForm(p => ({ ...p, validity_days: e.target.value }))} /></div>
            </div>
            <div><Label>Avantages (un par ligne)</Label>
              <textarea className="w-full border rounded-md p-2 text-sm min-h-[80px]" value={pkgForm.features}
                onChange={e => setPkgForm(p => ({ ...p, features: e.target.value }))}
                placeholder="Petit-déjeuner inclus&#10;Transfert aéroport&#10;Wi-Fi gratuit" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPkgDialogOpen(false)}>Annuler</Button>
            <Button onClick={() => savePkgMutation.mutate()} disabled={!pkgForm.name || !pkgForm.price || savePkgMutation.isPending}>
              {editingPkg ? 'Enregistrer' : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Assigner un forfait à un client</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Client</Label>
              <Select value={assignForm.guest_id} onValueChange={v => setAssignForm(p => ({ ...p, guest_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Sélectionner un client" /></SelectTrigger>
                <SelectContent>
                  {(guests || []).map((g: any) => (
                    <SelectItem key={g.id} value={g.id}>{g.last_name} {g.first_name} {g.phone ? `— ${g.phone}` : ''}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Forfait</Label>
              <Select value={assignForm.package_id} onValueChange={v => setAssignForm(p => ({ ...p, package_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Sélectionner un forfait" /></SelectTrigger>
                <SelectContent>
                  {(packages || []).map((pkg: any) => (
                    <SelectItem key={pkg.id} value={pkg.id}>{pkg.name} — {formatFCFA(pkg.price)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Date début</Label><Input type="date" value={assignForm.start_date} onChange={e => setAssignForm(p => ({ ...p, start_date: e.target.value }))} /></div>
              <div><Label>Date fin (optionnel)</Label><Input type="date" value={assignForm.end_date} onChange={e => setAssignForm(p => ({ ...p, end_date: e.target.value }))} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>Annuler</Button>
            <Button onClick={() => assignMutation.mutate()} disabled={!assignForm.guest_id || !assignForm.package_id || assignMutation.isPending}>
              Assigner
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ForfaitsPage;
