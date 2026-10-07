import {NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";
const joined="id,author_id,body,symbol,stance,source_url,media,reply_to,quote_post_id,created_at,author:community_profiles!community_posts_author_id_fkey(id,handle,display_name,avatar_url),quoted:community_posts!community_posts_quote_post_id_fkey(id,body,symbol,author:community_profiles!community_posts_author_id_fkey(handle,display_name))";
function normalize(value:string){let s=value.toUpperCase().replace(/[^A-Z0-9]/g,"").replace(/USDT$/,"");if(/^R[A-Z]{2,6}$/.test(s))s=s.slice(1);return s}
function mentions(question:string,ticker:string){const aliases:Record<string,string[]>={NVDA:["NVIDIA"],TSLA:["TESLA"],AAPL:["APPLE"],MSFT:["MICROSOFT"],AMZN:["AMAZON"],GOOGL:["GOOGLE","ALPHABET"],META:["FACEBOOK"],SPY:["S&P 500","SP500"]};const q=question.toUpperCase();return [ticker,...(aliases[ticker]??[])].some(term=>q.includes(term))}
export async function GET(request:Request){
 const db=await createClient();const {data:{user}}=await db.auth.getUser();const params=new URL(request.url).searchParams,threadId=params.get("thread");
 const {data:blocked}=user?await db.from("community_blocks").select("blocked_id").eq("blocker_id",user.id):{data:[]};const blockedIds=(blocked??[]).map(x=>x.blocked_id);
 let query=db.from("community_posts").select(joined).order("created_at",{ascending:false}).limit(threadId?60:120);
 query=threadId?query.eq("reply_to",threadId):query.is("reply_to",null);
 const {data:rows,error}=await query;if(error){console.error("Community feed query failed",error.message);return NextResponse.json({error:"The research feed is temporarily unavailable."},{status:503});}
 const visible=(rows??[]).filter((p:any)=>!blockedIds.includes(p.author?.id)),ids=visible.map((p:any)=>p.id);
 const [{data:reactions},{data:replies},{data:mine},{data:savedMine}]=await Promise.all([
  ids.length?db.from("community_reactions").select("post_id,kind").in("post_id",ids):Promise.resolve({data:[]}),
  ids.length?db.from("community_posts").select("reply_to").in("reply_to",ids):Promise.resolve({data:[]}),
  user&&ids.length?db.from("community_reactions").select("post_id,kind").eq("user_id",user.id).in("post_id",ids):Promise.resolve({data:[]}),
  user&&ids.length?db.from("community_bookmarks").select("post_id").eq("user_id",user.id).in("post_id",ids):Promise.resolve({data:[]})
 ]);
 const interests=new Map<string,{score:number;reason:string}>(),add=(raw:string|null|undefined,score:number,reason:string)=>{if(!raw)return;const key=normalize(raw);if(key.length<2)return;const old=interests.get(key);if(!old||score>old.score)interests.set(key,{score,reason})};
 if(user&&!threadId){
  const [watch,research,strategy,recentReactions]=await Promise.all([
   db.from("watchlist_items").select("symbol").eq("user_id",user.id).limit(100),
   db.from("research_runs").select("question").eq("user_id",user.id).order("created_at",{ascending:false}).limit(30),
   db.from("strategy_backtest_runs").select("symbol").eq("user_id",user.id).order("created_at",{ascending:false}).limit(30),
   db.from("community_reactions").select("post_id").eq("user_id",user.id).order("created_at",{ascending:false}).limit(50)
  ]);
  for(const row of watch.data??[])add(row.symbol,12,"Because this issuer or rToken is on your watchlist");
  for(const row of strategy.data??[])add(row.symbol,7,"Related to your recent Strategy Lab runs");
  const tickers=["NVDA","TSLA","AAPL","MSFT","AMZN","GOOGL","META","AMD","SPY","WMT","JPM","NFLX"];
  for(const row of research.data??[])for(const ticker of tickers)if(mentions(row.question,ticker))add(ticker,9,"Related to your recent research");
  const reactionIds=(recentReactions.data??[]).map(x=>x.post_id);
  if(reactionIds.length){const {data:reactedPosts}=await db.from("community_posts").select("symbol").in("id",reactionIds);for(const row of reactedPosts??[])add(row.symbol,6,"Related to posts you recently liked or reposted")}
 }
 const posts=visible.map((post:any)=>{
  const ticker=post.symbol?normalize(post.symbol):"",interest=interests.get(ticker),engagement=(reactions??[]).filter(x=>x.post_id===post.id).length+(replies??[]).filter(x=>x.reply_to===post.id).length;
  const mediaExpired=Date.now()-Date.parse(post.created_at)>7*24*60*60*1000;
  return {...post,media:mediaExpired?[]:(post.media??[]),mediaExpired:mediaExpired&&(post.media??[]).length>0,reason:interest?.reason??null,feedScore:(interest?.score??0)+Math.log1p(engagement)*1.5+Math.max(0,36-(Date.now()-Date.parse(post.created_at))/3600000)/12,likes:(reactions??[]).filter(x=>x.post_id===post.id&&x.kind==="like").length,reposts:(reactions??[]).filter(x=>x.post_id===post.id&&x.kind==="repost").length,replies:(replies??[]).filter(x=>x.reply_to===post.id).length,liked:(mine??[]).some(x=>x.post_id===post.id&&x.kind==="like"),reposted:(mine??[]).some(x=>x.post_id===post.id&&x.kind==="repost"),saved:(savedMine??[]).some(x=>x.post_id===post.id)};
 });
 if(!threadId)posts.sort((a:any,b:any)=>b.feedScore-a.feedScore);
 return NextResponse.json({posts});
}
export async function POST(request:Request){
 const db=await createClient();const {data:{user}}=await db.auth.getUser();if(!user)return NextResponse.json({error:"Sign in to join the Tidelight community."},{status:401});
 let body:any;try{body=await request.json()}catch{return NextResponse.json({error:"Send a valid action."},{status:400})}
 if(body.action==="bookmark"){
  if(typeof body.postId!=="string")return NextResponse.json({error:"Choose a post first."},{status:400});
  const {data:existing}=await db.from("community_bookmarks").select("post_id").eq("user_id",user.id).eq("post_id",body.postId).maybeSingle();
  if(existing){const {error}=await db.from("community_bookmarks").delete().eq("user_id",user.id).eq("post_id",body.postId);if(error)return NextResponse.json({error:"Could not remove that saved post."},{status:400});return NextResponse.json({active:false})}
  const {error}=await db.from("community_bookmarks").insert({user_id:user.id,post_id:body.postId});if(error)return NextResponse.json({error:"Could not save that post."},{status:400});return NextResponse.json({active:true});
 }
 if(["like","repost"].includes(body.action)){
  if(typeof body.postId!=="string")return NextResponse.json({error:"Choose a post first."},{status:400});
  const kind=body.action;const {data:existing}=await db.from("community_reactions").select("post_id").eq("user_id",user.id).eq("post_id",body.postId).eq("kind",kind).maybeSingle();
  if(existing){await db.from("community_reactions").delete().eq("user_id",user.id).eq("post_id",body.postId).eq("kind",kind);return NextResponse.json({active:false})}
  const {error}=await db.from("community_reactions").insert({user_id:user.id,post_id:body.postId,kind});if(error)return NextResponse.json({error:"That action could not be saved. Refresh and try again."},{status:400});return NextResponse.json({active:true});
 }
 if(body.action==="report"||body.action==="block"){
  if(typeof body.postId!=="string")return NextResponse.json({error:"Choose a post first."},{status:400});
  const {data:target}=await db.from("community_posts").select("author_id").eq("id",body.postId).maybeSingle();
  if(!target)return NextResponse.json({error:"That post is no longer available."},{status:404});
  if(body.action==="block"){
    if(target.author_id===user.id)return NextResponse.json({error:"You cannot mute your own profile."},{status:400});
    const {error}=await db.from("community_blocks").upsert({blocker_id:user.id,blocked_id:target.author_id},{onConflict:"blocker_id,blocked_id"});
    if(error)return NextResponse.json({error:"Could not mute this member."},{status:400});
    return NextResponse.json({muted:true});
  }
  const reason=["spam","harassment","misinformation","other"].includes(body.reason)?body.reason:"other";
  const {error}=await db.from("community_reports").insert({reporter_id:user.id,post_id:body.postId,reported_user_id:target.author_id,reason});
  if(error)return NextResponse.json({error:"Could not submit the report."},{status:400});
  return NextResponse.json({reported:true});
 }
 const text=typeof body.body==="string"?body.body.trim():"",symbol=typeof body.symbol==="string"?body.symbol.trim().toUpperCase():"",sourceUrl=typeof body.sourceUrl==="string"?body.sourceUrl.trim():"";
 if(!text||text.length>1800)return NextResponse.json({error:"Write a note between 1 and 1,800 characters."},{status:400});
 if(symbol&&!/^[A-Z0-9]{2,32}$/.test(symbol))return NextResponse.json({error:"Use an rToken pair or US stock ticker."},{status:400});
 if(sourceUrl){try{const u=new URL(sourceUrl);if(u.protocol!=="https:")throw Error()}catch{return NextResponse.json({error:"Evidence links must use HTTPS."},{status:400})}}
 const {data:profile}=await db.from("community_profiles").select("id").eq("id",user.id).maybeSingle();if(!profile)return NextResponse.json({error:"Complete your username and profile in Settings before posting."},{status:409});
 const media=Array.isArray(body.media)?body.media:[];if(media.length>4)return NextResponse.json({error:"Attach no more than four files."},{status:400});const mediaTotal=media.reduce((total:number,item:any)=>total+(Number(item?.size)||0),0);if(mediaTotal>60*1024*1024)return NextResponse.json({error:"Attachments must total 60 MB or less."},{status:400});const allowedMime=new Set(["image/jpeg","image/png","image/webp","image/gif","video/mp4","video/webm","application/pdf","audio/mpeg","audio/mp4","audio/wav","audio/ogg","audio/webm","audio/x-m4a"]);for(const item of media){try{const u=new URL(item.url),supabaseOrigin=process.env.NEXT_PUBLIC_SUPABASE_URL?new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin:"";if(u.protocol!=="https:"||!supabaseOrigin||u.origin!==supabaseOrigin||!u.pathname.includes("/storage/v1/object/public/community-media/"+user.id+"/")||!allowedMime.has(item.mime)||!["image","video","audio","pdf"].includes(item.kind)||!Number.isSafeInteger(item.size)||item.size<1||item.size>25*1024*1024)throw Error()}catch{return NextResponse.json({error:"One of the uploads is invalid. Reattach it and try again."},{status:400})}}
 const insert={author_id:user.id,body:text,media,symbol:symbol||null,stance:["watching","bullish","bearish","question","neutral"].includes(body.stance)?body.stance:"watching",source_url:sourceUrl||null,reply_to:typeof body.replyTo==="string"?body.replyTo:null,quote_post_id:typeof body.quotePostId==="string"?body.quotePostId:null};
 const {data:post,error}=await db.from("community_posts").insert(insert).select(joined).single();if(error)return NextResponse.json({error:"The note could not be published. Check the asset and try again."},{status:400});return NextResponse.json({post},{status:201});
}
