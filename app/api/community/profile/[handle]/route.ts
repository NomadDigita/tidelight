import {NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";
const joined="id,author_id,body,symbol,stance,source_url,media,reply_to,quote_post_id,created_at";
function fresh(rows:any[]){return rows.map(post=>{const expired=Date.now()-Date.parse(post.created_at)>7*24*60*60*1000;return {...post,media:expired?[]:(post.media??[]),mediaExpired:expired&&(post.media??[]).length>0}})}
async function fetchPosts(db:any,ids:string[]){if(!ids.length)return[];const {data,error}=await db.from("community_posts").select(joined).in("id",ids);if(error)throw error;const byId=new Map((data??[]).map((row:any)=>[row.id,row]));const authorIds=[...new Set((data??[]).map((row:any)=>row.author_id))];const {data:authors,error:authorError}=authorIds.length?await db.from("community_profiles").select("id,handle,display_name,avatar_url").in("id",authorIds):{data:[],error:null};if(authorError)throw authorError;const byAuthor=new Map((authors??[]).map((row:any)=>[row.id,row]));return fresh(ids.map(id=>byId.get(id)).filter(Boolean).map((row:any)=>({...row,author:byAuthor.get(row.author_id)})))}
export async function GET(_request:Request,{params}:{params:Promise<{handle:string}>}){
 const {handle:raw}=await params,handle=decodeURIComponent(raw).replace(/^@/,"").toLowerCase();
 if(!/^[a-z0-9]{4,8}$/.test(handle))return NextResponse.json({error:"That username is not valid."},{status:400});
 const db=await createClient(),{data:{user}}=await db.auth.getUser();
 const {data:profile,error:profileError}=await db.from("community_profiles").select("id,handle,display_name,avatar_url,bio,created_at").eq("handle",handle).maybeSingle();
 if(profileError){console.error("Community profile lookup failed",profileError.message);return NextResponse.json({error:"Profile could not be loaded."},{status:503})}
 if(!profile)return NextResponse.json({error:"This Tidelight profile could not be found."},{status:404});
 try{
  const [{data:ownRows,error:ownError},{data:repostRows,error:repostError},{data:likeRows,error:likeError}]=await Promise.all([
   db.from("community_posts").select("id").eq("author_id",profile.id).is("reply_to",null).order("created_at",{ascending:false}).limit(100),
   db.from("community_reactions").select("post_id,created_at").eq("user_id",profile.id).eq("kind","repost").order("created_at",{ascending:false}).limit(100),
   db.from("community_reactions").select("post_id,created_at").eq("user_id",profile.id).eq("kind","like").order("created_at",{ascending:false}).limit(100)
  ]);
  if(ownError||repostError||likeError)throw ownError??repostError??likeError;
  const ownIds=(ownRows??[]).map((x:any)=>x.id),repostIds=(repostRows??[]).map((x:any)=>x.post_id),likeIds=(likeRows??[]).map((x:any)=>x.post_id);
  const [posts,reposts,likes]=await Promise.all([fetchPosts(db,ownIds),fetchPosts(db,repostIds),fetchPosts(db,likeIds)]);
  const isOwner=user?.id===profile.id;let saved:any[]=[];
  if(isOwner){const {data,error}=await db.from("community_bookmarks").select("post_id,created_at").eq("user_id",user!.id).order("created_at",{ascending:false}).limit(100);if(error)throw error;saved=await fetchPosts(db,(data??[]).map((x:any)=>x.post_id))}
  const ordered=(items:any[],ids:string[])=>{const map=new Map(items.map((item:any)=>[item.id,item]));return ids.map(id=>map.get(id)).filter(Boolean)};
  return NextResponse.json({profile,isOwner,posts:ordered(posts,ownIds),reposts:ordered(reposts,repostIds),likes:ordered(likes,likeIds),saved});
 }catch(error){console.error("Community profile activity failed",error instanceof Error?error.message:"unknown error");return NextResponse.json({error:"Profile activity is temporarily unavailable."},{status:503})}
}
