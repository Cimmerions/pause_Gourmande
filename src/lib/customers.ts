
import { supabase } from "@/lib/supabase";

export async function getCurrentCustomer() {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    console.error(
      "Erreur récupération utilisateur :",
      userError
    );
    return null;
  }

  if (!user) {
    return null;
  }

  const { data, error } = await supabase.rpc(
    "get_my_customer_profile"
  );

  if (error) {
    console.error(
      "Erreur récupération du profil client :",
      error
    );
    return null;
  }

  return data?.[0] ?? null;
}
