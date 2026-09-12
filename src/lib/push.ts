import { supabase } from "./supabase";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat(
    (4 - (base64String.length % 4)) % 4
  );

  const base64 = (
    base64String +
    padding
  )
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);

  return Uint8Array.from(
    [...rawData].map((char) => char.charCodeAt(0))
  );
}

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

  console.log("👤 ADMIN USER ID ACTUEL :", user.id);

  const { data: existingSubscription, error: findError } =
  await supabase
    .from("push_subscriptions")
    .select("id, user_id")
    .eq("endpoint", subscriptionJson.endpoint)
    .maybeSingle();

    console.log("🔎 ABONNEMENT ADMIN EXISTANT :", {
      found: !!existingSubscription,
      id: existingSubscription?.id,
      user_id: existingSubscription?.user_id,
      error: findError,
    });

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
  const { error: updateError } = await supabase
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

  console.log("🟢 ABONNEMENT ADMIN MIS À JOUR");
} else {
  const { error: insertError } = await supabase
    .from("push_subscriptions")
    .insert(subscriptionData);

  if (insertError) {
    console.error(
      "Erreur création abonnement Push :",
      insertError
    );

    throw insertError;
  }

  console.log("🟢 NOUVEL ABONNEMENT ADMIN CRÉÉ");
}

  return subscription;
}

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
    const registration = await navigator.serviceWorker.ready;

    const subscription =
      await registration.pushManager.getSubscription();

    if (!subscription) {
      return "disabled";
    }

    const { data, error } = await supabase
      .from("push_subscriptions")
      .select("id")
      .eq("endpoint", subscription.endpoint)
      .eq("user_id", (await supabase.auth.getUser()).data.user?.id)
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

export async function registerCustomerPushSubscription(
  phone: string,
) {

  console.log("🔵 REGISTER CLIENT PUSH DÉBUT", phone);

  console.log("🔵 serviceWorker =", "serviceWorker" in navigator);
  console.log("🔵 PushManager =", "PushManager" in window);
  console.log("🔵 VAPID =", !!VAPID_PUBLIC_KEY);
  console.log("🔵 phone length =", phone.length);
  
  if (!("serviceWorker" in navigator)) {
    throw new Error(
      "Les Service Workers ne sont pas supportés par ce navigateur.",
    );
  }

  if (!("PushManager" in window)) {
    throw new Error(
      "Les notifications Push ne sont pas supportées par ce navigateur.",
    );
  }

  if (!VAPID_PUBLIC_KEY) {
    throw new Error(
      "VITE_VAPID_PUBLIC_KEY est manquante.",
    );
  }

  if (phone.length !== 8) {
    throw new Error(
      "Numéro de téléphone invalide.",
    );
  }

  console.log("🟡 AVANT DEMANDE PERMISSION");

  const permission =
    await Notification.requestPermission();

  console.log("🟢 PERMISSION =", permission);

  if (permission !== "granted") {
    throw new Error(
      "L'autorisation des notifications a été refusée.",
    );
  }

  console.log("🔵 AVANT SERVICE WORKER");

  console.log(
    "🔵 CONTROLLER =",
    navigator.serviceWorker.controller
  );

  const registrations =
    await navigator.serviceWorker.getRegistrations();

  console.log(
    "🔵 SERVICE WORKERS TROUVÉS =",
    registrations.length
  );

  registrations.forEach((reg, index) => {
    console.log(
      `🔵 SW ${index} :`,
      reg.scope,
      reg.active?.state,
      reg.active?.scriptURL
    );
  });

  const registration =
    await navigator.serviceWorker.ready;

  console.log("🟢 SERVICE WORKER PRÊT", registration);
    console.log("🔵 AVANT GET SUBSCRIPTION");

  let subscription =
    await registration.pushManager.getSubscription();

  console.log("🟢 SUBSCRIPTION EXISTANTE", !!subscription);

  if (!subscription) {
    subscription =
      await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey:
          urlBase64ToUint8Array(
            VAPID_PUBLIC_KEY,
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
      "Abonnement Push invalide.",
    );
  }

  console.log("PUSH CLIENT DATA :", {
    customer_phone: phone,
    endpoint: subscriptionJson.endpoint,
    p256dh: subscriptionJson.keys.p256dh,
    auth: subscriptionJson.keys.auth,
  });

  const { data: existingSubscription, error: findError } = await supabase
  .from("push_subscriptions")
  .select("id")
  .eq("endpoint", subscriptionJson.endpoint)
  .maybeSingle();

if (findError) {
  console.error("Erreur recherche abonnement Push :", findError);
  throw findError;
}

const subscriptionData = {
  customer_phone: phone,
  endpoint: subscriptionJson.endpoint,
  p256dh: subscriptionJson.keys.p256dh,
  auth: subscriptionJson.keys.auth,
  updated_at: new Date().toISOString(),
};

if (existingSubscription) {
  const { error: updateError } = await supabase
    .from("push_subscriptions")
    .update(subscriptionData)
    .eq("id", existingSubscription.id);

  if (updateError) {
    console.error("Erreur mise à jour Push client :", updateError);
    throw updateError;
  }

  console.log("🟢 ABONNEMENT PUSH MIS À JOUR");
} else {
  const { error: insertError } = await supabase
    .from("push_subscriptions")
    .insert(subscriptionData);

  if (insertError) {
    console.error("Erreur insertion Push client :", insertError);
    throw insertError;
  }

  console.log("🟢 NOUVEL ABONNEMENT PUSH CRÉÉ");
}
}

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

  if (!("serviceWorker" in navigator)) {
    return "disabled";
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      return "disabled";
    }

    const endpoint = subscription.endpoint;

    const { data, error } = await supabase
      .from("push_subscriptions")
      .select("id")
      .eq("endpoint", endpoint)
      .eq("customer_phone", phone)
      .maybeSingle();

    if (error) {
      console.error(
        "Erreur vérification abonnement Push :",
        error
      );
      return "disabled";
    }

    return data ? "enabled" : "disabled";
  } catch (error) {
    console.error(
      "Erreur vérification statut Push client :",
      error
    );

    return "disabled";
  }
}