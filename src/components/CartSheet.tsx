import { useEffect, useRef, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Minus, Plus, Trash2, ShoppingBag, Bell, MapPin } from "lucide-react";
import { toast } from "sonner";
import { useCart } from "@/lib/cart-store";
import { formatFCFA } from "../lib/products";
import { getCurrentCustomer } from "@/lib/customers";
import { getRewards } from "@/lib/rewards";
import { getLoyaltySettings } from "@/lib/loyalty";
import { useNavigate } from "@tanstack/react-router";
import { getCurrentUser } from "@/lib/auth";
import {
  getAppSettings,
  DEFAULT_ORDER_SETTINGS,
} from "@/lib/settings";
import { supabase } from "@/lib/supabase";
import {
  registerCustomerPushSubscription,
  getCustomerPushStatus,
  needsIOSHomeScreenInstall,
} from "@/lib/push";

function getLomeIsoWeekday(daysFromToday = 0): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Lome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const getPart = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "0";

  const date = new Date(
    Date.UTC(
      Number(getPart("year")),
      Number(getPart("month")) - 1,
      Number(getPart("day")) + daysFromToday,
    ),
  );

  const weekday = date.getUTCDay();
  return weekday === 0 ? 7 : weekday;
}

export function CartSheet({ children }: { children: React.ReactNode }) {
  const { items, setQty, remove, setNote, total, submitOrder } = useCart();
  const navigate = useNavigate();
  const subtotal = total;
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [customer, setCustomer] = useState<any>(null);

  useEffect(() => {
    async function loadCurrentCustomer() {
      const currentCustomer = await getCurrentCustomer();

      if (!currentCustomer) {
        return;
      }

      setCustomer(currentCustomer);
      setName(currentCustomer.name ?? "");
      setPhone(currentCustomer.phone ?? "");
      setCustomerPoints(currentCustomer.points ?? 0);
    }

    loadCurrentCustomer();
  }, []);

  const [customerPoints, setCustomerPoints] = useState(0);
  const [mode, setMode] = useState<"today" | "tomorrow">("today");
  const [time, setTime] = useState("");

  const [orderSettings, setOrderSettings] = useState(DEFAULT_ORDER_SETTINGS);

  const openDays = Array.isArray(orderSettings.open_days)
    ? orderSettings.open_days
    : DEFAULT_ORDER_SETTINGS.open_days;

  const todayIsOpen = openDays.includes(getLomeIsoWeekday());
  const tomorrowIsOpen = openDays.includes(getLomeIsoWeekday(1));

  const canOrderToday = todayIsOpen;
  const canOrderTomorrow = tomorrowIsOpen;

  const [availableSlots, setAvailableSlots] = useState<
    { slot_time: string; available: boolean; remaining: number }[]
  >([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotsError, setSlotsError] = useState("");

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    async function loadOrderSettings() {
      try {
        const settings = await getAppSettings();

        if (!cancelled && settings?.order_settings) {
          setOrderSettings({
            ...DEFAULT_ORDER_SETTINGS,
            ...settings.order_settings,
          });
        }
      } catch (error) {
        console.error("Erreur de chargement des réglages :", error);
      }
    }

    void loadOrderSettings();

    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!canOrderToday && canOrderTomorrow) {
      setMode("tomorrow");
      setTime("");
    } else if (canOrderToday && !canOrderTomorrow) {
      setMode("today");
      setTime("");
    } else if (!canOrderToday && !canOrderTomorrow) {
      setTime("");
    }
  }, [canOrderToday, canOrderTomorrow]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    async function loadSlots() {
      setLoadingSlots(true);
      setSlotsError("");
      setAvailableSlots([]);
      setTime("");

      try {
        const parts = new Intl.DateTimeFormat("en-GB", {
          timeZone: "Africa/Lome",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).formatToParts(new Date());

        const getPart = (type: string) =>
          parts.find((part) => part.type === type)?.value ?? "";

        const targetDate = new Date(
          Date.UTC(
            Number(getPart("year")),
            Number(getPart("month")) - 1,
            Number(getPart("day")) + (mode === "tomorrow" ? 1 : 0),
          ),
        )
          .toISOString()
          .slice(0, 10);

        const { data, error } = await supabase.rpc(
          "get_available_order_slots",
          { p_date: targetDate },
        );

        if (error) throw error;
        if (cancelled) return;

        const slots = (data ?? []) as {
          slot_time: string;
          available: boolean;
          remaining: number;
        }[];

        setAvailableSlots(slots);

        if (!slots.some((slot) => slot.available)) {
          setSlotsError(
            mode === "today"
              ? "Aucun créneau disponible aujourd’hui."
              : "Aucun créneau disponible demain.",
          );
        }
      } catch (error) {
        console.error("Erreur de chargement des créneaux :", error);

        if (!cancelled) {
          setSlotsError("Impossible de charger les créneaux. Réessayez.");
        }
      } finally {
        if (!cancelled) setLoadingSlots(false);
      }
    }

    void loadSlots();

    return () => {
      cancelled = true;
    };
  }, [open, mode]);

  const [submitting, setSubmitting] = useState(false);
  const [receptionMode, setReceptionMode] = useState<"pickup" | "delivery">("pickup");

  useEffect(() => {
  if (!orderSettings.delivery_enabled && receptionMode === "delivery") {
    setReceptionMode("pickup");
    setDeliveryLatitude(null);
    setDeliveryLongitude(null);
  }
}, [orderSettings.delivery_enabled, receptionMode]);

  const [deliveryLatitude, setDeliveryLatitude] = useState<number | null>(null);

  const [deliveryLongitude, setDeliveryLongitude] = useState<number | null>(null);

  const [gettingLocation, setGettingLocation] = useState(false);

  const [rewards, setRewards] = useState<any[]>([]);
  const [selectedReward, setSelectedReward] = useState<any>(null);
  const [loyaltyThreshold, setLoyaltyThreshold] = useState(500);
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);
  const [pushStatus, setPushStatus] = useState<"enabled" | "disabled" | "blocked">("disabled");

  const [enablingNotifications, setEnablingNotifications] = useState(false);
  const [needsIOSInstall, setNeedsIOSInstall] = useState(false);

  useEffect(() => {
    setNeedsIOSInstall(needsIOSHomeScreenInstall());
  }, []);

  let rewardDiscount = 0;

  if (selectedReward?.type === "discount") {
    const percent = parseInt(selectedReward.value.replace(/\D/g, ""));

    rewardDiscount = Math.round((subtotal * percent) / 100);
  }

  const finalTotal = Math.max(0, subtotal - rewardDiscount);

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
      const rewardsData = await getRewards();

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

  useEffect(() => {
    if (phone.length !== 8) {
      setPushStatus("disabled");
      return;
    }

    let cancelled = false;

    async function checkPushStatus() {
      const status = await getCustomerPushStatus(phone);

      if (!cancelled) {
        setPushStatus(status);
      }
    }

    checkPushStatus();

    return () => {
      cancelled = true;
    };
  }, [phone]);

