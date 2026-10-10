
import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { getCurrentCustomer } from "@/lib/customers";
import { getAppSettings } from "@/lib/settings";
import { supabase } from "@/lib/supabase";
import { Gift } from "lucide-react";

type Prize = {
  label: string;
  color: string;
  weight: number;
};

const DEFAULT_PRIZES: Prize[] = [
  { label: "+50 pépites", color: "#d97706", weight: 20 },
  { label: "🥞 Crêpe offerte", color: "#f5f0e0", weight: 5 },
  { label: "Réessayez", color: "#d97706", weight: 35 },
  { label: "-10%", color: "#f5f0e0", weight: 10 },
  { label: "+100 pépites", color: "#d97706", weight: 10 },
  { label: "Oops!", color: "#f5f0e0", weight: 20 },
];

type Customer = {
  name: string | null;
  phone: string | null;
  points: number | null;
};

export function LuckyWheel() {
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [used, setUsed] = useState(false);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [prizes, setPrizes] = useState<Prize[]>(DEFAULT_PRIZES);
  const wheelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;

    async function initialize() {
      setLoading(true);

      try {
        const [profile, settings] = await Promise.all([
          getCurrentCustomer(),
          getAppSettings(),
        ]);

        if (!active) return;

        setCustomer(profile as Customer | null);

        if (settings?.wheel_prizes?.length) {
          setPrizes((current) =>
            settings.wheel_prizes.map((item, index) => ({
              label: item.label,
              weight: item.weight,
              color: current[index]?.color ?? "#f5f0e0",
            }))
          );
        }

        if (profile) {
          const { data, error } = await supabase.rpc(
            "has_my_played_wheel_today"
          );

          if (error) throw error;
          if (active) setUsed(data === true);
        }
      } catch (error) {
        console.error("Initialisation de la roue :", error);
        if (active) {
          toast.error("Impossible de charger la roue. Réessayez.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    initialize();

    return () => {
      active = false;
    };
  }, []);

  const spin = async () => {
    if (spinning || used || !customer) return;

    setSpinning(true);

    try {
      // Le serveur choisit et enregistre lui-même le lot gagné.
      const { data, error } = await supabase.rpc("spin_wheel_secure");

      if (error) {
        if (error.message.includes("déjà joué")) {
          setUsed(true);
          toast.error("Vous avez déjà joué aujourd'hui.");
        } else {
          console.error("Tirage sécurisé :", error);
          toast.error(error.message || "Le tirage a échoué.");
        }
        return;
      }

      const result = data as { prize?: string; points?: number } | null;
      const label = result?.prize;

      if (!label) {
        toast.error("Le résultat du tirage est invalide.");
        return;
      }

      const index = Math.max(
        0,
        prizes.findIndex((prize) => prize.label.trim() === label.trim())
      );

      const segment = 360 / prizes.length;
      const center = index * segment + segment / 2;
      const current = rotation % 360;
      const target =
        rotation + 360 * 6 - current - center;

      setRotation(target);

      window.setTimeout(async () => {
        try {
          setUsed(true);

          const updatedCustomer = await getCurrentCustomer();
          if (updatedCustomer) {
            setCustomer(updatedCustomer as Customer);
          }

          toast.success(`🎁 ${label}`, {
            description:
              label.includes("Réessayez") || label.includes("Oops")
                ? "Oops! Retentez votre chance demain !"
                : "Bravo! Récompense disponible sur votre prochaine commande.",
          });
        } finally {
          setSpinning(false);
        }
      }, 4200);
    } catch (error) {
      console.error("Erreur pendant le tirage :", error);
      toast.error("Une erreur est survenue. Réessayez.");
    } finally {
      // L'animation garde la roue active jusqu'à son terme.
      // En cas d'erreur, le bouton est réactivé immédiatement.
      // En cas de succès, le minuteur s'en charge.
    }
  };

  if (loading) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        Chargement de la roue…
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="max-w-md rounded-2xl bg-brand-cream p-6 text-center shadow">
        <div className="flex items-center justify-center gap-2">
          <Gift className="size-6 text-brand-gold" strokeWidth={1.8} />
          <p className="text-lg font-bold text-brand-deep">
            Le Jeu du Goûter
          </p>
        </div>    
        <p className="mt-2 text-sm text-muted-foreground">
          Connectez-vous à votre compte Pause Gourmande pour tenter votre
          chance et recevoir vos récompenses.
        </p>
        <Button asChild className="mt-4 rounded-full">
          <Link to="/account">Se connecter</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-8">
      <div className="rounded-2xl bg-brand-cream p-4 text-center shadow">
        <p className="text-lg font-bold text-brand-deep">
          👋 Bonjour {customer.name || "gourmand(e)"}
        </p>
        <p className="mt-1 font-bold text-brand-gold">
          ✨ Solde fidélité : {customer.points ?? 0} pépites
        </p>
      </div>

      <div className="relative aspect-square w-full max-w-sm">
        <div className="absolute left-1/2 top-0 z-30 -mt-2 -translate-x-1/2">
          <div className="h-0 w-0 border-l-[14px] border-r-[14px] border-t-[24px] border-l-transparent border-r-transparent border-t-brand-gold drop-shadow-lg" />
        </div>

        <div
          ref={wheelRef}
          className="absolute inset-0 overflow-hidden rounded-full ring-[10px] ring-white/10 shadow-2xl"
          style={{
            transform: `rotate(${rotation}deg)`,
            transition: spinning
              ? "transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99)"
              : "none",
            background: `conic-gradient(${prizes
              .map((prize, index) => {
                const segment = 360 / prizes.length;
                return `${prize.color} ${index * segment}deg ${(index + 1) * segment}deg`;
              })
              .join(", ")})`,
          }}
        >
          {prizes.map((prize, index) => {
            const segment = 360 / prizes.length;

            return (
              <div
                key={`${prize.label}-${index}`}
                className="absolute left-1/2 top-1/2 origin-left text-[11px] font-bold tracking-tight"
                style={{
                  transform: `rotate(${index * segment + segment / 2 - 90}deg) translateX(25%)`,
                  color: prize.color === "#d97706" ? "white" : "#2d2a24",
                  width: "40%",
                  textAlign: "center",
                }}
              >
                <span className="block px-2">{prize.label}</span>
              </div>
            );
          })}
        </div>

        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="flex size-16 items-center justify-center rounded-full bg-brand-cream ring-4 ring-brand-gold shadow-xl">
            <span className="text-xs font-bold text-brand-gold">SPIN</span>
          </div>
        </div>
      </div>

      <Button
        onClick={spin}
        disabled={spinning || used}
        size="lg"
        className="h-14 rounded-full px-10 text-base font-bold shadow-xl shadow-brand-gold/30"
      >
        {used
          ? "Déjà joué aujourd'hui"
          : spinning
            ? "Ça tourne…"
            : "Lancer la roue"}
      </Button>
    </div>
  );
}
