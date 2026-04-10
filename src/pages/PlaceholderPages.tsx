import React from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { useRoleGuard } from '@/hooks/useRoleGuard';

const PlaceholderPage = ({ title, roles }: { title: string; roles: string[] }) => {
  useRoleGuard(roles);
  return (
    <div className="page-container">
      <PageHeader title={title} subtitle="Page en cours de développement" />
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <p>Cette section sera bientôt disponible.</p>
      </div>
    </div>
  );
};

export const GuestsPage = () => <PlaceholderPage title="Clients" roles={['admin','manager','receptionist']} />;
export const ReservationsPage = () => <PlaceholderPage title="Réservations" roles={['admin','manager','receptionist']} />;
export const CheckInOutPage = () => <PlaceholderPage title="Check-in / Check-out" roles={['admin','manager','receptionist']} />;
export const SiestesPage = () => <PlaceholderPage title="Siestes" roles={['admin','manager','receptionist']} />;
export const MainCourantePage = () => <PlaceholderPage title="Main Courante" roles={['admin','manager','receptionist']} />;
export const RestaurantPage = () => <PlaceholderPage title="Restaurant" roles={['admin','manager','receptionist','restaurant']} />;
export const KitchenDisplayPage = () => <PlaceholderPage title="Cuisine" roles={['admin','manager','kitchen']} />;
export const InventoryPage = () => <PlaceholderPage title="Stock" roles={['admin','manager','receptionist']} />;
export const BillingPage = () => <PlaceholderPage title="Facturation" roles={['admin','manager','receptionist','accountant']} />;
export const CashExpensesPage = () => <PlaceholderPage title="Caisse & Dépenses" roles={['admin','manager','receptionist','accountant']} />;
export const HousekeepingPage = () => <PlaceholderPage title="Housekeeping" roles={['admin','manager','housekeeping']} />;
export const ReportsPage = () => <PlaceholderPage title="Rapports" roles={['admin','manager','accountant']} />;
export const FeedbackPage = () => <PlaceholderPage title="Avis clients" roles={['admin','manager']} />;
export const QRCodesPage = () => <PlaceholderPage title="QR Codes" roles={['admin','manager']} />;
export const SettingsPage = () => <PlaceholderPage title="Paramètres" roles={['admin','manager']} />;
export const AuditLogPage = () => <PlaceholderPage title="Journal d'audit" roles={['admin','manager']} />;
