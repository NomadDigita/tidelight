'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import AssetSearchPicker from '@/app/ui/asset-search-picker';
import { ALPHA_STRATEGIES } from '@/lib/backtest';
import { MAX_NIGHTWATCH_SCHEDULES, type NightwatchSchedule } from '@/lib/nightwatch-schedules';
type Asset = { symbol: string; name: string; ticker: string | null; lastPrice: number; change24h: number | null; logoUrl: string | null };
type Execution = { id:string; schedule_id:string|null; scheduled_for:string; status:string; outcome:string|null; error_code:string|null; attempts:number; config:{label:string;symbol:string} };
type Draft = Omit<NightwatchSchedule,'id'|'next_run_at'> & {id?:string};
const stamp=(value:string)=>new Date(value).toLocaleString(undefined,{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit',timeZoneName:'short'});
export default function NightwatchSchedules({signedIn,assets,symbol,playbookKey,researchRunId}:{signedIn:boolean;assets:Asset[];symbol:string;playbookKey:string;researchRunId:string|null}) {
  const [schedules,setSchedules]=useState<NightwatchSchedule[]>([]);
  const [executions,setExecutions]=useState<Execution[]>([]);
  const [draft,setDraft]=useState<Draft|null>(null);
  const [loading,setLoading]=useState(signedIn);
  const [busy,setBusy]=useState(false);
  const [ready,setReady]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const zones=useMemo(()=>['UTC',...Intl.supportedValuesOf('timeZone')],[]);
  const load=useCallback(async()=>{
    if(!signedIn)return;
    try {
      const response=await fetch('/api/nightwatch/schedules');
      const data=await response.json();
      if(!response.ok)throw new Error(data.error ?? 'Schedules are unavailable.');
      setSchedules(data.schedules);setExecutions(data.executions);setReady(data.scheduler_available===true);
    }catch(cause){setError(cause instanceof Error?cause.message:'Schedules are unavailable.');}
    finally{setLoading(false);}
  },[signedIn]);
  useEffect(()=>{void Promise.resolve().then(load);},[load]);
  async function save(value:Draft) {
    setBusy(true);setError('');setNotice('');
    try {
      const response=await fetch('/api/nightwatch/schedules',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(value)});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error ?? 'Could not save schedule.');
      setDraft(null);setNotice(value.id?'Schedule updated.':'Daily schedule created.');await load();
    }catch(cause){setError(cause instanceof Error?cause.message:'Could not save schedule.');}
    finally{setBusy(false);}
  }
  async function remove(id:string){
    setBusy(true);setError('');
    try{
      const response=await fetch(`/api/nightwatch/schedules?id=${encodeURIComponent(id)}`,{method:'DELETE'});
      if(!response.ok)throw new Error('Could not remove schedule.');
      setNotice('Schedule removed. Its execution history is retained.');await load();
    }catch(cause){setError(cause instanceof Error?cause.message:'Could not remove schedule.');}
    finally{setBusy(false);}
  }
  function create(){setError('');setDraft({label:'Market review',symbol,local_time:'09:00:00',time_zone:Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',playbook_key:playbookKey,enabled:true,research_run_id:researchRunId});}
  return <section className="nw-schedules nw-panel" aria-labelledby="nw-schedules-title">
    <div className="nw-schedules-header"><div><span className="eyebrow small-eyebrow">YOUR DAILY RHYTHM</span><h2 id="nw-schedules-title">Markets on your schedule.</h2><p>Choose a different time, Reality market, and playbook for each daily review.</p></div><div className="nw-schedules-heading-actions"><span>{schedules.length} / {MAX_NIGHTWATCH_SCHEDULES} schedules</span><button type="button" className="nw-secondary-button" disabled={!signedIn||loading||busy||schedules.length>=MAX_NIGHTWATCH_SCHEDULES} onClick={create}>+ Add schedule</button></div></div>
    <div className="nw-schedules-context"><span className={`nw-state-dot${ready?'':' paused'}`}/><p>{!signedIn?'Sign in to create private daily paper schedules.':loading?'Loading your schedule…':ready?'Scheduler connected · due schedules are checked every minute.':'Scheduler awaiting activation. You can save schedules; automatic checks begin when the worker is connected.'}</p></div>
    <p className="nw-schedules-limits">Up to 10 scheduled reviews per account per UTC day. Enter any daily time, including seconds. Supabase Cron checks once per minute; reviews start on the first poll after their selected time and may wait longer when several schedules are queued. Each schedule runs once per local date; later edits take effect the next day. Reviews use completed 4H candles; a candle already reviewed reuses its existing decision. Pausing Nightwatch skips every schedule.</p>
    {error?<div className="strategy-error" role="alert">{error} <button type="button" className="nw-inline-link" onClick={()=>void load()} disabled={loading}>Retry loading</button></div>:null}
    {notice?<p className="nw-notice" role="status">{notice}</p>:null}
    {draft?<form className="nw-schedule-editor" onSubmit={event=>{event.preventDefault();void save(draft);}} aria-label={draft.id?'Edit daily schedule':'New daily schedule'}>
      <div className="nw-schedule-editor-title"><h3>{draft.id?'Edit daily review':'New daily review'}</h3><button type="button" className="nw-inline-link" disabled={busy} onClick={()=>setDraft(null)}>Cancel</button></div>
      <label>Schedule name<input required maxLength={64} value={draft.label} onChange={event=>setDraft({...draft,label:event.target.value})}/></label>
      <div className="nw-schedule-market"><AssetSearchPicker label="REALITY MARKET" assets={assets} value={draft.symbol} onChange={value=>setDraft({...draft,symbol:value})} disabled={busy}/></div>
      <label>Daily time<input type="time" required step="1" value={draft.local_time} onChange={event=>setDraft({...draft,local_time:event.target.value})}/></label>
      <label>Timezone<select value={draft.time_zone} onChange={event=>setDraft({...draft,time_zone:event.target.value})}>{[...new Set([...zones,draft.time_zone])].map(zone=><option key={zone} value={zone}>{zone.replaceAll('_',' ')}</option>)}</select></label>
      <label className="nw-schedule-wide">Playbook<select value={draft.playbook_key} onChange={event=>setDraft({...draft,playbook_key:event.target.value})}>{Object.entries(ALPHA_STRATEGIES).map(([key,item])=><option key={key} value={key}>{item.label}</option>)}</select></label>
      <label className="nw-schedule-check"><input type="checkbox" checked={draft.enabled} onChange={event=>setDraft({...draft,enabled:event.target.checked})}/> Enable this daily review</label>
      {(researchRunId||draft.research_run_id)?<label className="nw-schedule-check"><input type="checkbox" checked={Boolean(draft.research_run_id)} onChange={event=>setDraft({...draft,research_run_id:event.target.checked?researchRunId:null})}/> Include the linked research note</label>:null}
      <div className="nw-schedule-footer"><small>Local wall-clock time follows the selected timezone. On daylight-saving transitions, a repeated time runs once; a missing time shifts forward.</small><button type="submit" className="nw-summary-button" disabled={busy}>{busy?'Saving…':'Save daily review'}</button></div>
    </form>:null}
    {!loading&&!schedules.length?<div className="nw-schedules-empty"><b>Your next review starts here.</b><p>Add a time and a market. Nightwatch will keep the review, result, and paper decision in your private history.</p></div>:null}
    <div className="nw-schedule-list">{schedules.map(schedule=><article className="nw-schedule-row" key={schedule.id}>
      <div className="nw-schedule-time"><strong>{schedule.local_time}</strong><span>{schedule.time_zone.replaceAll('_',' ')}</span></div>
      <div className="nw-schedule-detail"><h3>{schedule.label}</h3><p>{schedule.symbol} <span>·</span> {ALPHA_STRATEGIES[schedule.playbook_key as keyof typeof ALPHA_STRATEGIES]?.label ?? schedule.playbook_key}</p><small>{schedule.enabled?`Next · ${stamp(schedule.next_run_at)}`:'Schedule disabled'}{schedule.research_run_id?' · Research linked':''}</small></div>
      <div className="nw-schedule-actions"><button type="button" role="switch" aria-checked={schedule.enabled} aria-label={`${schedule.enabled?'Disable':'Enable'} ${schedule.label}`} disabled={busy} onClick={()=>void save({...schedule,enabled:!schedule.enabled})}>{schedule.enabled?'Enabled':'Disabled'}</button><button type="button" aria-label={`Edit ${schedule.label}`} disabled={busy} onClick={()=>{setDraft(schedule);setError('');}}>Edit</button><button type="button" aria-label={`Remove ${schedule.label}`} disabled={busy} onClick={()=>void remove(schedule.id)}>Remove</button></div>
    </article>)}</div>
    <div className="nw-schedule-history"><div><h3>Schedule activity</h3><button type="button" className="nw-inline-link" onClick={()=>void load()} disabled={!signedIn||loading||busy}>{loading?'Refreshing…':'Refresh'}</button></div>{!executions.length?<p>Completed, skipped, and failed reviews will appear here.</p>:<ul>{executions.slice(0,10).map(item=><li key={item.id}><time dateTime={item.scheduled_for}>{stamp(item.scheduled_for)}<br/>{item.config.symbol} · {item.config.label}</time><b>{item.status==='complete'?(item.outcome ?? 'Completed'):item.status.replaceAll('_',' ')}</b><span>{item.error_code?.replaceAll('_',' ') ?? (item.attempts>1?`Attempt ${item.attempts}`:'')}</span></li>)}</ul>}</div>
  </section>;
}
