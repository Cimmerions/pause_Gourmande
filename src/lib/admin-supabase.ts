import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const adminSupabase = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      storage: {
        getItem: (key) =>
          typeof localStorage === "undefined"
            ? null
            : localStorage.getItem(`pause_gourmande_admin:${key}`),
        setItem: (key, value) => {
          if (typeof localStorage !== "undefined") {
            localStorage.setItem(`pause_gourmande_admin:${key}`, value);
          }
        },
        removeItem: (key) => {
          if (typeof localStorage !== "undefined") {
            localStorage.removeItem(`pause_gourmande_admin:${key}`);
          }
        },
      },
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  },
);
