import { supabase } from "./supabase";
import { findCustomer } from "./customers";
import { getLoyaltySettings } from "./loyalty";


export async function saveSpin(
  phone: string,
  prize: string,
  points: number
) {
  return await supabase.rpc(
    "save_wheel_spin",
    {
      p_phone: phone,
      p_prize: prize,
      p_points: points,
    }
  );
}



export async function addCustomerPoints(
  phone: string,
  points: number
) {
  const { error } = await supabase.rpc(
    "add_customer_points",
    {
      p_phone: phone,
      p_points: points,
    }
  );

  if (error) {
    console.error("ADD CUSTOMER POINTS :", error);
    return;
  }

  const customer = await findCustomer(phone);

  if (!customer) return;

  const loyaltySettings = await getLoyaltySettings();

  if (
    customer.points >= loyaltySettings.threshold
  ) {
    const { hasActiveLoyaltyReward, saveReward } =
      await import("./rewards");

    const alreadyHasReward =
      await hasActiveLoyaltyReward(customer.phone);

    if (!alreadyHasReward) {
      await saveReward(
        customer.phone,
        loyaltySettings.reward,
        "loyalty"
      );
    }
  }
}

export async function hasPlayedToday(phone: string) {
  const { data, error } = await supabase.rpc(
    "has_played_wheel_today",
    {
      p_phone: phone,
    }
  );

  if (error) {
    console.error(error);
    return false;
  }

  return data === true;
}