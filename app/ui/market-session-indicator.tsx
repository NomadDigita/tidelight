"use client";

import React from "react";

type SessionItem = { state: string; timeZone: string; startTime: string; endTime: string };
type MarketSchedule = { market: string; daylightType: string | null; schedule: SessionItem[] } | null;
const zone = "America/New_York";
const sessionCopy: Record<string, string> = { pre_market: "Pre-market", regular: "Market open", after_hours: "After-hours", overnight: "Overnight" };
const timeParts = (date: Date) => {
  const values = new Intl.DateTimeFormat("en-US", { timeZone: zone, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const read = (type: string) => values.find((item) => item.type === type)?.value ?? "0";
  return { weekday: read("weekday"), minute: Number(read("hour")) * 60 + Number(read("minute")) };
};
const hm = (value: string) => { const [hours, minutes] = value.split(":").map(Number); return hours * 60 + minutes; };
function wallClockAt(now: Date, dayOffset: number, targetMinute: number) {
  const targetWeekday = timeParts(new Date(now.getTime() + dayOffset * 86400000)).weekday;
  let guess = now.getTime() + (dayOffset * 1440 + targetMinute - timeParts(now).minute) * 60000;
  for (let attempt = 0; attempt < 3; attempt++) {
    const observed = timeParts(new Date(guess));
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const localDayDelta = days.indexOf(targetWeekday) - days.indexOf(observed.weekday);
    guess += (localDayDelta * 1440 + targetMinute - observed.minute) * 60000;
  }
  return new Date(guess);
}
function currentSession(schedule: SessionItem[], now: Date) {
  const { weekday, minute } = timeParts(now);
  if (weekday === "Sat" || (weekday === "Sun" && minute < 20 * 60)) return null;
  return schedule.find((item) => {
    const start = hm(item.startTime), end = hm(item.endTime);
    if (item.state === "overnight") {
      if (weekday === "Sun") return minute >= start;
      if (weekday === "Fri" || weekday === "Sat") return minute < end;
      return minute >= start || minute < end;
    }
    return weekday !== "Sun" && weekday !== "Sat" && minute >= start && minute < end;
  }) ?? null;
}
function nextOpen(schedule: SessionItem[], now: Date) {
  const candidates = schedule.filter((item) => item.state === "pre_market" || item.state === "overnight");
  let best: { item: SessionItem; at: Date } | null = null;
  for (let dayOffset = 0; dayOffset < 9; dayOffset++) {
    const candidateDay = new Date(now.getTime() + dayOffset * 86400000);
    const weekday = timeParts(candidateDay).weekday;
    for (const item of candidates) {
      if (item.state === "pre_market" && (weekday === "Sat" || weekday === "Sun")) continue;
      if (item.state === "overnight" && !["Sun", "Mon", "Tue", "Wed", "Thu"].includes(weekday)) continue;
      const [hour, minute] = item.startTime.split(":").map(Number);
      const atDate = wallClockAt(now, dayOffset, hour * 60 + minute);
      if (atDate.getTime() <= now.getTime()) continue;
      if (!best || atDate < best.at) best = { item, at: atDate };
    }
  }
  return best;
}
function duration(ms: number) {
  const total = Math.max(0, Math.floor(ms / 60000));
  const days = Math.floor(total / 1440), hours = Math.floor((total % 1440) / 60), minutes = total % 60;
  return `${days ? `${days}d ` : ""}${hours}h ${String(minutes).padStart(2, "0")}m`;
}

export default function MarketSessionIndicator({ session, status = "unavailable" }: { session: MarketSchedule; status?: string }) {
  const [now, setNow] = React.useState(0);
  React.useEffect(() => { const start = window.setTimeout(() => setNow(Date.now()), 0); const timer = window.setInterval(() => setNow(Date.now()), 30_000); return () => { window.clearTimeout(start); window.clearInterval(timer); }; }, []);
  const date = now ? new Date(now) : null;
  const schedule = session?.schedule ?? [];
  const active = date && status === "available" ? currentSession(schedule, date) : null;
  const next = date && status === "available" ? nextOpen(schedule, date) : null;
  const label = status === "empty" ? "Session schedule unavailable" : status !== "available" ? "Session feed unavailable" : active ? sessionCopy[active.state] ?? active.state.replaceAll("_", " ") : "Market closed";
  let nextText = "Next session pending";
  if (date && status === "available" && active) {
    if (active.state === "regular") nextText = `Closes in ${duration(wallClockAt(date, 0, hm(active.endTime)).getTime() - date.getTime())}`;
    else if (active.state === "pre_market") { const regular = schedule.find((item) => item.state === "regular"); nextText = regular ? `Regular session in ${duration(wallClockAt(date, 0, hm(regular.startTime)).getTime() - date.getTime())}` : "Regular session soon"; }
    else if (active.state === "after_hours") nextText = `Ends in ${duration(wallClockAt(date, 0, hm(active.endTime)).getTime() - date.getTime())}`;
    else { const dayOffset = timeParts(date).minute >= hm(active.startTime) ? 1 : 0; const premarket = schedule.find((item) => item.state === "pre_market"); nextText = premarket ? `Pre-market in ${duration(wallClockAt(date, dayOffset, hm(premarket.startTime)).getTime() - date.getTime())}` : "Pre-market later"; }
  } else if (next && date) nextText = `${next.item.state === "overnight" ? "Overnight" : "Pre-market"} opens in ${duration(next.at.getTime() - date.getTime())}`;
  return <details className={`market-session-indicator${active?.state === "regular" ? " is-open" : ""}`}>
    <summary aria-label={`US equity reference session: ${label}. ${nextText}`}><span className="market-session-light"/><span className="market-session-main"><b>{label}</b><small>{now ? nextText : "Eastern Time · syncing"}</small></span><span className="market-session-clock">{date ? new Intl.DateTimeFormat("en-US", { timeZone: zone, hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(date) : "ET"}</span><i aria-hidden="true">⌄</i></summary>
    <div className="market-session-popover"><b>US equity reference</b><p>This follows Bitget Reality’s published US session schedule in Eastern Time. It describes the underlying equity session; token trading and liquidity can differ. Exchange holidays may change these hours.</p>{schedule.map((item) => <div key={item.state} className={active?.state === item.state ? "current" : ""}><span>{sessionCopy[item.state] ?? item.state.replaceAll("_", " ")}</span><b>{item.startTime}–{item.endTime} ET</b></div>)}</div>
  </details>;
}
