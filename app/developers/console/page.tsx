import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import DeveloperConsole from "./ui";
import { ThemeQuickSwitch } from "@/app/ui/theme-provider";
import "../tidelight-developers.css";
import "../platform-polish.css";

export default async function ConsolePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return <main className="tic tic-console"><header className="tic-console-header"><Link href="/developers" className="tic-brand">Tidelight <span>Intelligence Cloud</span></Link><ThemeQuickSwitch/></header><div className="tic-signin"><p className="tic-eyebrow">TIDELIGHT / INTELLIGENCE CLOUD</p><h1>Sign in to your developer workspace.</h1><p>Your projects and credentials are private to your account.</p><Link href="/login?next=%2Fdevelopers%2Fconsole" className="tic-button tic-primary">Sign in →</Link></div></main>;
  return <DeveloperConsole userId={user.id} />;
}
