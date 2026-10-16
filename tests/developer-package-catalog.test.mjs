import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { renderCatalogContent, loadPackageEntries } from "../scripts/generate-developer-package-catalog.mjs";

const root = new URL("../", import.meta.url);

// Node cannot directly import the generated TypeScript module; load the validated
// source entries from the same manifest reader used to produce it.
const entries = await loadPackageEntries();

test("generated directory catalog stays byte-for-byte aligned with source metadata", async () => {
  const generated = await readFile(new URL("app/developers/packages/catalog.generated.ts", root), "utf8");
  assert.equal(generated, renderCatalogContent(entries));
});

test("the directory lists each source distribution once and links its matching detail page", () => {
  assert.deepEqual(entries.map(entry => entry.id), ["sdk", "mcp", "python", "react", "cli"]);
  assert.equal(new Set(entries.map(entry => entry.source.path)).size, entries.length);
  for (const entry of entries) {
    assert.equal(entry.source.present, true);
    assert.equal(entry.display.name, entry.distribution.intendedName);
    assert.equal(entry.display.href, `/developers/packages/${entry.id}`);
  }
});

test("manifest versions and npm private flags feed the source label", async () => {
  for (const entry of entries) {
    const manifestPath = entry.id === "python"
      ? new URL(`${entry.source.path}/pyproject.toml`, root)
      : new URL(`${entry.source.path}/package.json`, root);
    const manifest = await readFile(manifestPath, "utf8");
    assert.match(entry.display.versionLabel, new RegExp(entry.source.version.replaceAll(".", "\\.")));
    assert.match(manifest, new RegExp(entry.source.manifestName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    if (entry.id !== "python") {
      assert.equal(entry.source.private, true);
      assert.match(manifest, /"private"\s*:\s*true/);
    }
    assert.equal("installCommand" in entry.display, false);
    assert.notEqual(entry.distribution.state.kind, "published");
    assert.equal("checkedAt" in entry.distribution.state, false);
  }
});

test("Python distribution name conflict and compatibility are explicit", () => {
  const python = entries.find(entry => entry.id === "python");
  assert.equal(python.source.manifestName, "tidelight-sdk");
  assert.equal(python.distribution.intendedName, "tidelight");
  assert.equal(python.distribution.state.kind, "name_unresolved");
  assert.equal(python.compatibility.declaredPython, ">=3.10");
  assert.deepEqual(python.compatibility.testedPython, ["3.10", "3.12"]);
});

test("React peer range is separated from the tested React release", () => {
  const react = entries.find(entry => entry.id === "react");
  assert.equal(react.compatibility.peerDependencies.react, "^18.0.0 || ^19.0.0");
  assert.deepEqual(react.compatibility.testedReact, ["19.2.8"]);
  assert.notDeepEqual(react.compatibility.peerDependencies.react, react.compatibility.testedReact);
});

test("directory renders the generated catalog and never derives installability from source readiness", async () => {
  const page = await readFile(new URL("app/developers/packages/page.tsx", root), "utf8");
  assert.match(page, /import \{ packageCatalog \} from "\.\/catalog\.generated"/);
  assert.match(page, /packageCatalog\.map/);
  assert.doesNotMatch(page, /const packages\s*=\s*\[/);
  assert.match(page, /Registry status · not checked live/);
  assert.match(page, /item\.display\.stateLabel/);
  assert.match(page, /Source files present/);
  assert.match(page, /Browse packages/);
  assert.doesNotMatch(page, /source ready/i);
  assert.doesNotMatch(page, /checkedAt/);
});


test("package detail compatibility copy distinguishes declared support from tested runtimes", async () => {
  const pythonPage = await readFile(new URL("app/developers/packages/python-detail.tsx", root), "utf8");
  assert.match(pythonPage, /Python CI tested<\/span><strong>3\.10 · 3\.12/);
  assert.match(pythonPage, /declares Python <code>&gt;=3\.10<\/code>/);
  const reactPage = await readFile(new URL("app/developers/packages/react-detail.tsx", root), "utf8");
  assert.match(reactPage, /PackageSourceBadges packageId="react"/);
  assert.doesNotMatch(reactPage, /React 18 &amp; 19|Version 0\.1\.0 private/);
});

test("mirror workflow runs package catalog freshness check for source and catalog changes", async () => {
  const workflow = await readFile(new URL(".github/workflows/public-mirror-check.yml", root), "utf8");
  assert.equal((workflow.match(/app\/developers\/packages\/\*\*/g) ?? []).length, 2);
  assert.equal((workflow.match(/scripts\/generate-developer-package-catalog\.mjs/g) ?? []).length, 2);
  assert.match(workflow, /run: npm run check:package-catalog/);
});


test("detail headers share generated source, release, and compatibility metadata", async () => {
  const details = [
    ["package-detail.tsx", "sdk"], ["mcp-detail.tsx", "mcp"],
    ["python-detail.tsx", "python"], ["react-detail.tsx", "react"],
    ["cli-detail.tsx", "cli"],
  ];
  for (const [file, id] of details) {
    const source = await readFile(new URL(`app/developers/packages/${file}`, root), "utf8");
    assert.match(source, new RegExp(`PackageSourceBadges packageId="${id}"`));
    assert.doesNotMatch(source, /Version 0\.1\.0 (?:private|source)/);
  }
  const badges = await readFile(new URL("app/developers/packages/package-source-badges.tsx", root), "utf8");
  assert.match(badges, /packageCatalog\.find/);
  assert.match(badges, /compatibilityLabel/);
  assert.match(badges, /name unresolved/);
  assert.match(badges, /Source present · unpublished/);
  assert.doesNotMatch(badges, /Source available|source ready/i);
});

test("package section navigation follows visible sections and exposes the current location", async () => {
  const routes = ["package-detail.tsx", "mcp-detail.tsx", "python-detail.tsx", "react-detail.tsx", "cli-detail.tsx"];
  for (const file of routes) {
    const source = await readFile(new URL(`app/developers/packages/${file}`, root), "utf8");
    assert.match(source, /<PackageSectionNav sections=\{/);
    const ids = [...source.matchAll(/\{ id: "([^"]+)", label:/g)].map(match => match[1]);
    assert.ok(ids.length >= 5, `${file} should expose its package sections`);
    for (const id of ids) assert.match(source, new RegExp(`<section id=["']${id}["']`), `${file} links to missing #${id}`);
  }
  const component = await readFile(new URL("app/developers/packages/package-section-nav.tsx", root), "utf8");
  assert.match(component, /new IntersectionObserver/);
  assert.match(component, /aria-current=\{ids\[index\] === activeSection \? "location" : undefined\}/);
  assert.match(component, /hashchange/);
  const css = await readFile(new URL("app/developers/packages/packages.css", root), "utf8");
  assert.match(css, /tic-package-detail-nav>a\[aria-current="location"\]/);
});

test("package detail clipping preserves sticky section navigation", async () => {
  const css = await readFile(new URL("app/developers/packages/packages.css", root), "utf8");
  assert.match(css, /tic-package-detail-page\{max-width:none;overflow:clip\}/);
});
