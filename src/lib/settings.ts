import { supabase } from "./supabase";
import { adminSupabase } from "./admin-supabase";

export type WheelSetting = {
  label: string;
  weight: number;
};

export type ReferralSurpriseSetting = {
  label: string;
  weight: number;
};

export type DeliveryFeeBand = {
  max_fee: number | null;
  min_minutes: number;
  max_minutes: number;
};

export type OrderSettings = {
  open_days: number[];
  opening_time: string;
  closing_time: string;
  slot_capacity: number;
  prep_minutes: number;
  delivery_buffer_minutes: number;
  delivery_enabled: boolean;
  delivery_fee_bands: DeliveryFeeBand[];
  tomorrow_cutoff: string;
};

export const DEFAULT_ORDER_SETTINGS: OrderSettings = {
  open_days: [1, 2, 3, 4, 5, 6],
  opening_time: "09:00",
  closing_time: "18:00",
  slot_capacity: 3,
  prep_minutes: 30,
  delivery_buffer_minutes: 20,
  delivery_enabled: true,
  delivery_fee_bands: [
    { max_fee: 500, min_minutes: 15, max_minutes: 20 },
    { max_fee: 1000, min_minutes: 30, max_minutes: 40 },
    { max_fee: 1500, min_minutes: 45, max_minutes: 60 },
    { max_fee: 2000, min_minutes: 60, max_minutes: 75 },
    { max_fee: 2500, min_minutes: 75, max_minutes: 90 },
  ],
  tomorrow_cutoff: "18:00",
};

export type AppSettings = {
  id: number;
  loyalty_threshold: number;
  loyalty_reward: string;
  wheel_prizes: WheelSetting[];
  referral_surprises: ReferralSurpriseSetting[];
  order_settings: OrderSettings;
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

  if (!data) return null;

  return {
    ...data,
    order_settings: {
      ...DEFAULT_ORDER_SETTINGS,
      ...(data.order_settings ?? {}),
    },
  } as AppSettings;
}

export async function updateAppSettings(values: {
  loyalty_threshold: number;
  loyalty_reward: string;
  wheel_prizes: WheelSetting[];
  referral_surprises: ReferralSurpriseSetting[];
  order_settings: OrderSettings;
}): Promise<AppSettings | null> {

  console.log("[DEBUG] Jours envoyés :", values.order_settings.open_days);
console.log("[DEBUG] Paramètres envoyés :", values.order_settings);
  const { data, error } = await adminSupabase
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

  return {
    ...data,
    order_settings: {
      ...DEFAULT_ORDER_SETTINGS,
      ...(data.order_settings ?? {}),
    },
  } as AppSettings;
}
