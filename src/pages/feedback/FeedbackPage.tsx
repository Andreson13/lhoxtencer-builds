import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useHotel } from '@/contexts/HotelContext';
import { useRoleGuard } from '@/hooks/useRoleGuard';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { formatDateTime } from '@/utils/formatters';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { MessageSquare, Star } from 'lucide-react';

const FeedbackPage = () => {
  useRoleGuard(['admin', 'manager']);
  const { hotel } = useHotel();

  const { data: feedback, isLoading } = useQuery({
    queryKey: ['feedback', hotel?.id],
    queryFn: async () => {
      const { data } = await supabase.from('guest_feedback').select('*, guests(last_name, first_name)').eq('hotel_id', hotel!.id).order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!hotel?.id,
  });

  const avgRating = feedback?.length ? (feedback.reduce((s, f) => s + (f.rating || 0), 0) / feedback.length).toFixed(1) : '0';

  return (
    <div className="page-container space-y-6">
      <PageHeader title="Avis clients" subtitle={`${feedback?.length || 0} avis • Moyenne: ${avgRating}/5`} />

      {isLoading ? <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}</div> : !feedback?.length ? (
        <EmptyState icon={MessageSquare} title="Aucun avis" description="Les avis clients apparaîtront ici" />
      ) : (
        <div className="space-y-4">
          {feedback.map(f => (
            <Card key={f.id}>
              <CardContent className="py-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold">{(f as any).guests ? `${(f as any).guests.last_name} ${(f as any).guests.first_name}` : 'Anonyme'}</p>
                    {f.room_number && <p className="text-sm text-muted-foreground">Chambre {f.room_number}</p>}
                  </div>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className={`h-4 w-4 ${i < (f.rating || 0) ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`} />
                    ))}
                  </div>
                </div>
                {f.comment && <p className="mt-2 text-sm">{f.comment}</p>}
                <p className="text-xs text-muted-foreground mt-2">{formatDateTime(f.created_at)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default FeedbackPage;
