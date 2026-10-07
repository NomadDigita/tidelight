import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
function pair(a:string,b:string){return a<b?[a,b]:[b,a]}
async function getPeer(db:any,handle:string){return db.from("community_profiles").select("id,handle,display_name,avatar_url").eq("handle",handle.toLowerCase().replace(/^@/,"")).maybeSingle()}
export async function GET(request:Request){
 const db=await createClient();const {data:{user}}=await db.auth.getUser();if(!user)return NextResponse.json({error:"Sign in to view messages."},{status:401});
 const handle=new URL(request.url).searchParams.get("handle");
 if(handle){const {data:peer}=await getPeer(db,handle);if(!peer)return NextResponse.json({error:"No Tidelight profile was found for that handle."},{status:404});
  const [a,b]=pair(user.id,peer.id);const {data:conversation}=await db.from("community_conversations").select("id").eq("user_a",a).eq("user_b",b).maybeSingle();
  if(!conversation)return NextResponse.json({peer,messages:[]});
  const {data:rows,error}=await db.from("community_messages").select("id,sender_id,body,created_at").eq("conversation_id",conversation.id).order("created_at").limit(100);
  if(error)return NextResponse.json({error:"Messages could not be loaded."},{status:503});
  return NextResponse.json({peer,messages:rows??[]});
 }
 const {data:conversations,error}=await db.from("community_conversations").select("id,user_a,user_b,created_at").or("user_a.eq."+user.id+",user_b.eq."+user.id).order("created_at",{ascending:false}).limit(30);
 if(error)return NextResponse.json({error:"Your inbox could not be loaded."},{status:503});
 const ids=(conversations??[]).map(c=>c.user_a===user.id?c.user_b:c.user_a);
 const {data:profiles}=ids.length?await db.from("community_profiles").select("id,handle,display_name,avatar_url").in("id",ids):{data:[]};
 return NextResponse.json({conversations:(conversations??[]).map(c=>({id:c.id,peer:(profiles??[]).find(p=>p.id===(c.user_a===user.id?c.user_b:c.user_a))}))});
}
export async function POST(request:Request){
 const db=await createClient();const {data:{user}}=await db.auth.getUser();if(!user)return NextResponse.json({error:"Sign in to send a private note."},{status:401});
 let body:any;try{body=await request.json()}catch{return NextResponse.json({error:"Write a message first."},{status:400})}
 const handle=typeof body.handle==="string"?body.handle.trim():"";const message=typeof body.body==="string"?body.body.trim():"";
 if(!handle||!message||message.length>2000)return NextResponse.json({error:"Choose a handle and write up to 2,000 characters."},{status:400});
 const {data:peer}=await getPeer(db,handle);if(!peer||peer.id===user.id)return NextResponse.json({error:"Choose another Tidelight member by handle."},{status:404});
 const {data:blocks}=await db.from("community_blocks").select("blocker_id,blocked_id").or("and(blocker_id.eq."+user.id+",blocked_id.eq."+peer.id+"),and(blocker_id.eq."+peer.id+",blocked_id.eq."+user.id+")");
 if((blocks??[]).length)return NextResponse.json({error:"This conversation is unavailable."},{status:403});
 const [a,b]=pair(user.id,peer.id);
 const {data:conversation,error:convError}=await db.from("community_conversations").upsert({user_a:a,user_b:b},{onConflict:"user_a,user_b"}).select("id").single();
 if(convError||!conversation)return NextResponse.json({error:"Could not open this conversation."},{status:503});
 const {data:row,error}=await db.from("community_messages").insert({conversation_id:conversation.id,sender_id:user.id,body:message}).select("id,sender_id,body,created_at").single();
 if(error)return NextResponse.json({error:"Message could not be sent."},{status:503});
 return NextResponse.json({message:row,peer},{status:201});
}
