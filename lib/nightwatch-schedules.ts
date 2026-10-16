export const MAX_NIGHTWATCH_SCHEDULES = 10;
export type NightwatchSchedule = {
  id: string; label: string; symbol: string; local_time: string; time_zone: string;
  playbook_key: string; enabled: boolean; research_run_id: string | null; next_run_at: string;
};
const PLAYBOOKS = new Set(['sma_trend_v1', 'rsi_reversion_v1', 'channel_breakout_v1', 'weekend_drift_v1', 'trend_pullback_v1', 'semi_breakout_v1']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function parseNightwatchSchedule(input: unknown) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Send a schedule configuration.');
  const value = input as Record<string, unknown>;
  const label = typeof value.label === 'string' ? value.label.trim() : '';
  const symbol = typeof value.symbol === 'string' ? value.symbol.toUpperCase() : '';
  const localTime = typeof value.local_time === 'string' ? value.local_time : '';
  const zone = typeof value.time_zone === 'string' ? value.time_zone : '';
  if (!label || label.length > 64) throw new Error('Name the schedule using 1–64 characters.');
  if (!/^[A-Z0-9]{2,24}USDT$/.test(symbol)) throw new Error('Choose a supported Bitget Reality symbol.');
  if (!/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(localTime)) throw new Error('Choose a valid time, including seconds if needed.');
  try { new Intl.DateTimeFormat('en-US', { timeZone: zone }).format(); } catch { throw new Error('Choose a valid timezone.'); }
  if (!zone || typeof value.playbook_key !== 'string' || !PLAYBOOKS.has(value.playbook_key)) throw new Error('Choose an available playbook and timezone.');
  if (typeof value.enabled !== 'boolean') throw new Error('Specify whether the schedule is enabled.');
  if (value.id != null && (typeof value.id !== 'string' || !UUID.test(value.id))) throw new Error('The schedule ID is invalid.');
  if (value.research_run_id != null && (typeof value.research_run_id !== 'string' || !UUID.test(value.research_run_id))) throw new Error('The research note ID is invalid.');
  return { p_id: value.id ?? null, p_label: label, p_symbol: symbol, p_local_time: localTime.length === 5 ? `${localTime}:00` : localTime,
    p_time_zone: zone, p_playbook_key: value.playbook_key, p_enabled: value.enabled, p_research_run_id: value.research_run_id ?? null };
}
