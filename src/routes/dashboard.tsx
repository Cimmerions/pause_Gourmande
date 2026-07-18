import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  TrendingUp,
  ShoppingBag,
  Sparkles,
  Wallet,
  Trash2,
  Check,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCart, type Order } from "@/lib/cart-store";
import { products, formatFCFA } from "@/lib/products";

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
  const { orders, points, setOrderStatus } = useCart();
  const [range, setRange] = useState<Range>("7d");

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
      const total = orders
        .filter((o) => o.status !== "cancelled" && o.createdAt >= start && o.createdAt < end)
        .reduce((s, o) => s + o.total, 0);
      buckets.push({
        label: d.toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit" }),
        total,
      });
    }
    return buckets;
  }, [orders]);

  const maxDaily = Math.max(1, ...daily.map((d) => d.total));

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
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-10 space-y-10">
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
                const h = Math.max(4, Math.round((d.total / maxDaily) * 100));
                return (
                  <div key={d.label} className="flex-1 flex flex-col items-center gap-2">
                    <div className="w-full flex-1 flex items-end">
                      <div
                        className="w-full rounded-t-xl bg-gradient-to-t from-brand-gold to-brand-gold/60 transition-all"
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
                <OrderRow key={o.id} order={o} onStatus={setOrderStatus} />
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
        <p className="text-sm mt-2 text-foreground/80 truncate">
          {order.lines.map((l) => `${l.qty}× ${l.name}`).join(" · ")}
        </p>
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
