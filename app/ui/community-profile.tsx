"use client";
import Link from "next/link";
import Image from "next/image";
import {useEffect,useState} from "react";
import "../community/community.css";
type Media={url:string;kind:"image"|"video"|"audio"|"pdf";name:string};
type Entry={id:string;body:string;symbol:string|null;stance:string;source_url:string|null;media:Media[];mediaExpired?:boolean;created_at:string;author:{handle:string;display_name:string;avatar_url:string|null}};
type Profile={handle:string;display_name:string;avatar_url:string|null;bio:string;show_studio_stats?:boolean};
type StudioStats={researchRuns:number;backtests:number;watchlistItems:number;paperDecisions:number};
type Data={studioStats:StudioStats|null;profile:Profile;isOwner:boolean;posts:Entry[];reposts:Entry[];likes:Entry[];saved:Entry[]};
type Tab="posts"|"reposts"|"likes"|"saved";
function downloadUrl(item:Media){const url=new URL(item.url);url.searchParams.set("download",item.name);return url.toString()}
export default function CommunityProfile({handle}:{handle:string}){
 const [data,setData]=useState<Data|null>(null),[tab,setTab]=useState<Tab>("posts"),[loading,setLoading]=useState(true),[error,setError]=useState(""),[savingStats,setSavingStats]=useState(false);
 useEffect(()=>{let active=true;fetch("/api/community/profile/"+encodeURIComponent(handle),{cache:"no-store"}).then(async response=>{const result=await response.json();if(!response.ok)throw new Error(result.error??"Profile unavailable.");if(active){setData(result);if(result.isOwner&&new URLSearchParams(window.location.search).get("tab")==="saved")setTab("saved")}}).catch(cause=>{if(active)setError(cause instanceof Error?cause.message:"Profile unavailable.")}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[handle]);
 async function toggleStudioStats(){if(!data||savingStats)return;setSavingStats(true);setError("");try{const response=await fetch("/api/community/profile/"+encodeURIComponent(handle),{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({showStudioStats:!data.profile.show_studio_stats})});const result=await response.json();if(!response.ok)throw new Error(result.error??"Visibility could not be updated.");const refreshed=await fetch("/api/community/profile/"+encodeURIComponent(handle),{cache:"no-store"});const next=await refreshed.json();if(!refreshed.ok)throw new Error(next.error??"Profile could not be refreshed.");setData(next)}catch(cause){setError(cause instanceof Error?cause.message:"Visibility could not be updated.")}finally{setSavingStats(false)}}
 const rows=data?.[tab]??[];
 return <main className="content-wrap inner-page community-page community-profile-page">
  <Link href="/community" className="community-profile-back">← Research community</Link>
  {error&&data?<p className="community-error" role="alert">{error}</p>:null}
  {loading?<section className="community-profile-hero">Opening research profile…</section>:error&&!data?<section className="community-error" role="alert">{error}</section>:data?<><section className="community-profile-hero">
   <div className="community-profile-cover"><span>FOLLOW THE EVIDENCE.</span></div>
   <div className="community-profile-top"><div className="community-profile-avatar">{data.profile.avatar_url?<Image unoptimized width={94} height={94} src={data.profile.avatar_url} alt=""/>:data.profile.display_name.slice(0,1)}</div><div><span className="eyebrow small-eyebrow">TIDELIGHT / RESEARCH PROFILE</span><h1>{data.profile.display_name}</h1><p>@{data.profile.handle}</p></div>{data.isOwner?<Link className="community-primary" href="/settings#profile">Edit profile ↗</Link>:<Link className="community-primary" href={"/community/messages?handle="+encodeURIComponent(handle)}>Message ↗</Link>}</div>
   <p className="community-profile-bio">{data.profile.bio||"Following the evidence across US equities and Reality rTokens."}</p>
   <div className="community-profile-stats"><span><b>{data.posts.length}</b> notes</span><span><b>{data.reposts.length}</b> reposts</span><span><b>{data.likes.length}</b> liked</span></div>
   {data.isOwner?<div className="community-studio-sharing"><div><b>Your studio, on your terms.</b><p>Share activity totals on your public profile. Research content, trades, and account balances stay private.</p></div><button type="button" className="community-studio-toggle" aria-pressed={!!data.profile.show_studio_stats} disabled={savingStats} onClick={()=>void toggleStudioStats()}>{savingStats?"Updating…":data.profile.show_studio_stats?"Public stats on":"Share studio stats"}</button></div>:null}
   {data.studioStats?<section className="community-studio-stats" aria-label="Public studio activity">{([['researchRuns','Research runs'],['backtests','Lab backtests'],['watchlistItems','Assets followed'],['paperDecisions','Paper decisions']] as [keyof StudioStats,string][]).map(([key,label])=><div key={key}><b>{data.studioStats![key].toLocaleString()}</b><span>{label}</span></div>)}<small>Activity totals · paper decisions are simulated, not investment performance.</small></section>:null}
  </section>
  <nav className="community-profile-tabs" aria-label="Profile activity">{(["posts","reposts","likes",...(data.isOwner?["saved"]:[])] as Tab[]).map(key=><button type="button" key={key} className={tab===key?"active":""} onClick={()=>setTab(key)}>{key==="posts"?"Notes":key==="reposts"?"Reposts":key==="likes"?"Likes":"Saved"}</button>)}</nav>
  {tab==="saved"?<p className="community-profile-private">Saved posts are private to your account.</p>:null}
  <section className="community-profile-feed">{rows.length?rows.map((post,index)=><article className="community-profile-post" key={post.id+"-"+index}>
    {tab==="reposts"?<span className="community-profile-context">↻ REPOSTED</span>:tab==="likes"?<span className="community-profile-context">♥ LIKED</span>:null}
    <div className="community-post-head"><div className="community-avatar">{post.author?.avatar_url?<Image unoptimized width={94} height={94} src={post.author.avatar_url} alt=""/>:(post.author?.display_name??"T").slice(0,1)}</div><div className="community-author"><Link href={"/community/"+encodeURIComponent(post.author?.handle??"")}><b>{post.author?.display_name??"Tidelight member"}</b></Link><small>@{post.author?.handle} · {new Date(post.created_at).toLocaleDateString()}</small></div>{post.symbol?<span className="community-symbol">{post.symbol}</span>:null}</div>
    <div className="community-post-copy"><span className={"community-stance "+post.stance}>{post.stance.toUpperCase()}</span><p>{post.body}</p>{post.source_url?<a className="community-evidence" href={post.source_url} target="_blank" rel="noreferrer">Evidence link ↗</a>:null}</div>
    {post.media?.length?<div className="community-media-grid">{post.media.map((item,i)=><div className={"community-media-item "+item.kind} key={i}>{item.kind==="image"?<Image unoptimized width={1200} height={800} src={item.url} alt={item.name}/>:item.kind==="video"?<video controls preload="metadata" src={item.url}/>:item.kind==="audio"?<audio controls preload="metadata" src={item.url}/>:<a className="community-pdf" href={item.url} target="_blank" rel="noreferrer"><span>PDF</span><b>{item.name}</b></a>}<a className="community-download" href={downloadUrl(item)} download={item.name}>↓ Download from Tidelight</a></div>)}</div>:null}
    {post.mediaExpired?<p className="community-media-expired">Attachments were removed after 7 days.</p>:null}
   </article>):<div className="community-empty"><span>✳</span><b>{tab==="saved"?"No saved posts yet.":"Nothing here yet."}</b><p>{tab==="saved"?"Save an issuer or rToken discussion from the community.":"Public activity appears here as this member shares and reacts."}</p></div>}</section>
  </>:null}
 </main>
}