import { DashboardPageShell } from "@/components/layout/DashboardPageShell";
import { InventoryAlerts } from "@/components/dashboard/InventoryAlerts";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { getDashboardMetrics } from "@/modules/dashboard/services/metrics";

export default async function DashboardPage() {
  const { metrics, alerts } = await getDashboardMetrics();

  return (
    <DashboardPageShell
      title="Dashboard Gerencial"
      subtitle="Resumen operativo del sistema comercial"
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </div>

      <div className="mt-6">
        <InventoryAlerts alerts={alerts} />
      </div>
    </DashboardPageShell>
  );
}
