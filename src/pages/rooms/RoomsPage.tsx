import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { EmptyState } from '@/components/shared/EmptyState';
import { useHotel } from '@/contexts/HotelContext';
import { useI18n } from '@/contexts/I18nContext';
import { useRoleGuard } from '@/hooks/useRoleGuard';
import { supabase } from '@/integrations/supabase/client';
import { formatFCFA } from '@/utils/formatters';
import { toast } from 'sonner';

const RoomsPage = () => {
  useRoleGuard(['admin','manager','receptionist']);
  const { t } = useI18n();
  const { hotel } = useHotel();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editRoom, setEditRoom] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [form, setForm] = useState({ room_number: '', floor: 1, capacity: 2, category_id: '', status: 'available', description: '' });
  const [bulkForm, setBulkForm] = useState({ prefix: '', start: 101, end: 110, floor: 1, category_id: '', capacity: 2 });

  const { data: rooms, isLoading } = useQuery({
    queryKey: ['rooms', hotel?.id],
    queryFn: async () => {
      const { data } = await supabase.from('rooms').select('*, room_categories(name, price_per_night, color)').eq('hotel_id', hotel!.id).order('room_number');
      return data || [];
    },
    enabled: !!hotel?.id,
  });

  const { data: categories } = useQuery({
    queryKey: ['room-categories', hotel?.id],
    queryFn: async () => {
      const { data } = await supabase.from('room_categories').select('*').eq('hotel_id', hotel!.id).order('display_order');
      return data || [];
    },
    enabled: !!hotel?.id,
  });

  const { data: activeStays } = useQuery({
    queryKey: ['rooms-active-stays', hotel?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('stays')
        .select('id, room_id, status')
        .eq('hotel_id', hotel!.id)
        .eq('status', 'active');
      return data || [];
    },
    enabled: !!hotel?.id,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        room_number: form.room_number, floor: form.floor, capacity: form.capacity,
        category_id: form.category_id || null, status: form.status,
        description: form.description || null, hotel_id: hotel!.id,
        price_per_night: categories?.find(c => c.id === form.category_id)?.price_per_night || 0,
      };
      if (editRoom) {
        const { error } = await supabase.from('rooms').update(payload).eq('id', editRoom.id);
        if (error) throw error;

        // If the room is set directly to available, remove open housekeeping tasks to avoid redundancy.
        if (form.status === 'available') {
          await supabase
            .from('housekeeping_tasks')
            .delete()
            .eq('hotel_id', hotel!.id)
            .eq('room_id', editRoom.id)
            .in('status', ['pending', 'in_progress', 'inspection']);
        }
      } else {
        const { error } = await supabase.from('rooms').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      setDialogOpen(false);
      toast.success(editRoom ? t('rooms.updated') : t('rooms.created'));
    },
    onError: (e: any) => toast.error(e.message),
  });

  const bulkMutation = useMutation({
    mutationFn: async () => {
      const roomsToCreate: any[] = [];
      const price = categories?.find(c => c.id === bulkForm.category_id)?.price_per_night || 0;
      for (let n = bulkForm.start; n <= bulkForm.end; n++) {
        const roomNumber = bulkForm.prefix ? `${bulkForm.prefix}${n}` : `${n}`;
        const exists = rooms?.some(r => r.room_number === roomNumber);
        if (!exists) {
          roomsToCreate.push({
            hotel_id: hotel!.id, room_number: roomNumber, floor: bulkForm.floor,
            capacity: bulkForm.capacity, category_id: bulkForm.category_id || null,
            price_per_night: price, status: 'available',
          });
        }
      }
      if (roomsToCreate.length === 0) throw new Error(t('rooms.bulk.existsError'));
      const { error } = await supabase.from('rooms').insert(roomsToCreate);
      if (error) throw error;
      return roomsToCreate.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      setBulkDialogOpen(false);
      toast.success(`${count} ${t('rooms.bulkCreated')}`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('rooms').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      setDeleteId(null);
      toast.success(t('rooms.deleted'));
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openEdit = (room: any) => {
    setEditRoom(room);
    setForm({ room_number: room.room_number, floor: room.floor, capacity: room.capacity, category_id: room.category_id || '', status: room.status, description: room.description || '' });
    setDialogOpen(true);
  };

  const openAdd = () => {
    setEditRoom(null);
    setForm({ room_number: '', floor: 1, capacity: 2, category_id: '', status: 'available', description: '' });
    setDialogOpen(true);
  };

  const activeRoomIds = new Set((activeStays || []).map((s: any) => s.room_id).filter(Boolean));
  const reconciledRooms = (rooms || []).map((room: any) => {
    // Source of truth: if an active stay exists for the room, it must be occupied.
    if (activeRoomIds.has(room.id) && room.status !== 'occupied') {
      return { ...room, status: 'occupied' };
    }
    return room;
  });
  const filtered = statusFilter === 'all' ? reconciledRooms : reconciledRooms.filter((r: any) => r.status === statusFilter);
  const bulkCount = Math.max(0, bulkForm.end - bulkForm.start + 1);
  const bulkExisting = rooms ? Array.from({ length: bulkCount }, (_, i) => {
    const n = bulkForm.start + i;
    const roomNumber = bulkForm.prefix ? `${bulkForm.prefix}${n}` : `${n}`;
    return rooms.some(r => r.room_number === roomNumber) ? roomNumber : null;
  }).filter(Boolean) : [];

  const statusColors: Record<string, string> = {
    available: 'border-l-success', occupied: 'border-l-destructive',
    housekeeping: 'border-l-warning', maintenance: 'border-l-info',
    out_of_order: 'border-l-muted-foreground',
  };
  const availableCount = reconciledRooms.filter((room: any) => room.status === 'available').length;
  const occupiedCount = reconciledRooms.filter((room: any) => room.status === 'occupied').length;
  const housekeepingCount = reconciledRooms.filter((room: any) => room.status === 'housekeeping').length;
  const maintenanceCount = reconciledRooms.filter((room: any) => ['maintenance', 'out_of_order'].includes(room.status)).length;

  return (
    <div className="page-container space-y-6">
      <PageHeader title={t('rooms.title')} subtitle={`${rooms?.length || 0} ${t('rooms.subtitle')}`}>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder={t('rooms.filter.placeholder')} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('rooms.filter.all')}</SelectItem>
            <SelectItem value="available">{t('status.available')}</SelectItem>
            <SelectItem value="occupied">{t('status.occupied')}</SelectItem>
            <SelectItem value="housekeeping">{t('status.housekeeping')}</SelectItem>
            <SelectItem value="maintenance">{t('status.maintenance')}</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={() => setBulkDialogOpen(true)}><Layers className="h-4 w-4 mr-2" />{t('rooms.bulk')}</Button>
        <Button onClick={openAdd}><Plus className="h-4 w-4 mr-2" />{t('rooms.add')}</Button>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">{t('rooms.summary.available')}</p><p className="mt-2 text-2xl font-semibold">{availableCount}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">{t('rooms.summary.occupied')}</p><p className="mt-2 text-2xl font-semibold">{occupiedCount}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">{t('rooms.summary.housekeeping')}</p><p className="mt-2 text-2xl font-semibold">{housekeepingCount}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">{t('rooms.summary.maintenance')}</p><p className="mt-2 text-2xl font-semibold">{maintenanceCount}</p></CardContent></Card>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
        </div>
      ) : filtered && filtered.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((room: any) => (
            <Card key={room.id} className={`border-l-4 ${statusColors[room.status] || ''}`}>
              <CardContent className="pt-6">
                <div className="flex justify-between items-start mb-3">
                  <h3 className="text-2xl font-bold">{room.room_number}</h3>
                  <StatusBadge status={room.status} />
                </div>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <p>{t('rooms.card.floor')} {room.floor} · {room.capacity} {t('rooms.card.capacity')}</p>
                  {room.room_categories && <p className="text-xs"><span className="inline-block w-2 h-2 rounded-full mr-1" style={{ backgroundColor: room.room_categories.color || '#6366f1' }} />{room.room_categories.name}</p>}
                  <p className="font-semibold text-foreground">{formatFCFA(room.room_categories?.price_per_night ?? room.price_per_night)}{t('rooms.card.perNight')}</p>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button variant="outline" size="sm" onClick={() => openEdit(room)}><Pencil className="h-3 w-3 mr-1" />{t('common.edit')}</Button>
                  <Button variant="outline" size="sm" className="text-destructive" onClick={() => setDeleteId(room.id)}><Trash2 className="h-3 w-3" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState title={t('rooms.emptyTitle')} description={t('rooms.emptyDescription')} actionLabel={t('rooms.emptyAction')} onAction={openAdd} />
      )}

      {/* Single room dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editRoom ? t('rooms.dialog.editTitle') : t('rooms.dialog.newTitle')}</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="space-y-4">
            <div><Label>{t('rooms.dialog.number')}</Label><Input value={form.room_number} onChange={e => setForm(f => ({...f, room_number: e.target.value}))} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>{t('rooms.dialog.floor')}</Label><Input type="number" value={form.floor} onChange={e => setForm(f => ({...f, floor: Number(e.target.value)}))} /></div>
              <div><Label>{t('rooms.dialog.capacity')}</Label><Input type="number" value={form.capacity} onChange={e => setForm(f => ({...f, capacity: Number(e.target.value)}))} /></div>
            </div>
            <div><Label>{t('rooms.dialog.category')}</Label>
              <Select value={form.category_id} onValueChange={v => setForm(f => ({...f, category_id: v}))}>
                <SelectTrigger><SelectValue placeholder={t('rooms.dialog.selectCategory')} /></SelectTrigger>
                <SelectContent>
                  {categories?.map(c => <SelectItem key={c.id} value={c.id}>{c.name} — {formatFCFA(c.price_per_night)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>{t('rooms.dialog.status')}</Label>
              <Select value={form.status} onValueChange={(v) => setForm(f => ({...f, status: v}))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="available">{t('status.available')}</SelectItem>
                  <SelectItem value="occupied">{t('status.occupied')}</SelectItem>
                  <SelectItem value="housekeeping">{t('status.housekeeping')}</SelectItem>
                  <SelectItem value="maintenance">{t('status.maintenance')}</SelectItem>
                  <SelectItem value="out_of_order">{t('status.out_of_order')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>{t('rooms.dialog.description')}</Label><Input value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))} /></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>{t('common.cancel')}</Button>
              <Button type="submit" disabled={saveMutation.isPending}>{t('common.save')}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Bulk creation dialog */}
      <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('rooms.bulk.title')}</DialogTitle><DialogDescription>{t('rooms.bulk.description')}</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div><Label>{t('rooms.bulk.prefix')}</Label><Input placeholder="ex: 1" value={bulkForm.prefix} onChange={e => setBulkForm(f => ({ ...f, prefix: e.target.value }))} /></div>
              <div><Label>{t('rooms.bulk.start')}</Label><Input type="number" value={bulkForm.start} onChange={e => setBulkForm(f => ({ ...f, start: Number(e.target.value) }))} /></div>
              <div><Label>{t('rooms.bulk.end')}</Label><Input type="number" value={bulkForm.end} onChange={e => setBulkForm(f => ({ ...f, end: Number(e.target.value) }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>{t('rooms.dialog.floor')}</Label><Input type="number" value={bulkForm.floor} onChange={e => setBulkForm(f => ({ ...f, floor: Number(e.target.value) }))} /></div>
              <div><Label>{t('rooms.dialog.capacity')}</Label><Input type="number" value={bulkForm.capacity} onChange={e => setBulkForm(f => ({ ...f, capacity: Number(e.target.value) }))} /></div>
            </div>
            <div><Label>{t('rooms.dialog.category')} *</Label>
              <Select value={bulkForm.category_id} onValueChange={v => setBulkForm(f => ({ ...f, category_id: v }))}>
                <SelectTrigger><SelectValue placeholder={t('rooms.dialog.selectCategory')} /></SelectTrigger>
                <SelectContent>{categories?.map(c => <SelectItem key={c.id} value={c.id}>{c.name} — {formatFCFA(c.price_per_night)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="bg-muted p-3 rounded-md text-sm">
              <p>{t('rooms.bulk.willCreate')} <strong>{bulkCount - bulkExisting.length}</strong> {t('rooms.bulk.roomCount')}</p>
              {bulkExisting.length > 0 && (
                <p className="text-warning mt-1">{bulkExisting.length} {t('rooms.bulk.ignored')}: {bulkExisting.join(', ')}</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDialogOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={() => bulkMutation.mutate()} disabled={bulkCount === 0 || !bulkForm.category_id || bulkMutation.isPending}>
              {t('rooms.bulk.createAction')} {bulkCount - bulkExisting.length} {t('rooms.bulk.roomCount')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}
        description={<p>{t('rooms.deleteDescription')}</p>}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)} />
    </div>
  );
};

export default RoomsPage;
