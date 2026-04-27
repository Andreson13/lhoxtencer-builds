import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useI18n } from '@/contexts/I18nContext';
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
  const { t } = useI18n();
  useRoleGuard(['admin', 'manager']);
  const { hotel } = useHotel();
  const [search, setSearch] = useState('');

  const { data: logs, isLoading } = useQuery({
    queryKey: ['audit-logs', hotel?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('audit_logs')
        .select('*, profiles!audit_logs_user_id_fkey(full_name, email)')
        .eq('hotel_id', hotel!.id)
        .order('created_at', { ascending: false })
        .limit(200);
      return data || [];
    },
    enabled: !!hotel?.id,
  });

  const filtered = logs?.filter((log: any) =>
    !search || `${log.action} ${log.user_name || ''} ${log.profiles?.full_name || ''} ${log.profiles?.email || ''} ${log.table_name}`.toLowerCase().includes(search.toLowerCase())
  ) || [];

  return (
    <div className="page-container space-y-6">
      <PageHeader title={t('audit.title')} subtitle={`${filtered.length} entrée(s)`} />

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder={t('audit.search')} className="pl-10" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {isLoading ? <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div> : filtered.length === 0 ? (
        <EmptyState icon={ScrollText} title={t('audit.empty.title')} description={t('audit.empty.description')} />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('audit.table.date')}</TableHead>
                <TableHead>{t('audit.table.user')}</TableHead>
                <TableHead>{t('audit.table.action')}</TableHead>
                <TableHead>{t('audit.table.table')}</TableHead>
                <TableHead>{t('audit.table.details')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((log: any) => (
                <TableRow key={log.id}>
                  <TableCell className="text-sm">{formatDateTime(log.created_at)}</TableCell>
                  <TableCell className="font-medium">{log.user_name || log.profiles?.full_name || log.profiles?.email || (log.user_id ? `#${String(log.user_id).slice(0, 8)}` : '-')}</TableCell>
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
