import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import BriefLibrary from "@/app/ui/brief-library";

export default async function BriefsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data } = user
    ? await supabase.from("research_runs").select("id, question, status, summary, model_name, event_type, created_at").order("created_at", { ascending: false }).limit(50)
    : { data: [] };

  return <div className="content-wrap inner-page briefs-page">
    <section className="page-heading compact-heading"><div><div className="eyebrow"><span className="eyebrow-line" /> YOUR PRIVATE LIBRARY</div><h1>Saved <span>briefs.</span></h1><p>A calm place to return to your research trail, questions, and source-backed notes.</p></div><Link className="primary-link" href="/research">New research note <span>↗</span></Link></section>
    {user ? <BriefLibrary runs={data ?? []} /> : <div className="sign-in-panel"><div className="empty-glyph">▤</div><div><span className="eyebrow small-eyebrow">PRIVATE BY DEFAULT</span><h2>Your saved work lives here.</h2><p>Sign in to save research notes and revisit them across sessions.</p><Link className="primary-link" href="/login">Sign in to continue <span>↗</span></Link></div></div>}
    <div className="route-footnote"><span>i</span> Briefs are scoped to your signed-in account with Supabase row-level security.</div>
  </div>;
}
