import type { Metadata } from "next";
import { cookies } from "next/headers";
import "./globals.css";
import "./theme-polish.css";
import "./nightwatch.css";
import { createClient } from "@/lib/supabase/server";
import WorkspaceShell from "./ui/workspace-shell";
import { ThemeProvider } from "./ui/theme-provider";
import { LanguageProvider } from "./ui/language-provider";
import SupportCompanion from "./ui/support-companion";
import ProductQuickActions from "./ui/product-quick-actions";
import { IntelligenceProvider } from "./ui/intelligence-provider";
import "./support-companion.css";
import "./landing.css";
import "./mobile-polish.css";
import "./stock-market.css";
import "./language.css";
import "./product-quick-actions.css";
import "./overview/intelligent-overview.css";

const baseMetadata: Metadata = {
  metadataBase: new URL("https://tidelight.app"),
  alternates: { canonical: "https://tidelight.app" },
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
    url: "https://tidelight.app",
    siteName: "Tidelight",
    images: [{ url: "/tidelight-social.png", width: 1200, height: 630, alt: "Tidelight — clarity after the closing bell" }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Tidelight — See the signal between sessions",
    description: "An after-hours research desk for tokenized US equities. Follow market events with clear context, scenarios, and sources.",
    images: [{ url: "/tidelight-social.png", alt: "Tidelight — clarity after the closing bell" }],
  },
};

export async function generateMetadata(): Promise<Metadata> {
  const cookieStore = await cookies();
  if (cookieStore.get("tidelight-language")?.value !== "zh-CN") return baseMetadata;
  return {
    ...baseMetadata,
    title: "Tidelight — 看清交易时段之间的市场信号",
    description: "面向代币化美股的市场研究工作台。沿着市场事件、证据、影响敞口和情景，做出更清晰的判断。",
    openGraph: { ...baseMetadata.openGraph, title: "Tidelight — 看清交易时段之间的市场信号", description: "清晰、以来源为依据的研究，助你看懂永不休眠的市场。" },
    twitter: { ...baseMetadata.twitter, title: "Tidelight — 看清交易时段之间的市场信号", description: "面向代币化美股的市场研究工作台。沿着市场事件、证据、影响敞口和情景，做出更清晰的判断。" },
  };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies();
  const language = cookieStore.get("tidelight-language")?.value === "zh-CN" ? "zh-CN" : "en";
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

  return <html lang={language} data-language={language} data-theme="daylight" suppressHydrationWarning><body><ThemeProvider><LanguageProvider initialLanguage={language}><IntelligenceProvider><WorkspaceShell email={user?.email ?? null} avatarUrl={profile?.avatar_url ?? metadataAvatar} displayName={displayName}>{children}</WorkspaceShell><SupportCompanion /><ProductQuickActions /></IntelligenceProvider></LanguageProvider></ThemeProvider></body></html>;
}

