import { supabase } from "./supabase";
import { adminSupabase } from "./admin-supabase";
import { driverSupabase } from "./driver-supabase";

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
  } = await adminSupabase.auth.getUser();

  if (userError || !user) {
    throw new Error(
      "Utilisateur administrateur non connecté."
    );
  }

  const {
    data: existingSubscription,
    error: findError,
  } = await adminSupabase
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
      if (existingSubscription.user_id !== user.id) {
        throw new Error(
          "Cet appareil possède déjà un abonnement Push associé à un autre profil."
        );
      }

      const { data: updatedSubscription, error: updateError } =
        await adminSupabase
          .from("push_subscriptions")
          .update(subscriptionData)
          .eq("id", existingSubscription.id)
          .eq("user_id", user.id)
          .select("id")
          .maybeSingle();

      if (updateError) {
        console.error(
          "Erreur mise à jour abonnement Push :",
          updateError
        );

        throw updateError;
      }

      if (!updatedSubscription) {
        throw new Error(
          "La mise à jour de l'abonnement Push administrateur n'a pas été effectuée."
        );
      }
    } else {
      const { error: insertError } =
        await adminSupabase
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
    } = await adminSupabase.auth.getUser();

    if (!user) {
      return "disabled";
    }

    const { data, error } =
      await adminSupabase
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

  if (!/^[0-9]{8}$/.test(phone)) {
    throw new Error(
      "Numéro de téléphone invalide."
    );
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error(
      "Tu dois être connecté à ton compte client pour activer les notifications."
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
 * Vérifie le statut Push du client connecté.
 */
export async function getCustomerPushStatus(
  phone: string
): Promise<"enabled" | "disabled" | "blocked"> {
  if (!/^[0-9]{8}$/.test(phone)) {
    return "disabled";
  }

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
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return "disabled";
    }

    const registration = await navigator.serviceWorker.ready;

    const subscription =
      await registration.pushManager.getSubscription();

    if (!subscription) {
      return "disabled";
    }

    const { data, error } = await supabase.rpc(
      "get_customer_push_status",
      {
        p_phone: phone,
        p_endpoint: subscription.endpoint,
      }
    );

    if (error) {
      console.error(
        "Erreur vérification abonnement Push client :",
        error
      );

      return "disabled";
    }

    return data === true ? "enabled" : "disabled";
  } catch (error) {
    console.error(
      "Erreur statut Push client :",
      error
    );

    return "disabled";
  }
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

/**
 * Enregistre l'abonnement Push du livreur connecté.
 */
export async function registerDriverPushSubscription() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    throw new Error("Les notifications Push ne sont pas supportées par ce navigateur.");
  }

  if (!VAPID_PUBLIC_KEY) {
    throw new Error("VITE_VAPID_PUBLIC_KEY est manquante.");
  }

  const {
    data: { user },
    error: userError,
  } = await driverSupabase.auth.getUser();

  if (userError || !user) {
    throw new Error("Livreur non connecté.");
  }

  const { data: isDriver, error: driverError } =
    await driverSupabase.rpc("is_delivery_driver");

  if (driverError || !isDriver) {
    throw new Error("Ce compte n'est pas autorisé à accéder à l'espace livreur.");
  }

  const permission = await Notification.requestPermission();

  if (permission !== "granted") {
    throw new Error("L'autorisation des notifications a été refusée.");
  }

  const registration = await navigator.serviceWorker.ready;

  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  const subscriptionJson = subscription.toJSON();

  if (
    !subscriptionJson.endpoint ||
    !subscriptionJson.keys?.p256dh ||
    !subscriptionJson.keys?.auth
  ) {
    throw new Error("Abonnement Push invalide.");
  }

  const { error } = await driverSupabase.rpc("register_driver_push", {
    p_endpoint: subscriptionJson.endpoint,
    p_p256dh: subscriptionJson.keys.p256dh,
    p_auth: subscriptionJson.keys.auth,
  });

  if (error) {
    console.error("Erreur d'enregistrement Push livreur :", error);
    throw error;
  }

  return subscription;
}

/**
 * Vérifie si le livreur connecté possède
 * un abonnement Push sur cet appareil.
 */
