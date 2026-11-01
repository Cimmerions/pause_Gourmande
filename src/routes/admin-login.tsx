
import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { adminSupabase } from "@/lib/admin-supabase";
import { Button } from "@/components/ui/button";
import { getFunctionErrorMessage, getFunctionRetryAfterSeconds } from "@/lib/function-errors";
import { useRateLimitLockout } from "@/lib/use-rate-limit-lockout";

export const Route = createFileRoute("/admin-login")({
  component: AdminLogin,
});

const ADMIN_SESSION_DURATION = 24 * 60 * 60 * 1000;

function AdminLogin() {
  const navigate = useNavigate();

  const [gateCode, setGateCode] = useState("");
  const [gateVerified, setGateVerified] = useState(false);
  const [gateSubmitting, setGateSubmitting] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [checkingSession, setCheckingSession] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const {
    isLocked: gateIsLocked,
    countdown: gateCountdown,
    startLockout: startGateLockout,
  } = useRateLimitLockout("pause_gourmande_admin_gate_lockout");

  useEffect(() => {
    let active = true;

    async function checkSession() {
      try {
        const {
          data: { session },
          error: sessionError,
        } = await adminSupabase.auth.getSession();

        if (sessionError) {
          throw sessionError;
        }

        if (!session?.user) {
          return;
        }

        const loginTime = Number(
          localStorage.getItem("pause_gourmande_admin_login"),
        );

        if (
          !loginTime ||
          Date.now() - loginTime >= ADMIN_SESSION_DURATION
        ) {
          localStorage.removeItem("pause_gourmande_admin_login");
          return;
        }

        const { data: admin, error: adminError } = await adminSupabase
          .from("admin_users")
          .select("role")
          .eq("user_id", session.user.id)
          .maybeSingle();

        if (adminError) {
          console.error("Vérification administrateur impossible :", adminError);
          if (active) {
            setError("Impossible de vérifier les droits administrateur. Réessaie.");
          }
          return;
        }

        if (!admin) {
          localStorage.removeItem("pause_gourmande_admin_login");
          if (active) {
            setError(
              "Ce compte n'a pas accès à l'administration. Connecte-toi avec le compte administrateur.",
            );
          }
          return;
        }

        if (active) {
          await navigate({ to: "/dashboard", replace: true });
        }
      } catch (err) {
        console.error("Erreur de vérification de session :", err);
        if (active) {
          setError("Impossible de vérifier la session. Réessaie.");
        }
      } finally {
        if (active) {
          setCheckingSession(false);
        }
      }
    }

    void checkSession();

    return () => {
      active = false;
    };
  }, [navigate]);

  async function verifyGateCode() {
    if (gateSubmitting) return;

    setGateSubmitting(true);
    setError("");

    try {
      const { data, error: gateError } =
        await adminSupabase.functions.invoke("admin-gate", {
          body: { code: gateCode },
        });

      if (gateError) {
        const retryAfter = await getFunctionRetryAfterSeconds(gateError);

        if (retryAfter !== null) {
          startGateLockout(retryAfter);
        }

        setError(
          await getFunctionErrorMessage(
            gateError,
            "Code secret incorrect ou vérification impossible.",
          ),
        );
        return;
      }

      if (!data?.success) {
        setError(
          data?.error || "Code secret incorrect ou vérification impossible.",
        );
        return;
      }

      setGateVerified(true);
      setGateCode("");
      setError("");
    } catch (err) {
      console.error("Erreur de vérification du code secret :", err);
      setError("Impossible de vérifier le code secret. Réessaie.");
    } finally {
      setGateSubmitting(false);
    }
  }

  async function login() {
    if (submitting) return;

    setSubmitting(true);
    setError("");

    try {
      const { data, error: loginError } =
        await adminSupabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });

      if (loginError || !data.user) {
        setError("Email ou mot de passe incorrect.");
        return;
      }

      const { data: admin, error: adminError } = await adminSupabase
        .from("admin_users")
        .select("role")
        .eq("user_id", data.user.id)
        .maybeSingle();

      if (adminError) {
        console.error("Vérification administrateur impossible :", adminError);
        setError("Impossible de vérifier les droits administrateur.");
        return;
      }

      if (!admin) {
        await adminSupabase.auth.signOut();
        localStorage.removeItem("pause_gourmande_admin_login");
        setError("Ce compte n'est pas autorisé à accéder à l'administration.");
        return;
      }

      localStorage.setItem(
        "pause_gourmande_admin_login",
        Date.now().toString(),
      );

      await navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      console.error("Erreur de connexion administrateur :", err);
      setError("Une erreur est survenue. Réessaie.");
    } finally {
      setSubmitting(false);
    }
  }

  if (checkingSession) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-brand-cream">
        Vérification de la session…
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-brand-cream p-4">
      {!gateVerified ? (
        <form
          className="bg-white rounded-3xl p-8 w-full max-w-md space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void verifyGateCode();
          }}
        >
          <h1 className="text-2xl font-semibold">Accès sécurisé</h1>
          <p className="text-sm text-gray-600">
            Saisis le code secret pour accéder à la connexion administrateur.
          </p>

          <label className="block space-y-1">
            <span className="text-sm">Code secret</span>
            <input
              className="border rounded-xl p-3 w-full"
              type="password"
              autoComplete="off"
              placeholder="Code secret"
              value={gateCode}
              onChange={(event) => setGateCode(event.target.value)}
              disabled={gateSubmitting || gateIsLocked}
              required
            />
          </label>

          {error && (
            <p role="alert" className="text-red-600 text-sm">
              {error}
            </p>
          )}

          {gateIsLocked && (
            <p
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              Trop de tentatives. Réessaie dans{" "}
              <strong className="font-semibold tabular-nums">
                {gateCountdown}
              </strong>.
            </p>
          )}

          <Button
            type="submit"
            disabled={gateSubmitting || gateIsLocked}
            className="w-full"
          >
            {gateSubmitting ? "Vérification…" : "Vérifier le code"}
          </Button>
        </form>
      ) : (
      <form
        className="bg-white rounded-3xl p-8 w-full max-w-md space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void login();
        }}
      >
        <h1 className="text-2xl font-semibold">Administration</h1>

        <label className="block space-y-1">
          <span className="text-sm">Adresse email</span>
          <input
            className="border rounded-xl p-3 w-full"
            type="email"
            autoComplete="username"
            placeholder="Email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm">Mot de passe</span>
          <input
            className="border rounded-xl p-3 w-full"
            type="password"
            autoComplete="current-password"
            placeholder="Mot de passe"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>

        {error && (
          <p role="alert" className="text-red-600 text-sm">
            {error}
          </p>
        )}

        <Button
          type="submit"
          disabled={submitting}
          className="w-full"
        >
          {submitting ? "Connexion…" : "Connexion"}
        </Button>
      </form>
      )}
    </main>
  );
}
