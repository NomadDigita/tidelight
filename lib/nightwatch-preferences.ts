export type NightwatchPreferences = {
  trigger_mode: "manual" | "every_check";
  alert_on_signal: boolean;
  alert_on_fill: boolean;
  daily_summary: boolean;
  monitor_symbol: string | null;
  research_run_id: string | null;
};

export function normalizeNightwatchPreferences(input: Record<string, unknown>): NightwatchPreferences {
  const symbol = typeof input.monitor_symbol === "string" && /^[A-Z0-9]{2,24}USDT$/.test(input.monitor_symbol.toUpperCase()) ? input.monitor_symbol.toUpperCase() : null;
  return {
    trigger_mode: input.trigger_mode === "every_check" && symbol ? "every_check" : "manual",
    alert_on_signal: input.alert_on_signal !== false,
    alert_on_fill: input.alert_on_fill !== false,
    daily_summary: input.daily_summary !== false,
    monitor_symbol: symbol,
    research_run_id: typeof input.research_run_id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.research_run_id) ? input.research_run_id : null,
  };
}
