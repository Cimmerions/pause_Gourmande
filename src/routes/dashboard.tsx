import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { NotificationBell } from "@/components/NotificationBell";
import { registerPushSubscription, getAdminPushStatus} from "@/lib/push";
import {
  ArrowLeft,
  TrendingUp,
  ShoppingBag,
  Sparkles,
  Wallet,
  Trash2,
  Check,
  Clock,
  LogOut,
  RefreshCw,
  Bell,
  Menu,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCart, type Order } from "@/lib/cart-store";
import { getProducts, formatFCFA, type Product } from "@/lib/products";
import { getOrders, updateOrderStatus } from "@/lib/orders";
import {
  getNotifications,
  getUnreadNotificationCount,
  subscribeToNotifications,
  type Notification,
} from "@/lib/notifications";
import {
  getLocation,
  updateLocation,
  type Location,
} from "@/lib/locations";

import {
  getAppSettings,
  updateAppSettings,
  type AppSettings,
  type WheelSetting,
  type ReferralSurpriseSetting,
} from "@/lib/settings";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Tableau de bord — Pause Gourmande" },
      {
        name: "description",
        content:
          "Suivi des ventes, commandes, pépites et performance produit de Pause Gourmande.",
      },
    ],
  }),
  component: Dashboard,
});

type Range = "today" | "7d" | "30d" | "all";

