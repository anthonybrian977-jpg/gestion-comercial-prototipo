/**
 * @deprecated Sesión demo en localStorage. No usar en el flujo principal.
 * La autenticación actual usa Supabase Auth con cookies (@supabase/ssr).
 */

export const AUTH_STORAGE_KEY = "gcp-demo-session";

export type DemoSession = {
  email: string;
  name: string;
  role: string;
};

export function getDemoSession(): DemoSession | null {
  if (typeof window === "undefined") return null;

  const raw = localStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as DemoSession;
  } catch {
    return null;
  }
}

export function setDemoSession(session: DemoSession): void {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
}

export function clearDemoSession(): void {
  localStorage.removeItem(AUTH_STORAGE_KEY);
}

export function isAuthenticated(): boolean {
  return getDemoSession() !== null;
}
