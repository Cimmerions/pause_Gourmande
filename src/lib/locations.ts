import { supabase } from "./supabase";

export type Location = {
  id: number;
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  start_time: string | null;
  end_time: string | null;
  active: boolean;
  created_at: string;
};

export async function getActiveLocation(): Promise<Location | null> {
  const { data, error } = await supabase
    .from("locations")
    .select("*")
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Erreur récupération localisation :", error);
    return null;
  }

  return data;
}

export async function getLocation(): Promise<Location | null> {
  const { data, error } = await supabase
    .from("locations")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Erreur récupération localisation :", error);
    return null;
  }

  return data;
}

export async function updateLocation(
  id: number,
  values: {
    name: string;
    address: string;
    latitude: number | null;
    longitude: number | null;
    start_time: string;
    end_time: string;
    active: boolean;
  }
) {
  const { data, error } = await supabase
    .from("locations")
    .update(values)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Erreur mise à jour localisation :", error);
    return null;
  }

  return data;
}