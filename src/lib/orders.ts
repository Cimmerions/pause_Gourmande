import { supabase } from "./supabase";
import { adminSupabase } from "./admin-supabase";
import type { Order } from "./cart-store";

export async function createOrder(
  order: Order,
  referralCode?: string,
  rewardId?: number
) {
  try {
    const { data, error } = await supabase.rpc(
      "create_order_secure_with_referral",
      {
        p_customer_name: order.customerName,
        p_phone: order.phone,
        p_mode: order.mode,
        p_time: order.time,
        p_lines: order.lines.map((item) => ({
          productId: item.productId,
          qty: item.qty,
          note: item.note ?? null,
          addons: item.addons ?? [],
        })),
        p_reward_id: rewardId ?? null,
        p_reception_mode: order.receptionMode ?? "pickup",
        p_delivery_latitude:
          order.receptionMode === "delivery"
            ? order.deliveryLatitude ?? null
            : null,
        p_delivery_longitude:
          order.receptionMode === "delivery"
            ? order.deliveryLongitude ?? null
            : null,
        p_referral_code: referralCode?.trim().toUpperCase() || null,
      }
    );

    if (error) {
      console.error(
        "Erreur création commande sécurisée :",
        error
      );
      return null;
    }

    if (
      !data ||
      typeof data !== "object" ||
      !("order" in data) ||
      !data.order
    ) {
      console.error(
        "Réponse inattendue du serveur lors de la création de la commande :",
        data
      );
      return null;
    }

    return {
      data: data.order,
      acceptedReferralCode:
        typeof data.acceptedReferralCode === "string"
          ? data.acceptedReferralCode
          : null,
    };
  } catch (error) {
    console.error(
      "Erreur inattendue création commande :",
      error
    );
    return null;
  }
}

export async function getOrders() {
    const { data, error } = await adminSupabase
      .from("orders")
      .select(`
        *,
        order_items (*)
      `)
      .order("created_at", { ascending: false });
  
    if (error) {
      console.error(error);
      return [];
    }
  
    return data;
  }

  
export async function getCustomerOrders() {
  const { data, error } = await supabase.rpc(
    "get_my_orders_with_items_v2"
  );

  if (error) {
    console.error(
      "Erreur récupération commandes client :",
      error
    );
  }

  return {
    data,
    error,
  };
}

  export async function updateOrderStatus(
    id: string,
    status: string
  ) {

    // Confirmation d'une commande de retrait
    if (status === "preparing") {
      const { data, error } = await adminSupabase.rpc(
        "confirm_order",
        {
          order_id: id,
        }
      );

      if (error) {
        console.error("Erreur confirmation commande :", error);

        return {
          data: null,
          error,
        };
      }

      return {
        data,
        error: null,
      };
    }

    // Validation d'une commande
    if (status === "done") {
      const { data, error } = await adminSupabase.rpc(
        "complete_order",
        {
          order_id: id,
        }
      );
  
      if (error) {
        console.error(
          "Erreur validation commande :",
          error
        );
  
        return {
          data: null,
          error,
        };
      }
  
      return {
        data,
        error: null,
      };
    }
  
    // Annulation d'une commande
    if (status === "cancelled") {
      const { data, error } = await adminSupabase.rpc(
        "cancel_order",
        {
          order_id: id,
        }
      );
  
      if (error) {
        console.error(
          "Erreur annulation commande :",
          error
        );
  
        return {
          data: null,
          error,
        };
      }
  
      return {
        data,
        error: null,
      };
    }
  
    // Les autres statuts ne sont pas autorisés
    return {
      data: null,
      error: new Error(
        `Statut non autorisé : ${status}`
      ),
    };
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

  export async function proposeDeliveryFee(
    orderId: string,
    deliveryFee: number
  ) {
    if (!Number.isInteger(deliveryFee) || deliveryFee < 0) {
      return {
        data: null,
        error: new Error("Frais de livraison invalides."),
      };
    }
  
    const { data, error } = await adminSupabase.rpc(
      "propose_delivery_fee",
      {
        p_order_id: orderId,
        p_delivery_fee: deliveryFee,
      }
    );
  
    if (error) {
      console.error(
        "Erreur proposition frais de livraison :",
        error
      );
    }
  
    return {
      data,
      error,
    };
  }

  export async function acceptDelivery(orderId: string) {
    const { data, error } = await supabase.rpc(
      "accept_delivery",
      {
        p_order_id: orderId,
      }
    );
  
    if (error) {
      console.error(
        "Erreur acceptation livraison :",
        error
      );
    }
  
    return {
      data,
      error,
    };
  }
  
  export async function refuseDelivery(orderId: string) {
    const { data, error } = await supabase.rpc(
      "refuse_delivery",
      {
        p_order_id: orderId,
      }
    );
  
    if (error) {
      console.error(
        "Erreur refus livraison :",
        error
      );
    }
  
    return {
      data,
      error,
    };
  }


import { driverSupabase } from "./driver-supabase";

export async function getDriverOrders() {
  const { data, error } = await driverSupabase.rpc("get_driver_orders");

  if (error) {
    console.error("Erreur récupération des livraisons :", error);
    return { data: null, error };
  }

  return { data, error: null };
}

export async function startDriverDelivery(orderId: string) {
  const { data, error } = await driverSupabase.rpc("start_delivery", {
    order_id: orderId,
  });

  if (error) {
    console.error("Erreur démarrage livraison :", error);
  }

  return { data, error };
}

export async function completeDriverDelivery(orderId: string) {
  const { data, error } = await driverSupabase.rpc("complete_delivery", {
    order_id: orderId,
  });

  if (error) {
    console.error("Erreur confirmation livraison :", error);
  }

  return { data, error };
}

export type ActiveDeliveryDriver = {
  user_id: string;
  display_name: string;
};

export async function getActiveDeliveryDrivers(): Promise<ActiveDeliveryDriver[]> {
  const { data, error } = await adminSupabase
    .from("delivery_drivers")
    .select("user_id, display_name")
    .eq("active", true)
    .eq("is_available", true)
    .order("display_name");

  if (error) {
    console.error("Erreur chargement des livreurs disponibles :", error);
    throw error;
  }

  return data ?? [];
}

export async function assignDeliveryDriver(
  orderId: string,
  driverUserId: string | null
): Promise<void> {
  const { error } = await adminSupabase.rpc(
    "assign_delivery_driver",
    {
      p_order_id: orderId,
      p_driver_user_id: driverUserId,
    }
  );

  if (error) {
    throw error;
  }
}

export async function markDeliveryReady(orderId: string) {
  const { data, error } = await adminSupabase.rpc(
    "mark_delivery_ready",
    { p_order_id: orderId }
  );

  if (error) {
    console.error("Erreur préparation livraison :", error);
  }

  return { data, error };
}