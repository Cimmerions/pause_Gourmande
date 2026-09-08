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

  const { error } = await supabase
    .from("push_subscriptions")
    .upsert(
      {
        user_id: user.id,
        endpoint: subscriptionJson.endpoint,
        p256dh:
          subscriptionJson.keys.p256dh,
        auth:
          subscriptionJson.keys.auth,
        updated_at:
          new Date().toISOString(),
      },
      {
        onConflict: "endpoint",
      }
    );

  if (error) {
    console.error(
      "Erreur enregistrement abonnement Push :",
      error
    );

    throw error;
  }

  return subscription;
}