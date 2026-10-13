"use client";

import React from "react";
import styles from "./market-session-indicator.module.css";

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
  const clock = (minute: number) => {
    const value = new Date(Date.UTC(2020, 0, 1, Math.floor(minute / 60), minute % 60));
    return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" }).format(value);
  };
  const etMinute = date ? timeParts(date).minute : 0;
  const sessionSegments = schedule.flatMap((item) => {
    const start = hm(item.startTime), end = hm(item.endTime);
    const colorState = item.state === "regular" ? "regular" : item.state;
    return end > start
      ? [{ start, end, state: colorState }]
      : [{ start: 0, end, state: colorState }, { start, end: 1440, state: colorState }];
  });
  const localClock = (minute: number) => {
    const at = date ? wallClockAt(date, minute < etMinute ? 1 : 0, minute) : null;
    return at ? new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(at) : "—";
  };
  return <details className={styles.shell}>
    <summary className={styles.summary} aria-label={`US equity reference session: ${label}. ${nextText}`}>
      <span className={styles.liveMark} data-open={active?.state === "regular"} aria-hidden="true" />
      <span className={styles.summaryCopy}><b>{label}</b><small>{now ? nextText : "Eastern Time · syncing"}</small></span>
      <span className={styles.clock}>{date ? new Intl.DateTimeFormat("en-US", { timeZone: zone, hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(date) : "ET"}</span>
      <span className={styles.chevron} aria-hidden="true">⌄</span>
    </summary>
    <div className={styles.popover}>
      <div className={styles.popoverHead}><div><span className={styles.kicker}>MARKET HOURS</span><h3>US equity sessions</h3></div><span className={styles.zonePill}>ET · {date ? new Intl.DateTimeFormat("en-US", { timeZone: zone, timeZoneName: "short" }).formatToParts(date).find((part) => part.type === "timeZoneName")?.value : "ET"}</span></div>
      <p className={styles.note}>Underlying equity schedule from Bitget Reality. Token trading remains available outside these hours; liquidity and spreads can change. Exchange holidays may alter the schedule.</p>
      <div className={styles.timelineHead}><b>Session timeline</b><span>{date ? new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(date) : "Local time"} · your local time</span></div>
      <div className={styles.timeline} role="img" aria-label="US equity session timeline in Eastern Time">
        <div className={styles.track}>{sessionSegments.map((segment, index) => <span key={`${segment.state}-${index}`} data-state={segment.state} className={styles.segment} style={{ left: `${segment.start / 14.4}%`, width: `${(segment.end - segment.start) / 14.4}%` }} />)}{date ? <i className={styles.nowMarker} style={{ left: `${etMinute / 14.4}%` }} /> : null}</div>
        <div className={styles.axis}><span>12 AM</span><span>6 AM</span><span>12 PM</span><span>6 PM</span><span>12 AM</span></div>
      </div>
      <div className={styles.sessionList}>{schedule.map((item) => {
        const start = hm(item.startTime), end = hm(item.endTime);
        return <article key={item.state} className={styles.sessionRow} data-current={active?.state === item.state}>
          <span className={styles.sessionGlyph} data-state={item.state} aria-hidden="true">{item.state === "regular" ? "●" : item.state === "pre_market" ? "◒" : item.state === "after_hours" ? "◓" : "◐"}</span>
          <span className={styles.sessionName}><b>{sessionCopy[item.state] ?? item.state.replaceAll("_", " ")}</b><small>{item.state === "regular" ? "Highest reference liquidity" : item.state === "overnight" ? "Overnight reference session" : "Extended-hours reference session"}</small></span>
          <span className={styles.sessionTimes}><b>{item.startTime}–{item.endTime} ET</b><small>{clock(start)}–{clock(end)} ET · {localClock(start)}–{localClock(end)} local</small></span>
        </article>;
      })}</div>
      <div className={styles.footer}><span><i /> Live session estimate</span><span>Exchange holidays may vary</span></div>
    </div>
  </details>;
}
