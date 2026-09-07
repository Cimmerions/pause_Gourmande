import { useEffect, useRef, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Minus, Plus, Trash2, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { useCart } from "@/lib/cart-store";
import { formatFCFA } from "../lib/products";
import { findCustomer } from "@/lib/customers";
import { getRewards } from "@/lib/rewards";
import { getLoyaltySettings } from "@/lib/loyalty";

export function CartSheet({ children }: { children: React.ReactNode }) {
  const { items, setQty, remove, setNote, total, submitOrder } = useCart();
  const subtotal = total;
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [customer, setCustomer] = useState<any>(null);
  const [customerPoints, setCustomerPoints] = useState(0);
  const [mode, setMode] = useState<"today" | "tomorrow">("today");
  const [time, setTime] = useState("12:30");
  const [submitting, setSubmitting] = useState(false);
  const [rewards, setRewards] = useState<any[]>([]);
  const [selectedReward, setSelectedReward] = useState<any>(null);
  const [loyaltyThreshold, setLoyaltyThreshold] = useState(500);
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);

  let rewardDiscount = 0;

  if (selectedReward?.type === "discount") {

    const percent = parseInt(
      selectedReward.value.replace(/\D/g, "")
    );

    rewardDiscount = Math.round(
      subtotal * percent / 100
    );

  }


  useEffect(() => {

    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }


    if (phone.length !== 8) {
      setCustomer(null);
      setCustomerPoints(0);
      setRewards([]);
      return;
    }


    searchTimeout.current = setTimeout(async () => {


      // Recherche client
      await loadCustomer(phone);


      // Recherche récompenses
      const rewardsData = await getRewards(phone);

      setRewards(rewardsData);

      const loyaltySettings = await getLoyaltySettings();

      setLoyaltyThreshold(loyaltySettings.threshold);


    }, 500);



    return () => {

      if (searchTimeout.current) {
        clearTimeout(searchTimeout.current);
      }

    };


  }, [phone]);

  async function loadCustomer(phone: string) {

    if (phone.length !== 8) {
      setCustomer(null);
      setCustomerPoints(0);
      return;
    }

    const c = await findCustomer(phone);

    if (!c) {
      setCustomer(null);
      setCustomerPoints(0);
      return;
    }

    setCustomer(c);
    setCustomerPoints(c.points ?? 0);

  }

  const validate = async () => {
    if (!items.length) return;
    if (!name.trim() || !phone.trim()) {
      toast.error("Merci de renseigner votre nom et téléphone.");
      return;
    }
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 500));

    const order = await submitOrder({
      customerName: name,
      phone,
      mode,
      time,
      rewardId: selectedReward?.id,
      total: finalTotal,
      usedPoints: 0,
      referralCode: referralCode.trim(),
      customerId: customer?.id,
      loyaltyReward: selectedReward?.source === "loyalty",
    });

    const earned = order?.pointsEarned ?? 0;

    if (
      order &&
      selectedReward?.source === "loyalty"
    ) {
      setCustomerPoints(order.pointsEarned);
    }

    const referralMessage = order?.referralCode
      ? `🎉 Commande confirmée ! Le parrainage a bien été pris en compte.`
      : "";

    toast.success(
      `Commande envoyée ! Vous avez gagné ${earned} pépites 🎉`,
      {
        description:
          `${referralMessage}Paiement à la livraison • ${
            mode === "today" ? "Aujourd'hui" : "Demain"
          } à ${time}`,
      }
    );
    setSubmitting(false);
    setOpen(false);
    setSelectedReward(null);
  };

  const finalTotal = Math.max(
    0,
    subtotal - rewardDiscount
  );

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
                    <Input
                      value={phone}
                      onChange={(e) => {
                        setPhone(e.target.value);
                      }}
                      placeholder="+228…"
                    />

                  <div className="space-y-2">
                    <Label htmlFor="referralCode">
                      Code parrainage <span className="text-muted-foreground">(facultatif)</span>
                    </Label>

                    <Input
                      id="referralCode"
                      type="text"
                      placeholder="Ex. PG-A7K92B"
                      value={referralCode}
                      onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                      className="rounded-full"
                      maxLength={9}
                    />

                    <p className="text-xs text-muted-foreground">
                      Vous avez reçu un code d'un ami ? Entrez-le ici.
                    </p>
                 </div>

                    {rewards.length > 0 && (
                      <div className="space-y-3 mt-4">

                        {rewards.some((reward) => reward.source === "loyalty") && (
                          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                            <p className="text-sm font-semibold text-emerald-700">
                              🎉 Votre réduction fidélité est disponible !
                            </p>

                            <p className="text-xs text-emerald-600 mt-1">
                              Utilisez-la pour bénéficier de votre remise et réinitialiser vos
                              pépites afin de recommencer un nouveau cycle.
                            </p>
                          </div>
                        )}

                        <p className="text-xs font-bold uppercase tracking-widest text-brand-gold">
                          Vos récompenses disponibles
                        </p>

                        {rewards.map((reward) => (
                          <button
                            key={reward.id}
                            type="button"
                            onClick={() =>
                              setSelectedReward(
                              selectedReward?.id === reward.id
                                ? null
                                : reward
                              )
                            }
                            className={
                              "w-full rounded-xl border p-3 text-left text-sm transition " +
                              (
                                selectedReward?.id === reward.id
                                  ? "border-brand-gold bg-brand-gold/10"
                                  : "border-border"
                              )
                            }
                          >
                            🎁 {reward.value}
                          </button>
                        ))}
                      </div>
                    )}

                    {customer && (

                      <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 mt-2">

                        <p className="font-semibold text-amber-700">
                          ⭐ {customerPoints} pépites disponibles
                        </p>

                     </div>

                    )}

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
              <div className="text-right">

                <p className="text-sm text-muted-foreground">
                  {formatFCFA(subtotal)}
                </p>

                {rewardDiscount > 0 && (
                  <p className="text-sm text-emerald-600">
                    − {formatFCFA(rewardDiscount)}
                  </p>
                )}

                <p className="text-2xl font-semibold">
                  {formatFCFA(finalTotal)}
                </p>

              </div>

            </div>


            <p className="text-xs text-brand-gold font-medium">
              +{Math.max(
                0,
                Math.min(
                  loyaltyThreshold - customerPoints,
                  Math.floor(finalTotal / 100)
                )
              )} pépites de fidélité
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
