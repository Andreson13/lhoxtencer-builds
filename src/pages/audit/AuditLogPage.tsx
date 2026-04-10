import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useHotel } from '@/contexts/HotelContext';
import { useRoleGuard } from '@/hooks/useRoleGuard';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { formatDateTime } from '@/utils/formatters';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { ScrollText, Search } from 'lucide-react';

const AuditLogPage = () => {
  useRoleGuard(['admin', 'manager']);
  const { hotel } = useHotel();
  const [search, setSearch] = useState('');

  const { data: logs, isLoading } = useQuery({
    queryKey: ['audit-logs', hotel?.id],
    queryFn: async () => {
      const { data } = await supabase.from('audit_logs').select('*').eq('hotel_id', hotel!.id).order('created_at', { ascending: false }).limit(200);
      return data || [];
    },
    enabled: !!hotel?.id,
  });

  const filtered = logs?.filter(l =>
    !search || `${l.action} ${l.user_name} ${l.table_name}`.toLowerCase().includes(search.toLowerCase())
  ) || [];

  return (
    <div className="page-container space-y-6">
      <PageHeader title="Journal d'audit" subtitle={`${filtered.length} entrée(s)`} />

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Rechercher une action..." className="pl-10" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {isLoading ? <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div> : filtered.length === 0 ? (
        <EmptyState icon={ScrollText} title="Aucune entrée" description="Les actions des utilisateurs seront enregistrées ici" />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Utilisateur</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Table</TableHead>
                <TableHead>Détails</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(log => (
                <TableRow key={log.id}>
                  <TableCell className="text-sm">{formatDateTime(log.created_at)}</TableCell>
                  <TableCell className="font-medium">{log.user_name || '-'}</TableCell>
                  <TableCell><Badge variant="outline">{log.action}</Badge></TableCell>
                  <TableCell className="font-mono text-sm">{log.table_name || '-'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                    {log.record_id ? `ID: ${log.record_id.slice(0, 8)}...` : '-'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

export default AuditLogPage;
