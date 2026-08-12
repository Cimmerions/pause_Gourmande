import { supabase } from "./supabase";

function generateReferralCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "PG-";

  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }

  return code;
}

export async function findCustomer(phone: string) {
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .eq("phone", phone)
    .maybeSingle();

  if (error) {
    console.error(error);
    return null;
  }

  return data;
}

export async function createCustomer(
  name: string,
  phone: string,
  referredBy?: number
) {
  const referralCode = generateReferralCode();

  const { data, error } = await supabase
    .from("customers")
    .insert({
      name,
      phone,
      points: 0,
      referral_code: referralCode,
      referred_by: referredBy ?? null,
      referral_reward_received: false,
    })
    .select()
    .single();

  if (error) {
    console.error(error);
    return null;
  }

  return data;
}

export async function findCustomerByReferralCode(
  referralCode: string
) {
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .eq("referral_code", referralCode)
    .maybeSingle();

  if (error) {
    console.error(error);
    return null;
  }

  return data;
}

export async function updateCustomerPoints(
  id: number,
  points: number
) {
  return await supabase
    .from("customers")
    .update({ points })
    .eq("id", id);
}