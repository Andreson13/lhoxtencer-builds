import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useHotel } from '@/contexts/HotelContext';
import { useRoleGuard } from '@/hooks/useRoleGuard';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { exportAllToExcel, exportToExcel, exportToCSV } from '@/utils/exportUtils';
import { Download, FileSpreadsheet, FileText } from 'lucide-react';
import { toast } from 'sonner';

const ExportPage = () => {
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
    { key: 'guests', label: 'Clients', description: 'Fiche client complète avec coordonnées et niveau fidélité', table: 'guests', select: 'id,last_name,first_name,phone,email,nationality,id_number,id_type,tier,loyalty_points,created_at' },
    { key: 'stays', label: 'Séjours', description: 'Tous les séjours (check-in/check-out, chambres, tarifs)', table: 'stays', dateField: 'check_in_date' },
    { key: 'reservations', label: 'Réservations', description: 'Réservations avec statut et dates', table: 'reservations', dateField: 'created_at' },
    { key: 'siestes', label: 'Siestes', description: 'Séjours de repos de journée', table: 'siestes', dateField: 'start_time' },
    { key: 'invoices', label: 'Factures', description: 'Toutes les factures avec totaux et statuts', table: 'invoices', dateField: 'created_at' },
    { key: 'payments', label: 'Paiements', description: 'Historique de tous les paiements reçus', table: 'payments', dateField: 'created_at' },
    { key: 'expenses', label: 'Dépenses', description: 'Frais et dépenses de l\'hôtel', table: 'expenses', dateField: 'expense_date' },
    { key: 'restaurant_orders', label: 'Commandes restaurant', description: 'Commandes passées au restaurant', table: 'restaurant_orders', dateField: 'created_at' },
    { key: 'main_courante', label: 'Main courante', description: 'Journal comptable journalier', table: 'main_courante', dateField: 'journee' },
    { key: 'feedback', label: 'Avis clients', description: 'Commentaires et notes des clients', table: 'guest_feedback', dateField: 'created_at' },
    { key: 'audit_logs', label: 'Journaux d\'audit', description: 'Historique des actions du personnel', table: 'audit_logs', dateField: 'created_at' },
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

  const handleExport = async (ds: typeof datasets[0], format: 'excel' | 'csv') => {
    if (!hotel?.id) return;
    try {
      let query = supabase.from(ds.table as any).select(ds.select || '*').eq('hotel_id', hotel.id);
      if (ds.dateField) {
        query = (query as any).gte(ds.dateField, dateFrom).lte(ds.dateField, dateTo);
      }
      const { data, error } = await query;
      if (error) throw error;
      if (!data?.length) { toast.info('Aucune donnée pour cette période'); return; }
      const filename = `${ds.key}-${dateFrom}-${dateTo}`;
      if (format === 'excel') exportToExcel(data, filename, ds.label);
      else exportToCSV(data, filename);
      toast.success(`Export ${format.toUpperCase()} prêt — ${data.length} enregistrements`);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleExportAll = async () => {
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
        sheets.push({ sheetName: ds.label, data: data || [] });
      }

      await exportAllToExcel(sheets, `hotel-data-complet-${dateFrom}-${dateTo}`);
      const totalRows = sheets.reduce((sum, sheet) => sum + (sheet.data?.length || 0), 0);
      toast.success(`Export global prêt — ${totalRows} enregistrements`);
    } catch (e: any) {
      toast.error(e.message || 'Erreur export global');
    }
  };

  return (
    <div className="page-container space-y-6">
      <PageHeader title="Exporter les données" subtitle="Téléchargez vos données en format Excel ou CSV" />

      <Card>
        <CardHeader><CardTitle>Période d'export</CardTitle></CardHeader>
        <CardContent className="flex gap-4 items-end">
          <div><Label>Du</Label><Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} /></div>
          <div><Label>Au</Label><Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} /></div>
          <Button onClick={handleExportAll}>
            <Download className="h-4 w-4 mr-2" />Tout exporter (Excel)
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
            <CardContent className="flex gap-2">
              <Button size="sm" variant="outline" className="flex-1" onClick={() => handleExport(ds, 'excel')}>
                <FileSpreadsheet className="h-4 w-4 mr-1" />Excel
              </Button>
              <Button size="sm" variant="outline" className="flex-1" onClick={() => handleExport(ds, 'csv')}>
                <FileText className="h-4 w-4 mr-1" />CSV
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default ExportPage;
