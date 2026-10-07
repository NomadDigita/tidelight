import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
export async function GET(request:Request){
 const url=new URL(request.url);const code=url.searchParams.get("code");
 if(code){const supabase=await createClient();const {error}=await supabase.auth.exchangeCodeForSession(code);if(!error){const {data:{user}}=await supabase.auth.getUser();const isNew=user?.created_at&&Date.now()-Date.parse(user.created_at)<10*60*1000;return NextResponse.redirect(new URL(isNew?"/settings?setup=username#profile":"/",url.origin));}}
 return NextResponse.redirect(new URL("/login?error=link",url.origin));
}