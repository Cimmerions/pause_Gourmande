import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

const products = [

{
name:"L'Authentique Choco",
category:"Crêpes",
description:"Nutella premium, éclats de noisettes du Piémont et fines rondelles de banane bio.",
ingredients:["Pâte à crêpe maison","Nutella","Noisettes","Banane"],
price:1500,
image:"crepe-choco.jpg",
badge:"Best-seller",
available:true
},

{
name:"Gaufre Caramel Salé",
category:"Gaufres",
description:"Caramel maison à la fleur de sel...",
ingredients:["Pâte à gaufre","Caramel","Spéculoos","Chantilly"],
price:2000,
image:"gaufre-caramel.jpg",
available:true
},

{
name:"Le Délice du Verger",
category:"Crêpes",
description:"Mangue fraîche, ananas victoria...",
ingredients:["Mangue","Ananas","Miel"],
price:1800,
image:"crepe-tropical.jpg",
badge:"Nouveau",
available:true
},

{
name:"Crêpe Sucre-Citron",
category:"Crêpes",
description:"Sucre glace et citron vert.",
ingredients:["Sucre","Citron"],
price:800,
image:"crepe-sucre.jpg",
available:true
},

{
name:"Gaufre Fraise Chantilly",
category:"Gaufres",
description:"Fraises fraîches...",
ingredients:["Fraise","Chantilly"],
price:2200,
image:"gaufre-fraise.jpg",
available:true
},

{
name:"Bissap Glacé",
category:"Boissons",
description:"Bissap infusé à froid.",
ingredients:["Hibiscus","Gingembre","Menthe"],
price:500,
image:"bissap.jpg",
available:true
}

];

await supabase.from("products").insert(products);

console.log("Produits importés.");