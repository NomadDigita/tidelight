export default function Loading() {
  return <div className="content-wrap loading-screen" role="status" aria-label="Loading Tidelight">
    <div className="eyebrow"><span className="eyebrow-line" /> TIDELIGHT RESEARCH DESK</div>
    <div className="loading-skeleton loading-heading" /><div className="loading-skeleton loading-copy" />
    <div className="loading-grid">{[1, 2, 3].map((item) => <div className="loading-skeleton loading-card" key={item} />)}</div>
    <span className="loading-caption">Gathering the latest context…</span>
  </div>;
}
