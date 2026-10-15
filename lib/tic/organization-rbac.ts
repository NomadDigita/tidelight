export type DeveloperRole = "owner" | "admin" | "developer" | "reader";

export function canManageOrganization(role: DeveloperRole): boolean {
  return role === "owner" || role === "admin";
}

export function canWriteOrganization(role: DeveloperRole): boolean {
  return role === "owner" || role === "admin" || role === "developer";
}

export function canRevokeOrganizationKey(role: DeveloperRole, createdByCurrentUser: boolean): boolean {
  return canWriteOrganization(role) || createdByCurrentUser;
}
