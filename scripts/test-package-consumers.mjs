#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const temporary = await mkdtemp(path.join(tmpdir(), "tidelight-package-consumer-"));
const env = { ...process.env, npm_config_cache: path.join(temporary, "npm-cache") };
function run(command, args, cwd, options = {}) {
  const result = spawnSync(command, args, { cwd, env, encoding: "utf8", maxBuffer: 4 * 1024 * 1024, ...options });
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed (${result.status}):\n${result.stdout}\n${result.stderr}`);
  return result.stdout;
}
function pack(directory, destination, extra = []) {
  const output = run("npm", ["pack", "--json", "--pack-destination", destination, ...extra], directory);
  const result = JSON.parse(output)[0];
  if (!result?.filename) throw new Error(`npm pack did not produce an archive for ${directory}`);
  return path.join(destination, result.filename);
}
async function consumer(name, packages) {
  const directory = path.join(temporary, name);
  await import("node:fs/promises").then(({ mkdir }) => mkdir(directory, { recursive: true }));
  await writeFile(path.join(directory, "package.json"), JSON.stringify({ name: `tidelight-${name}-consumer`, private: true, type: "module" }));
  run("npm", ["install", "--no-audit", "--no-fund", ...packages], directory);
  return directory;
}
try {
  const sdkManifest = JSON.parse(await readFile(path.join(root, "sdk/typescript/package.json"), "utf8"));
  const sdkArchive = pack(path.join(root, "sdk/typescript"), temporary);
  const sdkOnly = await consumer("sdk", [sdkArchive]);
  run(process.execPath, ["--input-type=module", "-e", `import { TidelightClient, TidelightApiError } from '@tidelight/sdk'; if (typeof TidelightClient !== 'function' || typeof TidelightApiError !== 'function') process.exit(1);`], sdkOnly);

  const reactArchive = pack(path.join(root, "packages/react"), temporary);
  const reactConsumer = await consumer("react", [sdkArchive, reactArchive, "react@19.2.8", "react-dom@19.2.8"]);
  run(process.execPath, ["--input-type=module", "-e", `import React from 'react'; import { renderToStaticMarkup } from 'react-dom/server'; import { TokenizedEquityGrid } from '@tidelight/react'; import { access } from 'node:fs/promises'; const markup=renderToStaticMarkup(React.createElement(TokenizedEquityGrid,{instruments:[]})); if(!markup.includes('No matching instruments')) process.exit(1); await access(new URL('./node_modules/@tidelight/react/tidelight-react.css', 'file://${reactConsumer}/'));`], reactConsumer);

  const cliManifestPath = path.join(root, "packages/cli/package.json");
  const cliManifest = JSON.parse(await readFile(cliManifestPath, "utf8"));
  if (cliManifest.dependencies?.["@tidelight/sdk"] !== "file:../../sdk/typescript") throw new Error("CLI source dependency changed; review the staging rule before updating this test.");
  const stage = path.join(temporary, "cli-stage");
  await cp(path.join(root, "packages/cli"), stage, { recursive: true, filter: source => !source.includes(`${path.sep}node_modules${path.sep}`) });
  const stagedManifestPath = path.join(stage, "package.json");
  const stagedManifest = JSON.parse(await readFile(stagedManifestPath, "utf8"));
  stagedManifest.dependencies["@tidelight/sdk"] = sdkManifest.version;
  await writeFile(stagedManifestPath, `${JSON.stringify(stagedManifest, null, 2)}\n`);
  const cliArchive = pack(stage, temporary, ["--ignore-scripts"]);
  const cliConsumer = await consumer("cli", [sdkArchive, cliArchive]);
  const cliBin = path.join(cliConsumer, "node_modules/@tidelight/cli/dist/bin.js");
  const help = run(process.execPath, [cliBin, "--help"], cliConsumer);
  if (!help.includes("research") || !help.includes("market")) throw new Error("Installed CLI help omitted expected command groups.");
  const unauthenticated = spawnSync(process.execPath, [cliBin, "research", "start", "NVDA"], { cwd: cliConsumer, env: { ...env, TIDELIGHT_API_KEY: "" }, encoding: "utf8" });
  if (unauthenticated.status !== 2 || !/No API key is configured/i.test(unauthenticated.stderr)) throw new Error(`Installed CLI did not stop safely without credentials (exit ${unauthenticated.status}): ${unauthenticated.stderr}`);

  console.log(`Validated clean local consumer installs for @tidelight/sdk@${sdkManifest.version}, @tidelight/react@${JSON.parse(await readFile(path.join(root, "packages/react/package.json"), "utf8")).version}, and staged @tidelight/cli@${cliManifest.version}; exercised SDK imports, React SSR/CSS, CLI help and pre-network no-credential rejection. No package was published.`);
} finally {
  await rm(temporary, { recursive: true, force: true });
}
