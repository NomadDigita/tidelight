import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isTidelightOperator } from "@/lib/auth/operator-access";

export const dynamic = "force-dynamic";
export const metadata = { title: "Operator console | Tidelight" };

const controls = [
  { eyebrow: "ACCESS GOVERNANCE", title: "Futures live access", detail: "Review requests, terms acceptance, and operator decisions.", href: "/settings/futures-access", action: "Open review queue" },
  { eyebrow: "PRODUCT OPERATIONS", title: "Core workspace controls", detail: "Manage the existing research, account, and execution settings.", href: "/settings", action: "Open settings" },
  { eyebrow: "EXECUTION OVERSIGHT", title: "US stock perpetuals", detail: "Inspect the Futures workstation and current execution mode.", href: "/futures", action: "Open Futures desk" },
];

export default async function OperatorConsolePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isTidelightOperator(user)) redirect("/overview");

  return <main className="content-wrap inner-page">
    <section className="page-heading compact-heading">
      <div><div className="eyebrow"><span className="eyebrow-line" /> PRIVATE OPERATIONS</div><h1>Operator <span>console.</span></h1><p>Restricted Tidelight controls for authorized operators. Your access is verified on the server.</p></div>
    </section>
    <section className="settings-card" aria-label="Operator identity">
      <div className="eyebrow small-eyebrow">SIGNED IN AS</div>
      <h2>{user.email}</h2>
      <p>Operator tools are available only to confirmed, allowlisted accounts or accounts assigned an operator role in Supabase Auth.</p>
    </section>
    <div className="settings-layout" style={{ marginTop: 20 }}>
      {controls.map((control) => <section className="settings-card" key={control.href}>
        <div className="eyebrow small-eyebrow">{control.eyebrow}</div><h2>{control.title}</h2><p>{control.detail}</p>
        <Link className="primary-link" href={control.href}>{control.action} <span>↗</span></Link>
      </section>)}
    </div>
  </main>;
}
