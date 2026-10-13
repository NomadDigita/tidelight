import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import FuturesLiveAccessReview from "@/app/ui/futures-live-access-review";

export const dynamic = "force-dynamic";

export default async function FuturesAccessReviewPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const roles = user?.app_metadata?.roles;
  const role = user?.app_metadata?.role;
  const reviewer = role === "admin" || role === "operator" || (Array.isArray(roles) && (roles.includes("admin") || roles.includes("operator")));
  if (!reviewer) redirect("/settings");

  return <main className="content-wrap inner-page"><FuturesLiveAccessReview /></main>;
}
