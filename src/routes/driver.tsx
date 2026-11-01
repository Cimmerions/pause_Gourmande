import { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { getFunctionErrorMessage, getFunctionRetryAfterSeconds } from "@/lib/function-errors";
import { useRateLimitLockout } from "@/lib/use-rate-limit-lockout";
import {
  Bike,
  CheckCircle2,
  Clock,
  LogIn,
  LogOut,
  MapPin,
  Package,
  RefreshCw,
  Truck,
  Bell,
} from "lucide-react";
import { toast } from "sonner";

import { driverSupabase } from "@/lib/driver-supabase";
import {
  getDriverOrders,
  startDriverDelivery,
  completeDriverDelivery,
} from "@/lib/orders";
import {
  getDriverPushStatus,
  registerDriverPushSubscription,
  unregisterDriverPushSubscription,
} from "@/lib/push";

export const Route = createFileRoute("/driver")({
  component: DriverPage,
});

type DriverOrderItem = {
  name: string;
  quantity: number;
  price: number;
  note?: string | null;
};

type DriverOrder = {
  id: string;
  customer_name: string;
  phone: string;
  total: number;
  status: "preparing" | "ready_for_delivery" | "delivering" | "done";
  created_at: string;
  reception_mode: string;
  delivery_latitude: number | null;
  delivery_longitude: number | null;
  delivery_fee: number;
  delivery_status: string | null;
  assigned_driver_id: string | null;
  items: DriverOrderItem[];
};

function formatPrice(value: number) {
  return `${new Intl.NumberFormat("fr-FR").format(value)} FCFA`;
}

function statusLabel(status: DriverOrder["status"]) {
  switch (status) {
    case "preparing":
      return "En préparation";
    case "ready_for_delivery":
      return "Prête à livrer";
    case "delivering":
      return "Livraison en cours";
    case "done":
      return "Livrée";
  }
}

function DriverPage() {
  const [accessCode, setAccessCode] = useState("");
  const [driverName, setDriverName] = useState("");
  const [driverPin, setDriverPin] = useState("");
  const [signedIn, setSignedIn] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [loggingIn, setLoggingIn] = useState(false);
  const [orders, setOrders] = useState<DriverOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [workingOrderId, setWorkingOrderId] = useState<string | null>(null);
  const [pushStatus, setPushStatus] = useState<
    "enabled" | "disabled" | "blocked"
  >("disabled");
  const [registeringPush, setRegisteringPush] = useState(false);
  const [isAvailable, setIsAvailable] = useState(false);
  const [savingAvailability, setSavingAvailability] = useState(false);
  const [isDriverAccount, setIsDriverAccount] = useState(false);

  const {
  isLocked,
  countdown,
  startLockout,
} = useRateLimitLockout("pause_gourmande_driver_lockout");

  const loadDriverAvailability = useCallback(async () => {
    const { data: userData, error: userError } =
      await driverSupabase.auth.getUser();

    if (userError || !userData.user) {
      setIsDriverAccount(false);
      setIsAvailable(false);
      return;
    }

    const { data, error } = await driverSupabase
      .from("delivery_drivers")
      .select("is_available")
      .eq("user_id", userData.user.id)
      .eq("active", true)
      .maybeSingle();

    if (error || !data) {
      setIsDriverAccount(false);
      setIsAvailable(false);
      if (error) {
        console.error("Erreur de lecture de la disponibilité :", error);
      }
      return;
    }

    setIsDriverAccount(true);
    setIsAvailable(data.is_available);
  }, []);

  async function handleToggleAvailability() {
    if (savingAvailability || !isDriverAccount) return;

    const nextAvailability = !isAvailable;
    setSavingAvailability(true);

    try {
      const { error } = await driverSupabase.rpc("set_driver_availability", {
        p_is_available: nextAvailability,
      });

      if (error) throw error;

      setIsAvailable(nextAvailability);
      toast.success(
        nextAvailability
          ? "Tu es maintenant disponible pour de nouvelles livraisons."
          : "Tu es maintenant indisponible pour les nouvelles livraisons."
      );
    } catch (error) {
      console.error("Erreur de mise à jour de la disponibilité :", error);
      toast.error("Impossible de modifier ta disponibilité.");
    } finally {
      setSavingAvailability(false);
    }
  }

  const verifyDriver = useCallback(async () => {
  const {
    data: { user },
    error: userError,
  } = await driverSupabase.auth.getUser();

  if (userError || !user) {
    setSignedIn(false);
    setIsAdmin(false);
    setOrders([]);
    return false;
  }

  const [
    { data: adminResult, error: adminError },
    { data: driverResult, error: driverError },
  ] = await Promise.all([
    driverSupabase.rpc("is_admin"),
    driverSupabase.rpc("is_delivery_driver"),
  ]);

  const admin = !adminError && adminResult === true;
  const driver = !driverError && driverResult === true;

  if (!admin && !driver) {
    await driverSupabase.auth.signOut();
    setSignedIn(false);
    setIsAdmin(false);
    setOrders([]);
    toast.error(
      "Accès refusé : seuls les administrateurs et les livreurs actifs sont autorisés."
    );
    return false;
  }

  setIsAdmin(admin);
  setSignedIn(true);
  return true;
}, []);

  const loadOrders = useCallback(async (quiet = false) => {
    if (!quiet) setLoadingOrders(true);

    try {
      const { data, error } = await getDriverOrders();

      if (error) {
        if (!quiet) {
          toast.error("Impossible de récupérer les livraisons.");
        }
        return;
      }

      setOrders(Array.isArray(data) ? (data as DriverOrder[]) : []);
    } catch (error) {
      console.error("Erreur de chargement des livraisons :", error);
      if (!quiet) toast.error("Une erreur est survenue pendant le chargement.");
    } finally {
      if (!quiet) setLoadingOrders(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    async function initialize() {
      const authorized = await verifyDriver();

      if (mounted && authorized) {
        await loadOrders();
        const { data: activeDriver } =
          await driverSupabase.rpc("is_delivery_driver");

        if (mounted && activeDriver === true) {
          await loadDriverAvailability();

          const status = await getDriverPushStatus();
          if (mounted) setPushStatus(status);
        } else if (mounted) {
          setIsDriverAccount(false);
          setIsAvailable(false);
        }
      }

      if (mounted) setCheckingSession(false);
    }

    initialize();

    return () => {
      mounted = false;
    };
  }, [verifyDriver, loadOrders, loadDriverAvailability]);

  useEffect(() => {
    if (!signedIn) return;

    const interval = window.setInterval(() => {
      void loadOrders(true);
    }, 30000);

    return () => window.clearInterval(interval);
  }, [signedIn, loadOrders]);

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoggingIn(true);

    try {
      const { data, error } = await driverSupabase.functions.invoke(
        "driver-access",
        {
          body: {
            action: "login",
            code: accessCode.trim(),
            display_name: driverName.trim(),
            pin: driverPin,
          },
        },
      );

      if (error) {
        const retryAfter = await getFunctionRetryAfterSeconds(error);

        if (retryAfter !== null) {
          startLockout(retryAfter);
        }

        toast.error(
          await getFunctionErrorMessage(
            error,
              "Connexion impossible. Vérifie tes informations.",
            ),
          );
        return;
      }

      if (!data?.token_hash) {
        toast.error(
          data?.error ||
          "Connexion impossible. Vérifie le code, le profil et le PIN.",
        );
        return;
      }

      const { error: sessionError } = await driverSupabase.auth.verifyOtp({
        token_hash: data.token_hash,
        type: "magiclink",
      });

      if (sessionError) {
        console.error("Échange du jeton livreur échoué :", sessionError);
        toast.error("La session n'a pas pu être créée. Réessaie.");
        return;
      }

      const authorized = await verifyDriver();

      if (authorized) {
        await loadOrders();
        const { data: activeDriver } =
          await driverSupabase.rpc("is_delivery_driver");

        if (activeDriver === true) {
          await loadDriverAvailability();
          setPushStatus(await getDriverPushStatus());
        } else {
          setIsDriverAccount(false);
          setIsAvailable(false);
          setPushStatus("disabled");
        }

        toast.success(`Bienvenue ${data.display_name || driverName.trim()} !`);
      }
    } catch (error) {
      console.error("Erreur de connexion livreur :", error);
      toast.error("Une erreur est survenue pendant la connexion.");
    } finally {
      setLoggingIn(false);
      setDriverPin("");
    }
  }

  async function handleLogout() {
    const { error } = await driverSupabase.auth.signOut();

    if (error) {
      toast.error("La déconnexion a échoué.");
      return;
    }

    setSignedIn(false);
    setIsAdmin(false);
    setIsDriverAccount(false);
    setIsAvailable(false);
    setOrders([]);
    setPushStatus("disabled");
    toast.success("Déconnexion effectuée.");
  }

  async function handleStart(orderId: string) {
    setWorkingOrderId(orderId);

    try {
      const { error } = await startDriverDelivery(orderId);

      if (error) {
        toast.error("Impossible de démarrer cette livraison.");
        return;
      }

      toast.success("Livraison démarrée.");
      await loadOrders(true);
    } finally {
      setWorkingOrderId(null);
    }
  }

  async function handleComplete(orderId: string) {
    if (!window.confirm("Confirmer que la commande a bien été livrée au client ?")) {
      return;
    }

    setWorkingOrderId(orderId);

    try {
      const { error } = await completeDriverDelivery(orderId);

      if (error) {
        toast.error("Impossible de confirmer cette livraison.");
        return;
      }

      toast.success("Livraison confirmée !");
      await loadOrders(true);
    } finally {
      setWorkingOrderId(null);
    }
  }

  async function handleTogglePush() {
  setRegisteringPush(true);

  try {
    if (pushStatus === "enabled") {
      await unregisterDriverPushSubscription();
      setPushStatus("disabled");

      toast.success("Notifications livreur désactivées sur cet appareil.");
      return;
    }

    if (pushStatus === "blocked") {
      toast.info(
        "Les notifications sont bloquées dans les paramètres du navigateur."
      );
      return;
    }

    await registerDriverPushSubscription();
    setPushStatus(await getDriverPushStatus());

    toast.success("Notifications livreur activées sur cet appareil.");
  } catch (error) {
    console.error("Erreur de gestion Push livreur :", error);

    try {
      setPushStatus(await getDriverPushStatus());
    } catch (statusError) {
      console.error("Erreur de vérification Push livreur :", statusError);
    }

    toast.error(
      error instanceof Error
        ? error.message
        : "Impossible de modifier les notifications."
    );
  } finally {
    setRegisteringPush(false);
  }
}

  if (checkingSession) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-6">
        <p className="text-muted-foreground">Vérification de la session livreur…</p>
      </main>
    );
  }

  if (!signedIn) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
        <section className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
          <div className="mb-6 flex items-center gap-3">
            <div className="rounded-xl bg-primary/10 p-3 text-primary">
              <Bike size={28} />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Espace livreur</h1>
              <p className="text-sm text-muted-foreground">Pause Gourmande · Lomé</p>
            </div>
          </div>

          <p className="mb-6 text-sm text-muted-foreground">
            Saisis le code partagé, le nom de ton profil et ton PIN personnel.
          </p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="driver-access-code" className="mb-1 block text-sm font-medium">
                Code partagé
              </label>
              <input
                id="driver-access-code"
                type="password"
                autoComplete="off"
                required
                value={accessCode}
                onChange={(event) => setAccessCode(event.target.value.toUpperCase())}
                className="w-full rounded-lg border bg-background px-3 py-2.5 outline-none focus:ring-2 focus:ring-ring"
                placeholder="Code communiqué par la vendeuse"
              />
            </div>

            <div>
              <label htmlFor="driver-name" className="mb-1 block text-sm font-medium">
                Nom du profil livreur
              </label>
              <input
                id="driver-name"
                type="text"
                autoComplete="username"
                required
                value={driverName}
                onChange={(event) => setDriverName(event.target.value)}
                className="w-full rounded-lg border bg-background px-3 py-2.5 outline-none focus:ring-2 focus:ring-ring"
                placeholder="Ex. Livreur Test"
              />
            </div>

            <div>
              <label htmlFor="driver-pin" className="mb-1 block text-sm font-medium">
                PIN personnel (6 à 12 chiffres)
              </label>
              <input
                id="driver-pin"
                type="password"
                inputMode="numeric"
                pattern="[0-9]{6,12}"
                autoComplete="current-password"
                required
                minLength={6}
                maxLength={12}
                value={driverPin}
                onChange={(event) => setDriverPin(event.target.value.replace(/\D/g, "").slice(0, 12))}
                className="w-full rounded-lg border bg-background px-3 py-2.5 outline-none focus:ring-2 focus:ring-ring"
                placeholder="6 à 12 chiffres"
              />
            </div>

            {isLocked && (
              <p
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                Trop de tentatives. Réessaie dans{" "}
                <strong className="font-semibold tabular-nums">{countdown}</strong>.
              </p>
            )}

            <button
              type="submit"
              disabled={loggingIn || isLocked}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 font-semibold text-primary-foreground disabled:opacity-60"
            >
              <LogIn size={18} />
              {loggingIn ? "Connexion…" : "Se connecter"}
            </button>
          </form>

          <p className="mt-5 text-xs text-muted-foreground">
            L'accès est vérifié côté serveur. Seuls les profils livreurs actifs
            disposant du code partagé et de leur PIN peuvent se connecter.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-muted/30 px-4 py-6 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-primary/10 p-3 text-primary">
              <Truck size={28} />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Mes livraisons</h1>
              <p className="text-sm text-muted-foreground">Pause Gourmande · Lomé</p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm font-medium hover:bg-muted"
          >
            <LogOut size={16} />
            Déconnexion
          </button>
        </header>

        {!isAdmin && isDriverAccount && (
          <section className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-card p-4">
            <div>
              <p className="font-semibold">Ma disponibilité</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {isAvailable
                  ? "Tu peux recevoir de nouvelles livraisons."
                  : "Tu ne recevras pas de nouvelles attributions."}
              </p>
              <span
                className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                  isAvailable
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-muted text-muted-foreground"
                  }`}
                >
                  {isAvailable ? "Disponible" : "Indisponible"}
              </span>
            </div>

            <button
              type="button"
              onClick={() => void handleToggleAvailability()}
              disabled={savingAvailability}
              className={`rounded-lg px-4 py-2.5 text-sm font-semibold disabled:opacity-60 ${
                isAvailable
                   ? "border bg-background hover:bg-muted"
                   : "bg-primary text-primary-foreground hover:opacity-90"
              }`}
            >
              {savingAvailability
                ? "Enregistrement…"
                : isAvailable
                  ? "Devenir indisponible"
                  : "Devenir disponible"}
            </button>
          </section>
        )}

        {!isAdmin && (
        <section className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
          <div className="flex items-start gap-3">
            <Bell className="mt-0.5 shrink-0 text-primary" size={21} />
            <div>
              <p className="font-semibold">Notifications de livraison</p>
              <p className="text-sm text-muted-foreground">
                {pushStatus === "enabled"
                  ? "Les notifications sont activées sur cet appareil."
                  : pushStatus === "blocked"
                    ? "Les notifications sont bloquées dans les paramètres du navigateur."
                    : "Active les notifications pour recevoir les alertes disponibles."}
              </p>
            </div>
          </div>

          {pushStatus !== "blocked" && (
            <button
              type="button"
              onClick={handleTogglePush}
              disabled={registeringPush}
              className="rounded-lg border px-3 py-2 text-sm font-semibold hover:bg-muted disabled:opacity-60"
            >
              {registeringPush 
                ? "Modification…"
                : pushStatus === "enabled"
                  ? "Désactiver les notifications"
                  : "Activer les notifications"}
            </button>
          )}
        </section>
        )}

        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {orders.length} livraison{orders.length > 1 ? "s" : ""} à suivre
          </p>
          <button
            type="button"
            onClick={() => void loadOrders()}
            disabled={loadingOrders}
            className="inline-flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-60"
          >
            <RefreshCw size={16} className={loadingOrders ? "animate-spin" : ""} />
            Actualiser
          </button>
        </div>

        {loadingOrders && orders.length === 0 ? (
          <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
            Chargement des livraisons…
          </div>
        ) : orders.length === 0 ? (
          <div className="rounded-xl border bg-card p-8 text-center">
            <Package size={36} className="mx-auto mb-3 text-muted-foreground" />
            <h2 className="font-semibold">Aucune livraison disponible</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Les nouvelles livraisons acceptées apparaîtront ici automatiquement.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => {
              const isWorking = workingOrderId === order.id;
              const hasCoordinates =
                order.delivery_latitude !== null &&
                order.delivery_longitude !== null;

              return (
                <article
                  key={order.id}
                  className="rounded-xl border bg-card p-4 shadow-sm sm:p-6"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Commande #{order.id.slice(0, 8)}
                      </p>
                      <h2 className="mt-1 text-lg font-bold">
                        {order.customer_name || "Client"}
                      </h2>
                      <a
                        href={`tel:${order.phone}`}
                        className="text-sm text-primary underline-offset-4 hover:underline"
                      >
                        {order.phone}
                      </a>
                    </div>

                    <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-sm font-semibold">
                      <Clock size={15} />
                      {statusLabel(order.status)}
                    </span>
                  </div>

                  <div className="my-4 space-y-2 border-y py-4">
                    <p className="text-sm font-semibold">Articles</p>
                    {(order.items ?? []).map((item, index) => (
                      <div
                        key={`${item.name}-${index}`}
                        className="flex justify-between gap-3 text-sm"
                      >
                        <span>
                          {item.quantity} × {item.name}
                          {item.note ? (
                            <span className="block text-xs text-muted-foreground">
                              Note : {item.note}
                            </span>
                          ) : null}
                        </span>
                        <span className="shrink-0">
                          {formatPrice(item.price * item.quantity)}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="grid gap-2 text-sm sm:grid-cols-2">
                    <p>
                      <span className="text-muted-foreground">Commande : </span>
                      <strong>{formatPrice(order.total)}</strong>
                    </p>
                    <p>
                      <span className="text-muted-foreground">Livraison : </span>
                      <strong>{formatPrice(order.delivery_fee ?? 0)}</strong>
                    </p>
                  </div>

                  {hasCoordinates ? (
                    <a
                      href={`https://www.google.com/maps?q=${order.delivery_latitude},${order.delivery_longitude}`}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-4 inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold hover:bg-muted"
                    >
                      <MapPin size={17} />
                      Ouvrir la position GPS
                    </a>
                  ) : (
                    <p className="mt-3 text-sm text-muted-foreground">
                      Position GPS non disponible pour cette commande.
                    </p>
                  )}

                  <div className="mt-5">
                    {order.status === "preparing" && (
                      <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
                        La commande est encore en préparation. Tu pourras démarrer
                        la livraison dès qu'elle sera prête.
                      </p>
                    )}

                    {order.status === "ready_for_delivery" && (
                      <button
                        type="button"
                        disabled={isWorking}
                        onClick={() => void handleStart(order.id)}
                        className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 font-semibold text-primary-foreground disabled:opacity-60"
                      >
                        <Bike size={18} />
                        {isWorking ? "Traitement…" : "Livreur en route"}
                      </button>
                    )}

                    {order.status === "delivering" && (
                      <button
                        type="button"
                        disabled={isWorking}
                        onClick={() => void handleComplete(order.id)}
                        className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 font-semibold text-primary-foreground disabled:opacity-60"
                      >
                        <CheckCircle2 size={18} />
                        {isWorking
                          ? "Confirmation…"
                          : "Confirmer la livraison"}
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <p className="mt-6 text-center text-xs text-muted-foreground">
          La liste se rafraîchit automatiquement toutes les 30 secondes.
        </p>
      </div>
    </main>
  );
}
