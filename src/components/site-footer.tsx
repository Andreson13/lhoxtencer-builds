import { Crown, Mail, MapPin, Phone } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-border bg-navy text-navy-foreground">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-4 lg:px-8">
        <div className="md:col-span-2">
          <div className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-gold" />
            <span className="font-display text-xl font-semibold">
              Maison <span className="text-gold">Royale</span>
            </span>
          </div>
          <p className="mt-3 max-w-md text-sm text-navy-foreground/70">
            Une expérience hôtelière d'exception, propulsée par HôtelManager Pro.
            Réservez en quelques clics, vivez l'inoubliable.
          </p>
        </div>
        <div>
          <h4 className="mb-3 font-display text-base text-gold">Contact</h4>
          <ul className="space-y-2 text-sm text-navy-foreground/80">
            <li className="flex items-center gap-2"><Phone className="h-4 w-4 text-gold" /> +221 33 800 00 00</li>
            <li className="flex items-center gap-2"><Mail className="h-4 w-4 text-gold" /> reservations@maisonroyale.com</li>
            <li className="flex items-center gap-2"><MapPin className="h-4 w-4 text-gold" /> Corniche Ouest, Dakar</li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 font-display text-base text-gold">Maison Royale</h4>
          <ul className="space-y-2 text-sm text-navy-foreground/80">
            <li>À propos</li>
            <li>Conditions générales</li>
            <li>Politique de confidentialité</li>
            <li>Conciergerie</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-navy-foreground/10 py-4 text-center text-xs text-navy-foreground/60">
        © {new Date().getFullYear()} Maison Royale · Powered by HôtelManager Pro
      </div>
    </footer>
  );
}