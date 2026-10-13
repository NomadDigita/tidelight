type OperatorIdentity = {
  email?: string | null;
  email_confirmed_at?: string | null;
  app_metadata?: Record<string, unknown> | null;
};

const OPERATOR_EMAILS = new Set([
  "muhammadabdulhameed787@gmail.com",
  "thedigitalabiola@gmail.com",
  "salsabilasalsabila218@gmail.com",
]);

/** Use only a Supabase Auth user returned by getUser() on the server. */
export function isTidelightOperator(user: OperatorIdentity | null | undefined): boolean {
  if (!user) return false;

  const role = user.app_metadata?.role;
  const roles = user.app_metadata?.roles;
  const assignedRole = role === "admin" || role === "operator"
    || (Array.isArray(roles) && (roles.includes("admin") || roles.includes("operator")));
  if (assignedRole) return true;

  if (!user.email || !user.email_confirmed_at) return false;
  const email = user.email.trim().toLowerCase();
  return OPERATOR_EMAILS.has(email) || email.endsWith("@tidelight.app");
}
