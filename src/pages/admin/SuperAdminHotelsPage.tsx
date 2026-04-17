import React, { useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Pencil, Plus, Search, Shield, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

const roleOptions = ['admin', 'manager', 'receptionist', 'accountant', 'restaurant', 'kitchen', 'housekeeping'];

const slugify = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const SuperAdminHotelsPage = () => {
  const { profile, loading, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [createHotelOpen, setCreateHotelOpen] = useState(false);
  const [manageHotelOpen, setManageHotelOpen] = useState(false);
  const [selectedHotel, setSelectedHotel] = useState<any>(null);
  const [newHotelForm, setNewHotelForm] = useState({
    name: '', city: '', country: 'Cameroun', phone: '', whatsapp: '', email: '', address: '',
    subscription_plan: 'starter', subscription_status: 'trial', owner_email: '',
  });
  const [assignEmail, setAssignEmail] = useState('');
  const [assignRole, setAssignRole] = useState('receptionist');
  const [assignAsOwner, setAssignAsOwner] = useState(false);
  const [generatedInviteLink, setGeneratedInviteLink] = useState('');

  const { data: hotels = [], isLoading } = useQuery({
    queryKey: ['superadmin-hotels'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('hotels')
        .select('id, name, slug, city, country, phone, email, whatsapp, address, subscription_plan, subscription_status, created_at')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.is_super_admin,
  });

  const { data: hotelMembers = [], isLoading: membersLoading } = useQuery({
    queryKey: ['superadmin-hotel-members', selectedHotel?.id],
    queryFn: async () => {
      if (!selectedHotel?.id) return [];
      const { data, error } = await (supabase as any)
        .from('hotel_memberships')
        .select('id, user_id, role, is_hotel_owner, profiles!hotel_memberships_user_id_fkey(id, full_name, email, disabled, is_super_admin)')
        .eq('hotel_id', selectedHotel.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.is_super_admin && !!selectedHotel?.id && manageHotelOpen,
  });

  const createHotelMutation = useMutation({
    mutationFn: async () => {
      if (!newHotelForm.name.trim()) throw new Error('Nom hôtel requis');
      if (!newHotelForm.city.trim()) throw new Error('Ville requise');

      const slugBase = slugify(newHotelForm.name);
      const slug = `${slugBase || 'hotel'}-${Date.now().toString(36)}`;

      const { data: createdHotel, error: createError } = await supabase
        .from('hotels')
        .insert({
          name: newHotelForm.name.trim(),
          slug,
          city: newHotelForm.city.trim(),
          country: newHotelForm.country.trim() || 'Cameroun',
          phone: newHotelForm.phone.trim() || null,
          whatsapp: newHotelForm.whatsapp.trim() || null,
          email: newHotelForm.email.trim() || null,
          address: newHotelForm.address.trim() || null,
          subscription_plan: newHotelForm.subscription_plan,
          subscription_status: newHotelForm.subscription_status,
        } as any)
        .select('id, name, slug, city, country, phone, email, whatsapp, address, subscription_plan, subscription_status, created_at')
        .single();

      if (createError) throw createError;

      const ownerEmail = newHotelForm.owner_email.trim().toLowerCase();
      if (ownerEmail) {
        const { data: ownerProfile, error: ownerFetchError } = await supabase
          .from('profiles')
          .select('id, email')
          .ilike('email', ownerEmail)
          .maybeSingle();

        if (ownerFetchError) throw ownerFetchError;

        if (ownerProfile?.id) {
          const { error: ownerMembershipError } = await (supabase as any)
            .from('hotel_memberships')
            .upsert({
              hotel_id: createdHotel.id,
              user_id: ownerProfile.id,
              role: 'admin',
              is_hotel_owner: true,
            }, { onConflict: 'hotel_id,user_id' });
          if (ownerMembershipError) throw ownerMembershipError;

          const { error: ownerAssignError } = await supabase
            .from('profiles')
            .update({
              hotel_id: createdHotel.id,
              role: 'admin',
              is_hotel_owner: true,
              disabled: false,
            } as any)
            .eq('id', ownerProfile.id);
          if (ownerAssignError) throw ownerAssignError;
        } else {
          toast.warning('Hôtel créé, mais aucun utilisateur existant avec cet email pour l’instant.');
        }
      }

      return createdHotel;
    },
    onSuccess: (createdHotel: any) => {
      qc.invalidateQueries({ queryKey: ['superadmin-hotels'] });
      setCreateHotelOpen(false);
      setSelectedHotel(createdHotel);
      setGeneratedInviteLink('');
      setAssignEmail('');
      setAssignRole('receptionist');
      setAssignAsOwner(false);
      setManageHotelOpen(true);
      setNewHotelForm({
        name: '', city: '', country: 'Cameroun', phone: '', whatsapp: '', email: '', address: '',
        subscription_plan: 'starter', subscription_status: 'trial', owner_email: '',
      });
      toast.success('Hôtel créé avec succès');
    },
    onError: (error: any) => toast.error(error?.message || 'Erreur lors de la création hôtel'),
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ hotelId, status }: { hotelId: string; status: string }) => {
      const { error } = await supabase
        .from('hotels')
        .update({ subscription_status: status })
        .eq('id', hotelId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['superadmin-hotels'] });
      toast.success('Statut hôtel mis à jour');
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Impossible de mettre à jour le statut');
    },
  });

  const updateHotelMutation = useMutation({
    mutationFn: async () => {
      if (!selectedHotel?.id) throw new Error('Aucun hôtel sélectionné');
      if (!selectedHotel?.name?.trim()) throw new Error('Nom hôtel requis');

      const generatedSlugBase = slugify(selectedHotel.name || 'hotel');
      const generatedSlug = `${generatedSlugBase || 'hotel'}-${selectedHotel.id.slice(0, 6)}`;

      const { error } = await supabase
        .from('hotels')
        .update({
          name: selectedHotel.name.trim(),
          slug: generatedSlug,
          city: selectedHotel.city?.trim() || null,
          country: selectedHotel.country?.trim() || null,
          phone: selectedHotel.phone?.trim() || null,
          whatsapp: selectedHotel.whatsapp?.trim() || null,
          email: selectedHotel.email?.trim() || null,
          address: selectedHotel.address?.trim() || null,
          subscription_plan: selectedHotel.subscription_plan || 'starter',
          subscription_status: selectedHotel.subscription_status || 'trial',
        } as any)
        .eq('id', selectedHotel.id);

      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['superadmin-hotels'] });
      toast.success('Hôtel mis à jour');
    },
    onError: (error: any) => toast.error(error?.message || 'Impossible de mettre à jour cet hôtel'),
  });

  const assignMemberMutation = useMutation({
    mutationFn: async () => {
      if (!selectedHotel?.id) throw new Error('Aucun hôtel sélectionné');
      const normalizedEmail = assignEmail.trim().toLowerCase();
      if (!normalizedEmail) throw new Error('Email membre requis');

      const { data: member, error: memberError } = await supabase
        .from('profiles')
        .select('id, email, hotel_id')
        .ilike('email', normalizedEmail)
        .maybeSingle();

      if (memberError) throw memberError;
      if (!member?.id) throw new Error('Aucun utilisateur trouvé avec cet email. L’utilisateur doit se connecter au moins une fois.');

      const { error: membershipError } = await (supabase as any)
        .from('hotel_memberships')
        .upsert({
          hotel_id: selectedHotel.id,
          user_id: member.id,
          role: assignRole,
          is_hotel_owner: assignAsOwner,
        }, { onConflict: 'hotel_id,user_id' });

      if (membershipError) throw membershipError;

      if (!member.hotel_id) {
        const { error: assignError } = await supabase
          .from('profiles')
          .update({
            hotel_id: selectedHotel.id,
            role: assignRole,
            is_hotel_owner: assignAsOwner,
            disabled: false,
          } as any)
          .eq('id', member.id);

        if (assignError) throw assignError;
      } else {
        const { error: enableError } = await supabase
          .from('profiles')
          .update({ disabled: false } as any)
          .eq('id', member.id);

        if (enableError) throw enableError;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['superadmin-hotel-members', selectedHotel?.id] });
      setAssignEmail('');
      setAssignRole('receptionist');
      setAssignAsOwner(false);
      toast.success('Membre assigné à l’hôtel');
    },
    onError: (error: any) => toast.error(error?.message || 'Impossible d’assigner ce membre'),
  });

  const generateInviteLinkMutation = useMutation({
    mutationFn: async () => {
      if (!selectedHotel?.id) throw new Error('Aucun hôtel sélectionné');
      const normalizedEmail = assignEmail.trim().toLowerCase();
      if (!normalizedEmail) throw new Error('Email membre requis');

      const params = new URLSearchParams({
        email: normalizedEmail,
        hotelId: selectedHotel.id,
        hotelName: selectedHotel.name || '',
        role: assignRole,
        owner: assignAsOwner ? '1' : '0',
      });

      const isDesktopShell =
        typeof window !== 'undefined' &&
        (window.location.protocol === 'file:' || (window as any).electronApp?.isDesktop);

      const invitePath = `/invite/join?${params.toString()}`;
      const inviteUrl = isDesktopShell
        ? `${window.location.origin}/#${invitePath}`
        : `${window.location.origin}${invitePath}`;

      try {
        await navigator.clipboard.writeText(inviteUrl);
      } catch {
        // Clipboard may be unavailable in some contexts; we'll still return the link for manual copy.
      }

      return inviteUrl;
    },
    onSuccess: (inviteUrl: string) => {
      setGeneratedInviteLink(inviteUrl);
      toast.success('Lien d’invitation généré et copié');
    },
    onError: (error: any) => toast.error(error?.message || 'Impossible de générer le lien'),
  });

  const updateMemberMutation = useMutation({
    mutationFn: async ({ userId, patch }: { userId: string; patch: Record<string, any> }) => {
      const { error } = await supabase
        .from('profiles')
        .update(patch as any)
        .eq('id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['superadmin-hotel-members', selectedHotel?.id] });
      toast.success('Membre mis à jour');
    },
    onError: (error: any) => toast.error(error?.message || 'Impossible de mettre à jour ce membre'),
  });

  const updateMembershipMutation = useMutation({
    mutationFn: async ({ membershipId, patch }: { membershipId: string; patch: Record<string, any> }) => {
      const { error } = await (supabase as any)
        .from('hotel_memberships')
        .update(patch)
        .eq('id', membershipId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['superadmin-hotel-members', selectedHotel?.id] });
      toast.success('Affectation mise à jour');
    },
    onError: (error: any) => toast.error(error?.message || 'Impossible de mettre à jour cette affectation'),
  });

  const removeMemberMutation = useMutation({
    mutationFn: async ({ membershipId, userId }: { membershipId: string; userId: string }) => {
      const { error: deleteMembershipError } = await (supabase as any)
        .from('hotel_memberships')
        .delete()
        .eq('id', membershipId);
      if (deleteMembershipError) throw deleteMembershipError;

      const { data: remainingMemberships } = await (supabase as any)
        .from('hotel_memberships')
        .select('hotel_id')
        .eq('user_id', userId)
        .limit(1);

      if (!remainingMemberships || remainingMemberships.length === 0) {
        const { error: clearProfileError } = await supabase
          .from('profiles')
          .update({ hotel_id: null, is_hotel_owner: false } as any)
          .eq('id', userId);
        if (clearProfileError) throw clearProfileError;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['superadmin-hotel-members', selectedHotel?.id] });
      toast.success('Membre retiré de cet hôtel');
    },
    onError: (error: any) => toast.error(error?.message || 'Impossible de retirer ce membre'),
  });

  const switchContextMutation = useMutation({
    mutationFn: async (hotelId: string) => {
      if (!profile?.id) throw new Error('Profil manquant');
      const { error } = await supabase
        .from('profiles')
        .update({ hotel_id: hotelId } as any)
        .eq('id', profile.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await refreshProfile();
      toast.success('Contexte hôtel changé');
      navigate('/dashboard');
    },
    onError: (error: any) => toast.error(error?.message || 'Impossible d’entrer dans cet hôtel'),
  });

  const filteredHotels = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return hotels;
    return hotels.filter((hotel: any) =>
      `${hotel.name || ''} ${hotel.slug || ''} ${hotel.city || ''} ${hotel.country || ''}`.toLowerCase().includes(q),
    );
  }, [hotels, search]);

  if (loading) {
    return <div className="page-container space-y-4"><Skeleton className="h-10 w-72" /><Skeleton className="h-80 w-full" /></div>;
  }

  if (!profile?.is_super_admin) {
    return <Navigate to="/access-denied" replace />;
  }

  return (
    <div className="page-container space-y-6">
      <PageHeader title="Super Admin - Hôtels" subtitle={`${filteredHotels.length} hôtel(s)`}>
        <Button onClick={() => setCreateHotelOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nouvel hôtel
        </Button>
      </PageHeader>

      <div className="rounded-2xl border bg-card p-4 shadow-sm">
        <div className="relative max-w-xl">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-10"
            placeholder="Rechercher un hôtel..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-12 w-full" />)}
        </div>
      ) : filteredHotels.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="Aucun hôtel trouvé"
          description="Aucun hôtel ne correspond à votre recherche."
        />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Ville / Pays</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Créé le</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredHotels.map((hotel: any) => (
                <TableRow key={hotel.id}>
                  <TableCell className="font-medium">{hotel.name}</TableCell>
                  <TableCell>{hotel.slug}</TableCell>
                  <TableCell>{[hotel.city, hotel.country].filter(Boolean).join(' / ') || '-'}</TableCell>
                  <TableCell>{hotel.subscription_plan || '-'}</TableCell>
                  <TableCell>
                    <Badge variant={hotel.subscription_status === 'active' ? 'default' : 'secondary'}>
                      {hotel.subscription_status || 'unknown'}
                    </Badge>
                  </TableCell>
                  <TableCell>{hotel.created_at ? new Date(hotel.created_at).toLocaleDateString('fr-FR') : '-'}</TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex items-center gap-2">
                      <Select
                        value={hotel.subscription_status || 'active'}
                        onValueChange={(value) => updateStatusMutation.mutate({ hotelId: hotel.id, status: value })}
                      >
                        <SelectTrigger className="w-[160px]">
                          <SelectValue placeholder="Statut" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">active</SelectItem>
                          <SelectItem value="trial">trial</SelectItem>
                          <SelectItem value="suspended">suspended</SelectItem>
                          <SelectItem value="cancelled">cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedHotel(hotel);
                          setGeneratedInviteLink('');
                          setAssignEmail('');
                          setAssignRole('receptionist');
                          setAssignAsOwner(false);
                          setManageHotelOpen(true);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5 mr-1" />
                        Gérer
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => switchContextMutation.mutate(hotel.id)}
                        disabled={switchContextMutation.isPending}
                      >
                        <Shield className="h-3.5 w-3.5 mr-1" />
                        Entrer
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(`/booking/${hotel.slug}`, '_blank', 'noopener,noreferrer')}
                      >
                        Voir portail
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={createHotelOpen} onOpenChange={setCreateHotelOpen}>
        <DialogContent className="w-[95vw] max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Créer un hôtel</DialogTitle>
            <DialogDescription>Créez un nouvel hôtel puis affectez immédiatement un propriétaire.</DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><Label>Nom hôtel *</Label><Input value={newHotelForm.name} onChange={(event) => setNewHotelForm((prev) => ({ ...prev, name: event.target.value }))} /></div>
            <div><Label>Ville *</Label><Input value={newHotelForm.city} onChange={(event) => setNewHotelForm((prev) => ({ ...prev, city: event.target.value }))} /></div>
            <div><Label>Pays</Label><Input value={newHotelForm.country} onChange={(event) => setNewHotelForm((prev) => ({ ...prev, country: event.target.value }))} /></div>
            <div><Label>Téléphone</Label><Input value={newHotelForm.phone} onChange={(event) => setNewHotelForm((prev) => ({ ...prev, phone: event.target.value }))} /></div>
            <div><Label>WhatsApp</Label><Input value={newHotelForm.whatsapp} onChange={(event) => setNewHotelForm((prev) => ({ ...prev, whatsapp: event.target.value }))} /></div>
            <div><Label>Email</Label><Input value={newHotelForm.email} onChange={(event) => setNewHotelForm((prev) => ({ ...prev, email: event.target.value }))} type="email" /></div>
            <div className="md:col-span-2"><Label>Adresse</Label><Input value={newHotelForm.address} onChange={(event) => setNewHotelForm((prev) => ({ ...prev, address: event.target.value }))} /></div>
            <div>
              <Label>Plan</Label>
              <Select value={newHotelForm.subscription_plan} onValueChange={(value) => setNewHotelForm((prev) => ({ ...prev, subscription_plan: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="starter">starter</SelectItem>
                  <SelectItem value="professional">professional</SelectItem>
                  <SelectItem value="enterprise">enterprise</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Statut</Label>
              <Select value={newHotelForm.subscription_status} onValueChange={(value) => setNewHotelForm((prev) => ({ ...prev, subscription_status: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="trial">trial</SelectItem>
                  <SelectItem value="active">active</SelectItem>
                  <SelectItem value="suspended">suspended</SelectItem>
                  <SelectItem value="cancelled">cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label>Email du propriétaire (optionnel)</Label>
              <Input
                value={newHotelForm.owner_email}
                onChange={(event) => setNewHotelForm((prev) => ({ ...prev, owner_email: event.target.value }))}
                type="email"
                placeholder="owner@hotel.com"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateHotelOpen(false)}>Annuler</Button>
            <Button onClick={() => createHotelMutation.mutate()} disabled={createHotelMutation.isPending}>
              {createHotelMutation.isPending ? 'Création...' : 'Créer hôtel'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={manageHotelOpen} onOpenChange={setManageHotelOpen}>
        <DialogContent className="w-[95vw] max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Gestion hôtel - {selectedHotel?.name || '-'}</DialogTitle>
            <DialogDescription>Modifiez l’hôtel, gérez l’équipe et affectez des membres.</DialogDescription>
          </DialogHeader>

          {!selectedHotel ? null : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div><Label>Nom hôtel</Label><Input value={selectedHotel.name || ''} onChange={(event) => setSelectedHotel((prev: any) => ({ ...prev, name: event.target.value }))} /></div>
                <div><Label>Ville</Label><Input value={selectedHotel.city || ''} onChange={(event) => setSelectedHotel((prev: any) => ({ ...prev, city: event.target.value }))} /></div>
                <div><Label>Pays</Label><Input value={selectedHotel.country || ''} onChange={(event) => setSelectedHotel((prev: any) => ({ ...prev, country: event.target.value }))} /></div>
                <div><Label>Téléphone</Label><Input value={selectedHotel.phone || ''} onChange={(event) => setSelectedHotel((prev: any) => ({ ...prev, phone: event.target.value }))} /></div>
                <div><Label>WhatsApp</Label><Input value={selectedHotel.whatsapp || ''} onChange={(event) => setSelectedHotel((prev: any) => ({ ...prev, whatsapp: event.target.value }))} /></div>
                <div><Label>Email</Label><Input value={selectedHotel.email || ''} onChange={(event) => setSelectedHotel((prev: any) => ({ ...prev, email: event.target.value }))} /></div>
                <div className="md:col-span-2"><Label>Adresse</Label><Input value={selectedHotel.address || ''} onChange={(event) => setSelectedHotel((prev: any) => ({ ...prev, address: event.target.value }))} /></div>
                <div>
                  <Label>Plan</Label>
                  <Select value={selectedHotel.subscription_plan || 'starter'} onValueChange={(value) => setSelectedHotel((prev: any) => ({ ...prev, subscription_plan: value }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="starter">starter</SelectItem>
                      <SelectItem value="professional">professional</SelectItem>
                      <SelectItem value="enterprise">enterprise</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Statut</Label>
                  <Select value={selectedHotel.subscription_status || 'trial'} onValueChange={(value) => setSelectedHotel((prev: any) => ({ ...prev, subscription_status: value }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="trial">trial</SelectItem>
                      <SelectItem value="active">active</SelectItem>
                      <SelectItem value="suspended">suspended</SelectItem>
                      <SelectItem value="cancelled">cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="rounded-xl border p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium"><Users className="h-4 w-4" /> Affecter un membre par email</div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <Input placeholder="email@user.com" value={assignEmail} onChange={(event) => setAssignEmail(event.target.value)} />
                  <Select value={assignRole} onValueChange={setAssignRole}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{roleOptions.map((role) => <SelectItem key={role} value={role}>{role}</SelectItem>)}</SelectContent>
                  </Select>
                  <label className="flex items-center gap-2 text-sm rounded-md border px-3 py-2">
                    <input type="checkbox" checked={assignAsOwner} onChange={(event) => setAssignAsOwner(event.target.checked)} />
                    Propriétaire hôtel
                  </label>
                  <div className="flex gap-2">
                    <Button onClick={() => assignMemberMutation.mutate()} disabled={assignMemberMutation.isPending}>
                      Affecter
                    </Button>
                    <Button variant="outline" onClick={() => generateInviteLinkMutation.mutate()} disabled={generateInviteLinkMutation.isPending}>
                      Lien invite
                    </Button>
                  </div>
                </div>
                {generatedInviteLink && (
                  <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2">
                    <Input value={generatedInviteLink} readOnly />
                    <Button
                      variant="outline"
                      onClick={async () => {
                        await navigator.clipboard.writeText(generatedInviteLink);
                        toast.success('Lien copié');
                      }}
                    >
                      Copier
                    </Button>
                  </div>
                )}
              </div>

              <div className="rounded-md border">
                {membersLoading ? (
                  <div className="p-4 space-y-2">
                    {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-10 w-full" />)}
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nom</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Rôle</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead>Owner</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {hotelMembers.map((member: any) => (
                        <TableRow key={member.id}>
                          <TableCell>{member.profiles?.full_name || '-'}</TableCell>
                          <TableCell>{member.profiles?.email || '-'}</TableCell>
                          <TableCell>
                            <Select
                              value={member.role || 'receptionist'}
                              onValueChange={(value) => updateMembershipMutation.mutate({ membershipId: member.id, patch: { role: value } })}
                            >
                              <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
                              <SelectContent>{roleOptions.map((role) => <SelectItem key={role} value={role}>{role}</SelectItem>)}</SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Badge variant={member.profiles?.disabled ? 'destructive' : 'default'}>{member.profiles?.disabled ? 'disabled' : 'active'}</Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant={member.is_hotel_owner ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => updateMembershipMutation.mutate({ membershipId: member.id, patch: { is_hotel_owner: !member.is_hotel_owner } })}
                            >
                              {member.is_hotel_owner ? 'Owner' : 'Make owner'}
                            </Button>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="inline-flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => updateMemberMutation.mutate({ userId: member.user_id, patch: { disabled: !member.profiles?.disabled } })}
                              >
                                {member.profiles?.disabled ? 'Enable' : 'Disable'}
                              </Button>
                              {!member.profiles?.is_super_admin && (
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => removeMemberMutation.mutate({ membershipId: member.id, userId: member.user_id })}
                                >
                                  Retirer
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setManageHotelOpen(false)}>Fermer</Button>
            <Button onClick={() => updateHotelMutation.mutate()} disabled={updateHotelMutation.isPending}>
              {updateHotelMutation.isPending ? 'Sauvegarde...' : 'Sauvegarder hôtel'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SuperAdminHotelsPage;
