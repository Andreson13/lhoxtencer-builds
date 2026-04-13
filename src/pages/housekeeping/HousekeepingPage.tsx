import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useHotel } from '@/contexts/HotelContext';
import { useRoleGuard } from '@/hooks/useRoleGuard';
import { useRealtimeTable } from '@/hooks/useRealtimeTable';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Sparkles, Play, CheckCircle, Eye } from 'lucide-react';

const statusCols = [
  { key: 'pending', label: 'À nettoyer', color: 'bg-destructive/10' },
  { key: 'in_progress', label: 'En cours', color: 'bg-blue-50' },
  { key: 'inspection', label: 'Inspection', color: 'bg-yellow-50' },
  { key: 'clean', label: 'Propre', color: 'bg-green-50' },
];

const HousekeepingPage = () => {
  useRoleGuard(['admin', 'manager', 'housekeeping']);
  const { hotel } = useHotel();
  const qc = useQueryClient();

  useRealtimeTable('housekeeping_tasks', ['housekeeping', hotel?.id || '']);

  const { data: tasks, isLoading } = useQuery({
    queryKey: ['housekeeping', hotel?.id],
    queryFn: async () => {
      const { data } = await supabase.from('housekeeping_tasks').select('*, rooms(room_number), profiles:assigned_to(full_name)').eq('hotel_id', hotel!.id).order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!hotel?.id,
  });

  const todayKey = new Date().toISOString().slice(0, 10);
  const dedupedTasks = React.useMemo(() => {
    const all = tasks || [];
    const openByRoom = new Map<string, any>();
    const cleanTodayByRoom = new Map<string, any>();

    for (const t of all) {
      const roomId = t.room_id || t.id;
      if (t.status === 'clean') {
        const createdDay = (t.created_at || '').slice(0, 10);
        if (createdDay === todayKey && !cleanTodayByRoom.has(roomId)) cleanTodayByRoom.set(roomId, t);
        continue;
      }
      if (!openByRoom.has(roomId)) openByRoom.set(roomId, t);
    }

    return [...openByRoom.values(), ...cleanTodayByRoom.values()];
  }, [tasks, todayKey]);

  const { data: staff } = useQuery({
    queryKey: ['housekeeping-staff', hotel?.id],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id, full_name').eq('hotel_id', hotel!.id).eq('role', 'housekeeping');
      return data || [];
    },
    enabled: !!hotel?.id,
  });

  const updateTask = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const { error } = await supabase.from('housekeeping_tasks').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['housekeeping'] }); toast.success('Tâche mise à jour'); },
    onError: (e: any) => toast.error(e.message),
  });

  const moveToStatus = (taskId: string, status: string) => {
    const updates: any = { status };
    if (status === 'in_progress') updates.started_at = new Date().toISOString();
    if (status === 'clean') updates.completed_at = new Date().toISOString();
    updateTask.mutate({ id: taskId, updates });
  };

  if (isLoading) return <div className="page-container space-y-4"><Skeleton className="h-8 w-48" /><div className="grid grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-64" />)}</div></div>;

  return (
    <div className="page-container space-y-6">
      <PageHeader title="Housekeeping" subtitle={`${dedupedTasks.length || 0} tâche(s)`} />

      <div className="grid grid-cols-4 gap-4">
        {statusCols.map(col => {
          const colTasks = dedupedTasks.filter(t => t.status === col.key) || [];
          return (
            <div key={col.key} className={`rounded-lg p-3 ${col.color} min-h-[300px]`}>
              <h3 className="font-semibold mb-3 flex items-center gap-2">{col.label}<Badge variant="secondary">{colTasks.length}</Badge></h3>
              <div className="space-y-3">
                {colTasks.map(task => {
                  const checklist = (task.checklist as string[]) || [];
                  const done = (task.checklist_done as string[]) || [];
                  return (
                    <Card key={task.id}>
                      <CardContent className="p-3 space-y-2">
                        <div className="flex justify-between items-center">
                          <p className="font-mono font-semibold">{(task as any).rooms?.room_number || '?'}</p>
                          <Badge variant="outline">{done.length}/{checklist.length}</Badge>
                        </div>
                        {(task as any).profiles?.full_name && <p className="text-xs text-muted-foreground">👤 {(task as any).profiles.full_name}</p>}
                        {task.status === 'pending' && staff && staff.length > 0 && (
                          <Select onValueChange={v => updateTask.mutate({ id: task.id, updates: { assigned_to: v } })}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Assigner" /></SelectTrigger>
                            <SelectContent>{staff.map(s => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}</SelectContent>
                          </Select>
                        )}
                        <div className="flex gap-1">
                          {task.status === 'pending' && <Button size="sm" className="flex-1" onClick={() => moveToStatus(task.id, 'in_progress')}><Play className="h-3 w-3 mr-1" />Commencer</Button>}
                          {task.status === 'in_progress' && <Button size="sm" className="flex-1" onClick={() => moveToStatus(task.id, 'inspection')}><Eye className="h-3 w-3 mr-1" />Inspection</Button>}
                          {task.status === 'inspection' && <Button size="sm" className="flex-1" onClick={() => moveToStatus(task.id, 'clean')}><CheckCircle className="h-3 w-3 mr-1" />Propre</Button>}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default HousekeepingPage;
