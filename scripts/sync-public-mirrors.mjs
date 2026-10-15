import { execFileSync } from "node:child_process";
import { cp, mkdir, readFile, readdir, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getTrackedMirrorFiles } from "./public-mirror-files.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const config = JSON.parse(await readFile(path.join(root, ".github/tidelight-mirrors.json"), "utf8"));
const args = process.argv.slice(2);
const option = (name) => {
  const index = args.indexOf(name);
  return index < 0 ? undefined : args[index + 1];
};
const base = option("--base");
const head = option("--head") ?? "HEAD";
const runId = process.env.GITHUB_RUN_ID ?? `${Date.now()}`;
const dispatchAll = !base || base === "0".repeat(40);
const changed = dispatchAll ? [] : execFileSync("git", ["diff", "--name-only", `${base}...${head}`], { cwd: root, encoding: "utf8" }).trim().split("\n").filter(Boolean);
const syncInfrastructurePaths = [".github/tidelight-mirrors.json", "scripts/check-public-mirrors.mjs", "scripts/public-mirror-files.mjs", "scripts/sync-public-mirrors.mjs"];
const managedPaths = {
  api: ["public/components/api/", "docs/tic-openapi.yaml", ...syncInfrastructurePaths],
  mcp: ["public/components/mcp/", ...syncInfrastructurePaths],
  typescript: ["sdk/typescript/", ...syncInfrastructurePaths],
  python: ["sdk/python/", ...syncInfrastructurePaths],
  examples: ["public/components/examples/", ...syncInfrastructurePaths],
};
const selected = Object.entries(config.mirrors).filter(([name]) => dispatchAll || changed.some((file) => managedPaths[name].some((prefix) => file.startsWith(prefix))));
if (!selected.length) {
  console.log("No public mirror paths changed.");
  process.exit(0);
}

const run = (cmd, argv, opts = {}) => execFileSync(cmd, argv, { stdio: "inherit", ...opts });
const capture = (cmd, argv, opts = {}) => execFileSync(cmd, argv, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...opts }).trim();
const exists = async (file) => { try { await stat(file); return true; } catch { return false; } };
const copyTrackedMapping = async (mapping, workspace) => {
  const source = path.resolve(root, mapping.source);
  if (!(await exists(source))) throw new Error(`Missing canonical path: ${path.relative(root, source)}`);
  const sourceInfo = await stat(source);
  const tracked = getTrackedMirrorFiles(root, mapping.source);
  if (tracked.length === 0) throw new Error(`No Git-tracked files in canonical path: ${mapping.source}`);
  for (const trackedPath of tracked) {
    const file = path.resolve(root, trackedPath);
    if (!file.startsWith(`${source}${path.sep}`) && file !== source) throw new Error(`Tracked path escapes mapping: ${trackedPath}`);
    const info = await stat(file);
    if (!info.isFile()) throw new Error(`Only regular files can be mirrored: ${trackedPath}`);
    const relative = sourceInfo.isDirectory() ? path.relative(source, file) : "";
    const destination = sourceInfo.isDirectory()
      ? path.resolve(workspace, mapping.destination, relative)
      : path.resolve(workspace, mapping.destination);
    if (!destination.startsWith(`${workspace}${path.sep}`) && destination !== workspace) throw new Error(`${mapping.source}: unsafe destination mapping`);
    await mkdir(path.dirname(destination), { recursive: true });
    await cp(file, destination);
  }
};
const tmp = await import("node:fs/promises").then((fs) => fs.mkdtemp(path.join(os.tmpdir(), "tidelight-mirror-")));
try {
  for (const [name, mirror] of selected) {
    const workspace = path.join(tmp, name);
    const repoInfo = JSON.parse(capture("gh", ["api", `repos/${mirror.repository}`, "--jq", "{default_branch: .default_branch}"]));
    const defaultBranch = repoInfo.default_branch || "main";
    let hasDefaultBranch = true;
    try {
      capture("gh", ["api", `repos/${mirror.repository}/branches/${defaultBranch}`, "--jq", ".name"]);
    } catch (error) {
      const detail = `${error.stderr ?? ""}${error.stdout ?? ""}`;
      if (error.status === 1 && /Branch not found|HTTP 404|Not Found/i.test(detail)) hasDefaultBranch = false;
      else throw new Error(`Could not inspect ${mirror.repository}@${defaultBranch}; refusing empty-repository bootstrap. ${detail.trim()}`);
    }
    const bootstrapping = !hasDefaultBranch;
    if (hasDefaultBranch) {
      run("gh", ["repo", "clone", mirror.repository, workspace, "--", "--branch", defaultBranch]);
    } else {
      await mkdir(workspace, { recursive: true });
      run("git", ["init", "--initial-branch", defaultBranch], { cwd: workspace });
      run("git", ["remote", "add", "origin", `https://github.com/${mirror.repository}.git`], { cwd: workspace });
    }
    const entries = await readdir(workspace);
    for (const entry of entries) if (entry !== ".git") await rm(path.join(workspace, entry), { recursive: true, force: true });
    for (const mapping of mirror.paths) await copyTrackedMapping(mapping, workspace);
    run("git", ["add", "--all"], { cwd: workspace });
    if (!bootstrapping && capture("git", ["status", "--porcelain"], { cwd: workspace }) === "") {
      console.log(`${name}: already synchronized; no changes.`);
      continue;
    }
    run("git", ["-c", "user.name=Tidelight Mirror Bot", "-c", "user.email=tidelight-mirror-bot@users.noreply.github.com", "commit", "-m", `chore(sync): mirror ${name} from ${head}`], { cwd: workspace });
    run("gh", ["auth", "setup-git"]);
    if (bootstrapping) {
      run("git", ["push", "origin", defaultBranch], { cwd: workspace });
      console.log(`${name}: initialized empty ${mirror.repository} on ${defaultBranch}; future updates use pull requests.`);
      continue;
    }
    const branch = `sync/${name}-${runId}`;
    run("git", ["checkout", "-b", branch], { cwd: workspace });
    run("git", ["push", "--set-upstream", "origin", branch], { cwd: workspace });
    const title = `chore(sync): update ${name} from mother repository`;
    const existing = capture("gh", ["pr", "list", "--repo", mirror.repository, "--head", branch, "--json", "url", "--jq", ".[0].url // empty"]);
    if (!existing) {
      run("gh", ["pr", "create", "--repo", mirror.repository, "--base", defaultBranch, "--head", branch, "--title", title, "--body", `Automated path-aware mirror from ${config.canonicalRepository} at ${head}.\n\nThis repository is a generated distribution. Review and merge this PR; make source changes in the mother repository.`]);
    } else console.log(`${name}: synchronization PR already exists: ${existing}`);
  }
} finally {
  await rm(tmp, { recursive: true, force: true });
}
