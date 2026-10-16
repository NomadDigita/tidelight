import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import YAML from "yaml";

test("candidate workflow is manual, read-only, and cannot publish to a registry", async () => {
  const source = await readFile(new URL("../.github/workflows/package-candidate.yml", import.meta.url), "utf8");
  const workflow = YAML.parse(source);
  assert.ok(workflow.on.workflow_dispatch);
  assert.deepEqual(workflow.permissions, { contents: "read" });
  assert.match(source, /github\.ref == 'refs\/heads\/main'/);
  assert.match(source, /BUILD PACKAGE CANDIDATE/);
  assert.doesNotMatch(source, /id-token:\s*write|npm publish|twine upload|pypa\/gh-action-pypi-publish|NPM_TOKEN|PYPI_API_TOKEN/);
  assert.match(source, /actions\/upload-artifact@v4/);
  assert.match(source, /github\.run_id.*github\.run_attempt/);
  assert.match(source, /retention-days:\s*30/);
  assert.match(source, /\(cd "\$OUT" && find \. -type f ! -name SHA256SUMS/);
});

test("candidate build validates all five intended package distributions", async () => {
  const source = await readFile(new URL("../.github/workflows/package-candidate.yml", import.meta.url), "utf8");
  for (const file of [
    "sdk/typescript/package.json",
    "packages/react/package.json",
    "packages/cli/package.json",
    "public/components/mcp/server/package.json",
    "sdk/python/pyproject.toml",
  ]) assert.ok(source.includes(file), `candidate workflow is missing ${file}`);
  for (const packageDirectory of ["sdk/typescript", "packages/react", "packages/cli", "public/components/mcp/server"]) {
    assert.ok(source.includes(`npm test --prefix ${packageDirectory}`), `candidate workflow does not test ${packageDirectory}`);
    assert.ok(source.includes(`check-npm-package-archive.mjs ${packageDirectory}`), `candidate workflow does not archive-check ${packageDirectory}`);
  }
  assert.match(source, /check-python-package\.py sdk\/python/);
  assert.match(source, /SHA256SUMS/);
  assert.match(source, /SOURCE\.txt/);
});
