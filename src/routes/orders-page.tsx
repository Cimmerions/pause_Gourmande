import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Check,
  Clock3,
  MapPin,
  PackageCheck,
  X,
} from "lucide-react";
import { toast } from "sonner";

import {
  acceptDelivery,
  getCustomerOrders,
  refuseDelivery,
} from "@/lib/orders";

export const Route = createFileRoute("/orders-page")({
  component: MesCommandesPage,
});

type CustomerOrderItem = {
  name: string;
  quantity: number;
  price: number;
  note: string | null;
};

type CustomerOrder = {
  id: string;
  customer_id: number;
  customer_name: string;
  phone: string;
  mode: string;
  time: string;
  total: number;
  status: "pending" | "done" | "cancelled";
  created_at: string;
  reception_mode: "pickup" | "delivery" | null;
  delivery_latitude: number | null;
  delivery_longitude: number | null;
  delivery_fee: number;
  delivery_status:
    | "awaiting_fee"
    | "awaiting_customer"
    | "accepted"
    | "refused"
    | null;
  reward_source: string | null;
  reward_value: string | null;
  reward_discount: number | null;
  items: CustomerOrderItem[];
};

function formatPrice(value: number) {
  return new Intl.NumberFormat("fr-FR").format(value) + " F";
}

function getStatusLabel(order: CustomerOrder) {
  if (order.status === "cancelled") {
    return "Commande annulée";
  }

  if (
    order.reception_mode === "delivery" &&
    order.delivery_status === "awaiting_fee"
  ) {
    return "Frais de livraison en attente";
  }

  if (
    order.reception_mode === "delivery" &&
    order.delivery_status === "awaiting_customer"
  ) {
    return "Confirmation de livraison requise";
  }

  if (order.status === "done") {
    return "Commande confirmée";
  }

  return "Commande en attente";
}

