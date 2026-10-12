import test from "node:test";
import assert from "node:assert/strict";
import { emailFrame, emailSenders, escapeEmailHtml } from "../lib/email/brand.ts";

test("email templates escape text and interpolate no raw HTML", () => {
  assert.equal(escapeEmailHtml(`<script>&"'`), "&lt;script&gt;&amp;&quot;&#39;");
  const html = emailFrame({ eyebrow: "Research", title: "A <safe> title", body: "first <line>\nsecond & line", action: { label: "Open", url: "https://tidelight.app/nightwatch?a=1&b=2" } });
  assert.match(html, /A &lt;safe&gt; title/);
  assert.match(html, /first &lt;line&gt;/);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /tidelight-icon-192\.png/);
  const unsafeLink = emailFrame({ eyebrow: "Security", title: "Review account", body: "Check your account.", action: { label: "Open", url: "javascript:alert(1)" } });
  assert.match(unsafeLink, /href="https:\/\/tidelight\.app"/);
  assert.doesNotMatch(unsafeLink, /href="javascript:/i);
});

test("email frame carries the Tidelight brand and adapts to light and dark mail clients", () => {
  const html = emailFrame({ eyebrow: "Nightwatch", title: "Paper position reviewed", body: "No live order was sent." });
  assert.match(html, /Tidelight Research/);
  assert.match(html, /#08785b/);
  assert.match(html, /prefers-color-scheme:dark/);
  assert.match(html, /name="viewport"/);
  assert.equal(emailSenders.auth, "Tidelight <no-reply@tidelight.app>");
  assert.equal(emailSenders.alerts, "Tidelight Nightwatch <alerts@tidelight.app>");
  assert.equal(emailSenders.security, "Tidelight Security <security@tidelight.app>");
});
