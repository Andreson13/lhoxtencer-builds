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
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Building2, Users, CreditCard, Plus, Lock, Sparkles, MapPin, Phone, Mail, Pencil, Receipt, Award, ShieldCheck, Trash2 } from 'lucide-react';
import { getHotelSetting, setHotelSetting, FixedCharge, DEFAULT_FIXED_CHARGES } from '@/services/taxService';
import { DEFAULT_TIER_THRESHOLDS, TierThresholds } from '@/services/tierService';
import { PERMISSIONS, PERMISSION_CATEGORIES } from '@/hooks/usePermission';
import { TierBadge } from '@/components/shared/TierBadge';

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

  // Permissions state
  const [permDialogOpen, setPermDialogOpen] = useState(false);
  const [permTargetStaff, setPermTargetStaff] = useState<any>(null);
  const [staffPermissions, setStaffPermissions] = useState<Record<string, boolean>>({});

  // Delete staff state
  const [deleteConfirmDialogOpen, setDeleteConfirmDialogOpen] = useState(false);
  const [staffToDelete, setStaffToDelete] = useState<any>(null);

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

  const { data: pendingInvitations } = useQuery({
    queryKey: ['invitations', hotel?.id],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('invitations')
        .select('*')
        .eq('hotel_id', hotel!.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!hotel?.id,
  });

  useEffect(() => {
    if (!permDialogOpen || !hotel?.id || !permTargetStaff?.id) return;
    (async () => {
      const { data, error } = await supabase
        .from('user_permissions' as any)
        .select('permission, granted')
        .eq('hotel_id', hotel.id)
        .eq('user_id', permTargetStaff.id);
      if (error) {
        toast.error(error.message);
        return;
      }
      const mapped = (data || []).reduce((acc: Record<string, boolean>, row: any) => {
        acc[row.permission] = !!row.granted;
        return acc;
      }, {});
      setStaffPermissions(mapped);
    })();
  }, [permDialogOpen, permTargetStaff?.id, hotel?.id]);

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

  const deleteStaffMember = useMutation({
    mutationFn: async (userId: string) => {
      const { error: memberError } = await (supabase as any)
        .from('hotel_memberships')
        .delete()
        .eq('hotel_id', hotel!.id)
        .eq('user_id', userId);
      if (memberError) throw memberError;

      const { error: profileError } = await supabase
        .from('profiles')
        .update({ hotel_id: null, disabled: true })
        .eq('id', userId);
      if (profileError) throw profileError;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['staff'] });
      toast.success('Membre supprimé avec succès');
    },
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
        <TabsList className="grid w-full grid-cols-6 rounded-2xl bg-muted/70 p-1 h-auto">
          <TabsTrigger value="hotel" className="rounded-xl"><Building2 className="h-4 w-4 mr-2" />{t('settings.tabs.hotel')}</TabsTrigger>
          <TabsTrigger value="team" className="rounded-xl"><Users className="h-4 w-4 mr-2" />{t('settings.tabs.team')}</TabsTrigger>
          <TabsTrigger value="permissions" className="rounded-xl"><ShieldCheck className="h-4 w-4 mr-2" />Permissions</TabsTrigger>
          <TabsTrigger value="taxes" className="rounded-xl"><Receipt className="h-4 w-4 mr-2" />Taxes & Frais</TabsTrigger>
          <TabsTrigger value="fidelite" className="rounded-xl"><Award className="h-4 w-4 mr-2" />Fidélité</TabsTrigger>
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
                    <TableCell>
                      {s.id !== profile?.id && (
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => {
                            setPermTargetStaff(s);
                            setStaffPermissions({});
                            setPermDialogOpen(true);
                          }}>
                            <ShieldCheck className="h-4 w-4 mr-1" />Permissions
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive hover:text-destructive"
                            onClick={() => {
                              setStaffToDelete(s);
                              setDeleteConfirmDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
            </CardContent>
          </Card>

          {pendingInvitations && pendingInvitations.length > 0 && (
            <Card className="border-border/60 shadow-sm border-l-4 border-l-blue-500">
              <CardHeader>
                <CardTitle className="text-lg">Invitations en attente</CardTitle>
                <p className="text-sm text-muted-foreground">Les utilisateurs suivants ont ete invites et attendent votre confirmation</p>
              </CardHeader>
              <CardContent className="p-0">
                <div className="rounded-md border-x-0 border-b-0">
                  <Table>
                    <TableHeader><TableRow><TableHead>Email</TableHead><TableHead>Role</TableHead><TableHead>Date d'invitation</TableHead><TableHead>Statut</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {pendingInvitations.map((inv: any) => (
                        <TableRow key={inv.id}>
                          <TableCell className="font-medium">{inv.email}</TableCell>
                          <TableCell><Badge>{inv.role}</Badge></TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(inv.created_at).toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' })}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="bg-blue-100 text-blue-800">En attente</Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={async () => {
                                try {
                                  await (supabase as any)
                                    .from('invitations')
                                    .delete()
                                    .eq('id', inv.id);
                                  qc.invalidateQueries({ queryKey: ['invitations'] });
                                  toast.success('Invitation annulee');
                                } catch (e: any) {
                                  toast.error('Erreur lors de l\'annulation');
                                }
                              }}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="permissions" className="mt-4 space-y-4">
          <PermissionsTab hotelId={hotel?.id || ''} />
        </TabsContent>

        <TabsContent value="taxes" className="mt-4 space-y-4">
          <TaxesTab hotelId={hotel?.id || ''} />
        </TabsContent>

        <TabsContent value="fidelite" className="mt-4 space-y-4">
          <FideliteTab hotelId={hotel?.id || ''} />
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
            <Button onClick={async () => {
              if (!hotel?.id || !profile?.id) return;
              const email = inviteEmail.trim().toLowerCase();
              if (!email) {
                toast.error('Email requis');
                return;
              }
              try {
                const { data: existingProfile } = await supabase
                  .from('profiles')
                  .select('id, email, full_name')
                  .eq('email', email)
                  .maybeSingle();

                if (existingProfile?.id) {
                  await supabase
                    .from('profiles')
                    .update({
                      hotel_id: hotel.id,
                      role: inviteRole,
                      disabled: false,
                    } as any)
                    .eq('id', existingProfile.id);

                  await (supabase as any)
                    .from('hotel_memberships')
                    .upsert({
                      hotel_id: hotel.id,
                      user_id: existingProfile.id,
                      role: inviteRole,
                      is_hotel_owner: false,
                    }, { onConflict: 'hotel_id,user_id' });

                  toast.success(`Membre ajoute: ${existingProfile.full_name || email}`);
                  qc.invalidateQueries({ queryKey: ['staff', 'invitations'] });
                  setInviteDialogOpen(false);
                  setInviteEmail('');
                  setInviteRole('receptionist');
                  return;
                }

                const { error: inviteError } = await (supabase as any)
                  .from('invitations')
                  .upsert({
                    hotel_id: hotel.id,
                    email: email,
                    role: inviteRole,
                    is_hotel_owner: false,
                    invited_by: profile.id,
                    status: 'pending',
                  }, { onConflict: 'hotel_id,email,status' });

                if (inviteError) throw inviteError;

                toast.success(`Invitation envoyee a ${email}. Ils pourront accepter apres connexion.`);
                qc.invalidateQueries({ queryKey: ['invitations'] });
                setInviteDialogOpen(false);
                setInviteEmail('');
                setInviteRole('receptionist');
              } catch (e: any) {
                toast.error(e.message || 'Impossible d\'envoyer l\'invitation');
              }
            }}>{t('settings.invite.send')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Permissions Dialog */}
      <Dialog open={permDialogOpen} onOpenChange={setPermDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Permissions — {permTargetStaff?.full_name}</DialogTitle>
            <DialogDescription>Cochez les permissions spécifiques à ce membre. Les valeurs non renseignées héritent des permissions du rôle.</DialogDescription>
          </DialogHeader>
          {Object.entries(PERMISSION_CATEGORIES).map(([cat, perms]) => (
            <div key={cat} className="space-y-2 mb-4">
              <h4 className="font-semibold capitalize text-sm text-muted-foreground border-b pb-1">{cat}</h4>
              <div className="grid grid-cols-2 gap-2">
                {perms.map(perm => (
                  <div key={perm} className="flex items-center gap-2">
                    <input type="checkbox" id={perm} checked={!!staffPermissions[perm]}
                      onChange={e => setStaffPermissions(prev => ({ ...prev, [perm]: e.target.checked }))}
                      className="rounded" />
                    <label htmlFor={perm} className="text-sm">{PERMISSIONS[perm as keyof typeof PERMISSIONS] || perm}</label>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPermDialogOpen(false)}>Annuler</Button>
            <Button onClick={async () => {
              if (!hotel?.id || !permTargetStaff?.id) return;
              try {
                for (const [perm, granted] of Object.entries(staffPermissions)) {
                  await supabase.from('user_permissions' as any).upsert({
                    hotel_id: hotel.id,
                    user_id: permTargetStaff.id,
                    permission: perm,
                    granted,
                    created_by: profile?.id,
                  }, { onConflict: 'hotel_id,user_id,permission' });
                }
                toast.success('Permissions sauvegardées');
                setPermDialogOpen(false);
              } catch (e: any) { toast.error(e.message); }
            }}>Sauvegarder</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Staff Confirmation Dialog */}
      <Dialog open={deleteConfirmDialogOpen} onOpenChange={setDeleteConfirmDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer le membre</DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir supprimer {staffToDelete?.full_name || staffToDelete?.email} de votre équipe ?
              Cette action ne peut pas être annulée.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-sm text-destructive">
            ⚠️ Le membre sera supprimé de votre hôtel et ne pourra plus accéder à l'application.
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmDialogOpen(false)}
              disabled={deleteStaffMember.isPending}
            >
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (staffToDelete?.id) {
                  deleteStaffMember.mutate(staffToDelete.id, {
                    onSuccess: () => setDeleteConfirmDialogOpen(false),
                  });
                }
              }}
              disabled={deleteStaffMember.isPending}
            >
              {deleteStaffMember.isPending ? 'Suppression...' : 'Supprimer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Role-Level Permissions Tab Component
function PermissionsTab({ hotelId }: { hotelId: string }) {
  const ROLES = ['receptionist', 'accountant', 'restaurant', 'kitchen', 'housekeeping'];
  const PERMISSIONS = [
    { id: 'view_dashboard', name: 'Accès au tableau de bord' },
    { id: 'manage_rooms', name: 'Gérer les chambres' },
    { id: 'manage_guests', name: 'Gérer les clients' },
    { id: 'manage_reservations', name: 'Gérer les réservations' },
    { id: 'manage_billing', name: 'Gérer la facturation' },
    { id: 'view_reports', name: 'Consulter les rapports' },
    { id: 'manage_staff', name: 'Gérer le personnel' },
    { id: 'manage_settings', name: 'Gérer les paramètres' },
  ];

  const [rolePermissions, setRolePermissions] = useState<Record<string, boolean[]>>({
    receptionist: [true, true, true, true, false, true, false, false],
    accountant: [true, false, false, false, true, true, false, false],
    restaurant: [true, false, false, false, false, false, false, false],
    kitchen: [true, false, false, false, false, false, false, false],
    housekeeping: [true, true, false, false, false, false, false, false],
  });
  const [isSaving, setIsSaving] = useState(false);

  const togglePermission = (role: string, permIndex: number) => {
    setRolePermissions(prev => ({
      ...prev,
      [role]: prev[role].map((val, i) => i === permIndex ? !val : val)
    }));
  };

  const savePermissions = async () => {
    setIsSaving(true);
    try {
      for (const role of ROLES) {
        await setHotelSetting(hotelId, `role_permissions_${role}`, JSON.stringify(rolePermissions[role]));
      }
      toast.success('Permissions des rôles sauvegardées');
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la sauvegarde');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" />Permissions par rôle</CardTitle>
          <p className="text-sm text-muted-foreground">Définissez quelles actions chaque rôle peut effectuer</p>
        </CardHeader>
        <CardContent className="space-y-6">
          {ROLES.map(role => (
            <div key={role} className="border rounded-lg p-4 space-y-3">
              <h3 className="font-semibold capitalize">{role === 'receptionist' ? 'Réceptionniste' : role === 'accountant' ? 'Comptable' : role === 'restaurant' ? 'Restaurant' : role === 'kitchen' ? 'Cuisine' : 'Ménage'}</h3>
              <div className="grid grid-cols-2 gap-3">
                {PERMISSIONS.map((perm, i) => (
                  <div key={perm.id} className="flex items-center gap-2">
                    <input 
                      type="checkbox" 
                      id={`${role}_${perm.id}`}
                      checked={rolePermissions[role]?.[i] || false}
                      onChange={() => togglePermission(role, i)}
                      className="w-4 h-4 rounded"
                    />
                    <label htmlFor={`${role}_${perm.id}`} className="text-sm cursor-pointer">{perm.name}</label>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <Button onClick={savePermissions} disabled={isSaving} className="w-full">
            {isSaving ? 'Sauvegarde...' : 'Sauvegarder les permissions'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// Taxes & Fixed Charges Tab Component
function TaxesTab({ hotelId }: { hotelId: string }) {
  const qc = useQueryClient();
  const [govTaxEnabled, setGovTaxEnabled] = useState(false);
  const [govTaxAmount, setGovTaxAmount] = useState('2000');
  const [govTaxLabel, setGovTaxLabel] = useState('Taxe gouvernementale');
  const [fixedCharges, setFixedCharges] = useState<FixedCharge[]>(DEFAULT_FIXED_CHARGES);
  const [loaded, setLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!hotelId || loaded) return;
    (async () => {
      const [enabled, amount, label, charges] = await Promise.all([
        getHotelSetting(hotelId, 'government_tax_enabled'),
        getHotelSetting(hotelId, 'government_tax_per_room_per_night'),
        getHotelSetting(hotelId, 'government_tax_label'),
        getHotelSetting(hotelId, 'fixed_charges'),
      ]);
      if (enabled !== null) setGovTaxEnabled(enabled === 'true');
      if (amount) setGovTaxAmount(amount);
      if (label) setGovTaxLabel(label);
      if (charges) { try { setFixedCharges(JSON.parse(charges)); } catch {} }
      setLoaded(true);
    })();
  }, [hotelId, loaded]);

  const save = async () => {
    setIsSaving(true);
    try {
      await Promise.all([
        setHotelSetting(hotelId, 'government_tax_enabled', govTaxEnabled ? 'true' : 'false'),
        setHotelSetting(hotelId, 'government_tax_per_room_per_night', govTaxAmount),
        setHotelSetting(hotelId, 'government_tax_label', govTaxLabel),
        setHotelSetting(hotelId, 'fixed_charges', JSON.stringify(fixedCharges)),
      ]);
      await qc.invalidateQueries({ queryKey: ['hotel-settings', hotelId] });
      toast.success('Paramètres de taxes sauvegardés');
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la sauvegarde');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Receipt className="h-5 w-5" />Taxe gouvernementale</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Switch checked={govTaxEnabled} onCheckedChange={setGovTaxEnabled} />
            <Label>{govTaxEnabled ? 'Activée' : 'Désactivée'}</Label>
          </div>
          {govTaxEnabled && (
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Libellé</Label><Input value={govTaxLabel} onChange={e => setGovTaxLabel(e.target.value)} /></div>
              <div><Label>Montant par chambre/nuit (FCFA)</Label><Input type="number" value={govTaxAmount} onChange={e => setGovTaxAmount(e.target.value)} /></div>
            </div>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Frais fixes obligatoires</CardTitle>
            <Button size="sm" variant="outline" onClick={() => setFixedCharges(prev => [...prev, { id: Date.now().toString(), name: 'Nouveau frais', amount: 0, per: 'stay', enabled: true }])}>
              <Plus className="h-4 w-4 mr-1" />Ajouter
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {fixedCharges.map((charge, i) => (
            <div key={charge.id} className="grid grid-cols-5 gap-2 items-center border rounded-lg p-3">
              <Switch checked={charge.enabled} onCheckedChange={v => setFixedCharges(prev => prev.map((c, j) => j === i ? { ...c, enabled: v } : c))} />
              <Input value={charge.name} placeholder="Nom" onChange={e => setFixedCharges(prev => prev.map((c, j) => j === i ? { ...c, name: e.target.value } : c))} />
              <Input type="number" value={charge.amount} placeholder="Montant" onChange={e => setFixedCharges(prev => prev.map((c, j) => j === i ? { ...c, amount: Number(e.target.value) } : c))} />
              <Select value={charge.per} onValueChange={v => setFixedCharges(prev => prev.map((c, j) => j === i ? { ...c, per: v as 'night' | 'stay' } : c))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="night">Par nuit</SelectItem>
                  <SelectItem value="stay">Par séjour</SelectItem>
                </SelectContent>
              </Select>
              <Button size="sm" variant="ghost" onClick={() => setFixedCharges(prev => prev.filter((_, j) => j !== i))}>
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
      <div className="flex justify-end"><Button onClick={save} disabled={isSaving}>{isSaving ? 'Sauvegarde...' : 'Sauvegarder les taxes'}</Button></div>
    </div>
  );
}

// Fidélité & Niveaux Tab Component
function FideliteTab({ hotelId }: { hotelId: string }) {
  const qc = useQueryClient();
  const [thresholds, setThresholds] = useState<TierThresholds>(DEFAULT_TIER_THRESHOLDS);
  const [pointsRate, setPointsRate] = useState('1');
  const [loaded, setLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!hotelId || loaded) return;
    (async () => {
      const [th, rate] = await Promise.all([
        getHotelSetting(hotelId, 'tier_thresholds'),
        getHotelSetting(hotelId, 'loyalty_points_per_1000_fcfa'),
      ]);
      if (th) { try { setThresholds(JSON.parse(th)); } catch {} }
      if (rate) setPointsRate(rate);
      setLoaded(true);
    })();
  }, [hotelId, loaded]);

  const tiers = ['silver', 'gold', 'vip'] as const;
  const tierLabels: Record<string, string> = { silver: 'Silver', gold: 'Gold', vip: 'VIP' };

  const save = async () => {
    setIsSaving(true);
    try {
      await Promise.all([
        setHotelSetting(hotelId, 'tier_thresholds', JSON.stringify(thresholds)),
        setHotelSetting(hotelId, 'loyalty_points_per_1000_fcfa', pointsRate),
      ]);
      await qc.invalidateQueries({ queryKey: ['hotel-settings', hotelId] });
      toast.success('Paramètres de fidélité sauvegardés');
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la sauvegarde');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Award className="h-5 w-5" />Points de fidélité</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Label>Points par 1 000 FCFA payés</Label>
            <Input type="number" value={pointsRate} onChange={e => setPointsRate(e.target.value)} className="w-24" />
          </div>
          <p className="text-xs text-muted-foreground mt-2">Bonus par niveau: Silver +10%, Gold +25%, VIP +50%</p>
        </CardContent>
      </Card>
      <div className="grid gap-4 md:grid-cols-3">
        {tiers.map(tier => (
          <Card key={tier}>
            <CardHeader><CardTitle className="flex items-center gap-2"><TierBadge tier={tier} />{tierLabels[tier]}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground">Séjours minimum</Label>
                <Input type="number" value={(thresholds[tier] as any)?.stays || 0}
                  onChange={e => setThresholds(prev => ({ ...prev, [tier]: { ...(prev[tier as keyof TierThresholds] as any), stays: Number(e.target.value) } }))} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Dépenses minimum (FCFA)</Label>
                <Input type="number" value={(thresholds[tier] as any)?.totalSpent || 0}
                  onChange={e => setThresholds(prev => ({ ...prev, [tier]: { ...(prev[tier as keyof TierThresholds] as any), totalSpent: Number(e.target.value) } }))} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Points minimum</Label>
                <Input type="number" value={(thresholds[tier] as any)?.points || 0}
                  onChange={e => setThresholds(prev => ({ ...prev, [tier]: { ...(prev[tier as keyof TierThresholds] as any), points: Number(e.target.value) } }))} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="flex justify-end"><Button onClick={save} disabled={isSaving}>{isSaving ? 'Sauvegarde...' : 'Sauvegarder la fidélité'}</Button></div>
    </div>
  );
}

export default SettingsPage;
