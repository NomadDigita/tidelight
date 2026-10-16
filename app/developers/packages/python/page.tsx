import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { ThemeQuickSwitch } from "@/app/ui/theme-provider";
import { PythonPackageDetail } from "../python-detail";
import "../../tidelight-developers.css";
import "../../platform-polish.css";
import "../packages.css";

export const metadata: Metadata = {
  title: { absolute: "Python SDK — Official packages" },
  description: "Source-backed guide to the unpublished Tidelight Python SDK, supported API workflows, and secure server-side use.",
  alternates: { canonical: "https://tidelight.app/developers/packages/python" },
};

export default function PythonPackagePage() {
  return <main className="tic tic-packages-page tic-package-detail-page">
    <nav className="tic-top"><Link href="/developers" className="tic-brand"><Image src="/tidelight-mark.svg" alt="" width={28} height={28}/><span className="tic-brand-name">Tidelight</span><span>Intelligence Cloud</span></Link><div><Link href="/developers/packages">Packages</Link><ThemeQuickSwitch/><Link href="/developers/console" className="tic-button">Open console <span aria-hidden="true">→</span></Link></div></nav>
    <div className="tic-package-breadcrumb"><Link href="/developers/packages">Packages</Link><span>/</span><span>Python SDK</span></div>
    <PythonPackageDetail />
    <footer className="tic-footer"><Link href="/developers" className="tic-brand"><Image src="/tidelight-mark.svg" alt="" width={23} height={23}/><span className="tic-brand-name">Tidelight</span><span>Intelligence Cloud</span></Link><Link href="/developers/packages">All packages →</Link></footer>
  </main>;
}
