import test from "node:test";
import assert from "node:assert/strict";
import { normalizeNightwatchPreferences } from "../lib/nightwatch-preferences.ts";

test("scheduled checks require a valid Reality-style symbol and otherwise remain manual", () => {
  assert.deepEqual(normalizeNightwatchPreferences({ trigger_mode: "every_check" }), {
    trigger_mode: "manual",
    monitor_symbol: null,
    research_run_id: null,
    alert_on_signal: true,
    alert_on_fill: true,
    daily_summary: true,
  });
  assert.equal(normalizeNightwatchPreferences({ trigger_mode: "every_check", monitor_symbol: "rnvdausdt" }).trigger_mode, "every_check");
  assert.equal(normalizeNightwatchPreferences({ trigger_mode: "every_check", monitor_symbol: "bad symbol" }).trigger_mode, "manual");
});

test("only explicit false disables each supported Nightwatch preference", () => {
  assert.deepEqual(normalizeNightwatchPreferences({ alert_on_signal: false, alert_on_fill: 0, daily_summary: null }), {
    trigger_mode: "manual",
    monitor_symbol: null,
    research_run_id: null,
    alert_on_signal: false,
    alert_on_fill: true,
    daily_summary: true,
  });
});
