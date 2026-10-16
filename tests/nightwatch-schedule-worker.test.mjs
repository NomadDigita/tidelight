import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
const modules={
  '@/lib/supabase/admin':'export const createAdminClient=()=>globalThis.nwTest.admin;',
  '@/lib/bitget-market':'export const getBitgetAsset=(...args)=>globalThis.nwTest.asset(...args); export const getBitgetCandles=async()=>Array.from({length:60},(_,i)=>({timestamp:Date.now()-(61-i)*14400000,close:100}));',
  '@/lib/backtest':'export const prepareBacktestCandles=c=>c; export const ALPHA_STRATEGIES={sma_trend_v1:{label:"SMA"}};',
  '@/lib/nightwatch-signal':'export const evaluateSmaCrossover=()=>({fastSma:101,slowSma:99});',
  '@/lib/nightwatch-agent':'export const decideNightwatch=async()=>({signal:"hold",action:"hold",rationale:"No crossover",risks:[]});',
  '@/lib/nightwatch-budget':'export const readBeforeNightwatchDeadline=async p=>await p;',
  '@/lib/email/nightwatch':'export const enqueueNightwatchEmail=async()=>{};',
  '@/lib/email/delivery':'export const drainEmailQueue=async()=>{};',
};
const hook=registerHooks({resolve(specifier,context,next){if(specifier==="next/server")return next("next/server.js",context);if(modules[specifier])return{url:`data:text/javascript,${encodeURIComponent(modules[specifier])}`,shortCircuit:true};return next(specifier,context);}});
const {POST}=await import('../app/api/cron/nightwatch-schedules/route.ts');hook.deregister();
const job={id:'job',user_id:'owner',lease_token:'lease',config:{symbol:'RAAPLUSDT',playbook_key:'sma_trend_v1',research_run_id:null}};
function setup(claim=job){
 const calls=[];
 globalThis.nwTest={asset:async()=>({isReality:true,name:'Apple',symbol:'RAAPLUSDT'}),admin:{
   rpc:async(name,args)=>{calls.push({name,args});return {data:name==='claim_nightwatch_schedule'?claim:{status:args.p_error_code?'retry_pending':'complete',outcome:'no_action'},error:null};},
   from:table=>{
    const data=table==='nightwatch_accounts'?{cash_balance:10000,paused:false}:table==='nightwatch_orders'?[]:null;
    const query={select(){return this;},eq(){return this;},gte(){return this;},limit(){return this;},abortSignal(){return this;},maybeSingle(){return Promise.resolve({data,error:null});},then(resolve,reject){return Promise.resolve({data,error:null}).then(resolve,reject);}};return query;
   }
 }};process.env.TIC_RESEARCH_CRON_SECRET='worker-test-secret';delete process.env.CRON_SECRET;return calls;
}
const request=(token='worker-test-secret')=>new Request('https://tidelight.app/api/cron/nightwatch-schedules',{method:'POST',headers:{authorization:`Bearer ${token}`}});
test('schedule worker rejects missing or incorrect bearer before claiming or reading providers',async()=>{
 const calls=setup();for(const token of ['', 'wrong-secret'])assert.equal((await POST(request(token))).status,401);assert.equal(calls.length,0);
});
test('schedule worker returns honest idle state without market/provider calls',async()=>{
 const calls=setup(null);globalThis.nwTest.asset=()=>{throw new Error('must not read');};const response=await POST(request());assert.equal(response.status,200);assert.deepEqual(await response.json(),{claimed:false});assert.equal(calls.length,1);
});
test('schedule worker commits only to the leased database occurrence',async()=>{
 const calls=setup();const response=await POST(request());assert.equal(response.status,200);const finish=calls.find(c=>c.name==='finish_nightwatch_schedule');assert.equal(finish.args.p_id,'job');assert.equal(finish.args.p_lease_token,'lease');assert.equal(finish.args.p_market.signal,'hold');assert.equal(finish.args.p_market.snapshot.provider,'Bitget public Spot candles');
});
test('provider failure records a bounded retry without revealing upstream errors',async()=>{
 const calls=setup();globalThis.nwTest.asset=()=>{throw new Error('private upstream response');};const response=await POST(request());assert.equal(response.status,503);const body=await response.text();assert.ok(!body.includes('private upstream'));assert.equal(calls.at(-1).args.p_error_code,'provider_unavailable');assert.equal(calls.at(-1).args.p_lease_token,'lease');
});
