import {createClient} from "@/lib/supabase/server";
import CommunityMessages from "@/app/ui/community-messages";
export default async function MessagesPage(){const db=await createClient();const {data:{user}}=await db.auth.getUser();return <CommunityMessages userId={user?.id??null}/>}
