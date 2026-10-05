export type NightwatchPreferences = {
  trigger_mode: "manual";
  alert_on_signal: boolean;
  alert_on_fill: boolean;
  daily_summary: boolean;
};

/** Automatic market checks are not deployed; never persist a client-requested cadence. */
export function normalizeNightwatchPreferences(input: Record<string, unknown>): NightwatchPreferences {
  return {
    trigger_mode: "manual",
    alert_on_signal: input.alert_on_signal !== false,
    alert_on_fill: input.alert_on_fill !== false,
    daily_summary: input.daily_summary !== false,
  };
}
