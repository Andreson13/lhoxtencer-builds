import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useI18n } from '@/contexts/I18nContext';
import { useHotel } from '@/contexts/HotelContext';
import { useRoleGuard } from '@/hooks/useRoleGuard';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { exportAllToExcel, exportToExcel, exportToCSV } from '@/utils/exportUtils';
import { generateClientDossierPDF } from '@/utils/pdfGenerator';
import { Download, FileSpreadsheet, FileText, FileJson } from 'lucide-react';
import { toast } from 'sonner';

const ExportPage = () => {
  const { t } = useI18n();
  useRoleGuard(['admin', 'manager']);
  const { hotel } = useHotel();
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));

  const datasets: Array<{
    key: string;
    label: string;
    description: string;
    table: string;
    dateField?: string;
    select?: string;
  }> = [
    { key: 'guests', label: t('export.datasets.guests.label'), description: t('export.datasets.guests.description'), table: 'guests', select: 'id,last_name,first_name,phone,email,nationality,id_number,id_type,tier,loyalty_points,created_at' },
    { key: 'stays', label: t('export.datasets.stays.label'), description: t('export.datasets.stays.description'), table: 'stays', dateField: 'check_in_date' },
    { key: 'reservations', label: t('export.datasets.reservations.label'), description: t('export.datasets.reservations.description'), table: 'reservations', dateField: 'created_at' },
    { key: 'siestes', label: t('export.datasets.siestes.label'), description: t('export.datasets.siestes.description'), table: 'siestes', dateField: 'arrival_date' },
    { key: 'invoices', label: t('export.datasets.invoices.label'), description: t('export.datasets.invoices.description'), table: 'invoices', dateField: 'created_at' },
    { key: 'payments', label: t('export.datasets.payments.label'), description: t('export.datasets.payments.description'), table: 'payments', dateField: 'created_at' },
    { key: 'expenses', label: t('export.datasets.expenses.label'), description: t('export.datasets.expenses.description'), table: 'expenses', dateField: 'expense_date' },
    { key: 'restaurant_orders', label: t('export.datasets.restaurantOrders.label'), description: t('export.datasets.restaurantOrders.description'), table: 'restaurant_orders', dateField: 'created_at' },
    { key: 'main_courante', label: t('export.datasets.mainCourante.label'), description: t('export.datasets.mainCourante.description'), table: 'main_courante', dateField: 'journee' },
    { key: 'feedback', label: t('export.datasets.feedback.label'), description: t('export.datasets.feedback.description'), table: 'guest_feedback', dateField: 'created_at' },
    { key: 'audit_logs', label: t('export.datasets.auditLogs.label'), description: t('export.datasets.auditLogs.description'), table: 'audit_logs', dateField: 'created_at' },
  ];

  const { data: counts } = useQuery({
    queryKey: ['export-counts', hotel?.id],
    queryFn: async () => {
      if (!hotel?.id) return {};
      const results: Record<string, number> = {};
      for (const ds of datasets) {
        const { count } = await supabase.from(ds.table as any)
          .select('*', { count: 'exact', head: true })
          .eq('hotel_id', hotel.id);
        results[ds.key] = count || 0;
      }
      return results;
    },
    enabled: !!hotel?.id,
  });

  // Format currency with proper FCFA formatting (commas instead of slashes)
  const formatCurrency = (value: number | string): string => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return String(value);
    return new Intl.NumberFormat('fr-FR', {
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num).replace(/\s/g, ' '); // Ensures space separator for thousands
  };

  const handleExport = async (ds: typeof datasets[0], format: 'excel' | 'csv' | 'pdf') => {
    if (!hotel?.id) return;
    try {
      let query = supabase.from(ds.table as any).select(ds.select || '*').eq('hotel_id', hotel.id);
      if (ds.dateField) {
        query = (query as any).gte(ds.dateField, dateFrom).lte(ds.dateField, dateTo);
      }
      const { data, error } = await query;
      if (error) throw error;
      if (!data?.length) { toast.info(t('export.noData')); return; }
      
      const filename = `${ds.key}-${dateFrom}-${dateTo}`;
      
      if (format === 'pdf') {
        // Format data with proper currency formatting for PDF
        const formattedData = data.map((row: any) => {
          const formatted: any = { ...row };
          Object.keys(formatted).forEach(key => {
            // Check if field looks like currency
            if (typeof formatted[key] === 'number' && 
                (key.includes('amount') || key.includes('total') || key.includes('price') || key.includes('cost'))) {
              formatted[key] = formatCurrency(formatted[key]);
            }
          });
          return formatted;
        });
        
        await generateClientDossierPDF(formattedData, filename, ds.label);
        toast.success(`${t('export.pdf')} — ${data.length} ${t('export.records')}`);
      } else if (format === 'excel') {
        exportToExcel(data, filename, ds.label);
        toast.success(`${t('export.excel')} — ${data.length} ${t('export.records')}`);
      } else {
        exportToCSV(data, filename);
        toast.success(`${t('export.csv')} — ${data.length} ${t('export.records')}`);
      }
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleExportAll = async (format: 'excel' | 'pdf' = 'excel') => {
    if (!hotel?.id) return;
    try {
      const sheets: Array<{ sheetName: string; data: any[] }> = [];

      for (const ds of datasets) {
        let query = supabase.from(ds.table as any).select(ds.select || '*').eq('hotel_id', hotel.id);
        if (ds.dateField) {
          query = (query as any).gte(ds.dateField, dateFrom).lte(ds.dateField, dateTo);
        }
        const { data, error } = await query;
        if (error) throw error;
        
        // Format currency in data
        const formattedData = (data || []).map((row: any) => {
          const formatted: any = { ...row };
          Object.keys(formatted).forEach(key => {
            if (typeof formatted[key] === 'number' && 
                (key.includes('amount') || key.includes('total') || key.includes('price') || key.includes('cost'))) {
              formatted[key] = formatCurrency(formatted[key]);
            }
          });
          return formatted;
        });
        
        sheets.push({ sheetName: ds.label, data: formattedData });
      }

      if (format === 'pdf') {
        await generateClientDossierPDF(sheets, `hotel-data-complet-${dateFrom}-${dateTo}`, 'All Data');
        const totalRows = sheets.reduce((sum, sheet) => sum + (sheet.data?.length || 0), 0);
        toast.success(`${t('export.exportAll')} — ${totalRows} ${t('export.records')}`);
      } else {
        await exportAllToExcel(sheets, `hotel-data-complet-${dateFrom}-${dateTo}`);
        const totalRows = sheets.reduce((sum, sheet) => sum + (sheet.data?.length || 0), 0);
        toast.success(`${t('export.exportAll')} — ${totalRows} ${t('export.records')}`);
      }
    } catch (e: any) {
      toast.error(e.message || t('export.error'));
    }
  };

  return (
    <div className="page-container space-y-6">
      <PageHeader title={t('export.title')} subtitle={t('export.subtitle')} />

      <Card>
        <CardHeader><CardTitle>{t('export.period')}</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-4 items-end">
          <div><Label>{t('export.from')}</Label><Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} /></div>
          <div><Label>{t('export.to')}</Label><Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} /></div>
          <Button onClick={() => handleExportAll('excel')}>
            <Download className="h-4 w-4 mr-2" />{t('export.exportAll')} (Excel)
          </Button>
          <Button onClick={() => handleExportAll('pdf')} variant="outline">
            <FileJson className="h-4 w-4 mr-2" />{t('export.exportAll')} (PDF)
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {datasets.map(ds => (
          <Card key={ds.key} className="border-border/60 shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{ds.label}</CardTitle>
                <span className="text-2xl font-bold text-primary">{counts?.[ds.key] ?? '—'}</span>
              </div>
              <p className="text-xs text-muted-foreground">{ds.description}</p>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="flex-1" onClick={() => handleExport(ds, 'excel')}>
                  <FileSpreadsheet className="h-4 w-4 mr-1" />Excel
                </Button>
                <Button size="sm" variant="outline" className="flex-1" onClick={() => handleExport(ds, 'csv')}>
                  <FileText className="h-4 w-4 mr-1" />CSV
                </Button>
              </div>
              <Button size="sm" variant="outline" className="w-full" onClick={() => handleExport(ds, 'pdf')}>
                <Download className="h-4 w-4 mr-1" />PDF Dossier
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default ExportPage;