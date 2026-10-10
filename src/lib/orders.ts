import { supabase } from "./supabase";
import type { Order } from "./cart-store";

import {
  findCustomer,
  createCustomer,
  findCustomerByReferralCode,
} from "./customers";

import {
  saveReward,
  pickReferralSurprise,
} from "./rewards";


export async function createOrder(
  order: Order,
  referralCode?: string,
  rewardId?: number
) {
  try {
    const { data, error } = await supabase.rpc(
      "create_order_secure",
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
      }
    );

    if (error) {
      console.error(
        "Erreur création commande sécurisée :",
        error
      );
      return null;
    }

    let acceptedReferralCode: string | null = null;

    let customer = await findCustomer(order.phone);

    if (!customer) {
      let referredBy: number | undefined = undefined;
      let referrer = null;

      if (referralCode?.trim()) {
        referrer = await findCustomerByReferralCode(
          referralCode.trim().toUpperCase()
        );

        if (
          referrer &&
          referrer.phone !== order.phone
        ) {
          referredBy = referrer.id;
          acceptedReferralCode =
            referralCode.trim().toUpperCase();
        } else {
          referrer = null;
        }
      }

      customer = await createCustomer(
        order.customerName,
        order.phone,
        referredBy
      );

      if (customer && referrer) {
        const surprise = await pickReferralSurprise();

        if (!surprise) {
          console.error(
            "Impossible d'attribuer la surprise de parrainage."
          );
        } else {
          await saveReward(
            referrer.phone,
            surprise,
            "referral"
          );

          console.log("PARRAINAGE VALIDÉ :", {
            parrain: referrer.phone,
            filleul: customer.phone,
            surprise,
          });
        }
      }
    }

    return {
      data,
      acceptedReferralCode,
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
    const { data, error } = await supabase
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
    "get_my_orders_with_items"
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
    // Validation d'une commande
    if (status === "done") {
      const { data, error } = await supabase.rpc(
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
      const { data, error } = await supabase.rpc(
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
  
    const { data, error } = await supabase.rpc(
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