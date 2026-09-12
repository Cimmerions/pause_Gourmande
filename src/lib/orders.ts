import { supabase } from "./supabase";
import type { Order } from "./cart-store";

import {
  findCustomer,
  createCustomer,
  updateCustomerPoints,
  findCustomerByReferralCode,
} from "./customers";

import {
  saveReward,
  hasActiveLoyaltyReward,
  pickReferralSurprise,
} from "./rewards";

import {
  capLoyaltyPoints,
  getLoyaltySettings,
} from "./loyalty";


export async function createOrder(
  order: Order,
  referralCode?: string
) {
  try {
    const loyaltySettings = await getLoyaltySettings();

    let acceptedReferralCode: string | null = null;

    const { data, error } = await supabase
      .from("orders")
      .insert({
        customer_name: order.customerName,
        phone: order.phone,
        mode: order.mode,
        time: order.time,
        total: order.total,
        status: order.status,
      })
      .select()
      .single();

    if (error) {
      console.error("Erreur création commande :", error);
      return null;
    }

    const items = order.lines.map((item) => ({
      order_id: data.id,
      product_id: item.productId,
      name: item.name,
      quantity: item.qty,
      price: item.price,
      note: item.note ?? null,
    }));

    const { error: itemError } = await supabase
      .from("order_items")
      .insert(items);

    if (itemError) {
      console.error("Erreur lignes commande :", itemError);
      return null;
    }

    // Recherche du client
    let customer = await findCustomer(order.phone);

    // Création du compte si nécessaire
    if (!customer) {
      let referredBy: number | undefined = undefined;
      let referrer = null;

      if (referralCode?.trim()) {
        referrer = await findCustomerByReferralCode(
          referralCode.trim().toUpperCase()
        );

        if (referrer && referrer.phone !== order.phone) {
          referredBy = referrer.id;
          acceptedReferralCode = referralCode.trim().toUpperCase();
        } else {
          referrer = null;
        }
      }

      customer = await createCustomer(
        order.customerName,
        order.phone,
        referredBy
      );

      // Récompense de parrainage
      // Seul le parrain reçoit une surprise.
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

    // Fidélité
    if (customer) {
      const earnedPoints = order.pointsEarned;
      const currentPoints = customer.points ?? 0;

      const newBalance = capLoyaltyPoints(
        currentPoints,
        earnedPoints,
        loyaltySettings.threshold
      );

      await updateCustomerPoints(
        customer.id,
        newBalance
      );

      console.log("🎯 TEST LOYALTY :", {
        currentPoints,
        earnedPoints,
        threshold: loyaltySettings.threshold,
        newBalance,
      });

      // Débloque une récompense lorsque le seuil est atteint
      if (
        currentPoints < loyaltySettings.threshold &&
        newBalance === loyaltySettings.threshold
      ) {
        console.log("🎁 SEUIL ATTEINT — création récompense");
      
        const alreadyHasReward =
          await hasActiveLoyaltyReward(customer.phone);
      
        console.log(
          "🎁 RÉCOMPENSE EXISTANTE :",
          alreadyHasReward
        );
      
        if (!alreadyHasReward) {
          await saveReward(
            customer.phone,
            loyaltySettings.reward,
            "loyalty"
          );
      
          console.log(
            "🎁 RÉCOMPENSE CRÉÉE :",
            loyaltySettings.reward
          );
        }
      }
    }

    return {
      data,
      acceptedReferralCode,
    };

  } catch (error) {
    console.error("Erreur inattendue :", error);
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

  export async function updateOrderStatus(
    id: string,
    status: string
  ) {
  
    // récupérer la commande
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("*")
      .eq("id", id)
      .single();
  
  
    if (orderError || !order) {
      console.error("Commande introuvable :", orderError);
      return null;
    }
  
  
    // Si on annule une commande
    if (status === "cancelled" && order.status !== "cancelled") {
  
      const customer = await findCustomer(order.phone);

      console.log("CLIENT ANNULATION :", customer);
      
      
      if (customer) {
      
        const earnedPoints = Math.floor(order.total / 100);
      
        const newPoints = Math.max(
          0,
          (customer.points ?? 0) - earnedPoints
        );
      
      
        await updateCustomerPoints(
          customer.id,
          newPoints
        );
      
      
        console.log(
          "POINTS RETIRES :",
          earnedPoints
        );
      
        console.log(
          "NOUVEAU SOLDE :",
          newPoints
        );
      
      }
    }
  
  
    // mise à jour du statut
    const { data, error } = await supabase
      .from("orders")
      .update({ status })
      .eq("id", id)
      .select()
      .single();

    return { data, error };
  }

  export async function deleteOrder(id: string) {

    // 1. Récupérer la commande avant suppression
    const { data: order, error } = await supabase
      .from("orders")
      .select("*")
      .eq("id", id)
      .single();
  
  
    if (error || !order) {
      console.error("Commande introuvable :", error);
      return null;
    }
  
  
    // 2. Trouver le client
    const customer = await findCustomer(order.phone);
  
  
    // 3. Retirer les pépites gagnées
    if (customer) {
  
      const earnedPoints = Math.floor(order.total / 100);
  
      const newPoints = Math.max(
        0,
        customer.points - earnedPoints
      );
  
  
      await updateCustomerPoints(
        customer.id,
        newPoints
      );
  
    }
  
  
    // 4. Supprimer la commande
    return await supabase
      .from("orders")
      .delete()
      .eq("id", id);
  
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