import { timingSafeEqual } from 'node:crypto';
import { after, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getBitgetAsset, getBitgetCandles } from '@/lib/bitget-market';
import { prepareBacktestCandles, ALPHA_STRATEGIES, type StrategyKey } from '@/lib/backtest';
import { evaluateSmaCrossover } from '@/lib/nightwatch-signal';
import { decideNightwatch } from '@/lib/nightwatch-agent';
import { readBeforeNightwatchDeadline } from '@/lib/nightwatch-budget';
import { enqueueNightwatchEmail } from '@/lib/email/nightwatch';
import { drainEmailQueue } from '@/lib/email/delivery';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const headers = { 'Cache-Control': 'no-store' };
type Job = { id: string; user_id: string; lease_token: string; config: { id: string; symbol: string; playbook_key: StrategyKey; research_run_id: string | null } };
function authorized(request: Request) {
  const supplied = Buffer.from(request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '');
  return [process.env.TIC_RESEARCH_CRON_SECRET, process.env.CRON_SECRET].some(secret => {
    if (!secret || !supplied.length) return false;
    const expected = Buffer.from(secret);
    return supplied.length === expected.length && timingSafeEqual(supplied, expected);
  });
}
export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized schedule worker.' }, { status: 401, headers });
  const deadline = Date.now() + 44000;
  let admin: ReturnType<typeof createAdminClient>;
  try { admin = createAdminClient(); } catch { return NextResponse.json({error:'Schedule worker is not configured.'},{status:503,headers}); }
  let claim;
  try { claim = await admin.rpc('claim_nightwatch_schedule'); } catch { return NextResponse.json({error:'Schedule queue is unavailable.'},{status:503,headers}); }
  if (claim.error) return NextResponse.json({ error: 'Schedule queue is unavailable.' }, { status: 503, headers });
  const job = claim.data as Job | null;
  if (!job) return NextResponse.json({ claimed: false }, { headers });
  try {
    const config = job.config;
    const asset = await readBeforeNightwatchDeadline(getBitgetAsset(config.symbol), deadline);
    if (!asset?.isReality) throw new Error('unavailable_market');
    const candles = prepareBacktestCandles(await readBeforeNightwatchDeadline(getBitgetCandles(config.symbol, '4H', 1000), deadline), '4H', Date.now());
    if (candles.length < 51) throw new Error('insufficient_candles');
    const current = candles.at(-1)!;
    const asOfMs = current.timestamp + 4 * 60 * 60 * 1000;
    const { fastSma: fast, slowSma: slow } = evaluateSmaCrossover(candles.map(c => c.close));
    const readSignal = AbortSignal.timeout(Math.max(1, deadline - Date.now()));
    const [account, position, orders, research, prior, preferences] = await Promise.all([
      admin.from('nightwatch_accounts').select('cash_balance,paused').eq('user_id', job.user_id).abortSignal(readSignal).maybeSingle(),
      admin.from('nightwatch_positions').select('quantity,average_cost').eq('user_id', job.user_id).eq('symbol', config.symbol).abortSignal(readSignal).maybeSingle(),
      admin.from('nightwatch_orders').select('realized_pnl').eq('user_id', job.user_id).gte('created_at', new Date(new Date().setUTCHours(0,0,0,0)).toISOString()).limit(10).abortSignal(readSignal),
      config.research_run_id ? admin.from('research_runs').select('question,summary,status').eq('user_id',job.user_id).eq('id',config.research_run_id).abortSignal(readSignal).maybeSingle() : Promise.resolve({ data: null, error: null }),
      admin.from('nightwatch_runs').select('id,signal').eq('user_id',job.user_id).eq('symbol',config.symbol).eq('as_of',new Date(asOfMs).toISOString()).abortSignal(readSignal).maybeSingle(),
      admin.from('nightwatch_preferences').select('alert_on_signal,alert_on_fill').eq('user_id',job.user_id).abortSignal(readSignal).maybeSingle(),
    ]);
    if ([account,position,orders,research,prior,preferences].some(r=>r.error) || !account.data) throw new Error('account_context_unavailable');
    const dailyOrders = orders.data ?? [];
    const decision = prior.data || account.data.paused ? null : await decideNightwatch({
      symbol: config.symbol, issuer: asset.name, candles: candles.slice(-90), playbookKey: config.playbook_key,
      account: { cashUsd: Number(account.data.cash_balance), positionQuantity: Number(position.data?.quantity ?? 0), averageCostUsd: position.data?.average_cost == null ? null : Number(position.data.average_cost), dailyRealizedPnlUsd: dailyOrders.reduce((sum,row)=>sum+Number(row.realized_pnl ?? 0),0), fillsToday: dailyOrders.length },
      research: research.data?.status === 'complete' ? { question: research.data.question, summary: research.data.summary } : null,
    }, { budgetMs: Math.max(0,Math.min(5000,deadline-Date.now())), deadlineAt: deadline });
    const signal = prior.data?.signal ?? decision?.signal ?? 'hold';
    const snapshot = { provider:'Bitget public Spot candles', interval:'4H', closedCandleStart:new Date(current.timestamp).toISOString(), closedCandleEnd:new Date(asOfMs).toISOString(), assetName:asset.name, underlyingTicker:asset.underlyingTicker, feeRate:0.001,slippageRate:0.0005,
      playbook: { key:config.playbook_key,label:ALPHA_STRATEGIES[config.playbook_key].label }, ...(decision ? { agent: { version:'nightwatch-agent-v1', ...decision } } : {}) };
    const finished = await admin.rpc('finish_nightwatch_schedule',{p_id:job.id,p_lease_token:job.lease_token,p_market:{asOfMs,price:current.close,fast,slow,signal,snapshot}});
    if (finished.error) throw new Error('commit_unavailable');
    const result = finished.data as { status:string; run_id?:string; outcome?:string; idempotent?:boolean };
    if (result.status === 'complete' && result.run_id && !result.idempotent && decision) {
      const alerts = [];
      if (signal !== 'hold' && preferences.data?.alert_on_signal !== false) alerts.push({kind:'signal' as const,title:`${signal.toUpperCase()} signal · ${config.symbol}`});
      if (result.outcome === 'executed' && preferences.data?.alert_on_fill !== false) alerts.push({kind:'fill' as const,title:`Paper ${signal} filled · ${config.symbol}`});
      for (const alert of alerts) {
        const saved = await admin.from('nightwatch_alerts').upsert({user_id:job.user_id,run_id:result.run_id,...alert,body:decision.rationale},{onConflict:'run_id,kind'});
        if (saved.error) console.warn('nightwatch-schedule-alert-deferred',saved.error.code);
        else await enqueueNightwatchEmail({admin,userId:job.user_id,eventKey:`nightwatch:${result.run_id}:${alert.kind}`,kind:alert.kind==='signal'?'nightwatch_signal':'nightwatch_fill',title:alert.title,body:decision.rationale}).catch(()=>console.warn('nightwatch-schedule-email-deferred'));
      }
      if (alerts.length) after(async()=>{ await drainEmailQueue(admin).catch(()=>console.warn('nightwatch-schedule-delivery-deferred')); });
    }
    return NextResponse.json({claimed:true,status:result.status,outcome:result.outcome ?? null,paperOnly:true},{headers});
  } catch {
    let failure;
    try { failure = await admin.rpc('finish_nightwatch_schedule',{p_id:job.id,p_lease_token:job.lease_token,p_error_code:'provider_unavailable'}); }
    catch { failure = {error:true,data:null}; }
    return NextResponse.json({claimed:true,status:failure.error?'failure_state_unavailable':failure.data?.status ?? 'failed',paperOnly:true},{status:503,headers});
  }
}
export const GET = POST;
