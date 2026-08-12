import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin-login")({
  component: AdminLogin,
});


function AdminLogin() {

  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");


  async function login() {

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });


    if (error) {
      setError(error.message);
      return;
    }


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