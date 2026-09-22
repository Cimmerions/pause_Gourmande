import { supabase } from "./supabase";

export type ReferralSurprise = {
  label: string;
  weight: number;
};

export async function pickReferralSurprise(): Promise<string | null> {
  const { data, error } = await supabase
    .from("app_settings")
    .select("referral_surprises")
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    console.error(
      "Erreur récupération surprises de parrainage :",
      error
    );

    return null;
  }

  const surprises = (data?.referral_surprises ?? []) as ReferralSurprise[];

  if (surprises.length === 0) {
    console.error("Aucune surprise de parrainage configurée.");
    return null;
  }

  const totalWeight = surprises.reduce(
    (sum, reward) => sum + Number(reward.weight),
    0
  );

  if (totalWeight <= 0) {
    console.error(
      "Les probabilités des surprises de parrainage sont invalides."
    );

    return null;
  }

  let random = Math.random() * totalWeight;

  for (const reward of surprises) {
    random -= Number(reward.weight);

    if (random <= 0) {
      return reward.label;
    }
  }

  return surprises[0].label;
}

export async function saveReward(
  phone: string,
  reward: string,
  source: "wheel" | "loyalty" | "referral" = "wheel"
) {
  const { data, error } = await supabase.rpc(
    "save_customer_reward",
    {
      p_phone: phone,
      p_reward: reward,
      p_source: source,
    }
  );

  if (error) {
    console.error("SAVE REWARD :", error);
    return null;
  }

  return data;
}

export async function getRewards(phone: string) {
  const { data, error } = await supabase.rpc(
    "get_customer_rewards",
    {
      p_phone: phone,
    }
  );

  if (error) {
    console.error(error);
    return [];
  }

  return data ?? [];
}

export async function useReward(
  id: number,
  orderId: string
) {
  const { data, error } = await supabase.rpc(
    "use_customer_reward",
    {
      p_id: id,
      p_order_id: orderId,
    }
  );

  if (error) {
    console.error("USE REWARD :", error);
  }

  return { data, error };
}

export async function hasActiveLoyaltyReward(phone: string) {
  const { data, error } = await supabase.rpc(
    "has_active_loyalty_reward",
    {
      p_phone: phone,
    }
  );

  if (error) {
    console.error("CHECK LOYALTY REWARD :", error);
    return false;
  }

  return data === true;
}