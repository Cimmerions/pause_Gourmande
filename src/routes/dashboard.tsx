import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { adminSupabase } from "@/lib/admin-supabase";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { NotificationBell } from "@/components/NotificationBell";
import { registerPushSubscription, getAdminPushStatus, unregisterAdminPushSubscription } from "@/lib/push";
import { Search, ChevronDown, ChevronUp } from "lucide-react";
import { CalendarDays, Lock, Unlock, Plus } from "lucide-react";
import { getFunctionErrorMessage } from "@/lib/function-errors";
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
  MapPin,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCart, type Order } from "@/lib/cart-store";
import { getProducts, formatFCFA, type Product } from "@/lib/products";
import {
  getOrders,
  updateOrderStatus,
  proposeDeliveryFee,
  getActiveDeliveryDrivers,
  assignDeliveryDriver,
  markDeliveryReady,
  type ActiveDeliveryDriver,
} from "@/lib/orders";
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
  DEFAULT_ORDER_SETTINGS,
  type AppSettings,
  type OrderSettings,
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
  const [deliveryDrivers, setDeliveryDrivers] = useState<
    ActiveDeliveryDriver[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [recentOrdersCollapsed, setRecentOrdersCollapsed] = useState(false);
  const points = 0;
  const [range, setRange] = useState<Range>("7d");
  const [products, setProducts] = useState<Product[]>([]);
  const navigate = useNavigate();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [location, setLocation] = useState<Location | null>(null);
  const [savingLocation, setSavingLocation] = useState(false);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [orderSettings, setOrderSettings] = useState<OrderSettings>(DEFAULT_ORDER_SETTINGS);
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingDayStatus, setSavingDayStatus] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [pushStatus, setPushStatus] = useState<
    "enabled" | "disabled" | "blocked"
  >("disabled");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [orderSearch, setOrderSearch] = useState("");
  const [ordersToShow, setOrdersToShow] = useState(10);

  const [slotDate, setSlotDate] = useState("");
  const [slotDates, setSlotDates] = useState<string[]>([]);
  const [slotRows, setSlotRows] = useState<
    { slot_time: string; available: boolean; remaining: number; blocked: boolean }[]
  >([]);
  const [loadingSlotRows, setLoadingSlotRows] = useState(false);
  const [busySlot, setBusySlot] = useState<string | null>(null);
  const [slotsExpanded, setSlotsExpanded] = useState(false);
  const [assigningOrderId, setAssigningOrderId] = useState<string | null>(null);
  const [markingReadyOrderId, setMarkingReadyOrderId] = useState<string | null>(null);
  const [selectedDriverId, setSelectedDriverId] = useState("");

  const ADMIN_SESSION_DURATION = 24 * 60 * 60 * 1000;

  async function handleAssignDriver(
  orderId: string,
  driverUserId: string | null
) {
  setAssigningOrderId(orderId);

  try {
    await assignDeliveryDriver(orderId, driverUserId);

    setOrders((current) =>
      current.map((order) =>
        order.id === orderId
          ? { ...order, assignedDriverId: driverUserId }
          : order
      )
    );

    toast.success(
      driverUserId
        ? "Livreur attribué à la commande."
        : "Attribution du livreur retirée."
    );
  } catch (error) {
    console.error("Erreur d’attribution du livreur :", error);
    toast.error(
      error instanceof Error
        ? error.message
        : "Impossible de modifier l’attribution."
    );
  } finally {
    setAssigningOrderId(null);
  }
}

async function handleMarkDeliveryReady(orderId: string) {
  setMarkingReadyOrderId(orderId);

  try {
    const { error } = await markDeliveryReady(orderId);

    if (error) {
      throw error;
    }

    toast.success(
      "Commande prête. La demande de notification au livreur a été envoyée."
    );

    await loadData();
  } catch (error) {
    console.error(
      "Erreur lors du passage en prêt à livrer :",
      error
    );

    toast.error(
      error instanceof Error
        ? error.message
        : "Impossible de marquer la commande comme prête."
    );
  } finally {
    setMarkingReadyOrderId(null);
  }
}


