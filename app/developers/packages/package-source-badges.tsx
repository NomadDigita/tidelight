import { packageCatalog, type DeveloperPackage, type PackageId } from "./catalog.generated";

function compatibilityLabel(id: PackageId) {
  const item: DeveloperPackage | undefined = packageCatalog.find((entry) => entry.id === id);
  if (!item) return "Compatibility details unavailable";
  const { compatibility } = item;

  if (compatibility.declaredPython) {
    return `Python ${compatibility.declaredPython} declared · CI ${compatibility.testedPython?.join(" · ") ?? "not listed"}`;
  }
  if (id === "react") {
    const peerRange = compatibility.peerDependencies?.react ?? "not declared";
    return `React peers ${peerRange} · CI ${compatibility.testedReact?.join(" · ") ?? "not listed"}`;
  }
  const testedNode = compatibility.testedNode?.join(" · ") ?? "not listed";
  return compatibility.declaredNode
    ? `Node ${compatibility.declaredNode} declared · CI ${testedNode}`
    : `Node ${testedNode} in CI`;
}

export function PackageSourceBadges({ packageId }: { packageId: PackageId }) {
  const item: DeveloperPackage | undefined = packageCatalog.find((entry) => entry.id === packageId);
  if (!item) return null;

  const status = item.distribution.state.kind === "name_unresolved"
    ? `${item.distribution.registry.toUpperCase()} name unresolved · unpublished`
    : "Source present · unpublished";

  return <div className="tic-package-detail-badges" aria-label="Package source and compatibility facts">
    <span className="tic-package-state-pill"><i aria-hidden="true"/> {status}</span>
    <span>{item.display.versionLabel}</span>
    <span>{compatibilityLabel(packageId)}</span>
  </div>;
}
