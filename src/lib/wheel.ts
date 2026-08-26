import { supabase } from "./supabase";
import { findCustomer } from "./customers";
import { getLoyaltySettings } from "./loyalty";


export async function saveSpin(
  phone:string,
  prize:string,
  points:number
){

  return await supabase
    .from("wheel_spins")
    .insert({
      customer_phone:phone,
      prize,
      points
    });

}



export async function addCustomerPoints(
  phone: string,
  points: number
) {
  const customer = await findCustomer(phone);

  if (!customer) return;

  const loyaltySettings = await getLoyaltySettings();

  const currentPoints = customer.points ?? 0;

  const newBalance = Math.min(
    loyaltySettings.threshold,
    currentPoints + Math.max(0, points)
  );

  await supabase
    .from("customers")
    .update({
      points: newBalance,
    })
    .eq("id", customer.id);

    if (
      currentPoints < loyaltySettings.threshold &&
      newBalance === loyaltySettings.threshold
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

export async function hasPlayedToday(phone:string){

  const {data,error}=await supabase
    .from("wheel_spins")
    .select("id")
    .eq("customer_phone",phone)
    .gte(
      "created_at",
      new Date(
        new Date().setHours(0,0,0,0)
      ).toISOString()
    )
    .maybeSingle();


  if(error){
    console.error(error);
    return false;
  }


  return !!data;

}