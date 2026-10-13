import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/auth/confirm")({
  component: AuthConfirmPage,
});

function AuthConfirmPage() {
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;

    async function confirmSession() {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        const tokenHash = url.searchParams.get("token_hash");
        const type = url.searchParams.get("type");

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else if (tokenHash && type === "email") {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: "email",
          });
          if (error) throw error;
        }

        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;

        if (!active) return;

        if (data.session) {
          await navigate({ to: "/account", replace: true });
        } else {
          await navigate({
            to: "/account",
            replace: true,
            search: { confirmation: "pending" },
          });
        }
      } catch (error) {
        console.error("Erreur de confirmation email :", error);

        if (active) {
          await navigate({
            to: "/account",
            replace: true,
            search: { confirmation: "error" },
          });
        }
      }
    }

    confirmSession();

    return () => {
      active = false;
    };
  }, [navigate]);

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <p className="text-center text-muted-foreground">
        Confirmation de ton adresse email…
      </p>
    </main>
  );
}
