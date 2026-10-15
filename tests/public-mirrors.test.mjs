import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { getTrackedMirrorFiles } from "../scripts/public-mirror-files.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(await readFile(path.join(root, ".github/tidelight-mirrors.json"), "utf8"));

test("public mirror allowlist validates without private paths or known secrets", () => {
  const output = execFileSync(process.execPath, ["scripts/check-public-mirrors.mjs"], { cwd: root, encoding: "utf8" });
  assert.match(output, /Validated 5 explicit public mirror mappings/);
});

test("mirror file selection excludes untracked build and Python cache artifacts", async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "tidelight-mirror-files-"));
  try {
    execFileSync("git", ["init", "--quiet"], { cwd: temporary });
    execFileSync("git", ["config", "user.name", "Mirror test"], { cwd: temporary });
    execFileSync("git", ["config", "user.email", "mirror-test@example.invalid"], { cwd: temporary });
    await mkdir(path.join(temporary, "sdk", "__pycache__"), { recursive: true });
    await mkdir(path.join(temporary, "sdk", "dist"), { recursive: true });
    await writeFile(path.join(temporary, "sdk", "README.md"), "canonical file");
    await writeFile(path.join(temporary, "sdk", "__pycache__", "leak.pyc"), "generated artifact");
    await writeFile(path.join(temporary, "sdk", "dist", "index.js"), "generated artifact");
    execFileSync("git", ["add", "sdk/README.md"], { cwd: temporary });
    execFileSync("git", ["commit", "--quiet", "-m", "add tracked SDK file"], { cwd: temporary });
    assert.deepEqual(getTrackedMirrorFiles(temporary, "sdk"), ["sdk/README.md"]);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
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

