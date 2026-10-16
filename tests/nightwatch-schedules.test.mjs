import test from 'node:test';
import assert from 'node:assert/strict';
import { parseNightwatchSchedule, MAX_NIGHTWATCH_SCHEDULES } from '../lib/nightwatch-schedules.ts';
const valid = {label:'Evening research',symbol:'raaplusdt',local_time:'23:15:42',time_zone:'Africa/Lagos',playbook_key:'sma_trend_v1',enabled:true};
test('daily schedules retain exact seconds, timezone, symbol, playbook and optional lineage',()=>{
  const result=parseNightwatchSchedule(valid);
  assert.equal(result.p_symbol,'RAAPLUSDT');assert.equal(result.p_local_time,'23:15:42');assert.equal(result.p_time_zone,'Africa/Lagos');assert.equal(result.p_research_run_id,null);assert.equal(MAX_NIGHTWATCH_SCHEDULES,10);
  assert.equal(parseNightwatchSchedule({...valid,local_time:'00:00'}).p_local_time,'00:00:00');
});
test('malformed wall times, timezones, playbooks, ids and flags are rejected before RPC',()=>{
  for(const bad of [{local_time:'24:00:00'},{local_time:'12:00:60'},{local_time:'12:00:00.5'},{time_zone:'Unknown/Zone'},{playbook_key:'live_trading'},{symbol:'AAPL/USD'},{enabled:'true'},{id:'other-user'},{research_run_id:'other-note'},{label:' '.repeat(65)}]) assert.throws(()=>parseNightwatchSchedule({...valid,...bad}));
  assert.throws(()=>parseNightwatchSchedule(null));assert.throws(()=>parseNightwatchSchedule([]));
});