const RANGES: { key: Range; label: string; days: number | null }[] = [
  { key: "today", label: "Aujourd'hui", days: 0 },
  { key: "7d", label: "7 jours", days: 7 },
  { key: "30d", label: "30 jours", days: 30 },
  { key: "all", label: "Tout", days: null },
];

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function Dashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const points = 0;
  const [range, setRange] = useState<Range>("7d");
  const [products, setProducts] = useState<Product[]>([]);
  const navigate = useNavigate();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [location, setLocation] = useState<Location | null>(null);
  const [savingLocation, setSavingLocation] = useState(false);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [pushStatus, setPushStatus] = useState<
    "enabled" | "disabled" | "blocked"
  >("disabled");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  async function loadData() {

    setLoading(true);

    const productsData = await getProducts();
    const ordersData = await getOrders();
    const locationData = await getLocation();
    const settingsData = await getAppSettings();

    setProducts(productsData);
    setLocation(locationData);
    setSettings(settingsData);

    setOrders(
      ordersData.map((order: any) => ({
        ...order,
        customerName: order.customer_name,
        createdAt: new Date(order.created_at).getTime(),
        rewardSource: order.reward_source ?? null,
        rewardValue: order.reward_value ?? null,
        rewardDiscount: order.reward_discount ?? null,
        lines: (order.order_items ?? []).map((item: any) => ({
          productId: item.product_id,
          name: item.name,
          qty: item.quantity,
          price: item.price,
          category: "",
          note: item.note ?? undefined,
        })),
        pointsEarned: Math.floor(order.total / 100),
      }))
    );

    setLoading(false);

  }


  useEffect(() => {

    loadData();

  }, []);

  useEffect(() => {
    let cancelled = false;
  
    async function checkPushStatus() {
      const status = await getAdminPushStatus();
  
      if (!cancelled) {
        setPushStatus(status);
      }
    }
  
    checkPushStatus();
  
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("dashboard-orders")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "orders",
        },
        () => {
          console.log("🟢 NOUVELLE COMMANDE — Realtime");
          loadData();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
        },
        () => {
          console.log("🔵 COMMANDE MODIFIÉE — Realtime");
          loadData();
        }
      )
      .subscribe((status) => {
        console.log("📡 REALTIME ORDERS :", status);
      });
  
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    async function loadNotifications() {
      const [notificationsData, unreadCount] = await Promise.all([
        getNotifications(30),
        getUnreadNotificationCount(),
      ]);
  
      setNotifications(notificationsData);
      setUnreadNotifications(unreadCount);
    }
  
    loadNotifications();
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToNotifications((notification) => {

      console.log(
        "🔔 REALTIME NOTIFICATION REÇUE :",
        notification
      );
      
      setNotifications((current) => [
        notification,
        ...current.filter((item) => item.id !== notification.id),
      ]);
  
      if (!notification.read) {
        setUnreadNotifications((count) => count + 1);
      }

      const audio = new Audio("/sounds/notification.mp3");

      audio.play().catch((error) => {
        console.warn(
          "Impossible de jouer le son de notification :",
          error
        );
      });
  
      toast(notification.title, {
        description: notification.message,
      });
    });
  
    return unsubscribe;
  }, []);

  useEffect(() => {
    async function checkAdmin() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      console.log("🔐 USER CONNECTÉ :", user);
  
      if (!user) {
        navigate({
          to: "/admin-login",
        });
        return;
      }
  
      const { data: admin, error } = await supabase
        .from("admin_users")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();

        console.log("👤 ADMIN :", {
          admin,
          error,
        });
  
      if (error || !admin) {
        await supabase.auth.signOut();
  
        navigate({
          to: "/admin-login",
        });
  
        return;
      }
  
      setCheckingAuth(false);
    }
  
    checkAdmin();
  }, []);

  const filtered = useMemo(() => {
    const cfg = RANGES.find((r) => r.key === range)!;
    if (cfg.days === null) return orders;
    if (cfg.days === 0) {
      const s = startOfToday();
      return orders.filter((o) => o.createdAt >= s);
    }
    const cutoff = Date.now() - cfg.days * 86400_000;
    return orders.filter((o) => o.createdAt >= cutoff);
  }, [orders, range]);

  const stats = useMemo(() => {
    const revenue = filtered
      .filter((o) => o.status !== "cancelled")
      .reduce((s, o) => s + o.total, 0);
    const count = filtered.length;
    const items = filtered
      .filter((o) => o.status !== "cancelled")
      .reduce((s, o) => s + o.lines.reduce((a, l) => a + l.qty, 0), 0);
    const avg = count ? Math.round(revenue / count) : 0;
    const pointsGiven = filtered
      .filter((o) => o.status !== "cancelled")
      .reduce((s, o) => s + o.pointsEarned, 0);
    return { revenue, count, items, avg, pointsGiven };
  }, [filtered]);

  const perProduct = useMemo(() => {
    const map = new Map<
      string,
      { name: string; category: string; qty: number; revenue: number }
    >();
    for (const o of filtered) {
      if (o.status === "cancelled") continue;
      for (const l of o.lines) {
        const cur = map.get(l.productId) ?? {
          name: l.name,
          category: l.category,
          qty: 0,
          revenue: 0,
        };
        cur.qty += l.qty;
        cur.revenue += l.qty * l.price;
        map.set(l.productId, cur);
      }
    }
    // ensure all products appear
    for (const p of products) {
      if (!map.has(p.id))
        map.set(p.id, { name: p.name, category: p.category, qty: 0, revenue: 0 });
    }
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  }, [filtered]);

  const maxRev = Math.max(1, ...perProduct.map((p) => p.revenue));

  const daily = useMemo(() => {
    const days = 7;
    const buckets: { label: string; total: number }[] = [];
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const start = d.getTime();
      const end = start + 86400_000;
      const matchingOrders = orders.filter(
        (o) =>
          o.status !== "cancelled" &&
          o.createdAt >= start &&
          o.createdAt < end
      );

      const total = matchingOrders.reduce(
        (s, o) => s + o.total,
        0
      );

      buckets.push({
        label: d.toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit" }),
        total,
      });
    }
    return buckets;
  }, [orders]);

  const maxDaily = Math.max(1, ...daily.map((d) => d.total));

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Vérification...
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-brand-cream text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-brand-cream/95 backdrop-blur-md border-b border-brand-gold/10">
        <div className="max-w-7xl mx-auto">

          {/* Barre principale */}
          <div className="h-16 md:h-auto md:py-3 px-4 md:px-4 flex items-center justify-between gap-3">

            {/* Identité */}
            <div className="flex items-center gap-3 min-w-0">

              <Button
                variant="ghost"
                size="icon"
                asChild
                className="rounded-full size-9 shrink-0"
              >
                <Link to="/" aria-label="Retour à la boutique">
                  <ArrowLeft className="size-4" />
                </Link>
              </Button>

              <div className="hidden md:block h-6 w-px bg-border" />

              <div className="min-w-0">
                <p className="text-[10px] font-semibold text-brand-gold uppercase tracking-[0.12em]">
                  Tableau de bord
                </p>

                <p className="font-semibold text-sm md:text-base truncate">
                  Pause Gourmande — Lomé
                </p>
              </div> 
            </div>

            {/* Desktop : périodes + actions */}
            <div className="hidden md:flex items-center gap-2">

              {/* Périodes */}
              <div className="flex gap-0.5 rounded-full bg-white ring-1 ring-border p-1">
                {RANGES.map((r) => (
                  <button
                    key={r.key}
                    onClick={() => setRange(r.key)}
                    className={
                      "px-3 py-1.5 rounded-full text-xs font-semibold transition " +
                      (range === r.key
                        ? "bg-brand-deep text-brand-cream"
                        : "text-muted-foreground hover:text-foreground")
                      }
                    >
                      {r.label}
                    </button>
                  ))}
                </div>

                {/* Notifications */}
                <NotificationBell
                  notifications={notifications}
                  unreadCount={unreadNotifications}
                  onNotificationRead={(id) => {
                  setNotifications((current) =>
                  current.map((notification) =>
                  notification.id === id
                    ? { ...notification, read: true }
                    : notification
                  )
                );

                setUnreadNotifications((count) =>
                  Math.max(0, count - 1)
                );
              }}
              onAllRead={() => {
                setNotifications((current) =>
                current.map((notification) => ({
                  ...notification,
                  read: true,
                }))
              );

              setUnreadNotifications(0);
            }}
          />

          {/* Push */}
          <Button
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={async () => {
              if (pushStatus === "enabled") {
                return;
              }

              try {
                await registerPushSubscription();

                setPushStatus("enabled");

                toast.success("Notifications activées", {
                  description:
                    "Cet appareil recevra maintenant les notifications Push.",
                });
              } catch (error) {
                console.error(
                  "Erreur activation Push :",
                  error
                );

                const status = await getAdminPushStatus();
                setPushStatus(status);

                toast.error(
                  "Impossible d'activer les notifications",
                  {
                    description:
                      error instanceof Error
                        ? error.message
                        : "Une erreur est survenue.",
                  }
                );
              }
            }}
          >
            <Bell className="size-4" />

            <span>
              {pushStatus === "enabled"
                ? "Notifications activées"
                : pushStatus === "blocked"
                  ? "Notifications bloquées"
                  : "Activer les notifications"}
            </span>
          </Button>

          {/* Actualiser */}
          <Button
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={loadData}
            disabled={loading}
          >
            <RefreshCw
              className={
                "size-4 " +
                (loading ? "animate-spin" : "")
              }
            />
            <span>Actualiser</span>
          </Button>

          {/* Déconnexion */}
          <Button
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={async () => {
              await supabase.auth.signOut();

              navigate({
                to: "/admin-login",
              });
            }}
          >
            <LogOut className="size-4" />
            <span>Déconnexion</span>
          </Button>
        </div>

        {/* Mobile : notifications + menu */}
        <div className="flex md:hidden items-center gap-1 shrink-0">

          <NotificationBell
            notifications={notifications}
            unreadCount={unreadNotifications}
            onNotificationRead={(id) => {
              setNotifications((current) =>
                current.map((notification) =>
                  notification.id === id
                    ? { ...notification, read: true }
                    : notification
                )
              );

              setUnreadNotifications((count) =>
                Math.max(0, count - 1)
              );
            }}
            onAllRead={() => {
              setNotifications((current) =>
                current.map((notification) => ({
                  ...notification,
                  read: true,
                }))
              );

              setUnreadNotifications(0);
            }}
          />

          <Button
            variant="ghost"
            size="icon"
            className="size-9 rounded-full"
            onClick={() =>
              setMobileMenuOpen((open) => !open)
            }
            aria-label={
              mobileMenuOpen
                ? "Fermer le menu"
                : "Ouvrir le menu"
            }
          >
            {mobileMenuOpen ? (
              <X className="size-5" />
            ) : (
              <Menu className="size-5" />
            )}
          </Button>
        </div>
      </div>

      {/* Périodes mobile */}
      <div className="md:hidden px-4 pb-3">
        <div className="flex items-center gap-1 p-1 rounded-2xl bg-white ring-1 ring-border overflow-x-auto">
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={
                "flex-1 min-w-fit px-3 py-2 rounded-xl text-[11px] font-semibold whitespace-nowrap transition " +
                (range === r.key
                  ? "bg-brand-deep text-brand-cream"
                  : "text-muted-foreground")
              }
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Menu mobile */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-brand-gold/10 px-4 py-3 space-y-2 bg-brand-cream">

          <Button
            variant="outline"
            className="w-full justify-start rounded-2xl h-11"
            onClick={async () => {
              if (pushStatus === "enabled") {
                return;
              }

              try {
                await registerPushSubscription();

                setPushStatus("enabled");

                toast.success("Notifications activées", {
                  description:
                    "Cet appareil recevra maintenant les notifications Push.",
                });
              } catch (error) {
                console.error(
                  "Erreur activation Push :",
                  error
                );

                const status = await getAdminPushStatus();
                setPushStatus(status);
 
                toast.error(
                  "Impossible d'activer les notifications",
                  {
                    description:
                      error instanceof Error
                        ? error.message
                        : "Une erreur est survenue.",
                  }
                );
              }
            }}
          >
            <Bell className="size-4" />

            {pushStatus === "enabled"
              ? "Notifications activées"
              : pushStatus === "blocked"
                ? "Notifications bloquées"
                : "Activer les notifications"}
          </Button>

          <Button
            variant="outline"
            className="w-full justify-start rounded-2xl h-11"
            onClick={async () => {
              await loadData();
              setMobileMenuOpen(false);
            }}
            disabled={loading}
          >
            <RefreshCw
              className={
                "size-4 " +
                (loading ? "animate-spin" : "")
              }
            />

            Actualiser les données
          </Button>

          <Button
            variant="outline"
            className="w-full justify-start rounded-2xl h-11"
            asChild
          >
            <Link to="/">
              <ArrowLeft className="size-4" />
              Retour à la boutique
            </Link>
          </Button>

          <Button
            variant="outline"
            className="w-full justify-start rounded-2xl h-11 text-rose-600"
            onClick={async () => {
              await supabase.auth.signOut();

              navigate({
                to: "/admin-login",
              });
            }}
          >
            <LogOut className="size-4" />
            Déconnexion
          </Button>
        </div>
      )}
    </div>
  </header>
  <main className="max-w-7xl mx-auto px-3 sm:px-4 py-4 md:py-8 space-y-5 md:space-y-8">


  {/* INDICATEURS */}
  <section>
    <div className="mb-3 md:mb-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-brand-gold">
        Vue d'ensemble
      </p>

      <h2 className="text-lg md:text-xl font-semibold">
        Activité commerciale
      </h2>
    </div>

    <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5 md:gap-4">

      <KPI
        icon={<Wallet className="size-4" />}
        label="Chiffre d'affaires"
        value={formatFCFA(stats.revenue)}
        accent
      />

      <KPI
        icon={<ShoppingBag className="size-4" />}
        label="Commandes"
        value={String(stats.count)}
      />

      <KPI
        icon={<TrendingUp className="size-4" />}
        label="Panier moyen"
        value={formatFCFA(stats.avg)}
      />

      <KPI
        icon={<ShoppingBag className="size-4" />}
        label="Articles vendus"
        value={String(stats.items)}
      />

      <KPI
        icon={<Sparkles className="size-4" />}
        label="Pépites"
        value={String(stats.pointsGiven)}
        hint={`Solde client : ${points}`}
      />

    </div>
  </section>


  {/* PERFORMANCES */}
  <section>
    <div className="mb-3 md:mb-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-brand-gold">
        Analyse
      </p>

      <h2 className="text-lg md:text-xl font-semibold">
        Performances
      </h2>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">

      {/* Graphique */}
      <div className="bg-card rounded-[24px] md:rounded-[28px] p-4 md:p-6 ring-1 ring-border lg:col-span-2">

        <div className="flex items-center justify-between mb-5 md:mb-6">
          <div>
            <h3 className="text-base md:text-lg font-semibold">
              Ventes des 7 derniers jours
            </h3>

            <p className="text-xs text-muted-foreground mt-0.5">
              Chiffre d'affaires journalier
            </p>
          </div>
        </div>

        <div className="flex items-end gap-1.5 sm:gap-3 h-40 md:h-56">

          {daily.map((d) => {
            const h =
              d.total > 0
                ? Math.max(
                    8,
                    Math.round((d.total / maxDaily) * 100)
                  )
                : 2;

            return (
              <div
                key={d.label}
                className="flex-1 flex flex-col items-center gap-2 h-full"
              >
                <div className="w-full flex-1 flex items-end">
                  <div
                    className="w-full rounded-t-xl bg-brand-gold transition-all duration-500"
                    style={{ height: `${h}%` }}
                    title={formatFCFA(d.total)}
                  />
                </div>

                <span className="text-[10px] font-medium text-muted-foreground capitalize">
                  {d.label}
                </span>
              </div>
            );
          })}

        </div>
      </div>


      {/* Top produits */}
      <div className="bg-card rounded-[24px] md:rounded-[28px] p-4 md:p-6 ring-1 ring-border">

        <h3 className="text-base md:text-lg font-semibold">
          Top produits
        </h3>

        <p className="text-xs text-muted-foreground mt-0.5 mb-5">
          Sur la période sélectionnée
        </p>

        <div className="space-y-4">

          {perProduct.slice(0, 6).map((p) => {
            const pct = Math.round(
              (p.revenue / maxRev) * 100
            );

            return (
              <div key={p.name}>

                <div className="flex justify-between text-sm mb-1.5 gap-2">
                  <span className="font-medium truncate">
                    {p.name}
                  </span>

                  <span className="text-brand-gold font-semibold whitespace-nowrap text-xs">
                    {p.qty} × · {formatFCFA(p.revenue)}
                  </span>
                </div>

                <div className="w-full h-2 bg-brand-warm rounded-full overflow-hidden">
                  <div
                    className="h-full bg-brand-gold rounded-full transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>

              </div>
            );
          })}

        </div>
      </div>

    </div>
  </section>

  {/* COMMANDES — PRIORITÉ */}
  <section className="bg-card rounded-[24px] md:rounded-[28px] ring-1 ring-border overflow-hidden">

