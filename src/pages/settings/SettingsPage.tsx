import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useHotel } from '@/contexts/HotelContext';
import { useRoleGuard } from '@/hooks/useRoleGuard';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Settings, Building2, Users, CreditCard, Plus, Lock } from 'lucide-react';

const SettingsPage = () => {
  useRoleGuard(['admin', 'manager']);
  const { profile } = useAuth();
  const { hotel, refreshHotel } = useHotel();
  const qc = useQueryClient();
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('receptionist');

  // Hotel form state
  const [hotelName, setHotelName] = useState(hotel?.name || '');
  const [hotelPhone, setHotelPhone] = useState(hotel?.phone || '');
  const [hotelEmail, setHotelEmail] = useState(hotel?.email || '');
  const [hotelCity, setHotelCity] = useState(hotel?.city || '');
  const [hotelAddress, setHotelAddress] = useState(hotel?.address || '');

  const { data: staff } = useQuery({
    queryKey: ['staff', hotel?.id],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('*').eq('hotel_id', hotel!.id).order('full_name');
      return data || [];
    },
    enabled: !!hotel?.id,
  });

  const updateHotelMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('hotels').update({
        name: hotelName, phone: hotelPhone, email: hotelEmail, city: hotelCity, address: hotelAddress,
      }).eq('id', hotel!.id);
      if (error) throw error;
    },
    onSuccess: () => { refreshHotel(); toast.success('Informations mises à jour'); },
    onError: (e: any) => toast.error(e.message),
  });

  const updateStaffRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const { error } = await supabase.from('profiles').update({ role }).eq('id', userId);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['staff'] }); toast.success('Rôle mis à jour'); },
    onError: (e: any) => toast.error(e.message),
  });

  const roles = ['admin', 'manager', 'receptionist', 'accountant', 'restaurant', 'kitchen', 'housekeeping'];

  return (
    <div className="page-container space-y-6">
      <PageHeader title="Paramètres" subtitle="Configuration de l'hôtel" />

      <Tabs defaultValue="hotel">
        <TabsList>
          <TabsTrigger value="hotel"><Building2 className="h-4 w-4 mr-2" />Hôtel</TabsTrigger>
          <TabsTrigger value="team"><Users className="h-4 w-4 mr-2" />Équipe</TabsTrigger>
          <TabsTrigger value="subscription"><CreditCard className="h-4 w-4 mr-2" />Abonnement</TabsTrigger>
        </TabsList>

        <TabsContent value="hotel" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Informations de l'hôtel</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Nom de l'hôtel</Label><Input value={hotelName} onChange={e => setHotelName(e.target.value)} /></div>
                <div><Label>Ville</Label><Input value={hotelCity} onChange={e => setHotelCity(e.target.value)} /></div>
                <div><Label>Adresse</Label><Input value={hotelAddress} onChange={e => setHotelAddress(e.target.value)} /></div>
                <div><Label>Téléphone</Label><Input value={hotelPhone} onChange={e => setHotelPhone(e.target.value)} /></div>
                <div><Label>Email</Label><Input value={hotelEmail} onChange={e => setHotelEmail(e.target.value)} /></div>
              </div>
              <Button onClick={() => updateHotelMutation.mutate()} disabled={updateHotelMutation.isPending}>Enregistrer</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="team" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setInviteDialogOpen(true)}><Plus className="h-4 w-4 mr-2" />Inviter un membre</Button>
          </div>
          <div className="rounded-md border">
            <Table>
              <TableHeader><TableRow><TableHead>Nom</TableHead><TableHead>Email</TableHead><TableHead>Rôle</TableHead><TableHead>Statut</TableHead></TableRow></TableHeader>
              <TableBody>
                {staff?.map(s => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.full_name || '-'}</TableCell>
                    <TableCell>{s.email}</TableCell>
                    <TableCell>
                      {s.id === profile?.id ? (
                        <div className="flex items-center gap-1"><Lock className="h-3 w-3" /><Badge>{s.role}</Badge></div>
                      ) : (
                        <Select value={s.role || 'receptionist'} onValueChange={v => updateStaffRole.mutate({ userId: s.id, role: v })}>
                          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                          <SelectContent>{roles.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                        </Select>
                      )}
                    </TableCell>
                    <TableCell><Badge variant={s.disabled ? 'destructive' : 'default'}>{s.disabled ? 'Désactivé' : 'Actif'}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="subscription" className="mt-4">
          <div className="grid grid-cols-3 gap-4">
            {[
              { plan: 'starter', name: 'Starter', price: '15 000 FCFA/mois', features: ['10 chambres max', 'Gestion basique', 'Support email'] },
              { plan: 'professional', name: 'Professional', price: '35 000 FCFA/mois', features: ['50 chambres', 'Restaurant & Stock', 'Rapports avancés', 'Support prioritaire'] },
              { plan: 'enterprise', name: 'Enterprise', price: '75 000 FCFA/mois', features: ['Illimité', 'Multi-site', 'API access', 'Support dédié'] },
            ].map(p => (
              <Card key={p.plan} className={hotel?.subscription_plan === p.plan ? 'border-primary' : ''}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    {p.name}
                    {hotel?.subscription_plan === p.plan && <Badge>Actuel</Badge>}
                  </CardTitle>
                  <p className="text-2xl font-bold">{p.price}</p>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm">
                    {p.features.map(f => <li key={f}>✓ {f}</li>)}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Inviter un membre</DialogTitle><DialogDescription>Envoyez une invitation par email</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div><Label>Email</Label><Input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} type="email" /></div>
            <div><Label>Rôle</Label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{roles.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>Annuler</Button>
            <Button onClick={() => { toast.info('Fonctionnalité d\'invitation en cours de développement'); setInviteDialogOpen(false); }}>Envoyer l'invitation</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SettingsPage;
