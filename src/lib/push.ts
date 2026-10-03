import { supabase } from "./supabase";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat(
    (4 - (base64String.length % 4)) % 4
  );

  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);

  return Uint8Array.from(
    [...rawData].map((char) => char.charCodeAt(0))
  );
}

/**
 * Enregistre l'abonnement Push de l'administrateur.
 */
export async function registerPushSubscription() {
  if (!("serviceWorker" in navigator)) {
  
    throw new Error(
      "Les Service Workers ne sont pas supportés par ce navigateur."
    );
  }

  if (!("PushManager" in window)) {
    throw new Error(
      "Les notifications Push ne sont pas supportées par ce navigateur."
    );
  }

  if (!VAPID_PUBLIC_KEY) {
    throw new Error(
      "VITE_VAPID_PUBLIC_KEY est manquante."
    );
  }

  const permission =
    await Notification.requestPermission();

  if (permission !== "granted") {
    throw new Error(
      "L'autorisation des notifications a été refusée."
    );
  }

  const registration =
    await navigator.serviceWorker.ready;

  let subscription =
    await registration.pushManager.getSubscription();

  if (!subscription) {
    subscription =
      await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey:
          urlBase64ToUint8Array(
            VAPID_PUBLIC_KEY
          ),
      });
  }

  const subscriptionJson =
    subscription.toJSON();

  if (
    !subscriptionJson.endpoint ||
    !subscriptionJson.keys?.p256dh ||
    !subscriptionJson.keys?.auth
  ) {
    throw new Error(
      "Abonnement Push invalide."
    );
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error(
      "Utilisateur administrateur non connecté."
    );
  }

  const {
    data: existingSubscription,
    error: findError,
  } = await supabase
    .from("push_subscriptions")
    .select("id, user_id")
    .eq("endpoint", subscriptionJson.endpoint)
    .maybeSingle();

  if (findError) {
    console.error(
      "Erreur recherche abonnement Push :",
      findError
    );

    throw findError;
  }

  const subscriptionData = {
    user_id: user.id,
    endpoint: subscriptionJson.endpoint,
    p256dh: subscriptionJson.keys.p256dh,
    auth: subscriptionJson.keys.auth,
    updated_at: new Date().toISOString(),
  };

  if (existingSubscription) {
    const { error: updateError } =
      await supabase
        .from("push_subscriptions")
        .update(subscriptionData)
        .eq("id", existingSubscription.id)
        .eq("user_id", user.id);

    if (updateError) {
      console.error(
        "Erreur mise à jour abonnement Push :",
        updateError
      );

      throw updateError;
    }
  } else {
    const { error: insertError } =
      await supabase
        .from("push_subscriptions")
        .insert(subscriptionData);

    if (insertError) {
      console.error(
        "Erreur création abonnement Push :",
        insertError
      );

      throw insertError;
    }
  }

  return subscription;
}

/**
 * Vérifie le statut Push de l'administrateur.
 */
export async function getAdminPushStatus(): Promise<
  "enabled" | "disabled" | "blocked"
> {
  if (!("Notification" in window)) {
    return "disabled";
  }

  if (Notification.permission === "denied") {
    return "blocked";
  }

  if (!("serviceWorker" in navigator)) {
    return "disabled";
  }

  try {
    const registration =
      await navigator.serviceWorker.ready;

    const subscription =
      await registration.pushManager.getSubscription();

    if (!subscription) {
      return "disabled";
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return "disabled";
    }

    const { data, error } =
      await supabase
        .from("push_subscriptions")
        .select("id")
        .eq("endpoint", subscription.endpoint)
        .eq("user_id", user.id)
        .maybeSingle();

    if (error) {
      console.error(
        "Erreur vérification Push admin :",
        error
      );

      return "disabled";
    }

    return data ? "enabled" : "disabled";
  } catch (error) {
    console.error(
      "Erreur statut Push admin :",
      error
    );

    return "disabled";
  }
}

/**
 * Enregistre l'abonnement Push d'un client.
 */
export async function registerCustomerPushSubscription(
  phone: string
) {
  if (!("serviceWorker" in navigator)) {
    throw new Error(
      "Les Service Workers ne sont pas supportés par ce navigateur."
    );
  }

  if (!("PushManager" in window)) {
    throw new Error(
      "Les notifications Push ne sont pas supportées par ce navigateur."
    );
  }

  if (!VAPID_PUBLIC_KEY) {
    throw new Error(
      "VITE_VAPID_PUBLIC_KEY est manquante."
    );
  }

  if (phone.length !== 8) {
    throw new Error(
      "Numéro de téléphone invalide."
    );
  }

  const permission =
    await Notification.requestPermission();

  if (permission !== "granted") {
    throw new Error(
      "L'autorisation des notifications a été refusée."
    );
  }

  const registration =
    await navigator.serviceWorker.ready;

  let subscription =
    await registration.pushManager.getSubscription();

  if (!subscription) {
    subscription =
      await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey:
          urlBase64ToUint8Array(
            VAPID_PUBLIC_KEY
          ),
      });
  }

  const subscriptionJson =
    subscription.toJSON();

  if (
    !subscriptionJson.endpoint ||
    !subscriptionJson.keys?.p256dh ||
    !subscriptionJson.keys?.auth
  ) {
    throw new Error(
      "Abonnement Push invalide."
    );
  }

  const { error } =
    await supabase.rpc(
      "register_customer_push",
      {
        p_phone: phone,
        p_endpoint: subscriptionJson.endpoint,
        p_p256dh: subscriptionJson.keys.p256dh,
        p_auth: subscriptionJson.keys.auth,
      }
    );

  if (error) {
    console.error(
      "Erreur enregistrement Push client :",
      error
    );

    throw error;
  }
}

/**
 * Vérifie le statut Push d'un client.
 */
export async function getCustomerPushStatus(
  phone: string
): Promise<"enabled" | "disabled" | "blocked"> {
  if (phone.length !== 8) {
    return "disabled";
  }

  if (!("Notification" in window)) {
    return "disabled";
  }

  if (Notification.permission === "denied") {
    return "blocked";
  }

  const { data, error } = await supabase.rpc(
    "get_customer_push_status",
    {
      p_phone: phone,
    }
  );

  console.log("🔎 STATUT PUSH CLIENT :", {
    phone,
    data,
    error,
  });

  if (error) {
    console.error(
      "Erreur vérification abonnement Push client :",
      error
    );

    return "disabled";
  }

  return data ? "enabled" : "disabled";
}

export function isIOSDevice(): boolean {
  return /iPhone|iPad|iPod/i.test(
    navigator.userAgent
  );
}

export function isPWAInstalled(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & {
      standalone?: boolean;
    }).standalone === true
  );
}

export function needsIOSHomeScreenInstall(): boolean {
  const forceIOS =
    new URLSearchParams(window.location.search).has("test-ios");

  return (isIOSDevice() || forceIOS) && !isPWAInstalled();
}