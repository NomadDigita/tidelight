#!/usr/bin/env node
import { TidelightClient } from "@tidelight/sdk";
import { OsCredentialStore } from "./credential-store.js";
import { runCli } from "./cli.js";
import { promptSecret } from "./prompt-secret.js";

const controller = new AbortController();
process.once("SIGINT", () => controller.abort(new Error("Interrupted.")));

const code = await runCli(process.argv.slice(2), {
  stdout: process.stdout,
  stderr: process.stderr,
  env: process.env,
  credentialStore: new OsCredentialStore(),
  promptSecret,
  createClient: apiKey => new TidelightClient({ apiKey }),
  signal: controller.signal,
});
process.exitCode = code;
