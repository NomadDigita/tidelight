import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
const joined = "id,body,symbol,stance,source_url,reply_to,quote_post_id,created_at,author:community_profiles!community_posts_author_id_fkey(id,handle,display_name,avatar_url)";
export async function GET() {
 const db=await createClient(); const {data:{user}}=await db.auth.getUser();
 const {data:blocked}=user?await db.from("community_blocks").select("blocked_id").eq("blocker_id",user.id):{data:[]};
 const blockedIds=(blocked??[]).map(x=>x.blocked_id);
 const {data:posts,error}=await db.from("community_posts").select(joined).is("reply_to",null).order("created_at",{ascending:false}).limit(40);
 if(error)return NextResponse.json({error:"The research feed is temporarily unavailable."},{status:503});
 const visible=(posts??[]).filter((p:any)=>!blockedIds.includes(p.author?.id));
 const ids=visible.map((p:any)=>p.id);
 const [{data:reactions},{data:replies},{data:mine}]=await Promise.all([
  ids.length?db.from("community_reactions").select("post_id,kind").in("post_id",ids):Promise.resolve({data:[]}),
  ids.length?db.from("community_posts").select("reply_to").in("reply_to",ids):Promise.resolve({data:[]}),
  user&&ids.length?db.from("community_reactions").select("post_id,kind").eq("user_id",user.id).in("post_id",ids):Promise.resolve({data:[]})
 ]);
 return NextResponse.json({posts:visible.map((post:any)=>({ ...post,likes:(reactions??[]).filter(x=>x.post_id===post.id&&x.kind==="like").length,reposts:(reactions??[]).filter(x=>x.post_id===post.id&&x.kind==="repost").length,replies:(replies??[]).filter(x=>x.reply_to===post.id).length,liked:(mine??[]).some(x=>x.post_id===post.id&&x.kind==="like"),reposted:(mine??[]).some(x=>x.post_id===post.id&&x.kind==="repost")}))});
}
export async function POST(request:Request) {
 const db=await createClient(); const {data:{user}}=await db.auth.getUser();
 if(!user)return NextResponse.json({error:"Sign in to join the Tidelight community."},{status:401});
 let body:any;try{body=await request.json()}catch{return NextResponse.json({error:"Send a valid post."},{status:400})}
 if(body.action==="like"||body.action==="repost"){
  if(typeof body.postId!=="string")return NextResponse.json({error:"Choose a post first."},{status:400});
  const kind=body.action;
  const {data:existing}=await db.from("community_reactions").select("post_id").eq("user_id",user.id).eq("post_id",body.postId).eq("kind",kind).maybeSingle();
  if(existing){await db.from("community_reactions").delete().eq("user_id",user.id).eq("post_id",body.postId).eq("kind",kind);return NextResponse.json({active:false})}
  const {error}=await db.from("community_reactions").insert({user_id:user.id,post_id:body.postId,kind});
  if(error)return NextResponse.json({error:"That action could not be saved. Refresh and try again."},{status:400});
  return NextResponse.json({active:true});
 }
 const text=typeof body.body==="string"?body.body.trim():"";
 const symbol=typeof body.symbol==="string"?body.symbol.trim().toUpperCase():"";
 const sourceUrl=typeof body.sourceUrl==="string"?body.sourceUrl.trim():"";
 if(!text||text.length>1800)return NextResponse.json({error:"Write a note between 1 and 1,800 characters."},{status:400});
 if(symbol&&!/^[A-Z0-9]{2,32}$/.test(symbol))return NextResponse.json({error:"Use an rToken pair or US stock ticker."},{status:400});
 if(sourceUrl){try{const u=new URL(sourceUrl);if(u.protocol!=="https:")throw Error()}catch{return NextResponse.json({error:"Evidence links must use HTTPS."},{status:400})}}
 const profile=await db.from("community_profiles").select("id").eq("id",user.id).maybeSingle();
 if(!profile.data)return NextResponse.json({error:"Complete your public research profile in Settings before posting."},{status:409});
 const insert={author_id:user.id,body:text,symbol:symbol||null,stance:["watching","bullish","bearish","question","neutral"].includes(body.stance)?body.stance:"watching",source_url:sourceUrl||null,reply_to:typeof body.replyTo==="string"?body.replyTo:null,quote_post_id:typeof body.quotePostId==="string"?body.quotePostId:null};
 const {data,error}=await db.from("community_posts").insert(insert).select(joined).single();
 if(error)return NextResponse.json({error:"The note could not be published. Check the asset and try again."},{status:400});
 return NextResponse.json({post:data},{status:201});
}
