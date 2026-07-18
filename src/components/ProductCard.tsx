import { Plus } from "lucide-react";
import { toast } from "sonner";
import type { Product } from "@/lib/products";
import { formatFCFA } from "@/lib/products";
import { useCart } from "@/lib/cart-store";

export function ProductCard({ product }: { product: Product }) {
  const { add } = useCart();

  const onAdd = () => {
    add(product);
    toast.success(`${product.name} ajouté au panier`);
  };

  return (
    <div className="group bg-card p-4 rounded-[28px] ring-1 ring-border flex flex-col transition-shadow hover:shadow-xl hover:shadow-brand-gold/5">
      <div className="relative w-full aspect-square rounded-[20px] overflow-hidden mb-6 bg-secondary">
        <img
          src={product.image}
          alt={product.name}
          loading="lazy"
          width={1024}
          height={1024}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        {product.badge && (
          <span className="absolute top-3 left-3 bg-brand-deep text-brand-cream text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full">
            {product.badge}
          </span>
        )}
      </div>
      <div className="px-2 pb-2 flex-1 flex flex-col">
        <div className="flex justify-between items-start gap-3 mb-2">
          <h3 className="font-semibold text-xl leading-tight">{product.name}</h3>
          <span className="font-semibold text-brand-gold bg-brand-gold/10 px-2 py-0.5 rounded-md text-sm whitespace-nowrap">
            {formatFCFA(product.price).replace(" FCFA", " F")}
          </span>
        </div>
        <p className="text-sm text-muted-foreground text-pretty mb-4 leading-relaxed">
          {product.description}
        </p>
        <p className="text-[11px] text-muted-foreground/70 mb-6">
          {product.ingredients.join(" • ")}
        </p>
        <button
          onClick={onAdd}
          className="mt-auto w-full py-3 px-4 bg-secondary text-foreground text-sm font-semibold rounded-2xl flex items-center justify-center gap-2 group-hover:bg-brand-gold group-hover:text-white transition-colors"
        >
          <Plus className="size-4" />
          Ajouter au panier
        </button>
      </div>
    </div>
  );
}
