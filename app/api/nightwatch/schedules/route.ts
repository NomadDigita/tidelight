import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getBitgetAsset } from '@/lib/bitget-market';
import { parseNightwatchSchedule } from '@/lib/nightwatch-schedules';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'no-store' };
export async function GET() {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in to manage schedules.' }, { status: 401, headers });
  const [schedules, executions, readiness] = await Promise.all([
    db.from('nightwatch_schedules').select('id,label,symbol,local_time,time_zone,playbook_key,enabled,research_run_id,next_run_at').order('slot'),
    db.from('nightwatch_schedule_executions').select('id,schedule_id,scheduled_for,status,attempts,run_id,outcome,error_code,finished_at,config').order('created_at', { ascending: false }).limit(30),
    db.rpc('nightwatch_schedule_readiness'),
  ]);
  if (schedules.error || executions.error) return NextResponse.json({ error: 'Could not load schedules.' }, { status: 503, headers });
  return NextResponse.json({ schedules: schedules.data, executions: executions.data, scheduler_available: readiness.data === true, max_schedules: 10, daily_limit: 10, dispatch_interval_seconds: 60 }, { headers });
}
export async function POST(request: Request) {
  if (request.headers.get('origin') && request.headers.get('origin') !== new URL(request.url).origin) return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403, headers });
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in to manage schedules.' }, { status: 401, headers });
  let args: ReturnType<typeof parseNightwatchSchedule>;
  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw) > 8192) return NextResponse.json({ error: 'Schedule request is too large.' }, { status: 413, headers });
    args = parseNightwatchSchedule(JSON.parse(raw));
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Invalid schedule.' }, { status: 400, headers }); }
  const asset = await getBitgetAsset(args.p_symbol).catch(() => null);
  if (!asset?.isReality) return NextResponse.json({ error: 'This symbol is not an available Bitget Reality market.' }, { status: 422, headers });
  const { data, error } = await db.rpc('save_nightwatch_schedule', args);
  if (error) return NextResponse.json({ error: error.code === '54000' ? 'You can save up to ten daily schedules.' : error.code === '42501' ? 'The schedule or research note is unavailable in this account.' : 'Could not save the schedule.' }, { status: error.code === '54000' ? 409 : error.code === '42501' ? 403 : 503, headers });
  return NextResponse.json({ schedule: data }, { status: args.p_id ? 200 : 201, headers });
}
export async function DELETE(request: Request) {
  if (request.headers.get('origin') && request.headers.get('origin') !== new URL(request.url).origin) return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403, headers });
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in to manage schedules.' }, { status: 401, headers });
  const id = new URL(request.url).searchParams.get('id');
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Choose a valid schedule.' }, { status: 400, headers });
  const { data, error } = await db.rpc('delete_nightwatch_schedule', { p_id: id });
  if (error) return NextResponse.json({ error: 'Could not remove schedule.' }, { status: 503, headers });
  return NextResponse.json({ deleted: data === true }, { status: data ? 200 : 404, headers });
}
