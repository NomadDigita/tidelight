import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isTidelightOperator } from "@/lib/auth/operator-access";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const metadata = { title: "Operator console | Tidelight" };

const controls = [
  { eyebrow: "ACCESS GOVERNANCE", title: "Futures live access", detail: "Review requests, terms acceptance, and operator decisions.", href: "/settings/futures-access", action: "Open review queue" },
  { eyebrow: "PRODUCT OPERATIONS", title: "Core workspace controls", detail: "Manage the existing research, account, and execution settings.", href: "/settings", action: "Open settings" },
  { eyebrow: "EXECUTION OVERSIGHT", title: "Stocks perpetual desk", detail: "Inspect the stock perpetual workstation and current execution mode.", href: "/futures", action: "Open Stocks perpetual desk" },
];

export default async function OperatorConsolePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isTidelightOperator(user)) redirect("/overview");

  let pendingRequests: number | null = null;
  try {
    const admin = createAdminClient();
    const { count, error } = await admin
      .from("futures_live_access_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");
    if (!error) pendingRequests = count ?? 0;
  } catch {
    // Keep the console available if the operational count is temporarily unavailable.
  }

  return <main className="content-wrap inner-page">
    <section className="page-heading compact-heading">
      <div><div className="eyebrow"><span className="eyebrow-line" /> PRIVATE OPERATIONS</div><h1>Operator <span>console.</span></h1><p>Restricted Tidelight controls for authorized operators. Your access is verified on the server.</p></div>
    </section>
    <section className="settings-card operator-identity-card" aria-label="Operator identity">
      <div className="eyebrow small-eyebrow">SIGNED IN AS</div>
      <h2 className="operator-identity-email">{user.email}</h2>
      <p>Operator tools are available only to confirmed, allowlisted accounts or accounts assigned an operator role in Supabase Auth.</p>
    </section>
    <div className="settings-layout" style={{ marginTop: 20 }}>
      {controls.map((control) => <section className="settings-card" key={control.href}>
        <div className="eyebrow small-eyebrow">{control.eyebrow}</div><h2>{control.title}</h2><p>{control.detail}</p>{control.href === "/settings/futures-access" ? <div className="connection-row"><span><i className="pending-dot" /> Pending review requests</span><b>{pendingRequests === null ? "UNAVAILABLE" : pendingRequests}</b></div> : null}
        <Link className="primary-link" href={control.href}>{control.action} <span>↗</span></Link>
      </section>)}
    </div>
  </main>;
}
