import { createClient } from "@/lib/supabase/server";
import CommunityDesk from "@/app/ui/community-desk";
export default async function CommunityPage(){const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();const {data:profile}=user?await supabase.from("community_profiles").select("id,handle,display_name,avatar_url").eq("id",user.id).maybeSingle():{data:null};return <CommunityDesk signedIn={Boolean(user)} userId={user?.id??null} profile={profile??null}/>}
