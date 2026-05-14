import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Building2, CheckCircle, X } from 'lucide-react';
import { toast } from 'sonner';

interface Invitation {
  id: string;
  hotel_id: string;
  email: string;
  role: string;
  is_hotel_owner: boolean;
  hotels?: {
    name: string;
  };
}

const PendingInvitationsPage = () => {
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useAuth();
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.email) {
      navigate('/login');
      return;
    }

    const fetchInvitations = async () => {
      try {
        const { data, error } = await (supabase as any)
          .from('invitations')
          .select('*, hotels(name)')
          .eq('email', user.email)
          .eq('status', 'pending')
          .order('created_at', { ascending: false });

        if (error) throw error;
        setInvitations(data || []);

        if (!data || data.length === 0) {
          navigate('/dashboard');
        }
      } catch (error: any) {
        console.error('Error fetching invitations:', error);
        toast.error('Erreur lors du chargement des invitations');
        navigate('/dashboard');
      } finally {
        setLoading(false);
      }
    };

    fetchInvitations();
  }, [user?.email, navigate]);

  const acceptInvitation = async (invitation: Invitation) => {
    if (!user?.id) return;

    setProcessingId(invitation.id);
    try {
      const { error: membershipError } = await (supabase as any)
        .from('hotel_memberships')
        .upsert({
          hotel_id: invitation.hotel_id,
          user_id: user.id,
          role: invitation.role,
          is_hotel_owner: invitation.is_hotel_owner,
        }, { onConflict: 'hotel_id,user_id' });

      if (membershipError) throw membershipError;

      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          hotel_id: invitation.hotel_id,
          role: invitation.role,
          is_hotel_owner: invitation.is_hotel_owner,
          disabled: false,
        } as any)
        .eq('id', user.id);

      if (profileError) throw profileError;

      const { error: invitationError } = await (supabase as any)
        .from('invitations')
        .update({
          status: 'accepted',
          accepted_at: new Date().toISOString(),
        })
        .eq('id', invitation.id);

      if (invitationError) throw invitationError;

      await refreshProfile();

      toast.success(`Bienvenue dans ${invitation.hotels?.name}!`);

      setInvitations(prev => prev.filter(inv => inv.id !== invitation.id));

      if (invitations.length === 1) {
        navigate('/dashboard');
      }
    } catch (error: any) {
      toast.error(error?.message || 'Erreur lors de l\'acceptation de l\'invitation');
      console.error('Accept invitation error:', error);
    } finally {
      setProcessingId(null);
    }
  };

  const rejectInvitation = async (invitationId: string) => {
    setProcessingId(invitationId);
    try {
      const { error } = await (supabase as any)
        .from('invitations')
        .update({ status: 'rejected' })
        .eq('id', invitationId);

      if (error) throw error;

      toast.success('Invitation rejetee');
      setInvitations(prev => prev.filter(inv => inv.id !== invitationId));

      if (invitations.length === 1) {
        navigate('/onboarding');
      }
    } catch (error: any) {
      toast.error(error?.message || 'Erreur lors du rejet de l\'invitation');
      console.error('Reject invitation error:', error);
    } finally {
      setProcessingId(null);
    }
  };

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Chargement des invitations...</p>
      </div>
    );
  }

  if (invitations.length === 0) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 p-3 rounded-xl bg-primary/10">
            <Building2 className="h-10 w-10 text-primary" />
          </div>
          <CardTitle className="text-2xl font-semibold">
            Invitations en attente
          </CardTitle>
          <CardDescription>
            {invitations.length === 1
              ? 'Vous avez ete invite a rejoindre un hotel'
              : `Vous avez ${invitations.length} invitations`}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <Alert className="border-blue-200 bg-blue-50">
            <AlertDescription className="text-sm text-blue-900">
              Acceptez ou rejetez les invitations pour rejoindre les hotels. Les invitations rejetees peuvent etre ignorees en toute securite.
            </AlertDescription>
          </Alert>

          <div className="space-y-3">
            {invitations.map((invitation) => (
              <Card key={invitation.id} className="border-l-4 border-l-primary">
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">
                          {invitation.hotels?.name || 'Hotel'}
                        </h3>
                        {invitation.is_hotel_owner && (
                          <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50">
                            Proprietaire
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Role:</span>
                        <Badge className={getRoleBadgeColor(invitation.role)}>
                          {invitation.role}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Email: {invitation.email}
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        onClick={() => acceptInvitation(invitation)}
                        disabled={processingId !== null}
                        className="gap-2"
                      >
                        <CheckCircle className="h-4 w-4" />
                        Accepter
                      </Button>
                      <Button
                        onClick={() => rejectInvitation(invitation.id)}
                        variant="outline"
                        disabled={processingId !== null}
                        className="gap-2"
                      >
                        <X className="h-4 w-4" />
                        Refuser
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Button
            onClick={() => navigate('/onboarding')}
            variant="ghost"
            className="w-full"
            disabled={processingId !== null}
          >
            Ignorer et continuer
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default PendingInvitationsPage;
