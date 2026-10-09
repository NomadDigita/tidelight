import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
const hooks = registerHooks({resolve(specifier,context,nextResolve){
  const sources={
    'next/server':'export const NextResponse={json:(body,init)=>Response.json(body,init)};',
    '@/lib/supabase/server':'export const createClient=async()=>globalThis.communityTestDb;',
    '@/lib/supabase/admin':'export const createAdminClient=()=>{globalThis.communityAdminCalls++;return globalThis.communityTestAdmin;};',
  };
  if(sources[specifier])return {url:'data:text/javascript,'+encodeURIComponent(sources[specifier]),shortCircuit:true};
  return nextResolve(specifier,context);
}});
const {GET,PATCH}=await import('../app/api/community/profile/[handle]/route.ts');
hooks.deregister();
function database(user,results){
  const calls=[];
  const db={auth:{getUser:async()=>({data:{user}})},from(table){const result=results.shift();const builder={then(resolve){return Promise.resolve(result).then(resolve)}};for(const method of ['select','eq','in','is','order','limit','maybeSingle','update'])builder[method]=(...args)=>{calls.push({table,method,args});return builder};return builder}};
  globalThis.communityTestDb=db;globalThis.communityAdminCalls=0;
  return calls;
}
const context={params:Promise.resolve({handle:'member'})};
const profile={id:'owner',handle:'member',show_studio_stats:false};
test('opted-out public profile never invokes privileged stats or returns private bookmarks',async()=>{
  const calls=database(null,[{data:profile},{data:[]},{data:[]},{data:[]}]);
  const response=await GET(new Request('https://example.test'),context),body=await response.json();
  assert.equal(response.status,200);assert.equal(body.studioStats,null);assert.deepEqual(body.saved,[]);assert.equal(globalThis.communityAdminCalls,0);
  assert.ok(!calls.some(call=>call.table==='community_bookmarks'));
});
test('public aggregate request cannot target a body-supplied identity and honors atomic opt-out',async()=>{
  database(null,[{data:{...profile,show_studio_stats:true}},{data:[]},{data:[]},{data:[]}]);
  globalThis.communityTestAdmin={rpc:async(name,args)=>{assert.equal(name,'community_public_studio_stats');assert.deepEqual(args,{p_profile_id:'owner'});return {data:null,error:null}}};
  const body=await (await GET(new Request('https://example.test?user_id=victim'),context)).json();
  assert.equal(body.studioStats,null);assert.equal(globalThis.communityAdminCalls,1);
});
test('sharing preference requires authentication and a real boolean',async()=>{
  database(null,[]);assert.equal((await PATCH(new Request('https://example.test',{method:'PATCH',body:'{"showStudioStats":true}'}),context)).status,401);
  for(const showStudioStats of ['true',1,null,[]]){database({id:'owner'},[]);assert.equal((await PATCH(new Request('https://example.test',{method:'PATCH',body:JSON.stringify({showStudioStats})}),context)).status,400)}
});
test('sharing update constrains both authenticated owner and requested handle',async()=>{
  const calls=database({id:'attacker'},[{data:null,error:null}]);
  const response=await PATCH(new Request('https://example.test',{method:'PATCH',body:'{"showStudioStats":true,"id":"owner"}'}),context);
  assert.equal(response.status,403);assert.ok(calls.some(call=>call.method==='eq'&&call.args[0]==='id'&&call.args[1]==='attacker'));assert.ok(calls.some(call=>call.method==='eq'&&call.args[0]==='handle'&&call.args[1]==='member'));
});
