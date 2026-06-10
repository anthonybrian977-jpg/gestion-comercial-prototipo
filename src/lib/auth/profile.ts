import type { SupabaseClient } from "@supabase/supabase-js";

export type AppUserProfile = {
  name: string;
  role: string;
  email: string | null;
};

export function formatRole(role: string): string {
  if (role.toLowerCase() === "admin") return "Administrador";
  return role;
}

export async function getAppUserProfile(
  supabase: SupabaseClient,
  authUserId: string,
): Promise<AppUserProfile | null> {
  const { data, error } = await supabase
    .from("app_users")
    .select("name, role, email")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return {
    name: data.name,
    role: formatRole(data.role),
    email: data.email ?? null,
  };
}
