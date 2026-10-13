import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Eye, EyeOff, LockKeyhole, Mail, Phone, User } from "lucide-react";
import { toast } from "sonner";
import { getCurrentUser, signIn, signOut, signUp } from "@/lib/auth";
import { getCurrentCustomer } from "@/lib/customers";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/account")({
  component: AccountPage,
});

function AccountPage() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [showPassword, setShowPassword] = useState(false);
  const [customerName, setCustomerName] = useState("");

  const [user, setUser] = useState<{
    id: string;
    email?: string;
  } | null>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

useEffect(() => {
  let active = true;

  async function loadUser() {
    try {
      const { user } = await getCurrentUser();

      if (!active) return;

      if (user) {
        setUser({
          id: user.id,
          email: user.email,
        });

        let customer = await getCurrentCustomer();

        // Si aucune fiche n'est liée, tenter l'initialisation
        // uniquement avec une session authentifiée.
        if (!customer) {
          const { error } = await supabase.rpc(
            "ensure_my_customer_profile"
          );

          if (!error) {
            customer = await getCurrentCustomer();
          } else {
            console.error(
              "Initialisation du profil client impossible :",
              error
            );
          }
        }

        if (!active) return;

        if (customer) {
          setCustomerName(customer.name?.trim() || "Gourmand");
        }
      }
    } catch (error) {
      console.error("Erreur de chargement du compte :", error);
    } finally {
      if (active) {
        setLoading(false);
      }
    }
  }

  loadUser();

  return () => {
    active = false;
  };
}, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (mode === "signup") {
      if (!name.trim()) {
        toast.error("Entre ton nom.");
        return;
      }

      if (!/^\d{8}$/.test(phone)) {
        toast.error("Le numéro doit contenir exactement 8 chiffres.");
        return;
      }
    }

    if (!email.trim()) {
      toast.error("Entre ton adresse email.");
      return;
    }

    if (password.length < 8) {
      toast.error("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }

    
    setSubmitting(true);

    try {
      if (mode === "signup") {
        const normalizedEmail = email.trim().toLowerCase();
        const normalizedPhone = phone.trim();

        const { data: phoneExists, error: phoneCheckError } =
          await supabase.rpc("check_signup_phone", {
          p_phone: normalizedPhone,
        });

        if (phoneCheckError) {
          console.error("Erreur vérification téléphone :", phoneCheckError);
          toast.error("Impossible de vérifier le numéro. Réessaie.");
          return;
        }

        if (phoneExists) {
          toast.error(
            "Ce numéro est déjà associé à une fiche client. Utilise un autre numéro ou demande la vérification de ton ancienne fiche."
          );
          return;
        }

        const { data, error } = await signUp(
          normalizedEmail,
          password,
          name.trim(),
          normalizedPhone
        );

        
        if (error) {
          console.error("Erreur inscription :", error);

          if (
            error.message.toLowerCase().includes("already registered") ||
            error.message.toLowerCase().includes("already exists")
          ) {
            toast.error(
              "Cette adresse email est peut-être déjà utilisée. Essaie de te connecter ou de récupérer ton accès."
            );
          } else {
            toast.error("Impossible de créer le compte. Réessaie.");
          }

          return;
        }

        if (!data.user) {
          toast.error("Impossible de créer le compte.");
          return;
        }

      // Supabase peut masquer l'existence d'un email déjà inscrit.
        if (
          !data.session &&
          data.user.identities &&
          data.user.identities.length === 0
        ) {
          toast.error(
            "Cette adresse email est peut-être déjà associée à un compte. Essaie de te connecter."
          );
          return;
        }

        if (!data.session) {
          toast.success(
            "Compte créé ! Vérifie ton email pour confirmer ton compte.",
          );
          setMode("login");
          setPassword("");
        } else {
          const { data: createdProfile, error: profileError } =
            await supabase.rpc("ensure_my_customer_profile");

          if (profileError || !createdProfile) {
            console.error("Erreur création du profil client :", profileError);
            toast.error(
              "Ton compte est créé, mais le profil client n'a pas pu être initialisé. Vérifions la liaison avant de continuer."
            );
            return;
          }

          const customer = await getCurrentCustomer();

          if (!customer) {
            toast.error(
              "Le profil client a été initialisé, mais il est impossible de le charger."
            );
            return;
          }

          setCustomerName(customer.name?.trim() || "Gourmand");

          setUser({
            id: data.user.id,
            email: data.user.email,
          });

          toast.success("Compte créé avec succès !");
        }

      } else {
        const { data, error } = await signIn(email, password);

        if (error) {
          toast.error("Email ou mot de passe incorrect.");
          return;
        }

        if (!data.user) {
          toast.error("Connexion impossible.");
          return;
        }

        
        const customer = await getCurrentCustomer();

        if (!customer) {
          toast.error(
            "Ton compte est connecté, mais ton profil client n'a pas pu être chargé. Si tu as déjà commandé avec ce numéro, contacte-nous pour vérifier la liaison."
          );
          return;
        }

      setCustomerName(customer.name?.trim() || "Gourmand");

      setUser({
        id: data.user.id,
        email: data.user.email,
      });

      toast.success("Connexion réussie !");

      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSignOut() {
    const { error } = await signOut();

    if (error) {
      toast.error("Impossible de se déconnecter.");
      return;
    }

    setUser(null);
    toast.success("Tu es déconnecté.");
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-brand-cream flex items-center justify-center">
        <div className="text-sm text-brand-deep/60">
          Chargement de ton espace…
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-brand-cream text-brand-deep">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 py-6">
        {/* Retour */}
        <div className="mb-8">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-brand-deep/70 transition hover:text-brand-gold"
          >
            <ArrowLeft className="size-4" />
            Retour à l'accueil
          </Link>
        </div>

        {/* En-tête */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-brand-gold text-white shadow-lg shadow-brand-gold/20">
            <User className="size-7" />
          </div>

          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-brand-gold">
            Pause Gourmande
          </p>

          <h1 className="text-2xl font-bold">
            Mon espace
          </h1>

          <p className="mt-2 text-sm leading-6 text-brand-deep/60">
            Retrouve tes commandes, tes pépites et tes avantages au même endroit.
          </p>
        </div>

        {user ? (
          /* =========================
             UTILISATEUR CONNECTÉ
             ========================= */
          <section className="rounded-3xl border border-brand-gold/10 bg-white p-6 shadow-sm">
            <div className="mb-6 text-center">
              <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-brand-gold/10 text-brand-gold">
                <User className="size-6" />
              </div>

              <h2 className="text-lg font-bold">
                Bonjour, {customerName || "Gourmand"} 👋
              </h2>

              <p className="mt-1 text-sm text-brand-deep/60">
                Heureux de te retrouver chez Pause Gourmande !
              </p>
            </div>

            <div className="space-y-3">
              <Link
                to="/orders-page"
                className="flex w-full items-center justify-center rounded-2xl bg-brand-gold px-4 py-3 text-sm font-semibold text-white shadow-md shadow-brand-gold/20 transition hover:opacity-90"
              >
                Mes commandes
              </Link>

              <button
                type="button"
                onClick={handleSignOut}
                className="w-full rounded-2xl border border-brand-deep/10 px-4 py-3 text-sm font-semibold text-brand-deep/70 transition hover:bg-brand-cream"
              >
                Se déconnecter
              </button>
            </div>
          </section>
        ) : (
          /* =========================
             FORMULAIRE
             ========================= */
          <section className="rounded-3xl border border-brand-gold/10 bg-white p-6 shadow-sm">
            {/* Onglets */}
            <div className="mb-6 grid grid-cols-2 rounded-2xl bg-brand-cream p-1">
              <button
                type="button"
                onClick={() => setMode("login")}
                className={`rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                  mode === "login"
                    ? "bg-white text-brand-gold shadow-sm"
                    : "text-brand-deep/50"
                }`}
              >
                Se connecter
              </button>

              <button
                type="button"
                onClick={() => setMode("signup")}
                className={`rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                  mode === "signup"
                    ? "bg-white text-brand-gold shadow-sm"
                    : "text-brand-deep/50"
                }`}
              >
                Créer un compte
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === "signup" && (
                <>
                  {/* Nom */}
                  <div>
                    <label
                      htmlFor="account-name"
                      className="mb-1.5 block text-sm font-medium"
                    >
                      Ton nom
                    </label>

                    <div className="relative">
                      <User className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-brand-deep/40" />

                      <input
                        id="account-name"
                        type="text"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        placeholder="Ex. joe"
                        autoComplete="name"
                        className="h-12 w-full rounded-2xl border border-brand-deep/10 bg-brand-cream/40 pl-10 pr-4 text-sm outline-none transition focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/10"
                      />
                    </div>
                  </div>

                  {/* Téléphone */}
                  <div>
                    <label
                      htmlFor="account-phone"
                      className="mb-1.5 block text-sm font-medium"
                    >
                      Numéro de téléphone
                    </label>

                    <div className="relative">
                      <Phone className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-brand-deep/40" />

                      <input
                        id="account-phone"
                        type="tel"
                        inputMode="numeric"
                        maxLength={8}
                        value={phone}
                        onChange={(event) =>
                          setPhone(
                            event.target.value.replace(/\D/g, "").slice(0, 8),
                          )
                        }
                        placeholder="Ex. 90123456"
                        autoComplete="tel"
                        className="h-12 w-full rounded-2xl border border-brand-deep/10 bg-brand-cream/40 pl-10 pr-4 text-sm outline-none transition focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/10"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Email */}
              <div>
                <label
                  htmlFor="account-email"
                  className="mb-1.5 block text-sm font-medium"
                >
                  Adresse email
                </label>

                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-brand-deep/40" />

                  <input
                    id="account-email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="ton@email.com"
                    autoComplete="email"
                    className="h-12 w-full rounded-2xl border border-brand-deep/10 bg-brand-cream/40 pl-10 pr-4 text-sm outline-none transition focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/10"
                  />
                </div>
              </div>

              {/* Mot de passe */}
              <div>
                <label
                  htmlFor="account-password"
                  className="mb-1.5 block text-sm font-medium"
                >
                  Mot de passe
                </label>

                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-brand-deep/40" />

                  <input
                    id="account-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="8 caractères minimum"
                    autoComplete={
                      mode === "signup" ? "new-password" : "current-password"
                    }
                    className="h-12 w-full rounded-2xl border border-brand-deep/10 bg-brand-cream/40 pl-10 pr-12 text-sm outline-none transition focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/10"
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={
                      showPassword
                        ? "Masquer le mot de passe"
                        : "Afficher le mot de passe"
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-deep/40 transition hover:text-brand-gold"
                  >
                    {showPassword ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Bouton */}
              <button
                type="submit"
                disabled={submitting}
                className="mt-2 flex h-12 w-full items-center justify-center rounded-2xl bg-brand-gold px-4 text-sm font-bold text-white shadow-md shadow-brand-gold/20 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting
                  ? "Chargement…"
                  : mode === "signup"
                    ? "Créer mon compte"
                    : "Se connecter"}
              </button>
            </form>

            <p className="mt-5 text-center text-xs leading-5 text-brand-deep/45">
              Ton compte te permettra de retrouver tes commandes et tes avantages
              sans devoir saisir ton numéro à chaque visite.
            </p>
          </section>
        )}
      </div>
    </main>
  );
}
