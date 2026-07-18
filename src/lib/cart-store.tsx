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

export type CartItem = { product: Product; qty: number; note?: string };

export type OrderLine = {
  productId: string;
  name: string;
  category: Product["category"];
  qty: number;
  price: number;
};

export type Order = {
  id: string;
  createdAt: number;
  customerName: string;
  phone: string;
  mode: "today" | "tomorrow";
  time: string;
  lines: OrderLine[];
  total: number;
  pointsEarned: number;
  status: "pending" | "done" | "cancelled";
};

type SubmitInput = {
  customerName: string;
  phone: string;
  mode: "today" | "tomorrow";
  time: string;
};

type CartContextValue = {
  items: CartItem[];
  add: (p: Product) => void;
  remove: (id: string) => void;
  setQty: (id: string, qty: number) => void;
  setNote: (id: string, note: string) => void;
  clear: () => void;
  points: number;
  addPoints: (n: number) => void;
  count: number;
  total: number;
  orders: Order[];
  submitOrder: (input: SubmitInput) => Order | null;
  setOrderStatus: (id: string, status: Order["status"]) => void;
};

const CartContext = createContext<CartContextValue | null>(null);

const STORAGE_KEY = "pause-gourmande:cart";
const POINTS_KEY = "pause-gourmande:points";
const ORDERS_KEY = "pause-gourmande:orders";

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [points, setPoints] = useState(0);
  const [orders, setOrders] = useState<Order[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setItems(JSON.parse(raw));
      const p = localStorage.getItem(POINTS_KEY);
      if (p) setPoints(Number(p) || 0);
      const o = localStorage.getItem(ORDERS_KEY);
      if (o) setOrders(JSON.parse(o));
    } catch {
      // ignore
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(POINTS_KEY, String(points));
  }, [points, hydrated]);

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
  const addPoints = useCallback((n: number) => setPoints((p) => p + n), []);

  const submitOrder = useCallback(
    (input: SubmitInput): Order | null => {
      let created: Order | null = null;
      setItems((prev) => {
        if (!prev.length) return prev;
        const total = prev.reduce((s, i) => s + i.qty * i.product.price, 0);
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
          lines: prev.map((i) => ({
            productId: i.product.id,
            name: i.product.name,
            category: i.product.category,
            qty: i.qty,
            price: i.product.price,
          })),
          total,
          pointsEarned,
          status: "pending",
        };
        created = order;
        setOrders((os) => [order, ...os]);
        setPoints((p) => p + pointsEarned);
        return [];
      });
      return created;
    },
    [],
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
      points,
      addPoints,
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
    points,
    addPoints,
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