<div className="p-4 md:p-6 border-b border-border flex items-center justify-between gap-3">
  <div>
    <div className="flex items-center gap-2">
      <ShoppingBag className="size-5 text-brand-gold" />

      <h2 className="text-base md:text-lg font-semibold">
        Commandes récentes
      </h2>
    </div>

    <p className="text-xs text-muted-foreground mt-1">
      {filtered.length} commande
      {filtered.length > 1 ? "s" : ""} sur la période
    </p>
  </div>
</div>

{filtered.length === 0 ? (
  <div className="p-10 md:p-12 text-center text-sm text-muted-foreground">
    Aucune commande sur cette période.
    <br />
    Les commandes passées depuis la boutique apparaîtront ici.
  </div>
) : (
  <div className="divide-y divide-border">
    {filtered.slice(0, 25).map((o) => (
      <OrderRow
        key={o.id}
        order={o}
        onStatus={async (id, status) => {
          const result = await updateOrderStatus(id, status);

          if (result.error) {
            console.error(
              "ERREUR CHANGEMENT STATUT :",
              result.error
            );

            toast.error(
              status === "cancelled"
                ? "Impossible d'annuler la commande."
                : "Impossible de valider la commande.",
              {
                description: result.error.message,
              }
            );

            return;
          }

          toast.success(
            status === "cancelled"
              ? "Commande annulée."
              : "Commande validée."
          );

          const updated = await getOrders();

          setOrders(
            updated.map((order: any) => ({
              ...order,
              customerName: order.customer_name,
              createdAt: new Date(order.created_at).getTime(),
              rewardSource: order.reward_source ?? null,
              rewardValue: order.reward_value ?? null,
              rewardDiscount: order.reward_discount ?? null,
              lines: (order.order_items ?? []).map((item: any) => ({
                productId: item.product_id,
                name: item.name,
                qty: item.quantity,
                price: item.price,
                category: "",
                note: item.note ?? undefined,
              })),
              pointsEarned: Math.floor(order.total / 100),
            }))
          );
        }}
      />
    ))}
  </div>
)}
</section>


  {/* GESTION DU POINT DE VENTE */}
  {location && (
    <section>

      <div className="mb-3 md:mb-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-brand-gold">
          Gestion
        </p>

        <h2 className="text-lg md:text-xl font-semibold">
          Point de vente
        </h2>

        <p className="text-xs text-muted-foreground mt-0.5">
          Gérez les informations visibles par vos clients.
        </p>
      </div>

      <div className="bg-card rounded-[24px] md:rounded-[28px] p-4 md:p-6 ring-1 ring-border">

        <LocationEditor
          location={location}
          saving={savingLocation}
          onSave={async (values) => {
            setSavingLocation(true);

            const updated = await updateLocation(
              location.id,
              values
            );

            if (updated) {
              setLocation(updated);
              toast.success("Localisation mise à jour.");
            } else {
              toast.error(
                "Impossible de mettre à jour la localisation."
              );
            }

            setSavingLocation(false);
          }}
        />

      </div>
    </section>
  )}


  {/* PARAMÈTRES */}
  {settings && (
    <section>

      <div className="mb-3 md:mb-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-brand-gold">
          Configuration
        </p>

        <div className="flex items-center gap-2">
          <div className="size-9 rounded-xl bg-brand-deep text-brand-gold flex items-center justify-center">
            <Sparkles className="size-4" />
          </div>

          <div>
            <h2 className="text-lg md:text-xl font-semibold">
              Paramètres
            </h2>

            <p className="text-xs text-muted-foreground">
              Fidélité, roue de la chance et parrainage.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-card rounded-[24px] md:rounded-[28px] ring-1 ring-border overflow-hidden">

        <SettingsEditor
          settings={settings}
          saving={savingSettings}
          onSave={async (values) => {
            setSavingSettings(true);

            const updated = await updateAppSettings(values);

            if (updated) {
              setSettings(updated);
              toast.success("Paramètres mis à jour.");
            } else {
              toast.error(
                "Impossible de mettre à jour les paramètres."
              );
            }

            setSavingSettings(false);
          }}
        />

      </div>
    </section>
  )}

