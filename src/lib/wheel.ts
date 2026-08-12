import { supabase } from "./supabase";


export async function saveSpin(
  phone:string,
  prize:string,
  points:number
){

  return await supabase
    .from("wheel_spins")
    .insert({
      customer_phone:phone,
      prize,
      points
    });

}



export async function addCustomerPoints(
  id: number,
  currentPoints: number,
  points: number
){

  return await supabase
    .from("customers")
    .update({
      points: currentPoints + points
    })
    .eq("id", id);

}

export async function hasPlayedToday(phone:string){

  const {data,error}=await supabase
    .from("wheel_spins")
    .select("id")
    .eq("customer_phone",phone)
    .gte(
      "created_at",
      new Date(
        new Date().setHours(0,0,0,0)
      ).toISOString()
    )
    .maybeSingle();


  if(error){
    console.error(error);
    return false;
  }


  return !!data;

}