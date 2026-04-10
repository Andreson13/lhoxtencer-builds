import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, ArrowRight, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const OnboardingPage = () => {
  const { profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: '', city: '', country: 'Cameroun', phone: '', whatsapp: '' });

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !form.name || !form.city) { toast.error('Nom et ville requis'); return; }
    setLoading(true);
    try {
      const slug = form.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Date.now().toString(36);
      const { data: hotel, error } = await supabase.from('hotels').insert({
        name: form.name, slug, city: form.city, country: form.country, phone: form.phone, whatsapp: form.whatsapp,
      } as any).select().single();
      if (error) throw error;
      await supabase.from('profiles').update({ hotel_id: (hotel as any).id, role: 'admin', is_hotel_owner: true } as any).eq('id', profile.id);
      await refreshProfile();
      toast.success('Hôtel créé avec succès !');
      setStep(3);
    } catch (error: any) { toast.error(error.message || 'Erreur'); } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 p-3 rounded-xl bg-primary/10"><Building2 className="h-10 w-10 text-primary" /></div>
          <CardTitle className="text-2xl font-semibold">
            {step === 1 ? 'Bienvenue sur HôtelManager Pro' : step === 2 ? 'Créez votre hôtel' : 'Vous êtes prêt !'}
          </CardTitle>
          <CardDescription>
            {step === 1 ? 'Configurons votre établissement' : step === 2 ? 'Informations de votre hôtel' : 'Votre hôtel est configuré'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === 1 && <Button className="w-full" onClick={() => setStep(2)}>Commencer <ArrowRight className="ml-2 h-4 w-4" /></Button>}
          {step === 2 && (
            <form onSubmit={onSubmit} className="space-y-4">
              <div><Label>Nom de l'hôtel *</Label><Input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} placeholder="Hôtel Le Palmier" /></div>
              <div><Label>Ville *</Label><Input value={form.city} onChange={e => setForm(f => ({...f, city: e.target.value}))} placeholder="Douala" /></div>
              <div><Label>Pays</Label><Input value={form.country} onChange={e => setForm(f => ({...f, country: e.target.value}))} /></div>
              <div><Label>Téléphone</Label><Input value={form.phone} onChange={e => setForm(f => ({...f, phone: e.target.value}))} placeholder="+237 6XX XXX XXX" /></div>
              <div><Label>WhatsApp</Label><Input value={form.whatsapp} onChange={e => setForm(f => ({...f, whatsapp: e.target.value}))} placeholder="+237 6XX XXX XXX" /></div>
              <Button type="submit" className="w-full" disabled={loading}>{loading ? 'Création...' : 'Créer mon hôtel'}</Button>
            </form>
          )}
          {step === 3 && (
            <div className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 rounded-full bg-success/10 flex items-center justify-center"><Check className="h-8 w-8 text-success" /></div>
              <p className="text-muted-foreground">Vous pouvez maintenant gérer votre hôtel</p>
              <Button className="w-full" onClick={() => navigate('/dashboard')}>Accéder au tableau de bord</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default OnboardingPage;
