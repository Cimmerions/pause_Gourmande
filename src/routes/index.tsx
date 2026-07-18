import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Search, ShoppingCart, Heart, Sparkles, Copy, MapPin, Clock, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { products, formatFCFA } from "@/lib/products";
import { useCart } from "@/lib/cart-store";
import { ProductCard } from "@/components/ProductCard";
import { LuckyWheel } from "@/components/LuckyWheel";
import { CartSheet } from "@/components/CartSheet";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Pause Gourmande — Crêpes & Gaufres artisanales à Lomé" },
      {
        name: "description",
        content:
          "Commandez vos crêpes et gaufres faites main. Retrouvez notre food-truck aujourd'hui à l'Université de Lomé, de 09h à 15h.",
      },
      { property: "og:title", content: "Pause Gourmande — Crêpes & Gaufres à Lomé" },
      {
        property: "og:description",
        content: "Le réconfort d'une crêpe faite main. Commande, réservation, fidélité et jeu.",
      },
    ],
  }),
  component: Home,
});

const CATEGORIES = ["Tout", "Crêpes", "Gaufres", "Boissons"] as const;

function Home() {
  const { count, total, points } = useCart();
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<(typeof CATEGORIES)[number]>("Tout");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter(
      (p) =>
        (cat === "Tout" || p.category === cat) &&
        (!q || p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)),
    );
  }, [query, cat]);

  const nextRewardAt = 1000;
  const progress = Math.min(100, Math.round((points / nextRewardAt) * 100));

  const copyReferral = () => {
    navigator.clipboard.writeText("PAUSE-GOURMANDE");
    toast.success("Code parrainage copié !");
  };

  return (
    <div className="min-h-screen bg-brand-cream text-foreground selection:bg-brand-gold/20">
      {/* Navigation */}
      <nav className="sticky top-0 z-40 bg-brand-cream/90 backdrop-blur-md border-b border-brand-gold/10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <a href="#top" className="flex items-center gap-3">
            <div className="size-9 bg-brand-gold rounded-full flex items-center justify-center text-white shadow-md shadow-brand-gold/30">
              <Sparkles className="size-4" />
            </div>
            <div>
              <p className="text-[10px] font-semibold text-brand-gold uppercase tracking-[0.12em]">
                En direct du campus
              </p>
              <p className="text-sm font-semibold">Université de Lomé • 09h — 15h</p>
            </div>
          </a>
          <div className="flex items-center gap-2">
            <a
              href="#fidelite"
              className="hidden md:inline-flex items-center gap-2 text-sm font-medium text-brand-deep/70 hover:text-brand-gold transition"
            >
              <Heart className="size-4" /> {points} pépites
            </a>
            <Link
              to="/dashboard"
              className="hidden sm:inline-flex items-center gap-2 text-sm font-medium text-brand-deep/70 hover:text-brand-gold transition"
            >
              <LayoutDashboard className="size-4" />
              <span className="hidden md:inline">Bord</span>
            </Link>
            <CartSheet>
              <Button
                variant="default"
                className="rounded-full h-11 px-5 gap-2 relative shadow-md shadow-brand-gold/25"
              >
                <ShoppingCart className="size-4" />
                <span className="hidden sm:inline">Panier</span>
                {count > 0 && (
                  <span className="ml-1 bg-white text-brand-gold rounded-full size-6 text-xs font-bold flex items-center justify-center">
                    {count}
                  </span>
                )}
              </Button>
            </CartSheet>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section
        id="top"
        className="pt-16 pb-24 px-4 relative overflow-hidden"
        style={{
          backgroundImage:
            "radial-gradient(circle at top right, color-mix(in oklab, var(--brand-gold) 15%, transparent) 0%, transparent 40%)",
        }}
      >
        <div className="max-w-7xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-gold/10 text-brand-gold text-xs font-semibold mb-6 ring-1 ring-brand-gold/20">
            <span className="size-1.5 rounded-full bg-brand-gold animate-pulse" />
            Préparées avec amour à la minute
          </div>
          <h1 className="text-5xl md:text-7xl font-semibold tracking-tight leading-[0.95] text-balance max-w-[15ch] mb-8">
            Le réconfort d'une crêpe faite main.
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-[48ch] text-pretty mb-10 leading-relaxed">
            Découvrez le goût authentique du fait-maison. Des produit de qualité pour vous offrir
            une légèreté et un moelleux incomparables.
          </p>
          <div className="flex flex-wrap gap-4">
            <Button
              size="lg"
              className="h-14 px-8 rounded-full text-base font-semibold shadow-xl shadow-brand-gold/25"
              asChild
            >
              <a href="#catalogue">Commander mon goûter</a>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-14 px-8 rounded-full text-base font-medium bg-white"
              asChild
            >
              <a href="#jeu">Tenter ma chance</a>
            </Button>
          </div>

          <div className="mt-14 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl">
            {[
              { k: "24h", v: "Pâte reposée" },
              { k: "100%", v: "Fait main" },
              { k: "6", v: "Recettes signature" },
              { k: "500+", v: "Clients fidèles" },
            ].map((s) => (
              <div key={s.k} className="bg-white/60 backdrop-blur rounded-2xl p-4 ring-1 ring-border">
                <p className="text-2xl font-semibold text-brand-gold">{s.k}</p>
                <p className="text-xs text-muted-foreground mt-1">{s.v}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Catalogue */}
      <section
        id="catalogue"
        className="py-24 bg-brand-warm rounded-t-[40px] shadow-[0_-12px_40px_-15px_rgba(217,119,6,0.05)]"
      >
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
            <div>
              <h2 className="text-4xl font-semibold tracking-tight text-balance mb-4">
                Nos Douceurs Signatures
              </h2>
              <p className="text-muted-foreground max-w-[45ch]">
                Des recettes pensées pour illuminer votre pause déjeuner, entre deux cours ou après
                le travail.
              </p>
            </div>
            <div className="relative w-full md:w-72">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher une gourmandise…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-11 h-12 rounded-full bg-white"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mb-10">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setCat(c)}
                className={
                  "px-4 py-2 rounded-full text-sm font-medium transition ring-1 " +
                  (cat === c
                    ? "bg-brand-deep text-brand-cream ring-brand-deep"
                    : "bg-white text-foreground ring-border hover:ring-brand-gold/40")
                }
              >
                {c}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filtered.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>

          {filtered.length === 0 && (
            <p className="text-center text-muted-foreground py-16">
              Aucun produit ne correspond à votre recherche.
            </p>
          )}
        </div>
      </section>

      {/* Wheel */}
      <section id="jeu" className="py-24 bg-brand-deep text-brand-cream relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.06] pointer-events-none">
          <div className="absolute top-[-10%] right-[-5%] size-[600px] rounded-full border border-brand-gold" />
          <div className="absolute bottom-[-20%] left-[-10%] size-[800px] rounded-full border border-brand-gold" />
        </div>

        <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center relative z-10">
          <div>
            <div className="inline-block px-3 py-1 rounded-full bg-brand-gold/20 text-brand-gold text-xs font-bold mb-6 tracking-widest uppercase">
              Le Jeu du Goûter
            </div>
            <h2 className="text-4xl md:text-5xl font-semibold tracking-tight text-balance max-w-[20ch] mb-8">
              Une surprise sucrée à chaque tour de roue.
            </h2>
            <p className="text-brand-cream/70 text-lg text-pretty max-w-[45ch] mb-8 leading-relaxed">
              Ne repartez jamais les mains vides. Tentez votre chance pour gagner un supplément
              gratuit, une réduction, des pépites de fidélité — ou, avec un peu de chance, une
              crêpe offerte.
            </p>
            <ul className="space-y-2 text-sm text-brand-cream/80">
              {["1 essai gratuit par jour", "Récompenses immédiates", "Cumule avec la fidélité"].map(
                (t) => (
                  <li key={t} className="flex items-center gap-2">
                    <span className="size-1.5 rounded-full bg-brand-gold" /> {t}
                  </li>
                ),
              )}
            </ul>
          </div>

          <LuckyWheel />
        </div>
      </section>

      {/* Loyalty & Referral */}
      <section id="fidelite" className="py-24">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-card p-10 rounded-[40px] shadow-sm ring-1 ring-border">
              <h3 className="text-3xl font-semibold mb-3">Mon Espace Douceur</h3>
              <p className="text-muted-foreground mb-8">
                Cumulez des pépites et transformez-les en gourmandises.
              </p>
              <div className="p-6 bg-brand-warm rounded-[28px] ring-1 ring-brand-gold/5">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className="size-12 bg-brand-gold rounded-2xl flex items-center justify-center text-white shadow-lg shadow-brand-gold/20">
                      <Sparkles className="size-5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-brand-gold">
                        Vos Pépites
                      </p>
                      <p className="text-3xl font-semibold">{points}</p>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">100 F = 1 pépite</span>
                </div>
                <div className="w-full h-2 bg-brand-gold/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-brand-gold transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-[11px] font-medium text-muted-foreground mt-3">
                  {points >= nextRewardAt
                    ? "🎉 Une crêpe offerte vous attend à votre prochaine commande !"
                    : `Plus que ${nextRewardAt - points} pépites pour votre prochaine crêpe offerte.`}
                </p>
              </div>
            </div>

            <div className="bg-brand-gold p-10 rounded-[40px] text-white shadow-xl shadow-brand-gold/20 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-20">
                <div className="size-24 border-8 border-white rounded-full" />
              </div>
              <h3 className="text-3xl font-semibold mb-3 relative">Partager le Bonheur</h3>
              <p className="text-white/85 mb-10 text-pretty leading-relaxed relative">
                Invitez vos amis et recevez chacun une garniture premium offerte sur votre
                prochaine commande.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 relative">
                <div className="flex-1 bg-white/10 backdrop-blur border border-white/20 rounded-2xl px-5 py-4 font-mono text-sm flex items-center justify-between">
                  <span>PAUSE-GOURMANDE</span>
                  <span className="text-[10px] font-bold opacity-50 uppercase">Code</span>
                </div>
                <button
                  onClick={copyReferral}
                  className="bg-white text-brand-gold px-6 py-4 rounded-2xl font-bold text-sm shadow-lg transition active:scale-95 flex items-center justify-center gap-2"
                >
                  <Copy className="size-4" /> Copier
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Localisation */}
      <section className="pb-24">
        <div className="max-w-7xl mx-auto px-4">
          <div className="bg-card p-8 md:p-12 rounded-[40px] ring-1 ring-border grid md:grid-cols-2 gap-8 items-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-brand-gold mb-3">
                Où suis-je aujourd'hui ?
              </p>
              <h3 className="text-3xl font-semibold mb-4">Université de Lomé</h3>
              <p className="text-muted-foreground mb-6 leading-relaxed">
                Notre stand est installé devant le bâtiment principal. Cherchez la fumée dorée et
                l'odeur du caramel — vous ne pouvez pas nous rater.
              </p>
              <div className="flex flex-wrap gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <MapPin className="size-4 text-brand-gold" />
                  <span>Campus principal, Lomé</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="size-4 text-brand-gold" />
                  <span>09h00 – 15h00</span>
                </div>
              </div>
            </div>
            <div className="aspect-[4/3] rounded-3xl bg-brand-warm ring-1 ring-border relative overflow-hidden">
              <div className="absolute inset-0 flex items-center justify-center">
                <MapPin className="size-16 text-brand-gold/40" />
              </div>
              <div className="absolute bottom-4 left-4 right-4 bg-white/90 backdrop-blur rounded-2xl p-4">
                <p className="text-xs font-bold uppercase tracking-widest text-brand-gold">
                  Prochain arrêt
                </p>
                <p className="font-semibold">Demain — Zone Industrielle • 11h — 14h</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Floating cart */}
      {count > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-lg z-40">
          <CartSheet>
            <button className="w-full bg-brand-deep text-brand-cream px-6 py-4 rounded-[24px] flex items-center justify-between shadow-2xl shadow-brand-deep/40 ring-1 ring-white/10 transition active:scale-[0.98]">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <ShoppingCart className="size-6 text-brand-gold" />
                  <span className="absolute -top-2 -right-2 size-5 bg-brand-gold text-white rounded-full text-[10px] flex items-center justify-center font-bold ring-2 ring-brand-deep">
                    {count}
                  </span>
                </div>
                <span className="font-semibold text-base">Voir mon panier</span>
              </div>
              <span className="font-bold text-lg">{formatFCFA(total)}</span>
            </button>
          </CartSheet>
        </div>
      )}

      {/* Footer */}
      <footer className="py-16 text-center border-t border-border">
        <div className="size-12 bg-brand-gold/10 rounded-full mx-auto flex items-center justify-center text-brand-gold mb-4">
          <Heart className="size-5 fill-current" />
        </div>
        <p className="text-sm font-medium text-muted-foreground">
          © 2026 Pause Gourmande • Fait main avec passion à Lomé.
        </p>
      </footer>
    </div>
  );
}
