import { supabase } from "./supabase";


export type Product = {
  id: string;
  name: string;
  description: string;
  ingredients: string[] | null;
  price: number;
  image: string;
  category: string;
  available: boolean;
  badge: string | null;
};


export async function getProducts(): Promise<Product[]> {

  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("available", true)
    .order("name", { ascending: true });

    console.log("PRODUCTS DATA :", data);
    console.log("PRODUCTS ERROR :", error);


  if (error) {
    console.error("Erreur chargement produits :", error);
    return [];
  }


  return data as Product[];

}



// Format prix FCFA
export function formatFCFA(price: number) {

  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "XOF",
    maximumFractionDigits: 0,
  })
  .format(price)
  .replace("XOF", "FCFA");

}