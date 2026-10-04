"use server";

import { createClient } from "@/lib/supabase/server";

export async function saveResearchQuestion(question: string) {
  const cleaned = question.trim();
  if (!cleaned || cleaned.length > 500) return { error: "Enter a question under 500 characters." };

  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return { error: "Sign in to save this research question." };

  const { data, error } = await supabase
    .from("research_runs")
    .insert({ user_id: user.id, question: cleaned, status: "queued", model_name: null })
    .select("id")
    .single();

  if (error) return { error: "Could not save this question. Please try again." };
  return { id: data.id };
}
