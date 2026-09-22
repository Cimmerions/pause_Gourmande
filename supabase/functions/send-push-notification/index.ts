import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY");
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY");
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT");

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get(
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

Deno.serve(async (req) => {
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
      Deno.env.get("PUSH_WEBHOOK_KEY");

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

    const body = await req.json();

    const title =
      body.title || "Pause Gourmande";

    const message =
      body.body || "Nouvelle notification";

    const url =
      body.url || "/dashboard";

    const tag =
      body.tag ||
      "pause-gourmande-notification";

    const target =
      body.target || "all";

    const customerPhone =
      body.customer_phone || null;

    console.log(
      "📨 Notification Push :",
      {
        title,
        target,
        customerPhone,
      }
    );

    // ─────────────────────────────────────────────
    // VALIDATION DE LA CIBLE
    // ─────────────────────────────────────────────

    if (
      !["admin", "client", "all"].includes(target)
    ) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Cible Push invalide.",
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
      !customerPhone
    ) {
      return new Response(
        JSON.stringify({
          success: false,
          error:
            "customer_phone est requis pour une notification client.",
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
      query = query.not("user_id", "is", null);
    }

    if (target === "client") {
      query = query
        .is("user_id", null)
        .eq(
          "customer_phone",
          customerPhone
        );
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
            );

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