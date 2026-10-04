"use client";

import Link from "next/link";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <div className="content-wrap error-screen"><div className="eyebrow"><span className="eyebrow-line" /> A MOMENT IN THE CURRENT</div><h1>That signal slipped <span>away.</span></h1><p>Something unexpected interrupted this page. Your saved research is still safe.</p><div className="error-actions"><button className="primary-link" onClick={reset}>Try again <span>↻</span></button><Link className="secondary-link" href="/">Return to overview <span>↗</span></Link></div></div>;
}
