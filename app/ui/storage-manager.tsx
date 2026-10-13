"use client";
import { useEffect, useState } from "react";

const APP_KEY = /^(tidelight|tide)(-|$)/i;
export default function StorageManager() {
  const [usage, setUsage] = useState<{ keys: number; bytes: number; caches: number } | null>(null);
  const [message, setMessage] = useState("");
  function measure() {
    let keys = 0, bytes = 0;
    for (let index = 0; index < localStorage.length; index++) {
      const key = localStorage.key(index);
      if (key && APP_KEY.test(key)) { keys += 1; bytes += new Blob([key, localStorage.getItem(key) ?? ""]).size; }
    }
    setUsage({ keys, bytes, caches: "caches" in window ? 0 : 0 });
    if ("caches" in window) void caches.keys().then(names => setUsage(current => current ? { ...current, caches: names.filter(name => APP_KEY.test(name)).length } : current));
  }
  useEffect(() => { const timer = window.setTimeout(measure, 0); return () => window.clearTimeout(timer); }, []);
  async function clearLocalData() {
    if (!window.confirm("Clear locally stored Tidelight preferences, Tide chat history, and cached files on this device? This does not delete your account, saved server data, or trading records.")) return;
    for (let index = localStorage.length - 1; index >= 0; index--) {
      const key = localStorage.key(index);
      if (key && APP_KEY.test(key)) localStorage.removeItem(key);
    }
    if ("caches" in window) for (const name of await caches.keys()) if (APP_KEY.test(name)) await caches.delete(name);
    measure(); setMessage("Local Tidelight data was cleared from this device.");
  }
  const kib = usage ? (usage.bytes / 1024).toFixed(1) : "—";
  return <div className="storage-manager"><div className="storage-stats"><article><b>{usage?.keys ?? "—"}</b><span>Tidelight settings and local records</span></article><article><b>{kib} KB</b><span>Estimated browser storage used</span></article><article><b>{usage?.caches ?? "—"}</b><span>Tidelight browser caches</span></article></div><div className="storage-manager-note"><b>What this controls</b><p>This page clears Tidelight data saved only in this browser, including Tide chat history and display preferences. Account profiles, saved briefs, watchlists and other server data are managed in their respective account pages and are not removed here.</p></div><button className="storage-clear-button" type="button" onClick={clearLocalData}>Clear local Tidelight data</button><p className="storage-manager-status" role="status">{message}</p></div>;
}
