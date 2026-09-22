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
  const { data, error } = await supabase.rpc(
    "get_customer_by_phone",
    {
      p_phone: phone,
    }
  );

  if (error) {
    console.error(error);
    return null;
  }

  return data?.[0] ?? null;
}

export async function createCustomer(
  name: string,
  phone: string,
  referredBy?: number
) {
  const referralCode = generateReferralCode();

  const { data, error } = await supabase.rpc(
    "create_customer_secure",
    {
      p_name: name,
      p_phone: phone,
      p_referred_by: referredBy ?? null,
      p_referral_code: referralCode,
    }
  );

  if (error) {
    console.error(error);
    return null;
  }

  return data;
}

export async function findCustomerByReferralCode(
  referralCode: string
) {
  const { data, error } = await supabase.rpc(
    "find_customer_by_referral_code",
    {
      customer_referral_code: referralCode,
    }
  );

  if (error) {
    console.error(error);
    return null;
  }

  return data?.[0] ?? null;
}

export async function useLoyaltyReward(
  rewardId: number,
  orderId: string,
  phone: string
) {
  const { data, error } = await supabase.rpc(
    "use_loyalty_reward",
    {
      p_reward_id: rewardId,
      p_order_id: orderId,
      p_phone: phone,
    }
  );

  if (error) {
    console.error(
      "Erreur utilisation récompense fidélité :",
      error
    );
    return { data: null, error };
  }

  return { data, error: null };
}