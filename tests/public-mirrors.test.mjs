import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";

const manifest = JSON.parse(readFileSync(".github/tidelight-mirrors.json", "utf8"));

test("public mirror allowlist validates without private paths or known secrets", () => {
  const output = execFileSync(process.execPath, ["scripts/check-public-mirrors.mjs"], { encoding: "utf8" });
  assert.match(output, /Validated 5 explicit public mirror mappings/);
});

test("public mirror roots are limited to named developer distributions", () => {
  assert.deepEqual(Object.values(manifest.mirrors).map((mirror) => mirror.repository).sort(), [
    "TidelightOrg/tidelight-api",
    "TidelightOrg/tidelight-examples",
    "TidelightOrg/tidelight-mcp",
    "TidelightOrg/tidelight-python",
    "TidelightOrg/tidelight-sdk",
  ]);
  for (const mirror of Object.values(manifest.mirrors)) {
    for (const mapping of mirror.paths) {
      assert.doesNotMatch(mapping.source, /^(app|lib|supabase|\.vercel)(\/|$)/);
    }
  }
});

