import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
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

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