</main>
    </div>
  );
}

function KPI({
  icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={
        "min-w-0 rounded-2xl md:rounded-[24px] p-3 md:p-5 ring-1 " +
        (accent
          ? "bg-brand-deep text-brand-cream ring-brand-deep"
          : "bg-card ring-border")
      }
    >
      <div
        className={
          "flex items-center gap-1.5 text-[9px] md:text-[10px] font-bold uppercase tracking-[0.08em] md:tracking-widest " +
          "text-brand-gold"
        }
      >
        <span className="shrink-0">
          {icon}
        </span>

        <span className="truncate">
          {label}
        </span>
      </div>

      <p className="text-lg sm:text-xl md:text-3xl font-semibold mt-2 md:mt-3 tracking-tight truncate">
        {value}
      </p>

      {hint && (
        <p
          className={
            "text-[9px] md:text-[11px] mt-1 truncate " +
            (accent
              ? "text-brand-cream/60"
              : "text-muted-foreground")
          }
        >
          {hint}
        </p>
      )}
    </div>
  );
}

function OrderRow({
  order,
  onStatus,
}: {
  order: Order;
  onStatus: (id: string, status: Order["status"]) => void;
}) {
  const statusConfig = {
    pending: {
      label: "En attente",
      className: "bg-amber-100 text-amber-700",
    },
    done: {
      label: "Livrée",
      className: "bg-emerald-100 text-emerald-700",
    },
    cancelled: {
      label: "Annulée",
      className: "bg-rose-100 text-rose-700",
    },
  } as const;

  const status = statusConfig[order.status];

  const orderDate = new Date(order.createdAt);

  const formattedOrderDate = orderDate.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const formattedOrderTime = orderDate.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const plannedLabel =
    order.mode === "today"
      ? "Pour aujourd'hui"
      : "Pour demain";

  const subtotal = order.lines.reduce(
    (sum, line) => sum + line.price * line.qty,
    0
  );

  const hasDiscount =
    order.rewardDiscount != null && order.rewardDiscount > 0;

  return (
    <article className="px-3 py-1.5 md:px-4 md:py-2">
      <div className="group rounded-2xl bg-card ring-1 ring-border transition-shadow hover:shadow-sm">

        {/* CLIENT + HORAIRES */}
        <div className="px-4 pt-3.5 md:px-5 md:pt-4">

          <div className="flex items-start justify-between gap-3">

            <div className="min-w-0 flex-1">

              <div className="flex items-center gap-2 min-w-0">
                <h3 className="truncate text-sm md:text-[15px] font-semibold tracking-tight">
                  {order.customerName}
                </h3>

                <span
                  className={
                    "shrink-0 rounded-full px-2 py-1 text-[8px] font-bold uppercase tracking-[0.06em] " +
                    status.className
                  }
                >
                  {status.label}
                </span>
              </div>

              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {order.phone}
              </p>

            </div>

          </div>

          {/* Horaires */}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">

            <div className="inline-flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <Clock className="size-3 text-brand-gold" />

              <span>
                Commandée le{" "}
                <span className="font-medium text-foreground">
                  {formattedOrderDate}
                </span>
                {" à "}
                <span className="font-medium text-foreground">
                  {formattedOrderTime}
                </span>
              </span>
            </div>

            <span className="hidden sm:block h-3 w-px bg-border" />

            <div className="inline-flex items-center rounded-lg bg-brand-cream/60 px-2 py-1 text-[10px] font-semibold text-brand-deep">
              {plannedLabel}
              <span className="ml-1">
                à {order.time}
              </span>
            </div>

          </div>
        </div>

        {/* PRODUITS */}
        <div className="px-4 pt-3.5 md:px-5 md:pt-4">

          <div className="rounded-xl bg-muted/30 overflow-hidden">

            <div className="flex items-center justify-between px-3 py-2 border-b border-border/60">
              <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                Produits
              </span>

              <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                Prix
              </span>
            </div>

            <div className="px-3 py-2.5 md:px-3.5 md:py-3">

              <div className="space-y-2.5">

                {order.lines.map((line, index) => (
                  <div
                    key={`${line.productId}-${index}`}
                    className="flex items-start justify-between gap-4"
                  >

                    <div className="min-w-0 flex-1">

                      <div className="flex items-baseline gap-2">

                        <span className="shrink-0 text-xs font-bold text-brand-deep">
                          {line.qty}×
                        </span>

                        <span className="min-w-0 text-xs md:text-sm font-medium leading-tight">
                          {line.name}
                        </span>

                      </div>

                      {line.note && (
                        <p className="ml-5 mt-0.5 text-[10px] text-amber-700">
                          {line.note}
                        </p>
                      )}

                    </div>

                    <span className="shrink-0 pt-0.5 text-xs md:text-sm font-semibold">
                      {formatFCFA(line.price * line.qty)}
                    </span>

                  </div>
                ))}

              </div>

            </div>

          </div>
        </div>

        {/* RÉCAPITULATIF FINANCIER */}
        <div className="px-4 pt-3 md:px-5 md:pt-3.5">

          <div className="rounded-xl bg-brand-deep px-3.5 py-3 md:px-4 md:py-3.5 text-brand-cream">

            <div className="space-y-1.5">

              {/* Sous-total */}
              <div className="flex items-center justify-between gap-4">
                <span className="text-[10px] text-brand-cream/65">
                  Sous-total
                </span>

                <span className="text-xs font-medium">
                  {formatFCFA(subtotal)}
                </span>
              </div>

              {/* Récompense / réduction */}
              {hasDiscount && (
                <div className="flex items-center justify-between gap-4">
                  <span className="min-w-0 truncate text-[10px] text-brand-cream/80">
                    {order.rewardValue
                       ? `Réduction fidélité 🎁 ${order.rewardValue}`
                       : "Réduction 🎁"}
                  </span>

                  <span className="shrink-0 text-xs font-semibold text-brand-gold">
                      −{formatFCFA(order.rewardDiscount!)}
                  </span>
                </div>
              )}

              {/* Total */}
              <div className="mt-2 flex items-end justify-between gap-4 border-t border-brand-cream/15 pt-2">

                <div>
                  <p className="text-[9px] uppercase tracking-wider text-brand-cream/60">
                    Total à payer
                  </p>

                  <p className="mt-0.5 text-[10px] font-medium text-brand-gold">
                    +{order.pointsEarned} pépites
                  </p>
                </div>

                <p className="text-lg md:text-xl font-bold leading-none">
                  {formatFCFA(order.total)}
                </p>

              </div>

            </div>

          </div>

        </div>

        {/* ACTIONS */}
        <div className="flex justify-end px-4 py-2 md:px-5 md:py-2.5">
  <div className="flex items-center gap-1.5">
    {order.status !== "done" && (
      <Button
        size="icon"
        variant="ghost"
        className="size-9 rounded-full bg-emerald-50 hover:bg-emerald-100"
        onClick={() => onStatus(order.id, "done")}
        aria-label="Marquer comme livrée"
      >
        <Check className="size-4.5 text-emerald-600" />
      </Button>
    )}

    {order.status !== "cancelled" && (
      <Button
        size="icon"
        variant="ghost"
        className="size-9 rounded-full bg-rose-50 hover:bg-rose-100"
        onClick={() =>
          onStatus(order.id, "cancelled")
        }
        aria-label="Annuler la commande"
      >
        <Trash2 className="size-4.5 text-rose-500" />
      </Button>
    )}
  </div>
</div>

      </div>
    </article>
  );
}

