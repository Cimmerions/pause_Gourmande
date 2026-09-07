import { supabase } from "./supabase";

export type WheelSetting = {
  label: string;
  weight: number;
};

export type ReferralSurpriseSetting = {
  label: string;
  weight: number;
};

export type AppSettings = {
  id: number;

  loyalty_threshold: number;
  loyalty_reward: string;

  wheel_prizes: WheelSetting[];

  referral_surprises: ReferralSurpriseSetting[];

  updated_at: string;
};

export async function getAppSettings(): Promise<AppSettings | null> {
  const { data, error } = await supabase
    .from("app_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    console.error("Erreur récupération paramètres :", error);
    return null;
  }

  return data;
}

export async function updateAppSettings(values: {
  loyalty_threshold: number;
  loyalty_reward: string;
  wheel_prizes: WheelSetting[];
  referral_surprises: ReferralSurpriseSetting[];
}) {
  const { data, error } = await supabase
    .from("app_settings")
    .update({
      ...values,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1)
    .select()
    .single();

  if (error) {
    console.error("Erreur mise à jour paramètres :", error);
    return null;
  }

  return data;
}