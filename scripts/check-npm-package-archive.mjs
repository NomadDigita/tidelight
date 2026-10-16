#!/usr/bin/env node
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const unsafeName = /(^|\/)(?:\.env(?:\..*)?|\.npmrc|credentials?(?:\..*)?|id_(?:rsa|ed25519)|.*\.(?:pem|p12|pfx|key))$/i;
const secretContent = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\b(?:gh[pousr]_[A-Za-z0-9_]{30,}|github_pat_[A-Za-z0-9_]{30,})\b/,
  /\bnpm_[A-Za-z0-9]{36,}\b/,
  /\bsk-[A-Za-z0-9_-]{24,}\b/,
];

function fail(message) {
  throw new Error(`npm package archive validation failed: ${message}`);
}

function normalizeArchivePath(value) {
  if (typeof value !== "string" || !value || value.includes("\\") || value.startsWith("/")) {
    fail(`invalid archive path ${JSON.stringify(value)}.`);
  }
  const segments = value.split("/");
  if (segments.some(segment => segment === ".." || segment === "." || segment === "")) {
    fail(`unsafe archive path ${JSON.stringify(value)}.`);
  }
  return value;
}

function collectManifestTargets(value, targets = []) {
  if (typeof value === "string" && value.startsWith("./")) targets.push(value.slice(2));
  else if (Array.isArray(value)) value.forEach(item => collectManifestTargets(item, targets));
  else if (value && typeof value === "object") Object.values(value).forEach(item => collectManifestTargets(item, targets));
  return targets;
}

export function validatePackageArchiveListing(manifest, packedFiles, tarEntries) {
  const packedPaths = packedFiles.map(file => normalizeArchivePath(file.path));
  const archivePaths = tarEntries
    .map(entry => {
      const directory = entry.endsWith("/");
      const normalized = normalizeArchivePath(directory ? entry.slice(0, -1) : entry);
      if (!normalized.startsWith("package/")) fail(`unexpected tarball root ${JSON.stringify(entry)}.`);
      return directory ? null : normalized.slice("package/".length);
    })
    .filter(Boolean);
  const packed = new Set(packedPaths);
  const archived = new Set(archivePaths);
  if (packed.size !== packedPaths.length) fail("npm pack reported duplicate file paths.");
  if (archived.size !== archivePaths.length) fail("tarball contains duplicate file paths.");
  const missing = [...packed].filter(file => !archived.has(file));
  const extra = [...archived].filter(file => !packed.has(file));
  if (missing.length || extra.length) {
    fail(`npm pack listing and tarball differ (missing: ${missing.join(", ") || "none"}; extra: ${extra.join(", ") || "none"}).`);
  }

  const files = new Set(archived);
  for (const required of ["package.json", "README.md", ...collectManifestTargets(manifest.exports), ...collectManifestTargets(manifest.bin)]) {
    if (required.includes("*") || required.includes("[")) continue;
    if (!files.has(normalizeArchivePath(required))) fail(`archive is missing declared package file ${required}.`);
  }
  for (const file of files) {
    if (unsafeName.test(file)) fail(`archive includes a credential or private-key file: ${file}.`);
    if (/(^|\/)node_modules\//i.test(file)) fail(`archive includes nested dependencies: ${file}.`);
  }
  return [...files].sort();
}

export function containsSecretMaterial(content) {
  return secretContent.some(pattern => pattern.test(content));
}

async function validatePackage(packageDirectory) {
  const root = path.resolve(packageDirectory);
  const manifest = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
  const temporary = await mkdtemp(path.join(tmpdir(), "tidelight-npm-archive-"));
  try {
    const pack = spawnSync("npm", ["pack", "--json", "--pack-destination", temporary], {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 4 * 1024 * 1024,
      env: { ...process.env, npm_config_cache: path.join(temporary, "npm-cache") },
    });
    if (pack.status !== 0) fail(`npm pack exited ${pack.status}: ${pack.stderr.trim()}`);
    let result;
    try { result = JSON.parse(pack.stdout)[0]; }
    catch { fail("npm pack did not return valid JSON."); }
    if (!result?.filename || !Array.isArray(result.files)) fail("npm pack JSON is missing the archive filename or file list.");

    const archive = path.join(temporary, result.filename);
    const listing = execFileSync("tar", ["-tzf", archive], { encoding: "utf8", maxBuffer: 4 * 1024 * 1024 });
    const paths = validatePackageArchiveListing(manifest, result.files, listing.trimEnd().split("\n"));
    for (const relativePath of paths) {
      const content = execFileSync("tar", ["-xOzf", archive, `package/${relativePath}`], {
        encoding: "utf8",
        maxBuffer: 16 * 1024 * 1024,
      });
      if (containsSecretMaterial(content)) fail(`archive member contains credential-like material: ${relativePath}.`);
    }
    console.log(`Validated ${manifest.name}@${manifest.version}: ${paths.length} archive files, declared entry points, and secret-material scan. Nothing was published.`);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const packageDirectory = process.argv[2];
  if (!packageDirectory) fail("usage: node scripts/check-npm-package-archive.mjs <package-directory>.");
  validatePackage(packageDirectory).catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
