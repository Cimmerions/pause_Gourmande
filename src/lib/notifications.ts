import { supabase } from "./supabase";

export type NotificationType =
  | "new_order"
  | "order_cancelled"
  | "referral_reward"
  | "loyalty_reward";

export type Notification = {
  id: number;
  type: NotificationType;
  title: string;
  message: string;
  order_id: string | null;
  customer_phone: string | null;
  read: boolean;
  created_at: string;
};

/**
 * Crée une nouvelle notification
 */
export async function createNotification({
  type,
  title,
  message,
  order_id = null,
  customer_phone = null,
}: {
  type: NotificationType;
  title: string;
  message: string;
  order_id?: string | null;
  customer_phone?: string | null;
}) {
  const { data, error } = await supabase
    .from("notifications")
    .insert({
      type,
      title,
      message,
      order_id,
      customer_phone,
    })
    .select()
    .single();

  if (error) {
    console.error(
      "Erreur création notification :",
      error
    );

    return null;
  }

  return data as Notification;
}

/**
 * Récupère les notifications les plus récentes
 */
export async function getNotifications(limit = 30) {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", {
      ascending: false,
    })
    .limit(limit);

  if (error) {
    console.error(
      "Erreur récupération notifications :",
      error
    );

    return [];
  }

  return data as Notification[];
}

/**
 * Compte les notifications non lues
 */
export async function getUnreadNotificationCount() {
  const { count, error } = await supabase
    .from("notifications")
    .select("*", {
      count: "exact",
      head: true,
    })
    .eq("read", false);

  if (error) {
    console.error(
      "Erreur compteur notifications :",
      error
    );

    return 0;
  }

  return count ?? 0;
}

/**
 * Marque une notification comme lue
 */
export async function markNotificationAsRead(
  id: number
) {
  const { error } = await supabase
    .from("notifications")
    .update({
      read: true,
    })
    .eq("id", id);

  if (error) {
    console.error(
      "Erreur lecture notification :",
      error
    );

    return false;
  }

  return true;
}

/**
 * Marque toutes les notifications comme lues
 */
export async function markAllNotificationsAsRead() {
  const { error } = await supabase
    .from("notifications")
    .update({
      read: true,
    })
    .eq("read", false);

  if (error) {
    console.error(
      "Erreur lecture notifications :",
      error
    );

    return false;
  }

  return true;
}

export function subscribeToNotifications(
    onNotification: (notification: Notification) => void
  ) {
    const channel = supabase
      .channel("notifications-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
        },
        (payload) => {
          onNotification(payload.new as Notification);
        }
      )
      .subscribe();
  
    return () => {
      supabase.removeChannel(channel);
    };
  }