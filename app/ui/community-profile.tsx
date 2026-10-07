"use client";
import Link from "next/link";
import {useEffect,useState} from "react";
import "../community/community.css";
type Media={url:string;kind:"image"|"video"|"audio"|"pdf";name:string};
type Entry={id:string;body:string;symbol:string|null;stance:string;source_url:string|null;media:Media[];mediaExpired?:boolean;created_at:string;author:{handle:string;display_name:string;avatar_url:string|null}};
type Profile={handle:string;display_name:string;avatar_url:string|null;bio:string};
type Data={profile:Profile;isOwner:boolean;posts:Entry[];reposts:Entry[];likes:Entry[];saved:Entry[]};
type Tab="posts"|"reposts"|"likes"|"saved";
function downloadUrl(item:Media){const url=new URL(item.url);url.searchParams.set("download",item.name);return url.toString()}
export default function CommunityProfile({handle}:{handle:string}){
 const [data,setData]=useState<Data|null>(null),[tab,setTab]=useState<Tab>("posts"),[loading,setLoading]=useState(true),[error,setError]=useState("");
 useEffect(()=>{let active=true;fetch("/api/community/profile/"+encodeURIComponent(handle),{cache:"no-store"}).then(async response=>{const result=await response.json();if(!response.ok)throw new Error(result.error??"Profile unavailable.");if(active)setData(result)}).catch(cause=>{if(active)setError(cause instanceof Error?cause.message:"Profile unavailable.")}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[handle]);
 const rows=data?.[tab]??[];
 return <main className="content-wrap inner-page community-page community-profile-page">
  <Link href="/community" className="community-profile-back">← Research community</Link>
  {loading?<section className="community-profile-hero">Opening research profile…</section>:error?<section className="community-error" role="alert">{error}</section>:data?<><section className="community-profile-hero">
   <div className="community-profile-top"><div className="community-profile-avatar">{data.profile.avatar_url?<img src={data.profile.avatar_url} alt=""/>:data.profile.display_name.slice(0,1)}</div><div><span className="eyebrow small-eyebrow">TIDELIGHT / RESEARCH PROFILE</span><h1>{data.profile.display_name}</h1><p>@{data.profile.handle}</p></div>{data.isOwner?<Link className="community-primary" href="/settings#profile">Edit profile ↗</Link>:null}</div>
   <p className="community-profile-bio">{data.profile.bio||"Following the evidence across US equities and Reality rTokens."}</p>
   <div className="community-profile-stats"><span><b>{data.posts.length}</b> notes</span><span><b>{data.reposts.length}</b> reposts</span><span><b>{data.likes.length}</b> liked</span></div>
  </section>
  <nav className="community-profile-tabs" aria-label="Profile activity">{(["posts","reposts","likes",...(data.isOwner?["saved"]:[])] as Tab[]).map(key=><button type="button" key={key} className={tab===key?"active":""} onClick={()=>setTab(key)}>{key==="posts"?"Notes":key==="reposts"?"Reposts":key==="likes"?"Likes":"Saved"}</button>)}</nav>
  {tab==="saved"?<p className="community-profile-private">Saved posts are private to your account.</p>:null}
  <section className="community-profile-feed">{rows.length?rows.map((post,index)=><article className="community-profile-post" key={post.id+"-"+index}>
    {tab==="reposts"?<span className="community-profile-context">↻ REPOSTED</span>:tab==="likes"?<span className="community-profile-context">♥ LIKED</span>:null}
    <div className="community-post-head"><div className="community-avatar">{post.author?.avatar_url?<img src={post.author.avatar_url} alt=""/>:(post.author?.display_name??"T").slice(0,1)}</div><div className="community-author"><Link href={"/community/"+encodeURIComponent(post.author?.handle??"")}><b>{post.author?.display_name??"Tidelight member"}</b></Link><small>@{post.author?.handle} · {new Date(post.created_at).toLocaleDateString()}</small></div>{post.symbol?<span className="community-symbol">{post.symbol}</span>:null}</div>
    <div className="community-post-copy"><span className={"community-stance "+post.stance}>{post.stance.toUpperCase()}</span><p>{post.body}</p>{post.source_url?<a className="community-evidence" href={post.source_url} target="_blank" rel="noreferrer">Evidence link ↗</a>:null}</div>
    {post.media?.length?<div className="community-media-grid">{post.media.map((item,i)=><div className={"community-media-item "+item.kind} key={i}>{item.kind==="image"?<img src={item.url} alt={item.name}/>:item.kind==="video"?<video controls preload="metadata" src={item.url}/>:item.kind==="audio"?<audio controls preload="metadata" src={item.url}/>:<a className="community-pdf" href={item.url} target="_blank" rel="noreferrer"><span>PDF</span><b>{item.name}</b></a>}<a className="community-download" href={downloadUrl(item)} download={item.name}>↓ Download from Tidelight</a></div>)}</div>:null}
    {post.mediaExpired?<p className="community-media-expired">Attachments were removed after 7 days.</p>:null}
   </article>):<div className="community-empty"><span>✳</span><b>{tab==="saved"?"No saved posts yet.":"Nothing here yet."}</b><p>{tab==="saved"?"Save an issuer or rToken discussion from the community.":"Public activity appears here as this member shares and reacts."}</p></div>}</section>
  </>:null}
 </main>
}