async function loadCustomer(phone: string) {
  if (phone.length !== 8) {
    setCustomer(null);
    setCustomerPoints(0);
    return;
  }

  const c = await getCurrentCustomer();

  if (!c || String(c.phone ?? "") !== phone) {
    setCustomer(null);
    setCustomerPoints(0);
    return;
  }

  setCustomer(c);
  setCustomerPoints(c.points ?? 0);
}

  async function enableCustomerNotifications() {
    if (phone.length !== 8) {
      toast.error("Merci de renseigner un numéro valide.");
      return;
    }

    setEnablingNotifications(true);

    try {
      await registerCustomerPushSubscription(phone);

      setPushStatus("enabled");

      toast.success("Notifications activées 🔔", {
        description: "Vous serez prévenu lorsque votre commande sera confirmée ou annulée.",
      });
    } catch (error) {
      console.error("Erreur activation notifications client :", error);

      const status = await getCustomerPushStatus(phone);
      setPushStatus(status);

      toast.error("Impossible d'activer les notifications.", {
        description: "Vérifiez que les notifications sont autorisées dans votre navigateur.",
      });
    } finally {
      setEnablingNotifications(false);
    }
  }


  const getDeliveryLocation = () => {
    if (!navigator.geolocation) {
      toast.error("La géolocalisation n'est pas disponible sur cet appareil.");
      return;
    }

    if (!window.isSecureContext) {
      toast.error("La localisation nécessite une connexion sécurisée HTTPS.");
      return;
    }

    setGettingLocation(true);

    const savePosition = (position: GeolocationPosition) => {
      setDeliveryLatitude(position.coords.latitude);
      setDeliveryLongitude(position.coords.longitude);
      setGettingLocation(false);

      toast.success("Position enregistrée 📍", {
        description: "Votre position sera transmise avec votre commande.",
      });
    };

    const handleFinalError = (error: GeolocationPositionError) => {
      console.error("Échec final de géolocalisation :", {
        code: error.code,
        message: error.message,
      });

      setGettingLocation(false);

      if (error.code === 1) {
        toast.error("Accès à la localisation refusé.", {
          description:
            "Autorisez la localisation pour ce site dans les paramètres de votre navigateur.",
        });
      } else if (error.code === 2) {
        toast.error("Position introuvable.", {
          description:
            "Activez la localisation de votre appareil et vérifiez votre connexion, puis réessayez.",
        });
      } else if (error.code === 3) {
        toast.error("La localisation prend trop de temps.", {
          description:
            "Réessayez près d'une fenêtre ou à l'extérieur, avec la localisation de l'appareil activée.",
        });
      } else {
        toast.error("Impossible d'obtenir votre position.", {
          description: "Vérifiez les autorisations de localisation puis réessayez.",
        });
      }
    };

    const handleFirstError = (error: GeolocationPositionError) => {
      console.warn("Première tentative de géolocalisation échouée :", {
        code: error.code,
        message: error.message,
      });

      // Un refus d'autorisation ne se résout pas par une seconde tentative.
      if (error.code === 1) {
        handleFinalError(error);
        return;
      }

      // Deuxième tentative : privilégier une position obtenue par le réseau
      // si la localisation GPS précise est trop lente ou indisponible.
      navigator.geolocation.getCurrentPosition(
        savePosition,
        handleFinalError,
        {
          enableHighAccuracy: false,
          timeout: 25000,
          maximumAge: 60000,
        }
      );
    };

    // Première tentative : demander une position précise.
    navigator.geolocation.getCurrentPosition(
      savePosition,
      handleFirstError,
      {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 0,
      }
    );
  };

  const validate = async () => {
  if (!items.length) return;

  if (!canOrderToday && !canOrderTomorrow) {
    toast.error("Aucune commande n’est disponible aujourd’hui ni demain.");
    return;
  }

  if (mode === "today" && !canOrderToday) {
    toast.error(
      !todayIsOpen
        ? "Pause Gourmande est fermée aujourd’hui."
        : "Les commandes pour aujourd’hui sont désactivées.",
    );
    return;
  }

  if (mode === "tomorrow" && !canOrderTomorrow) {
    toast.error(
      !tomorrowIsOpen
        ? "Pause Gourmande est fermée demain."
        : "Les réservations pour demain sont désactivées.",
    );
    return;
  }

  if (!orderSettings.delivery_enabled && receptionMode === "delivery") {
    setReceptionMode("pickup");
    setDeliveryLatitude(null);
    setDeliveryLongitude(null);
    toast.info("La livraison n'est plus disponible. Optez pour le retrait.");
    return;
  }

  if (loadingSlots) {
    toast.info("Chargement des créneaux, veuillez patienter.");
    return;
  }

  if (!time) {
    toast.error("Veuillez choisir un créneau.");
    return;
  }

  const slot = availableSlots.find(
    (item) => item.slot_time === time && item.available,
  );

  if (!slot) {
    toast.error(
      "Ce créneau n'est plus disponible. Choisissez-en un autre.",
    );
    return;
  }

  const { user } = await getCurrentUser();

  if (!user) {
    sessionStorage.setItem("pause-gourmande:redirect-after-login", "/");
    toast.info("Connecte-toi pour confirmer ta commande.");
    setOpen(false);
    navigate({ to: "/account" });
    return;
  }

  if (!name.trim() || !phone.trim()) {
      toast.error("Merci de renseigner votre nom et téléphone.");
      return;
    }

    if (receptionMode === "delivery" && (deliveryLatitude === null || deliveryLongitude === null)) {
      toast.error("Veuillez partager votre position pour la livraison.");
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
      receptionMode,
      deliveryLatitude: receptionMode === "delivery" ? deliveryLatitude : null,
      deliveryLongitude: receptionMode === "delivery" ? deliveryLongitude : null,
    });

    if (!order) {
      toast.error(
        "La commande n'a pas pu être enregistrée. Veuillez réessayer.",
        {
          description:
            "Aucune confirmation n'a été reçue du serveur. Si le problème persiste, contactez la vendeuse.",
        }
      );
      setSubmitting(false);
      return;
    }

    localStorage.setItem("pause-gourmande:customer-phone", phone);

    if (selectedReward?.source === "loyalty") {
      setCustomerPoints(0);
    }

    const referralMessage = order.referralCode
      ? "🎉 Le parrainage a bien été pris en compte."
      : "";

