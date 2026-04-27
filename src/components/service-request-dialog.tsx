import { useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLang } from "@/lib/language";
import { toast } from "sonner";

export function ServiceRequestDialog({
  open,
  onOpenChange,
  reference,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  reference: string;
}) {
  const { t, lang } = useLang();
  const [type, setType] = useState("housekeeping");
  const [urgency, setUrgency] = useState("medium");
  const [description, setDescription] = useState("");
  const [time, setTime] = useState("12:00");

  const submit = () => {
    if (!description.trim()) {
      toast.error(lang === "fr" ? "Veuillez décrire votre demande." : "Please describe your request.");
      return;
    }
    const ref = `SR-${Math.floor(10000 + Math.random() * 90000)}`;
    toast.success(lang === "fr" ? `Demande envoyée. Réf : ${ref}` : `Request submitted. Ref: ${ref}`);
    setDescription("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display text-2xl text-navy">
            {lang === "fr" ? "Demande de service" : "Service request"}
          </DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          {t("conf.ref")} · <span className="font-semibold text-navy">{reference}</span>
        </p>
        <div className="mt-4 space-y-4">
          <div>
            <Label>{lang === "fr" ? "Type de service" : "Service type"}</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="roomservice">{lang === "fr" ? "Room service" : "Room service"}</SelectItem>
                <SelectItem value="housekeeping">{lang === "fr" ? "Ménage / linge" : "Housekeeping"}</SelectItem>
                <SelectItem value="maintenance">{lang === "fr" ? "Maintenance" : "Maintenance"}</SelectItem>
                <SelectItem value="concierge">{lang === "fr" ? "Conciergerie" : "Concierge"}</SelectItem>
                <SelectItem value="other">{lang === "fr" ? "Autre" : "Other"}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{lang === "fr" ? "Urgence" : "Urgency"}</Label>
              <Select value={urgency} onValueChange={setUrgency}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">{lang === "fr" ? "Faible" : "Low"}</SelectItem>
                  <SelectItem value="medium">{lang === "fr" ? "Moyenne" : "Medium"}</SelectItem>
                  <SelectItem value="high">{lang === "fr" ? "Élevée" : "High"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{lang === "fr" ? "Heure souhaitée" : "Requested time"}</Label>
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="mt-1.5" />
            </div>
          </div>
          <div>
            <Label>{lang === "fr" ? "Description" : "Description"}</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={lang === "fr" ? "Précisez votre demande…" : "Describe your request…"}
              className="mt-1.5 min-h-24"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
          <Button variant="luxe" onClick={submit}>{lang === "fr" ? "Envoyer" : "Submit"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}