async function loadData() {
  setLoading(true);

  try {
    const [productsData, ordersData] = await Promise.all([
      getProducts(),
      getOrders(),
    ]);

    try {
      setDeliveryDrivers(await getActiveDeliveryDrivers());
    } catch (error) {
      console.error("Erreur chargement des livreurs :", error);
      toast.error("Impossible de charger les livreurs actifs.");
    }

    const locationData = await getLocation();
    const settingsData = await getAppSettings();

    setProducts(productsData);
    setLocation(locationData);
    setSettings(settingsData);

    setOrderSettings(
      settingsData?.order_settings ?? DEFAULT_ORDER_SETTINGS
    );

    setOrders(
      ordersData.map((order: any) => ({
        ...order,
        customerName: order.customer_name,
        receptionMode: order.reception_mode ?? "pickup",
        deliveryLatitude: order.delivery_latitude ?? null,
        deliveryLongitude: order.delivery_longitude ?? null,
        deliveryFee: Number(order.delivery_fee ?? 0),
        deliveryStatus: order.delivery_status ?? null,
        createdAt: new Date(order.created_at).getTime(),
        rewardSource: order.reward_source ?? null,
        rewardValue: order.reward_value ?? null,
        rewardDiscount: order.reward_discount ?? null,
        pointsAwarded: order.points_awarded ?? false,
        pointsAwardedAmount: Number(
          order.points_awarded_amount ?? 0
        ),
        lines: (order.order_items ?? []).map((item: any) => ({
          productId: item.product_id,
          name: item.name,
          qty: item.quantity,
          price: item.price,
          category: "",
          note: item.note ?? undefined,
        })),
        pointsEarned: Math.floor(order.total / 100),
        assignedDriverId: order.assigned_driver_id ?? null,
      }))
    );
  } catch (error) {
    console.error(
      "Erreur lors du chargement des données du dashboard :",
      error
    );

    toast.error("Impossible d'actualiser le dashboard.", {
      description:
        error instanceof Error
          ? error.message
          : "Une erreur inattendue est survenue.",
    });
  } finally {
    setLoading(false);
  }
}

  // Dates ouvertes : aujourd'hui et les 7 prochains jours à Lomé.
  useEffect(() => {
    if (!settings) return;

    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Africa/Lome",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());

    const part = (type: string) =>
      parts.find((item) => item.type === type)?.value ?? "";

    const today = new Date(Date.UTC(
      Number(part("year")),
      Number(part("month")) - 1,
      Number(part("day")),
    ));

    const openDays = settings.order_settings.open_days ?? [];

    const dates = Array.from({ length: 8 }, (_, offset) => {
      const date = new Date(today);
        date.setUTCDate(date.getUTCDate() + offset);

        return [
          date.getUTCFullYear(),
          String(date.getUTCMonth() + 1).padStart(2, "0"),
          String(date.getUTCDate()).padStart(2, "0"),
        ].join("-");
      });

    setSlotDates(dates);
    setSlotDate((current) =>
      dates.includes(current) ? current : dates[0] ?? ""
    );
  }, [settings]);

  // Chargement des créneaux de la date sélectionnée.
  useEffect(() => {
    if (!settings || !slotDate) {
      setSlotRows([]);
      return;
    }

    let cancelled = false;

    async function loadSlotRows() {
      setLoadingSlotRows(true);

      try {
        const [
          { data: slots, error: slotsError },
          { data: blocks, error: blocksError },
        ] = await Promise.all([
          adminSupabase.rpc("get_admin_order_slots", {
            p_date: slotDate,
          }),
          adminSupabase
            .from("order_slot_blocks")
            .select("slot_time")
            .eq("slot_date", slotDate),
        ]);

        if (slotsError) throw slotsError;
        if (blocksError) throw blocksError;
        if (cancelled) return;

        const blockedTimes = new Set(
          (blocks ?? []).map((block: { slot_time: string }) =>
            block.slot_time.slice(0, 5)
          )
        );

        setSlotRows(
          ((slots ?? []) as {
            slot_time: string;
            available: boolean;
            remaining: number;
          }[]).map((slot) => ({
            ...slot,
            blocked: blockedTimes.has(slot.slot_time.slice(0, 5)),
          }))
        );
      } catch (error) {
        console.error("Erreur de chargement des créneaux :", error);

        if (!cancelled) {
          setSlotRows([]);
          toast.error(
            "Impossible de charger les créneaux. Vérifiez la connexion et les autorisations."
          );
        }
      } finally {
        if (!cancelled) setLoadingSlotRows(false);
      }
    }

    void loadSlotRows();

    return () => {
      cancelled = true;
    };
  }, [settings, slotDate]);

  async function toggleSlotBlock(slotTime: string, blocked: boolean) {
    if (!slotDate || busySlot) return;

    const normalizedTime = slotTime.slice(0, 5);
    const key = `${slotDate}-${normalizedTime}`;
    setBusySlot(key);

    try {
      if (blocked) {
        const { error } = await adminSupabase
          .from("order_slot_blocks")
          .delete()
          .eq("slot_date", slotDate)
          .eq("slot_time", normalizedTime);

        if (error) throw error;
        toast.success(`Blocage du créneau ${normalizedTime} retiré.`);
      } else {
        const { error } = await adminSupabase
          .from("order_slot_blocks")
          .insert({
            slot_date: slotDate,
            slot_time: normalizedTime,
            reason: "Bloqué manuellement par la vendeuse",
          });

        if (error) throw error;
        toast.success(`Créneau ${normalizedTime} bloqué.`);
      }

      const [{ data: slots, error: slotsError }, { data: blocks, error: blocksError }] =
        await Promise.all([
          adminSupabase.rpc("get_admin_order_slots", { p_date: slotDate }),
          adminSupabase
            .from("order_slot_blocks")
            .select("slot_time")
            .eq("slot_date", slotDate),
        ]);

      if (slotsError) throw slotsError;
      if (blocksError) throw blocksError;

      const blockedTimes = new Set(
        (blocks ?? []).map((block: { slot_time: string }) =>
          block.slot_time.slice(0, 5)
        )
      );

      setSlotRows(
        ((slots ?? []) as {
          slot_time: string;
          available: boolean;
          remaining: number;
        }[]).map((slot) => ({
          ...slot,
          blocked: blockedTimes.has(slot.slot_time.slice(0, 5)),
        }))
      );
    } catch (error) {
      console.error("Erreur de modification du blocage :", error);
      toast.error("Impossible de modifier ce créneau. Vérifiez les autorisations Supabase.");
    } finally {
      setBusySlot(null);
    }
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

    async function handleTogglePush() {
    try {
      if (pushStatus === "enabled") {
        await unregisterAdminPushSubscription();

        setPushStatus("disabled");

        toast.success("Notifications désactivées", {
          description:
            "Cet appareil ne recevra plus les notifications administrateur.",
        });

        return;
      }

      if (pushStatus === "blocked") {
        toast.info(
          "Les notifications sont bloquées dans les paramètres du navigateur."
        );
        return;
      }

      await registerPushSubscription();

      setPushStatus("enabled");

      toast.success("Notifications activées", {
        description:
          "Cet appareil recevra maintenant les notifications Push.",
      });
    } catch (error) {
      console.error("Erreur de gestion des notifications Push :", error);

      const status = await getAdminPushStatus();
      setPushStatus(status);

      toast.error(
        error instanceof Error
          ? error.message
          : "Impossible de modifier les notifications."
      );
    }
  }

  useEffect(() => {
    const channel = adminSupabase
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
      adminSupabase.removeChannel(channel);
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
        data: { session },
      } = await adminSupabase.auth.getSession();

      console.log("🔐 SESSION DASHBOARD :", session);

      if (!session?.user) {
        navigate({
          to: "/admin-login",
          replace: true,
        });
        return;
      }

      const loginTime = Number(
        localStorage.getItem("pause_gourmande_admin_login")
      );

      if (
        !loginTime ||
        Date.now() - loginTime >= ADMIN_SESSION_DURATION
      ) {
        console.log("⏰ SESSION ADMIN EXPIRÉE");

        localStorage.removeItem("pause_gourmande_admin_login");

        await adminSupabase.auth.signOut();

        navigate({
          to: "/admin-login",
          replace: true,
        });

        return;
      }

      const { data: admin, error } = await adminSupabase
        .from("admin_users")
        .select("role")
        .eq("user_id", session.user.id)
        .maybeSingle();

      console.log("👤 ADMIN :", {
        admin,
        error,
      });

      if (error || !admin) {
        console.error("❌ Accès dashboard refusé :", error);

        navigate({
          to: "/admin-login",
          replace: true,
        });

        return;
      }

      setCheckingAuth(false);
    }

    checkAdmin();
  }, [navigate]);

  useEffect(() => {
    if (checkingAuth) {
      return;
    }

    let lastUpdate = 0;

    function updateAdminActivity() {
      const now = Date.now();

      // Évite d'écrire dans localStorage à chaque mouvement de souris
      if (now - lastUpdate < 60_000) {
        return;
      }

      lastUpdate = now;

      localStorage.setItem(
        "pause_gourmande_admin_login",
        now.toString()
      );
    }

    const events = [
      "click",
      "keydown",
      "touchstart",
      "scroll",
    ];

    events.forEach((event) => {
      window.addEventListener(event, updateAdminActivity);
    });

    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, updateAdminActivity);
      });
    };
  }, [checkingAuth]);

  useEffect(() => {
    if (checkingAuth) {
      return;
    }

    const interval = window.setInterval(async () => {
      const lastActivity = Number(
        localStorage.getItem("pause_gourmande_admin_login")
      );

      if (
        !lastActivity ||
        Date.now() - lastActivity >= ADMIN_SESSION_DURATION
      ) {
        console.log("⏰ SESSION ADMIN EXPIRÉE APRÈS INACTIVITÉ");

        localStorage.removeItem(
          "pause_gourmande_admin_login"
        );

        await adminSupabase.auth.signOut();

        navigate({
          to: "/admin-login",
          replace: true,
        });
      }
    }, 60_000);

    return () => {
      window.clearInterval(interval);
    };
  }, [checkingAuth, navigate]);

  const filtered = useMemo(() => {
    const cfg = RANGES.find((r) => r.key === range)!;

    let result = orders;

    if (cfg.days === 0) {
      const s = startOfToday();

      result = orders.filter((o) => o.createdAt >= s);
    } else if (cfg.days !== null) {
      const cutoff = Date.now() - cfg.days * 86400_000;

      result = orders.filter((o) => o.createdAt >= cutoff);
    }

    const search = orderSearch.trim().toLowerCase();

    if (!search) {
      return result;
    }

    return result.filter((o) => {
      const name = o.customerName?.toLowerCase() ?? "";
      const phone = o.phone?.toLowerCase() ?? "";
      const id = o.id?.toLowerCase() ?? "";

      return (
        name.includes(search) ||
        phone.includes(search) ||
        id.includes(search)
      );
    });
  }, [orders, range, orderSearch]);

  useEffect(() => {
    setOrdersToShow(10);
  }, [range, orderSearch]);

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
    .reduce(
      (sum, order) =>
        sum +
        (order.pointsAwarded
          ? (order.pointsAwardedAmount ?? 0)
          : 0),
      0
    );
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
            onClick={handleTogglePush}
          >
            <Bell className="size-4" />

            <span>
              {pushStatus === "enabled"
                ? "Désactiver les notifications"
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
              localStorage.removeItem(
                "pause_gourmande_admin_login"
              );

              await adminSupabase.auth.signOut();

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
            onClick={handleTogglePush}
          >
            <Bell className="size-4" />

            {pushStatus === "enabled"
              ? "Désactiver les notifications"
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
              localStorage.removeItem("pause_gourmande_admin_login");
              await adminSupabase.auth.signOut();

              navigate({
                to: "/admin-login",
                replace: true,
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


  {/* GESTION DES CRÉNEAUX */}
  <section className="rounded-[24px] md:rounded-[28px] border bg-card p-4 md:p-6 space-y-4">
    <div className="flex items-start gap-3">
      <div className="rounded-xl bg-brand-gold/15 p-2.5 text-brand-deep">
        <CalendarDays className="size-5" />
      </div>
      <div>
        <h2 className="text-base md:text-lg font-semibold">Créneaux de commande</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Intervalle de {settings?.order_settings.prep_minutes ?? DEFAULT_ORDER_SETTINGS.prep_minutes} minutes ·
          capacité de {settings?.order_settings.slot_capacity ?? DEFAULT_ORDER_SETTINGS.slot_capacity} commandes par créneau.
          Les créneaux passés et complets ne sont pas réservables.
        </p>
      </div>
    </div>

    <button
      type="button"
      aria-expanded={slotsExpanded}
      onClick={() => setSlotsExpanded((expanded) => !expanded)}
      className="flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-sm font-semibold hover:bg-muted/50"
    >
      <span>
        {slotsExpanded ? "Masquer les créneaux" : "Afficher les créneaux"}
      </span>
      {slotsExpanded ? (
        <ChevronUp className="size-4" />
       ) : (
        <ChevronDown className="size-4" />
      )}
    </button>

    {slotsExpanded && (
      <>

    <div className="space-y-2">
      <p className="text-sm font-medium">Jours d'ouverture</p>
      <p className="text-xs text-muted-foreground">
       Cochez les jours où vous acceptez les commandes, puis enregistrez les paramètres.
      </p>

      <div className="flex flex-wrap items-center gap-1.5">
        {[
          { value: 1, label: "Lun" },
          { value: 2, label: "Mar" },
          { value: 3, label: "Mer" },
          { value: 4, label: "Jeu" },
          { value: 5, label: "Ven" },
          { value: 6, label: "Sam" },
          { value: 7, label: "Dim" },
            ].map((day) => {
              const isOpen = orderSettings.open_days.includes(day.value);

            return (
              <span
                key={day.value}
                title={`${day.label} : ${isOpen ? "ouvert" : "fermé"}`}
                className={`rounded-md px-2 py-1 text-xs ${
                isOpen
                  ? "bg-muted text-foreground"
                  : "bg-muted/40 text-muted-foreground opacity-60"
                }`}
              >
                {day.label}
              </span>
            );
          })}
        </div>
      </div>

      {(() => {
        const selectedDate = new Date(`${slotDate}T12:00:00Z`);
        const weekday = selectedDate.getUTCDay() || 7;
        const isOpen = orderSettings.open_days.includes(weekday);
        const dateIndex = slotDates.indexOf(slotDate);

        const changeDay = (offset: number) => {
        const nextDate = slotDates[dateIndex + offset];
          if (nextDate) setSlotDate(nextDate);
        };

        return (
          <>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:justify-between sm:gap-3">
              <Button
                type="button"
                variant="outline"
                disabled={dateIndex <= 0}
                onClick={() => changeDay(-1)}
                className="w-full min-w-0 sm:w-auto sm:shrink-0"
              >
                <span className="sm:hidden">← Précédent</span>
                <span className="hidden sm:inline">← Précédent</span>
              </Button>

              <Button
                type="button"
                variant="outline"
                disabled={dateIndex < 0 || dateIndex >= slotDates.length - 1}
                onClick={() => changeDay(1)}
                className="w-full min-w-0 sm:order-3 sm:w-auto sm:shrink-0"
              >
                Suivant →
              </Button>

              <div className="col-span-2 min-w-0 text-center sm:order-2 sm:flex-1">
                  <p className="break-words font-semibold capitalize">
                    {selectedDate.toLocaleDateString("fr-FR", {
                      timeZone: "Africa/Lome",
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                    })}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Jour {dateIndex + 1} sur {slotDates.length}
                  </p>
                </div>
              </div>

  <div className="space-y-3 rounded-xl border p-3 sm:p-4">
    <div className="min-w-0">
      <p className="font-medium">Statut de la journée</p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        {isOpen
          ? "Les commandes sont autorisées selon les créneaux."
          : "Aucune nouvelle commande ne doit être acceptée ce jour."}
      </p>
    </div>

    <Button
      type="button"
      variant={isOpen ? "outline" : "default"}
      disabled={savingDayStatus}
      onClick={async () => {
        if (!settings || savingDayStatus) return;

        const nextOpenDays = isOpen
          ? orderSettings.open_days.filter((day) => day !== weekday)
          : [...new Set([...orderSettings.open_days, weekday])].sort(
              (a, b) => a - b
            );

        const nextOrderSettings: OrderSettings = {
          ...orderSettings,
          open_days: nextOpenDays,
        };

        setSavingDayStatus(true);

        try {
          const { data, error } = await adminSupabase
            .from("app_settings")
            .update({
              order_settings: nextOrderSettings,
              updated_at: new Date().toISOString(),
            })
            .eq("id", 1)
            .select("order_settings")
            .single();

          if (error) throw error;

          const savedOrderSettings: OrderSettings = {
            ...DEFAULT_ORDER_SETTINGS,
            ...(data.order_settings ?? {}),
          };

          setOrderSettings(savedOrderSettings);

          setSettings((current) =>
            current
              ? { ...current, order_settings: savedOrderSettings }
              : current
          );

          toast.success(
            nextOpenDays.includes(weekday)
              ? "Jour ouvert. Les créneaux sont actualisés."
              : "Jour fermé. Les créneaux sont actualisés."
          );
        } catch (error) {
          console.error("Erreur modification du jour :", error);
          toast.error("Impossible d'enregistrer le statut du jour.");
        } finally {
          setSavingDayStatus(false);
        }
      }}
      className="w-full sm:w-auto"
    >
      {savingDayStatus
        ? "Enregistrement…"
        : isOpen
          ? "Fermer cette journée"
          : "Ouvrir cette journée"}
    </Button>
  </div>
</div>


    {slotDate && (
      <p className="text-xs text-muted-foreground">
        Date : {new Date(`${slotDate}T12:00:00`).toLocaleDateString("fr-FR", {
          weekday: "long", day: "numeric", month: "long", year: "numeric"
        })}
      </p>
    )}

    {!orderSettings.open_days.includes(
      (new Date(`${slotDate}T12:00:00Z`).getUTCDay() || 7)
    ) ? (
      <div className="rounded-xl border border-dashed p-5 text-center text-sm text-muted-foreground">
        Cette journée est fermée. Ouvrez-la pour activer les créneaux de commande.
      </div>
    ) : loadingSlotRows ? (
      <p className="py-6 text-center text-sm text-muted-foreground">Chargement des créneaux…</p>
    ) : slotRows.length === 0 ? (
      <div className="rounded-xl border border-dashed p-5 text-center text-sm text-muted-foreground">
        Aucun créneau disponible pour cette date. Vérifiez les jours d'ouverture, les horaires et la limite de réservation.
      </div>
    ) : (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {slotRows.map((slot) => {
          const time = slot.slot_time.slice(0, 5);
          const key = `${slotDate}-${time}`;
          const full = slot.remaining <= 0;
          const unavailable = !slot.available && !slot.blocked && !full;

          return (
            <div key={key} className="flex items-center justify-between gap-3 rounded-xl border p-3">
              <div className="min-w-0">
                <p className="font-semibold text-sm">{time}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {slot.blocked
                    ? "Bloqué manuellement"
                    : full
                      ? "Complet"
                      : unavailable
                        ? "Passé ou non réservable"
                        : `${slot.remaining} place${slot.remaining > 1 ? "s" : ""} restante${slot.remaining > 1 ? "s" : ""}`}
                </p>
              </div>
              <button
                type="button"
                disabled={busySlot !== null || (unavailable && !slot.blocked)}
                onClick={() => void toggleSlotBlock(time, slot.blocked)}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                title={slot.blocked ? "Débloquer le créneau" : "Bloquer le créneau"}
              >
                {slot.blocked ? <Unlock className="size-3.5" /> : <Lock className="size-3.5" />}
                {busySlot === key ? "..." : slot.blocked ? "Débloquer" : "Bloquer"}
              </button>
            </div>
          );
        })}
      </div>
    )}

    <p className="text-xs leading-relaxed text-muted-foreground">
      Un blocage empêche les nouvelles réservations sur ce créneau. Les commandes déjà enregistrées ne sont pas annulées.
    </p>
    </>
  );
})()}
      </>
    )}
  </section>

  {/* COMMANDES */}
  <section className="bg-card rounded-[24px] md:rounded-[28px] ring-1 ring-border overflow-hidden">

  <div className="p-4 md:p-6 border-b border-border space-y-4">
    <div className="flex items-center justify-between gap-3">
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

      <button
        type="button"
        onClick={() =>
          setRecentOrdersCollapsed((collapsed) => !collapsed)
        }
        aria-label={
          recentOrdersCollapsed
            ? "Afficher les commandes récentes"
            : "Masquer les commandes récentes"
        }
        aria-expanded={!recentOrdersCollapsed}
        title={
          recentOrdersCollapsed
            ? "Afficher les commandes"
            : "Masquer les commandes"
        }
        className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition hover:bg-muted hover:text-foreground"
      >
        {recentOrdersCollapsed ? (
          <ChevronDown className="size-4" />
        ) : (
          <ChevronUp className="size-4" />
        )}
      </button>
    </div>

    <div className="relative w-full">
      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />

      <input
        type="text"
        value={orderSearch}
        onChange={(e) => setOrderSearch(e.target.value)}
        placeholder="Rechercher une commande..."
        className="h-11 w-full rounded-xl border border-border bg-background pl-10 pr-3 text-sm outline-none transition placeholder:text-muted-foreground/70 focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/10"
      />
    </div>
  </div>

{!recentOrdersCollapsed && (filtered.length === 0 ? (
  <div className="p-10 md:p-12 text-center text-sm text-muted-foreground">
    Aucune commande sur cette période.
    <br />
    Les commandes passées depuis la boutique apparaîtront ici.
  </div>
) : (
  <>
    <div className="divide-y divide-border">
      {filtered.slice(0, ordersToShow).map((o) => (
        <OrderRow
          key={o.id}
          order={o}
          deliveryDrivers={deliveryDrivers}
          assigning={assigningOrderId === o.id}
          onAssign={(driverUserId) =>
            void handleAssignDriver(o.id, driverUserId)
          }
          markingReady={markingReadyOrderId === o.id}
          onMarkReady={(id) => void handleMarkDeliveryReady(id)}
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
                pointsAwarded: order.points_awarded ?? false,
                pointsAwardedAmount: Number(order.points_awarded_amount ?? 0),
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

      {filtered.length > ordersToShow && (
        <div className="flex justify-center border-t border-border p-4">
          <Button
            variant="outline"
            className="rounded-full px-6"
            onClick={() =>
              setOrdersToShow((current) => current + 10)
            }
          >
            Charger plus
          </Button>
        </div>
      )}
    </>
  ))}
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


  {/* GESTION DES LIVREURS */}
  <section>
    <div className="mb-3 md:mb-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-brand-gold">
        Livraison
      </p>
      <h2 className="text-lg md:text-xl font-semibold">Livreurs et accès</h2>
      <p className="text-xs text-muted-foreground mt-0.5">
        Gérez le code partagé, les profils et les PIN individuels.
      </p>
    </div>
    <DriverManagement />
  </section>

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

            try {
              const updated = await updateAppSettings({
              ...values,
              order_settings: {
                ...values.order_settings,
                open_days: orderSettings.open_days,
              },
            });

            if (updated) {
              setSettings(updated);
              setOrderSettings(updated.order_settings);
              toast.success("Paramètres mis à jour.");
            } else {
              toast.error("Impossible de mettre à jour les paramètres.");
            }
            } finally {
              setSavingSettings(false);
            }
          }}
        />

      </div>
    </section>
  )}

</main>
    </div>
  );
}


type ManagedDriver = {
  user_id: string;
  display_name: string;
  active: boolean;
  is_available: boolean;
  pin_updated_at: string | null;
};

function DriverManagement() {
  const [drivers, setDrivers] = useState<ManagedDriver[]>([]);
  const [sharedCode, setSharedCode] = useState("");
  const [driverName, setDriverName] = useState("");
  const [newPin, setNewPin] = useState("");
  const [pinFor, setPinFor] = useState("");
  const [pinValue, setPinValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadingDrivers, setLoadingDrivers] = useState(false);

  async function callDriverAccess(body: Record<string, unknown>) {
    const { data, error } = await adminSupabase.functions.invoke(
      "driver-access",
      { body },
    );

    if (error) {
      throw new Error(
        await getFunctionErrorMessage(
          error,
          "Erreur de communication avec le serveur.",
        ),
      );
    }

    if (data?.error) throw new Error(data.error);

    return data;
  }

  async function refreshDrivers() {
    setLoadingDrivers(true);
    try {
      const data = await callDriverAccess({ action: "list_drivers" });
      setDrivers(Array.isArray(data.drivers) ? data.drivers : []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Chargement des livreurs impossible.");
    } finally {
      setLoadingDrivers(false);
    }
  }

  useEffect(() => {
    void refreshDrivers();
  }, []);

  async function runAction(action: () => Promise<void>, success: string) {
    setBusy(true);
    try {
      await action();
      toast.success(success);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "L’opération a échoué.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5 rounded-[24px] md:rounded-[28px] bg-card p-4 md:p-6 ring-1 ring-border">
      <div className="space-y-3">
        <h3 className="font-semibold">Code d’accès partagé</h3>
        <p className="text-sm text-muted-foreground">
          À communiquer uniquement aux livreurs autorisés. La génération d’un nouveau code remplace l’ancien.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={busy}
            onClick={() => void runAction(async () => {
              const data = await callDriverAccess({ action: "generate_code" });
              setSharedCode(String(data.code ?? ""));
            }, "Nouveau code généré.")}
          >
            Générer un code
          </Button>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => void runAction(async () => {
              await callDriverAccess({ action: "disable_code" });
              setSharedCode("");
            }, "Code partagé désactivé.")}
          >
            Désactiver le code
          </Button>
        </div>
        {sharedCode && (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border p-3">
            <code className="text-lg font-bold tracking-widest">{sharedCode}</code>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void navigator.clipboard.writeText(sharedCode)
                  .then(() => toast.success("Code copié."))
                  .catch(() => toast.error("Copie impossible : sélectionnez le code manuellement."));
              }}
            >
              Copier
            </Button>
            <p className="w-full text-xs text-muted-foreground">
              Ce code ne sera plus affiché après rechargement. Conservez-le dans un endroit sûr.
            </p>
          </div>
        )}
      </div>

      <div className="border-t pt-5 space-y-3">
        <h3 className="font-semibold">Créer un profil livreur</h3>
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            void runAction(async () => {
              await callDriverAccess({
                action: "create_driver",
                display_name: driverName.trim(),
                pin: newPin,
              });
              setDriverName("");
              setNewPin("");
              await refreshDrivers();
            }, "Profil livreur créé.");
          }}
        >
          <input
            className="h-10 rounded-lg border bg-background px-3 text-sm"
            value={driverName}
            onChange={(event) => setDriverName(event.target.value)}
            placeholder="Nom du livreur"
            minLength={2}
            maxLength={80}
            required
          />
          <input
            className="h-10 rounded-lg border bg-background px-3 text-sm"
            value={newPin}
            onChange={(event) => setNewPin(event.target.value)}
            placeholder="PIN (6 à 12 chiffres)"
            type="password"
            inputMode="numeric"
            pattern="[0-9]{6,12}"
            minLength={6}
            maxLength={12}
            required
          />
          <div className="sm:col-span-2">
            <Button type="submit" disabled={busy}>Créer le profil</Button>
          </div>
        </form>
      </div>

      <div className="border-t pt-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold">Profils existants ({drivers.length})</h3>
          <Button variant="outline" size="sm" disabled={loadingDrivers} onClick={() => void refreshDrivers()}>
            <RefreshCw className="mr-2 size-4" />
            Actualiser
          </Button>
        </div>

        {loadingDrivers && <p className="text-sm text-muted-foreground">Chargement des profils…</p>}
        {!loadingDrivers && drivers.length === 0 && (
          <p className="text-sm text-muted-foreground">Aucun profil retourné.</p>
        )}

        {drivers.map((driver) => (
          <div key={driver.user_id} className="space-y-3 rounded-xl border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-medium">{driver.display_name}</p>
                <p className="text-xs text-muted-foreground">
                  {driver.active ? "Profil actif" : "Profil désactivé"}
                  {" · "}
                  {driver.is_available ? "Disponible" : "Indisponible"}
                  {" · "}
                  {driver.pin_updated_at ? "PIN configuré" : "PIN non configuré"}
                </p>
              </div>
              <Button
                size="sm"
                variant={driver.active ? "outline" : "default"}
                disabled={busy}
                onClick={() => void runAction(async () => {
                  await callDriverAccess({
                    action: "set_active",
                    user_id: driver.user_id,
                    active: !driver.active,
                  });
                  await refreshDrivers();
                }, driver.active ? "Profil désactivé." : "Profil activé.")}
              >
                {driver.active ? "Désactiver" : "Activer"}
              </Button>
            </div>

            <form
              className="flex flex-wrap gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                void runAction(async () => {
                  await callDriverAccess({
                    action: "set_pin",
                    user_id: driver.user_id,
                    pin: pinValue,
                  });
                  setPinValue("");
                  setPinFor("");
                  await refreshDrivers();
                }, "PIN mis à jour.");
              }}
            >
              <input
                className="h-9 min-w-0 flex-1 rounded-lg border bg-background px-3 text-sm"
                type="password"
                inputMode="numeric"
                pattern="[0-9]{6,12}"
                minLength={6}
                maxLength={12}
                required
                value={pinFor === driver.user_id ? pinValue : ""}
                onFocus={() => setPinFor(driver.user_id)}
                onChange={(event) => {
                  setPinFor(driver.user_id);
                  setPinValue(event.target.value);
                }}
                placeholder="Nouveau PIN (6 à 12 chiffres)"
              />
              <Button size="sm" type="submit" variant="outline" disabled={busy}>
                Définir le PIN
              </Button>
            </form>
          </div>
        ))}
      </div>
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
  deliveryDrivers,
  assigning,
  onAssign,
  markingReady,
  onMarkReady,
}: {
  order: Order;
  onStatus: (id: string, status: Order["status"]) => void;
  deliveryDrivers: ActiveDeliveryDriver[];
  assigning: boolean;
  onAssign: (driverUserId: string | null) => void;
  markingReady: boolean;
  onMarkReady: (id: string) => void;
}) {
  const [selectedDriverId, setSelectedDriverId] = useState(
    order.assignedDriverId ?? ""
  );

  const [deliveryFeeInput, setDeliveryFeeInput] = useState(
    order.deliveryFee ? String(order.deliveryFee) : ""
  );

  const [sendingFee, setSendingFee] = useState(false);

  const [feeSent, setFeeSent] = useState(
    order.deliveryStatus === "awaiting_customer" ||
    order.deliveryStatus === "accepted" ||
    order.deliveryStatus === "refused"
  );

const statusConfig = {
  pending: {
    label: "En attente",
    className: "bg-amber-100 text-amber-700",
  },
  preparing: {
    label: "En préparation",
    className: "bg-blue-100 text-blue-700",
  },
  ready_for_delivery: {
    label: "Prête à livrer",
    className: "bg-violet-100 text-violet-700",
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

const status =
  statusConfig[order.status as keyof typeof statusConfig] ?? {
    label: "Statut inconnu",
    className: "bg-gray-100 text-gray-700",
  };

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

  const isDelivery = order.receptionMode === "delivery";

  const deliveryStatus = order.deliveryStatus;

  const deliveryFee = Number(order.deliveryFee ?? 0);

  const totalToPay = order.total + deliveryFee;

  const hasLocation =
    order.deliveryLatitude != null &&
    order.deliveryLongitude != null;

  const mapUrl = hasLocation
    ? `https://www.google.com/maps/search/?api=1&query=${order.deliveryLatitude},${order.deliveryLongitude}`
    : null;

  const canProposeFee =
    isDelivery &&
    order.status === "pending" &&
    deliveryStatus === "awaiting_fee" &&
    !feeSent;

  const waitingForCustomer =
    isDelivery &&
    order.status === "pending" &&
    deliveryStatus === "awaiting_customer";

  const deliveryAccepted =
    isDelivery &&
    deliveryStatus === "accepted";

  const deliveryRefused =
    isDelivery &&
    deliveryStatus === "refused";

  const handleProposeFee = async () => {
    const fee = Number(deliveryFeeInput);

    if (!Number.isInteger(fee) || fee < 0) {
      toast.error("Entre un montant valide.");
      return;
    }

    setSendingFee(true);

    const { error } = await proposeDeliveryFee(
      order.id,
      fee
    );

    setSendingFee(false);

    if (error) {
      toast.error(
        "Impossible d'envoyer les frais de livraison."
      );
      return;
    }

    setFeeSent(true);

    toast.success(
      "Les frais de livraison ont été envoyés au client."
    );
  };

  return (
    <article className="px-3 py-1.5 md:px-4 md:py-2">
      <div className="group rounded-2xl bg-card ring-1 ring-border transition-shadow hover:shadow-sm">

        {/* CLIENT + HORAIRES */}
        <div className="px-4 pt-3.5 md:px-5 md:pt-4">

          <div className="flex items-start justify-between gap-3">

            <div className="min-w-0 flex-1">

              <div className="flex flex-wrap items-center gap-2 min-w-0">

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

                {/* MODE DE RÉCEPTION */}
                <span
                  className={
                    isDelivery
                      ? "shrink-0 rounded-full bg-blue-100 px-2 py-1 text-[8px] font-bold uppercase tracking-[0.06em] text-blue-700"
                      : "shrink-0 rounded-full bg-brand-cream px-2 py-1 text-[8px] font-bold uppercase tracking-[0.06em] text-brand-deep"
                  }
                >
                  {isDelivery ? "🛵 Livraison" : "🛍️ Retrait"}
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

        {/* INFORMATIONS LIVRAISON */}
        {isDelivery && (
          <div className="px-4 pt-3.5 md:px-5">

            <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3">

              <div className="flex items-start gap-2">

                <MapPin className="mt-0.5 size-4 shrink-0 text-blue-600" />

                <div className="min-w-0 flex-1">

                  <p className="text-xs font-bold text-blue-800">
                    Livraison
                  </p>

                  {hasLocation && mapUrl ? (
                    <a
                      href={mapUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-flex items-center gap-1.5 text-[11px] font-semibold text-blue-700 underline underline-offset-2 hover:text-blue-900"
                    >
                      <MapPin className="size-3" />
                      Voir la position du client
                    </a>
                  ) : (
                    <p className="mt-1 text-[11px] text-rose-600">
                      Position du client indisponible
                    </p>
                  )}

                </div>

              </div>

              {/* PROPOSITION DES FRAIS */}
              {canProposeFee && (
                <div className="mt-3 border-t border-blue-200 pt-3">

                  <p className="mb-2 text-[10px] font-medium text-blue-800">
                    Définir les frais de livraison
                  </p>

                  <div className="flex gap-2">

                    <div className="relative min-w-0 flex-1">

                      <input
                        type="number"
                        min="0"
                        step="100"
                        value={deliveryFeeInput}
                        onChange={(event) =>
                          setDeliveryFeeInput(event.target.value)
                        }
                        placeholder="Ex. 1000"
                        className="h-9 w-full rounded-lg border border-blue-200 bg-white px-3 pr-16 text-xs outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                      />

                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-muted-foreground">
                        FCFA
                      </span>

                    </div>

                    <Button
                      type="button"
                      size="sm"
                      disabled={sendingFee}
                      onClick={handleProposeFee}
                      className="h-9 shrink-0 gap-1.5 rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-700"
                    >
                      <Send className="size-3.5" />

                      {sendingFee
                        ? "Envoi..."
                        : "Envoyer"}
                    </Button>

                  </div>

                </div>
              )}

              {/* EN ATTENTE DU CLIENT */}
              {(waitingForCustomer || feeSent) && (
                <div className="mt-3 flex items-center gap-2 rounded-lg bg-white/80 px-3 py-2.5">

                  <Clock className="size-4 shrink-0 text-amber-600" />

                  <div className="min-w-0">

                    <p className="text-[11px] font-bold text-amber-800">
                      En attente de la réponse du client
                    </p>

                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      Frais proposés :{" "}
                      <span className="font-bold text-foreground">
                        {formatFCFA(deliveryFee)}
                      </span>
                    </p>

                  </div>

                </div>
              )}

              {/* CLIENT A ACCEPTÉ */}
              {deliveryAccepted && (
                <div className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2.5">

                  <Check className="size-4 shrink-0 text-emerald-600" />

                  <div>

                    <p className="text-[11px] font-bold text-emerald-800">
                      Livraison acceptée par le client
                    </p>

                    <p className="mt-0.5 text-[10px] text-emerald-700">
                      Frais :{" "}
                      <span className="font-bold">
                        {formatFCFA(deliveryFee)}
                      </span>
                    </p>

                  </div>

                </div>
              )}

              {deliveryAccepted &&
                order.receptionMode === "delivery" &&
                order.status === "preparing" && (
                  <div className="mt-3 rounded-xl border border-border bg-card p-3.5">
                    <label
                      htmlFor={`driver-${order.id}`}
                      className="mb-1.5 block text-xs font-semibold"
                    >
                      Livreur de cette commande
                    </label>

                    <p className="mb-3 text-[11px] text-muted-foreground">
                      Le livreur ne recevra la commande qu’après confirmation.
                    </p>

                    <select
                      id={`driver-${order.id}`}
                      value={selectedDriverId}
                      disabled={assigning}
                      onChange={(event) => setSelectedDriverId(event.target.value)}
                     className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition focus:ring-2 focus:ring-ring/30 disabled:opacity-60"
                    >
                      <option value="">Choisir un livreur</option>
                      {deliveryDrivers.map((driver) => (
                        <option key={driver.user_id} value={driver.user_id}>
                          {driver.display_name}
                        </option>
                      ))}
                    </select>

                    <Button
                      type="button"
                      className="mt-3 w-full gap-2"
                      disabled={
                        assigning ||
                       !selectedDriverId ||
                       selectedDriverId === (order.assignedDriverId ?? "")
                      }
                      onClick={() => onAssign(selectedDriverId)}
                    >
                      <Check className="size-4" />
                      {assigning ? "Enregistrement…" : "Confirmer l’attribution"}
                    </Button>

                    {order.assignedDriverId && (
                      <button
                        type="button"
                        disabled={assigning}
                        onClick={() => {
                          setSelectedDriverId("");
                          onAssign(null);
                        }}
                        className="mt-2 w-full py-1 text-xs font-medium text-destructive hover:underline disabled:opacity-60"
                      >
                        Retirer le livreur
                      </button>
                    )}
                  </div>
                )}

                {order.assignedDriverId ? (
                  <Button
                    type="button"
                    className="mt-3 w-full gap-2"
                    disabled={markingReady}
                    onClick={() => onMarkReady(order.id)}
                  >
                    <Check className="size-4" />
                    {markingReady
                      ? "Confirmation en cours…"
                      : "Commande prête — notifier le livreur"}
                  </Button>
                ) : (
                  <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
                     Attribuez d’abord un livreur pour pouvoir déclarer la commande prête.
                  </p>
                )}

              {/* CLIENT A REFUSÉ */}
              {deliveryRefused && (
                <div className="mt-3 flex items-center gap-2 rounded-lg bg-rose-50 px-3 py-2.5">

                  <Trash2 className="size-4 shrink-0 text-rose-500" />

                  <p className="text-[11px] font-bold text-rose-700">
                    Livraison refusée par le client
                  </p>

                </div>
              )}

            </div>

          </div>
        )}

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

              {/* Réduction */}
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

              {/* Frais de livraison */}
              {isDelivery && (
                <div className="flex items-center justify-between gap-4">

                  <span className="text-[10px] text-brand-cream/65">
                    Livraison
                  </span>

                  <span className="text-xs font-medium">
                    {deliveryFee > 0
                      ? formatFCFA(deliveryFee)
                      : "À définir"}
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
                    {order.pointsAwarded
                      ? `+${order.pointsAwardedAmount ?? 0} pépites créditées`
                      : order.status === "pending"
                        ? "Pépites après validation"
                        : order.status === "cancelled"
                          ? "Commande annulée"
                          : "Pépites non créditées"}
                  </p>

                </div>

                <p className="text-lg md:text-xl font-bold leading-none">
                  {formatFCFA(totalToPay)}
                </p>

              </div>

            </div>

          </div>

        </div>

        {/* ACTIONS */}
        <div className="flex justify-end px-4 py-2 md:px-5 md:py-2.5">

          <div className="flex items-center gap-1.5">

            {/* CONFIRMATION D'UNE COMMANDE DE RETRAIT */}
            {order.status === "pending" && !isDelivery && (
              <Button
                size="icon"
                variant="ghost"
                className="size-9 rounded-full bg-emerald-50 hover:bg-emerald-100"
                onClick={() => onStatus(order.id, "preparing")}
                aria-label="Confirmer la commande"
                title="Confirmer la commande"
              >
                <Check className="size-4.5 text-emerald-600" />
              </Button>
            )}

            {/* ANNULATION */}
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
    order_settings: OrderSettings;
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

  const [orderSettings, setOrderSettings] = useState<OrderSettings>({
    ...DEFAULT_ORDER_SETTINGS,
    ...(settings.order_settings ?? {}),
  });

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


    const cfg = orderSettings;
    const validTime = (value: string) =>
      /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

    if (
      !Array.isArray(cfg.open_days) ||
      cfg.open_days.length === 0 ||
      cfg.open_days.some(
        (day) => !Number.isInteger(day) || day < 1 || day > 7
      ) ||
      new Set(cfg.open_days).size !== cfg.open_days.length
    ) {
      toast.error("Sélectionnez au moins un jour d'ouverture valide.");
      return;
    }

    if (
      !validTime(cfg.opening_time) ||
      !validTime(cfg.closing_time) ||
      cfg.opening_time >= cfg.closing_time
    ) {
      toast.error("Les horaires d'ouverture et de fermeture sont invalides.");
      return;
    }

    if (
      !validTime(cfg.tomorrow_cutoff)
    ) {
      toast.error("L'heure limite de réservation est invalide.");
      return;
    }

    if (
      !Number.isInteger(cfg.slot_capacity) ||
      cfg.slot_capacity < 1 ||
      cfg.slot_capacity > 100
    ) {
      toast.error("La capacité doit être comprise entre 1 et 100 commandes.");
      return;
    }

if (
  !Number.isInteger(cfg.prep_minutes) ||
  cfg.prep_minutes < 5 ||
  cfg.prep_minutes > 480
) {
  toast.error(
    "La préparation doit être comprise entre 5 et 480 minutes."
  );
  return;
}

const bands = cfg.delivery_fee_bands;

if (
  !Array.isArray(bands) ||
  bands.length === 0 ||
  bands.some(
    (band, index) =>
      band.max_fee === null ||
      !Number.isInteger(band.max_fee) ||
      band.max_fee < 0 ||
      !Number.isInteger(band.min_minutes) ||
      !Number.isInteger(band.max_minutes) ||
      band.min_minutes < 1 ||
      band.max_minutes < band.min_minutes ||
      band.max_minutes > 480 ||
      (index > 0 &&
        band.max_fee <= (bands[index - 1].max_fee ?? -1))
  )
) {
  toast.error(
    "Vérifiez les seuils et les délais des tranches de livraison."
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

      referral_surprises: referralSurprises.map((item) => ({
        label: item.label.trim(),
        weight: Number(item.weight),
      })),

      order_settings: orderSettings,
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

      {/* COMMANDES ET LIVRAISON */}
      <div className="rounded-2xl border bg-card p-4 md:p-5 space-y-5">
        <div>
          <h3 className="font-semibold text-brand-deep">
            Commandes et livraison
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Définissez les horaires, les créneaux de réservation et les délais annoncés aux clients.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Ouverture</label>
            <input
              type="time"
              value={orderSettings.opening_time}
              onChange={(e) =>
                setOrderSettings((current) => ({
                  ...current,
                  opening_time: e.target.value,
                }))
              }
              className="h-11 w-full rounded-xl border bg-background px-3 text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Fermeture</label>
            <input
              type="time"
              value={orderSettings.closing_time}
              onChange={(e) =>
                setOrderSettings((current) => ({
                  ...current,
                  closing_time: e.target.value,
                }))
              }
              className="h-11 w-full rounded-xl border bg-background px-3 text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Commandes maximum par créneau</label>
            <input
              type="number"
              min="1"
              max="100"
              value={orderSettings.slot_capacity}
              onChange={(e) =>
                setOrderSettings((current) => ({
                  ...current,
                  slot_capacity: Number(e.target.value),
                }))
              }
              className="h-11 w-full rounded-xl border bg-background px-3 text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Préparation et intervalle des créneaux (minutes)</label>
            <input
              type="number"
              min="5"
              max="480"
              value={orderSettings.prep_minutes}
              onChange={(e) =>
                setOrderSettings((current) => ({
                  ...current,
                  prep_minutes: Number(e.target.value),
                }))
              }
              className="h-11 w-full rounded-xl border bg-background px-3 text-sm"
            />
          </div>

<div className="space-y-3 sm:col-span-2">
  <div className="flex flex-wrap items-start justify-between gap-3">
    <div>
      <h4 className="text-sm font-semibold">
        Tarifs et délais de livraison
      </h4>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
         Au-delà de ce seuil, le délai de cette tranche s’applique. Frais libres.
      </p>
    </div>

    <Button
      type="button"
      size="sm"
      variant="outline"
      className="shrink-0 gap-1.5"
      onClick={() => {
        const currentBands = [
        ...(orderSettings.delivery_fee_bands ??
          DEFAULT_ORDER_SETTINGS.delivery_fee_bands),
       ];

        const lastBand = currentBands[currentBands.length - 1];

        currentBands.push({
          max_fee: (lastBand?.max_fee ?? 0) + 500,
          min_minutes: lastBand?.min_minutes ?? 30,
          max_minutes: lastBand?.max_minutes ?? 40,
        });

        setOrderSettings((current) => ({
          ...current,
          delivery_fee_bands: currentBands,
        }));
      }}
    >
      <Plus className="size-4" />
      Ajouter une tranche
    </Button>
  </div>

  <div className="space-y-2">
    {(orderSettings.delivery_fee_bands ??
      DEFAULT_ORDER_SETTINGS.delivery_fee_bands).map((band, index, allBands) => (
      <div
        key={index}
        className="min-w-0 rounded-lg border bg-background p-2 sm:rounded-xl sm:p-3"
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-sm font-semibold">
            Tranche {index + 1}
          </p>

          <button
            type="button"
            aria-label={`Supprimer la tranche ${index + 1}`}
            title="Supprimer cette tranche"
            disabled={allBands.length <= 1}
            onClick={() => {
              if (allBands.length <= 1) return;

              const nextBands = allBands.filter(
                (_, bandIndex) => bandIndex !== index
              );

              setOrderSettings((current) => ({
                ...current,
                delivery_fee_bands: nextBands,
              }));
            }}
            className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-30"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
          <div className="min-w-0 space-y-1.5">
            <label className="text-xs font-medium">
              Seuil des frais (FCFA)
            </label>
            <input
              type="number"
              min="0"
              step="100"
              value={band.max_fee ?? ""}
              onChange={(e) => {
                const nextBands = [...allBands];
                nextBands[index] = {
                  ...band,
                  max_fee:
                    e.target.value === "" ? null : Number(e.target.value),
                };

                setOrderSettings((current) => ({
                  ...current,
                  delivery_fee_bands: nextBands,
                }));
              }}
              className="h-10 w-full min-w-0 rounded-lg border bg-background px-3 text-sm disabled:opacity-50"
            />
          </div>

          <div className="min-w-0 space-y-1.5">
            <label className="text-xs font-medium">
              Délai minimum (min)
            </label>
            <input
              type="number"
              min="1"
              max="480"
              value={band.min_minutes}
              onChange={(e) => {
                const nextBands = [...allBands];
                nextBands[index] = {
                  ...band,
                  min_minutes: Number(e.target.value),
                };

                setOrderSettings((current) => ({
                  ...current,
                  delivery_fee_bands: nextBands,
                }));
              }}
              className="h-10 w-full min-w-0 rounded-lg border bg-background px-3 text-sm"
            />
          </div>

          <div className="min-w-0 space-y-1.5">
            <label className="text-xs font-medium">
              Délai maximum (min)
            </label>
            <input
              type="number"
              min="1"
              max="480"
              value={band.max_minutes}
              onChange={(e) => {
                const nextBands = [...allBands];
                nextBands[index] = {
                  ...band,
                  max_minutes: Number(e.target.value),
                };

                setOrderSettings((current) => ({
                  ...current,
                  delivery_fee_bands: nextBands,
                }));
              }}
              className="h-10 w-full min-w-0 rounded-lg border bg-background px-3 text-sm"
            />
          </div>
        </div>

        {index === allBands.length - 1 && (
          <p className="mt-2 text-xs text-muted-foreground">
            Les frais supérieurs à ce seuil utilisent le délai de cette tranche.
            Aucun plafond de frais n’est appliqué.
          </p>
        )}
      </div>
    ))}
  </div>
</div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Limite de réservation pour demain</label>
            <input
              type="time"
              value={orderSettings.tomorrow_cutoff}
              onChange={(e) =>
                setOrderSettings((current) => ({
                  ...current,
                  tomorrow_cutoff: e.target.value,
                }))
              }
              className="h-11 w-full rounded-xl border bg-background px-3 text-sm"
            />
          </div>
        </div>

        <div className="space-y-3">
          {[
            {
              key: "delivery_enabled" as const,
              label: "Autoriser les commandes en livraison",
            },
          ].map((option) => (
            <label key={option.key} className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={orderSettings[option.key]}
                onChange={(e) =>
                  setOrderSettings((current) => ({
                    ...current,
                    [option.key]: e.target.checked,
                  }))
                }
                className="mt-0.5"
              />
              <span>{option.label}</span>
            </label>
          ))}
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