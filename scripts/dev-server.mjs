import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const nextCli = fileURLToPath(new URL("../node_modules/next/dist/bin/next", import.meta.url));
const incoming = process.argv.slice(2);
const args = [];
for (let index = 0; index < incoming.length; index += 1) {
  const argument = incoming[index];
  if (argument === "--strictPort") continue;
  if (argument === "--host") {
    args.push("--hostname", incoming[index + 1] ?? "0.0.0.0");
    index += 1;
    continue;
  }
  args.push(argument);
}

const child = spawn(process.execPath, [nextCli, "dev", ...args], { stdio: "inherit" });
child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});
