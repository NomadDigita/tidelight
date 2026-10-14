import NotificationsCenter from "@/app/ui/notifications-center";
import { createClient } from "@/lib/supabase/server";

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return <NotificationsCenter signedIn={Boolean(user)} initialTab={view === "settings" ? "settings" : "all"} />;
}
