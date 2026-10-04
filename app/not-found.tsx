import Link from "next/link";

export default function NotFound() {
  return <div className="content-wrap error-screen not-found-screen"><div className="eyebrow"><span className="eyebrow-line" /> OFF THE MAP</div><div className="not-found-code">404</div><h1>This page is out <span>of view.</span></h1><p>The address may have changed, or the page may no longer be here.</p><div className="error-actions"><Link className="primary-link" href="/">Back to overview <span>↗</span></Link><Link className="secondary-link" href="/research">Open research desk <span>↗</span></Link></div></div>;
}
