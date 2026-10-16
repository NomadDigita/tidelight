import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { containsSecretMaterial, validatePackageArchiveListing } from "../scripts/check-npm-package-archive.mjs";

const manifest = {
  files: ["dist", "README.md", "tidelight.css"],
  exports: { ".": { types: "./dist/index.d.ts", import: "./dist/index.js" }, "./styles.css": "./tidelight.css" },
  bin: { tidelight: "./dist/bin.js" },
};

test("npm archive listing includes only the files npm reported and declared entry points", () => {
  const packed = [
    { path: "package.json" },
    { path: "README.md" },
    { path: "dist/index.d.ts" },
    { path: "dist/index.js" },
    { path: "dist/bin.js" },
    { path: "tidelight.css" },
  ];
  const tar = packed.map(file => `package/${file.path}`);
  assert.deepEqual(validatePackageArchiveListing(manifest, packed, tar), packed.map(file => file.path).sort());
});

test("npm archive validator rejects package-to-tarball drift", () => {
  assert.throws(
    () => validatePackageArchiveListing(manifest, [{ path: "package.json" }], ["package/package.json", "package/.env"]),
    /listing and tarball differ/,
  );
});

test("npm archive validator rejects files outside the manifest allowlist", () => {
  assert.throws(
    () => validatePackageArchiveListing(
      { files: ["README.md"] },
      [{ path: "package.json" }, { path: "README.md" }, { path: "server-only.js" }],
      ["package/package.json", "package/README.md", "package/server-only.js"],
    ),
    /outside package.json files allowlist/,
  );
});

test("npm archive validator rejects credential paths and missing declared files", () => {
  assert.throws(
    () => validatePackageArchiveListing({ files: ["README.md", ".env.production"] }, [{ path: "package.json" }, { path: "README.md" }, { path: ".env.production" }], ["package/package.json", "package/README.md", "package/.env.production"]),
    /credential or private-key file/,
  );
  assert.throws(
    () => validatePackageArchiveListing({ files: ["README.md"], exports: { ".": "./dist/missing.js" } }, [{ path: "package.json" }, { path: "README.md" }], ["package/package.json", "package/README.md"]),
    /missing declared package file/,
  );
  assert.throws(
    () => validatePackageArchiveListing({ files: ["README.md", "node_modules"] }, [{ path: "package.json" }, { path: "README.md" }, { path: "node_modules/dep/index.js" }], ["package/package.json", "package/README.md", "package/node_modules/dep/", "package/node_modules/dep/index.js"]),
    /nested dependencies/,
  );
});

test("npm archive validator rejects traversal and secret-like token material", () => {
  assert.throws(
    () => validatePackageArchiveListing({ files: ["README.md"] }, [{ path: "../outside" }], ["package/package.json", "package/README.md"]),
    /unsafe archive path/,
  );
  assert.throws(
    () => validatePackageArchiveListing({ files: ["README.md"] }, [], ["package/../outside/"]),
    /unsafe archive path/,
  );
  assert.equal(containsSecretMaterial("-----BEGIN PRIVATE KEY-----"), true);
  assert.equal(containsSecretMaterial("public endpoint: https://api.tidelight.app"), false);
});

test("CLI inspects a real npm tarball and rejects private-key text", async () => {
  const temporary = await mkdtemp(path.join(tmpdir(), "tidelight-npm-check-test-"));
  try {
    const packageDirectory = path.join(temporary, "package");
    await mkdir(path.join(packageDirectory, "dist"), { recursive: true });
    await writeFile(path.join(packageDirectory, "package.json"), JSON.stringify({
      name: "@tidelight/archive-fixture",
      version: "0.0.0-test",
      private: true,
      files: ["dist", "README.md"],
      exports: { ".": "./dist/index.js" },
    }));
    await writeFile(path.join(packageDirectory, "README.md"), "Local archive test fixture.\n");
    await writeFile(path.join(packageDirectory, "dist/index.js"), "export const ok = true;\n");
    const checker = fileURLToPath(new URL("../scripts/check-npm-package-archive.mjs", import.meta.url));
    const artifactDirectory = path.join(temporary, "verified-artifacts");
    const run = (withOutput = false) => spawnSync(process.execPath, [checker, packageDirectory, ...(withOutput ? [artifactDirectory] : [])], { encoding: "utf8" });
    const valid = run();
    assert.equal(valid.status, 0, valid.stderr);
    assert.match(valid.stdout, /archive files.*Nothing was published/);
    const saved = run(true);
    assert.equal(saved.status, 0, saved.stderr);
    assert.match(saved.stdout, /Verified archive saved/);
    assert.deepEqual(await readdir(artifactDirectory), ["tidelight-archive-fixture-0.0.0-test.tgz"]);

    await writeFile(path.join(packageDirectory, "README.md"), "-----BEGIN PRIVATE KEY-----\n");
    const unsafe = run();
    assert.notEqual(unsafe.status, 0);
    assert.match(unsafe.stderr, /private-key file|credential-like material/);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});

test("manual source release withholds its write token from package scripts", async () => {
  const workflow = await readFile(new URL("../.github/workflows/release-sdk.yml", import.meta.url), "utf8");
  const verifyStart = workflow.indexOf("- name: Verify synchronized package without release credentials");
  const tokenStart = workflow.indexOf("- name: Create scoped GitHub App token");
  const publishStart = workflow.indexOf("- name: Publish verified source release");
  assert.ok(verifyStart >= 0 && tokenStart > verifyStart && publishStart > tokenStart);
  const verification = workflow.slice(verifyStart, tokenStart);
  const publishing = workflow.slice(publishStart);
  assert.match(verification, /npm test/);
  assert.match(verification, /check-npm-package-archive\.mjs/);
  assert.doesNotMatch(verification, /GH_TOKEN/);
  assert.match(publishing, /GH_TOKEN: \$\{\{ steps\.app-token\.outputs\.token \}\}/);
  assert.match(publishing, /gh release create/);
  assert.doesNotMatch(publishing, /npm (?:ci|test|install|pack)/);
});
