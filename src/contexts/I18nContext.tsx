import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

type Lang = 'fr' | 'en';

const translations: Record<string, Record<Lang, string>> = {
  // Navigation
  'nav.dashboard': { fr: 'Tableau de bord', en: 'Dashboard' },
  'nav.guests': { fr: 'Clients', en: 'Guests' },
  'nav.reservations': { fr: 'Réservations', en: 'Reservations' },
  'nav.rooms': { fr: 'Chambres', en: 'Rooms' },
  'nav.checkinout': { fr: 'Check-in / Check-out', en: 'Check-in / Check-out' },
  'nav.siestes': { fr: 'Siestes', en: 'Day Stays' },
  'nav.maincourante': { fr: 'Main Courante', en: 'Daily Log' },
  'nav.restaurant': { fr: 'Restaurant', en: 'Restaurant' },
  'nav.kitchen': { fr: 'Cuisine', en: 'Kitchen' },
  'nav.inventory': { fr: 'Stock', en: 'Inventory' },
  'nav.billing': { fr: 'Facturation', en: 'Billing' },
  'nav.debts': { fr: 'Créances', en: 'Debts' },
  'nav.cashexpenses': { fr: 'Caisse & Dépenses', en: 'Cash & Expenses' },
  'nav.housekeeping': { fr: 'Housekeeping', en: 'Housekeeping' },
  'nav.reports': { fr: 'Rapports', en: 'Reports' },
  'nav.feedback': { fr: 'Avis clients', en: 'Feedback' },
  'nav.qrcodes': { fr: 'QR Codes', en: 'QR Codes' },
  'nav.settings': { fr: 'Paramètres', en: 'Settings' },
  'nav.audit': { fr: 'Journal d\'audit', en: 'Audit Log' },
  'nav.categories': { fr: 'Catégories', en: 'Categories' },
  // Common
  'common.add': { fr: 'Ajouter', en: 'Add' },
  'common.edit': { fr: 'Modifier', en: 'Edit' },
  'common.delete': { fr: 'Supprimer', en: 'Delete' },
  'common.cancel': { fr: 'Annuler', en: 'Cancel' },
  'common.save': { fr: 'Enregistrer', en: 'Save' },
  'common.search': { fr: 'Rechercher...', en: 'Search...' },
  'common.actions': { fr: 'Actions', en: 'Actions' },
  'common.status': { fr: 'Statut', en: 'Status' },
  'common.confirm': { fr: 'Confirmer', en: 'Confirm' },
  'common.loading': { fr: 'Chargement...', en: 'Loading...' },
  'common.nodata': { fr: 'Aucune donnée', en: 'No data' },
  'common.export': { fr: 'Exporter', en: 'Export' },
  'common.print': { fr: 'Imprimer', en: 'Print' },
  'common.close': { fr: 'Fermer', en: 'Close' },
  'common.yes': { fr: 'Oui', en: 'Yes' },
  'common.no': { fr: 'Non', en: 'No' },
  'common.back': { fr: 'Retour', en: 'Back' },
  'common.next': { fr: 'Suivant', en: 'Next' },
  'common.previous': { fr: 'Précédent', en: 'Previous' },
  'common.details': { fr: 'Détails', en: 'Details' },
  'common.total': { fr: 'Total', en: 'Total' },
  // Auth
  'auth.login': { fr: 'Se connecter', en: 'Sign in' },
  'auth.email': { fr: 'Email', en: 'Email' },
  'auth.password': { fr: 'Mot de passe', en: 'Password' },
  'auth.logout': { fr: 'Se déconnecter', en: 'Sign out' },
  // Delete confirm
  'delete.title': { fr: 'Êtes-vous sûr ?', en: 'Are you sure?' },
  'delete.warning': { fr: 'Cette action est irréversible.', en: 'This action cannot be undone.' },
  // Statuses
  'status.available': { fr: 'Disponible', en: 'Available' },
  'status.occupied': { fr: 'Occupée', en: 'Occupied' },
  'status.housekeeping': { fr: 'Nettoyage', en: 'Housekeeping' },
  'status.maintenance': { fr: 'Maintenance', en: 'Maintenance' },
  'status.out_of_order': { fr: 'Hors service', en: 'Out of order' },
  'status.present': { fr: 'Présent', en: 'Present' },
  'status.checked_out': { fr: 'Parti', en: 'Checked out' },
  'status.reserved': { fr: 'Réservé', en: 'Reserved' },
  'status.pending': { fr: 'En attente', en: 'Pending' },
  'status.confirmed': { fr: 'Confirmée', en: 'Confirmed' },
  'status.cancelled': { fr: 'Annulée', en: 'Cancelled' },
  'status.open': { fr: 'Ouvert', en: 'Open' },
  'status.paid': { fr: 'Payée', en: 'Paid' },
  'status.partial': { fr: 'Partielle', en: 'Partial' },
  // Receptionist
  'receptionist.label': { fr: 'Réceptionniste', en: 'Receptionist' },
  // Onboarding
  'onboarding.welcome': { fr: 'Bienvenue sur HôtelManager Pro', en: 'Welcome to HôtelManager Pro' },
  'onboarding.step1': { fr: 'Créez votre hôtel', en: 'Create your hotel' },
  'onboarding.step2': { fr: 'Ajoutez une chambre', en: 'Add a room' },
  'onboarding.done': { fr: 'Vous êtes prêt !', en: "You're all set!" },
};

interface I18nContextType {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextType>({
  lang: 'fr',
  setLang: () => {},
  t: (key) => key,
});

export const I18nProvider = ({ children }: { children: ReactNode }) => {
  const [lang, setLang] = useState<Lang>('fr');
  const t = useCallback(
    (key: string) => translations[key]?.[lang] || key,
    [lang]
  );
  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useI18n = () => useContext(I18nContext);
