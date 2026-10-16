"use client";

import { useEffect, useRef, useState } from "react";

export type PackageSection = { id: string; label: string };

export const packageSections = {
  sdk: [
    { id: "overview", label: "Overview" }, { id: "quickstart", label: "Quickstart" },
    { id: "api", label: "API surface" }, { id: "compatibility", label: "Compatibility" },
    { id: "security", label: "Security" }, { id: "releases", label: "Releases" },
  ],
  mcp: [
    { id: "overview", label: "Overview" }, { id: "quickstart", label: "Quickstart" },
    { id: "tools", label: "API & tools" }, { id: "examples", label: "Examples" },
    { id: "compatibility", label: "Compatibility" }, { id: "security", label: "Security" },
    { id: "releases", label: "Releases" },
  ],
  python: [
    { id: "overview", label: "Overview" }, { id: "quickstart", label: "Quickstart" },
    { id: "api", label: "API surface" }, { id: "compatibility", label: "Compatibility" },
    { id: "security", label: "Security" }, { id: "releases", label: "Releases" },
  ],
  react: [
    { id: "overview", label: "Overview" }, { id: "quickstart", label: "Quickstart" },
    { id: "hooks", label: "Hooks" }, { id: "components", label: "Components" },
    { id: "examples", label: "Examples" }, { id: "security", label: "Security" },
    { id: "releases", label: "Releases" },
  ],
  cli: [
    { id: "overview", label: "Overview" }, { id: "quickstart", label: "Quickstart" },
    { id: "commands", label: "Commands" }, { id: "security", label: "Security" },
    { id: "examples", label: "Examples" }, { id: "releases", label: "Releases" },
  ],
} as const satisfies Record<string, readonly PackageSection[]>;

export function PackageSectionNav({ sections }: { sections: readonly PackageSection[] }) {
  const [activeSection, setActiveSection] = useState(sections[0]?.id ?? "");
  const userScroll = useRef(false);

  useEffect(() => {
    if (!sections.length) return;

    const validIds = new Set(sections.map(({ id }) => id));
    const updateFromScroll = () => {
      const activationLine = Math.min(300, Math.max(180, window.innerHeight * 0.3));
      let current = sections[0].id;
      for (const { id } of sections) {
        const section = document.getElementById(id);
        if (section && section.getBoundingClientRect().top <= activationLine) current = id;
      }
      setActiveSection(current);
    };

    let frame = 0;
    const scheduleScrollUpdate = () => {
      if (!userScroll.current) return;
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        updateFromScroll();
      });
    };
    const markUserScrollIntent = () => { userScroll.current = true; };
    const updateFromHash = () => {
      userScroll.current = false;
      const hash = decodeURIComponent(window.location.hash.slice(1));
      if (validIds.has(hash)) setActiveSection(hash);
    };

    window.addEventListener("hashchange", updateFromHash);
    window.addEventListener("scroll", scheduleScrollUpdate, { passive: true });
    window.addEventListener("resize", scheduleScrollUpdate, { passive: true });
    window.addEventListener("wheel", markUserScrollIntent, { passive: true });
    window.addEventListener("touchmove", markUserScrollIntent, { passive: true });
    window.addEventListener("keydown", markUserScrollIntent);
    const initialHash = decodeURIComponent(window.location.hash.slice(1));
    frame = window.requestAnimationFrame(() => {
      frame = 0;
      if (validIds.has(initialHash)) {
        setActiveSection(initialHash);
        document.getElementById(initialHash)?.scrollIntoView({ block: "start" });
      } else {
        updateFromScroll();
      }
    });
    return () => {
      window.removeEventListener("hashchange", updateFromHash);
      window.removeEventListener("scroll", scheduleScrollUpdate);
      window.removeEventListener("resize", scheduleScrollUpdate);
      window.removeEventListener("wheel", markUserScrollIntent);
      window.removeEventListener("touchmove", markUserScrollIntent);
      window.removeEventListener("keydown", markUserScrollIntent);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [sections]);

  return (
    <nav className="tic-package-detail-nav" aria-label="Package sections">
      <span>ON THIS PAGE</span>
      {sections.map(({ id, label }) => (
        <a
          key={id}
          href={`#${id}`}
          className={activeSection === id ? "is-active" : undefined}
          aria-current={activeSection === id ? "location" : undefined}
          onClick={() => { userScroll.current = false; setActiveSection(id); }}
        >
          {label}
        </a>
      ))}
    </nav>
  );
}
