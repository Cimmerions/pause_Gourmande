import { supabase } from "./supabase";

export async function saveReward(
  phone: string,
  reward: string,
  source: "wheel" | "loyalty" | "referral" = "wheel"
) {
  const type =
    reward.includes("%")
      ? "discount"
      : "product";

  const { error } = await supabase
    .from("customer_rewards")
    .insert({
      customer_phone: phone,
      type,
      value: reward,
      source,
    });

  if (error) {
    console.error("SAVE REWARD :", error);
  }
}

export async function getRewards(phone: string) {
  const { data, error } = await supabase
    .from("customer_rewards")
    .select("*")
    .eq("customer_phone", phone)
    .eq("used", false);

  if (error) {
    console.error(error);
    return [];
  }

  return data;
}

export async function useReward(
  id: number,
  orderId: string
) {
  return await supabase
    .from("customer_rewards")
    .update({
      used: true,
      used_at: new Date().toISOString(),
      order_id: orderId,
    })
    .eq("id", id);
}

export async function hasActiveLoyaltyReward(phone: string) {
  const { data, error } = await supabase
    .from("customer_rewards")
    .select("id")
    .eq("customer_phone", phone)
    .eq("source", "loyalty")
    .eq("used", false)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("CHECK LOYALTY REWARD :", error);
    return false;
  }

  return !!data;
}