"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { mainNavItems } from "@/lib/navigation";
import { NavIcon } from "@/components/layout/NavIcon";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-[17.5rem] shrink-0 flex-col bg-[#0c1222] text-white shadow-xl shadow-slate-900/10">
      <div className="border-b border-white/10 px-5 py-6">
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/15 ring-1 ring-cyan-400/30">
          <span className="text-sm font-bold tracking-tight text-cyan-300">GC</span>
        </div>
        <h1 className="text-base font-semibold leading-tight text-white">
          Gestión Comercial ERP
        </h1>
        <p className="mt-1 text-xs text-slate-400">Panel administrativo</p>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          Módulos
        </p>
        {mainNavItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                isActive
                  ? "bg-cyan-500/15 text-cyan-50 shadow-sm ring-1 ring-cyan-400/20"
                  : "text-slate-300 hover:bg-white/5 hover:text-white"
              }`}
            >
              {isActive ? (
                <span className="absolute left-0 top-1/2 h-8 w-1 -translate-y-1/2 rounded-r-full bg-cyan-400" />
              ) : null}
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors ${
                  isActive
                    ? "bg-cyan-500/20 text-cyan-300"
                    : "bg-white/5 text-slate-400 group-hover:bg-white/10 group-hover:text-slate-200"
                }`}
              >
                <NavIcon name={item.icon} className="h-[18px] w-[18px]" />
              </span>
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 px-5 py-4 text-xs text-slate-500">
        Inventario conectado a Supabase
      </div>
    </aside>
  );
}
