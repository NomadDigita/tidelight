import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const files = [
  "sdk/typescript/README.md",
  "sdk/python/README.md",
  "app/developers/packages/package-detail.tsx",
  "app/developers/packages/python-detail.tsx",
];

test("webhook examples do not call undefined secret persistence helpers", async () => {
  for (const file of files) {
    const source = await readFile(new URL(`../${file}`, import.meta.url), "utf8");
    assert.doesNotMatch(source, /\b(?:saveSecret|save_secret)\s*\(/, `${file} must not invoke an undefined secret helper`);
    assert.match(source, /TODO: (?:Persist|Save)/, `${file} must mark secret-store integration explicitly`);
    assert.match(source, /Do not print it/, `${file} must warn against logging the one-time signing secret`);
    assert.match(source, /cannot be recovered by listing/, `${file} must explain one-time retrieval`);
  }
});
