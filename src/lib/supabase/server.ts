import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

function getSupabaseEnv(): { url: string; publishableKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

  if (!url) {
    throw new Error(
      "Falta NEXT_PUBLIC_SUPABASE_URL. Configúrala en .env.local para desarrollo.",
    );
  }

  if (!publishableKey) {
    throw new Error(
      "Falta NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. Configúrala en .env.local para desarrollo.",
    );
  }

  return { url, publishableKey };
}

export async function createClient() {
  const cookieStore = await cookies();
  const { url, publishableKey } = getSupabaseEnv();

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Ignorado en Server Components de solo lectura.
        }
      },
    },
  });
}
