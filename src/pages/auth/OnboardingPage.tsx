import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Building2, ArrowRight, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const hotelSchema = z.object({
  name: z.string().min(2, 'Nom requis').max(100),
  city: z.string().min(2, 'Ville requise').max(100),
  country: z.string().max(100).default('Cameroun'),
  phone: z.string().max(20).optional(),
  whatsapp: z.string().max(20).optional(),
});

const OnboardingPage = () => {
  const { profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(hotelSchema),
    defaultValues: { country: 'Cameroun' },
  });

  const onSubmit = async (data: any) => {
    if (!profile) return;
    setLoading(true);
    try {
      const slug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const { data: hotel, error } = await supabase.from('hotels').insert({
        name: data.name,
        slug: slug + '-' + Date.now().toString(36),
        city: data.city,
        country: data.country,
        phone: data.phone,
        whatsapp: data.whatsapp,
      } as any).select().single();
      if (error) throw error;
      
      await supabase.from('profiles').update({
        hotel_id: (hotel as any).id,
        role: 'admin',
        is_hotel_owner: true,
      } as any).eq('id', profile.id);

      await refreshProfile();
      toast.success('Hôtel créé avec succès !');
      setStep(3);
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la création');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 p-3 rounded-xl bg-primary/10">
            <Building2 className="h-10 w-10 text-primary" />
          </div>
          <CardTitle className="text-2xl font-semibold">
            {step === 1 && 'Bienvenue sur HôtelManager Pro'}
            {step === 2 && 'Créez votre hôtel'}
            {step === 3 && 'Vous êtes prêt !'}
          </CardTitle>
          <CardDescription>
            {step === 1 && 'Configurons votre établissement en quelques étapes'}
            {step === 2 && 'Renseignez les informations de votre hôtel'}
            {step === 3 && 'Votre hôtel est configuré'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === 1 && (
            <Button className="w-full" onClick={() => setStep(2)}>
              Commencer <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
          {step === 2 && (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div><Label>Nom de l'hôtel *</Label><Input {...register('name')} placeholder="Hôtel Le Palmier" />
                {errors.name && <p className="text-sm text-destructive mt-1">{errors.name.message as string}</p>}</div>
              <div><Label>Ville *</Label><Input {...register('city')} placeholder="Douala" />
                {errors.city && <p className="text-sm text-destructive mt-1">{errors.city.message as string}</p>}</div>
              <div><Label>Pays</Label><Input {...register('country')} /></div>
              <div><Label>Téléphone</Label><Input {...register('phone')} placeholder="+237 6XX XXX XXX" /></div>
              <div><Label>WhatsApp</Label><Input {...register('whatsapp')} placeholder="+237 6XX XXX XXX" /></div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Création...' : 'Créer mon hôtel'}
              </Button>
            </form>
          )}
          {step === 3 && (
            <div className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 rounded-full bg-success/10 flex items-center justify-center">
                <Check className="h-8 w-8 text-success" />
              </div>
              <p className="text-muted-foreground">Vous pouvez maintenant gérer votre hôtel</p>
              <Button className="w-full" onClick={() => navigate('/dashboard')}>
                Accéder au tableau de bord
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default OnboardingPage;
