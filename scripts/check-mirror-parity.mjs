import { lstat, readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { getTrackedMirrorFiles } from "./public-mirror-files.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const digest = (contents) => createHash("sha256").update(contents).digest("hex");

export function compareFileMaps(expected, actual) {
  const missing = [...expected.keys()].filter((file) => !actual.has(file)).sort();
  const extra = [...actual.keys()].filter((file) => !expected.has(file)).sort();
  const different = [...expected.keys()]
    .filter((file) => actual.has(file) && expected.get(file) !== actual.get(file))
    .sort();
  return { missing, extra, different };
}

async function readDirectory(root) {
  const files = new Map();
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (directory === root && entry.name === ".git") continue;
      const absolute = path.join(directory, entry.name);
      const relative = path.relative(root, absolute).split(path.sep).join("/");
      const info = await lstat(absolute);
      if (info.isSymbolicLink()) {
        files.set(relative, "symlink");
      } else if (info.isDirectory()) {
        await visit(absolute);
      } else if (info.isFile()) {
        files.set(relative, digest(await readFile(absolute)));
      } else {
        files.set(relative, "unsupported-file-type");
      }
    }
  }
  await visit(root);
  return files;
}

async function canonicalFiles(root, mirror) {
  const files = new Map();
  for (const mapping of mirror.paths) {
    const sourceRoot = path.resolve(root, mapping.source);
    if (!sourceRoot.startsWith(`${root}${path.sep}`) && sourceRoot !== root) {
      throw new Error(`Unsafe source mapping: ${mapping.source}`);
    }
    const sourceInfo = await lstat(sourceRoot);
    const tracked = getTrackedMirrorFiles(root, mapping.source);
    if (tracked.length === 0) throw new Error(`No tracked files found for ${mapping.source}`);
    for (const trackedPath of tracked) {
      const absolute = path.resolve(root, trackedPath);
      if (!absolute.startsWith(`${sourceRoot}${path.sep}`) && absolute !== sourceRoot) {
        throw new Error(`Tracked file escapes mapping: ${trackedPath}`);
      }
      const info = await lstat(absolute);
      if (!info.isFile()) throw new Error(`Mapped source must be a regular file: ${trackedPath}`);
      const relative = sourceInfo.isDirectory() ? path.relative(sourceRoot, absolute) : "";
      const destination = path.resolve(root, mapping.destination, relative);
      const destinationRelative = path.relative(root, destination).split(path.sep).join("/");
      if (destinationRelative.startsWith("../") || destinationRelative === "..") {
        throw new Error(`Unsafe destination mapping: ${mapping.destination}`);
      }
      if (files.has(destinationRelative)) throw new Error(`Duplicate destination path: ${destinationRelative}`);
      files.set(destinationRelative, digest(await readFile(absolute)));
    }
  }
  return files;
}

export async function verifyMirrorParity(root, mirrorRoot, mirrorName) {
  const config = JSON.parse(await readFile(path.join(root, ".github/tidelight-mirrors.json"), "utf8"));
  const mirror = config.mirrors?.[mirrorName];
  if (!mirror) throw new Error(`Unknown public mirror: ${mirrorName}`);
  const expected = await canonicalFiles(root, mirror);
  const actual = await readDirectory(mirrorRoot);
  const result = compareFileMaps(expected, actual);
  return { ...result, canonicalCount: expected.size, mirrorCount: actual.size };
}

async function main() {
  const [mirrorName, mirrorPath] = process.argv.slice(2);
  if (!mirrorName || !mirrorPath) {
    throw new Error("Usage: node scripts/check-mirror-parity.mjs <mirror-name> <mirror-directory>");
  }
  const mirrorRoot = path.resolve(mirrorPath);
  const result = await verifyMirrorParity(repositoryRoot, mirrorRoot, mirrorName);
  if (result.missing.length || result.extra.length || result.different.length) {
    console.error(`Mirror parity failed (${result.canonicalCount} canonical files, ${result.mirrorCount} mirror files).`);
    for (const file of result.missing) console.error(`MISSING: ${file}`);
    for (const file of result.extra) console.error(`EXTRA: ${file}`);
    for (const file of result.different) console.error(`DIFFERENT: ${file}`);
    process.exitCode = 1;
    return;
  }
  console.log(`Mirror parity passed for ${mirrorName}: ${result.canonicalCount} files match byte-for-byte.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await main();
}
