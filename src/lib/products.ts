import crepeChoco from "@/assets/crepe-choco.jpg";
import gaufreCaramel from "@/assets/gaufre-caramel.jpg";
import crepeTropical from "@/assets/crepe-tropical.jpg";
import crepeSucre from "@/assets/crepe-sucre.jpg";
import gaufreFraise from "@/assets/gaufre-fraise.jpg";
import bissap from "@/assets/bissap.jpg";

export type Product = {
  id: string;
  name: string;
  category: "Crêpes" | "Gaufres" | "Boissons";
  description: string;
  ingredients: string[];
  price: number; // FCFA
  image: string;
  available: boolean;
  badge?: string;
};

export const products: Product[] = [
  {
    id: "choco-lome",
    name: "L'Authentique Choco",
    category: "Crêpes",
    description:
      "Nutella premium, éclats de noisettes du Piémont et fines rondelles de banane bio.",
    ingredients: ["Pâte à crêpe maison", "Nutella", "Noisettes", "Banane"],
    price: 1500,
    image: crepeChoco,
    available: true,
    badge: "Best-seller",
  },
  {
    id: "gaufre-caramel",
    name: "Gaufre Caramel Salé",
    category: "Gaufres",
    description:
      "Caramel maison à la fleur de sel, miettes de spéculoos croustillantes et chantilly.",
    ingredients: ["Pâte à gaufre", "Caramel maison", "Spéculoos", "Chantilly"],
    price: 2000,
    image: gaufreCaramel,
    available: true,
  },
  {
    id: "delice-verger",
    name: "Le Délice du Verger",
    category: "Crêpes",
    description: "Mangue fraîche, ananas victoria, miel de savane et une touche de menthe.",
    ingredients: ["Pâte à crêpe", "Mangue", "Ananas", "Miel", "Menthe"],
    price: 1800,
    image: crepeTropical,
    available: true,
    badge: "Nouveau",
  },
  {
    id: "crepe-sucre",
    name: "Crêpe Sucre-Citron",
    category: "Crêpes",
    description: "La classique intemporelle : sucre glace et zestes de citron vert.",
    ingredients: ["Pâte à crêpe", "Sucre glace", "Citron vert"],
    price: 800,
    image: crepeSucre,
    available: true,
  },
  {
    id: "gaufre-fraise",
    name: "Gaufre Fraise Chantilly",
    category: "Gaufres",
    description: "Fraises fraîches, chantilly maison montée minute et coulis de fruits rouges.",
    ingredients: ["Pâte à gaufre", "Fraises", "Chantilly", "Coulis"],
    price: 2200,
    image: gaufreFraise,
    available: true,
  },
  {
    id: "bissap",
    name: "Bissap Glacé",
    category: "Boissons",
    description: "Notre bissap infusé à froid, gingembre et menthe. Rafraîchissant.",
    ingredients: ["Hibiscus", "Gingembre", "Menthe"],
    price: 500,
    image: bissap,
    available: true,
  },
];

export const formatFCFA = (n: number) =>
  new Intl.NumberFormat("fr-FR").format(n) + " FCFA";