function LocationEditor({
  location,
  saving,
  onSave,
}: {
  location: Location;
  saving: boolean;
  onSave: (values: {
    name: string;
    address: string;
    latitude: number | null;
    longitude: number | null;
    start_time: string;
    end_time: string;
    active: boolean;
  }) => Promise<void>;
}) {
  const [active, setActive] = useState(location.active);
  const [name, setName] = useState(location.name);
  const [address, setAddress] = useState(location.address ?? "");
  const [latitude, setLatitude] = useState(
    location.latitude?.toString() ?? ""
  );
  const [longitude, setLongitude] = useState(
    location.longitude?.toString() ?? ""
  );
  const [startTime, setStartTime] = useState(
    location.start_time?.slice(0, 5) ?? "09:00"
  );
  const [endTime, setEndTime] = useState(
    location.end_time?.slice(0, 5) ?? "15:00"
  );

  async function handleSave() {
    const lat = latitude.trim()
      ? Number(latitude.replace(",", "."))
      : null;

    const lng = longitude.trim()
      ? Number(longitude.replace(",", "."))
      : null;

    if (
      (lat !== null && Number.isNaN(lat)) ||
      (lng !== null && Number.isNaN(lng))
    ) {
      alert("Les coordonnées GPS doivent être numériques.");
      return;
    }

    await onSave({
      name: name.trim(),
      address: address.trim(),
      latitude: lat,
      longitude: lng,
      start_time: startTime,
      end_time: endTime,
      active,
    });
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

      <div className="md:col-span-2 flex items-center justify-between rounded-2xl border p-4 bg-background">
        <div>
          <p className="font-medium">
            Afficher la localisation sur le site
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Désactivez cette option lorsqu'il n'y a pas de présence physique.
          </p>
        </div>

        <Switch
          checked={active}
          onCheckedChange={setActive}
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium">Lieu</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full h-11 rounded-xl border bg-background px-4 text-sm"
          placeholder="Université de Lomé"
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium">Adresse</label>
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className="w-full h-11 rounded-xl border bg-background px-4 text-sm"
          placeholder="Campus principal, Lomé"
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium">Latitude</label>
        <input
          value={latitude}
          onChange={(e) => setLatitude(e.target.value)}
          className="w-full h-11 rounded-xl border bg-background px-4 text-sm"
          placeholder="6.173669"
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium">Longitude</label>
        <input
          value={longitude}
          onChange={(e) => setLongitude(e.target.value)}
          className="w-full h-11 rounded-xl border bg-background px-4 text-sm"
          placeholder="1.215866"
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium">Ouverture</label>
        <input
          type="time"
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
          className="w-full h-11 rounded-xl border bg-background px-4 text-sm"
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium">Fermeture</label>
        <input
          type="time"
          value={endTime}
          onChange={(e) => setEndTime(e.target.value)}
          className="w-full h-11 rounded-xl border bg-background px-4 text-sm"
        />
      </div>

      <div className="md:col-span-2 flex justify-end pt-2">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="rounded-full px-6"
        >
          {saving ? "Enregistrement..." : "Enregistrer la localisation"}
        </Button>
      </div>
    </div>
  );
}

