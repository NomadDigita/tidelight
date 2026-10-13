"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AccountCopyButton from "@/app/ui/account-copy-button";

export type AccountRow = { label: string; detail: string; href?: string; value?: string; icon: string; state?: string };
export type AccountGroup = { id: string; title: string; intro: string; rows: AccountRow[] };

function Row({ item }: { item: AccountRow }) {
  const content = <><span className="account-center-icon" aria-hidden="true">{item.icon}</span><span className="account-center-row-copy"><b>{item.label}</b><small>{item.detail}</small></span>{item.value ? <span className="account-center-row-value">{item.value}</span> : null}{item.state ? <span className="account-center-row-state">{item.state}</span> : null}{item.href ? <span className="account-center-arrow" aria-hidden="true">→</span> : null}</>;
  return item.href ? <Link className="account-center-row" href={item.href}>{content}</Link> : <div className="account-center-row account-center-row-static">{content}</div>;
}

export default function AccountTabs({ groups, userId }: { groups: AccountGroup[]; userId?: string }) {
  const [selectedId, setSelectedId] = useState(groups[0]?.id ?? "my-info");

  useEffect(() => {
    const syncFromHash = () => {
      const requested = window.location.hash.slice(1);
      if (groups.some(group => group.id === requested)) setSelectedId(requested);
    };
    syncFromHash();
    window.addEventListener("popstate", syncFromHash);
    window.addEventListener("hashchange", syncFromHash);
    return () => {
      window.removeEventListener("popstate", syncFromHash);
      window.removeEventListener("hashchange", syncFromHash);
    };
  }, [groups]);

  function selectTab(id: string) {
    setSelectedId(id);
    window.history.pushState(null, "", `#${id}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const group = groups.find(item => item.id === selectedId) ?? groups[0];
  if (!group) return null;

  return <>
    <div className="account-center-tabs" role="tablist" aria-label="Account sections">
      {groups.map(item => <button className="account-center-tab" type="button" role="tab" id={`tab-${item.id}`} aria-controls={`panel-${item.id}`} aria-selected={selectedId === item.id} tabIndex={selectedId === item.id ? 0 : -1} key={item.id} onClick={() => selectTab(item.id)}>{item.title}</button>)}
    </div>
    <section className="account-center-group" id={`panel-${group.id}`} role="tabpanel" aria-labelledby={`tab-${group.id}`} tabIndex={0}>
      <div className="account-center-group-head"><div><span className="eyebrow">ACCOUNT CENTER</span><h2>{group.title}</h2></div><p>{group.intro}</p></div>
      <div className="account-center-list">{group.rows.map(item => item.label === "Tidelight UID" && userId ? <div className="account-center-row account-center-row-static" key={item.label}><span className="account-center-icon" aria-hidden="true">{item.icon}</span><span className="account-center-row-copy"><b>{item.label}</b><small>{item.detail}</small></span><AccountCopyButton value={userId} /></div> : <Row item={item} key={item.label} />)}</div>
    </section>
  </>;
}
