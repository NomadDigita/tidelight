import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type Post = { id: string; author_id: string; body: string; symbol: string | null; stance: string; source_url: string | null; media: unknown[] | null; reply_to: string | null; quote_post_id: string | null; created_at: string };
const joined = "id,author_id,body,symbol,stance,source_url,media,reply_to,quote_post_id,created_at";
function normalizeHandle(raw: string) { return raw.replace(/^@/, "").toLowerCase(); }
async function fetchPosts(db: Awaited<ReturnType<typeof createClient>>, ids: string[]) {
  if (!ids.length) return [];
  const { data, error } = await db.from("community_posts").select(joined).in("id", ids);
  if (error) throw error;
  const rows = (data ?? []) as Post[];
  const byId = new Map(rows.map(row => [row.id, row]));
  const authorIds = [...new Set(rows.map(row => row.author_id))];
  const { data: authors, error: authorError } = authorIds.length ? await db.from("community_profiles").select("id,handle,display_name,avatar_url").in("id", authorIds) : { data: [], error: null };
  if (authorError) throw authorError;
  const byAuthor = new Map((authors ?? []).map(row => [row.id, row]));
  return ids.flatMap(id => {
    const row = byId.get(id);
    if (!row) return [];
    const expired = Date.now() - Date.parse(row.created_at) > 7 * 24 * 60 * 60 * 1000;
    return [{ ...row, author: byAuthor.get(row.author_id), media: expired ? [] : (row.media ?? []), mediaExpired: expired && (row.media ?? []).length > 0 }];
  });
}
export async function GET(_request: Request, { params }: { params: Promise<{ handle: string }> }) {
  const handle = normalizeHandle((await params).handle);
  if (!/^[a-z0-9]{4,8}$/.test(handle)) return NextResponse.json({ error: "That username is not valid." }, { status: 400 });
  const db = await createClient(), { data: { user } } = await db.auth.getUser();
  const { data: profile, error: profileError } = await db.from("community_profiles").select("id,handle,display_name,avatar_url,bio,created_at,show_studio_stats").eq("handle", handle).maybeSingle();
  if (profileError) return NextResponse.json({ error: "Profile could not be loaded." }, { status: 503 });
  if (!profile) return NextResponse.json({ error: "This Tidelight profile could not be found." }, { status: 404 });
  try {
    const [own, repost, like] = await Promise.all([
      db.from("community_posts").select("id").eq("author_id", profile.id).is("reply_to", null).order("created_at", { ascending: false }).limit(100),
      db.from("community_reactions").select("post_id").eq("user_id", profile.id).eq("kind", "repost").order("created_at", { ascending: false }).limit(100),
      db.from("community_reactions").select("post_id").eq("user_id", profile.id).eq("kind", "like").order("created_at", { ascending: false }).limit(100),
    ]);
    if (own.error || repost.error || like.error) throw own.error ?? repost.error ?? like.error;
    const [posts, reposts, likes] = await Promise.all([fetchPosts(db, (own.data ?? []).map(x => x.id)), fetchPosts(db, (repost.data ?? []).map(x => x.post_id)), fetchPosts(db, (like.data ?? []).map(x => x.post_id))]);
    const isOwner = user?.id === profile.id;
    let saved: Awaited<ReturnType<typeof fetchPosts>> = [];
    if (isOwner && user) {
      const { data, error } = await db.from("community_bookmarks").select("post_id").eq("user_id", user.id).order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      saved = await fetchPosts(db, (data ?? []).map(x => x.post_id));
    }
    // The RPC checks current opt-in atomically and only returns aggregate counts.
    // No privileged row data is queried or serialized by this endpoint.
    let studioStats: unknown = null;
    if (profile.show_studio_stats === true) {
      const { data, error } = await createAdminClient().rpc("community_public_studio_stats", { p_profile_id: profile.id });
      if (error) throw error;
      studioStats = data;
    }
    return NextResponse.json({ profile, isOwner, posts, reposts, likes, saved, studioStats });
  } catch (error) {
    console.error("Community profile activity failed", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({ error: "Profile activity is temporarily unavailable." }, { status: 503 });
  }
}
export async function PATCH(request: Request, { params }: { params: Promise<{ handle: string }> }) {
  const db = await createClient(), { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to update your research profile." }, { status: 401 });
  let value: unknown;
  try { value = await request.json(); } catch { return NextResponse.json({ error: "Send a sharing preference." }, { status: 400 }); }
  if (!value || typeof value !== "object" || Array.isArray(value) || !("showStudioStats" in value) || typeof value.showStudioStats !== "boolean") return NextResponse.json({ error: "Choose whether to share Studio counts." }, { status: 400 });
  const handle = normalizeHandle((await params).handle);
  const { data, error } = await db.from("community_profiles").update({ show_studio_stats: value.showStudioStats }).eq("id", user.id).eq("handle", handle).select("show_studio_stats").maybeSingle();
  if (error) return NextResponse.json({ error: "Your sharing preference could not be saved." }, { status: 503 });
  if (!data) return NextResponse.json({ error: "Only your own profile can be updated." }, { status: 403 });
  return NextResponse.json({ showStudioStats: data.show_studio_stats });
}
