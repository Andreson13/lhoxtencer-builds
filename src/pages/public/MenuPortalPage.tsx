import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formatFCFA } from '@/utils/formatters';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Star, Send, UtensilsCrossed, BedDouble, Check } from 'lucide-react';

const MenuPortalPage = () => {
  const { slug, room } = useParams<{ slug: string; room?: string }>();
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [feedbackSent, setFeedbackSent] = useState(false);

  const { data: hotel } = useQuery({
    queryKey: ['hotel-menu-public', slug],
    queryFn: async () => {
      const { data } = await supabase.from('hotels').select('*').eq('slug', slug!).single();
      return data;
    },
    enabled: !!slug,
  });

  const { data: categories } = useQuery({
    queryKey: ['menu-categories-public', hotel?.id],
    queryFn: async () => {
      const { data } = await supabase.from('restaurant_categories').select('*').eq('hotel_id', hotel!.id).order('display_order');
      return data || [];
    },
    enabled: !!hotel?.id,
  });

  const { data: menuItems } = useQuery({
    queryKey: ['menu-items-public', hotel?.id],
    queryFn: async () => {
      const { data } = await supabase.from('restaurant_items').select('*').eq('hotel_id', hotel!.id).eq('available', true).order('name');
      return data || [];
    },
    enabled: !!hotel?.id,
  });

  const { data: services } = useQuery({
    queryKey: ['services-menu-public', hotel?.id],
    queryFn: async () => {
      const { data } = await supabase.from('hotel_services').select('*').eq('hotel_id', hotel!.id);
      return data || [];
    },
    enabled: !!hotel?.id,
  });

  const feedbackMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('guest_feedback').insert({
        hotel_id: hotel!.id,
        room_number: room || null,
        rating: feedbackRating,
        comment: feedbackComment || null,
      });
      if (error) throw error;
    },
    onSuccess: () => setFeedbackSent(true),
    onError: (e: any) => toast.error(e.message),
  });

  if (!hotel) return <div className="min-h-screen flex items-center justify-center"><p>Chargement...</p></div>;

  const groupedItems = categories?.map(cat => ({
    ...cat,
    items: menuItems?.filter(i => i.category_id === cat.id) || [],
  })).filter(g => g.items.length > 0) || [];

  const uncategorized = menuItems?.filter(i => !i.category_id) || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-background">
      <div className="bg-primary text-primary-foreground py-8 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-2xl font-bold">{hotel.name}</h1>
          {room && <p className="mt-1 text-primary-foreground/80">Chambre {room}</p>}
          <p className="mt-2 text-sm text-primary-foreground/60">Menu & Services</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Menu */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><UtensilsCrossed className="h-5 w-5" />Notre Menu</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            {groupedItems.map(group => (
              <div key={group.id}>
                <h3 className="font-semibold text-lg border-b pb-2 mb-3">{group.name}</h3>
                <div className="space-y-3">
                  {group.items.map(item => (
                    <div key={item.id} className="flex justify-between items-center">
                      <div>
                        <p className="font-medium">{item.name}</p>
                        {item.description && <p className="text-sm text-muted-foreground">{item.description}</p>}
                      </div>
                      <Badge variant="outline" className="text-base">{formatFCFA(item.price)}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {uncategorized.length > 0 && (
              <div>
                <h3 className="font-semibold text-lg border-b pb-2 mb-3">Autres</h3>
                <div className="space-y-3">
                  {uncategorized.map(item => (
                    <div key={item.id} className="flex justify-between items-center">
                      <div><p className="font-medium">{item.name}</p></div>
                      <Badge variant="outline">{formatFCFA(item.price)}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Services */}
        {services && services.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Services disponibles</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                {services.map(s => (
                  <div key={s.id} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-primary" />{s.name}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Feedback */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Star className="h-5 w-5" />Votre avis</CardTitle></CardHeader>
          <CardContent>
            {feedbackSent ? (
              <div className="text-center py-4">
                <Check className="h-8 w-8 text-green-500 mx-auto mb-2" />
                <p className="font-semibold">Merci pour votre avis !</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button key={n} onClick={() => setFeedbackRating(n)}>
                      <Star className={`h-8 w-8 ${n <= feedbackRating ? 'text-yellow-400 fill-yellow-400' : 'text-muted-foreground'}`} />
                    </button>
                  ))}
                </div>
                <Textarea placeholder="Votre commentaire (optionnel)..." value={feedbackComment} onChange={e => setFeedbackComment(e.target.value)} />
                <Button onClick={() => feedbackMutation.mutate()} disabled={feedbackRating === 0 || feedbackMutation.isPending}>
                  <Send className="h-4 w-4 mr-2" />Envoyer
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <footer className="py-6 text-center text-sm text-muted-foreground">
        <p>© {new Date().getFullYear()} {hotel.name}</p>
      </footer>
    </div>
  );
};

export default MenuPortalPage;
