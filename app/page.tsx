import Image from "next/image";
import ResearchWorkspace from "./ui/research-workspace";

const stories = [
  { mark: "↗", tone: "amber", title: "Policy shift puts chip supply chains back in focus", type: "Policy & regulation", age: "38 min ago", tag: "WATCH" },
  { mark: "⌁", tone: "violet", title: "Treasury yields edge lower into the weekend", type: "Macro", age: "2 hr ago", tag: "CONTEXT" },
  { mark: "◌", tone: "blue", title: "EV delivery estimates diverge ahead of updates", type: "Company & sector", age: "5 hr ago", tag: "WATCH" },
];

const watchlist = [
  { symbol: "NVDA", name: "NVIDIA Corporation", mark: "N", tone: "nvidia", change: "+1.28%", direction: "up", points: "1,21 9,19 17,22 26,12 35,17 44,9 53,12 62,4 75,7" },
  { symbol: "TSLA", name: "Tesla, Inc.", mark: "T", tone: "tesla", change: "−0.42%", direction: "down", points: "1,5 10,9 18,6 27,13 36,11 45,18 53,14 63,22 75,25" },
  { symbol: "MSFT", name: "Microsoft Corporation", mark: "M", tone: "microsoft", change: "+0.67%", direction: "up", points: "1,22 10,16 18,20 27,13 36,16 45,10 54,14 64,6 75,4" },
  { symbol: "AMZN", name: "Amazon.com, Inc.", mark: "a", tone: "amazon", change: "−0.18%", direction: "down", points: "1,7 10,10 19,6 28,14 37,13 46,17 55,12 65,23 75,21" },
];

export default function Home() {
  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Main navigation">
        <a className="brand" href="#home" aria-label="Tidelight home">
          <Image src="/tidelight-mark.svg" alt="" width={34} height={34} priority />
          <span>tide<span className="brand-light">light</span><small>MARKET RESEARCH DESK</small></span>
        </a>
        <div className="workspace-label">WORKSPACE</div>
        <nav className="nav-list">
          <a className="nav-link active" href="#home"><span className="nav-icon">◫</span> Overview</a>
          <a className="nav-link" href="#research"><span className="nav-icon">⌕</span> Research desk</a>
          <a className="nav-link" href="#watchlist"><span className="nav-icon">⌁</span> Watchlist <span className="nav-count">04</span></a>
          <a className="nav-link" href="#briefs"><span className="nav-icon">▤</span> Saved briefs</a>
        </nav>
        <div className="sidebar-bottom">
          <div className="data-status"><span className="status-dot" /><div><b>Demo environment</b><small>Sample research only</small></div></div>
          <div className="user-profile"><div className="avatar">A</div><div><b>Asiwaju</b><small>Personal workspace</small></div><span className="more">···</span></div>
        </div>
      </aside>
      <main className="main-area" id="home">
        <header className="topbar">
          <div className="mobile-brand"><Image src="/tidelight-mark.svg" alt="" width={28} height={28} /> Tidelight</div>
          <div className="breadcrumb">Workspace <span>/</span> Overview</div>
          <div className="top-actions"><span className="market-clock"><i /> US MARKET <b>AFTER HOURS</b></span><button className="icon-button" aria-label="Notifications">♧<span className="notification-dot" /></button><div className="top-avatar">A</div></div>
        </header>
        <div className="content-wrap">
          <section className="welcome-row">
            <div><div className="eyebrow"><span className="eyebrow-line" /> SUNDAY, OCTOBER 4, 2026 <span className="eyebrow-divider">/</span> YOUR MARKET BRIEF</div><h1>Good morning, Asiwaju<span className="mint-dot">.</span></h1><p className="welcome-copy">The bell may be quiet. The market isn’t.</p></div>
            <button className="date-button">◷ <span>Last 24 hours</span>⌄</button>
          </section>
          <ResearchWorkspace />
          <section className="metric-grid" aria-label="Market overview">
            <article className="metric-card"><div className="metric-top"><span>MARKET PULSE</span><span className="metric-icon">◉</span></div><div className="metric-value">Risk aware <b className="metric-neutral">●</b></div><div className="metric-note">Across 4 tracked names <span>↗</span></div><div className="pulse-bars" aria-hidden="true">{Array.from({length: 24}, (_, i) => <i key={i} />)}</div></article>
            <article className="metric-card"><div className="metric-top"><span>OPEN STORIES</span><span className="metric-icon">⌁</span></div><div className="metric-value">03 <small>worth a closer look</small></div><div className="metric-note">1 new since your last visit <span className="note-warm">+1</span></div><div className="metric-sparkline"><svg viewBox="0 0 280 32" preserveAspectRatio="none" aria-hidden="true"><path d="M0 26 C22 28 30 22 49 24 S77 12 94 17 S122 22 143 13 S164 19 183 8 S213 14 228 9 S255 3 280 5" /></svg></div></article>
            <article className="metric-card"><div className="metric-top"><span>WATCHLIST</span><span className="metric-icon">⌖</span></div><div className="metric-value">04 <small>companies tracked</small></div><div className="watch-chips"><span>NVDA</span><span>TSLA</span><span>MSFT</span><span>AMZN</span></div></article>
          </section>
          <section className="lower-grid">
            <article className="panel stories-panel" id="briefs">
              <div className="panel-heading"><div><div className="eyebrow small-eyebrow">SIGNAL, WITH THE NOISE REMOVED</div><h3>Stories to watch</h3></div><button className="text-button">All stories <span>↗</span></button></div>
              <div className="story-list">{stories.map((story) => <a className="story-row" href="#research" key={story.title}><span className={"story-symbol " + story.tone}>{story.mark}</span><span className="story-main"><b>{story.title}</b><small>{story.type} <i>·</i> {story.age}</small></span><span className={"story-tag " + (story.tag === "WATCH" ? "tag-watch" : "tag-context")}>{story.tag}</span><span className="row-arrow">↗</span></a>)}</div>
              <div className="illustrative-note"><span>i</span> Sample stories shown for interface preview. Live sources will be cited in each research brief.</div>
            </article>
            <article className="panel watchlist-panel" id="watchlist">
              <div className="panel-heading"><div><div className="eyebrow small-eyebrow">A LITTLE CONTEXT GOES A LONG WAY</div><h3>Your watchlist</h3></div><button className="add-button" aria-label="Add to watchlist">＋</button></div>
              {watchlist.map((item) => <div className="watch-row" key={item.symbol}><div className={"ticker-mark " + item.tone}>{item.mark}</div><div className="ticker-info"><b>{item.symbol}</b><small>{item.name}</small></div><div className={"ticker-spark " + (item.direction === "down" ? "down" : "")}><svg viewBox="0 0 76 28" aria-hidden="true"><polyline points={item.points} /></svg></div><div className={"ticker-change " + (item.direction === "up" ? "positive" : "negative")}>{item.change}</div></div>)}
              <div className="watchlist-foot"><span className="live-indicator" /> Illustrative sample prices <span className="updated">· Not live market data</span></div>
            </article>
          </section>
          <footer className="page-footer"><span>© 2026 Tidelight Research</span><span><b>Clarity when the bell is quiet.</b> <i>Built for markets that never sleep.</i></span><span>CONCEPT PREVIEW <span className="footer-dot">●</span></span></footer>
        </div>
      </main>
    </div>
  );
}
