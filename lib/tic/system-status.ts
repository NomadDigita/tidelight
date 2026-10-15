import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type SystemStatus = {
  status: "operational" | "degraded";
  checkedAt: string;
  components: { application: "operational"; database: "operational" | "degraded" };
};

export async function getSystemStatus(): Promise<SystemStatus> {
  let database: SystemStatus["components"]["database"] = "operational";
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("developer_api_keys").select("id").limit(1);
    if (error) database = "degraded";
  } catch {
    database = "degraded";
  }
  return {
    status: database === "operational" ? "operational" : "degraded",
    checkedAt: new Date().toISOString(),
    components: { application: "operational", database },
  };
}
