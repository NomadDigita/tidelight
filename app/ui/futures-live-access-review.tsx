"use client";
import { useCallback,useEffect,useState } from "react";

type RequestItem={id:string;user_id:string;email:string;status:string;terms_version:string;accepted_terms:Record<string,boolean>;requested_at:string};
const termLabels:Record<string,string>={market_risk:"Market and liquidation risk",liquidation:"Margin, fees and execution",api_permissions:"Exchange account and permissions",key_security:"Credential security",manual_orders:"Individual order responsibility"};
export default function FuturesLiveAccessReview(){
  const [requests,setRequests]=useState<RequestItem[]>([]);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState("");
  const [error,setError]=useState("");
  const [note,setNote]=useState<Record<string,string>>({});
  const load=useCallback(async()=>{setLoading(true);setError("");try{const response=await fetch("/api/admin/futures-live-access",{cache:"no-store"});const result=await response.json() as {requests?:RequestItem[];error?:string};if(!response.ok)throw new Error(result.error??"Review queue unavailable.");setRequests(result.requests??[]);}catch(cause){setError(cause instanceof Error?cause.message:"Review queue unavailable.");}finally{setLoading(false);}},[]);
  useEffect(()=>{
    let active=true;
    fetch("/api/admin/futures-live-access",{cache:"no-store"}).then(async response=>{
      const result=await response.json() as {requests?:RequestItem[];error?:string};
      if(!response.ok)throw new Error(result.error??"Review queue unavailable.");
      if(active)setRequests(result.requests??[]);
    }).catch(cause=>{if(active)setError(cause instanceof Error?cause.message:"Review queue unavailable.");}).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[]);
  async function review(item:RequestItem,status:"approved"|"rejected"){
    setBusy(item.user_id);setError("");try{const response=await fetch("/api/admin/futures-live-access",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({userId:item.user_id,status,note:note[item.user_id]??""})});const result=await response.json() as {error?:string};if(!response.ok)throw new Error(result.error??"Could not save the review.");setRequests(current=>current.filter(request=>request.user_id!==item.user_id));}catch(cause){setError(cause instanceof Error?cause.message:"Could not save the review.");}finally{setBusy("");}
  }
  return <section className="futures-review-queue" aria-label="Futures live access review queue">
    <header><div><span className="eyebrow small-eyebrow">TIDELIGHT OPERATIONS · PRIVATE</span><h1>Futures access review</h1><p>Verify the user’s Bitget futures connection and accepted risk terms before granting live access.</p></div><button type="button" onClick={()=>void load()} disabled={loading||!!busy}>Refresh queue</button></header>
    {error?<p className="futures-review-error" role="alert">{error}</p>:null}
    {loading?<p className="futures-review-empty">Loading pending requests…</p>:requests.length?requests.map(item=><article className="futures-review-card" key={item.id}>
      <div className="futures-review-card-head"><div><span className="eyebrow small-eyebrow">PENDING · {item.terms_version}</span><h2>{item.email}</h2></div><time dateTime={item.requested_at}>{new Date(item.requested_at).toLocaleString()}</time></div>
      <ul>{Object.entries(item.accepted_terms).map(([key,accepted])=><li key={key}><span>{accepted?"✓":"—"}</span>{termLabels[key]??key.replaceAll("_"," ")}</li>)}</ul>
      <label className="futures-review-note">Decision note <textarea maxLength={500} value={note[item.user_id]??""} onChange={event=>setNote(value=>({...value,[item.user_id]:event.target.value}))} placeholder="Optional. Include a concise reason if declining."/></label>
      <div className="futures-review-actions"><button type="button" className="reject" disabled={!!busy} onClick={()=>void review(item,"rejected")}>{busy===item.user_id?"Saving…":"Decline"}</button><button type="button" className="approve" disabled={!!busy||Object.values(item.accepted_terms).some(value=>!value)} onClick={()=>void review(item,"approved")}>{busy===item.user_id?"Saving…":"Approve live access"}</button></div>
    </article>):<div className="futures-review-empty"><b>Queue clear</b><span>No pending live futures requests.</span></div>}
  </section>;
}
