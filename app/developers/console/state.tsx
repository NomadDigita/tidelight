import Link from "next/link";

type StateAction = { label: string; onClick?: () => void; href?: string };

export function ConsoleState({
  kind = "empty",
  eyebrow,
  title,
  description,
  action,
}: {
  kind?: "empty" | "error" | "loading";
  eyebrow?: string;
  title: string;
  description: string;
  action?: StateAction;
}) {
  return (
    <section className={`tic-state tic-state-${kind}`} aria-live={kind === "loading" ? "polite" : undefined}>
      <span className="tic-state-mark" aria-hidden="true">
        {kind === "loading" ? <i /> : kind === "error" ? "!" : "—"}
      </span>
      <div className="tic-state-copy">
        {eyebrow && <p className="tic-state-eyebrow">{eyebrow}</p>}
        <h2>{title}</h2>
        <p>{description}</p>
        {action && (
          action.href
            ? <Link className="tic-button" href={action.href}>{action.label}</Link>
            : action.onClick && <button className="tic-button" type="button" onClick={action.onClick}>{action.label}</button>
        )}
      </div>
    </section>
  );
}

export function ConsoleSkeleton() {
  return (
    <div className="tic-loading-layout" role="status" aria-label="Loading your developer workspace">
      <span className="tic-sr-only">Loading your developer workspace…</span>
      <div className="tic-skeleton tic-skeleton-label" />
      <div className="tic-skeleton tic-skeleton-title" />
      <div className="tic-skeleton tic-skeleton-copy" />
      <div className="tic-skeleton-stats"><i /><i /><i /></div>
      <div className="tic-skeleton tic-skeleton-panel" />
    </div>
  );
}
