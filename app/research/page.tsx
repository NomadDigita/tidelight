import { redirect } from "next/navigation";

export default async function ResearchPage({ searchParams }: { searchParams: Promise<{ symbol?: string }> }) {
  const { symbol } = await searchParams;
  redirect(symbol ? `/overview?symbol=${encodeURIComponent(symbol)}` : "/overview");
}
