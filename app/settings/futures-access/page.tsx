import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import FuturesLiveAccessReview from "@/app/ui/futures-live-access-review";
import { isTidelightOperator } from "@/lib/auth/operator-access";

export const dynamic = "force-dynamic";

export default async function FuturesAccessReviewPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isTidelightOperator(user)) redirect("/overview");

  return <main className="content-wrap inner-page"><FuturesLiveAccessReview /></main>;
}
