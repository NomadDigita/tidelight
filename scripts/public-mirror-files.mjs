import { execFileSync } from "node:child_process";

export function getTrackedMirrorFiles(repositoryRoot, sourcePath) {
  return execFileSync("git", ["ls-files", "-z", "--", sourcePath], { cwd: repositoryRoot, encoding: "utf8" })
    .split("\0")
    .filter(Boolean);
}
