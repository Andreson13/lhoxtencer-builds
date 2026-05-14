import React, { useMemo, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Building2, CheckCircle, BadgeCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
      // Update hotel membership first
      const { error: membershipError } = await (supabase as any)
        .from(‘hotel_memberships’)
        .upsert({
          hotel_id: invite.hotelId,
          user_id: user.id,
          role: invite.role,
          is_hotel_owner: invite.isOwner,
        }, { onConflict: ‘hotel_id,user_id’ });

      if (membershipError) throw membershipError;

      // Update user profile with hotel context
      const { error: profileError } = await supabase
        .from(‘profiles’)
        .update({
          hotel_id: invite.hotelId,
          role: invite.role,
          is_hotel_owner: invite.isOwner,
          disabled: false,
        } as any)
        .eq(‘id’, user.id);

      if (profileError) throw profileError;

      // Refresh profile to sync context
      await refreshProfile();

      toast.success(`Invitation appliquée! Bienvenue dans ${invite.hotelName} en tant que ${invite.role}.`);

      // Navigate to dashboard with hotel context loaded
      navigate(‘/dashboard’);
    } catch (error: any) {
      toast.error(error?.message || ‘Impossible d’appliquer cette invitation’);
      console.error(‘Apply invite error:’, error);
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
          // Create hotel membership for the new user
          const { error: membershipError } = await (supabase as any)
            .from('hotel_memberships')
            .upsert({
              hotel_id: invite.hotelId,
              user_id: userId,
              role: invite.role,
              is_hotel_owner: invite.isOwner,
            }, { onConflict: 'hotel_id,user_id' });

          if (membershipError) throw membershipError;
        }

        // Refresh profile to ensure hotel_id and role are set in session
        await refreshProfile();

        toast.success(`Bienvenue dans ${invite.hotelName}! Vous êtes maintenant connecté en tant que ${invite.role}.`);

        // Navigate to dashboard with hotel context loaded
        navigate('/dashboard');
      } else {
        // Email confirmation required
        toast.success('Compte créé. Vérifiez votre email pour confirmer puis connectez-vous.');
        navigate('/login');
      }
    } catch (error: any) {
      toast.error(error?.message || 'Erreur de création de compte');
      console.error('Signup error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!hasValidInvite) {
    return <Navigate to="/login" replace />;
  }

  const getRoleBadgeColor = (role: string) => {
    const colors: Record<string, string> = {
      admin: 'bg-red-100 text-red-800',
      manager: 'bg-blue-100 text-blue-800',
      receptionist: 'bg-green-100 text-green-800',
      accountant: 'bg-purple-100 text-purple-800',
      restaurant: 'bg-orange-100 text-orange-800',
      kitchen: 'bg-yellow-100 text-yellow-800',
      housekeeping: 'bg-indigo-100 text-indigo-800',
    };
    return colors[role] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 p-3 rounded-xl bg-primary/10">
            <Building2 className="h-10 w-10 text-primary" />
          </div>
          <CardTitle className="text-2xl font-semibold">Invitation d'équipe</CardTitle>
          <CardDescription>
            Vous avez été invité à rejoindre une équipe
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Invite Details Alert */}
          <Alert className="border-primary/20 bg-primary/5">
            <AlertDescription className="space-y-3">
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <div className="space-y-2 flex-1">
                  <p className="font-medium text-sm">Détails de votre invitation:</p>
                  <div className="grid gap-2 text-sm">
                    {invite.hotelName && (
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Hôtel:</span>
                        <span className="font-semibold">{invite.hotelName}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Rôle:</span>
                      <Badge className={getRoleBadgeColor(invite.role)}>{invite.role}</Badge>
                    </div>
                    {invite.isOwner && (
                      <div className="flex items-center gap-2 pt-1">
                        <BadgeCheck className="h-4 w-4 text-amber-500" />
                        <span className="text-xs font-medium text-amber-700">Propriétaire de l'hôtel</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </AlertDescription>
          </Alert>

          {user ? (
            <div className="space-y-4">
              <div className="rounded-md border bg-muted/40 p-3 text-sm">
                Vous êtes connecté en tant que <strong>{profile?.email || user.email}</strong>.
              </div>
              <Button className="w-full" onClick={applyInviteToCurrentUser} disabled={loading} size="lg">
                {loading ? 'Application...' : 'Appliquer cette invitation'}
              </Button>
            </div>
          ) : (
            <form onSubmit={onSignUp} className="space-y-4">
              <div>
                <Label htmlFor="email">Email invité</Label>
                <Input id="email" value={invite.email} readOnly className="bg-muted" />
              </div>
              <div>
                <Label htmlFor="fullName">Nom complet</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder="Nom Prénom"
                  disabled={loading}
                />
              </div>
              <div>
                <Label htmlFor="password">Mot de passe</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Min. 6 caractères"
                  disabled={loading}
                />
              </div>
              <div>
                <Label htmlFor="confirmPassword">Confirmer mot de passe</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  disabled={loading}
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading} size="lg">
                {loading ? 'Création en cours...' : 'Créer mon compte et rejoindre'}
              </Button>
              <Button type="button" variant="outline" className="w-full" onClick={() => navigate(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`)} disabled={loading}>
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
