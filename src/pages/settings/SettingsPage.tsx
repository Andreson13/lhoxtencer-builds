import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useHotel } from '@/contexts/HotelContext';
import { useRoleGuard } from '@/hooks/useRoleGuard';
import { useI18n } from '@/contexts/I18nContext';
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
import { Building2, Users, CreditCard, Plus, Lock, Sparkles, MapPin, Phone, Mail, Pencil } from 'lucide-react';

const SettingsPage = () => {
  useRoleGuard(['admin', 'manager']);
  const { t } = useI18n();
  const { profile } = useAuth();
  const { hotel, refreshHotel } = useHotel();
  const qc = useQueryClient();
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [hotelDialogOpen, setHotelDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('receptionist');

  // Hotel form state
  const [hotelName, setHotelName] = useState(hotel?.name || '');
  const [hotelPhone, setHotelPhone] = useState(hotel?.phone || '');
  const [hotelEmail, setHotelEmail] = useState(hotel?.email || '');
  const [hotelCity, setHotelCity] = useState(hotel?.city || '');
  const [hotelAddress, setHotelAddress] = useState(hotel?.address || '');

  const slugifyHotelName = (value: string) =>
    value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48);

  useEffect(() => {
    setHotelName(hotel?.name || '');
    setHotelPhone(hotel?.phone || '');
    setHotelEmail(hotel?.email || '');
    setHotelCity(hotel?.city || '');
    setHotelAddress(hotel?.address || '');
  }, [hotel]);

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
      const generatedSlugBase = slugifyHotelName(hotelName || hotel?.name || 'hotel');
      const generatedSlug = `${generatedSlugBase || 'hotel'}-${(hotel?.id || '').slice(0, 6)}`;
      const { error } = await supabase.from('hotels').update({
        name: hotelName,
        slug: generatedSlug,
        phone: hotelPhone,
        email: hotelEmail,
        city: hotelCity,
        address: hotelAddress,
      }).eq('id', hotel!.id);
      if (error) throw error;
    },
    onSuccess: () => { refreshHotel(); setHotelDialogOpen(false); toast.success(t('settings.hotel.updated')); },
    onError: (e: any) => toast.error(e.message),
  });

  const updateStaffRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const { error } = await supabase.from('profiles').update({ role }).eq('id', userId);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['staff'] }); toast.success(t('settings.team.roleUpdated')); },
    onError: (e: any) => toast.error(e.message),
  });

  const roles = ['admin', 'manager', 'receptionist', 'accountant', 'restaurant', 'kitchen', 'housekeeping'];
  const hotelMetrics = useMemo(() => ([
    { label: t('settings.subscription.rooms'), value: String((hotel as any)?.number_of_rooms || 0), icon: Building2 },
    { label: t('settings.subscription.staff'), value: String(staff?.length || 0), icon: Users },
    { label: t('settings.subscription.plan'), value: hotel?.subscription_plan || 'starter', icon: Sparkles },
  ]), [hotel, staff?.length, t]);

  return (
    <div className="page-container space-y-6">
      <PageHeader title={t('settings.title')} subtitle={t('settings.subtitle')}>
        <Button onClick={() => setHotelDialogOpen(true)}><Pencil className="h-4 w-4 mr-2" />{t('common.editInfo')}</Button>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-3">
        {hotelMetrics.map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.label} className="border-border/60 shadow-sm">
              <CardContent className="pt-6 flex items-center gap-4">
                <div className="h-11 w-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{item.label}</p>
                  <p className="text-2xl font-semibold capitalize">{item.value}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Tabs defaultValue="hotel">
        <TabsList className="grid w-full grid-cols-3 rounded-2xl bg-muted/70 p-1 h-auto">
          <TabsTrigger value="hotel" className="rounded-xl"><Building2 className="h-4 w-4 mr-2" />{t('settings.tabs.hotel')}</TabsTrigger>
          <TabsTrigger value="team" className="rounded-xl"><Users className="h-4 w-4 mr-2" />{t('settings.tabs.team')}</TabsTrigger>
          <TabsTrigger value="subscription" className="rounded-xl"><CreditCard className="h-4 w-4 mr-2" />{t('settings.tabs.subscription')}</TabsTrigger>
        </TabsList>

        <TabsContent value="hotel" className="mt-4">
          <Card className="border-border/60 shadow-sm">
            <CardHeader>
              <CardTitle>{t('settings.hotel.cardTitle')}</CardTitle>
              <p className="text-sm text-muted-foreground">{t('settings.hotel.cardDescription')}</p>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border bg-muted/30 p-4 space-y-2">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('settings.hotel.name')}</p>
                <p className="text-xl font-semibold">{hotel?.name || '-'}</p>
              </div>
              <div className="rounded-2xl border bg-muted/30 p-4 space-y-2">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('settings.hotel.city')}</p>
                <p className="text-xl font-semibold">{hotel?.city || '-'}</p>
              </div>
              <div className="rounded-2xl border bg-background p-4 flex items-start gap-3">
                <MapPin className="h-4 w-4 mt-1 text-primary" />
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('settings.hotel.address')}</p>
                  <p className="font-medium">{hotel?.address || '-'}</p>
                </div>
              </div>
              <div className="space-y-3">
                <div className="rounded-2xl border bg-background p-4 flex items-start gap-3">
                  <Phone className="h-4 w-4 mt-1 text-primary" />
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('settings.hotel.phone')}</p>
                    <p className="font-medium">{hotel?.phone || '-'}</p>
                  </div>
                </div>
                <div className="rounded-2xl border bg-background p-4 flex items-start gap-3">
                  <Mail className="h-4 w-4 mt-1 text-primary" />
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('settings.hotel.email')}</p>
                    <p className="font-medium">{hotel?.email || '-'}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="team" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setInviteDialogOpen(true)}><Plus className="h-4 w-4 mr-2" />{t('settings.team.invite')}</Button>
          </div>
          <Card className="border-border/60 shadow-sm">
            <CardHeader>
              <CardTitle>{t('settings.team.title')}</CardTitle>
              <p className="text-sm text-muted-foreground">{t('settings.team.description')}</p>
            </CardHeader>
            <CardContent className="p-0">
          <div className="rounded-md border-x-0 border-b-0">
            <Table>
              <TableHeader><TableRow><TableHead>{t('settings.team.name')}</TableHead><TableHead>{t('settings.team.email')}</TableHead><TableHead>{t('settings.team.role')}</TableHead><TableHead>{t('settings.team.status')}</TableHead></TableRow></TableHeader>
              <TableBody>
                {staff?.map(s => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.full_name || '-'}</TableCell>
                    <TableCell>{s.email}</TableCell>
                    <TableCell>
                      {s.id === profile?.id ? (
                        <div className="flex items-center gap-1"><Lock className="h-3 w-3" /><Badge>{t('settings.team.locked')}</Badge></div>
                      ) : (
                        <Select value={s.role || 'receptionist'} onValueChange={v => updateStaffRole.mutate({ userId: s.id, role: v })}>
                          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                          <SelectContent>{roles.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                        </Select>
                      )}
                    </TableCell>
                    <TableCell><Badge variant={s.disabled ? 'destructive' : 'default'}>{s.disabled ? t('common.disabled') : t('common.active')}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
            </CardContent>
          </Card>
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
                    {hotel?.subscription_plan === p.plan && <Badge>{t('settings.subscription.current')}</Badge>}
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

      <Dialog open={hotelDialogOpen} onOpenChange={setHotelDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('settings.hotel.editTitle')}</DialogTitle>
            <DialogDescription>{t('settings.hotel.editDescription')}</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><Label>{t('settings.hotel.name')}</Label><Input value={hotelName} onChange={e => setHotelName(e.target.value)} /></div>
            <div><Label>{t('settings.hotel.city')}</Label><Input value={hotelCity} onChange={e => setHotelCity(e.target.value)} /></div>
            <div className="md:col-span-2"><Label>{t('settings.hotel.address')}</Label><Input value={hotelAddress} onChange={e => setHotelAddress(e.target.value)} /></div>
            <div><Label>{t('settings.hotel.phone')}</Label><Input value={hotelPhone} onChange={e => setHotelPhone(e.target.value)} /></div>
            <div><Label>{t('settings.hotel.email')}</Label><Input value={hotelEmail} onChange={e => setHotelEmail(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setHotelDialogOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={() => updateHotelMutation.mutate()} disabled={updateHotelMutation.isPending}>{t('common.save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('settings.invite.title')}</DialogTitle><DialogDescription>{t('settings.invite.description')}</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div><Label>{t('auth.email')}</Label><Input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} type="email" /></div>
            <div><Label>{t('settings.team.role')}</Label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{roles.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={() => { toast.info(t('settings.invite.pending')); setInviteDialogOpen(false); }}>{t('settings.invite.send')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SettingsPage;
