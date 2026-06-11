import Link from "next/link";
import { DashboardPageShell } from "@/components/layout/DashboardPageShell";

// ─── Tarjeta de módulo ────────────────────────────────────────────────────────

function ModuleCard({
  title,
  description,
  href,
  ctaLabel,
  icon,
  accent,
}: {
  title: string;
  description: string;
  href: string;
  ctaLabel: string;
  icon: string;
  accent: string;
}) {
  return (
    <Link
      href={href}
      className="group block rounded-2xl border border-slate-200 bg-white p-8 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl text-2xl ${accent}`}>
        {icon}
      </div>
      <h2 className="text-lg font-bold text-slate-900">{title}</h2>
      <p className="mt-2 text-sm text-slate-500">{description}</p>
      <span
        className={`mt-6 inline-block rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${accent} group-hover:opacity-90`}
      >
        {ctaLabel} →
      </span>
    </Link>
  );
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default function FacturacionPage() {
  return (
    <DashboardPageShell
      title="Facturación"
      subtitle="Gestión de facturas de compra y venta"
    >
      <div className="grid gap-6 sm:grid-cols-2">
        <ModuleCard
          title="Facturas a Clientes"
          description="Crea y gestiona facturas de venta. Selecciona productos del Maestro, fija cantidades y emite las facturas a tus clientes."
          href="/facturacion/clientes"
          ctaLabel="Ver Facturas a Clientes"
          icon="🧾"
          accent="bg-cyan-50 text-cyan-700"
        />
        <ModuleCard
          title="Facturas de Proveedor"
          description="Registra y controla las cuentas por pagar. Genera facturas de proveedor a partir de los ingresos de mercadería confirmados."
          href="/facturacion/proveedores"
          ctaLabel="Ver Facturas de Proveedor"
          icon="📦"
          accent="bg-violet-50 text-violet-700"
        />
      </div>
    </DashboardPageShell>
  );
}
