import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Product } from "./products";
import { createOrder } from "./orders";
import { useReward } from "./rewards";

export type CartItem = { product: Product; qty: number; note?: string };

export type OrderLine = {
  productId: string;
  name: string;
  category: Product["category"];
  qty: number;
  price: number;
  note?: string;
};

export type Order = {
  id: string;
  createdAt: number;
  customerName: string;
  phone: string;
  referralCode?: string;
  mode: "today" | "tomorrow";
  time: string;
  lines: OrderLine[];
  total: number;
  pointsEarned: number;
  usedPoints: number;
  status: "pending" | "done" | "cancelled";
};

type SubmitInput = {
  customerName: string;
  phone: string;
  mode: "today" | "tomorrow";
  time: string;
  total?: number;
  usedPoints?: number;
  rewardId?: number;
  referralCode?: string;
};

type CartContextValue = {
  items: CartItem[];
  add: (p: Product) => void;
  remove: (id: string) => void;
  setQty: (id: string, qty: number) => void;
  setNote: (id: string, note: string) => void;
  clear: () => void;
  count: number;
  total: number;
  orders: Order[];
  submitOrder: (input: SubmitInput) => Promise<Order | null>;
  setOrderStatus: (id: string, status: Order["status"]) => void;
};

const CartContext = createContext<CartContextValue | null>(null);

const STORAGE_KEY = "pause-gourmande:cart";
const ORDERS_KEY = "pause-gourmande:orders";

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setItems(JSON.parse(raw));
      const o = localStorage.getItem(ORDERS_KEY);
      if (o) setOrders(JSON.parse(o));
    } catch {
      // ignore
    }
    setHydrated(true);
  }, []);


  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
  }, [orders, hydrated]);

  const add = useCallback((p: Product) => {
    setItems((prev) => {
      const found = prev.find((i) => i.product.id === p.id);
      if (found)
        return prev.map((i) =>
          i.product.id === p.id ? { ...i, qty: i.qty + 1 } : i,
        );
      return [...prev, { product: p, qty: 1 }];
    });
  }, []);

  const remove = useCallback(
    (id: string) => setItems((prev) => prev.filter((i) => i.product.id !== id)),
    [],
  );

  const setQty = useCallback((id: string, qty: number) => {
    setItems((prev) =>
      qty <= 0
        ? prev.filter((i) => i.product.id !== id)
        : prev.map((i) => (i.product.id === id ? { ...i, qty } : i)),
    );
  }, []);

  const setNote = useCallback((id: string, note: string) => {
    setItems((prev) =>
      prev.map((i) => (i.product.id === id ? { ...i, note } : i)),
    );
  }, []);

  const clear = useCallback(() => setItems([]), []);


  const submitOrder = useCallback(
    async (input: SubmitInput): Promise<Order | null> => {

      if (!items.length) return null;


      const originalTotal = items.reduce(
        (s, i) => s + i.qty * i.product.price,
        0
      );

      const total = input.total ?? originalTotal;

      const pointsEarned = Math.floor(total / 100);


      const order: Order = {
        id:
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `o_${Date.now()}`,

        createdAt: Date.now(),

        customerName: input.customerName,
        phone: input.phone,
        mode: input.mode,
        time: input.time,

        lines: items.map((i) => ({
          productId: i.product.id,
          name: i.product.name,
          category: i.product.category,
          qty: i.qty,
          price: i.product.price,
          note: i.note,
        })),

        total,
        pointsEarned,
        usedPoints: input.usedPoints ?? 0,
        status: "pending",
      };


      // 1. Envoi Supabase
      const createdOrder = await createOrder(
        order,
        input.referralCode
      );

      if (!createdOrder) {
        return null;
      }

      // Ajouter le code de parrainage réellement accepté
      if (createdOrder.acceptedReferralCode) {
        order.referralCode = createdOrder.acceptedReferralCode;
      }

      // Consommation des récompenses utilisées
      if (input.rewardId) {
        await useReward(
          input.rewardId,
          createdOrder.data.id
        );
      }

      setOrders((os) => [order, ...os]);

      setItems([]);

      return order;

    },
    [items]
  );

  const setOrderStatus = useCallback((id: string, status: Order["status"]) => {
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status } : o)));
  }, []);

  const value = useMemo<CartContextValue>(() => {
    const count = items.reduce((s, i) => s + i.qty, 0);
    const total = items.reduce((s, i) => s + i.qty * i.product.price, 0);
    return {
      items,
      add,
      remove,
      setQty,
      setNote,
      clear,
      count,
      total,
      orders,
      submitOrder,
      setOrderStatus,
    };
  }, [
    items,
    add,
    remove,
    setQty,
    setNote,
    clear,
    orders,
    submitOrder,
    setOrderStatus,
  ]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
