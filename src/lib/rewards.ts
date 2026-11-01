
import { supabase } from "./supabase";

export async function getRewards() {
  const { data, error } = await supabase.rpc(
    "get_my_customer_rewards"
  );

  if (error) {
    console.error(
      "Erreur récupération des récompenses :",
      error
    );
    return [];
  }

  return data ?? [];
}
