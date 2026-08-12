import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { saveReward } from "@/lib/rewards";
import { findCustomer } from "@/lib/customers";
import {
  hasPlayedToday,
  saveSpin,
  addCustomerPoints
 } from "@/lib/wheel";

type Prize = { label: string; color: string; weight: number };

const PRIZES: Prize[] = [
  { label: "    +50 pépites", color: "#d97706", weight: 20 },
  { label: "    Bissap offert", color: "#f5f0e0", weight: 8 },
  { label: "      Réessayez", color: "#d97706", weight: 40 },
  { label: "  -10%", color: "#f5f0e0", weight: 12 },
  { label: "  +100 pépites", color: "#d97706", weight: 5 },
  { label: "     -20%", color: "#f5f0e0", weight: 3 },
  { label: "      Réessayez", color: "#d97706", weight: 10 },
  { label: "    🥞 Crêpe offerte", color: "#f5f0e0", weight: 2 },
];

const SEG = 360 / PRIZES.length;

export function LuckyWheel() {
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [used, setUsed] = useState(false);
  const [phone, setPhone] = useState("");
  const [customer, setCustomer] = useState<any>(null);
  const [customerLoading, setCustomerLoading] = useState(false);

  useEffect(()=>{

    if(phone.length < 8){
      setCustomer(null);
      setUsed(false);
      return;
    }


    const timer = setTimeout(()=>{

      checkPreviousSpin(phone);

    },500);


    return ()=>clearTimeout(timer);


  },[phone]);

  const checkPreviousSpin = async (value:string)=>{


    setPhone(value);


    if(!value){

      setUsed(false);
      setCustomer(null);

      return;

    }

    setCustomer(null);
    setUsed(false);

    setCustomerLoading(true);



    const client = await findCustomer(value);


    setCustomer(client);



    if(client){

      const played = await hasPlayedToday(value);

      setUsed(played);

    }
    else{

      setCustomer(null);
      setUsed(false);

    }



    setCustomerLoading(false);

  };

  const wheelRef = useRef<HTMLDivElement>(null);

  const pickPrize = () => {
    const total = PRIZES.reduce((s, p) => s + p.weight, 0);
    let r = Math.random() * total;
    for (let i = 0; i < PRIZES.length; i++) {
      r -= PRIZES[i].weight;
      if (r <= 0) return i;
    }
    return 0;
  };

  const spin = async () => {

    if (spinning || used || !customer) return;

    const played = await hasPlayedToday(customer.phone);

    if (played) {
      toast.error("Vous avez déjà joué aujourd'hui.");
      return;
    }

    setSpinning(true);

    const idx = pickPrize();

    const center = idx * SEG + SEG / 2;

    const offset = (Math.random() - 0.5) * (SEG * 0.5);

    const current = rotation % 360;

    const target =
      rotation +
      360 * 6 -
      current -
      center +
      offset;

    setRotation(target);

    setTimeout(async () => {

      const prize = PRIZES[idx];


      if (
        prize.label.includes("%") ||
        prize.label.includes("offert")
      ) {


        await saveReward(
          customer.phone,
          prize.label
        );

      }

      let gainedPoints = 0;

      if (prize.label.includes("pépites")) {
        gainedPoints = parseInt(
          prize.label.replace(/\D/g, ""),
          10
        );

        await addCustomerPoints(
          customer.id,
          customer.points ?? 0,
          gainedPoints
         );

         const updatedCustomer = await findCustomer(customer.phone);

         setCustomer(updatedCustomer);
      }

      await saveSpin(
        customer.phone,
        prize.label,
        gainedPoints
      );

      toast.success(`🎁 ${prize.label}`, {
        description:
          prize.label.includes("Réessayez")
            ? "Pas de chance cette fois."
            : "Récompense ajoutée à votre compte."
      });

      setUsed(true);
      setSpinning(false);

    }, 4200);

  };

  return (
    <div className="flex flex-col items-center gap-8">

      <input
        type="tel"
        placeholder="Votre numéro de téléphone"
        value={phone}
        onChange={(e)=>setPhone(e.target.value)}
        className="px-5 py-3 rounded-full border w-full max-w-sm text-center"
      />

      {
       customerLoading && (
        <p className="text-sm text-muted-foreground">
          Recherche du compte...
        </p>
      )
      }


      {
       customer && (

        <div className="bg-brand-cream rounded-2xl p-4 text-center shadow">

          <p className="text-lg font-bold text-brand-deep">
            👋 Bonjour {customer.name}
          </p>


          <p className="text-brand-gold font-bold mt-1">
            ✨ Solde fidélité : {customer.points ?? 0} pépites
          </p>


          {
            used ? (

              <p className="text-sm text-muted-foreground mt-2">
                ⏳ Vous avez déjà joué aujourd'hui
              </p>

            ) : (

              <p className="text-sm text-muted-foreground mt-2">
                🎡 Vous pouvez tenter votre chance aujourd'hui
              </p>

            )
          }

        </div>

       )
      }

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
                transform: `rotate(${i * SEG + SEG / 2 - 90}deg) translateX(20%)`,
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
