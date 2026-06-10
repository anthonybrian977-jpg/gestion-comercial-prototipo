"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.replace("/");
      }
    });
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) {
        setError("Credenciales incorrectas o usuario inactivo");
        setLoading(false);
        return;
      }

      router.refresh();
      router.push("/");
    } catch {
      setError("Credenciales incorrectas o usuario inactivo");
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-[#0c1222] px-4 py-10">
      <div className="mx-auto flex w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-2xl shadow-slate-900/20">
        <div className="hidden w-1/2 flex-col justify-between bg-gradient-to-br from-[#0c1222] via-[#111827] to-cyan-900 p-10 text-white lg:flex">
          <div>
            <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500/15 ring-1 ring-cyan-400/30">
              <span className="text-sm font-bold text-cyan-300">GC</span>
            </div>
            <h1 className="text-3xl font-semibold tracking-tight">
              Gestión Comercial ERP
            </h1>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-slate-300">
              Plataforma administrativa para operaciones comerciales, inventario
              y control operativo.
            </p>
          </div>
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
            Prototipo técnico · Fase 1
          </p>
        </div>

        <div className="flex w-full flex-col justify-center px-8 py-10 lg:w-1/2 lg:px-12">
          <div className="mb-8">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-700">
              Acceso al sistema
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900">
              Iniciar sesión
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Ingresa con tu usuario y contraseña corporativa
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-sm font-medium text-slate-700"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="admin@demo.com"
                required
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-2 focus:ring-cyan-100"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-sm font-medium text-slate-700"
              >
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••"
                required
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-2 focus:ring-cyan-100"
              />
            </div>

            {error ? (
              <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-100">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-cyan-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-cyan-700 disabled:opacity-60"
            >
              {loading ? "Ingresando..." : "Ingresar"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
