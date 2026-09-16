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
      <header className="sticky top-0 z-40 bg-brand-cream/90 backdrop-blur-md border-b border-brand-gold/10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild className="rounded-full">
              <Link to="/">
                <ArrowLeft className="size-4" /> Boutique
              </Link>
            </Button>
            <div className="hidden md:block h-6 w-px bg-border" />
            <div>
              <p className="text-[10px] font-semibold text-brand-gold uppercase tracking-[0.12em]">
                Tableau de bord
              </p>
              <p className="text-sm font-semibold">Pause Gourmande — Lomé</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-1 rounded-full bg-white ring-1 ring-border p-1">
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

          <NotificationBell
            notifications={notifications}
            unreadCount={unreadNotifications}
            onNotificationRead={(id) => {
              setNotifications((current) =>
                current.map((notification) =>
                  notification.id === id
                    ? {
                        ...notification,
                        read: true,
                      }
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
          variant="outline"
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
          {pushStatus === "enabled"
            ? "🔔 Notifications activées"
            : pushStatus === "blocked"
              ? "🔕 Notifications bloquées"
              : "🔔 Activer les notifications"}
        </Button>

          <Button
            variant="outline"
            size="sm"
            className="rounded-full flex items-center gap-2"
            onClick={loadData}
            disabled={loading}
          >
            <RefreshCw
              className={
                "size-4 " + (loading ? "animate-spin" : "")
              }
            />

            <span className="hidden sm:inline">
              Actualiser
            </span>
          </Button>

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
           <span className="hidden sm:inline">
            Déconnexion
            </span>
          </Button>

        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-10 space-y-10">

      {/* Localisation */}
      {location && (
      <section className="bg-card rounded-[28px] p-6 ring-1 ring-border">
        <div className="mb-6">
          <h2 className="text-lg font-semibold">Localisation du jour</h2>
          <p className="text-xs text-muted-foreground">
           Modifiez ici l'emplacement visible par les clients.
          </p>
        </div>

      {location ? (
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
                toast.error("Impossible de mettre à jour la localisation.");
              }

              setSavingLocation(false);
            }}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            Aucune localisation active.
          </p>
        )}
      </section>
    )}

        {/* KPIs */}
        <section className="grid grid-cols-2 lg:grid-cols-5 gap-4">
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
            label="Pépites distribuées"
            value={String(stats.pointsGiven)}
            hint={`Solde client : ${points}`}
          />
        </section>

        {/* Paramètres */}
        {settings && (
          <section className="bg-card rounded-[28px] p-6 ring-1 ring-border">
            <div className="mb-6">
              <h2 className="text-lg font-semibold">
                Paramètres de l'application
              </h2>

              <p className="text-xs text-muted-foreground mt-1">
                Contrôlez les règles de fidélité et les probabilités de la roue.
              </p>
            </div>

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
                  toast.error("Impossible de mettre à jour les paramètres.");
                }

                setSavingSettings(false);
              }}
            />
          </section>
        )}

        {/* Chart + product perf */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-card rounded-[28px] p-6 ring-1 ring-border lg:col-span-2">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold">Ventes des 7 derniers jours</h2>
                <p className="text-xs text-muted-foreground">Chiffre d'affaires journalier</p>
              </div>
            </div>
            <div className="flex items-end gap-3 h-56">
              {daily.map((d) => {
                const h =
                  d.total > 0
                    ? Math.max(8, Math.round((d.total / maxDaily) * 100))
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
                        title={`${formatFCFA(d.total)}`}
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

          <div className="bg-card rounded-[28px] p-6 ring-1 ring-border">
            <h2 className="text-lg font-semibold mb-1">Top produits</h2>
            <p className="text-xs text-muted-foreground mb-5">
              Sur la période sélectionnée
            </p>
            <div className="space-y-4">
              {perProduct.slice(0, 6).map((p) => {
                const pct = Math.round((p.revenue / maxRev) * 100);
                return (
                  <div key={p.name}>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="font-medium truncate pr-2">{p.name}</span>
                      <span className="text-brand-gold font-semibold whitespace-nowrap">
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
        </section>

        {/* Orders */}
        <section className="bg-card rounded-[28px] ring-1 ring-border overflow-hidden">
          <div className="p-6 border-b border-border flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Commandes récentes</h2>
              <p className="text-xs text-muted-foreground">
                {filtered.length} commande{filtered.length > 1 ? "s" : ""} sur la période
              </p>
            </div>
          </div>
          {filtered.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted-foreground">
              Aucune commande sur cette période. Les commandes passées depuis la boutique
              apparaîtront ici.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.slice(0, 25).map((o) => (
                <OrderRow
                key={o.id}
                order={o}
                onStatus={async (id, status) => {

                  await updateOrderStatus(id, status);

                  const updated = await getOrders();

                  setOrders(
                    updated.map((order: any) => ({
                      ...order,
                      customerName: order.customer_name,
                      createdAt: new Date(order.created_at).getTime(),
                      lines: (order.order_items ?? []).map((item:any)=>({
                        productId:item.product_id,
                        name:item.name,
                        qty:item.quantity,
                        price:item.price,
                        category:"",
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
        "rounded-[24px] p-5 ring-1 " +
        (accent
          ? "bg-brand-deep text-brand-cream ring-brand-deep"
          : "bg-card ring-border")
      }
    >
      <div
        className={
          "flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest " +
          (accent ? "text-brand-gold" : "text-brand-gold")
        }
      >
        {icon}
        {label}
      </div>
      <p className="text-2xl md:text-3xl font-semibold mt-3 tracking-tight">{value}</p>
      {hint && (
        <p
          className={
            "text-[11px] mt-1 " +
            (accent ? "text-brand-cream/60" : "text-muted-foreground")
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
  const date = new Date(order.createdAt);
  const badge =
    order.status === "done"
      ? "bg-emerald-100 text-emerald-700"
      : order.status === "cancelled"
        ? "bg-rose-100 text-rose-700"
        : "bg-amber-100 text-amber-700";
  return (
    <div className="p-5 flex flex-col md:flex-row md:items-center gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold truncate">{order.customerName}</span>
          <span className="text-xs text-muted-foreground">· {order.phone}</span>
          <span className={"text-[10px] font-bold uppercase px-2 py-0.5 rounded-full " + badge}>
            {order.status === "done"
              ? "Livrée"
              : order.status === "cancelled"
                ? "Annulée"
                : "En attente"}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
          <Clock className="size-3" />
          {date.toLocaleString("fr-FR", {
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          })}
          <span>·</span>
          <span>
            {order.mode === "today" ? "Aujourd'hui" : "Demain"} à {order.time}
          </span>
        </p>
        <div className="text-sm mt-2 text-foreground/80 space-y-1">
          {order.lines.map((l) => (
            <div key={l.productId}>
              <span>
                {l.qty}× {l.name}
              </span>

             {l.note && (
              <p className="text-xs text-amber-700 ml-4 mt-0.5">
                📝 {l.note}
              </p>
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-4 md:gap-6 md:justify-end">
        <div className="text-right">
          <p className="font-semibold">{formatFCFA(order.total)}</p>
          <p className="text-[11px] text-brand-gold font-medium">
            +{order.pointsEarned} pépites
          </p>
        </div>
        <div className="flex gap-1.5">
          {order.status !== "done" && (
            <Button
              size="icon"
              variant="outline"
              className="size-8 rounded-full"
              onClick={() => onStatus(order.id, "done")}
              aria-label="Marquer livrée"
            >
              <Check className="size-4 text-emerald-600" />
            </Button>
          )}
          {order.status !== "cancelled" && (
            <Button
              size="icon"
              variant="outline"
              className="size-8 rounded-full"
              onClick={() => onStatus(order.id, "cancelled")}
              aria-label="Annuler"
            >
              <Trash2 className="size-4 text-rose-500" />
            </Button>
          )}
        </div>
      </div>
    </div>
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
    <div className="space-y-8">

      {/* FIDÉLITÉ */}
      <div>
        <div className="mb-4">
          <h3 className="font-semibold">
            Fidélité
          </h3>

          <p className="text-xs text-muted-foreground">
            Définissez le nombre de pépites nécessaire
            pour débloquer une récompense.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          <div className="space-y-1">
            <label className="text-xs font-medium">
              Seuil de récompense
            </label>

            <input
              type="number"
              min="1"
              value={threshold}
              onChange={(e) =>
                setThreshold(
                  Number(e.target.value)
                )
              }
              className="w-full h-11 rounded-xl border bg-background px-4 text-sm"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium">
              Réduction fidélité (%)
            </label>

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
              className="w-full h-11 rounded-xl border bg-background px-4 text-sm"
            />
          </div>

        </div>
      </div>


      {/* ROUE */}
      <div>
        <div className="mb-4">
          <h3 className="font-semibold">
            Roue de la chance
          </h3>

          <p className="text-xs text-muted-foreground">
            Les poids déterminent les probabilités
            relatives de chaque case.
          </p>
        </div>

        <div className="space-y-3">

          {prizes.map((prize, index) => (
            <div
              key={`${prize.label}-${index}`}
              className="flex items-center gap-3"
            >

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
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
                className="w-20 h-10 rounded-xl border bg-background px-3 text-sm text-center"
              />

              <span className="text-xs text-muted-foreground w-6">
                %
              </span>

            </div>
          ))}

        </div>

        <div
          className={
            "mt-4 rounded-xl p-3 text-sm font-medium " +
            (totalWeight === 100
              ? "bg-emerald-50 text-emerald-700"
              : "bg-amber-50 text-amber-700")
          }
        >
          Total des probabilités : {totalWeight} %
        </div>
      </div>


      {/* SURPRISES DE PARRAINAGE */}
      <div>

        <div className="mb-4">
          <h3 className="font-semibold">
            🎁 Surprise Gourmande
          </h3>

          <p className="text-xs text-muted-foreground">
            Définissez les récompenses offertes au
            parrain après la première commande de son
            filleul.
          </p>
        </div>

        <div className="space-y-3">

          {referralSurprises.length === 0 ? (
            <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
              Aucune surprise de parrainage configurée.
            </div>
          ) : (
            referralSurprises.map(
              (item, index) => (
                <div
                  key={`${item.label}-${index}`}
                  className="flex items-center gap-3"
                >

                  <div className="flex-1 min-w-0">
                    <input
                      value={item.label}
                      onChange={(e) =>
                        updateReferralSurpriseLabel(
                          index,
                          e.target.value
                        )
                      }
                      className="w-full h-10 rounded-xl border bg-background px-3 text-sm"
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
                    className="w-20 h-10 rounded-xl border bg-background px-3 text-sm text-center"
                  />

                  <span className="text-xs text-muted-foreground w-6">
                    %
                  </span>

                </div>
              )
            )
          )}

        </div>

        <div
          className={
            "mt-4 rounded-xl p-3 text-sm font-medium " +
            (referralTotalWeight === 100
              ? "bg-emerald-50 text-emerald-700"
              : "bg-amber-50 text-amber-700")
          }
        >
          Total des probabilités :{" "}
          {referralTotalWeight} %
        </div>

      </div>


      {/* BOUTON */}
      <div className="flex justify-end">

        <Button
          onClick={handleSave}
          disabled={
            saving ||
            totalWeight !== 100 ||
            referralTotalWeight !== 100
          }
          className="rounded-full px-6"
        >
          {saving
            ? "Enregistrement..."
            : "Enregistrer les paramètres"}
        </Button>

      </div>

    </div>
  );
}