function MesCommandesPage() {
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [actionOrderId, setActionOrderId] = useState<string | null>(
    null
  );

  async function loadOrders() {
    setLoadError(false);
  
    const { data, error } = await getCustomerOrders();
  
    if (error) {
      console.error("Erreur de chargement des commandes :", error);
      setLoadError(true);
      toast.error("Impossible de récupérer vos commandes.");
      return;
    }
  
    setOrders((data ?? []) as CustomerOrder[]);
  }

  useEffect(() => {
    async function loadInitialOrders() {
      await loadOrders();
      setLoading(false);
    }
  
    loadInitialOrders();
  }, []);

  async function handleAcceptDelivery(order: CustomerOrder) {

    setActionOrderId(order.id);

    const { error } = await acceptDelivery(order.id);

    if (error) {
      toast.error(
        error.message ||
          "Impossible d'accepter la livraison."
      );
      setActionOrderId(null);
      return;
    }

    toast.success("Livraison acceptée !");

    await loadOrders();
    setActionOrderId(null);
  }

  async function handleRefuseDelivery(order: CustomerOrder) {

    setActionOrderId(order.id);

    const { error } = await refuseDelivery(order.id);

    if (error) {
      toast.error(
        error.message ||
          "Impossible de refuser la livraison."
      );
      setActionOrderId(null);
      return;
    }

    toast.success("Livraison refusée.");

    await loadOrders();
    setActionOrderId(null);
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6">
        <header className="mb-8">
          <Link
            to="/"
            className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour
          </Link>

          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10">
              <PackageCheck className="h-5 w-5 text-primary" />
            </div>

            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                Mes commandes
              </h1>

              <p className="text-sm text-muted-foreground">
                Retrouvez ici vos commandes Pause Gourmande.
              </p>
            </div>
          </div>
        </header>

        {loading && (
          <div className="rounded-2xl border bg-card p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Chargement de vos commandes…
            </p>
          </div>
        )}

        {!loading && loadError && (
          <div className="rounded-2xl border bg-card p-8 text-center">
            <PackageCheck className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />

            <h2 className="text-lg font-semibold">
              Impossible de charger vos commandes
            </h2>

            <p className="mt-2 text-sm text-muted-foreground">
              Vérifiez votre connexion puis réessayez.
            </p>

            <button
              type="button"
              onClick={() => {
                setLoading(true);
                void loadOrders().finally(() => setLoading(false));
              }}
              className="mt-6 inline-flex items-center justify-center rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
            >
              Réessayer
            </button>
          </div>
        )}

        {!loading && !loadError && orders.length === 0 && (
          <div className="rounded-2xl border bg-card p-8 text-center">
            <PackageCheck className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />

            <h2 className="text-lg font-semibold">
              Aucune commande pour le moment
            </h2>

            <p className="mt-2 text-sm text-muted-foreground">
              Vos commandes apparaîtront ici dès que vous en aurez passé une.
            </p>

            <Link
              to="/"
              className="mt-6 inline-flex items-center justify-center rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
            >
              Commander
            </Link>
          </div>
        )}

        {!loading && orders.length > 0 && (
          <div className="space-y-4">
            {orders.map((order) => {
              const payableTotal =
                order.total + Number(order.delivery_fee ?? 0);

              const waitingForCustomer =
                order.reception_mode === "delivery" &&
                order.delivery_status === "awaiting_customer" &&
                order.status === "pending";

              const isProcessing = actionOrderId === order.id;

              return (
                <article
                  key={order.id}
                  className="overflow-hidden rounded-2xl border bg-card shadow-sm"
                >
                  <div className="flex items-start justify-between gap-4 border-b p-4">
                    <div>
                      <p className="text-sm font-semibold">
                        Commande #{order.id.slice(0, 8)}
                      </p>

                      <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock3 className="h-3.5 w-3.5" />
                        {order.mode} · {order.time}
                      </div>
                    </div>

                    <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                      {getStatusLabel(order)}
                    </span>
                  </div>

                  <div className="space-y-3 p-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="font-semibold">Détail des produits</span>

                        <span className="font-medium">
                          {formatPrice(order.total)}
                        </span>
                      </div>

                      {order.items.map((item, index) => (
                        <div
                          key={`${order.id}-${index}`}
                          className="rounded-xl bg-muted/40 p-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-medium">
                                {item.name}
                              </p>

                              <p className="mt-1 text-xs text-muted-foreground">
                                Quantité : {item.quantity}
                              </p>

                              {item.note && (
                                <p className="mt-1 text-xs text-muted-foreground">
                                  Note : {item.note}
                                </p>
                              )}
                            </div>

                            <span className="shrink-0 text-sm font-semibold">
                              {formatPrice(item.price * item.quantity)}
                            </span>
                          </div>
                        </div>
                      ))}

                      {order.items.length === 0 && (
                        <p className="text-sm text-muted-foreground">
                          Le détail des produits n'est pas disponible pour cette commande.
                        </p>
                      )}
                    </div>

                    {order.reception_mode === "delivery" && (
                      <>
                        <div className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-2 text-muted-foreground">
                            <MapPin className="h-4 w-4" />
                            Livraison
                          </span>

                          <span className="font-medium">
                            {order.delivery_fee > 0
                              ? formatPrice(order.delivery_fee)
                              : "À confirmer"}
                          </span>
                        </div>

                        {waitingForCustomer && (
                          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                            <p className="text-sm font-semibold">
                              Frais de livraison estimés
                            </p>

                            <p className="mt-1 text-base font-bold text-primary">
                              {formatPrice(order.delivery_fee)}
                            </p>

                            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                              Consultez votre espace client pour valider la livraison.
                            </p>

                            <div className="mt-4 grid grid-cols-2 gap-3">
                              <button
                                type="button"
                                onClick={() =>
                                  handleAcceptDelivery(order)
                                }
                                disabled={isProcessing}
                                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                <Check className="h-4 w-4" />

                                {isProcessing
                                  ? "Traitement…"
                                  : "Accepter"}
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  handleRefuseDelivery(order)
                                }
                                disabled={isProcessing}
                                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-destructive/30 px-4 py-3 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/5 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                <X className="h-4 w-4" />
                                Refuser
                              </button>
                            </div>
                          </div>
                        )}
                      </>
                    )}

                    <div className="flex items-center justify-between gap-3 border-t pt-3">
                      <span className="font-semibold">
                        Total à payer
                      </span>

                      <span className="text-lg font-bold text-primary">
                        {formatPrice(payableTotal)}
                      </span>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}