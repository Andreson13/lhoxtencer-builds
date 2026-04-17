import React, { useMemo, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Building2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const InviteJoinPage = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { user, profile, refreshProfile } = useAuth();

  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const invite = useMemo(() => {
    const email = (params.get('email') || '').trim().toLowerCase();
    const hotelId = (params.get('hotelId') || '').trim();
    const hotelName = (params.get('hotelName') || '').trim();
    const role = (params.get('role') || 'receptionist').trim();
    const isOwner = params.get('owner') === '1';

    return { email, hotelId, hotelName, role, isOwner };
  }, [params]);

  const hasValidInvite = Boolean(invite.email && invite.hotelId && invite.role);

  const applyInviteToCurrentUser = async () => {
    if (!user) {
      navigate(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      return;
    }

    setLoading(true);
    try {
      const { error: membershipError } = await (supabase as any)
        .from('hotel_memberships')
        .upsert({
          hotel_id: invite.hotelId,
          user_id: user.id,
          role: invite.role,
          is_hotel_owner: invite.isOwner,
        }, { onConflict: 'hotel_id,user_id' });

      if (membershipError) throw membershipError;

      const { error } = await supabase
        .from('profiles')
        .update({
          hotel_id: invite.hotelId,
          role: invite.role,
          is_hotel_owner: invite.isOwner,
          disabled: false,
        } as any)
        .eq('id', user.id);

      if (error) throw error;
      await refreshProfile();
      toast.success('Invitation appliquée. Bienvenue dans votre hôtel.');
      navigate('/dashboard');
    } catch (error: any) {
      toast.error(error?.message || 'Impossible d’appliquer cette invitation');
    } finally {
      setLoading(false);
    }
  };

  const onSignUp = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!hasValidInvite) {
      toast.error('Invitation invalide');
      return;
    }

    if (!fullName.trim()) {
      toast.error('Nom complet requis');
      return;
    }

    if (password.length < 6) {
      toast.error('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('Les mots de passe ne correspondent pas');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: invite.email,
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            hotel_id: invite.hotelId,
            role: invite.role,
            is_hotel_owner: invite.isOwner,
          },
        },
      });

      if (error) throw error;

      if (data.session) {
        const userId = data.user?.id;
        if (userId) {
          await (supabase as any)
            .from('hotel_memberships')
            .upsert({
              hotel_id: invite.hotelId,
              user_id: userId,
              role: invite.role,
              is_hotel_owner: invite.isOwner,
            }, { onConflict: 'hotel_id,user_id' });
        }
        await refreshProfile();
        toast.success('Compte créé et accès hôtel accordé.');
        navigate('/dashboard');
      } else {
        toast.success('Compte créé. Vérifiez votre email pour confirmer puis connectez-vous.');
        navigate('/login');
      }
    } catch (error: any) {
      toast.error(error?.message || 'Erreur de création de compte');
    } finally {
      setLoading(false);
    }
  };

  if (!hasValidInvite) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 p-3 rounded-xl bg-primary/10">
            <Building2 className="h-10 w-10 text-primary" />
          </div>
          <CardTitle className="text-2xl font-semibold">Invitation d'équipe</CardTitle>
          <CardDescription>
            {invite.hotelName ? `Rejoindre ${invite.hotelName}` : 'Rejoindre un hôtel'} en tant que {invite.role}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {user ? (
            <div className="space-y-4">
              <div className="rounded-md border bg-muted/40 p-3 text-sm">
                Vous êtes connecté en tant que <strong>{profile?.email || user.email}</strong>.
              </div>
              <Button className="w-full" onClick={applyInviteToCurrentUser} disabled={loading}>
                {loading ? 'Application...' : 'Appliquer cette invitation'}
              </Button>
            </div>
          ) : (
            <form onSubmit={onSignUp} className="space-y-4">
              <div>
                <Label>Email invité</Label>
                <Input value={invite.email} readOnly />
              </div>
              <div>
                <Label>Nom complet</Label>
                <Input value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Nom Prénom" />
              </div>
              <div>
                <Label>Mot de passe</Label>
                <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
              </div>
              <div>
                <Label>Confirmer mot de passe</Label>
                <Input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Création...' : 'Créer mon compte et rejoindre'}
              </Button>
              <Button type="button" variant="outline" className="w-full" onClick={() => navigate(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`)}>
                J'ai déjà un compte
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default InviteJoinPage;
