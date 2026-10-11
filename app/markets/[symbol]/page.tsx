import { notFound } from "next/navigation";
import type { Metadata } from "next";
import AssetDetail from "@/app/ui/asset-detail";

export async function generateMetadata({ params }: { params: Promise<{ symbol: string }> }): Promise<Metadata> {
  const { symbol } = await params;
  return { title: `${symbol.toUpperCase()} Stock Research · Tidelight`, description: `Live market context, SEC filings, company profile, and financial statements for ${symbol.toUpperCase()} on Tidelight.` };
}

export default async function AssetPage({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  if (!/^[A-Za-z0-9]{2,32}$/.test(symbol)) notFound();
  return <AssetDetail symbol={symbol.toUpperCase()} />;
}
