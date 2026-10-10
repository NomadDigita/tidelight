import type { Metadata } from "next";
import "./globals.css";
import "./theme-polish.css";
import "./nightwatch.css";
import { createClient } from "@/lib/supabase/server";
import WorkspaceShell from "./ui/workspace-shell";
import { ThemeProvider } from "./ui/theme-provider";
import SupportCompanion from "./ui/support-companion";
import "./support-companion.css";
import "./landing.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://tidelight.app"),
  title: "Tidelight — See the signal between sessions",
  description: "An after-hours research desk for tokenized US equities. Follow market events with clear context, scenarios, and sources.",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/tidelight-mark.svg", type: "image/svg+xml" },
    ],
  },
  manifest: "/manifest.webmanifest",
  openGraph: {
    title: "Tidelight — See the signal between sessions",
    description: "Clear, source-led research for markets that never sleep.",
    images: ["/tidelight-social.svg"],
    type: "website",
  },
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("community_profiles").select("display_name,avatar_url").eq("id", user.id).maybeSingle()
    : { data: null };
  const metadata = user?.user_metadata ?? {};
  const metadataAvatar = typeof metadata.avatar_url === "string"
    ? metadata.avatar_url
    : typeof metadata.picture === "string" ? metadata.picture : null;
  const displayName = profile?.display_name?.trim()
    || (typeof metadata.full_name === "string" ? metadata.full_name : null)
    || user?.email?.split("@")[0]
    || null;

  return <html lang="en" suppressHydrationWarning><body><ThemeProvider><WorkspaceShell email={user?.email ?? null} avatarUrl={profile?.avatar_url ?? metadataAvatar} displayName={displayName}>{children}</WorkspaceShell><SupportCompanion /></ThemeProvider></body></html>;
}
