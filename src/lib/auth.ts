import { supabase } from "@/lib/supabase";

export async function signUp(
  email: string,
  password: string,
  name?: string,
  phone?: string
) {
  const redirectUrl = `${window.location.origin}/auth/confirm`;

  const { data, error } = await supabase.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: {
      emailRedirectTo: redirectUrl,
      data: {
        name: name?.trim() || null,
        phone: phone?.trim() || null,
      },
    },
  });

  if (error) console.error("Erreur inscription :", error);
  return { data, error };
}

export async function signIn(
  email: string,
  password: string,
) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });

  if (error) {
    console.error("Erreur connexion :", error);
  }

  return { data, error };
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error("Erreur déconnexion :", error);
  }

  return { error };
}

export async function getCurrentUser() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    console.error("Erreur récupération utilisateur :", error);
  }

  return { user, error };
}

export async function getCurrentSession() {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) {
    console.error("Erreur récupération session :", error);
  }

  return { session, error };
}