toast.success("Commande envoyée !", {
  description: `${referralMessage}${
    receptionMode === "delivery"
      ? " Livraison • Les frais seront confirmés par la vendeuse."
      : " Retrait sur place."
  } Ta commande est en attente de validation. Prévue pour ${
    mode === "today" ? "aujourd’hui" : "demain"
  } à ${time.replace(":", " h ")}.`,
});

    setSubmitting(false);
    setOpen(false);
    setSelectedReward(null);
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
              {items.map((it) => {
                const addonsTotal =
                  it.addons?.reduce((sum, addon) => sum + Number(addon.price), 0) ?? 0;

                const unitPrice = Number(it.product.price) + addonsTotal;
                const lineTotal = unitPrice * it.qty;

                return (
                  <div
                    key={`${it.product.id}-${it.addons?.map((a) => a.productId).join("-") ?? "none"}`}
                    className="flex gap-4"
                  >
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

                      {/* Prix avec suppléments */}
                      <p className="text-sm text-brand-gold font-medium">
                        {formatFCFA(it.product.price)}
                      </p>

                      {/* Suppléments sélectionnés */}
                      {it.addons && it.addons.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {it.addons.map((addon) => (
                            <div
                              key={addon.productId}
                              className="flex items-center justify-between text-xs text-muted-foreground"
                            >
                              <span>+ {addon.name}</span>

                              <span className="text-brand-gold font-medium">
                                +{formatFCFA(Number(addon.price))}
                              </span>
                            </div>
                          ))}

                          <p className="mt-2 text-sm font-semibold text-foreground">
                            Total : {formatFCFA(unitPrice)}
                          </p>
                        </div>
                      )}

                      {/* Quantité */}
                      <div className="flex items-center gap-2 mt-3">
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

                      {/* Note */}
                      <Textarea
                        placeholder="Un mot pour ce produit ? (ex: sans banane)"
                        className="mt-2 text-xs min-h-[36px] resize-none"
                        value={it.note ?? ""}
                        onChange={(e) => setNote(it.product.id, e.target.value)}
                      />

                      {/* Sous-total de la ligne */}
                      {it.qty > 1 && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          Sous-total :{" "}
                          <span className="font-semibold text-foreground">
                            {formatFCFA(lineTotal)}
                          </span>
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}

              <div className="border-t pt-6 space-y-4">
                <p className="text-xs font-bold uppercase tracking-widest text-brand-gold">
                  Vos infos
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {/* NOM */}
                  <div className="space-y-1">
                    <Label className="text-xs">Nom</Label>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Kofi"
                    />
                  </div>

                  {/* TÉLÉPHONE */}
                  <div className="space-y-1">
                    <Label htmlFor="customer-phone" className="text-xs">
                      Téléphone
                    </Label>
                    <Input
                      id="customer-phone"
                      type="tel"
                      inputMode="numeric"
                      autoComplete="tel-national"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 8))}
                      placeholder="Ex. 90123456"
                      maxLength={8}
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      Entre les 8 chiffres de ton numéro.
                    </p>
                  </div>
                </div>

                {/* NOTIFICATIONS */}
                {phone.length === 8 && pushStatus !== "enabled" && (
                  <div className="mt-3 rounded-2xl border border-brand-gold/25 bg-brand-gold/5 px-3 py-2.5">
                    {needsIOSInstall ? (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2.5">
                          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-gold/10">
                            <Bell className="size-4 text-brand-gold" />
                          </div>
                          <p className="text-sm font-semibold text-brand-deep">
                            Ajouter l'application à votre écran d'accueil.
                          </p>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Veuillez ouvrir Pause Gourmande depuis l'icône de votre écran d'accueil
                          pour pouvoir activer les notifications.
                        </p>
                      </div>
                    ) : (
                      <>
                        {pushStatus === "disabled" && (
                          <div className="flex items-center gap-2.5">
                            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-gold/10">
                              <Bell className="size-4 text-brand-gold" />
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              disabled={enablingNotifications}
                              onClick={enableCustomerNotifications}
                              className="h-8 flex-1 rounded-full border-brand-gold/40 bg-background px-3 text-xs font-semibold"
                            >
                              {enablingNotifications ? "Activation…" : "Activer les notifications"}
                            </Button>
                          </div>
                        )}

                        {pushStatus === "blocked" && (
                          <div className="flex items-center gap-2.5">
                            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-destructive/10">
                              <Bell className="size-4 text-destructive" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-destructive">
                                Notifications bloquées
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Autorisez-les dans votre navigateur.
                              </p>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
                {/* PARRAINAGE */}
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
                          Utilisez-la pour bénéficier de votre remise et réinitialiser vos pépites
                          afin de recommencer un nouveau cycle.
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
                          setSelectedReward(selectedReward?.id === reward.id ? null : reward)
                        }
                        className={
                          "w-full rounded-xl border p-3 text-left text-sm transition " +
                          (selectedReward?.id === reward.id
                            ? "border-brand-gold bg-brand-gold/10"
                            : "border-border")
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

              <p className="text-xs font-bold uppercase tracking-widest text-brand-gold pt-2">
                Réception de la commande
              </p>

              <RadioGroup
                value={receptionMode}
                onValueChange={(value) => {
                  const newMode = value as "pickup" | "delivery";
                  setReceptionMode(newMode);

                  if (newMode === "pickup") {
                    setDeliveryLatitude(null);
                    setDeliveryLongitude(null);
                  }
                }}
                className="grid grid-cols-2 gap-2"
              >
                <label
                  htmlFor="pickup"
                  className="flex items-center gap-2 rounded-2xl border p-3 cursor-pointer"
                  data-checked={receptionMode === "pickup"}
                >
                  <RadioGroupItem id="pickup" value="pickup" />
                  <span className="text-sm font-medium">Retrait</span>
                </label>

                <label
                  htmlFor="delivery"
                  className={`flex items-center gap-2 rounded-2xl border p-3 ${
                  orderSettings.delivery_enabled
                    ? "cursor-pointer"
                    : "cursor-not-allowed opacity-60"
                  }`}
                  data-checked={
                    receptionMode === "delivery" && orderSettings.delivery_enabled
                  }
                >
                  <RadioGroupItem
                    id="delivery"
                    value="delivery"
                    disabled={!orderSettings.delivery_enabled}
                  />
                  <span>
                    <span className="block text-sm font-medium">Livraison</span>
                    {!orderSettings.delivery_enabled && (
                      <span className="block text-xs text-muted-foreground">
                        Indisponible — La livraison n’est pas proposée actuellement.
                      </span>
                    )}
                  </span>
                </label>
              </RadioGroup>

              {receptionMode === "delivery" && (
                <div className="rounded-2xl border border-brand-gold/30 bg-brand-gold/5 p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-gold/10">
                      <MapPin className="size-4 text-brand-gold" />
                    </div>

                    <div>
                      <p className="text-sm font-semibold">Où souhaitez-vous être livré ?</p>

                      <p className="text-xs text-muted-foreground mt-1">
                        Partagez votre position actuelle afin que nous puissions déterminer les
                        frais de livraison.
                      </p>
                    </div>
                  </div>

                  {deliveryLatitude !== null && deliveryLongitude !== null ? (
                    <div className="rounded-xl bg-background border p-3">
                      <p className="text-sm font-medium text-emerald-600">✓ Position enregistrée</p>

                      <p className="text-xs text-muted-foreground mt-1">
                        Votre position sera transmise avec la commande.
                      </p>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={getDeliveryLocation}
                      disabled={gettingLocation}
                      className="w-full rounded-full"
                    >
                      <MapPin className="size-4 mr-2" />

                      {gettingLocation ? "Localisation en cours…" : "Partager ma position"}
                    </Button>
                  )}
                </div>
              )}


<p className="text-xs font-bold uppercase tracking-widest text-brand-gold pt-2">
  Réservation
</p>


<div className="space-y-3">
  <div className="grid grid-cols-2 gap-2 rounded-2xl bg-muted p-1">
    <button
      type="button"
      disabled={!canOrderToday}
      onClick={() => {
        setMode("today");
        setTime("");
      }}
      aria-pressed={mode === "today"}
      className={`rounded-xl px-3 py-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        mode === "today"
          ? "bg-brand-gold text-white shadow-sm"
          : "text-foreground hover:bg-background"
      }`}
    >
      Aujourd’hui
    </button>

    <button
      type="button"
      disabled={!canOrderTomorrow}
      onClick={() => {
        setMode("tomorrow");
        setTime("");
      }}
      aria-pressed={mode === "tomorrow"}
      className={`rounded-xl px-3 py-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        mode === "tomorrow"
          ? "bg-brand-gold text-white shadow-sm"
          : "text-foreground hover:bg-background"
      }`}
    >
      Demain
    </button>
  </div>

  {!canOrderToday && mode === "today" ? (
    <p className="rounded-xl bg-muted p-3 text-sm text-muted-foreground">
      Pause Gourmande est fermée aujourd’hui.
    </p>
  ) : !canOrderTomorrow && mode === "tomorrow" ? (
    <p className="rounded-xl bg-muted p-3 text-sm text-muted-foreground">
      Pause Gourmande est fermée demain.
    </p>
  ) : (
    <div className="space-y-3 rounded-2xl border border-brand-gold/20 bg-brand-cream/30 p-4">
      <div>
        <p className="text-sm font-semibold text-foreground">
          Choisissez votre horaire
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {mode === "today" ? "Aujourd’hui" : "Demain"}
          {" · "}
          Créneaux selon les horaires de Pause Gourmande
        </p>
      </div>

      {loadingSlots ? (
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="h-14 animate-pulse rounded-xl bg-muted"
            />
          ))}
        </div>
      ) : availableSlots.length > 0 ? (
        <div className="grid grid-cols-3 gap-2">
          {availableSlots.map((slot) => {
            const selected = time === slot.slot_time;
            const unavailable = !slot.available;

            return (
              <button
                key={slot.slot_time}
                type="button"
                disabled={unavailable}
                aria-pressed={selected}
                onClick={() => setTime(slot.slot_time)}
                className={`min-h-14 rounded-xl border px-2 py-2 text-center transition-all ${
                  unavailable
                    ? "cursor-not-allowed border-red-800 bg-red-800 text-white opacity-90"
                    : selected
                      ? "border-brand-gold bg-brand-gold text-white shadow-sm"
                      : "border-border bg-background text-foreground hover:border-brand-gold/70 hover:bg-brand-gold/5"
                }`}
              >
                <span className="block text-sm font-semibold">
                  {slot.slot_time}
                </span>
                <span className="mt-0.5 block text-[10px]">
                  {unavailable
                    ? "Complet"
                    : `${slot.remaining} place${slot.remaining > 1 ? "s" : ""}`}
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <p className="rounded-xl bg-background p-3 text-sm text-muted-foreground">
          Aucun créneau n'est disponible pour le moment.
        </p>
      )}

      {slotsError && (
        <p className="text-xs text-destructive">{slotsError}</p>
      )}

      {receptionMode === "delivery" && (
        <p className="text-xs text-muted-foreground">
          Un délai supplémentaire peut être nécessaire pour la livraison.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-brand-gold/15 pt-3">
        <div className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-brand-gold" />
          <span className="text-[11px] text-muted-foreground">
            Votre sélection
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full border border-border bg-background" />
          <span className="text-[11px] text-muted-foreground">
            Disponible
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-rose-400/70" />
          <span className="text-[11px] text-muted-foreground">
            Complet
          </span>
        </div>
      </div>
    </div>
  )}
</div>

            </>
          )}
        </div>

        {items.length > 0 && (
          <div className="border-t p-6 space-y-3 bg-secondary/50">
            <div className="flex justify-between items-baseline">
              <span className="text-sm text-muted-foreground">
                {receptionMode === "delivery"
                  ? "Total produits"
                  : "Total (paiement à la livraison)"}
              </span>

              <div className="text-right">
                <p className="text-sm text-muted-foreground">{formatFCFA(subtotal)}</p>

                {rewardDiscount > 0 && (
                  <p className="text-sm text-emerald-600">− {formatFCFA(rewardDiscount)}</p>
                )}

                <p className="text-2xl font-semibold">{formatFCFA(finalTotal)}</p>

                {receptionMode === "delivery" && (
                  <p className="text-xs text-brand-gold mt-1">+ frais de livraison à confirmer</p>
                )}
              </div>
            </div>

            <p className="text-xs text-brand-gold font-medium">
              +
              {Math.max(
                0,
                Math.min(loyaltyThreshold - customerPoints, Math.floor(finalTotal / 100)),
              )}{" "}
              pépites de fidélité
            </p>
            {!canOrderToday && !canOrderTomorrow && (
              <p className="text-sm text-muted-foreground text-center">
                Les commandes sont temporairement indisponibles.
              </p>
            )}

            <Button
              disabled={
                submitting ||
                (!canOrderToday && !canOrderTomorrow)
              }
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
