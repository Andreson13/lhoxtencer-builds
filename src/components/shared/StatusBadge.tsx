import React from 'react';
import { Badge } from '@/components/ui/badge';

const statusColors: Record<string, string> = {
  available: 'bg-success text-success-foreground',
  occupied: 'bg-destructive text-destructive-foreground',
  housekeeping: 'bg-warning text-warning-foreground',
  maintenance: 'bg-info text-info-foreground',
  out_of_order: 'bg-muted text-muted-foreground',
  present: 'bg-success text-success-foreground',
  checked_out: 'bg-muted text-muted-foreground',
  reserved: 'bg-info text-info-foreground',
  no_show: 'bg-destructive text-destructive-foreground',
  pending: 'bg-warning text-warning-foreground',
  confirmed: 'bg-success text-success-foreground',
  checked_in: 'bg-success text-success-foreground',
  cancelled: 'bg-destructive text-destructive-foreground',
  open: 'bg-success text-success-foreground',
  paid: 'bg-success text-success-foreground',
  partial: 'bg-warning text-warning-foreground',
  split: 'bg-info text-info-foreground',
  in_preparation: 'bg-warning text-warning-foreground',
  ready: 'bg-success text-success-foreground',
  delivered: 'bg-info text-info-foreground',
  billed: 'bg-muted text-muted-foreground',
  pending_approval: 'bg-warning text-warning-foreground',
  approved: 'bg-success text-success-foreground',
  rejected: 'bg-destructive text-destructive-foreground',
  in_progress: 'bg-warning text-warning-foreground',
  inspection: 'bg-info text-info-foreground',
  clean: 'bg-success text-success-foreground',
  active: 'bg-success text-success-foreground',
  trial: 'bg-warning text-warning-foreground',
  suspended: 'bg-destructive text-destructive-foreground',
  closed: 'bg-muted text-muted-foreground',
  completed: 'bg-success text-success-foreground',
};

const statusLabels: Record<string, string> = {
  available: 'Disponible',
  occupied: 'Occupée',
  housekeeping: 'Nettoyage',
  maintenance: 'Maintenance',
  out_of_order: 'Hors service',
  present: 'Présent',
  checked_out: 'Parti',
  reserved: 'Réservé',
  no_show: 'No show',
  pending: 'En attente',
  confirmed: 'Confirmée',
  checked_in: 'Checked-in',
  cancelled: 'Annulée',
  open: 'Ouvert',
  paid: 'Payée',
  partial: 'Partielle',
  split: 'Scindée',
  in_preparation: 'En préparation',
  ready: 'Prêt',
  delivered: 'Livré',
  billed: 'Facturé',
  pending_approval: 'En attente',
  approved: 'Approuvée',
  rejected: 'Rejetée',
  in_progress: 'En cours',
  inspection: 'Inspection',
  clean: 'Propre',
  active: 'Actif',
  trial: 'Essai',
  suspended: 'Suspendu',
  closed: 'Fermé',
  completed: 'Terminé',
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export const StatusBadge = ({ status, className }: StatusBadgeProps) => {
  return (
    <Badge className={`${statusColors[status] || 'bg-muted text-muted-foreground'} ${className || ''}`}>
      {statusLabels[status] || status}
    </Badge>
  );
};
