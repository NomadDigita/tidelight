// Compatibility for the retired daily Vercel cron: only due custom schedules
// are claimed, using the same leases and limits as the Supabase dispatcher.
import { POST as runSchedules } from '../nightwatch-schedules/route';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export const GET = runSchedules;
export const POST = runSchedules;
