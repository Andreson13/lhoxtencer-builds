import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Copy, Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBooking } from "@/lib/booking-store";
import { formatPrice, useLang } from "@/lib/language";
import { toast } from "sonner";

export const Route = createFileRoute("/confirmation")({
  head: () => ({
    meta: [
      { title: "Réservation confirmée — Maison Royale" },
      { name: "description", content: "Votre réservation a été confirmée." },
    ],
  }),
  component: ConfirmationPage,
});

function ConfirmationPage() {
  const { lastBooking } = useBooking();
  const { t, lang } = useLang();

  if (!lastBooking) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <h1 className="font-display text-2xl font-semibold text-navy">
          {lang === "fr" ? "Aucune réservation récente." : "No recent booking."}
        </h1>
        <Button asChild variant="luxe" className="mt-6">
          <Link to="/search">{t("nav.search")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-luxe sm:p-12">
        <div className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full bg-success/15 text-success">
          <Check className="h-8 w-8" />
        </div>
        <h1 className="mt-5 font-display text-3xl font-semibold text-navy sm:text-4xl">{t("conf.title")}</h1>
        <p className="mt-2 text-muted-foreground">{t("conf.subtitle")}</p>

        <div className="mt-8 rounded-xl border border-dashed border-gold/50 bg-gold-soft/40 p-6">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-navy/70">{t("conf.ref")}</div>
          <div className="mt-2 flex items-center justify-center gap-3">
            <span className="font-display text-3xl font-bold tracking-wider text-navy sm:text-4xl">
              {lastBooking.reference}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                navigator.clipboard.writeText(lastBooking.reference);
                toast.success(lang === "fr" ? "Copié" : "Copied");
              }}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <dl className="mt-8 grid gap-3 text-left sm:grid-cols-2">
          <Info label={t("search.checkin")} value={lastBooking.checkIn} />
          <Info label={t("search.checkout")} value={lastBooking.checkOut} />
          <Info label={t("search.guests")} value={String(lastBooking.guests)} />
          <Info
            label={lang === "fr" ? "Chambres" : "Rooms"}
            value={lastBooking.rooms.map((r) => r.name[lang]).join(", ")}
          />
          <Info
            label={t("cart.total")}
            value={formatPrice(lastBooking.totals.total, lang)}
            highlight
          />
        </dl>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button variant="luxe" onClick={() => toast.info(lang === "fr" ? "Génération du reçu…" : "Generating receipt…")}>
            <Download className="h-4 w-4" />
            {t("conf.download")}
          </Button>
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="h-4 w-4" />
            {lang === "fr" ? "Imprimer" : "Print"}
          </Button>
          <Button asChild variant="navy">
            <Link to="/dashboard">{t("conf.dashboard")}</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-secondary/40 p-3">
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className={`mt-1 ${highlight ? "font-display text-lg font-bold text-gold" : "font-medium text-foreground"}`}>
        {value}
      </dd>
    </div>
  );
}