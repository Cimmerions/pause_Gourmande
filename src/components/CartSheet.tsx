import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Minus, Plus, Trash2, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { useCart } from "@/lib/cart-store";
import { formatFCFA } from "@/lib/products";

export function CartSheet({ children }: { children: React.ReactNode }) {
  const { items, setQty, remove, setNote, total, submitOrder } = useCart();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [mode, setMode] = useState<"today" | "tomorrow">("today");
  const [time, setTime] = useState("12:30");
  const [submitting, setSubmitting] = useState(false);

  const validate = async () => {
    if (!items.length) return;
    if (!name.trim() || !phone.trim()) {
      toast.error("Merci de renseigner votre nom et téléphone.");
      return;
    }
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 500));
    const order = submitOrder({ customerName: name, phone, mode, time });
    const earned = order?.pointsEarned ?? 0;
    toast.success(`Commande envoyée ! Vous avez gagné ${earned} pépites 🎉`, {
      description: `Paiement à la livraison • ${mode === "today" ? "Aujourd'hui" : "Demain"} à ${time}`,
    });
    setSubmitting(false);
    setOpen(false);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent className="w-full sm:max-w-lg flex flex-col gap-0 p-0">
        <SheetHeader className="p-6 border-b">
          <SheetTitle className="text-2xl font-semibold">Mon Panier</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {items.length === 0 ? (
            <div className="text-center py-16 space-y-3">
              <div className="mx-auto size-16 rounded-full bg-secondary flex items-center justify-center">
                <ShoppingBag className="size-7 text-brand-gold" />
              </div>
              <p className="font-medium">Votre panier est vide</p>
              <p className="text-sm text-muted-foreground">
                Ajoutez une gourmandise pour commencer.
              </p>
            </div>
          ) : (
            <>
              {items.map((it) => (
                <div key={it.product.id} className="flex gap-4">
                  <img
                    src={it.product.image}
                    alt={it.product.name}
                    className="size-20 rounded-2xl object-cover ring-1 ring-border"
                    loading="lazy"
                    width={80}
                    height={80}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start gap-2">
                      <p className="font-semibold truncate">{it.product.name}</p>
                      <button
                        onClick={() => remove(it.product.id)}
                        className="text-muted-foreground hover:text-destructive transition"
                        aria-label="Supprimer"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                    <p className="text-sm text-brand-gold font-medium">
                      {formatFCFA(it.product.price)}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="size-8 rounded-full"
                        onClick={() => setQty(it.product.id, it.qty - 1)}
                      >
                        <Minus className="size-3" />
                      </Button>
                      <span className="w-6 text-center font-semibold text-sm">{it.qty}</span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="size-8 rounded-full"
                        onClick={() => setQty(it.product.id, it.qty + 1)}
                      >
                        <Plus className="size-3" />
                      </Button>
                    </div>
                    <Textarea
                      placeholder="Un mot pour ce produit ? (ex: sans banane)"
                      className="mt-2 text-xs min-h-[36px] resize-none"
                      value={it.note ?? ""}
                      onChange={(e) => setNote(it.product.id, e.target.value)}
                    />
                  </div>
                </div>
              ))}

              <div className="border-t pt-6 space-y-4">
                <p className="text-xs font-bold uppercase tracking-widest text-brand-gold">
                  Vos infos
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Nom</Label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Kofi" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Téléphone</Label>
                    <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+228…" />
                  </div>
                </div>

                <p className="text-xs font-bold uppercase tracking-widest text-brand-gold pt-2">
                  Réservation
                </p>
                <RadioGroup
                  value={mode}
                  onValueChange={(v) => setMode(v as "today" | "tomorrow")}
                  className="grid grid-cols-2 gap-2"
                >
                  <label
                    htmlFor="today"
                    className="flex items-center gap-2 rounded-2xl border p-3 cursor-pointer data-[checked=true]:border-brand-gold data-[checked=true]:bg-brand-gold/5"
                    data-checked={mode === "today"}
                  >
                    <RadioGroupItem id="today" value="today" />
                    <span className="text-sm font-medium">Aujourd'hui</span>
                  </label>
                  <label
                    htmlFor="tomorrow"
                    className="flex items-center gap-2 rounded-2xl border p-3 cursor-pointer data-[checked=true]:border-brand-gold data-[checked=true]:bg-brand-gold/5"
                    data-checked={mode === "tomorrow"}
                  >
                    <RadioGroupItem id="tomorrow" value="tomorrow" />
                    <span className="text-sm font-medium">Demain</span>
                  </label>
                </RadioGroup>
                <div className="space-y-1">
                  <Label className="text-xs">Heure souhaitée</Label>
                  <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
                </div>
              </div>
            </>
          )}
        </div>

        {items.length > 0 && (
          <div className="border-t p-6 space-y-3 bg-secondary/50">
            <div className="flex justify-between items-baseline">
              <span className="text-sm text-muted-foreground">Total (paiement à la livraison)</span>
              <span className="text-2xl font-semibold">{formatFCFA(total)}</span>
            </div>
            <p className="text-xs text-brand-gold font-medium">
              +{Math.floor(total / 100)} pépites de fidélité offertes
            </p>
            <Button
              disabled={submitting}
              onClick={validate}
              className="w-full h-12 rounded-full text-base font-semibold"
            >
              {submitting ? "Envoi…" : "Valider la commande"}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
