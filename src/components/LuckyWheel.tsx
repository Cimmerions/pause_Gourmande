import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useCart } from "@/lib/cart-store";

type Prize = { label: string; color: string; weight: number };

const PRIZES: Prize[] = [
  { label: "+50 pépites", color: "#d97706", weight: 25 },
  { label: "Bissap offert", color: "#f5f0e0", weight: 15 },
  { label: "      Réessayez", color: "#d97706", weight: 25 },
  { label: "-10%", color: "#f5f0e0", weight: 15 },
  { label: "  +100 pépites", color: "#d97706", weight: 10 },
  { label: "     -20%", color: "#f5f0e0", weight: 8 },
  { label: "      Réessayez", color: "#d97706", weight: 1 },
  { label: "  🥞 Crêpe offerte", color: "#f5f0e0", weight: 1 },
];

const SEG = 360 / PRIZES.length;

export function LuckyWheel() {
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [used, setUsed] = useState(false);
  const wheelRef = useRef<HTMLDivElement>(null);
  const { addPoints } = useCart();

  const pickPrize = () => {
    const total = PRIZES.reduce((s, p) => s + p.weight, 0);
    let r = Math.random() * total;
    for (let i = 0; i < PRIZES.length; i++) {
      r -= PRIZES[i].weight;
      if (r <= 0) return i;
    }
    return 0;
  };

  const spin = () => {
    if (spinning || used) return;
    setSpinning(true);
    const idx = pickPrize();
    const target = 360 * 6 + (360 - (idx * SEG + SEG / 2));
    const next = rotation + target;
    setRotation(next);

    setTimeout(() => {
      const prize = PRIZES[idx];
      if (prize.label.includes("pépites")) {
        const n = parseInt(prize.label.replace(/\D/g, ""), 10);
        addPoints(n);
      }
      toast.success(`🎁 ${prize.label}`, {
        description:
          prize.label === "Réessayez"
            ? "Pas de chance cette fois."
            : "Récompense créditée sur votre compte.",
      });
      setSpinning(false);
      setUsed(true);
    }, 4200);
  };

  return (
    <div className="flex flex-col items-center gap-8">
      <div className="relative aspect-square w-full max-w-sm">
        {/* Pointer */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -mt-2 z-30">
          <div className="w-0 h-0 border-l-[14px] border-l-transparent border-r-[14px] border-r-transparent border-t-[24px] border-t-brand-gold drop-shadow-lg" />
        </div>

        {/* Wheel */}
        <div
          ref={wheelRef}
          className="absolute inset-0 rounded-full overflow-hidden ring-[10px] ring-white/10 shadow-2xl"
          style={{
            transform: `rotate(${rotation}deg)`,
            transition: spinning
              ? "transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99)"
              : "none",
            background: `conic-gradient(${PRIZES.map(
              (p, i) => `${p.color} ${i * SEG}deg ${(i + 1) * SEG}deg`,
            ).join(", ")})`,
          }}
        >
          {PRIZES.map((p, i) => (
            <div
              key={i}
              className="absolute top-1/2 left-1/2 origin-left text-[11px] font-bold tracking-tight"
              style={{
                transform: `rotate(${i * SEG + SEG / 2}deg) translateX(20%)`,
                color: p.color === "#d97706" ? "white" : "#2d2a24",
                width: "40%",
              }}
            >
              <span className="block px-2">{p.label}</span>
            </div>
          ))}
        </div>

        {/* Center */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="size-16 rounded-full bg-brand-cream ring-4 ring-brand-gold flex items-center justify-center shadow-xl">
            <span className="font-bold text-xs text-brand-gold">SPIN</span>
          </div>
        </div>
      </div>

      <Button
        onClick={spin}
        disabled={spinning || used}
        size="lg"
        className="h-14 px-10 rounded-full text-base font-bold shadow-xl shadow-brand-gold/30"
      >
        {used ? "Déjà joué aujourd'hui" : spinning ? "Ça tourne…" : "Lancer la roue"}
      </Button>
    </div>
  );
}
