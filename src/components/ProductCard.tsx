import { useState } from "react";
import { Plus, Check } from "lucide-react";
import { toast } from "sonner";
import { formatFCFA, type Product } from "@/lib/products";
import { useCart, type CartAddon } from "@/lib/cart-store";

export function ProductCard({
  product,
  addons,
}: {
  product: Product;
  addons: Product[];
}) {
  const { add } = useCart();

  const [showAddons, setShowAddons] = useState(false);
  const [selectedAddons, setSelectedAddons] = useState<CartAddon[]>([]);

  const toggleAddon = (addon: Product) => {
    setSelectedAddons((prev) => {
      const exists = prev.some((item) => item.productId === addon.id);

      if (exists) {
        return prev.filter((item) => item.productId !== addon.id);
      }

      return [
        ...prev,
        {
          productId: addon.id,
          name: addon.name,
          price: addon.price,
        },
      ];
    });
  };

  const openAddons = () => {
    setSelectedAddons([]);
    setShowAddons(true);
  };

  const confirmAdd = () => {
    add(product, selectedAddons);

    const addonsText =
      selectedAddons.length > 0
        ? ` avec ${selectedAddons.map((a) => a.name).join(", ")}`
        : "";

    toast.success(`${product.name}${addonsText} ajouté au panier`);

    setShowAddons(false);
    setSelectedAddons([]);
  };

  const addonsTotal = selectedAddons.reduce(
    (sum, addon) => sum + addon.price,
    0
  );

  const finalPrice = product.price + addonsTotal;

  return (
    <div className="group bg-card p-4 rounded-[28px] ring-1 ring-border flex flex-col transition-shadow hover:shadow-xl hover:shadow-brand-gold/5">
      <div className="relative w-full aspect-square rounded-[20px] overflow-hidden mb-6 bg-secondary">
        <img
          src={product.image || "/placeholder.png"}
          alt={product.name}
          loading="lazy"
          width={1024}
          height={1024}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          onError={(e) => {
            e.currentTarget.src = "/placeholder.png";
          }}
        />

        {product.badge && (
          <span className="absolute top-3 left-3 bg-brand-deep text-brand-cream text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full">
            {product.badge}
          </span>
        )}
      </div>

      <div className="px-2 pb-2 flex-1 flex flex-col">
        <div className="flex justify-between items-start gap-3 mb-2">
          <h3 className="font-semibold text-xl leading-tight">
            {product.name}
          </h3>

          <span className="font-semibold text-brand-gold bg-brand-gold/10 px-2 py-0.5 rounded-md text-sm whitespace-nowrap">
            {formatFCFA(product.price).replace(" FCFA", " F")}
          </span>
        </div>

        <p className="text-sm text-muted-foreground text-pretty mb-4 leading-relaxed">
          {product.description}
        </p>

        <p className="text-[11px] text-muted-foreground/70 mb-6">
          {product.ingredients?.join(" • ")}
        </p>

        {!showAddons ? (
          <button
            onClick={openAddons}
            className="mt-auto w-full py-3 px-4 bg-secondary text-foreground text-sm font-semibold rounded-2xl flex items-center justify-center gap-2 group-hover:bg-brand-gold group-hover:text-white transition-colors"
          >
            <Plus className="size-4" />
            Ajouter au panier
          </button>
        ) : (
          <div className="mt-auto space-y-3">
            <p className="text-sm font-semibold">
              Ajouter une garniture ?
            </p>

            <div className="space-y-2">
              {addons.map((addon) => {
                const selected = selectedAddons.some(
                  (item) => item.productId === addon.id
                );

                return (
                  <button
                    key={addon.id}
                    type="button"
                    onClick={() => toggleAddon(addon)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-sm transition ${
                      selected
                        ? "border-brand-gold bg-brand-gold/10"
                        : "border-border bg-secondary hover:border-brand-gold/40"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className={`size-5 rounded-full flex items-center justify-center border ${
                          selected
                            ? "bg-brand-gold border-brand-gold text-white"
                            : "border-muted-foreground/40"
                        }`}
                      >
                        {selected && <Check className="size-3" />}
                      </span>

                      <span>{addon.name}</span>
                    </span>

                    <span className="font-semibold text-brand-gold">
                      +{formatFCFA(addon.price).replace(" FCFA", " F")}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowAddons(false);
                  setSelectedAddons([]);
                }}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Annuler
              </button>

              <button
                type="button"
                onClick={confirmAdd}
                className="px-5 py-3 rounded-xl bg-brand-gold text-white text-sm font-semibold"
              >
                Ajouter •{" "}
                {formatFCFA(finalPrice).replace(" FCFA", " F")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}