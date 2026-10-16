import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../app/developers/packages/", import.meta.url);
const routes = {
  sdk: "package-detail.tsx",
  mcp: "mcp-detail.tsx",
  python: "python-detail.tsx",
  react: "react-detail.tsx",
  cli: "cli-detail.tsx",
};

test("all package detail routes use the shared section navigation and valid section IDs", async () => {
  const component = await readFile(new URL("package-section-nav.tsx", root), "utf8");
  assert.match(component, /aria-current=\{activeSection === id \? "location" : undefined\}/);
  assert.match(component, /window\.addEventListener\("hashchange"/);
  assert.match(component, /window\.addEventListener\("wheel"/);
  assert.match(component, /window\.addEventListener\("touchmove"/);
  assert.match(component, /requestAnimationFrame/);
  assert.match(component, /scrollIntoView\(\{ block: "start" \}\)/);
  for (const [key, file] of Object.entries(routes)) {
    const page = await readFile(new URL(file, root), "utf8");
    assert.ok(page.includes(`<PackageSectionNav sections={packageSections.${key}} />`), `${key} does not use the shared navigation`);
    const sectionList = component.match(new RegExp(`${key}: \\[([\\s\\S]*?)\\n  \\]`))?.[1];
    assert.ok(sectionList, `${key} section map is missing`);
    const ids = [...sectionList.matchAll(/id: "([a-z-]+)"/g)].map((match) => match[1]);
    assert.ok(ids.length >= 5, `${key} section list is unexpectedly short`);
    for (const id of ids) assert.ok(page.includes(`id="${id}"`), `${key} nav references missing section #${id}`);
  }
});
