/**
 * @deprecated Flujo legado vía RPC login_app_user.
 * El login principal usa supabase.auth.signInWithPassword en la pantalla /login.
 */
import { createClient } from "@/lib/supabase/client";
import type { DemoSession } from "@/lib/auth/session";

type LoginRpcRow = {
  email?: string;
  name?: string;
  full_name?: string;
  role?: string;
  role_name?: string;
  is_active?: boolean;
  active?: boolean;
};

export type LoginResult =
  | { success: true; session: DemoSession }
  | { success: false; message: string };

function isLoginSuccess(data: unknown): boolean {
  if (data === true) return true;
  if (data === false || data === null) return false;
  if (Array.isArray(data)) return data.length > 0;
  if (typeof data === "object") return Object.keys(data as object).length > 0;
  return Boolean(data);
}

function mapSessionFromResponse(
  email: string,
  data: unknown,
): DemoSession {
  const row = (Array.isArray(data) ? data[0] : data) as LoginRpcRow | undefined;

  return {
    email: row?.email ?? email,
    name: row?.name ?? row?.full_name ?? "Admin Demo",
    role: row?.role ?? row?.role_name ?? "Administrador",
  };
}

export async function loginAppUser(
  email: string,
  password: string,
): Promise<LoginResult> {
  const supabase = createClient();

  const { data, error } = await supabase.rpc("login_app_user", {
    input_email: email.trim(),
    input_password: password,
  });

  if (error) {
    return {
      success: false,
      message: "Credenciales incorrectas o usuario inactivo",
    };
  }

  if (!isLoginSuccess(data)) {
    return {
      success: false,
      message: "Credenciales incorrectas o usuario inactivo",
    };
  }

  const row = (Array.isArray(data) ? data[0] : data) as LoginRpcRow | undefined;
  const isInactive = row?.is_active === false || row?.active === false;

  if (isInactive) {
    return {
      success: false,
      message: "Credenciales incorrectas o usuario inactivo",
    };
  }

  return {
    success: true,
    session: mapSessionFromResponse(email, data),
  };
}
