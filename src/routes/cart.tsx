import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ShoppingBag, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  ADDON_PRICES,
  computeTotals,
  generateReference,
  nightsBetween,
  useBooking,
} from "@/lib/booking-store";
import { formatPrice, useLang } from "@/lib/language";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/cart")({
  head: () => ({
    meta: [
      { title: "Votre réservation — Maison Royale" },
      { name: "description", content: "Finalisez votre réservation à Maison Royale." },
    ],
  }),
  component: CartPage,
});

function CartPage() {
  const { t, lang } = useLang();
  const {
    cart,
    removeRoom,
    addOns,
    setAddOns,
    specialRequests,
    setSpecialRequests,
    guestInfo,
    setGuestInfo,
    search,
    addBooking,
    setLastBooking,
    clearCart,
  } = useBooking();
  const [accepted, setAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const totals = computeTotals(cart, addOns, search.checkIn, search.checkOut);
  const nights = nightsBetween(search.checkIn, search.checkOut) || 1;

  const confirm = () => {
    if (cart.length === 0) {
      toast.error(lang === "fr" ? "Votre panier est vide." : "Your cart is empty.");
      return;
    }
    if (!guestInfo.fullName || !guestInfo.email || !guestInfo.phone) {
      toast.error(lang === "fr" ? "Veuillez remplir vos informations." : "Please fill in your details.");
      return;
    }
    if (!accepted) {
      toast.error(lang === "fr" ? "Veuillez accepter la politique." : "Please accept the policy.");
      return;
    }
    setSubmitting(true);
    setTimeout(() => {
      const booking = {
        id: `b-${Date.now()}`,
        reference: generateReference(),
        rooms: cart,
        checkIn: search.checkIn,
        checkOut: search.checkOut,
        guests: search.guests,
        addOns,
        specialRequests,
        guestInfo,
        totals: {
          subtotal: totals.subtotal,
          addons: totals.addons,
          taxes: totals.taxes,
          total: totals.total,
        },
        status: "confirmed" as const,
        createdAt: new Date().toISOString().slice(0, 10),
      };
      addBooking(booking);
      setLastBooking(booking);
      clearCart();
      navigate({ to: "/confirmation" });
    }, 700);
  };

  if (cart.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <ShoppingBag className="mx-auto h-12 w-12 text-muted-foreground" />
        <h1 className="mt-4 font-display text-2xl font-semibold text-navy">{t("cart.empty")}</h1>
        <p className="mt-2 text-muted-foreground">
          {lang === "fr" ? "Sélectionnez une chambre pour commencer." : "Select a room to get started."}
        </p>
        <Button asChild variant="luxe" size="lg" className="mt-6">
          <Link to="/search">{t("nav.search")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <Link to="/search" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-navy">
        <ArrowLeft className="h-4 w-4" /> {lang === "fr" ? "Retour à la recherche" : "Back to search"}
      </Link>
      <h1 className="mt-3 font-display text-3xl font-semibold text-navy sm:text-4xl">{t("cart.title")}</h1>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_400px]">
        <div className="space-y-6">
          {/* Selected rooms */}
          <section className="rounded-xl border border-border bg-card p-6 shadow-card">
            <h2 className="font-display text-xl font-semibold text-navy">
              {lang === "fr" ? "Chambres sélectionnées" : "Selected rooms"}
            </h2>
            <div className="mt-4 space-y-3">
              {cart.map((r) => (
                <div key={r.id} className="flex items-center gap-4 rounded-lg border border-border p-3">
                  <img src={r.images[0]} alt={r.name[lang]} className="h-20 w-28 rounded-md object-cover" />
                  <div className="flex-1">
                    <h3 className="font-display text-base font-semibold text-navy">{r.name[lang]}</h3>
                    <p className="text-sm text-muted-foreground">
                      {nights} {nights > 1 ? t("common.nights") : t("common.night")} · {formatPrice(r.pricePerNight, lang)}
                      {t("room.pernight")}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="font-display text-lg font-semibold text-gold">
                      {formatPrice(r.pricePerNight * nights, lang)}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeRoom(r.id)}
                      className="mt-1 h-8 px-2 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-xs uppercase text-muted-foreground">{t("search.checkin")}</Label>
                <Input type="date" value={search.checkIn} disabled className="mt-1" />
              </div>
              <div>
                <Label className="text-xs uppercase text-muted-foreground">{t("search.checkout")}</Label>
                <Input type="date" value={search.checkOut} disabled className="mt-1" />
              </div>
            </div>
          </section>

          {/* Add-ons */}
          <section className="rounded-xl border border-border bg-card p-6 shadow-card">
            <h2 className="font-display text-xl font-semibold text-navy">{t("cart.addons")}</h2>
            <div className="mt-4 space-y-4">
              <AddonRow
                label={lang === "fr" ? "Petit-déjeuner" : "Breakfast"}
                price={`${formatPrice(ADDON_PRICES.breakfast, lang)} / ${t("common.night")}`}
              >
                <Switch
                  checked={addOns.breakfast}
                  onCheckedChange={(v) => setAddOns({ ...addOns, breakfast: v })}
                />
              </AddonRow>

              <AddonRow label={lang === "fr" ? "Arrivée anticipée" : "Early check-in"}>
                <Select
                  value={addOns.earlyCheckin}
                  onValueChange={(v) => setAddOns({ ...addOns, earlyCheckin: v as typeof addOns.earlyCheckin })}
                >
                  <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="no">{lang === "fr" ? "Non" : "No"}</SelectItem>
                    <SelectItem value="10am">10:00 (+25 000)</SelectItem>
                    <SelectItem value="12pm">12:00 (+15 000)</SelectItem>
                    <SelectItem value="2pm">14:00 (+8 000)</SelectItem>
                  </SelectContent>
                </Select>
              </AddonRow>

              <AddonRow label={lang === "fr" ? "Départ tardif" : "Late checkout"}>
                <Select
                  value={addOns.lateCheckout}
                  onValueChange={(v) => setAddOns({ ...addOns, lateCheckout: v as typeof addOns.lateCheckout })}
                >
                  <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="no">{lang === "fr" ? "Non" : "No"}</SelectItem>
                    <SelectItem value="2pm">14:00 (+8 000)</SelectItem>
                    <SelectItem value="4pm">16:00 (+15 000)</SelectItem>
                    <SelectItem value="6pm">18:00 (+25 000)</SelectItem>
                  </SelectContent>
                </Select>
              </AddonRow>

              <AddonRow label={lang === "fr" ? "Parking" : "Parking"} price={lang === "fr" ? "/ nuit" : "/ night"}>
                <Select
                  value={addOns.parking}
                  onValueChange={(v) => setAddOns({ ...addOns, parking: v as typeof addOns.parking })}
                >
                  <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="no">{lang === "fr" ? "Non" : "No"}</SelectItem>
                    <SelectItem value="standard">Standard (+5 000)</SelectItem>
                    <SelectItem value="covered">{lang === "fr" ? "Couvert" : "Covered"} (+10 000)</SelectItem>
                    <SelectItem value="vip">VIP (+18 000)</SelectItem>
                  </SelectContent>
                </Select>
              </AddonRow>

              <AddonRow
                label={lang === "fr" ? "Transfert aéroport" : "Airport transfer"}
                price={formatPrice(ADDON_PRICES.airportTransfer, lang)}
              >
                <Switch
                  checked={addOns.airportTransfer}
                  onCheckedChange={(v) => setAddOns({ ...addOns, airportTransfer: v })}
                />
              </AddonRow>

              <AddonRow
                label={lang === "fr" ? "Forfait Spa" : "Spa package"}
                price={formatPrice(ADDON_PRICES.spa, lang)}
              >
                <Switch
                  checked={addOns.spa}
                  onCheckedChange={(v) => setAddOns({ ...addOns, spa: v })}
                />
              </AddonRow>
            </div>

            <div className="mt-6">
              <Label className="text-sm font-semibold text-navy">{t("cart.specialreq")}</Label>
              <Textarea
                value={specialRequests}
                onChange={(e) => setSpecialRequests(e.target.value.slice(0, 500))}
                placeholder={t("cart.specialreq.placeholder")}
                className="mt-2 min-h-24"
              />
              <div className="mt-1 text-right text-xs text-muted-foreground">{specialRequests.length}/500</div>
            </div>
          </section>

          {/* Guest info */}
          <section className="rounded-xl border border-border bg-card p-6 shadow-card">
            <h2 className="font-display text-xl font-semibold text-navy">{t("cart.guestinfo")}</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label={lang === "fr" ? "Nom complet" : "Full name"}>
                <Input
                  value={guestInfo.fullName}
                  onChange={(e) => setGuestInfo({ ...guestInfo, fullName: e.target.value })}
                />
              </Field>
              <Field label="Email">
                <Input
                  type="email"
                  value={guestInfo.email}
                  onChange={(e) => setGuestInfo({ ...guestInfo, email: e.target.value })}
                />
              </Field>
              <Field label={lang === "fr" ? "Téléphone" : "Phone"}>
                <div className="flex gap-2">
                  <Input
                    value={guestInfo.countryCode}
                    onChange={(e) => setGuestInfo({ ...guestInfo, countryCode: e.target.value })}
                    className="w-20"
                  />
                  <Input
                    value={guestInfo.phone}
                    onChange={(e) => setGuestInfo({ ...guestInfo, phone: e.target.value })}
                    className="flex-1"
                  />
                </div>
              </Field>
              <Field label={lang === "fr" ? "Nationalité" : "Nationality"}>
                <Input
                  value={guestInfo.nationality ?? ""}
                  onChange={(e) => setGuestInfo({ ...guestInfo, nationality: e.target.value })}
                />
              </Field>
              <Field label={lang === "fr" ? "Adresse (facultatif)" : "Address (optional)"} className="sm:col-span-2">
                <Input
                  value={guestInfo.address ?? ""}
                  onChange={(e) => setGuestInfo({ ...guestInfo, address: e.target.value })}
                />
              </Field>
            </div>
          </section>
        </div>

        {/* Summary */}
        <aside className="lg:sticky lg:top-24 lg:h-fit">
          <div className="rounded-xl border border-border bg-card p-6 shadow-luxe">
            <h2 className="font-display text-xl font-semibold text-navy">
              {lang === "fr" ? "Récapitulatif" : "Summary"}
            </h2>
            <Separator className="my-4" />
            <dl className="space-y-2 text-sm">
              <Row label={`${t("cart.subtotal")} (${nights} × ${cart.length} ${cart.length > 1 ? "ch." : "ch."})`} value={formatPrice(totals.subtotal, lang)} />
              <Row label={t("cart.addons")} value={formatPrice(totals.addons, lang)} />
              <Row label={t("cart.taxes")} value={formatPrice(totals.taxes, lang)} />
            </dl>
            <Separator className="my-4" />
            <div className="flex items-baseline justify-between">
              <span className="font-display text-lg font-semibold text-navy">{t("cart.total")}</span>
              <span className="font-display text-2xl font-bold text-gold">{formatPrice(totals.total, lang)}</span>
            </div>
            <label className="mt-5 flex items-start gap-2 text-xs text-muted-foreground">
              <Checkbox
                checked={accepted}
                onCheckedChange={(v) => setAccepted(Boolean(v))}
                className="mt-0.5"
              />
              <span>{t("cart.policy")}</span>
            </label>
            <Button
              variant="luxe"
              size="xl"
              className="mt-5 w-full"
              onClick={confirm}
              disabled={submitting}
            >
              {submitting ? (lang === "fr" ? "Confirmation…" : "Confirming…") : t("cart.proceed")}
            </Button>
          </div>
        </aside>
      </div>
    </div>
  );
}

function AddonRow({ label, price, children }: { label: string; price?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/70 bg-secondary/40 p-3">
      <div>
        <div className="text-sm font-medium text-navy">{label}</div>
        {price && <div className="text-xs text-muted-foreground">{price}</div>}
      </div>
      {children}
    </div>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <Label className="text-sm font-medium text-navy">{label}</Label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium text-foreground">{value}</dd>
    </div>
  );
}