function SettingsEditor({
  settings,
  saving,
  onSave,
}: {
  settings: AppSettings;
  saving: boolean;
  onSave: (values: {
    loyalty_threshold: number;
    loyalty_reward: string;
    wheel_prizes: WheelSetting[];
    referral_surprises: ReferralSurpriseSetting[];
  }) => Promise<void>;
}) {
  const [threshold, setThreshold] = useState(
    settings.loyalty_threshold
  );

  const [reward, setReward] = useState(
    settings.loyalty_reward
  );

  const [prizes, setPrizes] = useState<WheelSetting[]>(
    settings.wheel_prizes
  );

  const [referralSurprises, setReferralSurprises] =
    useState<ReferralSurpriseSetting[]>(
      settings.referral_surprises ?? []
    );

  const totalWeight = prizes.reduce(
    (sum, prize) => sum + Number(prize.weight),
    0
  );

  const referralTotalWeight = referralSurprises.reduce(
    (sum, reward) => sum + Number(reward.weight),
    0
  );

  function updatePrizeWeight(index: number, weight: number) {
    setPrizes((current) =>
      current.map((prize, i) =>
        i === index
          ? { ...prize, weight }
          : prize
      )
    );
  }

  function updateReferralSurpriseWeight(
    index: number,
    weight: number
  ) {
    setReferralSurprises((current) =>
      current.map((reward, i) =>
        i === index
          ? { ...reward, weight }
          : reward
      )
    );
  }

  function updateReferralSurpriseLabel(
    index: number,
    label: string
  ) {
    setReferralSurprises((current) =>
      current.map((reward, i) =>
        i === index
          ? { ...reward, label }
          : reward
      )
    );
  }

  async function handleSave() {
    const cleanThreshold = Math.floor(Number(threshold));

    if (
      !Number.isFinite(cleanThreshold) ||
      cleanThreshold <= 0
    ) {
      toast.error(
        "Le seuil de fidélité doit être un nombre positif."
      );
      return;
    }

    if (totalWeight !== 100) {
      toast.error(
        `Les probabilités de la roue doivent totaliser 100 %. Actuellement : ${totalWeight} %.`
      );
      return;
    }

    if (
      prizes.some(
        (prize) => Number(prize.weight) < 0
      )
    ) {
      toast.error(
        "Une probabilité ne peut pas être négative."
      );
      return;
    }

    if (referralTotalWeight !== 100) {
      toast.error(
        `Les probabilités des surprises doivent totaliser 100 %. Actuellement : ${referralTotalWeight} %.`
      );
      return;
    }

    if (
      referralSurprises.some(
        (item) =>
          !item.label.trim() ||
          Number(item.weight) < 0
      )
    ) {
      toast.error(
        "Chaque surprise doit avoir un nom et une probabilité valide."
      );
      return;
    }

    await onSave({
      loyalty_threshold: cleanThreshold,

      loyalty_reward: reward,

      wheel_prizes: prizes.map((prize) => ({
        label: prize.label,
        weight: Number(prize.weight),
      })),

      referral_surprises: referralSurprises.map(
        (item) => ({
          label: item.label.trim(),
          weight: Number(item.weight),
        })
      ),
    });
  }

  return (
    <div className="space-y-5">
  
      {/* FIDÉLITÉ */}
      <div className="rounded-2xl border bg-card p-4 md:p-5">
        <div className="mb-5 flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-gold/15 text-lg">
            🎁
          </div>
  
          <div className="min-w-0">
            <h3 className="font-semibold text-brand-deep">
              Fidélité
            </h3>
  
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Définissez le nombre de pépites nécessaire
              pour débloquer une récompense.
            </p>
          </div>
        </div>
  
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
  
          <div className="space-y-1.5">
            <label className="text-xs font-semibold">
              Seuil de récompense
            </label>
  
            <input
              type="number"
              min="1"
              value={threshold}
              onChange={(e) =>
                setThreshold(Number(e.target.value))
              }
              className="h-11 w-full rounded-xl border bg-background px-4 text-sm outline-none transition focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20"
            />
  
            <p className="text-[10px] text-muted-foreground">
              Nombre de pépites à atteindre
            </p>
          </div>
  
          <div className="space-y-1.5">
            <label className="text-xs font-semibold">
              Réduction fidélité
            </label>
  
            <div className="relative">
              <input
                type="number"
                min="1"
                max="100"
                value={reward
                  .replace("%", "")
                  .replace("-", "")}
                onChange={(e) => {
                  const value = Math.max(
                    1,
                    Math.min(
                      100,
                      Number(e.target.value)
                    )
                  );
  
                  setReward(`-${value}%`);
                }}
                className="h-11 w-full rounded-xl border bg-background px-4 pr-10 text-sm outline-none transition focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20"
              />
  
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">
                %
              </span>
            </div>
  
            <p className="text-[10px] text-muted-foreground">
              Réduction accordée avec la récompense
            </p>
          </div>
  
        </div>
      </div>
  
  
      {/* ROUE */}
      <div className="rounded-2xl border bg-card p-4 md:p-5">
  
        <div className="mb-5 flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-gold/15 text-lg">
            🎡
          </div>
  
          <div className="min-w-0">
            <h3 className="font-semibold text-brand-deep">
              Roue de la chance
            </h3>
  
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Ajustez les probabilités de chaque récompense
              disponible sur la roue.
            </p>
          </div>
        </div>
  
        <div className="space-y-2">
  
          {prizes.map((prize, index) => (
            <div
              key={`${prize.label}-${index}`}
              className="flex items-center gap-3 rounded-xl bg-muted/40 px-3 py-2.5"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {prize.label.trim()}
                </p>
              </div>
  
              <input
                type="number"
                min="0"
                max="100"
                value={prize.weight}
                onChange={(e) =>
                  updatePrizeWeight(
                    index,
                    Number(e.target.value)
                  )
                }
                className="h-9 w-16 shrink-0 rounded-lg border bg-background px-2 text-center text-sm outline-none transition focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20"
              />
  
              <span className="w-4 shrink-0 text-xs font-medium text-muted-foreground">
                %
              </span>
            </div>
          ))}
  
        </div>
  
        <div
          className={
            "mt-4 flex items-center justify-between rounded-xl px-3 py-3 text-xs font-semibold " +
            (totalWeight === 100
              ? "bg-emerald-50 text-emerald-700"
              : "bg-amber-50 text-amber-700")
          }
        >
          <span>Total des probabilités</span>
          <span>{totalWeight} %</span>
        </div>
  
      </div>
  
  
      {/* SURPRISES DE PARRAINAGE */}
      <div className="rounded-2xl border bg-card p-4 md:p-5">
  
        <div className="mb-5 flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-gold/15 text-lg">
            🎉
          </div>
  
          <div className="min-w-0">
            <h3 className="font-semibold text-brand-deep">
              Surprise Gourmande
            </h3>
  
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Définissez les récompenses offertes au parrain
              après la première commande de son filleul.
            </p>
          </div>
        </div>
  
        <div className="space-y-2">
  
          {referralSurprises.length === 0 ? (
            <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
              Aucune surprise de parrainage configurée.
            </div>
          ) : (
            referralSurprises.map((item, index) => (
              <div
                key={`${item.label}-${index}`}
                className="flex items-center gap-3 rounded-xl bg-muted/40 p-2.5"
              >
  
                <div className="min-w-0 flex-1">
                  <input
                    value={item.label}
                    onChange={(e) =>
                      updateReferralSurpriseLabel(
                        index,
                        e.target.value
                      )
                    }
                    className="h-9 w-full rounded-lg border bg-background px-3 text-sm outline-none transition focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20"
                    placeholder="Nom de la surprise"
                  />
                </div>
  
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={item.weight}
                  onChange={(e) =>
                    updateReferralSurpriseWeight(
                      index,
                      Number(e.target.value)
                    )
                  }
                  className="h-9 w-16 shrink-0 rounded-lg border bg-background px-2 text-center text-sm outline-none transition focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20"
                />
  
                <span className="w-4 shrink-0 text-xs font-medium text-muted-foreground">
                  %
                </span>
  
              </div>
            ))
          )}
  
        </div>
  
        <div
          className={
            "mt-4 flex items-center justify-between rounded-xl px-3 py-3 text-xs font-semibold " +
            (referralTotalWeight === 100
              ? "bg-emerald-50 text-emerald-700"
              : "bg-amber-50 text-amber-700")
          }
        >
          <span>Total des probabilités</span>
          <span>{referralTotalWeight} %</span>
        </div>
  
      </div>
  
  
      {/* BOUTON */}
      <div className="flex justify-end pt-1">
  
        <Button
          onClick={handleSave}
          disabled={
            saving ||
            totalWeight !== 100 ||
            referralTotalWeight !== 100
          }
          className="h-11 w-full rounded-xl px-6 sm:w-auto"
        >
          {saving
            ? "Enregistrement..."
            : "Enregistrer les paramètres"}
        </Button>
  
      </div>
  
    </div>
  );
}