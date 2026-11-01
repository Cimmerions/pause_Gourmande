
// @ts-ignore Deno resolves this URL import at runtime.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

declare const Deno: {
  env: {
    get(name: string): string | undefined;
  };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const ADMIN_GATE_CODE = Deno.env.get("ADMIN_GATE_CODE");
const ADMIN_GATE_IP_SALT = Deno.env.get("ADMIN_GATE_IP_SALT");

const configurationValid = Boolean(
  SUPABASE_URL &&
  SERVICE_ROLE_KEY &&
  ADMIN_GATE_CODE &&
  ADMIN_GATE_IP_SALT,
);

const supabase = configurationValid
  ? createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    })
  : null;

async function getIpHash(req: Request): Promise<string | null> {
  if (!ADMIN_GATE_IP_SALT) return null;

  const ip = req.headers.get("cf-connecting-ip")?.trim();

  if (!ip) return null;

  const data = new TextEncoder().encode(
    `${ADMIN_GATE_IP_SALT}:${ip}`,
  );

  const digest = await crypto.subtle.digest("SHA-256", data);

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return Response.json(
      { error: "Méthode non autorisée." },
      { status: 405, headers: corsHeaders },
    );
  }

  if (!configurationValid || !supabase) {
    console.error("Configuration admin-gate incomplète.");

    return Response.json(
      { error: "Le contrôle d'accès n'est pas configuré." },
      { status: 500, headers: corsHeaders },
    );
  }

  try {
    const contentLength = req.headers.get("content-length");

    if (contentLength !== null) {
      const size = Number(contentLength);

      if (!Number.isFinite(size) || size < 0 || size > 2048) {
        return Response.json(
          { error: "Requête trop volumineuse." },
          { status: 413, headers: corsHeaders },
        );
      }
    }

    const rawBody = await req.text();

    if (new TextEncoder().encode(rawBody).length > 2048) {
      return Response.json(
        { error: "Requête trop volumineuse." },
        { status: 413, headers: corsHeaders },
      );
    }

    let body: unknown;

    try {
      body = JSON.parse(rawBody);
    } catch {
      return Response.json(
        { error: "Requête invalide." },
        { status: 400, headers: corsHeaders },
      );
    }

    const code =
      typeof body === "object" && body !== null && "code" in body
        ? body.code
        : undefined;

    if (
      typeof code !== "string" ||
      code.length === 0 ||
      code.length > 256
    ) {
      return Response.json(
        { error: "Requête invalide." },
        { status: 400, headers: corsHeaders },
      );
    }

    const ipHash = await getIpHash(req);

    if (!ipHash) {
      console.error("Adresse IP indisponible.");

      return Response.json(
        { error: "Contrôle de sécurité indisponible." },
        { status: 503, headers: corsHeaders },
      );
    }

    const isValid = code === ADMIN_GATE_CODE;

    const { data: attempts, error } = await supabase.rpc(
      "check_admin_gate_rate_limit",
      {
        p_ip_hash: ipHash,
        p_is_valid: isValid,
      },
    );

    if (error) {
      console.error("Erreur du contrôle de tentatives :", error);

      return Response.json(
        { error: "Contrôle de sécurité indisponible." },
        { status: 503, headers: corsHeaders },
      );
    }

    if (typeof attempts !== "number" || attempts < 0) {
      console.error("Réponse invalide du contrôle de tentatives.");

      return Response.json(
        { error: "Contrôle de sécurité indisponible." },
        { status: 503, headers: corsHeaders },
      );
    }

    if (attempts > 5) {
      const { data: rateLimit, error: rateLimitError } = await supabase
        .from("admin_gate_rate_limits")
        .select("window_started_at")
        .eq("ip_hash", ipHash)
        .maybeSingle();

      if (rateLimitError || !rateLimit?.window_started_at) {
        console.error("Impossible de déterminer la fin du blocage :", rateLimitError);

        return Response.json(
          { error: "Contrôle de sécurité indisponible." },
          { status: 503, headers: corsHeaders },
        );
      }

      const expiresAt =
        new Date(rateLimit.window_started_at).getTime() + 15 * 60 * 1000;

      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((expiresAt - Date.now()) / 1000),
      );

      return Response.json(
        {
          error: "Trop de tentatives. Réessayez après le délai indiqué.",
          retry_after_seconds: retryAfterSeconds,
        },
        {
          status: 429,
          headers: {
            ...corsHeaders,
            "Retry-After": String(retryAfterSeconds),
          },
        },
      ); 
    }

    if (!isValid) {
      return Response.json(
        { error: "Code secret incorrect." },
        { status: 401, headers: corsHeaders },
      );
    }

    return Response.json(
      { success: true },
      { headers: corsHeaders },
    );
  } catch (error) {
    console.error("Erreur admin-gate :", error);

    return Response.json(
      { error: "Une erreur interne est survenue." },
      { status: 500, headers: corsHeaders },
    );
  }
});
