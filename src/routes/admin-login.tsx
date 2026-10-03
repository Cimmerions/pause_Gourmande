import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin-login")({
  component: AdminLogin,
});


function AdminLogin() {

  const ADMIN_SESSION_DURATION = 24 * 60 * 60 * 1000;

  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function checkSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
  
      if (!session?.user) {
        return;
      }
  
      const loginTime = Number(
        localStorage.getItem("pause_gourmande_admin_login")
      );
  
      if (
        !loginTime ||
        Date.now() - loginTime >= ADMIN_SESSION_DURATION
      ) {
        localStorage.removeItem("pause_gourmande_admin_login");
  
        await supabase.auth.signOut();
  
        return;
      }
  
      navigate({
        to: "/dashboard",
        replace: true,
      });
    }
  
    checkSession();
  }, [navigate]);


  async function login() {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
  
    if (error) {
      setError(error.message);
      return;
    }
  
    localStorage.setItem(
      "pause_gourmande_admin_login",
      Date.now().toString()
    );
  
    navigate({
      to: "/dashboard",
    });
  }


  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-cream">

      <div className="bg-white rounded-3xl p-8 w-full max-w-md space-y-4">

        <h1 className="text-2xl font-semibold">
          Administration
        </h1>


        <input
          className="border rounded-xl p-3 w-full"
          placeholder="Email"
          value={email}
          onChange={(e)=>setEmail(e.target.value)}
        />


        <input
          className="border rounded-xl p-3 w-full"
          placeholder="Mot de passe"
          type="password"
          value={password}
          onChange={(e)=>setPassword(e.target.value)}
        />


        {error && (
          <p className="text-red-500 text-sm">
            {error}
          </p>
        )}


        <Button
          onClick={login}
          className="w-full"
        >
          Connexion
        </Button>

      </div>

    </div>
  );
}