import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useLang } from "@/lib/language";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Connexion — Maison Royale" },
      { name: "description", content: "Accédez à votre espace voyageur Maison Royale." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { t, lang } = useLang();
  const navigate = useNavigate();
  const [email, setEmail] = useState("amelie.dupont@example.com");
  const [password, setPassword] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success(lang === "fr" ? "Bienvenue !" : "Welcome!");
    navigate({ to: "/dashboard" });
  };

  return (
    <div className="mx-auto max-w-md px-4 py-16 sm:px-6">
      <div className="rounded-2xl border border-border bg-card p-8 shadow-luxe">
        <div className="flex items-center justify-center gap-2 text-navy">
          <Crown className="h-6 w-6 text-gold" />
          <span className="font-display text-2xl font-semibold">
            Maison <span className="text-gold">Royale</span>
          </span>
        </div>
        <h1 className="mt-6 text-center font-display text-2xl font-semibold text-navy">
          {t("auth.welcome")}
        </h1>
        <p className="text-center text-sm text-muted-foreground">
          {lang === "fr" ? "Connectez-vous pour gérer vos réservations." : "Sign in to manage your bookings."}
        </p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <Label>{t("auth.email")}</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1.5 h-11"
            />
          </div>
          <div>
            <Label>{t("auth.password")}</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="mt-1.5 h-11"
              placeholder="••••••••"
            />
          </div>
          <div className="flex items-center justify-between text-sm">
            <label className="flex items-center gap-2 text-muted-foreground">
              <Checkbox /> {t("auth.remember")}
            </label>
            <button type="button" className="text-gold hover:underline">
              {t("auth.forgot")}
            </button>
          </div>
          <Button variant="luxe" size="xl" className="w-full" type="submit">
            {t("auth.signin")}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          {t("auth.create")}
        </p>
        <div className="mt-4 text-center">
          <Link to="/" className="text-xs text-muted-foreground hover:text-navy">
            {lang === "fr" ? "← Retour à l'accueil" : "← Back home"}
          </Link>
        </div>
      </div>
    </div>
  );
}