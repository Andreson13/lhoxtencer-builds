import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { CalendarDays, Plus, ConciergeBell, FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useBooking, type Booking } from "@/lib/booking-store";
import { formatPrice, useLang } from "@/lib/language";
import { toast } from "sonner";
import { ServiceRequestDialog } from "@/components/service-request-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Mes réservations — Maison Royale" },
      { name: "description", content: "Gérez vos réservations et services." },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const { t, lang } = useLang();
  const { bookings, guestInfo, cancelBooking } = useBooking();
  const today = new Date().toISOString().slice(0, 10);

  const upcoming = bookings.filter(
    (b) => b.status !== "cancelled" && b.status !== "completed" && b.checkOut >= today,
  );
  const past = bookings.filter((b) => b.status === "completed" || b.checkOut < today || b.status === "cancelled");

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">{t("dash.welcome")}</p>
          <h1 className="mt-1 font-display text-3xl font-semibold text-navy sm:text-4xl">
            {guestInfo.fullName}
          </h1>
        </div>
        <Button asChild variant="luxe" size="lg">
          <Link to="/search"><Plus className="h-4 w-4" />{t("dash.new")}</Link>
        </Button>
      </div>

      <Tabs defaultValue="upcoming" className="mt-8">
        <TabsList className="bg-secondary">
          <TabsTrigger value="upcoming">{t("dash.upcoming")} ({upcoming.length})</TabsTrigger>
          <TabsTrigger value="past">{t("dash.past")} ({past.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="upcoming" className="mt-6">
          {upcoming.length === 0 ? (
            <Empty text={t("dash.empty.up")} />
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {upcoming.map((b) => (
                <BookingCard key={b.id} booking={b} onCancel={cancelBooking} />
              ))}
            </div>
          )}
        </TabsContent>
        <TabsContent value="past" className="mt-6">
          {past.length === 0 ? (
            <Empty text={t("dash.empty.past")} />
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {past.map((b) => (
                <BookingCard key={b.id} booking={b} onCancel={cancelBooking} past />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  const { lang } = useLang();
  return (
    <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
      <CalendarDays className="mx-auto h-10 w-10 text-muted-foreground" />
      <p className="mt-3 text-muted-foreground">{text}</p>
      <Button asChild variant="luxe" className="mt-4">
        <Link to="/search">{lang === "fr" ? "Réserver maintenant" : "Book now"}</Link>
      </Button>
    </div>
  );
}

function BookingCard({
  booking,
  onCancel,
  past,
}: {
  booking: Booking;
  onCancel: (id: string) => void;
  past?: boolean;
}) {
  const { t, lang } = useLang();
  const [serviceOpen, setServiceOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  const statusBadge: Record<Booking["status"], { label: { fr: string; en: string }; cls: string }> = {
    confirmed: { label: { fr: "Confirmée", en: "Confirmed" }, cls: "bg-success text-success-foreground" },
    pending: { label: { fr: "En attente", en: "Pending" }, cls: "bg-warning text-warning-foreground" },
    "checked-in": { label: { fr: "Enregistré", en: "Checked-in" }, cls: "bg-navy text-navy-foreground" },
    completed: { label: { fr: "Terminée", en: "Completed" }, cls: "bg-secondary text-secondary-foreground" },
    cancelled: { label: { fr: "Annulée", en: "Cancelled" }, cls: "bg-destructive text-destructive-foreground" },
  };
  const sb = statusBadge[booking.status];

  return (
    <article className={`rounded-xl border border-border bg-card p-5 shadow-card transition-opacity ${past ? "opacity-80" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-xl font-semibold text-navy">Maison Royale</h3>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {t("conf.ref")} · <span className="font-semibold text-navy">{booking.reference}</span>
          </p>
        </div>
        <Badge className={sb.cls}>{sb.label[lang]}</Badge>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <div>
          <div className="text-xs uppercase text-muted-foreground">{t("search.checkin")}</div>
          <div className="mt-0.5 font-display text-lg font-semibold text-navy">{booking.checkIn}</div>
        </div>
        <div>
          <div className="text-xs uppercase text-muted-foreground">{t("search.checkout")}</div>
          <div className="mt-0.5 font-display text-lg font-semibold text-navy">{booking.checkOut}</div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
        <div className="text-sm text-muted-foreground">
          {booking.guests} {lang === "fr" ? "voyageurs" : "guests"}
        </div>
        <div className="font-display text-lg font-bold text-gold">{formatPrice(booking.totals.total, lang)}</div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => toast.info(lang === "fr" ? "Détails à venir" : "Details coming soon")}>
          <FileText className="h-4 w-4" /> {t("dash.viewdetails")}
        </Button>
        {!past && booking.status !== "cancelled" && (
          <>
            <Button variant="outline" size="sm" onClick={() => setServiceOpen(true)}>
              <ConciergeBell className="h-4 w-4" /> {t("dash.services")}
            </Button>
            <Button variant="navy" size="sm" onClick={() => toast.info(lang === "fr" ? "Modification bientôt disponible" : "Modify coming soon")}>
              {t("dash.modify")}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setCancelOpen(true)} className="text-destructive hover:text-destructive">
              <X className="h-4 w-4" /> {t("dash.cancel")}
            </Button>
          </>
        )}
      </div>

      <ServiceRequestDialog open={serviceOpen} onOpenChange={setServiceOpen} reference={booking.reference} />

      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {lang === "fr" ? "Annuler cette réservation ?" : "Cancel this booking?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {lang === "fr"
                ? "Cette action est définitive. Vous serez remboursé selon notre politique d'annulation."
                : "This action is final. You'll be refunded per our cancellation policy."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                onCancel(booking.id);
                toast.success(lang === "fr" ? "Réservation annulée" : "Booking cancelled");
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("common.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </article>
  );
}