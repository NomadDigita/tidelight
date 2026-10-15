import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { type DeveloperRole } from "./organization-rbac";

export type { DeveloperRole } from "./organization-rbac";
export type OrganizationMembership = { organization_id: string; user_id: string; role: DeveloperRole };
export type OrganizationSummary = { id: string; name: string; slug: string; created_at: string; role: DeveloperRole };

export async function listOrganizationMemberships(admin: SupabaseClient, userId: string): Promise<OrganizationMembership[]> {
  const { data, error } = await admin.from("developer_organization_members").select("organization_id,user_id,role").eq("user_id", userId);
  if (error) throw error;
  return (data ?? []) as OrganizationMembership[];
}

export async function ensurePersonalOrganization(admin: SupabaseClient, userId: string): Promise<void> {
  const { error } = await admin.rpc("ensure_personal_developer_organization", { p_user_id: userId });
  if (error) throw error;
}

export async function listDeveloperOrganizations(admin: SupabaseClient, userId: string): Promise<OrganizationSummary[]> {
  await ensurePersonalOrganization(admin, userId);
  const { data, error } = await admin.from("developer_organization_members")
    .select("role,organization:developer_organizations!inner(id,name,slug,created_at)")
    .eq("user_id", userId);
  if (error) throw error;
  return (data ?? []).flatMap((row: { role: DeveloperRole; organization: Pick<OrganizationSummary, "id" | "name" | "slug" | "created_at"> | Pick<OrganizationSummary, "id" | "name" | "slug" | "created_at">[] | null }) => {
    const org = Array.isArray(row.organization) ? row.organization[0] : row.organization;
    return org ? [{ ...org, role: row.role }] : [];
  });
}

export async function getOrganizationRole(admin: SupabaseClient, organizationId: string, userId: string): Promise<DeveloperRole | null> {
  const { data, error } = await admin.from("developer_organization_members").select("role")
    .eq("organization_id", organizationId).eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return (data?.role as DeveloperRole | undefined) ?? null;
}

export async function listAccessibleProjects(admin: SupabaseClient, userId: string) {
  const memberships = await listOrganizationMemberships(admin, userId);
  if (!memberships.length) return [];
  const ids = [...new Set(memberships.map(member => member.organization_id))];
  const { data, error } = await admin.from("developer_projects")
    .select("id,organization_id,name,created_at").in("organization_id", ids).order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getProjectRole(admin: SupabaseClient, projectId: string, userId: string): Promise<DeveloperRole | null> {
  const { data: project, error: projectError } = await admin.from("developer_projects").select("organization_id").eq("id", projectId).maybeSingle();
  if (projectError) throw projectError;
  if (!project) return null;
  return getOrganizationRole(admin, project.organization_id, userId);
}
