"use client";

import { useEffect, useState } from "react";

export type PackageSection = { id: string; label: string };

export function PackageSectionNav({ sections }: { sections: PackageSection[] }) {
  const [activeSection, setActiveSection] = useState(sections[0]?.id ?? "");
  const sectionIds = sections.map(section => section.id).join("|");

  useEffect(() => {
    const ids = sectionIds.split("|").filter(Boolean);
    const targets = ids
      .map(id => document.getElementById(id))
      .filter((target): target is HTMLElement => target instanceof HTMLElement);

    if (!targets.length) return;

    const syncFromHash = () => {
      const hash = decodeURIComponent(window.location.hash.slice(1));
      if (ids.includes(hash)) setActiveSection(hash);
    };
    const syncFromScroll = () => {
      const marker = window.innerHeight * 0.24;
      const ordered = targets
        .map(target => ({ target, top: target.getBoundingClientRect().top, bottom: target.getBoundingClientRect().bottom }))
        .filter(item => item.bottom > marker)
        .sort((left, right) => left.top - right.top);
      const current = [...ordered].reverse().find(item => item.top <= marker) ?? ordered[0];
      const atPageEnd = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 4;
      setActiveSection((atPageEnd ? targets.at(-1) : current?.target)?.id ?? targets[0].id);
    };

    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(syncFromScroll);
    };
    const observer = new IntersectionObserver(syncFromScroll, { rootMargin: "-18% 0px -68% 0px", threshold: [0, 0.1] });

    targets.forEach(target => observer.observe(target));
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("hashchange", syncFromHash);
    syncFromHash();
    syncFromScroll();
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("hashchange", syncFromHash);
      cancelAnimationFrame(frame);
    };
  }, [sectionIds]);

  const ids = sectionIds.split("|");
  return <nav className="tic-package-detail-nav" aria-label="Package sections">
    <span>ON THIS PAGE</span>
    {sections.map((section, index) => <a
      key={section.id}
      href={`#${section.id}`}
      aria-current={ids[index] === activeSection ? "location" : undefined}
      onClick={() => setActiveSection(section.id)}
    >{section.label}</a>)}
  </nav>;
}
