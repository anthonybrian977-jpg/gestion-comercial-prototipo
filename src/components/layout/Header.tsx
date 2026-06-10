"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useUserProfile } from "@/components/layout/UserProfileProvider";

type HeaderProps = {
  title: string;
  subtitle?: string;
};

export function Header({ title, subtitle }: HeaderProps) {
  const router = useRouter();
  const profile = useUserProfile();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-10 border-b border-slate-200/80 bg-white/90 px-6 py-4 backdrop-blur-md lg:px-8">
      <div className="flex items-center justify-between gap-6">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-700">
            Gestión Comercial ERP
          </p>
          <h2 className="mt-0.5 truncate text-2xl font-semibold tracking-tight text-slate-900">
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-3">
          {profile ? (
            <div className="hidden rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-right md:block">
              <p className="text-sm font-medium text-slate-900">{profile.name}</p>
              <p className="text-xs text-slate-500">{profile.role}</p>
            </div>
          ) : null}
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    </header>
  );
}
