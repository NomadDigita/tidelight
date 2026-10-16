import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { compareFileMaps } from "../scripts/check-mirror-parity.mjs";

test("mirror parity accepts an exact file set", () => {
  const result = compareFileMaps(
    new Map([["package.json", "manifest"], ["src/client.js", "client"]]),
    new Map([["package.json", "manifest"], ["src/client.js", "client"]]),
  );
  assert.deepEqual(result, { missing: [], extra: [], different: [] });
});

test("mirror parity rejects same-version source drift", () => {
  const result = compareFileMaps(
    new Map([["package.json", "version=0.1.0"], ["src/client.js", "canonical"]]),
    new Map([["package.json", "version=0.1.0"], ["src/client.js", "drifted"]]),
  );
  assert.deepEqual(result.different, ["src/client.js"]);
  assert.deepEqual(result.missing, []);
  assert.deepEqual(result.extra, []);
});

test("mirror parity rejects missing and unexpected paths", () => {
  const result = compareFileMaps(
    new Map([["README.md", "readme"], ["src/client.js", "client"]]),
    new Map([["README.md", "readme"], ["private.env", "secret"]]),
  );
  assert.deepEqual(result.missing, ["src/client.js"]);
  assert.deepEqual(result.extra, ["private.env"]);
  assert.deepEqual(result.different, []);
});

test("source release workflow checks parity before creating a GitHub release", async () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const workflow = await readFile(path.join(root, ".github/workflows/release-sdk.yml"), "utf8");
  const parity = workflow.indexOf("node scripts/check-mirror-parity.mjs");
  const token = workflow.indexOf("Create scoped GitHub App token");
  const release = workflow.indexOf("gh release create");
  assert.ok(parity >= 0 && parity < token && token < release, "parity must pass before credentials are minted or a release is created");
  assert.match(workflow, /\[\[ "\$TARGET_SHA" == "\$\{\{ steps\.parity\.outputs\.mirror_sha \}\}" \]\]/);
  assert.match(workflow, /--target "\$TARGET_SHA"/);
  assert.match(workflow, /Mother repository commit:/);
  assert.match(workflow, /Tested mirror commit:/);
});
