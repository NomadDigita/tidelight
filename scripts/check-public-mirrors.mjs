import { lstat, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const config = JSON.parse(await readFile(path.join(root, ".github/tidelight-mirrors.json"), "utf8"));
const forbiddenPath = /(^|\/)(\.env(?:\.|$)|secrets?(?:\.|$)|credentials?(?:\.|$)|service-role|private-key|id_rsa|\.git(?:\/|$))/i;
const forbiddenContent = [/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, /sb_secret_[A-Za-z0-9_]+/, /service_role\s*[:=]/i, /tl_live_[A-Za-z0-9_-]{43}/, /AKIA[0-9A-Z]{16}/];
const errors = [];
const seenRepos = new Set();

if (config.version !== 1 || config.canonicalRepository !== "TidelightOrg/tidelight") errors.push("mirror manifest version or canonical repository is invalid");

for (const [name, mirror] of Object.entries(config.mirrors ?? {})) {
  if (seenRepos.has(mirror.repository)) errors.push(`${name}: duplicate target repository ${mirror.repository}`);
  seenRepos.add(mirror.repository);
  if (!/^TidelightOrg\/tidelight-(api|mcp|sdk|python|examples)$/.test(mirror.repository)) errors.push(`${name}: target is outside the approved public mirror set`);
  if (!Array.isArray(mirror.paths) || mirror.paths.length === 0) errors.push(`${name}: at least one explicit path mapping is required`);
  for (const mapping of mirror.paths ?? []) {
    if (!mapping.source || path.isAbsolute(mapping.source) || mapping.source.split(/[\\/]/).includes("..")) {
      errors.push(`${name}: unsafe source mapping ${mapping.source}`);
      continue;
    }
    const sourceRoot = path.resolve(root, mapping.source);
    if (!sourceRoot.startsWith(`${root}${path.sep}`)) {
      errors.push(`${name}: source escapes the mother repository`);
      continue;
    }
    try {
      await lstat(sourceRoot);
    } catch {
      errors.push(`${name}: source does not exist: ${mapping.source}`);
      continue;
    }
    const inspect = async (current) => {
      const info = await lstat(current);
      if (info.isSymbolicLink()) {
        errors.push(`${name}: symbolic links are not permitted in a public source mapping: ${path.relative(root, current)}`);
        return;
      }
      if (info.isDirectory()) {
        for (const entry of await readdir(current)) {
          const next = path.join(current, entry);
          const relative = path.relative(sourceRoot, next).split(path.sep).join("/");
          if (forbiddenPath.test(relative)) errors.push(`${name}: forbidden path ${mapping.source}/${relative}`);
          else await inspect(next);
        }
      } else {
        if (!info.isFile()) {
          errors.push(`${name}: only regular files may be mirrored: ${path.relative(root, current)}`);
          return;
        }
        const relative = path.relative(sourceRoot, current).split(path.sep).join("/");
        const contents = await readFile(current, "utf8");
        if (forbiddenPath.test(relative)) errors.push(`${name}: forbidden file ${mapping.source}/${relative}`);
        if (forbiddenContent.some((pattern) => pattern.test(contents))) errors.push(`${name}: possible secret material in ${mapping.source}/${relative}`);
      }
    };
    await inspect(sourceRoot);
  }
}

const expected = ["TidelightOrg/tidelight-api", "TidelightOrg/tidelight-mcp", "TidelightOrg/tidelight-sdk", "TidelightOrg/tidelight-python", "TidelightOrg/tidelight-examples"].sort();
if (JSON.stringify([...seenRepos].sort()) !== JSON.stringify(expected)) errors.push("manifest must include exactly the five approved public mirrors");
if (errors.length) {
  console.error(errors.map((error) => `ERROR: ${error}`).join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Validated ${seenRepos.size} explicit public mirror mappings; no blocked paths or known secret markers found.`);
}
