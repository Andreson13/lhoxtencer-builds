import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type Lang = "fr" | "en";

type Dict = Record<string, { fr: string; en: string }>;

const dict: Dict = {
  // Nav
  "nav.home": { fr: "Accueil", en: "Home" },
  "nav.search": { fr: "Réserver", en: "Book" },
  "nav.dashboard": { fr: "Mes réservations", en: "My bookings" },
  "nav.signin": { fr: "Connexion", en: "Sign in" },
  "nav.signout": { fr: "Déconnexion", en: "Sign out" },
  "nav.profile": { fr: "Mon profil", en: "My profile" },

  // Hero
  "hero.eyebrow": { fr: "Hospitalité d'exception", en: "Exceptional hospitality" },
  "hero.title": { fr: "Un séjour digne d'une maison royale", en: "A stay worthy of royalty" },
  "hero.subtitle": {
    fr: "Réservez votre suite, personnalisez votre séjour et laissez notre conciergerie s'occuper du reste.",
    en: "Reserve your suite, tailor your stay, and let our concierge take care of the rest.",
  },

  // Search
  "search.checkin": { fr: "Arrivée", en: "Check-in" },
  "search.checkout": { fr: "Départ", en: "Check-out" },
  "search.guests": { fr: "Voyageurs", en: "Guests" },
  "search.roomtype": { fr: "Type de chambre", en: "Room type" },
  "search.cta": { fr: "Rechercher", en: "Search rooms" },
  "search.all": { fr: "Toutes", en: "All" },

  // Rooms
  "room.pernight": { fr: "/ nuit", en: "/ night" },
  "room.capacity": { fr: "voyageurs", en: "guests" },
  "room.details": { fr: "Détails", en: "View details" },
  "room.select": { fr: "Réserver", en: "Select room" },
  "room.results": { fr: "Chambres disponibles", en: "Available rooms" },
  "room.empty": { fr: "Aucune chambre disponible pour ces dates.", en: "No rooms available for these dates." },

  // Cart
  "cart.title": { fr: "Votre réservation", en: "Your booking" },
  "cart.empty": { fr: "Votre panier est vide.", en: "Your cart is empty." },
  "cart.addons": { fr: "Services additionnels", en: "Add-on services" },
  "cart.specialreq": { fr: "Demandes spéciales", en: "Special requests" },
  "cart.specialreq.placeholder": {
    fr: "Ex : Suite lune de miel, étage élevé, chambre calme…",
    en: "E.g. Honeymoon suite, high floor, quiet room…",
  },
  "cart.guestinfo": { fr: "Informations voyageur", en: "Guest information" },
  "cart.subtotal": { fr: "Sous-total", en: "Subtotal" },
  "cart.taxes": { fr: "Taxes & frais", en: "Taxes & fees" },
  "cart.total": { fr: "Total", en: "Total" },
  "cart.proceed": { fr: "Confirmer la réservation", en: "Confirm booking" },
  "cart.back": { fr: "Modifier", en: "Edit" },
  "cart.policy": {
    fr: "Annulation gratuite jusqu'à 48h avant l'arrivée. J'accepte la politique d'annulation.",
    en: "Free cancellation up to 48h before check-in. I accept the cancellation policy.",
  },

  // Confirmation
  "conf.title": { fr: "Réservation confirmée", en: "Booking confirmed" },
  "conf.subtitle": {
    fr: "Un email de confirmation vous a été envoyé.",
    en: "A confirmation email has been sent to you.",
  },
  "conf.ref": { fr: "Référence", en: "Reference" },
  "conf.download": { fr: "Télécharger le reçu", en: "Download receipt" },
  "conf.dashboard": { fr: "Voir mes réservations", en: "View my bookings" },

  // Dashboard
  "dash.welcome": { fr: "Bon retour", en: "Welcome back" },
  "dash.upcoming": { fr: "À venir", en: "Upcoming" },
  "dash.past": { fr: "Passées", en: "Past" },
  "dash.new": { fr: "Nouvelle réservation", en: "New booking" },
  "dash.modify": { fr: "Modifier", en: "Modify" },
  "dash.cancel": { fr: "Annuler", en: "Cancel" },
  "dash.services": { fr: "Demander un service", en: "Request services" },
  "dash.viewdetails": { fr: "Détails", en: "Details" },
  "dash.empty.up": { fr: "Aucune réservation à venir.", en: "No upcoming reservations." },
  "dash.empty.past": { fr: "Aucun séjour passé.", en: "No past stays yet." },

  // Auth
  "auth.signin": { fr: "Se connecter", en: "Sign in" },
  "auth.email": { fr: "Email", en: "Email" },
  "auth.password": { fr: "Mot de passe", en: "Password" },
  "auth.remember": { fr: "Se souvenir de moi", en: "Remember me" },
  "auth.forgot": { fr: "Mot de passe oublié ?", en: "Forgot password?" },
  "auth.create": { fr: "Nouveau client ? Créer un compte", en: "New guest? Create an account" },
  "auth.welcome": { fr: "Bienvenue", en: "Welcome" },

  // Common
  "common.cancel": { fr: "Annuler", en: "Cancel" },
  "common.confirm": { fr: "Confirmer", en: "Confirm" },
  "common.close": { fr: "Fermer", en: "Close" },
  "common.save": { fr: "Enregistrer", en: "Save" },
  "common.nights": { fr: "nuits", en: "nights" },
  "common.night": { fr: "nuit", en: "night" },
};

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
};

const LanguageContext = createContext<Ctx | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>("fr");
  const value = useMemo<Ctx>(
    () => ({
      lang,
      setLang,
      t: (key: string) => dict[key]?.[lang] ?? key,
    }),
    [lang],
  );
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLang() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLang must be used inside LanguageProvider");
  return ctx;
}

export function formatPrice(value: number, lang: Lang) {
  const formatter = new Intl.NumberFormat(lang === "fr" ? "fr-FR" : "en-US", {
    maximumFractionDigits: 0,
  });
  return `${formatter.format(value)} FCFA`;
}