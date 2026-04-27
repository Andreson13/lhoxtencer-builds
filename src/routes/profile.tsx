import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useBooking } from "@/lib/booking-store";
import { useLang } from "@/lib/language";
import { toast } from "sonner";
import { useState } from "react";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Mon profil — Maison Royale" },
      { name: "description", content: "Gérez votre profil voyageur." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { lang } = useLang();
  const { guestInfo, setGuestInfo } = useBooking();
  const [newsletter, setNewsletter] = useState(true);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="font-display text-3xl font-semibold text-navy sm:text-4xl">
        {lang === "fr" ? "Mon profil" : "My profile"}
      </h1>

      <section className="mt-8 rounded-xl border border-border bg-card p-6 shadow-card">
        <h2 className="font-display text-xl font-semibold text-navy">
          {lang === "fr" ? "Informations personnelles" : "Personal information"}
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <Label>{lang === "fr" ? "Nom complet" : "Full name"}</Label>
            <Input value={guestInfo.fullName} onChange={(e) => setGuestInfo({ ...guestInfo, fullName: e.target.value })} className="mt-1.5" />
          </div>
          <div>
            <Label>Email</Label>
            <Input type="email" value={guestInfo.email} onChange={(e) => setGuestInfo({ ...guestInfo, email: e.target.value })} className="mt-1.5" />
          </div>
          <div>
            <Label>{lang === "fr" ? "Téléphone" : "Phone"}</Label>
            <Input value={guestInfo.phone} onChange={(e) => setGuestInfo({ ...guestInfo, phone: e.target.value })} className="mt-1.5" />
          </div>
          <div>
            <Label>{lang === "fr" ? "Nationalité" : "Nationality"}</Label>
            <Input value={guestInfo.nationality ?? ""} onChange={(e) => setGuestInfo({ ...guestInfo, nationality: e.target.value })} className="mt-1.5" />
          </div>
          <div className="sm:col-span-2">
            <Label>{lang === "fr" ? "Adresse" : "Address"}</Label>
            <Input value={guestInfo.address ?? ""} onChange={(e) => setGuestInfo({ ...guestInfo, address: e.target.value })} className="mt-1.5" />
          </div>
        </div>
        <div className="mt-5">
          <Button variant="luxe" onClick={() => toast.success(lang === "fr" ? "Profil mis à jour" : "Profile updated")}>
            {lang === "fr" ? "Enregistrer" : "Save changes"}
          </Button>
        </div>
      </section>

      <section className="mt-6 rounded-xl border border-border bg-card p-6 shadow-card">
        <h2 className="font-display text-xl font-semibold text-navy">
          {lang === "fr" ? "Mot de passe" : "Password"}
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <Label>{lang === "fr" ? "Actuel" : "Current"}</Label>
            <Input type="password" className="mt-1.5" placeholder="••••••••" />
          </div>
          <div>
            <Label>{lang === "fr" ? "Nouveau" : "New"}</Label>
            <Input type="password" className="mt-1.5" placeholder="••••••••" />
          </div>
          <div>
            <Label>{lang === "fr" ? "Confirmer" : "Confirm"}</Label>
            <Input type="password" className="mt-1.5" placeholder="••••••••" />
          </div>
        </div>
        <div className="mt-5">
          <Button variant="navy" onClick={() => toast.success(lang === "fr" ? "Mot de passe mis à jour" : "Password updated")}>
            {lang === "fr" ? "Mettre à jour" : "Update password"}
          </Button>
        </div>
      </section>

      <section className="mt-6 rounded-xl border border-border bg-card p-6 shadow-card">
        <h2 className="font-display text-xl font-semibold text-navy">
          {lang === "fr" ? "Préférences" : "Preferences"}
        </h2>
        <div className="mt-4 flex items-center justify-between rounded-lg border border-border p-3">
          <div>
            <div className="font-medium text-navy">
              {lang === "fr" ? "Newsletter Maison Royale" : "Maison Royale newsletter"}
            </div>
            <p className="text-xs text-muted-foreground">
              {lang === "fr" ? "Offres exclusives et nouveautés." : "Exclusive offers and news."}
            </p>
          </div>
          <Switch checked={newsletter} onCheckedChange={setNewsletter} />
        </div>
        <Separator className="my-5" />
        <Button variant="outline" onClick={() => toast.info(lang === "fr" ? "Téléchargement en cours…" : "Download started…")}>
          {lang === "fr" ? "Télécharger mes données (RGPD)" : "Download my data (GDPR)"}
        </Button>
      </section>
    </div>
  );
}