import test from "node:test";
import assert from "node:assert/strict";
import { normalizeNightwatchPreferences } from "../lib/nightwatch-preferences.ts";

test("unsupported automated check modes are normalized to explicit manual cadence", () => {
  assert.deepEqual(normalizeNightwatchPreferences({ trigger_mode: "every_check" }), {
    trigger_mode: "manual",
    alert_on_signal: true,
    alert_on_fill: true,
    daily_summary: true,
  });
});

test("only explicit false disables each supported Nightwatch preference", () => {
  assert.deepEqual(normalizeNightwatchPreferences({ alert_on_signal: false, alert_on_fill: 0, daily_summary: null }), {
    trigger_mode: "manual",
    alert_on_signal: false,
    alert_on_fill: true,
    daily_summary: true,
  });
});
