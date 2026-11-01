// @ts-ignore Deno resolves npm: specifiers at runtime; the editor's TypeScript resolver may not.
import webpush from "npm:web-push@3.6.7";
// @ts-ignore Deno resolves npm: specifiers at runtime; the editor's TypeScript resolver may not.
import { createClient } from "npm:@supabase/supabase-js@2";

const deno = (globalThis as typeof globalThis & { Deno: any }).Deno;

const VAPID_PUBLIC_KEY = deno.env.get("VAPID_PUBLIC_KEY");
const VAPID_PRIVATE_KEY = deno.env.get("VAPID_PRIVATE_KEY");
const VAPID_SUBJECT = deno.env.get("VAPID_SUBJECT");

const SUPABASE_URL = deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = deno.env.get(
  "SUPABASE_SERVICE_ROLE_KEY"
);

if (
  !VAPID_PUBLIC_KEY ||
  !VAPID_PRIVATE_KEY ||
  !VAPID_SUBJECT
) {
  throw new Error("Configuration VAPID incomplète.");
}

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    "Configuration Supabase serveur incomplète."
  );
}

webpush.setVapidDetails(
  VAPID_SUBJECT,
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY
);

deno.serve(async (req: Request) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response("ok", {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers":
            "authorization, x-client-info, apikey, content-type, x-webhook-key",
        },
      });
    }

    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Méthode non autorisée.",
        }),
        {
          status: 405,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    // ─────────────────────────────────────────────
    // AUTHENTIFICATION WEBHOOK
    // ─────────────────────────────────────────────

    const webhookKey = req.headers.get("X-Webhook-Key");
    const expectedWebhookKey =
      deno.env.get("PUSH_WEBHOOK_KEY");

    if (!expectedWebhookKey) {
      console.error(
        "PUSH_WEBHOOK_KEY non configurée."
      );

      return new Response(
        JSON.stringify({
          success: false,
          error: "Configuration serveur incomplète.",
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    if (
      !webhookKey ||
      webhookKey !== expectedWebhookKey
    ) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Non autorisé.",
        }),
        {
          status: 401,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    // ─────────────────────────────────────────────
    // DONNÉES DE LA NOTIFICATION
    // ─────────────────────────────────────────────

    const body: unknown = await req.json();

if (
  typeof body !== "object" ||
  body === null ||
  Array.isArray(body)
) {
  return new Response(
    JSON.stringify({
      success: false,
      error: "Corps JSON invalide.",
    }),
    {
      status: 400,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    }
  );
}

const notification = body as Record<string, unknown>;

    const title =
      typeof notification.title === "string" &&
      notification.title.trim()
        ? notification.title.trim()
        : "Pause Gourmande";

    const message =
      typeof notification.body === "string" &&
      notification.body.trim()
        ? notification.body.trim()
        : "Nouvelle notification";

    const url =
      typeof notification.url === "string"
        ? notification.url
        : "/";

    const allowedUrls = [
      "/",
      "/dashboard",
      "/orders-page",
      "/driver",
    ];

  if (!allowedUrls.includes(url)) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "URL de notification non autorisée.",
      }),
      {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }

    const tag =
      typeof notification.tag === "string" &&
      notification.tag.trim()
        ? notification.tag.trim()
        : "pause-gourmande-notification";

    const target =
      typeof notification.target === "string"
        ? notification.target
        : null;

    const customerPhone =
      notification.customer_phone ?? null;

    const driverUserId =
      notification.driver_user_id ?? null;

    console.log("📨 Notification Push :", { target });

    // ─────────────────────────────────────────────
    // VALIDATION DE LA CIBLE
    // ─────────────────────────────────────────────

    if (
      !target ||
      !["admin", "client", "driver"].includes(target)
    ) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Destinataire invalide ou manquant.",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    if (
      target === "client" &&
      (
        typeof customerPhone !== "string" ||
        !/^[0-9]{8}$/.test(customerPhone)
      )
    ) {
      return new Response(
        JSON.stringify({
          success: false,
          error:
            "customer_phone est requis et doit contenir exactement 8 chiffres.",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    if (
  target === "driver" &&
  (
    typeof driverUserId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(driverUserId)
  )
) {
  return new Response(
    JSON.stringify({
      success: false,
      error: "driver_user_id est requis et doit être un UUID valide.",
    }),
    {
      status: 400,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    }
  );
}

    // ─────────────────────────────────────────────
    // RÉCUPÉRATION DES ABONNEMENTS
    // ─────────────────────────────────────────────

    let query = supabase
      .from("push_subscriptions")
      .select(
        "id, endpoint, p256dh, auth, user_id, customer_phone"
      );

    if (target === "admin") {
  const { data: admins, error: adminsError } = await supabase
    .from("admin_users")
    .select("user_id");

  if (adminsError) {
    throw adminsError;
  }

  const adminIds = (admins ?? []).map((admin: { user_id: string }) => admin.user_id);

  if (adminIds.length === 0) {
    return new Response(
      JSON.stringify({
        success: true,
        message: "Aucun administrateur enregistré.",
        sent: 0,
        failed: 0,
        removed: 0,
        total: 0,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }

  query = query.in("user_id", adminIds);
}

    if (target === "client") {
      query = query
        .is("user_id", null)
        .eq(
          "customer_phone",
          customerPhone
        );
    }

   if (target === "driver") {
  // Vérifier que l'accès aux livreurs est globalement activé.
  const { data: driverConfig, error: configError } = await supabase
    .from("driver_access_config")
    .select("id, enabled")
    .eq("id", true)
    .eq("enabled", true)
    .maybeSingle();

  if (configError) {
    throw configError;
  }

  if (!driverConfig) {
    return new Response(
      JSON.stringify({
        success: true,
        message: "L'accès aux livreurs est désactivé.",
        sent: 0,
        failed: 0,
        removed: 0,
        total: 0,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }

  // Vérifier que le destinataire est un livreur actif.
  const { data: driver, error: lookupError } = await supabase
    .from("delivery_drivers")
    .select("user_id")
    .eq("user_id", driverUserId)
    .eq("active", true)
    .maybeSingle();

  if (lookupError) {
    throw lookupError;
  }

  if (!driver) {
    return new Response(
      JSON.stringify({
        success: true,
        message: "Aucun livreur actif correspondant.",
        sent: 0,
        failed: 0,
        removed: 0,
        total: 0,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }

  query = query
    .eq("user_id", driver.user_id)
    .is("customer_phone", null);
}

    const {
      data: subscriptions,
      error: subscriptionsError,
    } = await query;

    if (subscriptionsError) {
      console.error(
        "Erreur récupération abonnements :",
        subscriptionsError
      );

      throw subscriptionsError;
    }

    if (
      !subscriptions ||
      subscriptions.length === 0
    ) {
      console.log(
        "ℹ️ Aucun abonnement correspondant à la cible."
      );

      return new Response(
        JSON.stringify({
          success: true,
          message:
            "Aucun abonnement Push correspondant.",
          sent: 0,
          failed: 0,
          removed: 0,
          total: 0,
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    // ─────────────────────────────────────────────
    // PAYLOAD PUSH
    // ─────────────────────────────────────────────

    const payload = JSON.stringify({
      title,
      body: message,
      url,
      tag,
    });

    let sent = 0;
    let failed = 0;
    let removed = 0;

    // ─────────────────────────────────────────────
    // ENVOI
    // ─────────────────────────────────────────────

    for (const subscription of subscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint:
              subscription.endpoint,
            keys: {
              p256dh:
                subscription.p256dh,
              auth:
                subscription.auth,
            },
          },
          payload
        );

        sent++;

        console.log(
          "🟢 Push envoyé :",
          subscription.id
        );

      } catch (error) {
        failed++;

        console.error(
          "🔴 ERREUR ENVOI PUSH :",
          error
        );

        const statusCode =
          typeof error === "object" &&
          error !== null &&
          "statusCode" in error
            ? Number(
                (
                  error as {
                    statusCode?: number;
                  }
                ).statusCode
              )
            : null;

        console.error(
          "Code erreur :",
          statusCode
        );

        // ─────────────────────────────────────
        // SUPPRESSION DES ABONNEMENTS INVALIDES
        // ─────────────────────────────────────

        if (
          statusCode === 404 ||
          statusCode === 410
        ) {
          const {
            error: deleteError,
          } = await supabase
            .from("push_subscriptions")
            .delete()
            .eq(
              "id",
              subscription.id
            )
            .eq("endpoint", subscription.endpoint);

          if (deleteError) {
            console.error(
              "Erreur suppression abonnement invalide :",
              deleteError
            );
          } else {
            removed++;

            console.log(
              "🗑️ Abonnement invalide supprimé :",
              subscription.id
            );
          }
        }
      }
    }

    // ─────────────────────────────────────────────
    // RÉPONSE
    // ─────────────────────────────────────────────

    return new Response(
      JSON.stringify({
        success: true,
        sent,
        failed,
        removed,
        total: subscriptions.length,
        target,
        customer_phone:
          customerPhone,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );

  } catch (error) {
    console.error(
      "❌ Erreur Edge Function :",
      error
    );

    return new Response(
      JSON.stringify({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Erreur inconnue",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
});