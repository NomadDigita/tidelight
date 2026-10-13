import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic="force-dynamic";
function isReviewer(user:{app_metadata?:Record<string,unknown>}){
  const role=user.app_metadata?.role;
  const roles=user.app_metadata?.roles;
  return role==="admin"||role==="operator"||(Array.isArray(roles)&&(roles.includes("admin")||roles.includes("operator")));
}
export async function GET(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user||!isReviewer(user))return NextResponse.json({error:"Operator access required."},{status:403});
  try{
    const admin=createAdminClient();
    const {data,error}=await admin.from("futures_live_access_requests").select("id,user_id,status,terms_version,accepted_terms,requested_at,reviewed_at,review_note").eq("status","pending").order("requested_at",{ascending:true}).limit(100);
    if(error)throw error;
    const requests=await Promise.all((data??[]).map(async item=>{
      const {data:{user:requestedUser}}=await admin.auth.admin.getUserById(item.user_id);
      return {...item,email:requestedUser?.email??"Email unavailable"};
    }));
    return NextResponse.json({requests},{headers:{"Cache-Control":"no-store"}});
  }catch{return NextResponse.json({error:"Could not load the access review queue."},{status:503});}
}
export async function PATCH(request:Request){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user||!isReviewer(user))return NextResponse.json({error:"Operator access required."},{status:403});
  let body:{userId?:unknown;status?:unknown;note?:unknown};
  try{body=await request.json();}catch{return NextResponse.json({error:"Send a valid review decision."},{status:400});}
  if(typeof body.userId!=="string"||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.userId)||!(body.status==="approved"||body.status==="rejected"))return NextResponse.json({error:"Choose an access request and valid decision."},{status:400});
  if(body.userId===user.id)return NextResponse.json({error:"Operators cannot review their own live access request."},{status:403});
  const note=typeof body.note==="string"?body.note.trim().slice(0,500):"";
  try{
    const admin=createAdminClient();
    const {data,error}=await admin.from("futures_live_access_requests").update({status:body.status,reviewed_at:new Date().toISOString(),review_note:note||null,reviewed_by:user.id}).eq("user_id",body.userId).eq("status","pending").select("user_id,status,reviewed_at").maybeSingle();
    if(error)throw error;
    if(!data)return NextResponse.json({error:"This request has already been reviewed or is no longer available."},{status:409});
    return NextResponse.json({review:data},{headers:{"Cache-Control":"no-store"}});
  }catch{return NextResponse.json({error:"The review decision could not be saved."},{status:503});}
}
