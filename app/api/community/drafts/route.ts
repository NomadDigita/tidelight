import {NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";

const joined="id,body,symbol,stance,source_url,media,created_at,updated_at";
const allowedMime=new Set(["image/jpeg","image/png","image/webp","image/gif","video/mp4","video/webm","application/pdf","audio/mpeg","audio/mp4","audio/wav","audio/ogg","audio/webm","audio/x-m4a"]);
function parseMedia(raw:unknown,userId:string){
 if(!Array.isArray(raw)||raw.length>4)throw new Error("Attach no more than four files.");
 const origin=process.env.NEXT_PUBLIC_SUPABASE_URL?new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin:"";
 let total=0;
 for(const item of raw){
  if(!item||typeof item!=="object"||Array.isArray(item))throw new Error("One of the attachments is invalid.");
  const value=item as Record<string,unknown>;
  try{const url=new URL(typeof value.url==="string"?value.url:"");if(!origin||url.origin!==origin||url.protocol!=="https:"||!url.pathname.includes("/storage/v1/object/public/community-media/"+userId+"/"))throw Error()}catch{throw new Error("One of the attachments is invalid.")}
  if(!allowedMime.has(typeof value.mime==="string"?value.mime:"")||!(["image","video","audio","pdf"] as unknown[]).includes(value.kind)||typeof value.name!=="string"||typeof value.size!=="number"||!Number.isSafeInteger(value.size)||value.size<1||value.size>25*1024*1024)throw new Error("One of the attachments is invalid.");
  total+=value.size;
 }
 if(total>60*1024*1024)throw new Error("Attachments must total 60 MB or less.");
 return raw;
}
function parseDraft(body:Record<string,unknown>,userId:string){
 const text=typeof body.body==="string"?body.body.trim():"",symbol=typeof body.symbol==="string"?body.symbol.trim().toUpperCase():"",sourceUrl=typeof body.sourceUrl==="string"?body.sourceUrl.trim():"";
 if(!text||text.length>1800)throw new Error("Write a note between 1 and 1,800 characters before saving it.");
 if(symbol&&!/^[A-Z0-9]{2,32}$/.test(symbol))throw new Error("Use an rToken pair or US stock ticker.");
 if(sourceUrl){try{const url=new URL(sourceUrl);if(url.protocol!=="https:")throw Error()}catch{throw new Error("Evidence links must use HTTPS.")}}
 const stance=["watching","bullish","bearish","question","neutral"].includes(typeof body.stance==="string"?body.stance:"")?body.stance:"watching";
 return {body:text,symbol:symbol||null,source_url:sourceUrl||null,stance,media:parseMedia(body.media??[],userId)};
}
async function readBody(request:Request){try{const value:unknown=await request.json();if(!value||typeof value!=="object"||Array.isArray(value))throw Error();return value as Record<string,unknown>}catch{throw new Error("Send a valid research note.")}}

export async function GET(){
 const db=await createClient();const {data:{user}}=await db.auth.getUser();if(!user)return NextResponse.json({error:"Sign in to view saved drafts."},{status:401});
 const {data,error}=await db.from("community_post_drafts").select(joined).eq("user_id",user.id).order("updated_at",{ascending:false}).limit(50);
 if(error)return NextResponse.json({error:"Drafts could not be loaded."},{status:503});
 return NextResponse.json({drafts:data??[]});
}
export async function POST(request:Request){
 const db=await createClient();const {data:{user}}=await db.auth.getUser();if(!user)return NextResponse.json({error:"Sign in to save a draft."},{status:401});
 try{
  const body=await readBody(request),draft=parseDraft(body,user.id);
  if(typeof body.id==="string"){
   const {data,error}=await db.from("community_post_drafts").update({...draft,updated_at:new Date().toISOString()}).eq("id",body.id).eq("user_id",user.id).select(joined).maybeSingle();
   if(error)return NextResponse.json({error:"Draft could not be saved."},{status:503});if(!data)return NextResponse.json({error:"Draft not found."},{status:404});return NextResponse.json({draft:data});
  }
  const {data,error}=await db.from("community_post_drafts").insert({user_id:user.id,...draft}).select(joined).single();
  if(error)return NextResponse.json({error:"Draft could not be saved."},{status:503});return NextResponse.json({draft:data},{status:201});
 }catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Draft could not be saved."},{status:400})}
}
export async function DELETE(request:Request){
 const db=await createClient();const {data:{user}}=await db.auth.getUser();if(!user)return NextResponse.json({error:"Sign in to manage drafts."},{status:401});
 let body:Record<string,unknown>;try{body=await readBody(request)}catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Choose a draft."},{status:400})}
 if(typeof body.id!=="string")return NextResponse.json({error:"Choose a draft."},{status:400});
 const {data,error}=await db.from("community_post_drafts").delete().eq("id",body.id).eq("user_id",user.id).select("id,media").maybeSingle();
 if(error)return NextResponse.json({error:"Draft could not be deleted."},{status:503});if(!data)return NextResponse.json({error:"Draft not found."},{status:404});
 if(body.keepMedia===true)return NextResponse.json({deleted:true});
 const origin=process.env.NEXT_PUBLIC_SUPABASE_URL?new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin:"";
 const paths=(Array.isArray(data.media)?data.media:[]).flatMap(item=>{if(!item||typeof item!=="object"||!("url" in item)||typeof item.url!=="string")return [];try{const url=new URL(item.url),prefix="/storage/v1/object/public/community-media/"+user.id+"/";return origin&&url.origin===origin&&url.pathname.startsWith(prefix)?[decodeURIComponent(url.pathname.slice(prefix.length))]:[]}catch{return []}});
 if(paths.length){const {error:storageError}=await db.storage.from("community-media").remove(paths);if(storageError)console.error("Community draft media cleanup failed",storageError.message)}
 return NextResponse.json({deleted:true});
}
