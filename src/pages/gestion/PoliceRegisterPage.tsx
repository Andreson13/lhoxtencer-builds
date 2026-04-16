import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRoleGuard } from '@/hooks/useRoleGuard';
import { useHotel } from '@/contexts/HotelContext';
import { useAuth } from '@/contexts/AuthContext';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { fetchPoliceRegisterRows, getCurrentWeekRange } from '@/services/guestDocumentService';
import { generatePoliceRegister } from '@/utils/pdfGenerators';

const PERIODS = ['this-week', 'last-week', 'this-month', 'last-month', 'custom'] as const;
type PeriodMode = (typeof PERIODS)[number];

const toDateKey = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const getPeriodRange = (mode: PeriodMode) => {
  const now = new Date();

  if (mode === 'this-week') return getCurrentWeekRange();

  if (mode === 'last-week') {
    const day = now.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const monday = new Date(now);
    monday.setDate(now.getDate() + mondayOffset - 7);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return { start: toDateKey(monday), end: toDateKey(sunday) };
  }

  if (mode === 'this-month') {
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    return { start: toDateKey(first), end: toDateKey(now) };
  }

  if (mode === 'last-month') {
    const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const last = new Date(now.getFullYear(), now.getMonth(), 0);
    return { start: toDateKey(first), end: toDateKey(last) };
  }

  return getCurrentWeekRange();
};

const labelByMode: Record<PeriodMode, string> = {
  'this-week': 'Cette semaine',
  'last-week': 'Semaine derniere',
  'this-month': 'Ce mois',
  'last-month': 'Mois dernier',
  custom: 'Personnalisee',
};

const PoliceRegisterPage = () => {
  useRoleGuard(['admin', 'manager', 'receptionist']);
  const { hotel } = useHotel();
  const { profile } = useAuth();

  const defaultRange = getCurrentWeekRange();
  const [periodMode, setPeriodMode] = useState<PeriodMode>('this-week');
  const [startDate, setStartDate] = useState(defaultRange.start);
  const [endDate, setEndDate] = useState(defaultRange.end);
  const [refreshIndex, setRefreshIndex] = useState(0);

  const effectiveRange = useMemo(() => {
    if (periodMode === 'custom') {
      return { start: startDate, end: endDate };
    }
    return getPeriodRange(periodMode);
  }, [periodMode, startDate, endDate]);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['police-register', hotel?.id, effectiveRange.start, effectiveRange.end, refreshIndex],
    queryFn: () => fetchPoliceRegisterRows(hotel!.id, effectiveRange.start, effectiveRange.end),
    enabled: !!hotel?.id,
  });

  const handleExport = async (printMode: boolean) => {
    if (!hotel) return;
    try {
      await generatePoliceRegister({
        hotel,
        guests: rows,
        periodStart: effectiveRange.start,
        periodEnd: effectiveRange.end,
        generatedBy: profile?.full_name || 'Reception',
        download: !printMode,
      });
    } catch (error: any) {
      toast.error(error.message || 'Impossible de generer le registre');
    }
  };

  return (
    <div className="page-container space-y-6">
      <PageHeader title="Registre de Police" subtitle="Document officiel - a remettre aux autorites">
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => handleExport(true)} disabled={!rows.length}>Imprimer le registre</Button>
          <Button onClick={() => handleExport(false)} disabled={!rows.length}>Telecharger PDF</Button>
        </div>
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle>Filtres</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {PERIODS.map((mode) => (
              <Button
                key={mode}
                variant={periodMode === mode ? 'default' : 'outline'}
                onClick={() => {
                  setPeriodMode(mode);
                  if (mode !== 'custom') {
                    const range = getPeriodRange(mode);
                    setStartDate(range.start);
                    setEndDate(range.end);
                  }
                }}
              >
                {labelByMode[mode]}
              </Button>
            ))}
          </div>

          {periodMode === 'custom' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-muted-foreground">Date de debut</label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Date de fin</label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <Badge variant="outline">Periode: {effectiveRange.start} au {effectiveRange.end}</Badge>
            <Button variant="secondary" onClick={() => setRefreshIndex((prev) => prev + 1)}>Actualiser</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Apercu avant export ({rows.length} fiche(s))</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, idx) => (
                <Skeleton key={idx} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>N°</TableHead>
                    <TableHead>Nom et Prenoms</TableHead>
                    <TableHead>Date et Lieu de Naissance</TableHead>
                    <TableHead>Nationalite</TableHead>
                    <TableHead>Qualite/Profession</TableHead>
                    <TableHead>N° Chambre</TableHead>
                    <TableHead>Date d'Arrivee</TableHead>
                    <TableHead>Date de Depart</TableHead>
                    <TableHead>N° Piece d'Identite</TableHead>
                    <TableHead>Observations</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row: any, index) => {
                    const guest = row.guest || {};
                    return (
                      <TableRow key={`${row.source}-${row.id}-${index}`}>
                        <TableCell>{String(index + 1).padStart(3, '0')}</TableCell>
                        <TableCell className="font-medium">{guest.last_name} {guest.first_name}</TableCell>
                        <TableCell>{guest.date_of_birth ? new Date(guest.date_of_birth).toLocaleDateString('fr-FR') : '-'} {guest.place_of_birth ? `- ${guest.place_of_birth}` : ''}</TableCell>
                        <TableCell>{guest.nationality || '-'}</TableCell>
                        <TableCell>{guest.profession || '-'}</TableCell>
                        <TableCell>{row.room_number || '-'}</TableCell>
                        <TableCell>{row.check_in_date ? new Date(row.check_in_date).toLocaleDateString('fr-FR') : '-'}</TableCell>
                        <TableCell>{row.check_out_date ? new Date(row.check_out_date).toLocaleDateString('fr-FR') : '-'}</TableCell>
                        <TableCell>{guest.id_number || '-'}</TableCell>
                        <TableCell>{row.observation || '-'}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PoliceRegisterPage;