export async function getDriverPushStatus(): Promise<
  "enabled" | "disabled" | "blocked"
> {
  if (!("Notification" in window)) {
    return "disabled";
  }

  if (Notification.permission === "denied") {
    return "blocked";
  }

  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return "disabled";
  }

  try {
    const {
      data: { user },
      error: userError,
    } = await driverSupabase.auth.getUser();

    if (userError || !user) {
      return "disabled";
    }

    const registration = await navigator.serviceWorker.ready;

    const subscription =
      await registration.pushManager.getSubscription();

    if (!subscription) {
      return "disabled";
    }

    const { data, error } = await driverSupabase.rpc(
      "get_driver_push_status",
      {
        p_endpoint: subscription.endpoint,
      }
    );

    if (error) {
      console.error(
        "Erreur de vérification Push livreur :",
        error
      );

      return "disabled";
    }

    return data === true ? "enabled" : "disabled";
  } catch (error) {
    console.error(
      "Erreur statut Push livreur :",
      error
    );

    return "disabled";
  }
}


/**
 * Désinscrit l'abonnement Push du client connecté.
 */
export async function unregisterCustomerPushSubscription(
  phone: string
): Promise<void> {
  if (!/^[0-9]{8}$/.test(phone)) {
    throw new Error("Numéro de téléphone invalide.");
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("Connexion client requise.");
  }

  const registration = await navigator.serviceWorker.ready;
  const subscription =
    await registration.pushManager.getSubscription();

  if (!subscription) {
    return;
  }

  const { data, error } = await supabase.rpc(
    "unregister_customer_push",
    {
      p_phone: phone,
      p_endpoint: subscription.endpoint,
    }
  );

  if (error) throw error;

  if (data !== true) {
    throw new Error(
      "Désinscription refusée : abonnement non associé à ce profil client."
    );
  }

  const unsubscribed = await subscription.unsubscribe();

  if (!unsubscribed) {
    throw new Error(
      "L'abonnement a été retiré du serveur, mais le navigateur n'a pas confirmé sa désinscription."
    );
  }
}

/**
 * Désinscrit l'abonnement Push de l'administrateur connecté.
 */
export async function unregisterAdminPushSubscription(): Promise<void> {
  const {
    data: { user },
    error: userError,
  } = await adminSupabase.auth.getUser();

  if (userError || !user) {
    throw new Error("Connexion administrateur requise.");
  }

  const registration = await navigator.serviceWorker.ready;
  const subscription =
    await registration.pushManager.getSubscription();

  if (!subscription) return;

  const { data, error } = await adminSupabase.rpc(
    "unregister_admin_push",
    {
      p_endpoint: subscription.endpoint,
    }
  );

  if (error) throw error;

  if (data !== true) {
    throw new Error(
      "Désinscription refusée : abonnement non associé à cet administrateur."
    );
  }

  const unsubscribed = await subscription.unsubscribe();

  if (!unsubscribed) {
    throw new Error(
      "L'abonnement a été retiré du serveur, mais le navigateur n'a pas confirmé sa désinscription."
    );
  }
}

/**
 * Désinscrit l'abonnement Push du livreur connecté.
 */
export async function unregisterDriverPushSubscription(): Promise<void> {
  const {
    data: { user },
    error: userError,
  } = await driverSupabase.auth.getUser();

  if (userError || !user) {
    throw new Error("Connexion livreur requise.");
  }

  const registration = await navigator.serviceWorker.ready;
  const subscription =
    await registration.pushManager.getSubscription();

  if (!subscription) return;

  const { data, error } = await driverSupabase.rpc(
    "unregister_driver_push",
    {
      p_endpoint: subscription.endpoint,
    }
  );

  if (error) throw error;

  if (data !== true) {
    throw new Error(
      "Désinscription refusée : abonnement non associé à ce livreur."
    );
  }

  const unsubscribed = await subscription.unsubscribe();

  if (!unsubscribed) {
    throw new Error(
      "L'abonnement a été retiré du serveur, mais le navigateur n'a pas confirmé sa désinscription."
    );
  }
}
