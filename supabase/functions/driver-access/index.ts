// @ts-ignore Deno resolves this URL import at runtime.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const deno = (globalThis as typeof globalThis & {
  Deno: {
    env: { get(name: string): string | undefined };
    serve(handler: (req: Request) => Response | Promise<Response>): void;
  };
}).Deno;

const URL = deno.env.get("SUPABASE_URL")!;
const ANON_KEY = deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = createClient(URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const DRIVER_ACCESS_IP_SALT = deno.env.get("DRIVER_ACCESS_IP_SALT");

if (!DRIVER_ACCESS_IP_SALT) {
  throw new Error("DRIVER_ACCESS_IP_SALT manquant");
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string) {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

function randomBytes(length = 16) {
  return crypto.getRandomValues(new Uint8Array(length));
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${DRIVER_ACCESS_IP_SALT}:${value}`),
  );

  return bytesToBase64(new Uint8Array(digest));
}

async function deriveHash(value: string, salt: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(value),
    "PBKDF2",
    false,
    ["deriveBits"],
  );

  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: base64ToBytes(salt),
      iterations: 310000,
    },
    key,
    256,
  );

  return bytesToBase64(new Uint8Array(bits));
}

async function hashSecret(value: string) {
  const salt = bytesToBase64(randomBytes());
  return { salt, hash: await deriveHash(value, salt) };
}

async function matches(value: string, salt: string, expected: string) {
  const actual = await deriveHash(value, salt);
  const a = new TextEncoder().encode(actual);
  const b = new TextEncoder().encode(expected);

  if (a.length !== b.length) return false;

  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a[i] ^ b[i];
  return difference === 0;
}

async function requireAdmin(req: Request) {
  const authorization = req.headers.get("Authorization") ?? "";
  const token = authorization.replace(/^Bearer\s+/i, "");

  if (!token || token === authorization) {
    throw new Error("SESSION_REQUIRED");
  }

  const userClient = createClient(URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: userData, error: userError } =
    await userClient.auth.getUser(token);

  if (userError || !userData.user) throw new Error("SESSION_REQUIRED");

  const { data: isAdmin, error } = await userClient.rpc("is_admin");

  if (error || isAdmin !== true) throw new Error("ADMIN_REQUIRED");

  return userData.user;
}


async function checkAttemptLimit(ipHash: string) {
  const { data: count, error } = await admin.rpc(
    "check_driver_access_attempt_limit",
    { p_ip_hash: ipHash },
  );

  if (error) {
    console.error("Erreur du contrôle des tentatives :", error);
    throw new Error("RATE_LIMIT_CHECK_FAILED");
  }

  if (typeof count !== "number" || count < 1) {
    throw new Error("RATE_LIMIT_CHECK_FAILED");
  }

  if (count > 10) {
    const { data: oldestAttempt, error: attemptError } = await admin
      .from("driver_access_attempts")
      .select("attempted_at")
      .eq("ip_hash", ipHash)
      .gte(
        "attempted_at",
        new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      )
      .order("attempted_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (attemptError || !oldestAttempt?.attempted_at) {
      console.error("Impossible de déterminer la fin du blocage :", attemptError);
      throw new Error("RATE_LIMIT_CHECK_FAILED");
    }

    const expiresAt =
      new Date(oldestAttempt.attempted_at).getTime() + 15 * 60 * 1000;

    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((expiresAt - Date.now()) / 1000),
    );

    throw new Error(`TOO_MANY_ATTEMPTS:${retryAfterSeconds}`);
  }
}


async function verifySharedCode(code: string) {
  const { data, error } = await admin
    .from("driver_access_config")
    .select("code_hash, code_salt, enabled")
    .eq("id", true)
    .maybeSingle();

  if (error || !data?.enabled || !data.code_hash || !data.code_salt) {
    return false;
  }

  return matches(code, data.code_salt, data.code_hash);
}

function validPin(pin: unknown): pin is string {
  return typeof pin === "string" && /^\d{6,12}$/.test(pin);
}

deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") return response({ error: "Méthode non autorisée." }, 405);

  try {
    const body = await req.json();
    const action = body.action;

    // Connexion d'un livreur : code partagé + nom du profil + PIN.
    if (action === "login") {
      const code = typeof body.code === "string" ? body.code.trim() : "";
      const name = typeof body.display_name === "string"
        ? body.display_name.trim()
        : "";
      const pin = body.pin;

      if (!code || !name || !validPin(pin)) {
        return response({
          error: "Code, nom du profil et PIN de 6 à 12 chiffres requis.",
        }, 400);
      }

      const ip = req.headers.get("cf-connecting-ip")?.trim();

      if (!ip) {
        return response({ error: "Contrôle de sécurité indisponible." }, 503);
      }

      const ipHash = await sha256(ip);
      await checkAttemptLimit(ipHash);

      if (!(await verifySharedCode(code))) {
        return response({ error: "Code partagé incorrect ou désactivé." }, 401);
      }

      const { data: drivers, error: driverError } = await admin
        .from("delivery_drivers")
        .select("user_id, display_name, pin_hash, pin_salt")
        .eq("active", true)
        .ilike("display_name", name);

      if (driverError) throw driverError;

      // Le nom doit correspondre à un seul profil actif.
      if (!drivers || drivers.length !== 1) {
        return response({ error: "Profil livreur introuvable ou ambigu." }, 401);
      }

      const driver = drivers[0];

      if (
        !driver.pin_hash ||
        !driver.pin_salt ||
        !(await matches(pin, driver.pin_salt, driver.pin_hash))
      ) {
        return response({ error: "PIN incorrect." }, 401);
      }

      const { data: authUser, error: authUserError } =
        await admin.auth.admin.getUserById(driver.user_id);

      if (authUserError || !authUser.user?.email) {
        return response({
          error: "Compte d'authentification du livreur introuvable.",
        }, 500);
      }

      // Génère un lien sans envoyer d'e-mail. Le navigateur échangera
      // le token_hash contre une vraie session Supabase Auth.
      const { data: linkData, error: linkError } =
        await admin.auth.admin.generateLink({
          type: "magiclink",
          email: authUser.user.email,
        });

      const tokenHash = linkData?.properties?.hashed_token;

      if (linkError || !tokenHash) {
        console.error("Génération de session impossible:", linkError);
        return response({ error: "Impossible de créer la session livreur." }, 500);
      }

      return response({
        token_hash: tokenHash,
        display_name: driver.display_name,
      });
    }

    // Toutes les autres opérations nécessitent une session administrateur.
    await requireAdmin(req);

    if (action === "generate_code") {
      const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      const random = randomBytes(10);
      const code = Array.from(
        random,
        (byte) => alphabet[byte % alphabet.length],
      ).join("");

      const { salt, hash } = await hashSecret(code);

      const { data: current, error: readError } = await admin
        .from("driver_access_config")
        .select("code_version")
        .eq("id", true)
        .maybeSingle();

      if (readError) throw readError;

      const { error } = await admin
        .from("driver_access_config")
        .upsert({
          id: true,
          code_hash: hash,
          code_salt: salt,
          enabled: true,
          code_version: (current?.code_version ?? 0) + 1,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;

      return response({ code });
    }

    if (action === "disable_code") {
      const { data: current } = await admin
        .from("driver_access_config")
        .select("code_version")
        .eq("id", true)
        .maybeSingle();

      const { error } = await admin
        .from("driver_access_config")
        .upsert({
          id: true,
          code_hash: null,
          code_salt: null,
          enabled: false,
          code_version: (current?.code_version ?? 0) + 1,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;
      return response({ success: true });
    }

    if (action === "list_drivers") {
      const { data, error } = await admin
        .from("delivery_drivers")
        .select("user_id, display_name, active, is_available, pin_updated_at")
        .order("display_name");

      if (error) throw error;
      return response({ drivers: data ?? [] });
    }

    if (action === "set_pin") {
      const userId = typeof body.user_id === "string" ? body.user_id : "";
      const pin = body.pin;

      if (!userId || !validPin(pin)) {
        return response({ error: "Identifiant et PIN de 6 à 12 chiffres requis." }, 400);
      }

      const { salt, hash } = await hashSecret(pin);
      const { data, error } = await admin
        .from("delivery_drivers")
        .update({
          pin_hash: hash,
          pin_salt: salt,
          pin_updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId)
        .select("user_id")
        .maybeSingle();

      if (error) throw error;
      if (!data) return response({ error: "Livreur introuvable." }, 404);

      return response({ success: true });
    }

    if (action === "set_active") {
      const userId = typeof body.user_id === "string" ? body.user_id : "";
      if (!userId || typeof body.active !== "boolean") {
        return response({ error: "Identifiant et état actif requis." }, 400);
      }

      const { data, error } = await admin
        .from("delivery_drivers")
        .update({ active: body.active, is_available: false })
        .eq("user_id", userId)
        .select("user_id")
        .maybeSingle();

      if (error) throw error;
      if (!data) return response({ error: "Livreur introuvable." }, 404);

      return response({ success: true });
    }

    if (action === "create_driver") {
      const name = typeof body.display_name === "string"
        ? body.display_name.trim()
        : "";
      const pin = body.pin;

      if (name.length < 2 || name.length > 80 || !validPin(pin)) {
        return response({
          error: "Nom de 2 à 80 caractères et PIN de 6 à 12 chiffres requis.",
        }, 400);
      }

      const { data: duplicate, error: duplicateError } = await admin
        .from("delivery_drivers")
        .select("user_id")
        .ilike("display_name", name);

      if (duplicateError) throw duplicateError;
      if (duplicate?.length) {
        return response({ error: "Ce nom de livreur existe déjà." }, 409);
      }

      const uuid = crypto.randomUUID();
      const email = `driver-${uuid}@example.com`;
      const password = bytesToBase64(randomBytes(32)) + "aA1!";

      const { data: created, error: createError } =
        await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { account_type: "delivery_driver" },
        });

      if (createError || !created.user) {
        console.error("Création Auth impossible:", createError);
        return response({ error: "Impossible de créer le compte livreur." }, 500);
      }

      const { salt, hash } = await hashSecret(pin);

      const { error: driverInsertError } = await admin
        .from("delivery_drivers")
        .insert({
          user_id: created.user.id,
          display_name: name,
          active: true,
          is_available: false,
          pin_hash: hash,
          pin_salt: salt,
          pin_updated_at: new Date().toISOString(),
        });

      if (driverInsertError) {
        await admin.auth.admin.deleteUser(created.user.id);
        console.error("Création du profil impossible:", driverInsertError);
        return response({ error: "Impossible de créer le profil livreur." }, 500);
      }

      return response({
        success: true,
        driver: { user_id: created.user.id, display_name: name, active: true },
      }, 201);
    }

    return response({ error: "Action inconnue." }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur interne";

    if (message === "SESSION_REQUIRED") {
      return response({ error: "Session administrateur requise." }, 401);
    }
    if (message === "ADMIN_REQUIRED") {
      return response({ error: "Accès administrateur refusé." }, 403);
    }
    
    if (message.startsWith("TOO_MANY_ATTEMPTS:")) {
      const retryAfterSeconds = Number(message.split(":")[1]);

      return new Response(
        JSON.stringify({
          error: "Trop de tentatives. Réessaie après le délai indiqué.",
          retry_after_seconds: retryAfterSeconds,
        }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "Retry-After": String(retryAfterSeconds),
            "Cache-Control": "no-store",
          },
        },
      );
    }


    if (message === "RATE_LIMIT_CHECK_FAILED") {
      return response(
        { error: "Contrôle de sécurité indisponible." },
        503,
      );
    }

    console.error("driver-access:", error);
    return response({ error: "Erreur interne du service livreurs." }, 500);
  }
});
