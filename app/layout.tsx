import type { Metadata } from "next";
import "./globals.css";
import { createClient } from "@/lib/supabase/server";
import WorkspaceShell from "./ui/workspace-shell";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://tidelight-two.vercel.app"),
  title: "Tidelight — See the signal between sessions",
  description: "An after-hours research desk for tokenized US equities. Follow market events with clear context, scenarios, and sources.",
  icons: { icon: "/tidelight-mark.svg" },
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
  return <html lang="en"><body><WorkspaceShell email={user?.email ?? null}>{children}</WorkspaceShell></body></html>;
}
